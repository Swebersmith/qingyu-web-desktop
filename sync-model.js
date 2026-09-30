import {reconcileDesktop} from './desktop-model.js';

export const SYNC_KEY_PATTERN=/^wo_[A-Za-z0-9_-]{43}$/;
// Derive a stable ASCII credential; never send or persist the user's passphrase.
export async function resolveSyncKey(value) {
  const key=String(value||'').trim().normalize('NFC');
  if(SYNC_KEY_PATTERN.test(key))return key;
  if(key.startsWith('wo_'))throw Error('sync_key_required');
  if([...key].length<12||[...key].length>128||/[\u0000-\u001f\u007f]/u.test(key))throw Error('custom_key_invalid');
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),'PBKDF2',false,['deriveBits']);
  const bytes=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode('Weboss desktop sync v1'),iterations:210000,hash:'SHA-256'},material,256));
  return 'wo_'+btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export const MAX_SYNC_BYTES=1000000;
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const safeKeys=value=>Object.keys(value).filter(key=>!['__proto__','prototype','constructor'].includes(key));
function ordered(value){
  if(Array.isArray(value))return value.map(ordered);
  if(object(value))return Object.fromEntries(safeKeys(value).sort().map(key=>[key,ordered(value[key])]));
  return value;
}
export function sameState(a,b){return JSON.stringify(ordered(a))===JSON.stringify(ordered(b));}

export function validDesktop(data,{allowSingleton=false}={}) {
  if(!object(data)||!Number.isInteger(data.version)||data.version<1)return false;
  const limits={pages:200,apps:1500,folders:500,widgets:500};
  for(const [field,limit] of Object.entries(limits)){
    if(!Array.isArray(data[field])||data[field].length>limit||(field==='pages'&&!data[field].length))return false;
    const ids=new Set();
    for(const item of data[field]){
      if(!object(item)||typeof item.id!=='string'||!item.id||item.id.length>100||ids.has(item.id))return false;
      ids.add(item.id);
    }
  }
  const pages=new Set(data.pages.map(page=>page.id)),apps=new Map(data.apps.map(app=>[app.id,app])),grouped=new Set();
  if(!Array.isArray(data.dock)||data.dock.length>12||new Set(data.dock).size!==data.dock.length||data.dock.some(id=>!apps.has(id)))return false;
  const dock=new Set(data.dock);
  for(const app of data.apps){
    if(typeof app.name!=='string'||!app.name.trim()||app.name.length>64||!pages.has(app.page))return false;
    if(app.id==='weboss-settings')continue;
    try{if(!['http:','https:'].includes(new URL(app.url).protocol))return false;}catch{return false;}
  }
  for(const widget of data.widgets)if(!pages.has(widget.page)||typeof widget.type!=='string')return false;
  for(const folder of data.folders){
    if(!pages.has(folder.page)||!Array.isArray(folder.appIds)||(!allowSingleton&&folder.appIds.length<2))return false;
    for(const id of folder.appIds){const app=apps.get(id);if(!app||app.system||app.page!==folder.page||dock.has(id)||grouped.has(id))return false;grouped.add(id);}
  }
  if(!object(data.layout))return false;
  if(data.todos!==undefined&&(!Array.isArray(data.todos)||data.todos.length>500||data.todos.some(todo=>!object(todo)||typeof todo.id!=='string'||typeof todo.text!=='string'||typeof todo.done!=='boolean')))return false;
  for(const field of ['history','searchHistory','favoriteIds'])if(data[field]!==undefined&&(!Array.isArray(data[field])||data[field].some(value=>typeof value!=='string')))return false;
  if(data.watching!==undefined&&(!Array.isArray(data.watching)||data.watching.length>100||data.watching.some(item=>!object(item)||typeof item.title!=='string'||typeof item.url!=='string')))return false;
  for(const mode of ['desktop','tablet','mobile']){
    if(!object(data.layout[mode]))return false;
    for(const pos of Object.values(data.layout[mode]))if(!object(pos)||!pages.has(pos.page)||!Number.isInteger(pos.x)||!Number.isInteger(pos.y)||pos.x<0||pos.x>100||pos.y<0||pos.y>100000)return false;
  }
  return true;
}

// Merge fields against the last acknowledged cloud version, preserving deletions.
export function mergeDesktop(base,local,remote){
  const conflicts=[],entities=new Set(['apps','widgets','folders','pages','todos']);
  function orderIds(before,left,right,ids,path){
    const common=before.filter(id=>left.includes(id)&&right.includes(id)),a=left.filter(id=>common.includes(id)),b=right.filter(id=>common.includes(id));
    const changedA=!sameState(a,common),changedB=!sameState(b,common);
    if(changedA&&changedB&&!sameState(a,b))conflicts.push(`${path}.顺序`);
    const first=changedB&&!changedA?right:left,second=first===left?right:left;
    return [...new Set([...first,...second])].filter(id=>ids.has(id));
  }
  function merge(before,left,right,path){
    if(sameState(left,right))return clone(left);
    if(sameState(left,before))return clone(right);
    if(sameState(right,before))return clone(left);
    if(Array.isArray(before)&&Array.isArray(left)&&Array.isArray(right)){
      if(entities.has(path)&&[...before,...left,...right].every(item=>object(item)&&typeof item.id==='string')){
        const a=new Map(before.map(item=>[item.id,item])),b=new Map(left.map(item=>[item.id,item])),c=new Map(right.map(item=>[item.id,item])),result=new Map();
        for(const id of new Set([...a.keys(),...b.keys(),...c.keys()])){const item=merge(a.get(id),b.get(id),c.get(id),`${path}.${id}`);if(item!==undefined)result.set(id,item);}
        return orderIds([...a.keys()],[...b.keys()],[...c.keys()],new Set(result.keys()),path).map(id=>result.get(id));
      }
      if((['dock','favoriteIds'].includes(path)||path.endsWith('.appIds'))&&[...before,...left,...right].every(id=>typeof id==='string')){
        const ids=new Set();for(const id of new Set([...before,...left,...right]))if(merge(before.includes(id),left.includes(id),right.includes(id),`${path}.${id}`))ids.add(id);
        return orderIds(before,left,right,ids,path);
      }
      if(['history','searchHistory'].includes(path))return [...new Set([...left,...right])].slice(0,12);
    }
    if(object(left)&&object(right)&&(object(before)||before===undefined)){
      const result={};for(const key of new Set([...safeKeys(before||{}),...safeKeys(left),...safeKeys(right)])){
        const value=merge(before?.[key],left[key],right[key],path?`${path}.${key}`:key);if(value!==undefined)result[key]=value;
      }return result;
    }
    conflicts.push(path);return clone(left);
  }
  const state=merge(base,local,remote,'');
  if(!conflicts.length){
    if(!validDesktop(state,{allowSingleton:true}))conflicts.push('App 或组件的位置');
    else reconcileDesktop(state);
  }
  return {state,conflicts:[...new Set(conflicts)]};
}

export function generateSyncKey(){
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  return 'wo_'+btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
