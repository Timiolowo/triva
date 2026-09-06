// ==========================================================================
// Tivra TV - lightweight Smart TV application engine
// The home catalogue refreshes from TMDB daily, with a small offline fallback.
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
  lastSearchQuery: '',
  homeLoading: true,
  playerMode: 'native',
  hlsInstance: null,
  nativeSubtitles: [],
  // Real Player State
  currentQualityLevel: -1, // -1 is Auto
  availableLevels: [],
  subtitlesList: [],
  activeSubtitleId: 'off',
  subtitleOffset: 0,
  subtitleSize: 'normal',
  subtitleWeight: 'normal',
  availableAudioTracks: [],
  activeAudioTrackIndex: 0,
  playbackSpeed: 1.0,
  videoFit: 'contain',
  drawerSubmenu: null,
  drawerOpen: false,
  isRotated: false,
  clockTimer: null,
  actionFeedbackTimer: null,
  stallWatchdogTimer: null
};

const SVG_ICONS = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
  rewind10: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5V2L8 6l4 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/><text x="12" y="15.5" font-size="7.5" font-weight="900" font-family="sans-serif" text-anchor="middle" fill="currentColor" stroke="none">10</text></svg>',
  forward10: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5V2l4 4-4 4V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z"/><text x="12" y="15.5" font-size="7.5" font-weight="900" font-family="sans-serif" text-anchor="middle" fill="currentColor" stroke="none">10</text></svg>',
  quality: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>',
  subtitles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 15h4M15 15h2M7 11h2M13 11h4"/></svg>',
  audio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
  speed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  fit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
};

const PLAYER_CONTROLS_HIDE_DELAY = 4000;
const MAX_WATCH_HISTORY = 4;
const SUB_PREFS_KEY = 'tivra_sub_prefs';

function saveSubtitlePreferences(prefs) {
  try {
    const current = loadSubtitlePreferences();
    const updated = { ...current, ...prefs };
    localStorage.setItem(SUB_PREFS_KEY, JSON.stringify(updated));
  } catch (e) {}
}

function loadSubtitlePreferences() {
  try {
    const raw = localStorage.getItem(SUB_PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    preferredLang: 'en',
    size: 'normal',
    weight: 'normal'
  };
}

function getSavedPlaybackTime(item) {
  if (!item) return 0;
  try {
    const raw = localStorage.getItem('litetv_history');
    if (!raw) return 0;
    const list = JSON.parse(raw);
    const match = list.find(i => i.id === item.id && i.type === item.type && (item.type !== 'tv' || (String(i.season) === String(item.season) && String(i.episode) === String(item.episode))));
    if (match && match.currentTime > 10 && (!match.duration || match.currentTime < match.duration - 45)) {
      return match.currentTime;
    }
  } catch (e) {}
  return 0;
}

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
  const subPrefs = loadSubtitlePreferences();
  setSubtitleSize(subPrefs.size || 'normal', true);
  setSubtitleWeight(subPrefs.weight || 'normal', true);

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

  if (viewName === 'home') {
    loadWatchHistory();
  }

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
    const header = document.querySelector('.app-header');
    const searchForm = document.getElementById('searchForm');
    const trigger = document.getElementById('headerSearchTrigger');
    const searchInput = document.getElementById('searchInput');
    if (searchForm) searchForm.classList.remove('hidden');
    requestAnimationFrame(() => {
      if (header) header.classList.add('search-open');
      if (searchForm) searchForm.setAttribute('aria-hidden', 'false');
    });
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'true');
    }
    if (searchInput) setTimeout(() => searchInput.focus(), 80);
  };

  if (state.currentView !== 'home') {
    showHomeView();
    setTimeout(openSearch, 80);
  } else {
    openSearch();
  }
}

