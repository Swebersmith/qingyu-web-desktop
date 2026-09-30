import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import {generateSyncKey} from '../sync-model.js';

const key=generateSyncKey(),origin='https://weboss.example';
const state={version:6,pages:[{id:'home',name:'首页'}],apps:[{id:'a',name:'A',url:'https://a.example',page:'home'}],folders:[],widgets:[],dock:[],layout:{desktop:{},tablet:{},mobile:{}}};
function request(method='GET',payload,headers={}){return new Request(origin+'/api/sync',{method,headers:{Authorization:`Bearer ${key}`,Origin:origin,...(payload?{'Content-Type':'application/json'}:{}),...headers},...(payload?{body:JSON.stringify(payload)}:{})});}
test('static deployment and unbound D1 return clear capability/authentication errors',async()=>{
  assert.deepEqual(await worker.fetch(new Request(origin+'/api/sync/status'),{}).then(response=>response.json()),{configured:false});
  assert.equal((await worker.fetch(request(),{})).status,503);assert.equal((await worker.fetch(request('GET',undefined,{Authorization:'Bearer home'}),{})).status,401);
});
test('invalid requests are rejected before D1 executes any SQL',async()=>{
  const env={DB:{prepare:()=>assert.fail('no SQL for invalid requests')}};
  assert.equal((await worker.fetch(request('GET',undefined,{Origin:'https://other.example'}),env)).status,403);
  assert.equal((await worker.fetch(request('DELETE'),env)).status,405);
  assert.equal((await worker.fetch(request('PUT',{state,baseRevision:-1}),env)).status,400);
  assert.equal((await worker.fetch(request('PUT',{state:{...state,todos:[null]},baseRevision:0}),env)).status,400);
  assert.equal((await worker.fetch(request('PUT',{state,baseRevision:0},{'Content-Type':'text/plain'}),env)).status,415);
  assert.equal((await worker.fetch(request('PUT',{state:{...state,customWallpaper:'x'.repeat(1000000)},baseRevision:0}),env)).status,413);
});
test('reads bind a hashed credential, return no-cache responses and honor matching ETags',async()=>{
  const bindings=[];const env={DB:{prepare:()=>({bind:(...values)=>{bindings.push(values);return {first:async()=>({state:JSON.stringify(state),revision:3,updated_at:'2026-09-30T00:00:00Z'})};}})}};
  const response=await worker.fetch(request(),env);assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('ETag'),'"3"');assert.deepEqual((await response.json()).state,state);
  assert.ok(bindings.every(values=>/^[a-f0-9]{64}$/.test(values[0])&&values[0]!==key));
  assert.equal((await worker.fetch(request('GET',undefined,{'If-None-Match':'"3"'}),env)).status,304);
});
test('stale writes return the current snapshot and must include the expected revision',async()=>{
  let writeValues;const env={DB:{prepare:sql=>({bind:(...values)=>({first:async()=>({state:JSON.stringify(state),revision:3,updated_at:'2026-09-30T00:00:00Z'}),run:async()=>{assert.ok(sql.includes('AND revision = ?4'));writeValues=values;return {meta:{changes:0}};}})})}};
  const response=await worker.fetch(request('PUT',{state,baseRevision:2}),env);assert.equal(response.status,409);const body=await response.json();assert.equal(body.revision,3);assert.deepEqual(body.state,state);assert.equal(writeValues[3],2);
});
test('rate-limit and database failures expose only controlled error codes',async()=>{
  assert.equal((await worker.fetch(request(),{DB:{},SYNC_LIMITER:{limit:async()=>({success:false})}})).status,429);
  const original=console.error;console.error=()=>{};
  try{const response=await worker.fetch(request(),{DB:{prepare:()=>{throw Error('private database detail');}}});assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'database_unavailable'});}finally{console.error=original;}
});
