import {SYNC_KEY_PATTERN,MAX_SYNC_BYTES,sameState,mergeDesktop,validDesktop,generateSyncKey,resolveSyncKey} from './sync-model.js';

export const SYNC_STORAGE_KEY='weboss-cloud-key-v1';
const clone=value=>JSON.parse(JSON.stringify(value));
export const SYNC_MESSAGES={
  database_not_bound:'请在 Cloudflare 为 Worker 绑定 D1 数据库，变量名称为 DB。',
  database_unavailable:'云数据库暂不可用，本机改动已保留。',
  desktop_not_found:'找不到该云桌面，请检查同步密钥。',
  desktop_too_large:'桌面数据超过 1 MB，请缩小自定义壁纸或使用图片 URL。',
  invalid_desktop:'桌面配置无法同步，请检查导入的数据。',
  sync_key_required:'请输入完整的同步密钥。',
  custom_key_invalid:'自定义密钥需要 12～128 个字符，可以使用中文；请勿使用换行。',
  sync_key_in_use:'此密钥已用于另一云桌面，请换一个密钥或连接已有桌面。',
  finish_sync_first:'请先完成同步并处理冲突，再更换密钥。',
  rate_limited:'同步操作较频繁，稍后自动重试。',
  sync_unavailable:'同步服务暂不可用。请部署 Workers 版本并检查网络。',
  cache_unavailable:'浏览器无法保存同步记录，请检查存储权限或空间。',
  client_outdated:'云桌面使用较新版本，请刷新页面后再同步。'
};
class SyncError extends Error {constructor(code,remote){super(SYNC_MESSAGES[code]||SYNC_MESSAGES.sync_unavailable);this.code=code;this.remote=remote;}}

export function createSyncCache(){
  let database;
  async function open(){
    if(!database)database=new Promise((resolve,reject)=>{
      if(!globalThis.indexedDB)return reject(new SyncError('cache_unavailable'));
      const request=indexedDB.open('weboss-sync-cache',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('records');
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new SyncError('cache_unavailable'));
      request.onblocked=()=>reject(new SyncError('cache_unavailable'));
    });return database;
  }
  async function access(key,mode,value,remove=false){
    const db=await open();return new Promise((resolve,reject)=>{
      const transaction=db.transaction('records',mode),store=transaction.objectStore('records');
      const request=mode==='readonly'?store.get(key):remove?store.delete(key):store.put(value,key);let result;
      request.onsuccess=()=>{result=request.result;};transaction.oncomplete=()=>resolve(result);
      transaction.onerror=transaction.onabort=()=>reject(new SyncError('cache_unavailable'));
    });
  }
  return {get:key=>access(key,'readonly'),set:(key,value)=>access(key,'readwrite',value),remove:key=>access(key,'readwrite',null,true)};
}

