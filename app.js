// ==========================================================================
// Tivra TV - lightweight Smart TV application engine
// Images are limited to the small, hard-coded home catalogue below.
// ==========================================================================

// Application State
const state = {
  currentView: 'home',
  previousView: 'home',
  activeItem: null, // { id, type: 'movie'|'tv', title, year, season, episode, seasonName, episodeName }
  currentServer: 'videasy',
  tvDetails: null,
  activeSeasonNumber: 1,
  trendingRaw: [],
  currentCategoryFilter: 'all',
  heroItem: null,
  focusMemory: {},
  apiCache: {},
  pendingRequests: {},
  playerControlsTimer: null,
  lastSearchQuery: ''
};

const PLAYER_CONTROLS_HIDE_DELAY = 4000;
const MAX_WATCH_HISTORY = 4;

const FEATURED_TITLES = [
  {
    id: 693134, type: 'movie', title: 'Dune: Part Two', year: '2024', rating: 8.5,
    overview: 'Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.',
    image: 'https://image.tmdb.org/t/p/w500/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg',
    heroImage: 'https://image.tmdb.org/t/p/w1280/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg'
  },
  {
    id: 872585, type: 'movie', title: 'Oppenheimer', year: '2023', rating: 8.1,
    overview: 'The story of the physicist whose work changed the world forever.',
    image: 'https://image.tmdb.org/t/p/w500/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg'
  },
  {
    id: 100088, type: 'tv', title: 'The Last of Us', year: '2023', rating: 8.6,
    overview: 'A hardened survivor escorts a teenager across a transformed America.',
    image: 'https://image.tmdb.org/t/p/w500/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg'
  },
  {
    id: 414906, type: 'movie', title: 'The Batman', year: '2022', rating: 7.7,
    overview: 'Batman follows a trail of cryptic clues into Gotham City’s underworld.',
    image: 'https://image.tmdb.org/t/p/w500/b0PlSFdDwbyK0cf5RxwDpaOJQvQ.jpg'
  },
  {
    id: 94997, type: 'tv', title: 'House of the Dragon', year: '2022', rating: 8.4,
    overview: 'The Targaryen dynasty stands at the edge of a devastating civil war.',
    image: 'https://image.tmdb.org/t/p/w500/t9XkeE7HzOsdQcDDDapDYh8Rrmt.jpg'
  }
];

// Available Video Embed Providers
const STREAM_SERVERS = {
  videasy: (type, id, s, e) => 
    `https://player.videasy.net/${type}/${id}${type === 'tv' ? `/${s}/${e}` : ''}`,
  
  vidlink: (type, id, s, e) => 
    `https://vidlink.pro/${type}/${id}${type === 'tv' ? `/${s}/${e}` : ''}?autoplay=true&primaryColor=e50914`,
  
  vidking: (type, id, s, e) => 
    `https://www.vidking.net/embed/${type}/${id}${type === 'tv' ? `/${s}/${e}` : ''}`,
  
  vidsrcto: (type, id, s, e) => 
    `https://vidsrc.mov/embed/${type}/${id}${type === 'tv' ? `/${s}/${e}` : ''}`,
  
  vidnest: (type, id, s, e) => 
    `https://vidnest.fun/${type}/${id}${type === 'tv' ? `/${s}/${e}` : ''}`,
  
  vidrock: (type, id, s, e) => 
    `https://vidrock.net/${type}/${id}${type === 'tv' ? `/${s}/${e}` : ''}`,
  
  vidfast: (type, id, s, e) => 
    `https://vidfast.pro/${type}/${id}${type === 'tv' ? `/${s}/${e}` : ''}?autoPlay=true`,
  
  '2embed': (type, id, s, e) => 
    type === 'tv' ? `https://www.2embed.cc/embed/tv/${id}&s=${s}&e=${e}` : `https://www.2embed.cc/embed/${id}`,
  
  multiembed: (type, id, s, e) => 
    type === 'tv' ? `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}` : `https://multiembed.mov/?video_id=${id}&tmdb=1`
};

// ==========================================
// Initialization & Lifecycle
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  loadWatchHistory();
  loadFeaturedTitles();
  setupPlayerControlsAutoHide();
  setupRemoteNavigation();
  setupRouting();

  // Focus hero play button initially on boot
  setTimeout(() => {
    const heroBtn = document.getElementById('heroPlayBtn');
    if (heroBtn && state.currentView === 'home') {
      heroBtn.focus();
    }
  }, 300);
});

