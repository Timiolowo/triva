const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SYNC_FILE = path.join(DATA_DIR, 'sync.json');
const MAX_HISTORY_PER_ROOM = 30;

// In-memory cache for fast response times
let syncCache = null;

const TMP_SYNC_FILE = path.join('/tmp', 'tivra_sync.json');

function ensureStorage() {
  if (!syncCache) {
    try {
      if (fs.existsSync(SYNC_FILE)) {
        syncCache = JSON.parse(fs.readFileSync(SYNC_FILE, 'utf8'));
      } else if (fs.existsSync(TMP_SYNC_FILE)) {
        syncCache = JSON.parse(fs.readFileSync(TMP_SYNC_FILE, 'utf8'));
      } else {
        syncCache = {};
      }
    } catch (e) {
      syncCache = {};
    }
  }
}

function persistStorage() {
  try {
    ensureStorage();
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SYNC_FILE, JSON.stringify(syncCache, null, 2), 'utf8');
  } catch (e) {
    try {
      fs.writeFileSync(TMP_SYNC_FILE, JSON.stringify(syncCache, null, 2), 'utf8');
    } catch (_) {}
  }
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const list = forwarded.split(',');
    return list[0].trim();
  }
  return req.socket ? req.socket.remoteAddress || '127.0.0.1' : '127.0.0.1';
}

function getHouseholdKey(req) {
  // 1. Explicit Sync Key from query or header
  const customKey = (req.query && req.query.key) || req.headers['x-sync-key'];
  if (customKey && typeof customKey === 'string' && customKey.trim().length > 0) {
    return 'key_' + customKey.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
  }

  // 2. Fallback to Home Wi-Fi / IP-based Auto Discovery
  const ip = getClientIp(req);
  // Normalize IPv6 localhost/mapped addresses
  const cleanIp = ip.replace(/^::ffff:/, '');

  // If local LAN / localhost (when running server at home), group into home_local_wifi
  const isLocalLan = cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost' ||
    /^192\.168\./.test(cleanIp) ||
    /^10\./.test(cleanIp) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanIp);

  if (isLocalLan) {
    return 'home_local_wifi';
  }

  const hash = crypto.createHash('sha256').update(cleanIp).digest('hex').substring(0, 10);
  return 'home_' + hash;
}

function mergeHistory(existingList, newItem) {
  let list = Array.isArray(existingList) ? [...existingList] : [];
  
  // Find match by id + type (+ season & episode for tv)
  const isTv = newItem.type === 'tv';
  const matchIndex = list.findIndex(i => 
    String(i.id) === String(newItem.id) &&
    i.type === newItem.type &&
    (!isTv || (String(i.season) === String(newItem.season) && String(i.episode) === String(newItem.episode)))
  );

  if (matchIndex > -1) {
    const existing = list[matchIndex];
    // Keep newer progress or timestamp
    const updated = {
      ...existing,
      ...newItem,
      currentTime: typeof newItem.currentTime === 'number' ? newItem.currentTime : existing.currentTime,
      duration: typeof newItem.duration === 'number' ? newItem.duration : existing.duration,
      progressPct: typeof newItem.progressPct === 'number' ? newItem.progressPct : existing.progressPct,
      timestamp: Math.max(existing.timestamp || 0, newItem.timestamp || Date.now())
    };
    list.splice(matchIndex, 1);
    list.unshift(updated);
  } else {
    list.unshift({
      ...newItem,
      timestamp: newItem.timestamp || Date.now()
    });
  }

  // Sort descending by timestamp
  list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  return list.slice(0, MAX_HISTORY_PER_ROOM);
}

module.exports = async function handler(req, res) {
  // CORS & Cache headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Sync-Key');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  ensureStorage();

  const roomKey = getHouseholdKey(req);
  const displayKey = roomKey.startsWith('key_')
    ? roomKey.replace('key_', '')
    : (roomKey === 'home_local_wifi' ? 'HOME-WIFI' : roomKey.replace('home_', 'HOME-').toUpperCase());

  // GET: Retrieve synced watch history
  if (req.method === 'GET') {
    const history = syncCache[roomKey] || [];
    return res.json({
      success: true,
      room: roomKey,
      syncKey: displayKey,
      isAutoDiscovery: roomKey.startsWith('home_'),
      history: history
    });
  }

  // POST: Push progress updates
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 500000) {
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const items = Array.isArray(payload.items)
          ? payload.items
          : (Array.isArray(payload.history)
            ? payload.history
            : (payload.item ? [payload.item] : []));

        if (!items.length) {
          return res.status(400).json({ success: false, error: 'Invalid item payload' });
        }

        let currentList = syncCache[roomKey] || [];
        items.forEach(item => {
          if (item && item.id && item.type) {
            currentList = mergeHistory(currentList, item);
          }
        });
        syncCache[roomKey] = currentList;
        persistStorage();

        return res.json({
          success: true,
          room: roomKey,
          syncKey: displayKey,
          history: syncCache[roomKey]
        });
      } catch (err) {
        return res.status(400).json({ success: false, error: 'Malformed JSON payload' });
      }
    });
    return;
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
};
