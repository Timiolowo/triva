const { getTmdbApiKey } = require('./_config.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = (req.query.q || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const apiKey = getTmdbApiKey();
    const tmdbUrl = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
    const response = await fetch(tmdbUrl);
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'TMDB API error' });
    }

    const data = await response.json();
    const results = (data.results || [])
      .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
      .slice(0, 12)
      .map(item => ({
        id: item.id,
        type: item.media_type,
        title: item.title || item.name || 'Untitled',
        year: (item.release_date || item.first_air_date || '').substring(0, 4) || 'N/A',
        overview: item.overview ? (item.overview.length > 180 ? item.overview.substring(0, 180) + '...' : item.overview) : 'No description available.',
        rating: item.vote_average ? Number(item.vote_average.toFixed(1)) : null,
        image: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        heroImage: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : (item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null)
      }));

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
    return res.status(200).json({ results });
  } catch (error) {
    if (error.code === 'MISSING_TMDB_API_KEY') {
      return res.status(503).json({ error: 'Search service is not configured' });
    }
    console.error('TMDB search failed', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