// ==========================================
// View Management
// ==========================================
function switchView(viewName) {
  const activeElement = document.activeElement;
  if (activeElement && activeElement !== document.body) {
    state.focusMemory[state.currentView] = activeElement;
  }

  state.previousView = state.currentView;
  state.currentView = viewName;

  const views = ['homeView', 'resultsView', 'tvShowView', 'playerView'];
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === `${viewName}View`) {
        el.classList.remove('hidden');
        el.classList.add('active');
      } else {
        el.classList.add('hidden');
        el.classList.remove('active');
      }
    }
  });

  setTimeout(() => {
    const remembered = state.focusMemory[viewName];
    if (remembered && document.documentElement.contains(remembered) && remembered.offsetParent !== null) {
      focusAndReveal(remembered);
    } else {
      focusFirstInView(viewName);
    }
  }, 60);
}

function showHomeView(options) {
  if (!options || !options.skipRoute) setBrowserRoute('/home');
  switchView('home');
}

function showResultsOrHome(options) {
  if (document.getElementById('resultsList').children.length > 0) {
    if ((!options || !options.skipRoute) && state.lastSearchQuery) {
      setBrowserRoute(`/search?q=${encodeURIComponent(state.lastSearchQuery)}`);
    }
    switchView('results');
  } else {
    showHomeView(options);
  }
}

function setupRouting() {
  if (!window.history || !window.history.pushState) return;
  window.addEventListener('popstate', applyRouteFromLocation);
  applyRouteFromLocation();
}

function setBrowserRoute(path, item, replace) {
  if (!window.history || !window.history.pushState) return;
  const currentPath = window.location.pathname + window.location.search;
  const method = replace || currentPath === path ? 'replaceState' : 'pushState';
  window.history[method]({ tivra: true, item: item || state.activeItem }, '', path);
}

function applyRouteFromLocation() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const searchQuery = getQueryParam('q');
  let match;

  if (state.currentView === 'player' && path.indexOf('/watch/') !== 0 && path.indexOf('/movie/') !== 0) {
    stopPlayer();
  }

  if (path === '/' || path === '/home') {
    if (path === '/') setBrowserRoute('/home', null, true);
    showHomeView({ skipRoute: true });
    return;
  }

  if (path === '/search' && searchQuery) {
    const input = document.getElementById('searchInput');
    if (input) input.value = searchQuery;
    handleSearchSubmit({ skipRoute: true });
    return;
  }

  match = path.match(/^\/tv\/(\d+)(?:\/[^/]+)?$/);
  if (match) {
    const tvItem = findRouteItem('tv', Number(match[1]));
    state.activeItem = tvItem;
    loadTvShowDetails(tvItem.id, tvItem.title, tvItem.year, { skipRoute: true });
    return;
  }

  match = path.match(/^\/watch\/tv\/(\d+)\/(\d+)\/(\d+)(?:\/[^/]+)?$/);
  if (match) {
    const tvEpisode = findRouteItem('tv', Number(match[1]), Number(match[2]), Number(match[3]));
    startPlayback(tvEpisode, { skipRoute: true });
    return;
  }

  match = path.match(/^\/(?:watch\/)?movie\/(\d+)(?:\/[^/]+)?$/);
  if (match) {
    const movie = findRouteItem('movie', Number(match[1]));
    startPlayback(movie, { skipRoute: true });
    return;
  }

  setBrowserRoute('/home', null, true);
  showHomeView({ skipRoute: true });
}

function getQueryParam(name) {
  const match = window.location.search.match(new RegExp(`[?&]${name}=([^&]*)`));
  if (!match) return '';
  try {
    return decodeURIComponent(match[1].replace(/\+/g, ' '));
  } catch (error) {
    return '';
  }
}

