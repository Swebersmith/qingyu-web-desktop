import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.json': 'application/json; charset=utf-8' };

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (path !== root && !path.startsWith(root + sep)) { response.writeHead(403); response.end(); return; }
    if (!(await stat(path)).isFile()) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    response.end(await readFile(path));
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(port, () => console.log(`Weboss: http://localhost:${port}`));