function closeHeaderSearch() {
  const header = document.querySelector('.app-header');
  const searchForm = document.getElementById('searchForm');
  const trigger = document.getElementById('headerSearchTrigger');
  if (header) header.classList.remove('search-open');
  if (searchForm) {
    searchForm.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      if (!header || !header.classList.contains('search-open')) searchForm.classList.add('hidden');
    }, 180);
  }
  if (trigger) {
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
async function loadFeaturedTitles() {
  try {
    const data = await fetchJson('/api/trending', 'trending:day');
    if (!data.results || data.results.length === 0) throw new Error('No daily trends returned');
    state.trendingRaw = data.results.map((item, index) => Object.assign({ rank: index + 1 }, item));
  } catch (error) {
    state.trendingRaw = FEATURED_TITLES.map((item, index) => Object.assign({ rank: index + 1 }, item));
    showToast('Showing saved picks — daily trends are unavailable');
  }

  state.homeLoading = false;
  renderFilteredTrending();
}

function setupHeroSpotlight(item) {
  state.heroItem = item;
  document.getElementById('heroTitle').textContent = item.title;
  document.getElementById('heroRating').textContent = item.rating ? `★ ${item.rating}` : 'Not rated';
  document.getElementById('heroType').textContent = item.type === 'tv' ? 'TV Series' : 'Movie';
  document.getElementById('heroYear').textContent = item.year || 'N/A';
  
  if (item.overview) {
    document.getElementById('heroOverview').textContent = item.overview;
  }

  const hero = document.getElementById('heroSpotlight');
  if (hero) {
    hero.classList.remove('hero-loading');
    hero.setAttribute('aria-busy', 'false');
  }
  if (hero && (item.heroImage || item.image)) {
    hero.style.backgroundImage = `linear-gradient(90deg, rgba(8,8,8,.98) 0%, rgba(8,8,8,.76) 36%, rgba(8,8,8,.12) 73%), linear-gradient(0deg, #080808 0%, transparent 30%), url("${item.heroImage || item.image}")`;
  }

  const playBtn = document.getElementById('heroPlayBtn');
  const infoBtn = document.getElementById('heroInfoBtn');

  playBtn.disabled = false;
  infoBtn.disabled = false;
  playBtn.onclick = () => handleItemSelect(item, { playNow: true });
  infoBtn.onclick = () => showMediaInfo(item);
}

function showMediaInfo(item) {
  const overlay = document.getElementById('mediaInfoOverlay');
  const action = document.getElementById('mediaInfoAction');
  if (!overlay || !action) return;

  const card = overlay.querySelector('.media-info-card');
  const artwork = item.heroImage || item.backdrop || item.image || item.poster;
  if (card && artwork) {
    card.style.setProperty('--media-info-artwork', `url(${JSON.stringify(String(artwork))})`);
    card.classList.add('has-artwork');
  } else if (card) {
    card.style.removeProperty('--media-info-artwork');
    card.classList.remove('has-artwork');
  }

  document.getElementById('mediaInfoTitle').textContent = item.title;
  document.getElementById('mediaInfoMeta').textContent = [
    item.rating ? `★ ${item.rating}` : 'Not rated',
    item.year || 'N/A',
    item.type === 'tv' ? 'TV Series' : 'Movie'
  ].join(' · ');
  document.getElementById('mediaInfoOverview').textContent = item.overview || 'No description available.';
  action.textContent = item.type === 'tv' ? 'Browse seasons' : 'Play now';
  action.onclick = () => {
    closeMediaInfo(false);
    handleItemSelect(item, { playNow: item.type === 'movie' });
  };

  document.body.classList.add('modal-open');
  overlay.classList.remove('hidden');
  document.getElementById('mediaInfoClose').focus();
}

function closeMediaInfo(restoreFocus) {
  const overlay = document.getElementById('mediaInfoOverlay');
  if (overlay) overlay.classList.add('hidden');
  document.body.classList.remove('modal-open');
  if (restoreFocus !== false) {
    const infoBtn = document.getElementById('heroInfoBtn');
    if (infoBtn) infoBtn.focus();
  }
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
  if (cat === 'movie') heading.textContent = 'Trending movies today';
  else if (cat === 'tv') heading.textContent = 'Trending series today';
  else heading.textContent = 'Trending today';

  renderFilteredTrending();
}

function renderFilteredTrending() {
  const container = document.getElementById('trendingList');
  if (!container) return;
  if (state.homeLoading) return;

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
  container.setAttribute('aria-busy', 'false');
  items.slice(1, 9).forEach((item, index) => {
    const rank = item.rank || index + 2;
    const btn = document.createElement('button');
    btn.className = 'featured-card';
    btn.tabIndex = 0;
    btn.setAttribute('aria-label', `${item.title}, ${item.year}. ${item.type === 'tv' ? 'Choose a season' : 'View details'}`);
    btn.innerHTML = `
      <img class="featured-card-image" src="${item.image}" alt="" loading="lazy" decoding="async">
      <span class="featured-card-rank">#${rank}</span>
      ${item.rating ? `<span class="featured-card-rating">★ ${item.rating}</span>` : ''}
      <span class="featured-card-copy">
        <span class="featured-card-title">${escapeHtml(item.title)}</span>
        <span class="featured-card-meta">
          <span>${item.year} · ${item.type === 'tv' ? 'Series' : 'Movie'}</span>
          <span class="featured-card-action">${item.type === 'tv' ? 'Seasons →' : 'Details →'}</span>
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
    const actionText = isTv ? 'Seasons ►' : 'Details ›';

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
function handleItemSelect(item, options) {
  state.activeItem = {
    id: item.id,
    type: item.type,
    title: item.title,
    year: item.year,
    image: item.image || item.poster || null,
    heroImage: item.heroImage || item.backdrop || item.image || null
  };

  if (item.type === 'movie') {
    if (options && options.playNow) {
      startPlayback(state.activeItem);
    } else {
      showMediaInfo(item);
    }
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
  applySeriesArtwork(state.activeItem && state.activeItem.heroImage);

  const seasonsList = document.getElementById('seasonsList');
  const episodesList = document.getElementById('episodesList');
  
  seasonsList.innerHTML = '<div class="loading-state">Loading seasons...</div>';
  episodesList.innerHTML = '<div class="loading-state">Loading episodes...</div>';

  try {
    const data = await fetchJson(`/api/tv?id=${tvId}`, `tv:${tvId}`);
    state.tvDetails = data;
    if (state.activeItem) {
      state.activeItem.image = state.activeItem.image || data.image;
      state.activeItem.heroImage = state.activeItem.heroImage || data.heroImage;
    }
    applySeriesArtwork(state.activeItem && state.activeItem.heroImage);

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

function applySeriesArtwork(image) {
  const header = document.querySelector('.series-view-header');
  if (!header) return;

  if (image) {
    header.style.setProperty('--series-backdrop', `url(${JSON.stringify(String(image))})`);
    header.classList.add('has-artwork');
  } else {
    header.style.removeProperty('--series-backdrop');
    header.classList.remove('has-artwork');
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
        episodeName: ep.name,
        image: state.activeItem.image,
        heroImage: state.activeItem.heroImage
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
// ==========================================
// Video Playback & Hybrid Server Management
// ==========================================
function startPlayback(item, options) {
  state.activeItem = item;
  state.playerMode = 'native';
  state.currentQualityLevel = -1;
  state.availableLevels = [];
  state.activeSubtitleId = 'off';
  state.subtitleOffset = 0;
  state.playbackSpeed = 1.0;
  state.videoFit = 'contain';
  state.drawerOpen = false;
  state.drawerSubmenu = null;

  const serverSelect = document.getElementById('serverSelect');
  if (serverSelect) serverSelect.value = 'native';

  if (!options || !options.skipRoute) {
    const route = item.type === 'tv'
      ? `/watch/tv/${item.id}/${item.season}/${item.episode}/${slugifyTitle(item.title)}`
      : `/watch/movie/${item.id}/${slugifyTitle(item.title)}`;
    setBrowserRoute(route, item);
  }
  switchView('player');

  // Title and Episode tag
  const titleEl = document.getElementById('playerNowPlayingTitle');
  const epTagEl = document.getElementById('playerEpisodeTag');
  const nextEpBtn = document.getElementById('playerNextEpBtn');

  if (item.type === 'tv') {
    if (titleEl) titleEl.textContent = item.title;
    if (epTagEl) {
      epTagEl.textContent = `S${item.season}:E${item.episode}${item.episodeName ? ` "${item.episodeName}"` : ''}`;
      epTagEl.classList.remove('hidden');
    }
    const isMobile = window.matchMedia('(max-width: 960px)').matches || window.matchMedia('(pointer: coarse)').matches;
    if (nextEpBtn) {
      if (isMobile) {
        nextEpBtn.classList.add('hidden');
      } else {
        nextEpBtn.classList.remove('hidden');
      }
    }
  } else {
    if (titleEl) titleEl.textContent = `${item.title} (${item.year || ''})`;
    if (epTagEl) epTagEl.classList.add('hidden');
    if (nextEpBtn) nextEpBtn.classList.add('hidden');
  }

  // Start TV clock
  startPlayerClock();

  // Reset badges and menu subtext
  const qualityBadge = document.getElementById('playerQualityBadge');
  if (qualityBadge) qualityBadge.textContent = 'AUTO';
  const menuQuality = document.getElementById('menuActiveQuality');
  if (menuQuality) menuQuality.textContent = 'Auto';
  const menuSub = document.getElementById('menuActiveSubtitle');
  if (menuSub) menuSub.textContent = 'Off';
  const menuAud = document.getElementById('menuActiveAudio');
  if (menuAud) menuAud.textContent = 'Default';
  const menuSpd = document.getElementById('menuActiveSpeed');
  if (menuSpd) menuSpd.textContent = '1.0x (Normal)';
  const menuFit = document.getElementById('menuActiveFit');
  if (menuFit) menuFit.textContent = 'Fit (Original)';

  // Save to watch history
  saveToWatchHistory(item);

  // Close settings drawer
  closeSettingsDrawer();

  // Start native ad-free playback
  loadNativeStream(item);
  showPlayerControls();

  setTimeout(() => {
    const exitButton = document.getElementById('playerExitBtn');
    if (exitButton) exitButton.focus();
  }, 100);
}

function startPlayerClock() {
  updatePlayerClock();
  clearInterval(state.clockTimer);
  state.clockTimer = setInterval(updatePlayerClock, 10000);
}

function updatePlayerClock() {
  const clockEl = document.getElementById('playerClock');
  if (!clockEl) return;
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  clockEl.textContent = timeStr;
}

function showPlayerAction(icon, text) {
  const badge = document.getElementById('playerActionFeedback');
  const iconEl = document.getElementById('playerActionIcon');
  const textEl = document.getElementById('playerActionText');
  if (!badge) return;

  if (iconEl) {
    if (typeof icon === 'string' && icon.trim().startsWith('<svg')) {
      iconEl.innerHTML = icon;
    } else if (SVG_ICONS[icon]) {
      iconEl.innerHTML = SVG_ICONS[icon];
    } else {
      iconEl.textContent = icon;
    }
  }
  if (textEl) textEl.textContent = text || '';

  badge.classList.remove('hidden');
  void badge.offsetWidth;
  badge.classList.add('active');

  clearTimeout(state.actionFeedbackTimer);
  state.actionFeedbackTimer = setTimeout(() => {
    badge.classList.remove('active');
    setTimeout(() => {
      if (!badge.classList.contains('active')) {
        badge.classList.add('hidden');
      }
    }, 250);
  }, 850);
}

function ensureHlsLibrary() {
  if (window.Hls) return Promise.resolve();
  if (state.hlsLibraryPromise) return state.hlsLibraryPromise;

  state.hlsLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js';
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Unable to load HLS playback support'));
    document.head.appendChild(script);
  });

  return state.hlsLibraryPromise;
}

async function loadNativeStream(item) {
  const loadingOverlay = document.getElementById('playerLoadingOverlay');
  const loadingText = document.getElementById('playerLoadingText');
  const nativeContainer = document.getElementById('nativePlayerContainer');
  const iframeWrapper = document.getElementById('iframePlayerWrapper');
  const video = document.getElementById('nativeVideoPlayer');

  if (nativeContainer) nativeContainer.classList.remove('hidden');
  if (iframeWrapper) iframeWrapper.classList.add('hidden');
  if (loadingOverlay) loadingOverlay.classList.remove('hidden');
  if (loadingText) loadingText.textContent = 'Connecting ad-free stream…';

  // Clean up any existing HLS instance & tracks
  state.availableLevels = [];
  state.availableAudioTracks = [];
  state.currentQualityLevel = -1;
  state.activeAudioTrackIndex = 0;
  if (state.hlsInstance) {
    state.hlsInstance.destroy();
    state.hlsInstance = null;
  }
  if (video) {
    video.pause();
    while (video.firstChild) {
      video.removeChild(video.firstChild);
    }
  }

  // Asynchronously query OpenSubtitles in background
  fetchOpenSubtitles(item);

  const { type, id, season, episode, title } = item;
  const endpoint = `/api/source?type=${type}&id=${id}&season=${season || 1}&episode=${episode || 1}&title=${encodeURIComponent(title || '')}`;

  try {
    const res = await fetch(endpoint);
    const data = await res.json();

    if (!data.success || !data.streamUrl) {
      throw new Error(data.error || 'Ad-free stream unavailable');
    }

    if (loadingText) loadingText.textContent = 'Buffering ad-free stream…';

    const onMediaReady = () => {
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
    };
    video.addEventListener('playing', onMediaReady, { once: true });
    video.addEventListener('canplay', onMediaReady, { once: true });

    // Merge any upstream native captions
    if (data.subtitles && data.subtitles.length > 0) {
      state.nativeSubtitles = data.subtitles;
      renderSubtitlesDrawer();
    }

    // Always load HLS.js for quality/audio track controls.
    // On iOS Safari (no MSE), HLS.js won't be supported so we fall back to native Apple HLS.
    await ensureHlsLibrary();

    // Initialize HLS.js or native Apple HLS
    if (window.Hls && window.Hls.isSupported()) {
      const hls = new window.Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60
      });
      state.hlsInstance = hls;
      hls.loadSource(data.streamUrl);
      hls.attachMedia(video);

      hls.on(window.Hls.Events.MANIFEST_PARSED, (event, hlsData) => {
        setupHlsLevels(hls.levels);
        setupHlsAudioTracks(hls.audioTracks);
        video.play().catch(() => {});
      });

      hls.on(window.Hls.Events.LEVELS_UPDATED, (event, hlsData) => {
        setupHlsLevels(hlsData.levels || hls.levels);
      });

      hls.on(window.Hls.Events.LEVEL_SWITCHED, (event, hlsData) => {
        const levelIdx = hlsData.level;
        const level = hls.levels[levelIdx];
        const height = level ? level.height : null;
        const qualityBadge = document.getElementById('playerQualityBadge');
        if (qualityBadge && height) {
          qualityBadge.textContent = (state.currentQualityLevel === -1)
            ? `AUTO (${height}p)`
            : `${height}p`;
        }
      });

      hls.on(window.Hls.Events.AUDIO_TRACKS_UPDATED, (event, hlsData) => {
        setupHlsAudioTracks(hls.audioTracks);
      });

      hls.on(window.Hls.Events.AUDIO_TRACK_SWITCHED, (event, hlsData) => {
        updateAudioMenuChecks(hlsData.id);
      });

      hls.on(window.Hls.Events.ERROR, (event, hlsErr) => {
        const bufferingEl = document.getElementById('playerBufferingIndicator');
        if (bufferingEl) bufferingEl.classList.remove('hidden');

        if (hlsErr.fatal) {
          console.warn('[HLS Fatal Error]', hlsErr.type, hlsErr.details);
          switch (hlsErr.type) {
            case window.Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('[HLS Network Error] Retrying stream load...');
              hls.startLoad();
              break;
            case window.Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('[HLS Media Error] Recovering stream media...');
              hls.recoverMediaError();
              break;
            default:
              if (bufferingEl) bufferingEl.classList.add('hidden');
              hls.destroy();
              state.hlsInstance = null;
              triggerStreamFallback('Playback error encountered on ad-free stream.');
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = data.streamUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => {});
      }, { once: true });
    } else {
      throw new Error('HLS playback is not supported on this browser');
    }

    bindVideoEvents(video);

  } catch (err) {
    console.warn('[Native playback failed]', err.message);
    if (loadingText) loadingText.textContent = 'Retrying ad-free stream…';
    triggerStreamFallback('Stream issue encountered');
    if (!state.nativeRetryTimer) {
      state.nativeRetryTimer = setTimeout(() => {
        state.nativeRetryTimer = null;
        if (state.playerMode === 'native' && state.activeItem && state.activeItem.id === item.id) {
          loadNativeStream(state.activeItem);
        }
      }, 4000);
    }
  }
}

function bindVideoEvents(video) {
  const playPauseBtn = document.getElementById('playerPlayPauseBtn');
  const progressFill = document.getElementById('playerProgressFill');
  const bufferFill = document.getElementById('playerBufferFill');
  const thumb = document.getElementById('playerProgressThumb');
  const currentTimeEl = document.getElementById('playerCurrentTime');
  const durationEl = document.getElementById('playerDuration');
  const remainingEl = document.getElementById('playerRemainingTime');
  const bufferingEl = document.getElementById('playerBufferingIndicator');
  const loadingOverlay = document.getElementById('playerLoadingOverlay');

  const showBuffering = () => {
    if (bufferingEl) bufferingEl.classList.remove('hidden');
  };
  const hideBuffering = () => {
    if (bufferingEl) bufferingEl.classList.add('hidden');
  };

  let lastPlayhead = -1;
  let lastProgressTimestamp = performance.now();
  let lastSavedTimeUpdate = 0;
  let resumeApplied = false;
  let lastTapTime = 0;
  let lastTapSide = '';
  let lastTouchSeekTime = 0;

  video.ontouchend = event => {
    const touch = event.changedTouches && event.changedTouches[0];
    if (!touch) return;

    const rect = video.getBoundingClientRect();
    const side = touch.clientX < rect.left + rect.width / 2 ? 'left' : 'right';
    const now = Date.now();

    if (side === lastTapSide && now - lastTapTime < 350) {
      event.preventDefault();
      lastTapTime = 0;
      lastTapSide = '';
      lastTouchSeekTime = now;
      seekRelative(side === 'left' ? -10 : 10);
      showPlayerControls();
      return;
    }

    lastTapTime = now;
    lastTapSide = side;
  };

  video.ondblclick = event => {
    if (Date.now() - lastTouchSeekTime < 700) return;
    const rect = video.getBoundingClientRect();
    seekRelative(event.clientX < rect.left + rect.width / 2 ? -10 : 10);
    showPlayerControls();
  };

  const tryApplyResume = () => {
    if (resumeApplied) return;
    const saved = getSavedPlaybackTime(state.activeItem);
    if (saved > 10 && video.duration > 0 && saved < video.duration - 45) {
      resumeApplied = true;
      video.currentTime = saved;
      showToast(`Resumed from ${formatTime(saved)}`);
    }
  };

  video.addEventListener('loadedmetadata', tryApplyResume);
  video.addEventListener('canplay', tryApplyResume);
  video.addEventListener('durationchange', tryApplyResume);

  const checkPlaybackHealth = () => {
    if (!video || video.paused || video.ended) {
      return;
    }
    const now = performance.now();
    const cur = video.currentTime;
    
    // Network stall detection:
    const isReadyStalled = video.readyState < 3;
    const isTimeStalled = Math.abs(cur - lastPlayhead) < 0.02 && (now - lastProgressTimestamp > 400);

    if (isReadyStalled || isTimeStalled) {
      showBuffering();
    } else {
      lastPlayhead = cur;
      lastProgressTimestamp = now;
      hideBuffering();
    }
  };

  clearInterval(state.stallWatchdogTimer);
  state.stallWatchdogTimer = setInterval(checkPlaybackHealth, 250);

  video.onwaiting = () => showBuffering();
  video.onseeking = () => showBuffering();
  video.onstalled = () => showBuffering();

  video.onplaying = () => {
    hideBuffering();
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
    if (playPauseBtn) playPauseBtn.innerHTML = SVG_ICONS.pause;
    lastPlayhead = video.currentTime;
    lastProgressTimestamp = performance.now();
  };

  video.oncanplay = () => {
    if (video.currentTime > 0 && video.readyState >= 3) {
      hideBuffering();
    }
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
  };

  video.onseeked = () => {
    if (video.readyState >= 3) {
      hideBuffering();
    }
  };

  video.onloadeddata = () => {
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
  };

  window.addEventListener('offline', () => {
    showBuffering();
  });
  window.addEventListener('online', () => {
    if (state.hlsInstance) state.hlsInstance.startLoad();
  });

  video.onplay = () => {
    if (playPauseBtn) playPauseBtn.innerHTML = SVG_ICONS.pause;
    lastPlayhead = video.currentTime;
    lastProgressTimestamp = performance.now();
    showPlayerControls();
  };

  video.onpause = () => {
    if (playPauseBtn) playPauseBtn.innerHTML = SVG_ICONS.play;
    hideBuffering();
    showPlayerControls();
    if (state.activeItem && video.duration > 0) {
      saveToWatchHistory(state.activeItem, video.currentTime, video.duration);
    }
  };

  video.ontimeupdate = () => {
    if (!resumeApplied && video.duration > 0) {
      tryApplyResume();
    }
    const cur = video.currentTime || 0;
    const dur = video.duration || 0;
    if (currentTimeEl) currentTimeEl.textContent = formatTime(cur);
    if (durationEl) durationEl.textContent = formatTime(dur);
    if (remainingEl && dur > 0) {
      const rem = Math.max(0, dur - cur);
      remainingEl.textContent = `-${formatTime(rem)}`;
    }
    if (dur > 0) {
      const pct = (cur / dur) * 100;
      if (progressFill) progressFill.style.width = `${pct}%`;
      if (thumb) thumb.style.left = `${pct}%`;
    }

    // Update buffer fill
    if (video.buffered && video.buffered.length > 0 && dur > 0 && bufferFill) {
      try {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const bufPct = Math.min(100, (bufferedEnd / dur) * 100);
        bufferFill.style.width = `${bufPct}%`;
      } catch (e) {}
    }

    // Periodically save progress to history
    const now = Date.now();
    if (state.activeItem && dur > 10 && now - lastSavedTimeUpdate > 5000) {
      lastSavedTimeUpdate = now;
      saveToWatchHistory(state.activeItem, cur, dur);
    }
  };

  video.onended = () => {
    if (playPauseBtn) playPauseBtn.innerHTML = SVG_ICONS.play;
    showPlayerControls();
    if (state.activeItem && video.duration > 0) {
      saveToWatchHistory(state.activeItem, video.duration, video.duration);
    }
    if (state.activeItem && state.activeItem.type === 'tv') {
      playNextEpisode();
    }
  };

  video.onerror = () => {
    if (state.playerMode === 'native') {
      triggerStreamFallback('Playback error encountered on ad-free stream.');
    }
  };
}

// ==========================================
// Quality Level Management
// ==========================================
function setupHlsLevels(levels) {
  if (!levels || levels.length === 0) return;

  state.availableLevels = levels.map((lvl, index) => {
    const height = lvl.height || 0;
    const bitrate = lvl.bitrate ? `${(lvl.bitrate / 1000000).toFixed(1)} Mbps` : '';
    let label = height >= 2160 ? '4K UHD (2160p)'
      : height >= 1080 ? 'Full HD (1080p)'
      : height >= 720 ? 'HD (720p)'
      : height >= 480 ? 'SD (480p)'
      : `${height}p`;
    return { index, height, bitrate, label };
  });

  renderQualityDrawer();
}

function renderQualityDrawer() {
  const container = document.getElementById('drawerQualityList');
  if (!container) return;
  container.innerHTML = '';

  // Case 1: Embed Player Mode (backup iframe)
  if (state.playerMode === 'embed') {
    container.innerHTML = `
      <div class="drawer-notice-box">
        <div class="drawer-notice-title">Controlled on Player</div>
        <p class="drawer-notice-desc">Quality for this backup stream is managed directly on the video screen. Tap the gear icon (⚙) on the video player to select your resolution.</p>
        <button type="button" class="tv-btn tv-btn-secondary tv-btn-sm" style="margin-top: 12px; width: 100%;" onclick="switchToNativeMode()">
          Try Ad-Free Stream
        </button>
      </div>
    `;
    return;
  }

  // Case 2: Pure Apple Native Safari (iOS where Hls is not supported)
  const isAppleOnly = !window.Hls?.isSupported() && !!document.getElementById('nativeVideoPlayer')?.canPlayType('application/vnd.apple.mpegurl');
  if (isAppleOnly && (!state.availableLevels || state.availableLevels.length === 0)) {
    container.innerHTML = `
      <div class="choice-row active" style="cursor: default;">
        <div>
          <span>Auto (Adaptive)</span>
          <span class="choice-meta">Managed by Apple iOS Player</span>
        </div>
        <span class="choice-check">${SVG_ICONS.check}</span>
      </div>
      <p class="drawer-notice-desc" style="margin-top: 10px; padding: 0 4px;">
        Apple WebKit automatically optimizes video stream quality based on your network connection.
      </p>
    `;
    return;
  }

  // Case 3: Specific levels available from HLS.js
  if (state.availableLevels && state.availableLevels.length > 0) {
    // 1. Auto Option
    const autoBtn = document.createElement('button');
    autoBtn.type = 'button';
    autoBtn.className = `choice-row ${state.currentQualityLevel === -1 ? 'active' : ''}`;
    autoBtn.dataset.levelIndex = '-1';
    autoBtn.tabIndex = 0;
    autoBtn.innerHTML = `
      <div>
        <span>Auto</span>
        <span class="choice-meta">(Adaptive Bitrate)</span>
      </div>
      <span class="choice-check ${state.currentQualityLevel === -1 ? '' : 'hidden'}">${SVG_ICONS.check}</span>
    `;
    autoBtn.onclick = () => setQualityLevel(-1);
    container.appendChild(autoBtn);

    // 2. Specific resolutions (deduplicated by height, descending)
    const seenHeights = new Set();
    const sortedLevels = [...state.availableLevels].sort((a, b) => b.height - a.height);

    sortedLevels.forEach(lvl => {
      if (seenHeights.has(lvl.height)) return;
      seenHeights.add(lvl.height);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `choice-row ${state.currentQualityLevel === lvl.index ? 'active' : ''}`;
      btn.dataset.levelIndex = String(lvl.index);
      btn.tabIndex = 0;
      btn.innerHTML = `
        <div>
          <span>${escapeHtml(lvl.label)}</span>
          ${lvl.bitrate ? `<span class="choice-meta">${escapeHtml(lvl.bitrate)}</span>` : ''}
        </div>
        <span class="choice-check ${state.currentQualityLevel === lvl.index ? '' : 'hidden'}">${SVG_ICONS.check}</span>
      `;
      btn.onclick = () => setQualityLevel(lvl.index);
      container.appendChild(btn);
    });
    return;
  }

  // Case 4: Native mode with levels still detecting
  container.innerHTML = `
    <div class="choice-row active" style="cursor: default;">
      <div>
        <span>Auto</span>
        <span class="choice-meta">(Optimizing stream)</span>
      </div>
      <span class="choice-check">${SVG_ICONS.check}</span>
    </div>
    <p class="drawer-notice-desc" style="margin-top: 10px; padding: 0 4px;">
      Detecting stream resolutions…
    </p>
  `;
}

function setQualityLevel(levelIdx) {
  state.currentQualityLevel = levelIdx;
  if (state.hlsInstance) {
    state.hlsInstance.currentLevel = levelIdx;
  }

  const menuQuality = document.getElementById('menuActiveQuality');
  const badge = document.getElementById('playerQualityBadge');

  if (levelIdx === -1) {
    if (menuQuality) menuQuality.textContent = 'Auto';
    if (badge) badge.textContent = 'AUTO';
    showPlayerAction(SVG_ICONS.quality, 'Quality: Auto');
  } else {
    const lvl = state.availableLevels.find(l => l.index === levelIdx);
    const heightStr = lvl ? `${lvl.height}p` : 'HD';
    if (menuQuality) menuQuality.textContent = heightStr;
    if (badge) badge.textContent = heightStr;
    showPlayerAction(SVG_ICONS.quality, `Quality: ${heightStr}`);
  }

  updateQualityMenuChecks(levelIdx);
}

function updateQualityMenuChecks(activeIdx) {
  const container = document.getElementById('drawerQualityList');
  if (!container) return;
  const targetIdx = (typeof activeIdx === 'number') ? activeIdx : state.currentQualityLevel;
  const rows = container.querySelectorAll('.choice-row');
  rows.forEach(row => {
    const rowLevel = parseInt(row.dataset.levelIndex, 10);
    const isCurrent = (rowLevel === targetIdx);
    row.classList.toggle('active', isCurrent);
    const check = row.querySelector('.choice-check');
    if (check) check.classList.toggle('hidden', !isCurrent);
  });
}

// ==========================================
// Subtitles & OpenSubtitles Integration
// ==========================================
async function fetchOpenSubtitles(item) {
  const { type, id, season, episode } = item;
  try {
    const res = await fetch(`/api/subtitles?action=list&type=${type}&id=${id}&season=${season || 1}&episode=${episode || 1}`);
    const data = await res.json();

    if (data.success && data.subtitles) {
      state.subtitlesList = data.subtitles;
      renderSubtitlesDrawer();
    }
  } catch (err) {
    console.warn('[OpenSubtitles fetch failed]', err.message);
  }
}

function renderSubtitlesDrawer() {
  const container = document.getElementById('drawerSubtitlesList');
  if (!container) return;
  container.innerHTML = '';

  const subPrefs = loadSubtitlePreferences();

  // Auto-match preferred language if subtitles are still 'off' and user has a preferred language
  if (state.activeSubtitleId === 'off' && subPrefs.preferredLang && subPrefs.preferredLang !== 'off') {
    const prefCode = subPrefs.preferredLang.toLowerCase();
    const allSubs = [...(state.nativeSubtitles || []), ...(state.subtitlesList || [])];
    const match = allSubs.find(s => {
      const sLang = (s.lang || '').toLowerCase();
      const sName = (s.languageName || s.label || '').toLowerCase();
      return sLang === prefCode || sLang.startsWith(prefCode) || sName.includes(prefCode);
    });
    if (match) {
      selectSubtitle(match.url, match.label, match.lang, true);
    }
  }

  // 1. Off Option
  const offBtn = document.createElement('button');
  offBtn.type = 'button';
  offBtn.className = `choice-row ${state.activeSubtitleId === 'off' ? 'active' : ''}`;
  offBtn.dataset.subUrl = 'off';
  offBtn.tabIndex = 0;
  offBtn.innerHTML = `
    <span>Subtitles: Off</span>
    <span class="choice-check ${state.activeSubtitleId === 'off' ? '' : 'hidden'}">${SVG_ICONS.check}</span>
  `;
  offBtn.onclick = () => selectSubtitle('off', 'Off', null);
  container.appendChild(offBtn);

  // 2. Native Captions (if any)
  (state.nativeSubtitles || []).forEach(sub => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const isAct = state.activeSubtitleId === sub.url;
    btn.className = `choice-row ${isAct ? 'active' : ''}`;
    btn.dataset.subUrl = sub.url;
    btn.tabIndex = 0;
    btn.innerHTML = `
      <div>
        <span>${escapeHtml(sub.label || 'English')}</span>
        <span class="choice-meta">(Stream)</span>
      </div>
      <span class="choice-check ${isAct ? '' : 'hidden'}">${SVG_ICONS.check}</span>
    `;
    btn.onclick = () => selectSubtitle(sub.url, sub.label || 'English', sub.lang);
    container.appendChild(btn);
  });

  // 3. OpenSubtitles Tracks
  (state.subtitlesList || []).forEach(sub => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const isAct = state.activeSubtitleId === sub.url;
    btn.className = `choice-row ${isAct ? 'active' : ''}`;
    btn.dataset.subUrl = sub.url;
    btn.tabIndex = 0;
    btn.dataset.lang = (sub.languageName || '').toLowerCase();
    btn.innerHTML = `
      <div>
        <span>${escapeHtml(sub.label)}</span>
        <span class="choice-meta">(OpenSubtitles)</span>
      </div>
      <span class="choice-check ${isAct ? '' : 'hidden'}">${SVG_ICONS.check}</span>
    `;
    btn.onclick = () => selectSubtitle(sub.url, sub.label, sub.lang);
    container.appendChild(btn);
  });
}

function filterSubtitleLanguages(query) {
  const container = document.getElementById('drawerSubtitlesList');
  if (!container) return;
  const q = (query || '').toLowerCase().trim();
  const rows = container.querySelectorAll('.choice-row');

  rows.forEach((row, idx) => {
    if (idx === 0) return; // Always keep 'Off' visible
    const lang = row.dataset.lang || row.textContent.toLowerCase();
    row.style.display = (!q || lang.includes(q)) ? 'flex' : 'none';
  });
}

function selectSubtitle(subUrl, label, lang, silent = false) {
  const video = document.getElementById('nativeVideoPlayer');
  if (!video) return;

  state.activeSubtitleId = subUrl;
  const menuSub = document.getElementById('menuActiveSubtitle');

  // Remove existing tracks
  while (video.firstChild) {
    video.removeChild(video.firstChild);
  }

  if (subUrl === 'off') {
    saveSubtitlePreferences({ preferredLang: 'off' });
    if (menuSub) menuSub.textContent = 'Off';
    if (!silent) showPlayerAction(SVG_ICONS.subtitles, 'Subtitles Off');
  } else {
    saveSubtitlePreferences({ preferredLang: lang || 'en' });
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = label;
    track.srclang = lang || 'en';
    track.src = subUrl;
    track.default = true;
    video.appendChild(track);

    if (track.track) {
      track.track.mode = 'showing';
    }
    if (menuSub) menuSub.textContent = label;
    if (!silent) showPlayerAction(SVG_ICONS.subtitles, label);
  }

  // Update checkmarks in list
  const container = document.getElementById('drawerSubtitlesList');
  if (container) {
    container.querySelectorAll('.choice-row').forEach(row => {
      const check = row.querySelector('.choice-check');
      const isMatch = (row.dataset.subUrl === subUrl);
      row.classList.toggle('active', isMatch);
      if (check) check.classList.toggle('hidden', !isMatch);
    });
  }
}

function switchSubtitleTab(tab) {
  const tabTracks = document.getElementById('subTabTracks');
  const tabOpts = document.getElementById('subTabOptions');
  const contentTracks = document.getElementById('subTabContentTracks');
  const contentOpts = document.getElementById('subTabContentOptions');

  if (tab === 'tracks') {
    if (tabTracks) tabTracks.classList.add('active');
    if (tabOpts) tabOpts.classList.remove('active');
    if (contentTracks) contentTracks.classList.remove('hidden');
    if (contentOpts) contentOpts.classList.add('hidden');
  } else {
    if (tabTracks) tabTracks.classList.remove('active');
    if (tabOpts) tabOpts.classList.add('active');
    if (contentTracks) contentTracks.classList.add('hidden');
    if (contentOpts) contentOpts.classList.remove('hidden');
  }
}

function setSubtitleSize(size, silent = false) {
  state.subtitleSize = size;
  saveSubtitlePreferences({ size });
  const container = document.getElementById('nativePlayerContainer');
  if (container) {
    container.classList.remove('sub-size-small', 'sub-size-normal', 'sub-size-large', 'sub-size-xlarge');
    container.classList.add(`sub-size-${size}`);
  }

  const checkSm = document.getElementById('checkSubSizeSmall');
  const checkNorm = document.getElementById('checkSubSizeNormal');
  const checkLg = document.getElementById('checkSubSizeLarge');
  const checkXl = document.getElementById('checkSubSizeXlarge');
  if (checkSm) checkSm.classList.toggle('hidden', size !== 'small');
  if (checkNorm) checkNorm.classList.toggle('hidden', size !== 'normal');
  if (checkLg) checkLg.classList.toggle('hidden', size !== 'large');
  if (checkXl) checkXl.classList.toggle('hidden', size !== 'xlarge');

  if (!silent) {
    showPlayerAction(SVG_ICONS.subtitles, `Sub Size: ${size.toUpperCase()}`);
  }
}

function setSubtitleWeight(weight, silent = false) {
  state.subtitleWeight = weight;
  saveSubtitlePreferences({ weight });
  const container = document.getElementById('nativePlayerContainer');
  if (container) {
    container.classList.remove('sub-weight-normal', 'sub-weight-bold', 'sub-weight-heavy');
    container.classList.add(`sub-weight-${weight}`);
  }

  const checkNorm = document.getElementById('checkSubWeightNormal');
  const checkBld = document.getElementById('checkSubWeightBold');
  const checkHvy = document.getElementById('checkSubWeightHeavy');
  if (checkNorm) checkNorm.classList.toggle('hidden', weight !== 'normal');
  if (checkBld) checkBld.classList.toggle('hidden', weight !== 'bold');
  if (checkHvy) checkHvy.classList.toggle('hidden', weight !== 'heavy');

  if (!silent) {
    const weightLabels = { normal: 'Regular', bold: 'Bold', heavy: 'Heavy' };
    showPlayerAction(SVG_ICONS.subtitles, `Sub Font: ${weightLabels[weight] || weight}`);
  }
}

function adjustSubtitleOffset(delta, isReset = false) {
  if (isReset) {
    state.subtitleOffset = 0;
  } else {
    state.subtitleOffset += delta;
  }

  const display = document.getElementById('subtitleOffsetDisplay');
  if (display) {
    const sign = state.subtitleOffset > 0 ? '+' : '';
    display.textContent = `${sign}${state.subtitleOffset.toFixed(1)}s`;
  }

  const video = document.getElementById('nativeVideoPlayer');
  if (video && video.textTracks) {
    for (let i = 0; i < video.textTracks.length; i++) {
      const cues = video.textTracks[i].cues;
      if (cues) {
        for (let j = 0; j < cues.length; j++) {
          if (!isReset) {
            cues[j].startTime += delta;
            cues[j].endTime += delta;
          }
        }
      }
    }
  }

  showPlayerAction(SVG_ICONS.subtitles, `Sub Sync: ${state.subtitleOffset.toFixed(1)}s`);
}

// ==========================================
// Audio Tracks Management
// ==========================================
function setupHlsAudioTracks(tracks) {
  if (!tracks || tracks.length === 0) return;
  state.availableAudioTracks = tracks;
  renderAudioDrawer();
}

function renderAudioDrawer() {
  const container = document.getElementById('drawerAudioList');
  if (!container) return;
  container.innerHTML = '';

  if (!state.availableAudioTracks || state.availableAudioTracks.length === 0) {
    container.innerHTML = `
      <div class="choice-row active" style="cursor: default;">
        <div>
          <span>Default Track</span>
          <span class="choice-meta">(Stereo / Primary)</span>
        </div>
        <span class="choice-check">${SVG_ICONS.check}</span>
      </div>
      <p class="drawer-notice-desc" style="margin-top: 10px; padding: 0 4px;">
        Single primary audio track detected.
      </p>
    `;
    return;
  }

  state.availableAudioTracks.forEach((track, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const isAct = (state.activeAudioTrackIndex === idx);
    btn.className = `choice-row ${isAct ? 'active' : ''}`;
    btn.dataset.trackIndex = String(idx);
    btn.tabIndex = 0;
    const label = track.name || track.lang || `Track ${idx + 1}`;
    btn.innerHTML = `
      <span>${escapeHtml(label)}</span>
      <span class="choice-check ${isAct ? '' : 'hidden'}">${SVG_ICONS.check}</span>
    `;
    btn.onclick = () => setAudioTrack(idx, label);
    container.appendChild(btn);
  });
}

function setAudioTrack(trackIdx, label) {
  state.activeAudioTrackIndex = trackIdx;
  if (state.hlsInstance) {
    state.hlsInstance.audioTrack = trackIdx;
  }
  const menuAud = document.getElementById('menuActiveAudio');
  if (menuAud) menuAud.textContent = label || `Track ${trackIdx + 1}`;
  updateAudioMenuChecks(trackIdx);
  showPlayerAction(SVG_ICONS.audio, label || `Audio ${trackIdx + 1}`);
}

function updateAudioMenuChecks(activeIdx) {
  const container = document.getElementById('drawerAudioList');
  if (!container) return;
  const targetIdx = (typeof activeIdx === 'number') ? activeIdx : state.activeAudioTrackIndex;
  const rows = container.querySelectorAll('.choice-row');
  rows.forEach(row => {
    const trackIdx = parseInt(row.dataset.trackIndex, 10);
    const isCurrent = (trackIdx === targetIdx);
    row.classList.toggle('active', isCurrent);
    const check = row.querySelector('.choice-check');
    if (check) check.classList.toggle('hidden', !isCurrent);
  });
}

// ==========================================
// Playback Speed & Video Fit
// ==========================================
function setPlaybackSpeed(rate) {
  state.playbackSpeed = rate;
  const video = document.getElementById('nativeVideoPlayer');
  if (video) video.playbackRate = rate;

  const menuSpd = document.getElementById('menuActiveSpeed');
  if (menuSpd) menuSpd.textContent = `${rate}x${rate === 1.0 ? ' (Normal)' : ''}`;

  const checks = {
    0.5: document.getElementById('checkSpeed05'),
    0.75: document.getElementById('checkSpeed075'),
    1.0: document.getElementById('checkSpeed10'),
    1.25: document.getElementById('checkSpeed125'),
    1.5: document.getElementById('checkSpeed15'),
    2.0: document.getElementById('checkSpeed20')
  };
  Object.keys(checks).forEach(k => {
    if (checks[k]) checks[k].classList.toggle('hidden', parseFloat(k) !== rate);
  });

  showPlayerAction(SVG_ICONS.speed, `${rate}x`);
}

function toggleScreenFit() {
  const video = document.getElementById('nativeVideoPlayer');
  if (!video) return;

  state.videoFit = (state.videoFit === 'contain') ? 'cover' : 'contain';
  video.classList.toggle('video-fit-cover', state.videoFit === 'cover');

  const menuFit = document.getElementById('menuActiveFit');
  if (menuFit) {
    menuFit.textContent = state.videoFit === 'cover' ? 'Fill (Zoom)' : 'Fit (Original)';
  }
  showPlayerAction(SVG_ICONS.fit, state.videoFit === 'cover' ? 'Fill Screen' : 'Fit Original');
}

// ==========================================
// Settings Drawer Controller
// ==========================================
function toggleSettingsDrawer() {
  if (state.drawerOpen) {
    closeSettingsDrawer();
  } else {
    openSettingsDrawer();
  }
}

function openSettingsDrawer() {
  const drawer = document.getElementById('playerSettingsDrawer');
  if (!drawer) return;
  drawer.classList.remove('hidden');
  state.drawerOpen = true;
  openDrawerSubmenu(null);

  setTimeout(() => {
    const firstBtn = drawer.querySelector('.drawer-menu-item');
    if (firstBtn) firstBtn.focus();
  }, 50);
}

function closeSettingsDrawer() {
  const drawer = document.getElementById('playerSettingsDrawer');
  if (!drawer) return;
  drawer.classList.add('hidden');
  state.drawerOpen = false;
  state.drawerSubmenu = null;

  const settingsBtn = document.getElementById('playerSettingsBtn');
  if (settingsBtn) settingsBtn.focus();
}

function openDrawerSubmenu(submenu) {
  state.drawerSubmenu = submenu;
  const mainMenu = document.getElementById('drawerMainMenu');
  const qualityMenu = document.getElementById('drawerQualitySubmenu');
  const subMenu = document.getElementById('drawerSubtitlesSubmenu');
  const audioMenu = document.getElementById('drawerAudioSubmenu');
  const speedMenu = document.getElementById('drawerSpeedSubmenu');
  const backBtn = document.getElementById('drawerBackBtn');
  const title = document.getElementById('drawerTitle');

  const drawer = document.getElementById('playerSettingsDrawer');
  if (drawer && drawer.classList.contains('hidden')) {
    drawer.classList.remove('hidden');
    state.drawerOpen = true;
  }

  [mainMenu, qualityMenu, subMenu, audioMenu, speedMenu].forEach(p => {
    if (p) p.classList.add('hidden');
  });

  if (!submenu) {
    if (mainMenu) mainMenu.classList.remove('hidden');
    if (backBtn) backBtn.classList.add('hidden');
    if (title) title.textContent = 'Settings';
    setTimeout(() => {
      const first = mainMenu ? mainMenu.querySelector('.drawer-menu-item') : null;
      if (first) first.focus();
    }, 50);
    return;
  }

  if (backBtn) backBtn.classList.remove('hidden');

  let panelToFocus = null;
  switch (submenu) {
    case 'quality':
      if (qualityMenu) qualityMenu.classList.remove('hidden');
      if (title) title.textContent = 'Quality';
      renderQualityDrawer();
      panelToFocus = qualityMenu;
      break;
    case 'subtitles':
      if (subMenu) subMenu.classList.remove('hidden');
      if (title) title.textContent = 'Subtitles';
      panelToFocus = subMenu;
      break;
    case 'audio':
      if (audioMenu) audioMenu.classList.remove('hidden');
      if (title) title.textContent = 'Audio Tracks';
      renderAudioDrawer();
      panelToFocus = audioMenu;
      break;
    case 'speed':
      if (speedMenu) speedMenu.classList.remove('hidden');
      if (title) title.textContent = 'Playback Speed';
      panelToFocus = speedMenu;
      break;
  }

  setTimeout(() => {
    if (panelToFocus) {
      const firstChoice = panelToFocus.querySelector('.choice-row, .drawer-tab, .drawer-search-input');
      if (firstChoice) firstChoice.focus();
    }
  }, 50);
}

function drawerGoBack() {
  if (state.drawerSubmenu) {
    openDrawerSubmenu(null);
  } else {
    closeSettingsDrawer();
  }
}

// ==========================================
// Playback Actions (Play, Seek, Next Ep, Fullscreen)
// ==========================================
function togglePlayPause() {
  const video = document.getElementById('nativeVideoPlayer');
  if (!video) return;
  if (video.paused) {
    video.play().catch(() => {});
    showPlayerAction(SVG_ICONS.play, 'Play');
  } else {
    video.pause();
    showPlayerAction(SVG_ICONS.pause, 'Pause');
  }
}

function seekRelative(deltaSeconds) {
  const video = document.getElementById('nativeVideoPlayer');
  if (!video) return;
  const newTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + deltaSeconds));
  video.currentTime = newTime;
  showPlayerAction(deltaSeconds > 0 ? SVG_ICONS.forward10 : SVG_ICONS.rewind10, `${deltaSeconds > 0 ? '+' : ''}${deltaSeconds}s`);
}

function seekByClick(event) {
  const bar = document.getElementById('playerProgressBar');
  const video = document.getElementById('nativeVideoPlayer');
  if (!bar || !video || !video.duration) return;
  const rect = bar.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const pct = Math.max(0, Math.min(1, clickX / rect.width));
  video.currentTime = pct * video.duration;
}

function playNextEpisode() {
  if (!state.activeItem || state.activeItem.type !== 'tv') return;
  const nextEp = (parseInt(state.activeItem.episode, 10) || 1) + 1;
  const updatedItem = {
    ...state.activeItem,
    episode: nextEp,
    episodeName: `Episode ${nextEp}`
  };
  showToast(`Playing S${updatedItem.season}:E${nextEp}…`);
  startPlayback(updatedItem);
}

async function toggleScreenRotation() {
  const container = document.getElementById('playerView');
  const video = document.getElementById('nativeVideoPlayer');
  if (!container) return;

  // 1. If screen.orientation API is available and supported (Android Chrome, modern devices)
  if (screen.orientation && typeof screen.orientation.lock === 'function') {
    const isPortrait = screen.orientation.type && screen.orientation.type.startsWith('portrait');
    try {
      if (isPortrait) {
        if (!document.fullscreenElement && container.requestFullscreen) {
          await container.requestFullscreen().catch(() => {});
        }
        await screen.orientation.lock('landscape');
        state.isRotated = true;
        showToast('Rotated to Landscape');
        return;
      } else {
        await screen.orientation.unlock();
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen().catch(() => {});
        }
        state.isRotated = false;
        showToast('Returned to Portrait');
        return;
      }
    } catch (e) {
      console.warn('[Screen orientation lock fallback to CSS rotation]', e.message);
    }
  }

  // 2. iOS Safari native video fullscreen (for native Apple HLS)
  if (video && typeof video.webkitEnterFullscreen === 'function' && state.playerMode === 'native' && !state.isRotated) {
    try {
      video.webkitEnterFullscreen();
      return;
    } catch (e) {}
  }

  // 3. Universal CSS 90-degree virtual rotation (works on iOS Safari even with Portrait Lock ON)
  state.isRotated = !state.isRotated;
  container.classList.toggle('player-rotate-landscape', state.isRotated);
  document.body.classList.toggle('body-player-rotated', state.isRotated);
  showToast(state.isRotated ? 'Rotated to Landscape' : 'Rotated to Portrait');
}

function togglePlayerFullscreen() {
  const container = document.getElementById('playerView');
  const video = document.getElementById('nativeVideoPlayer');
  if (!container) return;

  // On mobile touch devices, delegate to screen rotation
  const isMobile = window.matchMedia('(max-width: 960px)').matches || window.matchMedia('(pointer: coarse)').matches;
  if (isMobile) {
    toggleScreenRotation();
    return;
  }

  if (!document.fullscreenElement) {
    if (container.requestFullscreen) {
      container.requestFullscreen().catch(() => {});
    } else if (video && video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }
}

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function switchToEmbedMode(isFallback = false) {
  state.playerMode = 'embed';
  closeSettingsDrawer();
  if (state.hlsInstance) {
    state.hlsInstance.destroy();
    state.hlsInstance = null;
  }
  const video = document.getElementById('nativeVideoPlayer');
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }

  const nativeContainer = document.getElementById('nativePlayerContainer');
  const iframeWrapper = document.getElementById('iframePlayerWrapper');
  const serverSelect = document.getElementById('serverSelect');

  if (nativeContainer) nativeContainer.classList.add('hidden');
  if (iframeWrapper) iframeWrapper.classList.remove('hidden');

  if (serverSelect && (serverSelect.value === 'native' || !serverSelect.value)) {
    serverSelect.value = 'videasy';
    state.currentServer = 'videasy';
  }

  updatePlayerIframe();
  showPlayerControls();
  if (!isFallback) showToast('Switched to Embed player');
}

function switchToNativeMode() {
  state.playerMode = 'native';
  const serverSelect = document.getElementById('serverSelect');
  if (serverSelect) serverSelect.value = 'native';

  replacePlayerIframe('about:blank');
  const iframeWrapper = document.getElementById('iframePlayerWrapper');
  if (iframeWrapper) iframeWrapper.classList.add('hidden');

  if (state.activeItem) {
    loadNativeStream(state.activeItem);
  }
  showPlayerControls();
  showToast('Switched to Ad-Free player');
}

let fallbackDismissTimer = null;

function triggerStreamFallback(reason) {
  if (state.playerMode !== 'native') return;
  const overlay = document.getElementById('streamFallbackOverlay');
  if (!overlay) return;

  const msgEl = document.getElementById('fallbackMessage');
  if (msgEl) {
    msgEl.textContent = reason && reason.length < 35 ? reason : 'Backup player available';
  }

  // Clear previous auto-dismiss timer if already active
  if (fallbackDismissTimer) {
    clearTimeout(fallbackDismissTimer);
    fallbackDismissTimer = null;
  }

  // Reveal small notification pill without hiding loading overlay or buffering indicators
  overlay.classList.remove('hidden');

  // Small formation that leaves after 5 seconds without stopping the stream from loading
  fallbackDismissTimer = setTimeout(() => {
    overlay.classList.add('hidden');
    fallbackDismissTimer = null;
  }, 5000);
}

function confirmStreamFallback() {
  if (fallbackDismissTimer) {
    clearTimeout(fallbackDismissTimer);
    fallbackDismissTimer = null;
  }
  const overlay = document.getElementById('streamFallbackOverlay');
  if (overlay) overlay.classList.add('hidden');
  switchToEmbedMode(true);
  showToast('Switched to backup player');
}

function cancelStreamFallback() {
  if (fallbackDismissTimer) {
    clearTimeout(fallbackDismissTimer);
    fallbackDismissTimer = null;
  }
  const overlay = document.getElementById('streamFallbackOverlay');
  if (overlay) overlay.classList.add('hidden');
}

window.triggerStreamFallback = triggerStreamFallback;
window.confirmStreamFallback = confirmStreamFallback;
window.cancelStreamFallback = cancelStreamFallback;
window.switchToNativeMode = switchToNativeMode;
window.toggleScreenRotation = toggleScreenRotation;

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
  if (newServer === 'native') {
    switchToNativeMode();
    return;
  }
  if (STREAM_SERVERS[newServer]) {
    state.currentServer = newServer;
    switchToEmbedMode();
    showToast(`Switched server to ${newServer}`);
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
  clearInterval(state.clockTimer);
  state.clockTimer = null;
  clearInterval(state.stallWatchdogTimer);
  state.stallWatchdogTimer = null;
  closeSettingsDrawer();
  if (fallbackDismissTimer) {
    clearTimeout(fallbackDismissTimer);
    fallbackDismissTimer = null;
  }
  if (state.nativeRetryTimer) {
    clearTimeout(state.nativeRetryTimer);
    state.nativeRetryTimer = null;
  }
  const fallbackOverlay = document.getElementById('streamFallbackOverlay');
  if (fallbackOverlay) fallbackOverlay.classList.add('hidden');

  const bufferingEl = document.getElementById('playerBufferingIndicator');
  if (bufferingEl) bufferingEl.classList.add('hidden');
  const loadingOverlay = document.getElementById('playerLoadingOverlay');
  if (loadingOverlay) loadingOverlay.classList.add('hidden');

  const video = document.getElementById('nativeVideoPlayer');
  if (video && state.activeItem && video.duration > 0 && !isNaN(video.currentTime)) {
    saveToWatchHistory(state.activeItem, video.currentTime, video.duration);
  }

  if (state.hlsInstance) {
    state.hlsInstance.destroy();
    state.hlsInstance = null;
  }
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
    while (video.firstChild) {
      video.removeChild(video.firstChild);
    }
  }
  const controls = document.getElementById('playerControls');
  const hud = document.getElementById('playerHudOverlay');
  const playerView = document.getElementById('playerView');
  if (controls) controls.classList.remove('controls-hidden');
  if (hud) hud.classList.remove('controls-hidden');
  if (playerView) {
    playerView.classList.remove('controls-hidden');
    playerView.classList.remove('player-rotate-landscape');
  }
  document.body.classList.remove('body-player-rotated');
  if (state.isRotated) {
    state.isRotated = false;
    if (screen.orientation && typeof screen.orientation.unlock === 'function') {
      screen.orientation.unlock().catch(() => {});
    }
  }
  replacePlayerIframe('about:blank');
}

function setupPlayerControlsAutoHide() {
  document.addEventListener('keydown', event => {
    if (state.currentView !== 'player') return;

    const action = getRemoteAction(event);

    // 0. If Stream Fallback Modal is Open
    const fallbackOverlay = document.getElementById('streamFallbackOverlay');
    if (fallbackOverlay && !fallbackOverlay.classList.contains('hidden')) {
      if (action === 'back' || event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        cancelStreamFallback();
        return;
      }
      if (action === 'ArrowLeft' || action === 'ArrowRight') {
        event.preventDefault();
        event.stopImmediatePropagation();
        const switchBtn = document.getElementById('fallbackSwitchBtn');
        const cancelBtn = document.getElementById('fallbackCancelBtn');
        if (document.activeElement === cancelBtn) {
          if (switchBtn) switchBtn.focus();
        } else {
          if (cancelBtn) cancelBtn.focus();
        }
        return;
      }
      if (action === 'ok') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (document.activeElement && typeof document.activeElement.click === 'function') {
          document.activeElement.click();
        } else {
          confirmStreamFallback();
        }
        return;
      }
      return;
    }

    showPlayerControls();

    // 1. If Settings Drawer is Open
    if (state.drawerOpen) {
      if (action === 'back' || event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        drawerGoBack();
        return;
      }
      if (action === 'ArrowLeft' && state.drawerSubmenu) {
        event.preventDefault();
        drawerGoBack();
        return;
      }
      if (action === 'ArrowUp' || action === 'ArrowDown' || action === 'ArrowLeft' || action === 'ArrowRight') {
        handleDirectionalNavigation(action, event);
        return;
      }
      return;
    }

    // 2. If Settings Drawer is Closed
    const controls = document.getElementById('playerControls');
    const wasHidden = controls && controls.classList.contains('controls-hidden');

    if (wasHidden) {
      if (action === 'ok') {
        event.preventDefault();
        event.stopImmediatePropagation();
        togglePlayPause();
        return;
      }
      if (action === 'ArrowLeft') {
        event.preventDefault();
        event.stopImmediatePropagation();
        seekRelative(-10);
        return;
      }
      if (action === 'ArrowRight') {
        event.preventDefault();
        event.stopImmediatePropagation();
        seekRelative(10);
        return;
      }
      if (action === 'ArrowUp' || action === 'ArrowDown') {
        event.preventDefault();
        event.stopImmediatePropagation();
        const playBtn = document.getElementById('playerPlayPauseBtn');
        if (playBtn) playBtn.focus();
        return;
      }
      if (action === 'back') {
        event.preventDefault();
        event.stopImmediatePropagation();
        exitPlayer();
        return;
      }
    } else {
      // Controls currently visible
      if (action === 'back') {
        event.preventDefault();
        event.stopImmediatePropagation();
        hidePlayerControls();
        return;
      }
      if (document.activeElement && (document.activeElement.id === 'nativeVideoPlayer' || document.activeElement.id === 'playerProgressBar')) {
        if (action === 'ArrowLeft') {
          event.preventDefault();
          seekRelative(-10);
          return;
        }
        if (action === 'ArrowRight') {
          event.preventDefault();
          seekRelative(10);
          return;
        }
      }
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
  const hud = document.getElementById('playerHudOverlay');
  const playerView = document.getElementById('playerView');
  if (!controls) return;
  controls.classList.remove('controls-hidden');
  if (hud) hud.classList.remove('controls-hidden');
  if (playerView) playerView.classList.remove('controls-hidden');
  clearTimeout(state.playerControlsTimer);
  state.playerControlsTimer = setTimeout(hidePlayerControls, PLAYER_CONTROLS_HIDE_DELAY);
}

function hidePlayerControls() {
  if (state.currentView !== 'player') return;
  if (state.drawerOpen) return;
  const video = document.getElementById('nativeVideoPlayer');
  if (video && video.paused && state.playerMode === 'native') return;

  const controls = document.getElementById('playerControls');
  const hud = document.getElementById('playerHudOverlay');
  const playerView = document.getElementById('playerView');
  if (controls) controls.classList.add('controls-hidden');
  if (hud) hud.classList.add('controls-hidden');
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
      btn.type = 'button';
      btn.className = 'continue-watching-card';
      btn.tabIndex = 0;
      
      const isTv = item.type === 'tv';
      const labelTitle = item.title;
      const sublabel = isTv 
        ? `S${item.season}:E${item.episode}${item.episodeName ? ` "${item.episodeName}"` : ''}` 
        : (item.year ? `${item.year} · Movie` : 'Movie');
      
      const cur = Number(item.currentTime) || 0;
      const dur = Number(item.duration) || 0;
      const pct = Number(item.progressPct) || 0;

      const hasProgress = cur > 10 && dur > 0 && pct < 95;
      const resumeTag = hasProgress 
        ? `${formatTime(cur)} (${pct}%)`
        : (pct >= 95 ? 'Completed' : 'Play ▶');

      // Attempt to resolve image if missing
      if (!item.heroImage && !item.image) {
        const found = [...FEATURED_TITLES, ...(state.trendingRaw || [])].find(f => 
          f.id === item.id || (f.title && item.title && f.title.toLowerCase() === item.title.toLowerCase())
        );
        if (found) {
          item.image = found.image;
          item.heroImage = found.heroImage || found.image;
          try {
            localStorage.setItem('litetv_history', JSON.stringify(list));
          } catch (e) {}
        } else if (item.title) {
          // Query TMDB search to dynamically retrieve high-res backdrop
          fetchJson(`/api/search?q=${encodeURIComponent(item.title)}`, `search:${item.title}`).then(data => {
            if (data && data.results && data.results.length > 0) {
              const m = data.results.find(r => r.type === item.type) || data.results[0];
              if (m && (m.heroImage || m.image)) {
                item.heroImage = m.heroImage || m.image;
                item.image = m.image || m.heroImage;
                try {
                  localStorage.setItem('litetv_history', JSON.stringify(list));
                } catch (e) {}
                const backdropEl = btn.querySelector('.continue-card-backdrop');
                if (backdropEl) {
                  backdropEl.style.backgroundImage = `url("${item.heroImage || item.image}")`;
                  backdropEl.classList.remove('fallback-gradient');
                }
              }
            }
          }).catch(() => {});
        }
      }

      const bgUrl = item.heroImage || item.image;
      const bgStyle = bgUrl ? `style="background-image: url('${bgUrl}');"` : '';
      const fallbackClass = bgUrl ? '' : 'fallback-gradient';

      btn.innerHTML = `
        <div class="continue-card-backdrop ${fallbackClass}" ${bgStyle}></div>
        <div class="continue-card-overlay"></div>
        <div class="continue-card-top">
          <span class="continue-type-badge ${isTv ? 'badge-tv' : 'badge-movie'}">${isTv ? 'TV' : 'MOVIE'}</span>
          <span class="continue-play-bubble">${SVG_ICONS.play}</span>
        </div>
        <div class="continue-card-content">
          <div class="continue-card-title">${escapeHtml(labelTitle)}</div>
          <div class="continue-card-meta">
            <span class="continue-card-subtitle">${escapeHtml(sublabel)}</span>
            <span class="continue-card-time">${escapeHtml(resumeTag)}</span>
          </div>
        </div>
        <div class="continue-progress-track">
          <div class="continue-progress-fill" style="width: ${hasProgress ? pct : 0}%;"></div>
        </div>
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

function saveToWatchHistory(item, currentTime = null, duration = null) {
  try {
    const raw = localStorage.getItem('litetv_history');
    let list = raw ? JSON.parse(raw) : [];
    
    const existing = list.find(i => i.id === item.id && i.type === item.type && (item.type !== 'tv' || (String(i.season) === String(item.season) && String(i.episode) === String(item.episode))));

    let finalTime = currentTime;
    let finalDur = duration;

    // If currentTime is not explicitly passed, retain previous saved progress if any
    if (finalTime === null || finalTime === undefined) {
      finalTime = existing ? (existing.currentTime || 0) : 0;
      finalDur = existing ? (existing.duration || 0) : 0;
    }

    finalTime = Number(finalTime) || 0;
    finalDur = Number(finalDur) || 0;

    let progressPct = 0;
    if (finalDur > 0) {
      if (finalTime >= finalDur - 45 || (finalTime / finalDur) >= 0.95) {
        finalTime = 0;
        progressPct = 100;
      } else {
        progressPct = Math.min(100, Math.max(0, Math.round((finalTime / finalDur) * 100)));
      }
    } else if (existing && existing.progressPct) {
      progressPct = existing.progressPct;
    }

    const img = item.image || item.poster || (existing ? existing.image : null);
    const heroImg = item.heroImage || item.backdrop || (existing ? existing.heroImage : null);

    // Deduplicate
    list = list.filter(i => !(i.id === item.id && i.type === item.type && (item.type !== 'tv' || (String(i.season) === String(item.season) && String(i.episode) === String(item.episode)))));
    
    list.unshift({
      id: item.id,
      type: item.type,
      title: item.title,
      year: item.year,
      season: item.season,
      episode: item.episode,
      episodeName: item.episodeName,
      image: img,
      heroImage: heroImg,
      currentTime: finalTime,
      duration: finalDur,
      progressPct: progressPct,
      timestamp: Date.now()
    });

    localStorage.setItem('litetv_history', JSON.stringify(list.slice(0, MAX_WATCH_HISTORY)));
    if (state.currentView === 'home') {
      loadWatchHistory();
    }
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
    const mediaInfoOverlay = document.getElementById('mediaInfoOverlay');
    if (action === 'back' && e.target.tagName === 'INPUT' && (e.key === 'Backspace' || e.keyCode === 8)) return;

    if (action === 'back' && mediaInfoOverlay && !mediaInfoOverlay.classList.contains('hidden')) {
      e.preventDefault();
      closeMediaInfo();
      return;
    }

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
      if (state.currentView === 'player' && state.playerMode === 'native') {
        const inControls = active && (closestElement(active, '#playerControls') || closestElement(active, '#playerHudOverlay'));
        if (!inControls || active.id === 'nativeVideoPlayer' || active.tagName === 'BODY') {
          e.preventDefault();
          togglePlayPause();
          showPlayerControls();
          return;
        }
      }
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
      if (state.currentView === 'player' && state.playerMode === 'native') {
        const active = document.activeElement;
        const inControls = active && (closestElement(active, '#playerControls') || closestElement(active, '#playerHudOverlay'));
        if (!inControls || active.id === 'nativeVideoPlayer' || active.tagName === 'BODY') {
          if (action === 'ArrowLeft') {
            e.preventDefault();
            seekRelative(-10);
            showPlayerControls();
            return;
          }
          if (action === 'ArrowRight') {
            e.preventDefault();
            seekRelative(10);
            showPlayerControls();
            return;
          }
          if (action === 'ArrowUp') {
            e.preventDefault();
            showPlayerControls();
            const exitBtn = document.getElementById('playerExitBtn');
            if (exitBtn) exitBtn.focus();
            return;
          }
          if (action === 'ArrowDown') {
            e.preventDefault();
            showPlayerControls();
            const playBtn = document.getElementById('playerPlayPauseBtn');
            if (playBtn) playBtn.focus();
            return;
          }
        }
      }
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
  const mediaInfoOverlay = document.getElementById('mediaInfoOverlay');
  const currentViewContainer = mediaInfoOverlay && !mediaInfoOverlay.classList.contains('hidden')
    ? mediaInfoOverlay
    : state.currentView === 'home'
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

window.addEventListener('orientationchange', () => {
  if (window.matchMedia('(orientation: landscape)').matches) {
    const container = document.getElementById('playerView');
    if (container && container.classList.contains('player-rotate-landscape')) {
      container.classList.remove('player-rotate-landscape');
      document.body.classList.remove('body-player-rotated');
      state.isRotated = false;
    }
  }
});