export class CloudSync {
  constructor({getState,applyState,isBusy=()=>false,onStatus=()=>{},cache=createSyncCache(),storage=globalThis.localStorage,fetcher=(...args)=>globalThis.fetch(...args),online=()=>globalThis.navigator?.onLine!==false,version=6}){
    Object.assign(this,{getState,applyState,isBusy,onStatus,cache,storage,fetcher,online,version});
    this.key=null;this.base=null;this.revision=0;this.updatedAt=null;this.phase='off';this.backups=[];this.conflict=null;this.generation=0;this.running=false;this.ready=false;
  }
  status(phase,detail=''){
    this.phase=phase;this.detail=detail;this.onStatus({phase,detail,connected:!!this.key,revision:this.revision,updatedAt:this.updatedAt,conflict:this.conflict,backups:this.backups});
  }
  async init(){
    const generation=this.generation;
    try{
      this.backups=await this.cache.get('backups')||[];
      const key=this.storage.getItem(SYNC_STORAGE_KEY),record=await this.cache.get('checkpoint');
      if(generation!==this.generation)return;
      if(SYNC_KEY_PATTERN.test(key||'')){
        this.key=key;
        if(record?.key===key&&validDesktop(record.base)&&Number.isSafeInteger(record.revision)&&record.revision>0){this.base=record.base;this.revision=record.revision;this.updatedAt=record.updatedAt;}
      }
      this.ready=true;this.status(this.key?(this.base?'pending':'reconnect'):'off');if(this.base)this.schedule(100);
    }catch(error){if(generation===this.generation){this.ready=true;this.status('error',error.message||SYNC_MESSAGES.cache_unavailable);}}
  }
  async request(key,method='GET',payload,revision,path='/api/sync'){
    const controller=new AbortController();this.controller=controller;const timer=setTimeout(()=>controller.abort(),12000);
    try{
      const headers={Authorization:`Bearer ${key}`};if(payload)headers['Content-Type']='application/json';if(revision)headers['If-None-Match']=`"${revision}"`;
      const body=payload?JSON.stringify(payload):undefined;if(body&&new TextEncoder().encode(body).byteLength>MAX_SYNC_BYTES)throw new SyncError('desktop_too_large');
      const response=await this.fetcher(path,{method,headers,body,signal:controller.signal,cache:'no-store',credentials:'same-origin'});
      if(response.status===304)return {notModified:true};
      let data;try{data=await response.json();}catch{throw new SyncError('sync_unavailable');}
      if(!response.ok)throw new SyncError(data.error,response.status===409?data:undefined);
      if(data.state){if(!validDesktop(data.state))throw new SyncError('invalid_desktop');if(data.state.version>this.version)throw new SyncError('client_outdated');}
      if(!Number.isSafeInteger(data.revision)||data.revision<1)throw new SyncError('sync_unavailable');return data;
    }catch(error){if(error instanceof SyncError)throw error;throw new SyncError('sync_unavailable');}
    finally{clearTimeout(timer);if(this.controller===controller)this.controller=null;}
  }
  async backup(state,label){
    const item={id:crypto.randomUUID(),state:clone(state),label,savedAt:new Date().toISOString()};
    const backups=[item,...this.backups].slice(0,3);await this.cache.set('backups',backups);this.backups=backups;
  }
  async checkpoint(remote){
    this.base=clone(remote.state);this.revision=remote.revision;this.updatedAt=remote.updatedAt;
    await this.cache.set('checkpoint',{key:this.key,base:this.base,revision:this.revision,updatedAt:this.updatedAt});
  }
  async connect(key=generateSyncKey(),create=false){
    if(this.running||!this.ready)return false;
    const generation=++this.generation;this.running=true;this.controller?.abort();this.status('syncing');
    try{
      try{key=await resolveSyncKey(key);}catch(error){throw new SyncError(error.message);}
      if(this.generation!==generation)return false;
      const local=clone(this.getState()),response=await this.request(key,create?'PUT':'GET',create?{state:local,baseRevision:0}:undefined);
      if(this.generation!==generation)return false;
      const remote=create?{...response,state:local}:response;
      if(!create){await this.backup(this.getState(),'接入云桌面前');if(this.generation!==generation)return false;this.applyState(clone(remote.state));}
      this.key=key;await this.checkpoint(remote);if(this.generation!==generation)return false;
      this.storage.setItem(SYNC_STORAGE_KEY,key);this.conflict=null;this.status(sameState(this.getState(),this.base)?'synced':'pending');this.schedule();return true;
    }catch(error){if(create&&error.code==='revision_conflict')error=new SyncError('sync_key_in_use');if(this.generation===generation)this.status('error',error.message);throw error;}
    finally{this.running=false;}
  }
  async changeKey(value){
    if(this.running||!this.key||!this.base||this.conflict)throw new SyncError('finish_sync_first');
    const initialGeneration=this.generation,initialKey=this.key;
    let next;try{next=await resolveSyncKey(value);}catch(error){throw new SyncError(error.message);}
    if(this.generation!==initialGeneration||this.key!==initialKey)return false;
    await this.run(true);
    if(this.generation!==initialGeneration||this.key!==initialKey)return false;
    if(this.phase!=='synced'||!sameState(this.getState(),this.base)||this.running)throw new SyncError('finish_sync_first');
    if(next===this.key)return true;
    const generation=++this.generation;this.running=true;clearTimeout(this.timer);this.status('syncing');
    try{
      const response=await this.request(this.key,'POST',{newKey:next,baseRevision:this.revision},undefined,'/api/sync/key');
      if(this.generation!==generation)return false;
      this.key=next;this.storage.setItem(SYNC_STORAGE_KEY,next);await this.checkpoint({...response,state:this.base});
      if(this.generation!==generation)return false;this.status(sameState(this.getState(),this.base)?'synced':'pending');return true;
    }catch(error){if(this.generation===generation)this.status('error',error.message);throw error;}
    finally{this.running=false;if(this.key&&this.base)this.schedule();}
  }
  disconnect(clearCredential=true){
    ++this.generation;this.controller?.abort();clearTimeout(this.timer);if(clearCredential)this.storage.removeItem(SYNC_STORAGE_KEY);
    this.key=null;this.base=null;this.revision=0;this.updatedAt=null;this.conflict=null;this.status('off');
  }
  schedule(delay=900){
    clearTimeout(this.timer);if(!this.key||!this.base||this.conflict)return;
    this.timer=setTimeout(()=>this.run(),delay);this.timer.unref?.();
  }
  localChanged(){
    if(!this.key||!this.base)return;if(this.conflict){this.status('conflict');return;}
    this.status(this.online()?'pending':'offline');this.schedule();
  }
  async run(force=false){
    if(!this.ready||!this.key||!this.base||this.running||(!force&&this.conflict))return;
    if(!this.online()){this.status('offline');return;}
    if(this.isBusy()){this.status('pending','正在编辑，结束后同步');this.schedule(1500);return;}
    const generation=this.generation;this.running=true;this.status('syncing');
    try{
      for(let attempt=0;attempt<3;attempt++){
        let remote=await this.request(this.key,'GET',undefined,this.revision);
        if(this.generation!==generation)return;
        if(remote.notModified)remote={state:this.base,revision:this.revision,updatedAt:this.updatedAt};
        const local=clone(this.getState()),merged=mergeDesktop(this.base,local,remote.state);
        if(merged.conflicts.length){this.conflict={remote,fields:merged.conflicts};this.status('conflict');return;}
        if(this.isBusy()){this.status('pending','正在编辑，结束后同步');return;}
        if(!sameState(local,merged.state)){
          await this.backup(local,'云端更新前');if(this.generation!==generation)return;
          if(this.isBusy()||!sameState(this.getState(),local))continue;
          this.applyState(clone(merged.state));
        }
        await this.checkpoint(remote);if(this.generation!==generation)return;
        const upload=clone(this.getState());
        if(sameState(upload,this.base)){this.conflict=null;this.status('synced');return;}
        try{
          const result=await this.request(this.key,'PUT',{state:upload,baseRevision:this.revision});if(this.generation!==generation)return;
          await this.checkpoint({...result,state:upload});if(this.generation!==generation)return;
          this.conflict=null;this.status(sameState(this.getState(),this.base)?'synced':'pending');return;
        }catch(error){if(error.code!=='revision_conflict')throw error;}
      }
      this.status('pending','其他设备正在更新，稍后重试');
    }catch(error){if(this.generation===generation)this.status(this.online()?'error':'offline',error.message);}
    finally{
      this.running=false;
      if(this.generation===generation&&this.key&&this.base&&!this.conflict&&(!sameState(this.getState(),this.base)||this.phase==='pending'))this.schedule(this.phase==='error'?15000:1500);
    }
  }
  async resolve(choice){
    if(!this.conflict||this.running)return;
    const generation=this.generation,remote=this.conflict.remote;this.running=true;this.status('syncing');
    try{
      if(choice==='cloud'){
        await this.backup(this.getState(),'解决冲突前的本机桌面');if(this.generation!==generation)return;
        this.applyState(clone(remote.state));await this.checkpoint(remote);
      }else{
        const local=clone(this.getState());await this.backup(remote.state,'解决冲突前的云桌面');if(this.generation!==generation)return;
        const result=await this.request(this.key,'PUT',{state:local,baseRevision:remote.revision});if(this.generation!==generation)return;
        await this.checkpoint({...result,state:local});
      }
      if(this.generation!==generation)return;this.conflict=null;this.status(sameState(this.getState(),this.base)?'synced':'pending');this.schedule();
    }catch(error){
      if(this.generation!==generation)return;
      if(error.remote){this.conflict={remote:error.remote,fields:this.conflict.fields};this.status('conflict','云端再次更新，请重新选择版本');}
      else this.status('error',error.message);
    }finally{this.running=false;}
  }
  async restoreBackup(id){
    const backup=this.backups.find(item=>item.id===id);if(!backup||this.running)return;
    await this.backup(this.getState(),'恢复备份前');this.applyState(clone(backup.state));this.localChanged();
  }
}
