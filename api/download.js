const { resolveStream } = require('./_tivra.js');

function parseMasterPlaylist(text) {
  const lines = String(text || '').split(/\r?\n/);
  const audioLines = lines.filter(line => line.startsWith('#EXT-X-MEDIA:TYPE=AUDIO'));
  const variants = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith('#EXT-X-STREAM-INF:')) continue;

    const resolution = line.match(/RESOLUTION=(\d+)x(\d+)/i);
    const url = lines.slice(index + 1).find(candidate => candidate && !candidate.startsWith('#'));
    if (!resolution || !url) continue;

    variants.push({
      height: Number(resolution[2]),
      width: Number(resolution[1]),
      info: line,
      url
    });
  }

  return { audioLines, variants };
}

function buildSelectedPlaylist(audioLines, variant, proxyBase) {
  const processedAudioLines = audioLines.map(line => {
    if (!proxyBase) return line;
    return line.replace(/URI="([^"]+)"/g, (match, uri) => {
      return `URI="${proxyBase}?url=${encodeURIComponent(uri)}"`;
    });
  });

  const variantUrl = proxyBase
    ? `${proxyBase}?url=${encodeURIComponent(variant.url)}`
    : variant.url;

  return [
    '#EXTM3U',
    '#EXT-X-VERSION:7',
    '#EXT-X-INDEPENDENT-SEGMENTS',
    '',
    ...processedAudioLines,
    '',
    variant.info,
    variantUrl,
    ''
  ].join('\n');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, id, title, season, episode, quality, format } = req.query;
  if (!id) return res.status(400).json({ error: 'Parameter "id" is required' });

  const mediaType = type === 'tv' ? 'tv' : 'movie';
  if (mediaType === 'tv' && (!season || !episode)) {
    return res.status(400).json({ error: 'Season and episode are required for a series download link.' });
  }

  try {
    const source = await resolveStream(mediaType, id, season || 1, episode || 1, title || '');
    if (!source.success || !source.url) {
      return res.status(404).json({ error: source.error || 'No stream found' });
    }

    const upstream = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://cinejoy.to',
        'Referer': 'https://cinejoy.to/'
      }
    });
    if (!upstream.ok) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(upstream.status >= 400 && upstream.status < 500 ? 404 : 502).json({
        error: `A download link is not available for this ${mediaType === 'tv' ? 'episode' : 'movie'}.`
      });
    }

    const parsed = parseMasterPlaylist(await upstream.text());
    const qualities = [...new Set(parsed.variants.map(item => item.height))].sort((a, b) => b - a);
    if (qualities.length === 0) {
      return res.status(404).json({ error: `No downloadable qualities were found for this ${mediaType === 'tv' ? 'episode' : 'movie'}.` });
    }

    if (format === 'json') {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ success: true, qualities });
    }

    const requestedHeight = Number(quality);
    const selected = parsed.variants.find(item => item.height === requestedHeight);
    if (!selected) return res.status(404).json({ error: 'Requested quality is unavailable' });

    const proto = req.headers['x-forwarded-proto'] || (req.socket && req.socket.encrypted ? 'https' : 'http');
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const proxyBase = `${proto}://${host}/api/proxy`;

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
    const filename = mediaType === 'tv'
      ? `series-${id}-s${season}e${episode}-${requestedHeight}p.m3u8`
      : `movie-${id}-${requestedHeight}p.m3u8`;
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');

    const playlistBody = buildSelectedPlaylist(parsed.audioLines, selected, proxyBase);
    if (req.method === 'HEAD') {
      res.setHeader('Content-Length', Buffer.byteLength(playlistBody, 'utf8'));
      return res.status(200).end();
    }

    return res.status(200).end(playlistBody);
  } catch (error) {
    console.error('[API/DOWNLOAD ERROR]', error.message);
    return res.status(502).json({ error: 'Download link is temporarily unavailable' });
  }
};

module.exports.parseMasterPlaylist = parseMasterPlaylist;
module.exports.buildSelectedPlaylist = buildSelectedPlaylist;
