import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {planDesktopOrganization, desktopItems, desktopTileSize, resolveTilePositions, LAYOUT_MODES} from '../layout-organizer.js';
import {folderMetrics, suggestGroups} from '../organizer.js';

function fixture() {
  const sandbox = {window: {}};vm.runInNewContext(readFileSync(new URL('../config.js', import.meta.url), 'utf8'), sandbox);
  return JSON.parse(JSON.stringify(sandbox.window.DEFAULT_DESKTOP_CONFIG));
}
function small() {
  return {pages:[{id:'home',name:'桌面 1'},{id:'other',name:'桌面 2'}], apps:Array.from({length:16},(_,i)=>({id:`a${i}`,name:`App ${i}`,url:`https://app${i}.example.com`,page:i<12?'home':'other'})), folders:[], widgets:[{id:'clock',type:'clock',page:'home',size:'wide'},{id:'weather',type:'weather',page:'home',size:'small'}], dock:['a0'], history:['a11','a10'], favoriteIds:['a9'], layout:{desktop:{},tablet:{},mobile:{}}};
}
function assertPlan(result) {
  for (const mode of LAYOUT_MODES) {
    const {profile, pages} = result.modes[mode];
    for (const page of pages) {
      const items = desktopItems(result.desktop, page.id, mode, profile.rows);
      const resolved = resolveTilePositions(items, result.desktop.layout[mode], page.id, mode, profile);
      const seen = new Set();
      for (const screen of page.screens) {
        const occupied = new Set();
        for (const tile of screen.tiles) {
          assert.ok(!seen.has(tile.id), `duplicate ${mode} ${tile.id}`);seen.add(tile.id);
          assert.ok(tile.x >= 0 && tile.x + tile.w <= profile.columns);
          assert.ok(tile.row >= 0 && tile.row + tile.h <= profile.rows);
          assert.deepEqual(resolved.get(tile.id), {x:tile.x,y:tile.y,w:tile.w,h:tile.h}, `preview differs from renderer: ${mode} ${tile.id}`);
          for (let row=tile.row;row<tile.row+tile.h;row++) for (let x=tile.x;x<tile.x+tile.w;x++) {
            assert.ok(!occupied.has(`${x},${row}`), `overlap ${mode} ${tile.id}`);occupied.add(`${x},${row}`);
          }
        }
      }
      assert.deepEqual([...seen].sort(), items.map(item=>item.id).sort());
    }
  }
}

test('real desktop configuration produces complete non-overlapping previews matching the applied renderer', () => {
  const data=fixture(), before=JSON.stringify(data);
  const groups=suggestGroups(data.apps.filter(app=>!data.dock.includes(app.id))).map((group,index)=>({...group,page:data.apps.find(app=>app.id===group.appIds[0]).page,folderId:`test-folder-${index}`}));
  const result=planDesktopOrganization(data,groups);
  assertPlan(result);assert.equal(JSON.stringify(data),before);assert.deepEqual(result.desktop.dock,data.dock);
  assert.equal(result.desktop.apps.length,data.apps.length);assert.deepEqual(result.desktop.widgets,data.widgets);
  assert.ok(result.stats.groups>0);assert.ok(result.stats.resizedFolders>0);
});

test('layout-only planning keeps all memberships and makes favorite and recent entrances accessible first', () => {
  const data=small();
  const result=planDesktopOrganization(data,[],{profiles:{mobile:{rows:4,width:364,row:75,gap:9}}});
  assertPlan(result);assert.deepEqual(result.desktop.folders,[]);assert.deepEqual(result.desktop.apps,data.apps);
  const first=result.modes.mobile.pages.find(page=>page.id==='home').screens[0];
  for(const id of ['a9','a10','a11'])assert.ok(first.tiles.some(tile=>tile.id===id),`${id} needs another swipe`);
  assert.equal(first.tiles.find(tile=>tile.id==='clock').y,0);
  assert.ok(result.modes.mobile.screenCount>result.modes.desktop.screenCount);
});

