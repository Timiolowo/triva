const { execFileSync } = require('child_process');
const fs = require('fs');

const files = [
  'app.js',
  'server.js',
  'api/search.js',
  'api/tv.js',
  'api/trending.js',
  'api/_config.js',
  'api/source.js',
  'api/proxy.js',
  'api/_tivra.js',
  'api/subtitles.js'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  }
}
