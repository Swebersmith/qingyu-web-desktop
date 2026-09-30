import test from 'node:test';
import assert from 'node:assert/strict';
import {importDesktop} from '../desktop-import.js';

function desktop(){return {version:7,pages:[{id:'home',name:'首页'}],apps:[{id:'existing',name:'我的名称',url:'https://example.org/',page:'home'}],widgets:[{id:'note',page:'home',type:'note',content:'保留便签'}],folders:[],dock:[],favoriteIds:[],layout:{desktop:{existing:{page:'home',x:3,y:2}},tablet:{},mobile:{}},wallpaper:'sage',todos:[]};}
function imported(data,current=desktop()){let n=0;return importDesktop(data,current,{version:7,pages:[{id:'home'}]},{createId:()=>`new-${++n}`});}

test('legacy array preserves stable order, names, colors, pinning and explicit/automatic icons',()=>{
  const source=[{id:'last',name:'末尾',url:'https://last.example/',order:9,icon:'',color:'#AAbbCC'},
    {id:'first',name:'完整的快捷方式名称',url:'https://first.example/',order:-3,pinned:true,icon:'https://icons.example/custom.png'},
    {id:'tie-a',name:'同序甲',url:'https://tie-a.example/',order:2,icon:'📚'},
    {id:'tie-b',name:'同序乙',url:'https://tie-b.example/',order:2,icon:'',category:'旧分类'}];
  const current=desktop(),before=structuredClone(current),{state,report}=imported(source,current);
  assert.deepEqual(state.apps.map(app=>app.id),['existing','first','tie-a','tie-b','last']);
  assert.equal(state.apps[1].name,source[1].name);assert.equal(state.apps[1].icon,source[1].icon);assert.equal(state.apps[1].iconMode,'custom');
  assert.equal(state.apps[2].iconMode,'custom');assert.equal(state.apps[3].iconMode,'auto');assert.equal(state.apps[4].color,'#AAbbCC');
  assert.deepEqual(state.dock,['first']);assert.equal(report.added,4);assert.equal(report.pinned,1);assert.deepEqual(current,before);
  assert.deepEqual(state.widgets,before.widgets);assert.deepEqual(state.layout,before.layout);assert.equal(state.wallpaper,'sage');assert.ok(!('category' in state.apps[3]));
});
test('repeated imports merge by canonical URL without duplicating or overwriting existing edits',()=>{
  const source=[{id:'different',name:'旧名字',url:'https://example.org',pinned:true},{id:'new',name:'新链接',url:'https://new.example/?view=1#section'},{id:'duplicate',url:'https://new.example/?view=1#section'}];
  const first=imported(source),second=imported(source,first.state);
  assert.equal(first.state.apps.length,2);assert.equal(first.state.apps[0].name,'我的名称');assert.deepEqual(first.state.dock,['existing']);assert.equal(first.report.reused,2);
  assert.equal(second.report.added,0);assert.equal(second.report.reused,3);assert.deepEqual(second.state,first.state);
  assert.equal(first.state.apps[1].url,'https://new.example/?view=1#section');
});
test('invalid links are skipped and colliding or reserved IDs cannot replace desktop elements',()=>{
  const source=[{id:'note',url:'https://a.example/'},{id:'weboss-settings',url:'https://b.example/'},{id:'__proto__',url:'https://c.example/'},{url:'javascript:alert(1)'},null,{url:'file:///example'}];
  const {state,report}=imported(source);assert.equal(report.skipped,3);assert.equal(report.added,3);
  assert.equal(new Set([...state.apps,...state.widgets].map(item=>item.id)).size,5);assert.ok(!state.apps.some(app=>['note','weboss-settings','__proto__'].includes(app.id)));
  assert.throws(()=>imported([{url:'javascript:alert(1)'}]),/没有有效/);assert.throws(()=>imported({unrecognized:[]}),/无法识别/);
});
test('Dock overflow retains additional pinned shortcuts in favorites',()=>{
  const {state,report}=imported(Array.from({length:14},(_,index)=>({id:`app-${index}`,url:`https://app-${index}.example/`,pinned:true})));
  assert.equal(state.dock.length,12);assert.deepEqual(state.favoriteIds,['app-12','app-13']);assert.equal(report.dockOverflow,2);assert.equal(state.apps.length,15);
});
test('wrapped legacy exports convert old widgets while full backups restore all data',()=>{
  const source={shortcuts:[{id:'link',url:'https://new.example/'}],widgets:[{id:'old-note',type:'unknown',content:'长便签'.repeat(500)},{id:'old-link',type:'link',content:'https://read.example/'}]};
  const {state}=imported(source);assert.equal(state.widgets[1].type,'note');assert.equal(state.widgets[1].content,source.widgets[0].content);assert.equal(state.widgets[2].type,'link');
  const backup=desktop();backup.wallpaper='night';backup.apps=[];const restored=imported(backup);assert.equal(restored.report.kind,'backup');assert.deepEqual(restored.state,backup);assert.notEqual(restored.state,backup);
});