test('only the chosen desktop is arranged and existing positions and sizes on other desktops are preserved', () => {
  const data=small();data.folders=[{id:'elsewhere',name:'其他',page:'other',appIds:['a12','a13','a14'],sizes:{desktop:{w:3,h:3},mobile:{w:1,h:1}}}];
  for(const mode of LAYOUT_MODES)data.layout[mode]={elsewhere:{page:'other',x:0,y:0,priority:90},a15:{page:'other',x:3,y:3,priority:2}};
  const result=planDesktopOrganization(data,[],{pageIds:['home']});assertPlan(result);
  assert.deepEqual(result.desktop.folders,data.folders);
  for(const mode of LAYOUT_MODES){assert.deepEqual(result.desktop.layout[mode].elsewhere,data.layout[mode].elsewhere);assert.deepEqual(result.desktop.layout[mode].a15,data.layout[mode].a15);assert.deepEqual(result.modes[mode].pages.map(page=>page.id),['home']);}
});

test('folder-scoped layout only resizes the target, keeps other visible tiles in place, and ranks useful members', () => {
  const data=small();data.folders=[{id:'selected',name:'选择',page:'home',appIds:['a1','a2','a9','a10','a11'],sizes:{desktop:{w:1,h:1},tablet:{w:1,h:1},mobile:{w:1,h:1}}}];
  const result=planDesktopOrganization(data,[],{pageIds:['home'],folderIds:['selected']});assertPlan(result);
  assert.deepEqual(result.desktop.folders[0].appIds.slice(0,3),['a9','a11','a10']);
  for(const mode of LAYOUT_MODES){
    const profile=result.modes[mode].profile,before=resolveTilePositions(desktopItems(data,'home',mode,profile.rows),data.layout[mode],'home',mode,profile);
    const after=resolveTilePositions(desktopItems(result.desktop,'home',mode,profile.rows),result.desktop.layout[mode],'home',mode,profile);
    for(const [id,pos]of before)if(id!=='selected')assert.deepEqual(after.get(id),pos,`${mode} changed unrelated ${id}`);
  }
});

test('group editing reuses the same folder identity, merges matching folders, and does not pin or duplicate Dock apps', () => {
  const data=small();data.folders=[{id:'existing',name:'开发',page:'home',appIds:['a2','a3'],sizes:{}}];
  const groups=[{name:'开发',page:'home',folderId:'stable-id',appIds:['a0','a1','a2','a5']},{name:'别的',page:'other',folderId:'stable-other',appIds:['a6','a7']}];
  const result=planDesktopOrganization(data,groups);assertPlan(result);
  const existing=result.desktop.folders.find(folder=>folder.name==='开发');assert.equal(existing.id,'existing');assert.ok(!existing.appIds.includes('a0'));
  assert.equal(result.desktop.folders.find(folder=>folder.name==='别的').id,'stable-other');
  const edited=planDesktopOrganization(data,[{...groups[1],name:'重命名'}]);assert.equal(edited.desktop.folders.find(folder=>folder.name==='重命名').id,'stable-other');
  const members=result.desktop.folders.flatMap(folder=>folder.appIds);assert.equal(new Set(members).size,members.length);
  for(const mode of LAYOUT_MODES)assert.ok(!result.modes[mode].pages.flatMap(page=>page.screens.flatMap(screen=>screen.tiles)).some(tile=>tile.id==='a0'));
});

test('disabling layout preserves existing placement and folder sizes while still previewing new groups', () => {
  const data=small();data.folders=[{id:'kept',name:'保留',page:'home',appIds:['a3','a4'],sizes:{desktop:{w:3,h:3}}}];
  for(const mode of LAYOUT_MODES)data.layout[mode].weather={page:'home',x:0,y:2,priority:20};
  const result=planDesktopOrganization(data,[{name:'新组',page:'home',folderId:'new-group',appIds:['a1','a2']}],{arrange:false});assertPlan(result);
  assert.deepEqual(result.desktop.layout,data.layout);assert.deepEqual(result.desktop.folders.find(folder=>folder.id==='kept'),data.folders[0]);
});

