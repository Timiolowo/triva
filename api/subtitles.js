const { getTmdbApiKey } = require('./_config.js');

// Language code lookup table for OpenSubtitles 3-letter codes
const LANG_MAP = {
  eng: 'English',
  spa: 'Spanish',
  fre: 'French',
  fra: 'French',
  ger: 'German',
  deu: 'German',
  ita: 'Italian',
  por: 'Portuguese',
  pob: 'Portuguese (Brazil)',
  ara: 'Arabic',
  rus: 'Russian',
  hin: 'Hindi',
  chi: 'Chinese',
  zho: 'Chinese',
  jpn: 'Japanese',
  kor: 'Korean',
  tur: 'Turkish',
  pol: 'Polish',
  dut: 'Dutch',
  nld: 'Dutch',
  swe: 'Swedish',
  nor: 'Norwegian',
  dan: 'Danish',
  fin: 'Finnish',
  ind: 'Indonesian',
  vie: 'Vietnamese',
  tha: 'Thai',
  ukr: 'Ukrainian',
  heb: 'Hebrew',
  cze: 'Czech',
  ces: 'Czech',
  hun: 'Hungarian',
  ell: 'Greek',
  gre: 'Greek',
  ron: 'Romanian',
  rum: 'Romanian',
  bul: 'Bulgarian',
  hrv: 'Croatian',
  srp: 'Serbian',
  slv: 'Slovenian',
  slk: 'Slovak',
  slo: 'Slovak',
  fas: 'Persian',
  per: 'Persian',
  ben: 'Bengali',
  tam: 'Tamil',
  tel: 'Telugu',
  mal: 'Malayalam',
  fil: 'Filipino',
  msa: 'Malay',
  may: 'Malay'
};

function getLanguageName(code) {
  if (!code) return 'Unknown';
  const clean = String(code).toLowerCase().trim();
  if (LANG_MAP[clean]) return LANG_MAP[clean];
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'language' });
    return dn.of(clean) || clean.toUpperCase();
  } catch (e) {
    return clean.toUpperCase();
  }
}

// Convert SRT format to valid WebVTT format
function srtToVtt(srtContent) {
  if (!srtContent) return 'WEBVTT\n\n';
  
  // Normalize line endings
  let text = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Strip byte order mark (BOM) if present
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  // Convert SRT timestamp commas to WebVTT dots: 00:01:23,456 --> 00:01:25,789
  text = text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');

  return `WEBVTT\n\n${text.trim()}\n`;
}

// In-memory cache for IMDb ID lookups (TTL: 24 hours)
const imdbCache = new Map();
const SUB_CACHE_TTL = 3600 * 1000 * 24;

async function getImdbId(type, tmdbId) {
  const cacheKey = `${type}:${tmdbId}`;
  const cached = imdbCache.get(cacheKey);
  if (cached && (Date.now() - cached.time < SUB_CACHE_TTL)) {
    return cached.imdbId;
  }

  const apiKey = getTmdbApiKey();
  const endpoint = type === 'tv'
    ? `https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${apiKey}`
    : `https://api.themoviedb.org/3/movie/${tmdbId}/external_ids?api_key=${apiKey}`;

  const res = await fetch(endpoint);
  if (!res.ok) {
    throw new Error(`TMDB external_ids failed with HTTP ${res.status}`);
  }
  const data = await res.json();
  const imdbId = data.imdb_id;

  if (imdbId) {
    imdbCache.set(cacheKey, { imdbId, time: Date.now() });
  }
  return imdbId;
}

module.exports = async function handler(req, res) {
  // CORS support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action = 'list', url, type = 'movie', id, season, episode } = req.query;

  // 1. Action: Stream VTT file
  if (action === 'vtt') {
    if (!url) {
      return res.status(400).json({ error: 'Missing required query parameter "url"' });
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: `Subtitle upstream HTTP ${response.status}` });
      }

      const rawText = await response.text();
      const vttContent = srtToVtt(rawText);

      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      return res.status(200).send ? res.status(200).send(vttContent) : res.writeHead(200, { 'Content-Type': 'text/vtt; charset=utf-8' }).end(vttContent);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to download and convert subtitle: ' + err.message });
    }
  }

  // 2. Action: List available subtitles from OpenSubtitles
  if (!id) {
    return res.status(400).json({ error: 'Parameter "id" (TMDB ID) is required' });
  }

  try {
    const imdbId = await getImdbId(type, id);
    if (!imdbId) {
      return res.status(200).json({ success: true, imdbId: null, subtitles: [] });
    }

    const subUrl = type === 'tv'
      ? `https://opensubtitles-v3.strem.io/subtitles/series/${imdbId}:${season || 1}:${episode || 1}.json`
      : `https://opensubtitles-v3.strem.io/subtitles/movie/${imdbId}.json`;

    const subRes = await fetch(subUrl);
    if (!subRes.ok) {
      return res.status(200).json({ success: true, imdbId, subtitles: [] });
    }

    const data = await subRes.json();
    const rawSubs = data.subtitles || [];

    // Group and pick best subtitle per language, while still preserving distinct releases
    const languageMap = new Map();
    const resultList = [];

    rawSubs.forEach(item => {
      const langCode = (item.lang || 'eng').toLowerCase();
      const langName = getLanguageName(langCode);
      const vttUrl = `/api/subtitles?action=vtt&url=${encodeURIComponent(item.url)}`;

      const subEntry = {
        id: item.id,
        lang: langCode,
        languageName: langName,
        label: langName,
        url: vttUrl,
        rawUrl: item.url,
        release: item.subtitleFileName || item.movieReleaseName || ''
      };

      // Keep up to 2 variations per language (e.g. 1st choice, 2nd alternate)
      const existing = languageMap.get(langCode) || [];
      if (existing.length < 2) {
        if (existing.length === 1) {
          subEntry.label = `${langName} (Alternate)`;
        }
        existing.push(subEntry);
        languageMap.set(langCode, existing);
        resultList.push(subEntry);
      }
    });

    // Sort so English is at the top, then alphabetically by languageName
    resultList.sort((a, b) => {
      if (a.lang === 'eng') return -1;
      if (b.lang === 'eng') return 1;
      if (a.lang === 'spa') return -1;
      if (b.lang === 'spa') return 1;
      return a.languageName.localeCompare(b.languageName);
    });

    res.setHeader('Cache-Control', 'public, max-age=7200, stale-while-revalidate=86400');
    return res.status(200).json({
      success: true,
      imdbId,
      subtitles: resultList
    });

  } catch (err) {
    console.error('[API/SUBTITLES ERROR]', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to search OpenSubtitles: ' + err.message
    });
  }
};
