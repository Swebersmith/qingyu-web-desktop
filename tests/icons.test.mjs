import test from 'node:test';
import assert from 'node:assert/strict';
import {IconStore} from '../icon-client.js';
import {iconAPI} from '../icon-api.js';
import {ICON_DESIGN_VERSION,ICON_SYMBOLS,publicSite,discoverIconLinks,iconSVG,validateIconDesign,siteIconIdentity,recognizableIconDesign,localIconDesign} from '../icon-model.js';
const app={id:'app',name:'阅读资料',url:'https://read.example/private?token=secret',iconMode:'auto'},design={symbol:'book',background:'#507C87',foreground:'#FFFFFF',label:'阅'};
const storage=()=>{const data=new Map();return {getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};};
test('same-site icon loads share a request and cached results survive a new session',async()=>{let loads=0;const store=storage(),icons=new IconStore({storage:store,imageLoader:async src=>{loads++;return src;},fetcher:()=>assert.fail('API unnecessary')});const [a,b]=await Promise.all([icons.resolve(app),icons.resolve(app)]);assert.equal(loads,1);assert.equal(a,b);assert.equal(a.source,'website');const restored=new IconStore({storage:store,imageLoader:()=>assert.fail('cached icon must not reload')});assert.equal((await restored.resolve(app)).src,a.src);});
test('declared icon paths are tried before third-party caches or AI',async()=>{const loaded=[];const icons=new IconStore({storage:storage(),imageLoader:async src=>{loaded.push(src);if(src.endsWith('/assets/app.png'))return src;throw Error('missing');},fetcher:async url=>{assert.ok(url.startsWith('/api/site-icon?'));return Response.json({candidates:['https://read.example/assets/app.png']});}});assert.equal((await icons.resolve(app)).source,'website');assert.equal(loaded.length,2);});
test('failed favicon sources invoke AI with only the name and origin, then cache the SVG',async()=>{const calls=[];const icons=new IconStore({storage:storage(),imageLoader:async()=>{throw Error('missing');},fetcher:async(url,options)=>{calls.push({url,body:options.body});return Response.json(url==='/api/icon'?{design}:{candidates:[]});}});const result=await icons.resolve(app);assert.equal(result.source,'ai');assert.ok(result.src.startsWith('data:image/svg+xml'));assert.ok(!JSON.stringify(calls).includes('token=secret'));assert.ok(!JSON.stringify(calls).includes('/private'));assert.equal(calls.filter(call=>call.url==='/api/icon').length,1);await icons.resolve(app);assert.equal(calls.length,2);});
test('manual images never invoke AI and unavailable AI keeps a truthful local fallback',async()=>{const manual=new IconStore({storage:storage(),imageLoader:async src=>src,fetcher:()=>assert.fail('manual icons bypass AI')});assert.equal((await manual.resolve({...app,iconMode:'custom',icon:'https://icons.example/custom.png'})).source,'custom');let calls=0;const local=new IconStore({storage:storage(),imageLoader:async()=>{throw Error('missing');},fetcher:async url=>{if(url==='/api/icon')calls++;return Response.json(url==='/api/icon'?{error:'ai_not_configured'}:{candidates:[]},{status:url==='/api/icon'?503:200});}});assert.equal((await local.resolve(app)).source,'local');await local.resolve({...app,name:'第二个'});assert.equal(calls,1);});
test('declared icon discovery resolves paths, honors size and rejects unsafe destinations',()=>{const html='<link rel="shortcut icon" href="/favicon.svg"><link href="https://cdn.example/app.png?v=1&amp;x=2" rel="apple-touch-icon"><link rel="icon" href="javascript:evil"><link rel="icon" href="http://127.0.0.1/private">';assert.deepEqual(discoverIconLinks(html,'https://read.example/home'),['https://cdn.example/app.png?v=1&x=2','https://read.example/favicon.svg']);for(const url of ['http://127.0.0.1','http://0x7f000001','http://[::1]','http://example.local','http://example.org:8080','https://user:pass@example.org'])assert.equal(publicSite(url),null);});
test('generated SVG accepts only bounded symbols/colors and escapes model text structurally',()=>{assert.equal(validateIconDesign({...design,symbol:'<script>'}),null);assert.equal(validateIconDesign({...design,foreground:'url(evil)'}),null);const svg=iconSVG({...design,label:'<script>alert(1)</script>'});assert.ok(!svg.includes('<script>'));assert.ok(!svg.includes('alert'));assert.ok(svg.includes('<svg'));});
test('AI designs with unreadable foreground/background contrast are corrected',()=>{assert.equal(validateIconDesign({...design,background:'#FFFFFF',foreground:'#FFFFFF'}).foreground,'#203E48');assert.equal(validateIconDesign({...design,background:'#101010',foreground:'#101010'}).foreground,'#FFFFFF');});
const request=body=>new Request('https://weboss.example/api/icon',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://weboss.example'},body:JSON.stringify(body)});
test('AI endpoint validates requests, strips private URL fields and returns a usable design',async()=>{let calls=0;const env={ICON_AI_LIMITER:{limit:async()=>({success:true})},AI:{run:async(_model,input)=>{calls++;assert.ok(!JSON.stringify(input).includes('token=secret'));assert.ok(!JSON.stringify(input).includes('/private'));assert.match(input.messages[0].content,/网站的专属简称/);assert.equal(input.response_format.json_schema.properties.label.maxLength,4);return {response:JSON.stringify(design)};}}};const result=await iconAPI(request(app),env);assert.equal(result.status,200);assert.deepEqual((await result.json()).design,{...design,label:'READ',caption:'阅读资料',version:ICON_DESIGN_VERSION});assert.equal(calls,1);assert.equal((await iconAPI(request({name:'x',url:'javascript:evil'}),env)).status,400);assert.equal((await iconAPI(request(app),{})).status,503);});
test('rate limits, cross-site calls and invalid AI designs cannot return generated icons',async()=>{const env={ICON_AI_LIMITER:{limit:async()=>({success:false})},AI:{run:()=>assert.fail('rate limit must prevent inference')}};assert.equal((await iconAPI(request(app),env)).status,429);const cross=request(app);cross.headers.set('Origin','https://other.example');assert.equal((await iconAPI(cross,env)).status,403);env.ICON_AI_LIMITER.limit=async()=>({success:true});env.AI.run=async()=>({response:{...design,symbol:'invalid'}});assert.equal((await iconAPI(request(app),env)).status,502);});
test('lookup follows public redirects but stops before requesting private destinations',async()=>{const seen=[],env={ICON_LOOKUP_LIMITER:{limit:async()=>({success:true})}};const response=await iconAPI(new Request('https://weboss.example/api/site-icon?site=https%3A%2F%2Fread.example'),env,{fetcher:async url=>{seen.push(url);return new Response(null,{status:302,headers:{Location:'http://127.0.0.1/private'}});}});assert.deepEqual((await response.json()).candidates,[]);assert.equal(seen.length,1);});
test('large HTML heads are bounded without losing an early declared icon',async()=>{const response=await iconAPI(new Request('https://weboss.example/api/site-icon?site=https%3A%2F%2Fread.example'),{ICON_LOOKUP_LIMITER:{limit:async()=>({success:true})}},{fetcher:async()=>new Response('<link rel="icon" href="/icon.png">'+'x'.repeat(200000),{headers:{'Content-Type':'text/html'}})});assert.deepEqual((await response.json()).candidates,['https://read.example/icon.png']);});

test('sites in the same category get distinct large brand marks, colors and name captions',()=>{
 const sites=[['GitHub','https://github.com','GH'],['GitLab','https://gitlab.com','GL'],['Gitee','https://gitee.com','码云'],['GitCode','https://gitcode.com','GC']];
 const results=sites.map(([name,url,label])=>{const result=recognizableIconDesign({...design,label:'开发',symbol:'globe'},{name,url});assert.equal(result.label,label);assert.equal(result.symbol,'code');assert.equal(result.caption,name);assert.equal(result.version,ICON_DESIGN_VERSION);const svg=iconSVG(result);assert.match(svg,new RegExp(`font-size="(?:35|42)"[^>]*>${label}</text>`));assert.ok(!svg.includes('font-size="12"'));return result;});
 assert.equal(new Set(results.map(result=>result.background)).size,sites.length);
});

test('specific services, real hostnames and shared hosting tenants identify the intended site',()=>{
 assert.equal(siteIconIdentity({name:'随意的别名',url:'https://music.youtube.com'}).label,'YM');
 assert.equal(siteIconIdentity({name:'随意的别名',url:'https://www.youtube.com'}).label,'YT');
 assert.equal(siteIconIdentity({name:'Google 地图',url:'https://www.google.com/maps'}).symbol,'map');
 assert.equal(siteIconIdentity({name:'豆瓣电影',url:'https://movie.douban.com'}).symbol,'play');
 for(const url of ['https://github.attacker.example','https://notgithub.com','https://gitee.com.fake.example'])assert.equal(siteIconIdentity({name:'站点',url}).known,false);
 assert.equal(siteIconIdentity({name:'工具',url:'https://alpha.pages.dev'}).label,'ALPH');
 assert.equal(siteIconIdentity({name:'工具',url:'https://beta.pages.dev'}).label,'BETA');
 assert.equal(siteIconIdentity({name:'工具',url:'https://www.brand.co.uk'}).caption,'brand');
});

test('unknown sites use meaningful initials and replace generic or unrelated model labels',()=>{
 const site={name:'Aero Notes',url:'https://aeronotes.example'};
 assert.equal(siteIconIdentity(site).label,'AN');
 for(const label of ['WEB','工具','无关'])assert.equal(recognizableIconDesign({...design,label},site).label,'AN');
 assert.equal(recognizableIconDesign({...design,label:'AN'},site).label,'AN');
 assert.equal(recognizableIconDesign({...design,label:'WEB',symbol:'globe'},site).symbol,'document');
 const chinese={name:'我的墨舟笔记官网',url:'https://mozho.example'};
 assert.equal(siteIconIdentity(chinese).label,'墨舟');assert.equal(siteIconIdentity(chinese).caption,'墨舟笔记');
 assert.equal(recognizableIconDesign({...design,label:'笔记'},chinese).label,'墨舟');
 assert.equal(siteIconIdentity({name:'AutoCAD',url:'https://autocad.example'}).label,'ACAD');
});

test('local fallback already identifies the website before AI is available',()=>{
 const known=localIconDesign({name:'我的代码',url:'https://github.com'});assert.equal(known.label,'GH');assert.equal(known.caption,'GitHub');assert.equal(known.symbol,'code');
 const unknown=localIconDesign({name:'墨舟笔记',url:'https://mozho.example'});assert.equal(unknown.label,'墨舟');assert.equal(unknown.version,ICON_DESIGN_VERSION);
 assert.equal(localIconDesign({name:'独立音乐',url:'https://music.example'}).symbol,'music');
 for(const symbol of ICON_SYMBOLS)assert.ok(!iconSVG({...design,symbol}).includes('undefined'));
});

test('SVG text stays bounded, keeps Chinese names readable and maintains strong text contrast',()=>{
 const bounded=validateIconDesign({...design,label:'ＭＤＮ<script>alert(1)</script>',caption:'<script>站名</script>'});
 assert.equal(bounded.label,'MDNs');assert.ok(bounded.caption.length<=12);const svg=iconSVG(bounded);assert.ok(!svg.includes('<script>'));assert.ok(!svg.includes('alert'));assert.ok(!svg.includes('onload='));
 assert.equal(validateIconDesign({...design,label:'墨舟笔记'}).label,'墨舟');
 const luminance=color=>{const [r,g,b]=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b;};
 for(const background of ['#FFFFFF','#303030','#888888','#A0A0A0','#6380B5']){
  const value=validateIconDesign({...design,background,foreground:background}),a=luminance(value.background),b=luminance(value.foreground);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5);
 }
});

