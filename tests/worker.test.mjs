import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

const payload={apps:[{id:'one',name:'GitHub',url:'https://github.com/private?token=hidden'},{id:'two',name:'GitLab',url:'https://gitlab.com'}]};
function request(body=payload,headers={},method='POST') {
  return new Request('https://weboss.example/api/organize',{method,headers:{'Content-Type':'application/json','Origin':'https://weboss.example',...headers},...(method==='POST'?{body:JSON.stringify(body)}:{})});
}
function bindings(response={groups:[{name:'开发',appIds:['0','1']}]}) {
  return {AI:{run:async(_model,input)=>{assert.ok(!JSON.stringify(input).includes('token=hidden'));return {response};}},AI_LIMITER:{limit:async()=>({success:true})}};
}
test('dashboard AI binding is optional and static assets still work',async()=>{
  assert.equal((await worker.fetch(request(),{})).status,503);
  const response=await worker.fetch(new Request('https://weboss.example/'),{ASSETS:{fetch:async()=>new Response('desktop')}});
  assert.equal(await response.text(),'desktop');
});
test('AI groups are validated and mapped back to original app IDs',async()=>{
  const response=await worker.fetch(request(),bindings({groups:[{name:'开发',appIds:['0','1','invented','0']}]}));
  assert.equal(response.status,200);assert.deepEqual((await response.json()).groups,[{name:'开发',appIds:['one','two']}]);
  assert.equal(response.headers.get('cache-control'),'no-store');
});
test('invalid IDs, cross-site requests, unsupported methods and huge bodies are rejected before inference',async()=>{
  const env=bindings();env.AI.run=()=>assert.fail('must not call AI');
  assert.equal((await worker.fetch(request({apps:[payload.apps[0],payload.apps[0]]}),env)).status,400);
  assert.equal((await worker.fetch(request(payload,{'Origin':'https://other.example'}),env)).status,403);
  assert.equal((await worker.fetch(request(payload,{},'GET'),env)).status,405);
  assert.equal((await worker.fetch(request({extra:'x'.repeat(61000),...payload}),env)).status,413);
});
test('rate limits and invalid model output do not return misleading success',async()=>{
  const env=bindings();env.AI_LIMITER.limit=async()=>({success:false});
  assert.equal((await worker.fetch(request(),env)).status,429);
  assert.equal((await worker.fetch(request(),bindings({groups:[{name:'错误',appIds:['unknown','0']}]}))).status,502);
  assert.equal((await worker.fetch(new Request('https://weboss.example/api/unknown'),{})).status,404);
});
