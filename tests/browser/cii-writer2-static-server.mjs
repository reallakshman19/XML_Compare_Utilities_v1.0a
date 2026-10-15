import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = resolve(process.cwd());
const port = Number(process.argv[2] || 4174);
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.py', 'text/plain; charset=utf-8'],
  ['.cii', 'application/octet-stream'],
]);

function localPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl || '/', 'http://127.0.0.1').pathname);
  const candidate = resolve(root, `.${pathname}`);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return null;
  return candidate;
}

const server = createServer(async (request, response) => {
  const path = localPath(request.url);
  if (!path) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const info = await stat(path);
    if (!info.isFile()) throw new Error('NOT_FILE');
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': contentTypes.get(extname(path).toLowerCase()) || 'application/octet-stream',
    });
    createReadStream(path).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`CII Writer2 retained browser server: http://127.0.0.1:${port}`);
});
