const http = require('http');
const fs = require('fs');
const path = require('path');

// Import API handlers
const searchHandler = require('./api/search.js');
const tvHandler = require('./api/tv.js');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, 'http://localhost');
  const pathname = parsedUrl.pathname;

  // Add standard Vercel helper properties (query, status, json) to res/req
  req.query = {};
  parsedUrl.searchParams.forEach((value, key) => {
    req.query[key] = value;
  });
  res.status = function(code) {
    this.statusCode = code;
    return this;
  };
  res.json = function(data) {
    this.setHeader('Content-Type', 'application/json; charset=UTF-8');
    this.end(JSON.stringify(data));
    return this;
  };

  // API Routes
  if (pathname === '/api/search' || pathname === '/api/search.js') {
    return searchHandler(req, res);
  }
  if (pathname === '/api/tv' || pathname === '/api/tv.js') {
    return tvHandler(req, res);
  }
  // Static File Serving
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA if not found
      filePath = path.join(__dirname, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      } else {
        if (ext === '.css' || ext === '.js') {
          res.setHeader('Cache-Control', 'public, max-age=3600');
        } else if (ext === '.html') {
          res.setHeader('Cache-Control', 'no-cache');
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`Tivra TV Server running at http://localhost:${PORT}`);
});