function findRouteItem(type, id, season, episode) {
  const routeState = window.history && window.history.state;
  if (routeState && routeState.item && routeState.item.type === type && Number(routeState.item.id) === id) {
    return Object.assign({}, routeState.item, season ? { season, episode } : {});
  }

  let featured = null;
  for (let index = 0; index < FEATURED_TITLES.length; index += 1) {
    if (FEATURED_TITLES[index].type === type && Number(FEATURED_TITLES[index].id) === id) {
      featured = FEATURED_TITLES[index];
      break;
    }
  }
  if (featured) return Object.assign({}, featured, season ? { season, episode } : {});

  try {
    const historyItems = JSON.parse(localStorage.getItem('litetv_history') || '[]');
    let saved = null;
    for (let index = 0; index < historyItems.length; index += 1) {
      if (historyItems[index].type === type && Number(historyItems[index].id) === id) {
        saved = historyItems[index];
        break;
      }
    }
    if (saved) return Object.assign({}, saved, season ? { season, episode } : {});
  } catch (error) {}

  return {
    id,
    type,
    title: type === 'tv' ? 'TV Series' : 'Movie',
    year: '',
    season,
    episode,
    episodeName: episode ? `Episode ${episode}` : ''
  };
}

function slugifyTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'title';
}

function focusFirstInView(viewName) {
  const container = document.getElementById(`${viewName}View`);
  if (!container) return;

  const focusables = getFocusableElements(container);
  if (focusables.length > 0) {
    focusAndReveal(focusables[0]);
  }
}

function focusSearch() {
  const openSearch = () => {
    const searchForm = document.getElementById('searchForm');
    const trigger = document.getElementById('headerSearchTrigger');
    const searchInput = document.getElementById('searchInput');
    if (searchForm) searchForm.classList.remove('hidden');
    if (trigger) {
      trigger.classList.add('hidden');
      trigger.setAttribute('aria-expanded', 'true');
    }
    if (searchInput) searchInput.focus();
  };

  if (state.currentView !== 'home') {
    showHomeView();
    setTimeout(openSearch, 80);
  } else {
    openSearch();
  }
}

function closeHeaderSearch() {
  const searchForm = document.getElementById('searchForm');
  const trigger = document.getElementById('headerSearchTrigger');
  if (searchForm) searchForm.classList.add('hidden');
  if (trigger) {
    trigger.classList.remove('hidden');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus();
  }
}

function fetchJson(url, cacheKey) {
  if (state.apiCache[cacheKey]) return Promise.resolve(state.apiCache[cacheKey]);
  if (state.pendingRequests[cacheKey]) return state.pendingRequests[cacheKey];

  let timeoutId;
  const timeout = new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Request timed out')), 10000);
  });
  const request = Promise.race([
    fetch(url).then(response => {
      if (!response.ok) throw new Error('Request failed');
      return response.json();
    }),
    timeout
  ]).then(data => {
    clearTimeout(timeoutId);
    state.apiCache[cacheKey] = data;
    delete state.pendingRequests[cacheKey];
    return data;
  }, error => {
    clearTimeout(timeoutId);
    delete state.pendingRequests[cacheKey];
    throw error;
  });

  state.pendingRequests[cacheKey] = request;
  return request;
}

function showRetry(container, message, retry) {
  container.innerHTML = '';
  const panel = document.createElement('div');
  panel.className = 'empty-state';
  const text = document.createElement('span');
  text.textContent = message;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tv-btn tv-btn-primary tv-btn-sm';
  button.textContent = 'Retry';
  button.addEventListener('click', retry);
  panel.appendChild(text);
  panel.appendChild(button);
  container.appendChild(panel);
}

// ==========================================
// API Handlers (TMDb / Backend Routes)
// ==========================================
function loadFeaturedTitles() {
  state.trendingRaw = FEATURED_TITLES;
  setupHeroSpotlight(FEATURED_TITLES[0]);
  renderFilteredTrending();
}

function setupHeroSpotlight(item) {
  state.heroItem = item;
  document.getElementById('heroTitle').textContent = item.title;
  document.getElementById('heroRating').textContent = `★ ${item.rating || '8.5'}`;
  document.getElementById('heroType').textContent = item.type === 'tv' ? 'TV Series' : 'Movie';
  document.getElementById('heroYear').textContent = item.year || '2024';
  
  if (item.overview) {
    document.getElementById('heroOverview').textContent = item.overview;
  }

  const hero = document.getElementById('heroSpotlight');
  if (hero && (item.heroImage || item.image)) {
    hero.style.backgroundImage = `linear-gradient(90deg, rgba(8,8,8,.98) 0%, rgba(8,8,8,.76) 36%, rgba(8,8,8,.12) 73%), linear-gradient(0deg, #080808 0%, transparent 30%), url("${item.heroImage || item.image}")`;
  }

  const playBtn = document.getElementById('heroPlayBtn');
  const infoBtn = document.getElementById('heroInfoBtn');

  playBtn.onclick = () => handleItemSelect(item);
  infoBtn.onclick = focusSearch;
}

