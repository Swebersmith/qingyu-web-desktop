import test from 'node:test';
import assert from 'node:assert/strict';
import {CloudSync,SYNC_STORAGE_KEY} from '../sync-client.js';
import {generateSyncKey} from '../sync-model.js';

const clone=value=>value===undefined?undefined:structuredClone(value);
function desktop(){return {version:6,pages:[{id:'home',name:'首页'}],apps:[{id:'a',name:'App A',url:'https://a.example',page:'home'}],folders:[],widgets:[{id:'note',page:'home',type:'note',content:'原便签'}],dock:[],todos:[],layout:{desktop:{},tablet:{},mobile:{}},wallpaper:'sunny'};}
function memory(){const data=new Map();return {get:async key=>clone(data.get(key)),set:async(key,value)=>data.set(key,clone(value)),remove:async key=>data.delete(key),getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};}
function server(){
  const rows=new Map(),calls=[];
  return {rows,calls,hook:null,async fetcher(url,options){
    calls.push({url,method:options.method});const key=options.headers.Authorization.slice(7),row=rows.get(key),payload=options.body?JSON.parse(options.body):null;
    await this.hook?.(options,payload);
    if(options.method==='GET'){
      if(!row)return Response.json({error:'desktop_not_found'},{status:404});
      if(options.headers['If-None-Match']===`"${row.revision}"`)return new Response(null,{status:304});return Response.json(row);
    }
    if((row?.revision||0)!==payload.baseRevision)return Response.json({error:'revision_conflict',...row},{status:409});
    const next={state:payload.state,revision:(row?.revision||0)+1,updatedAt:new Date().toISOString()};rows.set(key,next);return Response.json({revision:next.revision,updatedAt:next.updatedAt});
  }};
}
async function device(service,options={}){
  let state=desktop(),busy=false,online=true;const storage=options.storage||memory(),cache=options.cache||memory();
  const sync=new CloudSync({getState:()=>clone(state),applyState:next=>{state=next;},isBusy:()=>busy,online:()=>online,fetcher:service.fetcher.bind(service),cache,storage});await sync.init();
  return {sync,storage,cache,get state(){return state;},edit:action=>{action(state);sync.localChanged();},busy:value=>busy=value,online:value=>online=value};
}
test('two devices pair, synchronize content and preserve separate desktop/mobile layouts',async t=>{
  const service=server(),a=await device(service),b=await device(service),key=generateSyncKey();t.after(()=>{a.sync.disconnect();b.sync.disconnect();});
  assert.ok(await a.sync.connect(key,true));b.edit(data=>data.apps[0].name='接入前的本机名称');await b.sync.connect(key);
  assert.equal(b.state.apps[0].name,'App A');assert.equal(b.sync.backups[0].state.apps[0].name,'接入前的本机名称');
  a.edit(data=>data.apps[0].name='同步名称');b.edit(data=>{data.widgets[0].content='手机便签';data.layout.mobile.a={page:'home',x:1,y:2};});
  await a.sync.run();await b.sync.run();await a.sync.run();assert.equal(a.state.widgets[0].content,'手机便签');assert.equal(b.state.apps[0].name,'同步名称');assert.deepEqual(a.state.layout.mobile.a,{page:'home',x:1,y:2});
  assert.ok(service.calls.every(call=>call.url==='/api/sync'));assert.ok(!JSON.stringify(service.rows.get(key).state).includes(key));
});
test('offline edits survive and are merged with changes made by the other device',async t=>{
  const service=server(),a=await device(service),b=await device(service),key=generateSyncKey();t.after(()=>{a.sync.disconnect();b.sync.disconnect();});await a.sync.connect(key,true);await b.sync.connect(key);
  b.online(false);b.edit(data=>data.widgets[0].content='断网时编辑');await b.sync.run();assert.equal(b.sync.phase,'offline');
  a.edit(data=>data.apps[0].name='另一设备');await a.sync.run();b.online(true);await b.sync.run();await a.sync.run();assert.equal(b.state.apps[0].name,'另一设备');assert.equal(a.state.widgets[0].content,'断网时编辑');
});
test('same-field conflicts pause writes and resolving them backs up the other version',async t=>{
  const service=server(),a=await device(service),b=await device(service),key=generateSyncKey();t.after(()=>{a.sync.disconnect();b.sync.disconnect();});await a.sync.connect(key,true);await b.sync.connect(key);
  a.edit(data=>data.apps[0].name='A 名称');b.edit(data=>data.apps[0].name='B 名称');await a.sync.run();await b.sync.run();assert.equal(b.sync.phase,'conflict');assert.equal(b.state.apps[0].name,'B 名称');assert.equal(service.rows.get(key).state.apps[0].name,'A 名称');
  await b.sync.resolve('local');assert.equal(service.rows.get(key).state.apps[0].name,'B 名称');assert.equal(b.sync.backups[0].state.apps[0].name,'A 名称');await a.sync.run();assert.equal(a.state.apps[0].name,'B 名称');
});
test('editing during an upload is not overwritten by its older acknowledgement',async t=>{
  const service=server(),a=await device(service),key=generateSyncKey();t.after(()=>a.sync.disconnect());await a.sync.connect(key,true);
  let started,release;const uploading=new Promise(resolve=>started=resolve),hold=new Promise(resolve=>release=resolve);
  service.hook=async options=>{if(options.method==='PUT'){started();await hold;}};a.edit(data=>data.apps[0].name='第一次编辑');const operation=a.sync.run();await uploading;
  a.edit(data=>data.widgets[0].content='上传途中编辑');release();await operation;assert.equal(a.state.widgets[0].content,'上传途中编辑');assert.equal(a.sync.phase,'pending');service.hook=null;await a.sync.run();assert.equal(service.rows.get(key).state.widgets[0].content,'上传途中编辑');
});
test('active editing delays pulls; checkpoints allow pending edits to resume after reload',async t=>{
  const service=server(),a=await device(service),b=await device(service),key=generateSyncKey();t.after(()=>{a.sync.disconnect();b.sync.disconnect();});await a.sync.connect(key,true);await b.sync.connect(key);
  b.busy(true);a.edit(data=>data.apps[0].name='远程更新');await a.sync.run();await b.sync.run();assert.equal(b.state.apps[0].name,'App A');b.busy(false);b.edit(data=>data.widgets[0].content='刷新前未上传');
  clearTimeout(b.sync.timer);const storage=b.storage,cache=b.cache,snapshot=clone(b.state);const reloaded=await device(service,{storage,cache});reloaded.edit(data=>Object.assign(data,snapshot));t.after(()=>reloaded.sync.disconnect());await reloaded.sync.run();assert.equal(reloaded.state.apps[0].name,'远程更新');assert.equal(service.rows.get(key).state.widgets[0].content,'刷新前未上传');
});
test('disconnect retains local data and prevents a stale response from applying after disconnect',async t=>{
  const service=server(),a=await device(service),key=generateSyncKey();t.after(()=>a.sync.disconnect());await a.sync.connect(key,true);const before=clone(a.state);
  let started,release;const fetching=new Promise(resolve=>started=resolve),hold=new Promise(resolve=>release=resolve);service.hook=async()=>{started();await hold;};const operation=a.sync.run();await fetching;a.sync.disconnect();release();await operation;
  assert.deepEqual(a.state,before);assert.equal(a.storage.getItem(SYNC_STORAGE_KEY),null);assert.equal(a.sync.phase,'off');
});
