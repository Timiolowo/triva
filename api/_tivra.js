const vm = require('vm');

let cachedEngine = null;
let lastInitTime = 0;
const ENGINE_CACHE_TTL = 3600 * 1000; // 1 hour

async function getEngine() {
  const now = Date.now();
  if (cachedEngine && (now - lastInitTime < ENGINE_CACHE_TTL)) {
    return cachedEngine;
  }

  // 1. Fetch resolver chunk
  const chunkUrl = 'https://cinejoy.to/_app/immutable/chunks/Cd3QBhFG.js';
  const chunkRes = await fetch(chunkUrl);
  if (!chunkRes.ok) {
    throw new Error(`Failed to load Tivra resolver bundle: HTTP ${chunkRes.status}`);
  }
  let code = await chunkRes.text();
  code = code.replace(/import[^;]+;/g, '').replace(/export\{[^}]+\};?/g, '');

  // 2. Fetch WebAssembly crypto module
  const wasmRes = await fetch('https://api.shegu.st/crush.wasm');
  if (!wasmRes.ok) {
    throw new Error(`Failed to load Tivra wasm module: HTTP ${wasmRes.status}`);
  }
  const wasmBuffer = await wasmRes.arrayBuffer();

  // 3. Setup sandbox context mimicking browser environment
  const ctx = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    navigator: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    window: {},
    document: { createElement: () => ({}) },
    location: { href: 'https://cinejoy.to/watch/movie/693134' },
    TextEncoder,
    TextDecoder,
    crypto: require('crypto').webcrypto,
    Uint8Array,
    ArrayBuffer,
    URLSearchParams,
    fetch: async (url, opts = {}) => {
      if (url.endsWith('/crush.wasm')) {
        return new Response(wasmBuffer, {
          headers: { 'Content-Type': 'application/wasm' }
        });
      }
      return fetch(url, {
        ...opts,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Origin': 'https://cinejoy.to',
          'Referer': 'https://cinejoy.to/',
          ...(opts.headers || {})
        }
      });
    },
    b: new Proxy({}, { get: () => () => ({}) }),
    B: () => ({}),
    CW: () => ({})
  };

  vm.createContext(ctx);
  vm.runInContext(code, ctx);

  if (typeof ctx.Rc !== 'function') {
    throw new Error('Resolver entry function Rc not found in bundle');
  }

  cachedEngine = ctx;
  lastInitTime = now;
  return cachedEngine;
}

/**
 * Resolves a movie or TV episode to direct HLS m3u8 stream and subtitles
 * @param {'movie'|'tv'} type 
 * @param {number|string} tmdbId 
 * @param {number|string} [season] 
 * @param {number|string} [episode] 
 * @param {string} [title] 
 */
async function resolveStream(type, tmdbId, season, episode, title = '') {
  const engine = await getEngine();
  const payload = {
    tmdbId: String(tmdbId),
    title: String(title || '')
  };

  if (type === 'tv') {
    payload.season = parseInt(season, 10) || 1;
    payload.episode = parseInt(episode, 10) || 1;
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Stream resolver request timed out after 12s'));
    }, 12000);

    engine.Rc(type, payload, () => {})
      .then(res => {
        clearTimeout(timeout);
        if (!res || !res.result || !res.result.url) {
          return resolve({ success: false, error: 'No stream returned for title' });
        }
        resolve({
          success: true,
          url: res.result.url,
          sourceType: res.result.sourceType || 'hls',
          captions: res.result.captions || [],
          providers: res.providers || []
        });
      })
      .catch(err => {
        clearTimeout(timeout);
        reject(err);
      });
  });
}

module.exports = { resolveStream };
