import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePages,reconcileDesktop} from '../desktop-model.js';

function fixture() {
  return {
    pages:['home','second','third'].map((id,index)=>({id,name:index?`桌面 ${index+1}`:'首页',eyebrow:'YOUR SPACE',title:''})),
    apps:[{id:'a',page:'home'},{id:'b',page:'second'},{id:'c',page:'third'},{id:'settings',system:'settings',page:'home'}],
    widgets:[],folders:[],dock:['settings'],layout:{desktop:{},tablet:{},mobile:{}}
  };
}

test('custom and dynamically added pages survive normalization, duplicates do not',()=>{
  const defaults=[{id:'home',name:'首页'}],raw=[{id:'custom-id',name:'我的桌面'},null,{id:'custom-id',name:'重复'},{id:'draft-uuid',name:'桌面 2'}];
  assert.deepEqual(normalizePages(raw,defaults).map(page=>[page.id,page.name]),[['custom-id','我的桌面'],['draft-uuid','桌面 2']]);
  assert.deepEqual(normalizePages([],defaults).map(page=>page.id),['home']);
});

test('Dock exclusivity dissolves singleton folders and preserves the survivor position in every mode',()=>{
  const data=fixture();data.dock.push('a','a');
  data.folders=[{id:'folder',page:'second',appIds:['a','b'],sizes:{}}];
  for(const mode of ['desktop','tablet','mobile'])data.layout[mode]={folder:{page:'second',x:2,y:1,priority:7},b:{page:'second',x:0,y:0}};
  const result=reconcileDesktop(data,'second',{desktop:{folder:{page:'second',x:4,y:3,priority:8}}});
  assert.deepEqual(data.dock,['settings','a']);assert.deepEqual(result.dissolved,['folder']);assert.deepEqual(data.folders,[]);
  assert.deepEqual(data.layout.desktop.b,{page:'second',x:4,y:3,priority:8});
  assert.deepEqual(data.layout.mobile.b,{page:'second',x:2,y:1,priority:7});
  assert.ok(!data.layout.tablet.folder);assert.equal(data.apps.length,4);assert.equal(data.apps.find(app=>app.id==='b').page,'second');
  assert.deepEqual(data.pages.map(page=>page.id),['second','third']);
});

test('folders containing only Dock apps are removed and multi-app folders remain unique',()=>{
  const data=fixture();data.dock.push('a');
  data.folders=[{id:'empty',page:'home',appIds:['a','settings']},{id:'many',page:'second',appIds:['b','b','c','missing']},{id:'duplicate',page:'third',appIds:['b']}];
  reconcileDesktop(data);
  assert.deepEqual(data.folders.map(folder=>[folder.id,folder.appIds]),[['many',['b','c']]]);
  assert.deepEqual(data.pages.map(page=>page.id),['second']);
});

test('widgets keep a page alive, Dock apps do not, and the last blank desktop is retained',()=>{
  const data=fixture();data.dock.push('a','b','c');data.widgets=[{id:'note',page:'third'}];
  data.layout.desktop={orphan:{page:'home',x:0,y:0},note:{page:'third',x:2,y:1}};
  reconcileDesktop(data,'home');assert.deepEqual(data.pages.map(page=>page.id),['third']);
  assert.deepEqual(Object.keys(data.layout.desktop),['note']);
  data.widgets=[];reconcileDesktop(data,'third');assert.deepEqual(data.pages.map(page=>page.id),['third']);
  assert.deepEqual(data.layout.desktop,{});assert.ok(data.apps.every(app=>app.page==='third'));
});

test('moving the final item to a new desktop removes its empty source and persists the new ID',()=>{
  const data=fixture();data.dock.push('b','c');
  const newPage={id:'new-page-uuid',name:'桌面 4',eyebrow:'YOUR SPACE',title:''};data.pages.push(newPage);data.apps.find(app=>app.id==='a').page=newPage.id;
  data.layout.desktop.a={page:newPage.id,x:3,y:2};reconcileDesktop(data,newPage.id);
  assert.deepEqual(data.pages.map(page=>page.id),[newPage.id]);
  const restored=JSON.parse(JSON.stringify(data));restored.pages=normalizePages(restored.pages,fixture().pages);reconcileDesktop(restored);
  assert.deepEqual(restored,data);
});