test('upgrading generated icons retains cached website and manual images and persists the new AI design',async()=>{
 const data=storage(),expires=Date.now()+86400000,legacy=new IconStore({storage:data}),other={...app,name:'原站图标'};
 data.setItem('weboss-icon-cache-v1',JSON.stringify([[legacy.key(app),{src:'data:image/svg+xml;charset=utf-8,old',source:'ai',expires}],[legacy.key(other),{src:'https://read.example/favicon.ico',source:'website',expires}],['custom:https://cdn.example/manual.png',{src:'https://cdn.example/manual.png',source:'custom',expires}]]));
 let ai=0;const migrated=new IconStore({storage:data,imageLoader:async()=>{throw Error('missing');},fetcher:async url=>{if(url==='/api/icon')ai++;return Response.json(url==='/api/icon'?{design}:{candidates:[]});}});
 assert.equal(migrated.peek(app),undefined);assert.equal(migrated.peek(other).source,'website');assert.equal(migrated.entries.get('custom:https://cdn.example/manual.png').source,'custom');
 const upgraded=await migrated.resolve(app);assert.equal(upgraded.source,'ai');assert.equal(upgraded.designVersion,ICON_DESIGN_VERSION);assert.equal(ai,1);
 const restored=new IconStore({storage:data,fetcher:()=>assert.fail('new generated cache is reusable'),imageLoader:()=>assert.fail('new generated cache is reusable')});assert.equal((await restored.resolve(app)).src,upgraded.src);
});

