import {SYNC_KEY_PATTERN,MAX_SYNC_BYTES,validDesktop} from './sync-model.js';

export const SYNC_SCHEMA=`CREATE TABLE IF NOT EXISTS weboss_desktops (
  id TEXT PRIMARY KEY NOT NULL,
  state TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  updated_at TEXT NOT NULL
)`;
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Authorization'};
const json=(body,status=200,extra={})=>Response.json(body,{status,headers:{...headers,...extra}});
async function readJSON(request){
  const reader=request.body?.getReader();if(!reader)throw Error('invalid');
  const chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_SYNC_BYTES){await reader.cancel();throw Error('large');}chunks.push(value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return JSON.parse(new TextDecoder().decode(bytes));
}
async function readDesktop(db,id){
  const row=await db.prepare('SELECT state, revision, updated_at FROM weboss_desktops WHERE id = ?1').bind(id).first();
  return row?{state:JSON.parse(row.state),revision:row.revision,updatedAt:row.updated_at}:null;
}
export async function syncAPI(request,env){
  const path=new URL(request.url).pathname,origin=request.headers.get('Origin');
  if((origin&&origin!==new URL(request.url).origin)||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'same_origin_required'},403);
  if(path==='/api/sync/status')return request.method==='GET'?json({configured:!!env.DB}):json({error:'method_not_allowed'},405);
  if(!['GET','PUT'].includes(request.method))return json({error:'method_not_allowed'},405);
  const key=request.headers.get('Authorization')?.replace(/^Bearer /,'');
  if(!SYNC_KEY_PATTERN.test(key||''))return json({error:'sync_key_required'},401);
  if(!env.DB)return json({error:'database_not_bound'},503);
  if(env.SYNC_LIMITER){try{const {success}=await env.SYNC_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')||'local'});if(!success)return json({error:'rate_limited'},429);}catch{return json({error:'database_unavailable'},503);}}
  let payload;
  if(request.method==='PUT'){
    if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))return json({error:'json_required'},415);
    try{payload=await readJSON(request);if(!Number.isSafeInteger(payload.baseRevision)||payload.baseRevision<0||!validDesktop(payload.state))throw Error('invalid');}
    catch(error){return json({error:error.message==='large'?'desktop_too_large':'invalid_desktop'},error.message==='large'?413:400);}
  }
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key)),id=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  async function operation(){
    if(request.method==='GET'){
      const row=await db.prepare('SELECT revision, updated_at FROM weboss_desktops WHERE id = ?1').bind(id).first();
      if(!row)return json({error:'desktop_not_found'},404);
      const etag=`"${row.revision}"`;if(request.headers.get('If-None-Match')===etag)return new Response(null,{status:304,headers:{...headers,ETag:etag}});
      const desktop=await readDesktop(db,id);return json(desktop,200,{ETag:`"${desktop.revision}"`});
    }
    const {state,baseRevision}=payload,updatedAt=new Date().toISOString();
    const statement=baseRevision===0
      ? db.prepare('INSERT INTO weboss_desktops (id, state, revision, updated_at) VALUES (?1, ?2, 1, ?3) ON CONFLICT(id) DO NOTHING').bind(id,JSON.stringify(state),updatedAt)
      : db.prepare('UPDATE weboss_desktops SET state = ?2, revision = revision + 1, updated_at = ?3 WHERE id = ?1 AND revision = ?4').bind(id,JSON.stringify(state),updatedAt,baseRevision);
    const result=await statement.run();
    if(!result.meta.changes){const remote=await readDesktop(db,id);return remote?json({error:'revision_conflict',...remote},409):json({error:'desktop_not_found'},404);}
    return json({revision:baseRevision+1,updatedAt},200,{ETag:`"${baseRevision+1}"`});
  }
  // Ordinary binding queries go to D1's primary; CAS writes must read fresh revisions.
  const db=env.DB;
  try{
    try{return await operation();}
    catch(error){if(!String(error.message).includes('no such table: weboss_desktops'))throw error;await db.prepare(SYNC_SCHEMA).run();return await operation();}
  }catch{console.error(JSON.stringify({event:'desktop_sync_failed'}));return json({error:'database_unavailable'},503);}
}
