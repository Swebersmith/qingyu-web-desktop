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
test('AI receives preferences, existing folders and only semantic URL paths',async()=>{
  let input;
  const env=bindings({groups:[{name:'代码协作',appIds:['0','1'],reason:'管理和协作代码项目',confidence:.91}]});
  env.AI.run=async(_model,data)=>{input=JSON.parse(data.messages[1].content);return {response:{groups:[{name:'代码协作',appIds:['0','1'],reason:'管理和协作代码项目',confidence:.91}]}};};
  const response=await worker.fetch(request({...payload,instruction:'学习和开发分开',apps:[{...payload.apps[0],url:'https://user:secret@github.com/private/copilot?token=hidden#fragment',existingFolder:'我的工具'},payload.apps[1]]}),env);
  assert.equal(input.preference,'学习和开发分开');assert.equal(input.apps[0].existingFolder,'我的工具');assert.equal(input.apps[0].path,'/copilot');assert.equal(input.apps[0].domain,'github.com');assert.ok(!JSON.stringify(input).match(/secret|private|hidden|fragment/));
  assert.deepEqual((await response.json()).groups,[{name:'代码协作',appIds:['one','two'],reason:'管理和协作代码项目',confidence:.91}]);
});
test('an intentional empty AI plan is valid and malformed preferences never trigger inference',async()=>{
  assert.deepEqual((await worker.fetch(request(),bindings({groups:[]}))).status,200);
  const withheld=await worker.fetch(request(),bindings({groups:[{name:'暂不分组',appIds:['0','1'],confidence:.4,reason:'用途无法确定'}]}));assert.equal(withheld.status,200);assert.deepEqual((await withheld.json()).groups,[]);
  const env=bindings();env.AI.run=()=>assert.fail('must not infer');
  assert.equal((await worker.fetch(request({...payload,instruction:'x'.repeat(301)}),env)).status,400);
});
