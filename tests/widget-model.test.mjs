import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProgress,progressSummary,monthGrid,weatherInfo} from '../widget-model.js';
import {mergeDesktop,validDesktop} from '../sync-model.js';

test('progress uses real counts and bounds malformed input',()=>{
  assert.deepEqual(progressSummary({value:2,total:10,unit:'章节'}),{value:2,total:10,unit:'章节',percent:20});
  assert.equal(progressSummary({value:500,total:10}).percent,100);assert.equal(progressSummary({value:-5,total:10}).percent,0);
  assert.deepEqual(normalizeProgress(),{value:4,total:6,unit:'个目标'});
  assert.equal(normalizeProgress({value:Infinity,total:NaN}).total,6);assert.ok(Number.isFinite(progressSummary({total:0}).percent));
});
test('calendar supports leap days, Monday alignment and month/year navigation',()=>{
  const leap=monthGrid(2024,1);assert.equal(leap.cells.filter(Boolean).length,29);assert.equal(leap.cells.indexOf(1),3);assert.equal(leap.cells.length%7,0);
  assert.equal(monthGrid(2025,1).cells.filter(Boolean).length,28);assert.deepEqual([monthGrid(2026,-1).year,monthGrid(2026,-1).month],[2025,11]);
  assert.deepEqual([monthGrid(2026,12).year,monthGrid(2026,12).month],[2027,0]);assert.equal(monthGrid(2026,5).cells[0],1);
});
test('weather distinguishes WMO conditions and never labels unknown data as sunshine',()=>{
  for(const [code,label] of [[0,'晴'],[3,'多云'],[45,'雾'],[51,'雨'],[66,'雨'],[86,'雪'],[95,'雷雨'],[99,'雷雨']])assert.equal(weatherInfo(code).label,label);
  assert.equal(weatherInfo(undefined).label,'未知');assert.equal(weatherInfo(123).label,'未知');
});
test('extended widget content and progress merge with independent mobile layout edits',()=>{
  const base={version:7,pages:[{id:'home',name:'首页'}],apps:[],folders:[],dock:[],widgets:[{id:'progress',type:'progress',page:'home',progress:{value:4,total:6,unit:'个目标'}},{id:'note',type:'note',page:'home',content:'便签'}],todos:[],layout:{desktop:{},tablet:{},mobile:{}},history:[],favoriteIds:[]};
  const local=structuredClone(base),remote=structuredClone(base);local.widgets[0].progress={value:2,total:10,unit:'章节'};local.widgets[1].content='完整笔记'.repeat(600);remote.layout.mobile.progress={page:'home',x:1,y:2};
  const result=mergeDesktop(base,local,remote);assert.deepEqual(result.conflicts,[]);assert.equal(result.state.widgets[0].progress.value,2);assert.equal(result.state.widgets[1].content.length,2400);assert.equal(result.state.layout.mobile.progress.y,2);assert.ok(validDesktop(result.state));
});
