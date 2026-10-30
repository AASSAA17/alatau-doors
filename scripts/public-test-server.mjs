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
    // Model the hosting edge's bounded request buffering. Forwarding a still
    // uploading TLS stream after an early 413 can reset a keep-alive socket.
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size <= 5 * 1024 * 1024) chunks.push(chunk);
    });
    req.on('end', () => {
    if (size > 5 * 1024 * 1024) { res.writeHead(413); res.end(); return; }
    const upstream = http.request(
      {
        hostname: '127.0.0.1',
        port: 3300,
        path: req.url,
        method: req.method,
        // Oversized bodies can be rejected before being consumed; do not reuse
        // that upstream socket for the next test request.
        agent: false,
        headers: { ...req.headers, 'x-forwarded-proto': 'https' },
      },
      (response) => {
        res.writeHead(response.statusCode, response.headers);
        response.pipe(res);
      },
    );
    upstream.on('error', () => {
      if (!res.headersSent) { res.writeHead(503); res.end('Starting'); }
      else res.destroy();
    });
    upstream.end(Buffer.concat(chunks));
    });
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
