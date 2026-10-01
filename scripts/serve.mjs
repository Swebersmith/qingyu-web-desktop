import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import {Readable} from 'node:stream';
import {wallpaperAPI} from '../wallpaper-api.js';

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.json': 'application/json; charset=utf-8' };

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if(pathname==='/api/wallpaper/bing'||pathname==='/api/wallpaper/bing/image'){
      // The local preview uses the same wallpaper proxy as the deployed Worker.
      const result=await wallpaperAPI(new Request(`http://localhost:${port}${request.url}`,{method:request.method}),{WALLPAPER_LIMITER:{limit:async()=>({success:true})}});
      response.writeHead(result.status,Object.fromEntries(result.headers));if(result.body){const body=Readable.fromWeb(result.body);body.on('error',()=>response.destroy());body.pipe(response);}else response.end();return;
    }
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (path !== root && !path.startsWith(root + sep)) { response.writeHead(403); response.end(); return; }
    if (!(await stat(path)).isFile()) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    response.end(await readFile(path));
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(port, () => console.log(`Weboss: http://localhost:${port}`));
