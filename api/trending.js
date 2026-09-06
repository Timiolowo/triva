const { getTmdbApiKey } = require('./_config.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = getTmdbApiKey();
    const tmdbUrl = `https://api.themoviedb.org/3/trending/all/day?api_key=${apiKey}&language=en-US`;
    const response = await fetch(tmdbUrl);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'TMDB API error' });
    }

    const data = await response.json();
    const results = (data.results || [])
      .filter(item => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path)
      .slice(0, 20)
      .map(item => ({
        id: item.id,
        type: item.media_type,
        title: item.title || item.name || 'Untitled',
        year: (item.release_date || item.first_air_date || '').substring(0, 4) || 'N/A',
        overview: item.overview || 'No description available.',
        rating: item.vote_average ? Number(item.vote_average.toFixed(1)) : null,
        image: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
        heroImage: `https://image.tmdb.org/t/p/w1280${item.backdrop_path || item.poster_path}`
      }));

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({ results });
  } catch (error) {
    if (error.code === 'MISSING_TMDB_API_KEY') {
      return res.status(503).json({ error: 'Trending service is not configured' });
    }
    console.error('TMDB trending request failed', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
