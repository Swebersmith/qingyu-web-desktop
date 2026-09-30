const clone=value=>JSON.parse(JSON.stringify(value));
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const httpURL=value=>{try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}};

// Shortcut-only exports merge into the desktop; a complete Weboss backup restores it.
export function importDesktop(data,current,defaults,{pageId=current.pages[0]?.id,createId=()=>crypto.randomUUID()}={}){
  if(object(data)&&Array.isArray(data.apps)&&Array.isArray(data.pages))return {state:clone(data),report:{kind:'backup'}};
  const shortcuts=Array.isArray(data)?data:object(data)&&Array.isArray(data.shortcuts)?data.shortcuts:object(data)&&Array.isArray(data.apps)?data.apps:null;
  if(!shortcuts)throw Error('无法识别此 JSON：请选择快捷方式数组、shortcuts 导出或 Weboss 备份。');
  if(shortcuts.length>1500)throw Error('一次最多导入 1500 个快捷方式。');
  const state=clone(current),report={kind:'shortcuts',added:0,reused:0,skipped:0,pinned:0,dockOverflow:0};
  if(!state.pages.some(page=>page.id===pageId))pageId=state.pages[0]?.id||defaults.pages[0].id;
  const ids=new Set([...state.apps,...state.widgets,...state.folders,...state.pages].map(item=>item.id)),byURL=new Map(state.apps.filter(app=>!app.system).map(app=>[httpURL(app.url),app]));
  const uniqueId=preferred=>{let id=typeof preferred==='string'?preferred.trim():'';if(!id||id.length>100||ids.has(id)||['__proto__','constructor','prototype','weboss-settings'].includes(id))do{id=createId();}while(ids.has(id));ids.add(id);return id;};
  const sorted=shortcuts.map((item,index)=>({item,index,order:Number.isFinite(item?.order)?item.order:index})).sort((a,b)=>a.order-b.order||a.index-b.index);
  for(const {item} of sorted){
    const url=object(item)&&typeof item.url==='string'?httpURL(item.url):'';
    if(!url){report.skipped++;continue;}
    let app=byURL.get(url);
    if(app)report.reused++;
    else{
      if(state.apps.length>=1500)throw Error('导入后 App 超过 1500 个，请减少快捷方式。');
      const name=typeof item.name==='string'&&item.name.trim()?item.name.trim().slice(0,64):new URL(url).hostname;
      const icon=typeof item.icon==='string'?item.icon.trim().slice(0,180):'';
      const custom=!!icon&&(!!httpURL(icon)||!/[/:]/.test(icon));
      app={id:uniqueId(item.id),name,url,icon:custom?icon:name.slice(0,1),iconMode:custom?'custom':'auto',color:/^#[\da-f]{6}$/i.test(item.color)?item.color:'#6c9ca4',page:pageId};
      state.apps.push(app);byURL.set(url,app);report.added++;
    }
    if(item.pinned===true&&!state.dock.includes(app.id)){
      if(state.dock.length<12){state.dock.push(app.id);report.pinned++;}
      else{state.favoriteIds=[...new Set([...(state.favoriteIds||[]),app.id])];report.dockOverflow++;}
    }
  }
  if(shortcuts.length&&!report.added&&!report.reused)throw Error('此文件没有有效的 http / https 快捷方式。');
  if(object(data)&&Array.isArray(data.widgets))for(const item of data.widgets.slice(0,500)){
    if(!object(item))continue;
    if(state.widgets.length>=500)break;
    const link=item.type==='link'&&!!httpURL(item.content);
    state.widgets.push({id:uniqueId(item.id),type:link?'link':'note',page:pageId,size:'medium',title:String(item.title||'旧版便签').slice(0,40),content:String(item.content||'').slice(0,4000)});
  }
  state.version=defaults.version;
  return {state,report};
}