function filterCategory(cat) {
  state.currentCategoryFilter = cat;
  const tabs = document.querySelectorAll('.header-nav .nav-tab');
  let activeTab = null;
  const label = cat === 'all' ? 'home' : cat;
  for (let index = 0; index < tabs.length; index += 1) {
    tabs[index].classList.remove('active');
    if (tabs[index].textContent.toLowerCase().indexOf(label) !== -1) activeTab = tabs[index];
  }
  if (activeTab) activeTab.classList.add('active');

  const heading = document.getElementById('sectionHeading');
  if (cat === 'movie') heading.textContent = 'Featured movies';
  else if (cat === 'tv') heading.textContent = 'Featured series';
  else heading.textContent = 'Featured tonight';

  renderFilteredTrending();
}

function renderFilteredTrending() {
  const container = document.getElementById('trendingList');
  if (!container) return;

  let items = state.trendingRaw;
  if (state.currentCategoryFilter === 'movie') {
    items = items.filter(i => i.type === 'movie');
  } else if (state.currentCategoryFilter === 'tv') {
    items = items.filter(i => i.type === 'tv');
  }

  if (items.length > 0) setupHeroSpotlight(items[0]);
  renderFeaturedList(container, items);
}

function renderFeaturedList(container, items) {
  container.innerHTML = '';
  items.slice(1, 5).forEach((item) => {
    const btn = document.createElement('button');
    btn.className = 'featured-card';
    btn.tabIndex = 0;
    btn.setAttribute('aria-label', `${item.title}, ${item.year}. ${item.type === 'tv' ? 'Choose a season' : 'Play now'}`);
    btn.innerHTML = `
      <img class="featured-card-image" src="${item.image}" alt="" loading="lazy" decoding="async">
      <span class="featured-card-copy">
        <span class="featured-card-title">${escapeHtml(item.title)}</span>
        <span class="featured-card-meta">
          <span>${item.year} · ${item.type === 'tv' ? 'Series' : 'Movie'}</span>
          <span class="featured-card-action">${item.type === 'tv' ? 'Seasons →' : 'Play →'}</span>
        </span>
      </span>
    `;
    btn.addEventListener('click', () => handleItemSelect(item));
    container.appendChild(btn);
  });
}

async function handleSearchSubmit(options) {
  const input = document.getElementById('searchInput');
  const query = (input ? input.value : '').trim();
  if (!query) return;
  state.lastSearchQuery = query;
  if (!options || !options.skipRoute) {
    setBrowserRoute(`/search?q=${encodeURIComponent(query)}`);
  }

  const resultsList = document.getElementById('resultsList');
  const heading = document.getElementById('resultsHeading');
  
  heading.textContent = `Search Results for "${query}"`;
  resultsList.innerHTML = '<div class="loading-state">Searching movies and TV shows...</div>';
  switchView('results');

  try {
    const data = await fetchJson(`/api/search?q=${encodeURIComponent(query)}`, `search:${query.toLowerCase()}`);
    
    if (!data.results || data.results.length === 0) {
      resultsList.innerHTML = `<div class="empty-state">No titles found matching "${query}".</div>`;
      return;
    }

    renderMediaList(resultsList, data.results, 'search');
  } catch (err) {
    showRetry(resultsList, 'Search took too long. Check the connection and try again.', handleSearchSubmit);
  }
}

