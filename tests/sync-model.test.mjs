import test from 'node:test';
import assert from 'node:assert/strict';
import {generateSyncKey,SYNC_KEY_PATTERN,mergeDesktop,validDesktop} from '../sync-model.js';

export function desktop(){return {
  version:6,pages:[{id:'home',name:'首页'}],apps:[{id:'a',name:'App A',url:'https://a.example/',page:'home'},{id:'b',name:'App B',url:'https://b.example/',page:'home'}],
  widgets:[{id:'note',page:'home',type:'note',content:'原便签'}],folders:[],dock:[],layout:{desktop:{a:{page:'home',x:0,y:0}},tablet:{},mobile:{}},todos:[{id:'todo',text:'阅读',done:false}],history:[],searchHistory:[],favoriteIds:[],wallpaper:'sunny'
};}
test('sync keys have 256 bits of entropy and never use URLs or guessable desktop names',()=>{
  const keys=Array.from({length:20},generateSyncKey);assert.equal(new Set(keys).size,20);assert.ok(keys.every(key=>SYNC_KEY_PATTERN.test(key)&&key.length===46));assert.ok(!SYNC_KEY_PATTERN.test('my-desktop'));
});
test('concurrent content changes and layouts on different devices merge independently',()=>{
  const base=desktop(),local=structuredClone(base),remote=structuredClone(base);
  local.apps[0].name='本机名称';local.layout.desktop.a.x=3;
  remote.widgets[0].content='另一设备的便签';remote.layout.mobile.a={page:'home',x:1,y:2};remote.todos[0].done=true;
  const result=mergeDesktop(base,local,remote);assert.deepEqual(result.conflicts,[]);assert.equal(result.state.apps[0].name,'本机名称');assert.equal(result.state.widgets[0].content,'另一设备的便签');assert.equal(result.state.layout.desktop.a.x,3);assert.equal(result.state.layout.mobile.a.y,2);assert.equal(result.state.todos[0].done,true);
});
test('different edits to the same field and edit/delete conflicts require a choice',()=>{
  const base=desktop(),local=structuredClone(base),remote=structuredClone(base);local.apps[0].name='本机';remote.apps[0].name='云端';
  assert.deepEqual(mergeDesktop(base,local,remote).conflicts,['apps.a.name']);
  remote.apps=remote.apps.filter(app=>app.id!=='a');delete remote.layout.desktop.a;assert.ok(mergeDesktop(base,local,remote).conflicts.includes('apps.a'));
});
test('independent additions and Dock changes merge without duplicate entries',()=>{
  const base=desktop(),local=structuredClone(base),remote=structuredClone(base);local.apps.push({id:'c',name:'C',url:'https://c.example',page:'home'});remote.apps.push({id:'d',name:'D',url:'https://d.example',page:'home'});local.dock=['a'];remote.dock=['b'];
  const result=mergeDesktop(base,local,remote);assert.deepEqual(result.conflicts,[]);assert.deepEqual(result.state.apps.map(app=>app.id),['a','b','c','d']);assert.deepEqual(result.state.dock,['a','b']);assert.ok(validDesktop(result.state));
});
test('conflicting folder membership cannot silently pick a folder',()=>{
  const base=desktop();base.apps.push({id:'c',name:'C',url:'https://c.example',page:'home'});base.apps.push({id:'d',name:'D',url:'https://d.example',page:'home'});
  const local=structuredClone(base),remote=structuredClone(base);local.folders=[{id:'left',page:'home',appIds:['a','b']}];remote.folders=[{id:'right',page:'home',appIds:['a','c']}];
  assert.deepEqual(mergeDesktop(base,local,remote).conflicts,['App 或组件的位置']);
});
test('invalid shared state rejects unsafe URLs, orphan pages, duplicates and malformed layouts',()=>{
  assert.ok(validDesktop(desktop()));
  for(const mutate of [data=>data.apps[0].url='javascript:alert(1)',data=>data.apps[0].page='missing',data=>data.dock=['a','a'],data=>data.layout.desktop.a.x=NaN,data=>data.folders=[{id:'f',page:'home',appIds:['a']}],data=>data.todos=[null],data=>data.favoriteIds={},data=>data.watching=[null]] ){
    const data=desktop();mutate(data);assert.equal(validDesktop(data),false);
  }
});
test('custom keys work across devices, normalize Unicode, and retain legacy connection codes',async()=>{
  const {resolveSyncKey}=await import('../sync-model.js');
  const phrase='Weboss 我的桌面密钥 2026';
  const first=await resolveSyncKey(phrase),second=await resolveSyncKey('  '+phrase+'  ');
  assert.match(first,/^wo_[A-Za-z0-9_-]{43}$/);assert.equal(first,second);assert.equal(await resolveSyncKey(first),first);
  assert.notEqual(first,await resolveSyncKey(phrase+'另一台'));
  assert.equal(await resolveSyncKey('abcdefghijkl-é'),await resolveSyncKey('abcdefghijkl-e\u0301'));
  await assert.rejects(resolveSyncKey('短密钥'),/custom_key_invalid/);await assert.rejects(resolveSyncKey('wo_输入错误'),/sync_key_required/);
});
