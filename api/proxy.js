function rewriteM3u8(content, baseUrl, proxyBase) {
  // Rewrite URI attributes (audio tracks, subtitles, encryption keys)
  let res = content.replace(/URI="([^"]+)"/g, (match, uri) => {
    try {
      const absoluteUrl = new URL(uri, baseUrl).toString();
      return `URI="${proxyBase}?url=${encodeURIComponent(absoluteUrl)}"`;
    } catch (e) {
      return match;
    }
  });

  // Rewrite segment & variant playlist URLs
  res = res.replace(/^(?!#)(.+)$/gm, (match, line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    try {
      const absoluteUrl = new URL(trimmed, baseUrl).toString();
      return `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}`;
    } catch (e) {
      return line;
    }
  });

  return res;
}

function detectMediaMime(targetUrl, buffer, upstreamContentType) {
  const urlLower = targetUrl.toLowerCase();

  if (urlLower.includes('.m3u8') || (upstreamContentType && upstreamContentType.includes('mpegurl'))) {
    return 'application/vnd.apple.mpegurl; charset=utf-8';
  }
  if (urlLower.includes('.vtt') || (upstreamContentType && upstreamContentType.includes('text/vtt'))) {
    return 'text/vtt; charset=utf-8';
  }

  // Check binary magic bytes when buffer is present
  if (buffer && buffer.length >= 8) {
    const boxType = buffer.toString('ascii', 4, 8);
    if (boxType === 'ftyp' || boxType === 'moof' || boxType === 'moov' || boxType === 'styp') {
      return urlLower.includes('audio') ? 'audio/mp4' : 'video/mp4';
    }
    if (buffer[0] === 0x47) {
      return 'video/mp2t';
    }
    if (buffer.length >= 6 && buffer.toString('ascii', 0, 6) === 'WEBVTT') {
      return 'text/vtt; charset=utf-8';
    }
  }

  // Path heuristics when buffer is unavailable (e.g. HEAD requests)
  if (urlLower.includes('audio')) {
    return 'audio/mp4';
  }
  if (urlLower.includes('video') || urlLower.includes('.ts') || urlLower.includes('.m4s') || urlLower.includes('.mp4')) {
    return 'video/mp4';
  }

  if (upstreamContentType && !upstreamContentType.includes('text/html') && !upstreamContentType.includes('text/plain')) {
    return upstreamContentType;
  }

  return 'video/mp4';
}

module.exports = async function handler(req, res) {
  // Global CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetUrl = req.query.url;
  if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
    return res.status(400).json({ error: 'Valid target URL parameter required' });
  }

  try {
    const upstreamHeaders = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://cinejoy.to/',
      'Origin': 'https://cinejoy.to'
    };

    if (req.headers.range) {
      upstreamHeaders['Range'] = req.headers.range;
    }

    const response = await fetch(targetUrl, {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: upstreamHeaders
    });

    if (!response.ok && response.status !== 206) {
      return res.status(response.status).json({
        error: `Upstream error: HTTP ${response.status}`
      });
    }

    const contentType = response.headers.get('content-type') || '';
    const isPlaylist = targetUrl.includes('.m3u8') || contentType.includes('mpegurl');

    // Handle HEAD requests directly from upstream headers
    if (req.method === 'HEAD') {
      const mime = isPlaylist ? 'application/vnd.apple.mpegurl; charset=utf-8' : detectMediaMime(targetUrl, null, contentType);
      res.status(response.status);
      res.setHeader('Content-Type', mime);
      const upstreamLength = response.headers.get('content-length');
      if (upstreamLength) {
        res.setHeader('Content-Length', upstreamLength);
      }
      if (response.headers.get('content-range')) {
        res.setHeader('Content-Range', response.headers.get('content-range'));
      }
      if (response.headers.get('accept-ranges')) {
        res.setHeader('Accept-Ranges', response.headers.get('accept-ranges'));
      }
      res.setHeader('Cache-Control', isPlaylist ? 'public, max-age=60, stale-while-revalidate=300' : 'public, max-age=86400, immutable');
      return res.end();
    }

    if (isPlaylist) {
      const rawText = await response.text();
      const rewritten = rewriteM3u8(rawText, targetUrl, '/api/proxy');

      res.status(response.status);
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.end(rewritten);
    } else {
      // Media segment chunk (.ts, disguised .html chunks, .vtt)
      const buffer = Buffer.from(await response.arrayBuffer());
      const mime = detectMediaMime(targetUrl, buffer, contentType);

      res.status(response.status);
      res.setHeader('Content-Type', mime);

      if (response.headers.get('content-range')) {
        res.setHeader('Content-Range', response.headers.get('content-range'));
      }
      if (response.headers.get('accept-ranges')) {
        res.setHeader('Accept-Ranges', response.headers.get('accept-ranges'));
      }

      res.setHeader('Content-Length', buffer.length);
      // Cache chunks aggressively since segments are immutable
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      return res.end(buffer);
    }
  } catch (err) {
    console.error('[API/PROXY ERROR]', err.message);
    return res.status(502).json({ error: 'Proxy request failed: ' + err.message });
  }
};