test('widgets alone can be organized, including phones with only three rows', () => {
  const data=small();data.apps=[];data.dock=[];data.pages=[data.pages[0]];data.widgets.push({id:'calendar',type:'calendar',page:'home',size:'wide'},{id:'note',type:'note',page:'home',size:'wide'});
  const result=planDesktopOrganization(data,[],{profiles:{mobile:{rows:3,row:50,gap:5,width:294}}});assertPlan(result);
  assert.equal(result.stats.groups,0);assert.equal(result.modes.mobile.pages[0].screens.flatMap(screen=>screen.tiles).length,4);
});

test('crowded layouts paginate horizontally without losing widgets, folders, or apps', () => {
  const data=small();data.apps=Array.from({length:180},(_,i)=>({id:`many${i}`,name:`名称比较长的 App ${i}`,url:`https://example.com/${i}`,page:'home'}));data.dock=data.apps.slice(0,12).map(app=>app.id);
  data.folders=Array.from({length:8},(_,i)=>({id:`folder${i}`,name:`文件夹 ${i}`,page:'home',appIds:data.apps.slice(12+i*8,20+i*8).map(app=>app.id),sizes:{}}));
  data.widgets.push(...['calendar','todo','watching','note','player'].map(type=>({id:type,type,page:'home',size:'wide'})));
  const result=planDesktopOrganization(data,[],{profiles:{desktop:{rows:3},tablet:{rows:3},mobile:{rows:3,row:50,gap:5,width:294}}});assertPlan(result);
  for(const mode of LAYOUT_MODES)assert.ok(result.modes[mode].screenCount>1);
});

test('large folders expose complete cells with overflow access and are sized separately per device', () => {
  const data=small();data.folders=[{id:'large',name:'大文件夹',page:'home',appIds:data.apps.slice(1,11).map(app=>app.id),sizes:{}}];
  const result=planDesktopOrganization(data);assertPlan(result);
  for(const mode of LAYOUT_MODES){const profile=result.modes[mode].profile,{w,h}=result.desktop.folders[0].sizes[mode],cell=(profile.width-(profile.columns-1)*profile.gap)/profile.columns;
    const metrics=folderMetrics(w*cell+(w-1)*profile.gap,h*profile.row+(h-1)*profile.gap);assert.ok(metrics.capacity>=4);assert.ok(metrics.icon>=24);
  }
  assert.notDeepEqual(result.desktop.folders[0].sizes.desktop,result.desktop.folders[0].sizes.mobile);
});

test('repeated previews are deterministic, survive JSON backup, and use IDs that cannot collide', () => {
  const data=small();data.widgets.push({id:'organized-folder-1',type:'note',page:'home',size:'small'});
  const groups=[{name:'组合',page:'home',appIds:['a1','a2','a3']}];
  const first=planDesktopOrganization(data,groups),again=planDesktopOrganization(data,groups);assert.deepEqual(first,again);assertPlan(first);
  assert.notEqual(first.desktop.folders[0].id,'organized-folder-1');
  const stored=JSON.parse(JSON.stringify(first.desktop));
  for(const mode of LAYOUT_MODES)for(const page of first.modes[mode].pages){const profile=first.modes[mode].profile;
    assert.deepEqual(resolveTilePositions(desktopItems(stored,page.id,mode,profile.rows),stored.layout[mode],page.id,mode,profile),resolveTilePositions(desktopItems(first.desktop,page.id,mode,profile.rows),first.desktop.layout[mode],page.id,mode,profile));
  }
});

test('phone widgets keep their intended proportions, including legacy wide Todo and player cards', () => {
  for(const type of ['todo','player'])assert.deepEqual(desktopTileSize({kind:'widget',data:{type,size:'wide'}},'mobile',{columns:4,rows:7}),{w:2,h:3});
  assert.deepEqual(desktopTileSize({kind:'widget',data:{type:'clock',size:'small'}},'mobile',{columns:4,rows:3}),{w:4,h:1});
});
