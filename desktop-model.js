export function normalizePages(raw, defaults) {
  const source=Array.isArray(raw)&&raw.length?raw:defaults,seen=new Set();
  const pages=source.filter(page=>page&&typeof page.id==='string'&&page.id.trim()).map((page,index)=>({
    id:page.id.slice(0,80),name:String(page.name||`桌面 ${index+1}`).slice(0,32),
    eyebrow:String(page.eyebrow||'YOUR SPACE').slice(0,80),title:String(page.title||'').slice(0,80)
  })).filter(page=>{if(seen.has(page.id))return false;seen.add(page.id);return true;});
  return pages.length?pages:[{id:'home',name:'首页',eyebrow:'YOUR SPACE',title:''}];
}

// Keep one location per app and one usable desktop. Draft pages never enter this model.
export function reconcileDesktop(data,preferredPage,liveFolderPositions={}) {
  const modes=['desktop','tablet','mobile'],apps=new Map(data.apps.map(app=>[app.id,app]));
  data.dock=[...new Set(data.dock)].filter(id=>apps.has(id)).slice(0,12);
  const pinned=new Set(data.dock),grouped=new Set(),dissolved=[];
  data.folders=data.folders.filter(folder=>{
    folder.appIds=[...new Set(folder.appIds)].filter(id=>apps.has(id)&&!apps.get(id).system&&!pinned.has(id)&&!grouped.has(id));
    folder.appIds.forEach(id=>{grouped.add(id);apps.get(id).page=folder.page;});
    if(folder.appIds.length>=2)return true;
    const survivor=apps.get(folder.appIds[0]);
    for(const mode of modes){
      const position=liveFolderPositions[mode]?.[folder.id]||data.layout[mode][folder.id];
      if(survivor){
        if(position&&Number.isInteger(position.x)&&Number.isInteger(position.y))data.layout[mode][survivor.id]={...position,page:folder.page,priority:Math.max(1,Number(position.priority)||0)};
        else delete data.layout[mode][survivor.id];
      }
      delete data.layout[mode][folder.id];
    }
    dissolved.push(folder.id);return false;
  });
  const occupied=new Set([...data.widgets.map(widget=>widget.page),...data.apps.filter(app=>!pinned.has(app.id)).map(app=>app.page)]);
  const previous=data.pages,nonempty=previous.filter(page=>occupied.has(page.id));
  data.pages=nonempty.length?nonempty:[previous.find(page=>page.id===preferredPage)||previous[0]];
  const validPages=new Set(data.pages.map(page=>page.id)),fallback=validPages.has(preferredPage)?preferredPage:data.pages[0].id;
  data.apps.forEach(app=>{if(!validPages.has(app.page))app.page=fallback;});
  data.pages.forEach((page,index)=>{if(/^桌面\s*\d+$/.test(page.name))page.name=`桌面 ${index+1}`;});
  const items=new Set([...data.apps.map(app=>app.id),...data.widgets.map(widget=>widget.id),...data.folders.map(folder=>folder.id)]);
  for(const mode of modes)for(const [id,position] of Object.entries(data.layout[mode]))if(!items.has(id)||!validPages.has(position?.page))delete data.layout[mode][id];
  return {dissolved,removedPages:previous.filter(page=>!validPages.has(page.id)).map(page=>page.id)};
}
