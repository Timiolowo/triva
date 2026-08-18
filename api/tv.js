const { getTmdbApiKey } = require('./_config.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = req.query.id;
  const season = req.query.season;

  if (!id) {
    return res.status(400).json({ error: 'TV Show ID parameter "id" is required' });
  }

  try {
    const apiKey = getTmdbApiKey();
    if (season !== undefined && season !== '') {
      // Fetch specific season episodes
      const seasonUrl = `https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${apiKey}&language=en-US`;
      const response = await fetch(seasonUrl);

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Season not found' });
      }

      const data = await response.json();
      const episodes = (data.episodes || []).map(ep => ({
        episode_number: ep.episode_number,
        name: ep.name || `Episode ${ep.episode_number}`,
        air_date: ep.air_date || '',
        runtime: ep.runtime || null
      }));

      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
      return res.status(200).json({
        id: Number(id),
        season_number: Number(season),
        name: data.name || `Season ${season}`,
        episodes
      });
    } else {
      // Fetch TV show details to get list of seasons
      const showUrl = `https://api.themoviedb.org/3/tv/${id}?api_key=${apiKey}&language=en-US`;
      const response = await fetch(showUrl);

      if (!response.ok) {
        return res.status(response.status).json({ error: 'TV show not found' });
      }

      const data = await response.json();
      const seasons = (data.seasons || [])
        .filter(s => s.season_number > 0) // Exclude specials by default for cleanliness unless needed
        .map(s => ({
          season_number: s.season_number,
          name: s.name || `Season ${s.season_number}`,
          episode_count: s.episode_count,
          year: s.air_date ? s.air_date.substring(0, 4) : ''
        }));

      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
      return res.status(200).json({
        id: data.id,
        title: data.name,
        total_seasons: data.number_of_seasons,
        total_episodes: data.number_of_episodes,
        status: data.status || '',
        genres: (data.genres || []).slice(0, 2).map(genre => genre.name),
        rating: data.vote_average ? Number(data.vote_average.toFixed(1)) : null,
        seasons
      });
    }
  } catch (error) {
    if (error.code === 'MISSING_TMDB_API_KEY') {
      return res.status(503).json({ error: 'TV metadata service is not configured' });
    }
    console.error('TMDB TV request failed', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
