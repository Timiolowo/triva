// ==========================================================================
// Tivra TV - Application Boot, View Management & Routing Engine
// ==========================================================================

// ==========================================
// Initialization & Lifecycle
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const subPrefs = loadSubtitlePreferences();
  if (typeof setSubtitleSize === 'function') setSubtitleSize(subPrefs.size || 'normal', true);
  if (typeof setSubtitleWeight === 'function') setSubtitleWeight(subPrefs.weight || 'normal', true);

  loadWatchHistory();
  if (typeof loadFeaturedTitles === 'function') loadFeaturedTitles();
  if (typeof setupPlayerControlsAutoHide === 'function') setupPlayerControlsAutoHide();
  if (typeof setupProgressBarDragging === 'function') setupProgressBarDragging();
  if (typeof setupRemoteNavigation === 'function') setupRemoteNavigation();
  setupSmartNavScroll();
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
// Smart Header Auto-Hide / Reveal on Scroll
// ==========================================
function setupSmartNavScroll() {
  let lastScrollY = window.pageYOffset || document.documentElement.scrollTop;
  let isTicking = false;
  const header = document.querySelector('.app-header');
  if (!header) return;

  window.addEventListener('scroll', () => {
    if (!isTicking) {
      window.requestAnimationFrame(() => {
        const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
        const searchForm = document.getElementById('searchForm');
        const isSearchOpen = searchForm && !searchForm.classList.contains('hidden');

        // Always show if near the very top (<= 20px) or while search is open
        if (currentScrollY <= 20 || isSearchOpen) {
          header.classList.remove('nav-hidden');
        } else {
          const delta = currentScrollY - lastScrollY;
          if (delta > 6 && currentScrollY > 70) {
            // Scrolled DOWN -> smoothly hide top nav
            header.classList.add('nav-hidden');
          } else if (delta < -3) {
            // Scrolled UP (even for a bit) -> smoothly reveal top nav
            header.classList.remove('nav-hidden');
          }
        }

        lastScrollY = Math.max(0, currentScrollY);
        isTicking = false;
      });
      isTicking = true;
    }
  }, { passive: true });
}

// ==========================================
// View Management
// ==========================================
function switchView(viewName) {
  const activeElement = document.activeElement;
  if (activeElement && activeElement !== document.body) {
    state.focusMemory[state.currentView] = activeElement;
  }

  const header = document.querySelector('.app-header');
  if (header) header.classList.remove('nav-hidden');

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
    if (typeof fetchRemoteHistory === 'function') fetchRemoteHistory(true);
  }

  setTimeout(() => {
    const remembered = state.focusMemory[viewName];
    if (remembered && document.documentElement.contains(remembered) && remembered.offsetParent !== null) {
      if (typeof focusAndReveal === 'function') focusAndReveal(remembered);
    } else {
      if (typeof focusFirstInView === 'function') focusFirstInView(viewName);
    }
  }, 60);
}

function showHomeView(options) {
  if (!options || !options.skipRoute) setBrowserRoute('/home');
  switchView('home');
}

function showResultsOrHome(options) {
  const resultsContainer = document.getElementById('resultsList');
  if (resultsContainer && resultsContainer.children.length > 0) {
    if ((!options || !options.skipRoute) && state.lastSearchQuery) {
      setBrowserRoute(`/search?q=${encodeURIComponent(state.lastSearchQuery)}`);
    }
    switchView('results');
  } else {
    showHomeView(options);
  }
}

// ==========================================
// Routing Engine
// ==========================================
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
    if (typeof stopPlayer === 'function') stopPlayer();
  }

  if (path === '/' || path === '/home') {
    if (path === '/') setBrowserRoute('/home', null, true);
    showHomeView({ skipRoute: true });
    return;
  }

  if (path === '/search' && searchQuery) {
    const input = document.getElementById('searchInput');
    if (input) input.value = searchQuery;
    if (typeof handleSearchSubmit === 'function') handleSearchSubmit({ skipRoute: true });
    return;
  }

  match = path.match(/^\/tv\/(\d+)(?:\/([^/]+))?$/);
  if (match) {
    const slugTitle = match[2] ? titleFromSlug(match[2]) : '';
    const tvItem = findRouteItem('tv', Number(match[1]), null, null, slugTitle);
    state.activeItem = tvItem;
    if (typeof loadTvShowDetails === 'function') loadTvShowDetails(tvItem.id, tvItem.title, tvItem.year, { skipRoute: true });
    return;
  }

  match = path.match(/^\/watch\/tv\/(\d+)\/(\d+)\/(\d+)(?:\/([^/]+))?$/);
  if (match) {
    const slugTitle = match[4] ? titleFromSlug(match[4]) : '';
    const tvEpisode = findRouteItem('tv', Number(match[1]), Number(match[2]), Number(match[3]), slugTitle);
    if (typeof startPlayback === 'function') startPlayback(tvEpisode, { skipRoute: true });
    return;
  }

  match = path.match(/^\/(?:watch\/)?movie\/(\d+)(?:\/([^/]+))?$/);
  if (match) {
    const slugTitle = match[2] ? titleFromSlug(match[2]) : '';
    const movie = findRouteItem('movie', Number(match[1]), null, null, slugTitle);
    if (typeof startPlayback === 'function') startPlayback(movie, { skipRoute: true });
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

function findRouteItem(type, id, season, episode, fallbackTitle) {
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
    title: fallbackTitle || (type === 'tv' ? 'TV Series' : 'Movie'),
    year: '',
    season,
    episode,
    episodeName: episode ? `Episode ${episode}` : ''
  };
}

function titleFromSlug(slug) {
  if (!slug) return '';
  return slug
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function slugifyTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'title';
}