test('D1 cache keys are versioned, old AI designs are regenerated once and new designs are reused',async()=>{
 const rows=new Map(),seenKeys=[],bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({name:app.name,domain:'read.example'}))),legacyKey=Array.from(new Uint8Array(bytes)).map(value=>value.toString(16).padStart(2,'0')).join('');rows.set(legacyKey,{design_json:JSON.stringify(design)});
 let calls=0;const env={ICON_AI_LIMITER:{limit:async()=>({success:true})},AI:{run:async()=>{calls++;return {response:design};}},DB:{prepare:sql=>({run:async()=>({}),bind:(...args)=>({first:async()=>{seenKeys.push(args[0]);return rows.get(args[0])||null;},run:async()=>{if(sql.startsWith('INSERT'))rows.set(args[0],{design_json:args[1]});}})})}};
 const first=await iconAPI(request(app),env),body=await first.json();assert.equal(first.status,200);assert.equal(body.design.version,ICON_DESIGN_VERSION);assert.equal(calls,1);assert.notEqual(seenKeys[0],legacyKey);
 const second=await iconAPI(request(app),env);assert.equal((await second.json()).cached,true);assert.equal(calls,1);assert.ok(rows.has(legacyKey));assert.equal(rows.size,2);
});

test('private addresses and credentials are excluded from identity hints sent to AI',async()=>{
 const env={ICON_AI_LIMITER:{limit:async()=>({success:true})},AI:{run:async(_model,input)=>{const body=JSON.parse(input.messages[1].content);assert.equal(body.domain,'private-site');assert.ok(!JSON.stringify(input).includes('192.168'));assert.ok(!JSON.stringify(input).includes('password'));return {response:design};}}};
 assert.equal((await iconAPI(request({name:'私人阅读',url:'http://user:password@192.168.1.1/internal?token=secret'}),env)).status,200);
});
