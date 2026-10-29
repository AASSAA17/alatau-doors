import https from 'node:https';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
// Test-only HTTPS terminator, bound to loopback, like Vercel's TLS edge.
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3300'],
  { env: process.env, stdio: 'inherit', windowsHide: true },
);
const server = https.createServer(
  {
    key: readFileSync('.local/postgres-test/key.pem'),
    cert: readFileSync('.local/postgres-test/cert.pem'),
  },
  (req, res) => {
    const upstream = http.request(
      {
        hostname: '127.0.0.1',
        port: 3300,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, 'x-forwarded-proto': 'https' },
      },
      (response) => {
        res.writeHead(response.statusCode, response.headers);
        response.pipe(res);
      },
    );
    upstream.on('error', () => {
      res.writeHead(503);
      res.end('Starting');
    });
    req.pipe(upstream);
  },
);
server.listen(3343, '127.0.0.1');
const close = () => {
  server.close();
  child.kill();
};
process.on('SIGTERM', close);
process.on('SIGINT', close);
child.on('exit', (code) => {
  server.close();
  process.exitCode = code || 0;
});