function renderMediaList(container, items, source) {
  container.innerHTML = '';
  items.forEach((item) => {
    const btn = document.createElement('button');
    btn.className = 'tv-item';
    btn.tabIndex = 0;
    btn.setAttribute('data-id', item.id);
    btn.setAttribute('data-type', item.type);
    
    const isTv = item.type === 'tv';
    const badgeClass = isTv ? 'badge-tv' : 'badge-movie';
    const badgeText = isTv ? 'TV SHOW' : 'MOVIE';
    const actionText = isTv ? 'Seasons ►' : 'Play ▶';

    btn.innerHTML = `
      <div class="item-left">
        <span class="item-badge ${badgeClass}">${badgeText}</span>
        <div class="item-title-info">
          <div class="item-title">${escapeHtml(item.title)}</div>
          <div class="item-meta">
            <span>${item.year || ''}</span>
            ${item.rating ? `<span class="rating-star">★ ${item.rating}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="item-action-indicator">${actionText}</div>
    `;

    btn.addEventListener('click', () => {
      handleItemSelect(item);
    });

    container.appendChild(btn);
  });
}

// ==========================================
// Item Selection & Flow Logic
// ==========================================
function handleItemSelect(item) {
  state.activeItem = {
    id: item.id,
    type: item.type,
    title: item.title,
    year: item.year
  };

  if (item.type === 'movie') {
    startPlayback({
      id: item.id,
      type: 'movie',
      title: item.title,
      year: item.year
    });
  } else if (item.type === 'tv') {
    loadTvShowDetails(item.id, item.title, item.year);
  }
}

async function loadTvShowDetails(tvId, title, year, options) {
  if (!options || !options.skipRoute) {
    setBrowserRoute(`/tv/${tvId}/${slugifyTitle(title)}`, state.activeItem);
  }
  switchView('tvShow');
  document.getElementById('tvShowTitle').textContent = title;
  document.getElementById('tvShowMeta').textContent = `${year ? year + ' · ' : ''}TV Series`;
  document.getElementById('tvShowFacts').innerHTML = '';

  const seasonsList = document.getElementById('seasonsList');
  const episodesList = document.getElementById('episodesList');
  
  seasonsList.innerHTML = '<div class="loading-state">Loading seasons...</div>';
  episodesList.innerHTML = '<div class="loading-state">Loading episodes...</div>';

  try {
    const data = await fetchJson(`/api/tv?id=${tvId}`, `tv:${tvId}`);
    state.tvDetails = data;

    document.getElementById('tvShowMeta').textContent = [year, data.status].filter(Boolean).join(' · ');
    renderShowFacts(data);

    renderSeasonsList(data.seasons || []);
    
    // Auto-load Season 1
    if (data.seasons && data.seasons.length > 0) {
      const firstSeason = data.seasons[0].season_number;
      loadEpisodes(tvId, firstSeason);
    }
  } catch (err) {
    showRetry(seasonsList, 'Could not load seasons.', () => loadTvShowDetails(tvId, title, year));
    episodesList.innerHTML = '';
  }
}

function renderSeasonsList(seasons) {
  const container = document.getElementById('seasonsList');
  container.innerHTML = '';

  seasons.forEach((season, idx) => {
    const btn = document.createElement('button');
    btn.className = 'tv-item' + (idx === 0 ? ' active-season' : '');
    btn.tabIndex = 0;
    btn.innerHTML = `
      <div class="item-left">
        <span class="item-badge badge-tv">S${season.season_number}</span>
        <div class="item-title-info">
          <div class="item-title">${escapeHtml(season.name)}</div>
          <div class="item-meta">${season.episode_count} Episodes</div>
        </div>
      </div>
    `;

    btn.addEventListener('click', () => {
      const seasonButtons = document.querySelectorAll('#seasonsList .tv-item');
      for (let index = 0; index < seasonButtons.length; index += 1) {
        seasonButtons[index].classList.remove('active-season');
      }
      btn.classList.add('active-season');
      loadEpisodes(state.activeItem.id, season.season_number);
    });

    container.appendChild(btn);
  });
}

async function loadEpisodes(tvId, seasonNumber) {
  state.activeSeasonNumber = seasonNumber;
  const container = document.getElementById('episodesList');
  const heading = document.getElementById('episodesHeading');
  
  heading.textContent = `Season ${seasonNumber} Episodes`;
  container.innerHTML = '<div class="loading-state">Loading episodes...</div>';

  try {
    const data = await fetchJson(`/api/tv?id=${tvId}&season=${seasonNumber}`, `tv:${tvId}:season:${seasonNumber}`);
    renderEpisodesList(data.episodes || []);
  } catch (err) {
    showRetry(container, 'Could not load this season.', () => loadEpisodes(tvId, seasonNumber));
  }
}

function renderEpisodesList(episodes) {
  const container = document.getElementById('episodesList');
  container.innerHTML = '';

  if (episodes.length === 0) {
    container.innerHTML = '<div class="empty-state">No episodes listed for this season.</div>';
    return;
  }

  episodes.forEach(ep => {
    const btn = document.createElement('button');
    btn.className = 'tv-item';
    btn.tabIndex = 0;
    btn.innerHTML = `
      <div class="item-left">
        <span class="item-badge badge-ep">EP ${ep.episode_number}</span>
        <div class="item-title-info">
          <div class="item-title">${escapeHtml(ep.name)}</div>
          <div class="item-meta">${formatEpisodeMeta(ep)}</div>
        </div>
      </div>
      <div class="item-action-indicator">Play ▶</div>
    `;

    btn.addEventListener('click', () => {
      startPlayback({
        id: state.activeItem.id,
        type: 'tv',
        title: state.activeItem.title,
        year: state.activeItem.year,
        season: state.activeSeasonNumber,
        episode: ep.episode_number,
        episodeName: ep.name
      });
    });

    container.appendChild(btn);
  });
}

function renderShowFacts(data) {
  const container = document.getElementById('tvShowFacts');
  if (!container) return;
  const facts = [
    `${data.total_seasons} seasons`,
    `${data.total_episodes} episodes`
  ];
  if (data.genres && data.genres.length) facts.push(data.genres.join(' · '));
  if (data.rating) facts.push(`★ ${data.rating}`);
  container.innerHTML = facts.map(fact => `<span>${escapeHtml(fact)}</span>`).join('');
}

// ==========================================
// Video Playback & Server Management
// ==========================================
function startPlayback(item, options) {
  state.activeItem = item;
  state.currentServer = 'videasy';
  const serverSelect = document.getElementById('serverSelect');
  if (serverSelect) serverSelect.value = 'videasy';
  if (!options || !options.skipRoute) {
    const route = item.type === 'tv'
      ? `/watch/tv/${item.id}/${item.season}/${item.episode}/${slugifyTitle(item.title)}`
      : `/watch/movie/${item.id}/${slugifyTitle(item.title)}`;
    setBrowserRoute(route, item);
  }
  switchView('player');

  const titleEl = document.getElementById('playerNowPlayingTitle');
  if (item.type === 'tv') {
    titleEl.textContent = `${item.title} - S${item.season} E${item.episode} "${item.episodeName || ''}"`;
  } else {
    titleEl.textContent = `${item.title} (${item.year || ''})`;
  }

  // Save to watch history
  saveToWatchHistory(item);

  // Load iframe stream
  updatePlayerIframe();
  showPlayerControls();

  // Focus exit button by default
  setTimeout(() => {
    const exitButton = document.getElementById('playerExitBtn');
    if (exitButton) exitButton.focus();
  }, 100);
}

function updatePlayerIframe() {
  if (!state.activeItem) return;

  const { type, id, season, episode } = state.activeItem;
  const resolver = STREAM_SERVERS[state.currentServer] || STREAM_SERVERS.videasy;
  const streamUrl = resolver(type, id, season || 1, episode || 1);

  replacePlayerIframe(streamUrl);
}

function replacePlayerIframe(src) {
  const currentIframe = document.getElementById('videoIframe');
  if (!currentIframe || !currentIframe.parentNode) return;

  const nextIframe = document.createElement('iframe');
  nextIframe.id = 'videoIframe';
  nextIframe.title = 'Video player';
  nextIframe.allowFullscreen = true;
  nextIframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
  nextIframe.src = src;

  currentIframe.src = 'about:blank';
  currentIframe.parentNode.replaceChild(nextIframe, currentIframe);
}

function changeServer(newServer) {
  if (STREAM_SERVERS[newServer]) {
    state.currentServer = newServer;
    showToast(`Switched server to ${newServer}`);
    updatePlayerIframe();
    showPlayerControls();
  }
}

function exitPlayer() {
  const item = state.activeItem;
  stopPlayer();

  if (item && item.type === 'tv') {
    setBrowserRoute(`/tv/${item.id}/${slugifyTitle(item.title)}`, item);
    loadTvShowDetails(item.id, item.title, item.year, { skipRoute: true });
  } else if (document.getElementById('resultsList').children.length > 0 && state.lastSearchQuery) {
    setBrowserRoute(`/search?q=${encodeURIComponent(state.lastSearchQuery)}`, item);
    switchView('results');
  } else {
    showHomeView();
  }
}

function stopPlayer() {
  clearTimeout(state.playerControlsTimer);
  state.playerControlsTimer = null;
  const controls = document.getElementById('playerControls');
  const playerView = document.getElementById('playerView');
  if (controls) controls.classList.remove('controls-hidden');
  if (playerView) playerView.classList.remove('controls-hidden');
  replacePlayerIframe('about:blank');
}

function setupPlayerControlsAutoHide() {
  document.addEventListener('keydown', event => {
    if (state.currentView !== 'player') return;

    const controls = document.getElementById('playerControls');
    const wasHidden = controls && controls.classList.contains('controls-hidden');
    const action = getRemoteAction(event);
    showPlayerControls();

    if (wasHidden && (action === 'ok' || (action && action.indexOf('Arrow') === 0))) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const exitButton = document.getElementById('playerExitBtn');
      if (exitButton) exitButton.focus();
    }
  }, true);

  ['mousemove', 'mousedown', 'touchstart'].forEach(eventName => {
    document.addEventListener(eventName, () => {
      if (state.currentView === 'player') showPlayerControls();
    }, false);
  });
}

function showPlayerControls() {
  if (state.currentView !== 'player') return;

  const controls = document.getElementById('playerControls');
  const playerView = document.getElementById('playerView');
  if (!controls) return;
  controls.classList.remove('controls-hidden');
  if (playerView) playerView.classList.remove('controls-hidden');
  clearTimeout(state.playerControlsTimer);
  state.playerControlsTimer = setTimeout(hidePlayerControls, PLAYER_CONTROLS_HIDE_DELAY);
}

function hidePlayerControls() {
  if (state.currentView !== 'player') return;
  const controls = document.getElementById('playerControls');
  const playerView = document.getElementById('playerView');
  if (controls) controls.classList.add('controls-hidden');
  if (playerView) playerView.classList.add('controls-hidden');
}

// ==========================================
// Watch History (localStorage)
// ==========================================
function loadWatchHistory() {
  const section = document.getElementById('continueWatchingSection');
  const container = document.getElementById('continueWatchingList');
  if (!section || !container) return;

  try {
    const raw = localStorage.getItem('litetv_history');
    let list = raw ? JSON.parse(raw) : [];
    if (list.length > MAX_WATCH_HISTORY) {
      list = list.slice(0, MAX_WATCH_HISTORY);
      localStorage.setItem('litetv_history', JSON.stringify(list));
    }
    
    if (list.length === 0) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    container.innerHTML = '';

    list.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'tv-item';
      btn.tabIndex = 0;
      
      const isTv = item.type === 'tv';
      const label = isTv ? `${item.title} (S${item.season}E${item.episode})` : item.title;
      
      btn.innerHTML = `
        <div class="item-left">
          <span class="item-badge ${isTv ? 'badge-tv' : 'badge-movie'}">${isTv ? 'TV' : 'MOVIE'}</span>
          <div class="item-title-info">
            <div class="item-title">${escapeHtml(label)}</div>
            <div class="item-meta">Last watched</div>
          </div>
        </div>
        <div class="item-action-indicator">Resume ▶</div>
      `;

      btn.addEventListener('click', () => {
        startPlayback(item);
      });

      container.appendChild(btn);
    });
  } catch (e) {
    section.classList.add('hidden');
  }
}

function saveToWatchHistory(item) {
  try {
    const raw = localStorage.getItem('litetv_history');
    let list = raw ? JSON.parse(raw) : [];
    
    // Deduplicate
    list = list.filter(i => !(i.id === item.id && i.type === item.type && i.season === item.season && i.episode === item.episode));
    list.unshift({
      id: item.id,
      type: item.type,
      title: item.title,
      year: item.year,
      season: item.season,
      episode: item.episode,
      episodeName: item.episodeName,
      timestamp: Date.now()
    });

    localStorage.setItem('litetv_history', JSON.stringify(list.slice(0, MAX_WATCH_HISTORY)));
    loadWatchHistory();
  } catch (e) {}
}

function clearWatchHistory() {
  localStorage.removeItem('litetv_history');
  loadWatchHistory();
  showToast('Watch history cleared');
}

// ==========================================
// Spatial Smart TV Remote Navigation Engine
// ==========================================
function setupRemoteNavigation() {
  document.addEventListener('keydown', (e) => {
    const action = getRemoteAction(e);
    const searchForm = document.getElementById('searchForm');
    if (action === 'back' && e.target.tagName === 'INPUT' && (e.key === 'Backspace' || e.keyCode === 8)) return;

    if (action === 'back' && searchForm && !searchForm.classList.contains('hidden')) {
      e.preventDefault();
      closeHeaderSearch();
      return;
    }

    if (action === 'back') {
      if (state.currentView === 'player') {
        e.preventDefault();
        exitPlayer();
      } else if (state.currentView === 'tvShow') {
        e.preventDefault();
        showResultsOrHome();
      } else if (state.currentView === 'results') {
        e.preventDefault();
        showHomeView();
      }
      return;
    }

    if (action === 'ok') {
      const active = document.activeElement;
      if (active && active.tagName === 'INPUT') {
        e.preventDefault();
        handleSearchSubmit();
      } else if (active && active.tagName !== 'SELECT' && typeof active.click === 'function') {
        e.preventDefault();
        active.click();
      }
      return;
    }

    if (action && action.indexOf('Arrow') === 0) {
      if (e.target.tagName === 'INPUT') return;
      handleDirectionalNavigation(action, e);
    }
  });
}

function getRemoteAction(event) {
  const code = event.keyCode || event.which;
  if (event.key === 'ArrowLeft' || code === 37) return 'ArrowLeft';
  if (event.key === 'ArrowUp' || code === 38) return 'ArrowUp';
  if (event.key === 'ArrowRight' || code === 39) return 'ArrowRight';
  if (event.key === 'ArrowDown' || code === 40) return 'ArrowDown';
  if (event.key === 'Enter' || event.key === 'OK' || code === 13) return 'ok';
  if (event.key === 'Escape' || event.key === 'Back' || event.key === 'Backspace' || code === 8 || code === 27 || code === 461 || code === 10009) return 'back';
  return '';
}

function getFocusableElements(container) {
  container = container || document;
  return Array.prototype.slice.call(
    container.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]:not([disabled])')
  ).filter(el => {
    return el.offsetParent !== null && !closestElement(el, '.hidden');
  });
}

function handleDirectionalNavigation(direction, event) {
  const activeEl = document.activeElement;
  const currentViewContainer = state.currentView === 'home'
    ? document.getElementById('app')
    : document.getElementById(`${state.currentView}View`);
  if (!currentViewContainer) return;

  const focusables = getFocusableElements(currentViewContainer);
  if (focusables.length === 0) return;

  if (focusables.indexOf(activeEl) === -1) {
    focusAndReveal(focusables[0]);
    event.preventDefault();
    return;
  }

  const currentRect = activeEl.getBoundingClientRect();
  const currentX = currentRect.left + currentRect.width / 2;
  const currentY = currentRect.top + currentRect.height / 2;
  let best = null;
  let bestScore = Infinity;

  focusables.forEach(candidate => {
    if (candidate === activeEl) return;
    const rect = candidate.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const dx = x - currentX;
    const dy = y - currentY;
    const isHorizontal = direction === 'ArrowLeft' || direction === 'ArrowRight';
    const isCorrectDirection = direction === 'ArrowLeft' ? dx < -4
      : direction === 'ArrowRight' ? dx > 4
      : direction === 'ArrowUp' ? dy < -4
      : dy > 4;
    if (!isCorrectDirection) return;

    const primary = Math.abs(isHorizontal ? dx : dy);
    const cross = Math.abs(isHorizontal ? dy : dx);
    const score = primary + cross * 2.2;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  });

  if (best) {
    event.preventDefault();
    focusAndReveal(best);
  }
}

function focusAndReveal(element) {
  if (!element) return;
  element.focus();
  if (typeof element.scrollIntoView === 'function') {
    try {
      element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    } catch (error) {
      element.scrollIntoView(false);
    }
  }
}

function closestElement(element, selector) {
  while (element && element !== document) {
    const matches = element.matches || element.msMatchesSelector || element.webkitMatchesSelector;
    if (matches && matches.call(element, selector)) return element;
    element = element.parentElement;
  }
  return null;
}

function formatEpisodeMeta(episode) {
  const parts = [];
  if (episode.runtime) parts.push(`${episode.runtime} min`);
  if (episode.air_date) {
    const date = new Date(`${episode.air_date}T00:00:00`);
    if (!isNaN(date.getTime())) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      parts.push(`${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`);
    }
  }
  return parts.join(' · ');
}

// ==========================================
// Utilities
// ==========================================
function showToast(msg) {
  const toast = document.getElementById('toastNotification');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
