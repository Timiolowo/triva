const { resolveStream } = require('./_tivra.js');

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

  const { type, id, season, episode, title } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Parameter "id" (TMDB ID) is required' });
  }

  const mediaType = type === 'tv' ? 'tv' : 'movie';

  try {
    const result = await resolveStream(mediaType, id, season, episode, title);

    if (!result.success || !result.url) {
      return res.status(404).json({
        success: false,
        error: result.error || 'No stream found from native provider'
      });
    }

    const streamUrl = `/api/proxy?url=${encodeURIComponent(result.url)}`;
    const subtitles = (result.captions || []).map(c => ({
      id: c.id,
      url: `/api/proxy?url=${encodeURIComponent(c.url)}`,
      rawUrl: c.url,
      lang: c.lang || 'en',
      label: c.label || 'English',
      default: !!c.default
    }));

    // Cache stream resolution for 30 minutes
    res.setHeader('Cache-Control', 'public, max-age=1800, stale-while-revalidate=3600');

    return res.status(200).json({
      success: true,
      streamUrl,
      rawUrl: result.url,
      sourceType: result.sourceType || 'hls',
      subtitles
    });
  } catch (err) {
    console.error('[API/SOURCE ERROR]', err.message, err.stack);
    return res.status(500).json({
      success: false,
      error: 'Failed to resolve stream: ' + err.message
    });
  }
};
