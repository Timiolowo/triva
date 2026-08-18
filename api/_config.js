function getTmdbApiKey() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    const error = new Error('TMDB_API_KEY is not configured');
    error.code = 'MISSING_TMDB_API_KEY';
    throw error;
  }
  return apiKey;
}

module.exports = { getTmdbApiKey };
