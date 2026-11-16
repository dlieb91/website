/**
 * Mini-Webserver fuer NebenkostenKompass.
 * Wird von Start.bat aufgerufen. Liefert die Dateien aus diesem Ordner
 * ueber http://localhost aus, damit der Browser Zugriff auf die
 * File System Access API (Ordner-Speicherung) bekommt.
 *
 * Eigener Port-Bereich, damit mehrere Zahlenkompass-Apps
 * gleichzeitig laufen koennen.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = __dirname;
const START_PORT = 8975;
const MAX_TRIES = 20;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Bad Request');
    return;
  }
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.resolve(path.join(ROOT, urlPath));
  /* Verzeichniswechsel nach oben unterbinden. Der Vergleich braucht den
     Trennstrich am Ende: ohne ihn liesse ein blosses startsWith(ROOT) auch
     einen Geschwisterordner mit gleichem Namensanfang durch. */
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Nicht gefunden: ' + urlPath);
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

function findBrowser() {
  const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const local = process.env['LOCALAPPDATA'] || '';
  const candidates = [
    path.join(pf, 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(pf86, 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(local, 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(pf86, 'Microsoft\\Edge\\Application\\msedge.exe'),
    path.join(pf, 'Microsoft\\Edge\\Application\\msedge.exe'),
  ];
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

function openBrowser(url) {
  if (process.env.KEIN_BROWSER) return;
  const exe = findBrowser();
  try {
    if (exe) {
      spawn(exe, [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('cmd', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    console.log('Browser konnte nicht automatisch geoeffnet werden.');
  }
}

let port = START_PORT;
let tries = 0;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && tries < MAX_TRIES) {
    tries++;
    port++;
    server.listen(port, '127.0.0.1');
  } else {
    console.error('Server konnte nicht gestartet werden:', err.message);
    process.exit(1);
  }
});

server.listen(port, '127.0.0.1', () => {
  const url = `http://localhost:${port}/`;
  console.log('');
  console.log('  NebenkostenKompass laeuft.');
  console.log('  ' + url);
  console.log('');
  console.log('  Dieses Fenster bitte offen lassen, solange du die App nutzt.');
  console.log('  Zum Beenden: Fenster schliessen oder Strg+C.');
  console.log('');
  openBrowser(url);
});
