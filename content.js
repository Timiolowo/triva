// ==========================================================================
// Tivra TV - Content Discovery, TMDB, Trending, Search, Episodes & Media Info
// ==========================================================================

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
// Header Search
// ==========================================
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

  openSearch();
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
    if (document.activeElement === trigger) {
      trigger.blur();
    }
  }
}

document.addEventListener('click', (e) => {
  const header = document.querySelector('.app-header');
  if (header && header.classList.contains('search-open')) {
    const searchArea = document.querySelector('.header-search-area');
    if (searchArea && !searchArea.contains(e.target)) {
      closeHeaderSearch();
    }
  }
});

async function handleSearchSubmit(options) {
  const input = document.getElementById('searchInput');
  const query = (input ? input.value : '').trim();
  if (!query) return;
  state.lastSearchQuery = query;

  // Clear input and close the top search form immediately
  if (input) {
    input.value = '';
    input.blur();
  }
  closeHeaderSearch();

  if (!options || !options.skipRoute) {
    if (typeof setBrowserRoute === 'function') {
      setBrowserRoute(`/search?q=${encodeURIComponent(query)}`);
    }
  }

  const resultsList = document.getElementById('resultsList');
  const heading = document.getElementById('resultsHeading');
  
  heading.textContent = `Search Results for "${query}"`;
  resultsList.innerHTML = '<div class="loading-state">Searching movies and TV shows...</div>';
  if (typeof switchView === 'function') switchView('results');

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
    btn.className = 'search-result-card';
    btn.tabIndex = 0;
    btn.setAttribute('data-id', item.id);
    btn.setAttribute('data-type', item.type);
    btn.setAttribute('aria-label', `${item.title}, ${item.year || ''}. ${item.type === 'tv' ? 'Seasons' : 'Watch'}`);
    
    const isTv = item.type === 'tv';
    const typeLabel = isTv ? 'TV' : 'Movie';
    const actionText = isTv ? 'Seasons' : 'Watch';
    // Use w342 for clean sharp portrait poster artwork while keeping network/memory light
    const rawPoster = item.image || item.poster || item.heroImage;
    const posterUrl = rawPoster ? rawPoster.replace('/w500', '/w342').replace('/w1280', '/w342') : null;

    btn.innerHTML = `
      ${posterUrl 
        ? `<img class="search-card-image" src="${posterUrl}" alt="" loading="lazy" decoding="async">` 
        : `<div class="search-card-fallback"><svg viewBox="0 0 24 24" class="svg-icon" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg></div>`}
      
      <span class="search-card-badge search-card-type">${typeLabel}</span>
      ${item.rating ? `<span class="search-card-badge search-card-rating">★ ${item.rating}</span>` : ''}

      <div class="search-card-copy">
        <span class="search-card-title">${escapeHtml(item.title)}</span>
        <div class="search-card-bottom">
          <span class="search-card-year">${item.year || ''}</span>
          <span class="search-card-action">
            <svg viewBox="0 0 24 24" class="svg-icon" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            <span>${actionText}</span>
          </span>
        </div>
      </div>
    `;

    btn.addEventListener('click', () => {
      handleItemSelect(item);
    });

    container.appendChild(btn);
  });
}

// ==========================================
// Trending & Hero Spotlight
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

function filterCategory(cat) {
  state.currentCategoryFilter = cat;
  if (state.currentView !== 'home' && typeof showHomeView === 'function') {
    showHomeView();
  }
  const tabs = document.querySelectorAll('.header-nav .nav-tab');
  let activeTab = null;
  const label = cat === 'all' ? 'home' : (cat === 'tv' ? 'series' : cat);
  for (let index = 0; index < tabs.length; index += 1) {
    tabs[index].classList.remove('active');
    const tabCat = tabs[index].getAttribute('data-category');
    if (tabCat ? tabCat === cat : tabs[index].textContent.toLowerCase().indexOf(label) !== -1) {
      activeTab = tabs[index];
    }
  }
  if (activeTab) activeTab.classList.add('active');

  const heading = document.getElementById('sectionHeading');
  if (heading) {
    if (cat === 'movie') heading.textContent = 'Trending movies today';
    else if (cat === 'tv') heading.textContent = 'Trending series today';
    else heading.textContent = 'Trending today';
  }

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

// ==========================================
// Media Info Overlay
// ==========================================
function showMediaInfo(item) {
  const overlay = document.getElementById('mediaInfoOverlay');
  const action = document.getElementById('mediaInfoAction');
  if (!overlay || !action) return;
  state.mediaInfoReturnFocus = document.activeElement;

  const card = overlay.querySelector('.media-info-card');
  const artworkImage = document.getElementById('mediaInfoArtwork');
  const artwork = item.heroImage || item.backdrop || item.image || item.poster;
  if (card && artwork && artworkImage) {
    artworkImage.src = artwork;
    artworkImage.alt = `${item.title} artwork`;
    card.classList.add('has-artwork');
  } else if (card && artworkImage) {
    artworkImage.removeAttribute('src');
    artworkImage.alt = '';
    card.classList.remove('has-artwork');
  }

  const isEpisode = item.type === 'tv' && item.season && item.episode;
  const kicker = document.getElementById('mediaInfoKicker');
  if (kicker) {
    if (isEpisode) {
      const seriesTitle = item.seriesTitle || (state.activeItem && state.activeItem.title) || item.title || 'Series';
      kicker.textContent = `${seriesTitle} · Season ${item.season}`;
    } else if (item.type === 'tv') {
      kicker.textContent = item.status ? item.status.toUpperCase() : 'TV SERIES';
    } else {
      kicker.textContent = 'Movie';
    }
  }
  document.getElementById('mediaInfoTitle').textContent = item.displayTitle || item.title;

  const metaContainer = document.getElementById('mediaInfoMeta');
  if (metaContainer) {
    const metaItems = [];
    if (item.rating) {
      metaItems.push(`<span class="rating">★ ${escapeHtml(item.rating)}</span>`);
    }
    const yearVal = item.year && item.year !== 'N/A' ? item.year : '';
    if (yearVal) {
      metaItems.push(`<span>${escapeHtml(yearVal)}</span>`);
    }
    if (isEpisode) {
      metaItems.push(`<span>S${escapeHtml(item.season)} · E${escapeHtml(item.episode)}</span>`);
    } else {
      metaItems.push(`<span>${item.type === 'tv' ? 'Series' : 'Movie'}</span>`);
    }
    metaContainer.innerHTML = metaItems.join('');
  }
  document.getElementById('mediaInfoOverview').textContent = item.overview || 'No description available.';
  action.textContent = isEpisode ? 'Play episode' : item.type === 'tv' ? 'Browse seasons' : 'Play now';
  action.onclick = () => {
    closeMediaInfo(false);
    if (isEpisode) {
      if (typeof startPlayback === 'function') startPlayback(item);
    } else {
      handleItemSelect(item, { playNow: item.type === 'movie' });
    }
  };
  if (window.DownloadLinks) window.DownloadLinks.prepare(item);

  document.body.classList.add('modal-open');
  overlay.classList.remove('hidden');
  document.getElementById('mediaInfoClose').focus();
}

function closeMediaInfo(restoreFocus) {
  const overlay = document.getElementById('mediaInfoOverlay');
  if (overlay) overlay.classList.add('hidden');
  document.body.classList.remove('modal-open');
  if (restoreFocus !== false) {
    const returnFocus = state.mediaInfoReturnFocus;
    const infoBtn = document.getElementById('heroInfoBtn');
    if (returnFocus && document.documentElement.contains(returnFocus)) returnFocus.focus();
    else if (infoBtn) infoBtn.focus();
  }
}

// ==========================================
// Item Selection & TV Show Details
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
      if (typeof startPlayback === 'function') startPlayback(state.activeItem);
    } else {
      showMediaInfo(item);
    }
  } else if (item.type === 'tv') {
    loadTvShowDetails(item.id, item.title, item.year);
  }
}

async function loadTvShowDetails(tvId, title, year, options) {
  if (!options || !options.skipRoute) {
    if (typeof setBrowserRoute === 'function' && typeof slugifyTitle === 'function') {
      setBrowserRoute(`/tv/${tvId}/${slugifyTitle(title)}`, state.activeItem);
    }
  }
  if (typeof switchView === 'function') switchView('tvShow');
  document.getElementById('tvShowTitle').textContent = title || 'Loading series...';
  document.getElementById('tvShowMeta').textContent = [year, 'TV Series'].filter(Boolean).join(' · ');
  document.getElementById('tvShowFacts').innerHTML = '';
  applySeriesArtwork(state.activeItem && state.activeItem.heroImage);

  const seasonsList = document.getElementById('seasonsList');
  const episodesList = document.getElementById('episodesList');
  
  seasonsList.innerHTML = '<div class="loading-state">Loading seasons...</div>';
  episodesList.innerHTML = '<div class="loading-state">Loading episodes...</div>';

  try {
    const data = await fetchJson(`/api/tv?id=${tvId}`, `tv:${tvId}`);
    state.tvDetails = data;
    
    const resolvedTitle = data.title || title || 'TV Series';
    const resolvedYear = data.year || year || '';

    document.getElementById('tvShowTitle').textContent = resolvedTitle;
    document.getElementById('tvShowMeta').textContent = [resolvedYear, data.status || 'TV Series'].filter(Boolean).join(' · ');

    if (state.activeItem) {
      state.activeItem.title = resolvedTitle;
      state.activeItem.year = resolvedYear;
      state.activeItem.image = state.activeItem.image || data.image;
      state.activeItem.heroImage = state.activeItem.heroImage || data.heroImage;
    } else {
      state.activeItem = {
        id: Number(tvId),
        type: 'tv',
        title: resolvedTitle,
        year: resolvedYear,
        image: data.image,
        heroImage: data.heroImage
      };
    }
    applySeriesArtwork(state.activeItem && state.activeItem.heroImage);

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
    const seriesTitle = (state.activeItem && state.activeItem.title && state.activeItem.title !== 'TV Series')
      ? state.activeItem.title
      : (state.tvDetails && state.tvDetails.title) || 'Series';
    const episodeItem = {
      id: state.activeItem ? state.activeItem.id : null,
      type: 'tv',
      seriesTitle: seriesTitle,
      title: seriesTitle,
      displayTitle: ep.name || `Episode ${ep.episode_number}`,
      year: (state.activeItem && state.activeItem.year) || (state.tvDetails && state.tvDetails.year) || (ep.air_date ? ep.air_date.substring(0, 4) : ''),
      season: state.activeSeasonNumber,
      episode: ep.episode_number,
      episodeName: ep.name,
      overview: ep.overview,
      rating: ep.vote_average ? Number(ep.vote_average).toFixed(1) : '',
      image: (state.activeItem && state.activeItem.image) || null,
      heroImage: ep.still_path ? `https://image.tmdb.org/t/p/w1280${ep.still_path}` : ((state.activeItem && state.activeItem.heroImage) || null)
    };
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
      <div class="item-action-indicator">More →</div>
    `;

    btn.addEventListener('click', () => {
      showMediaInfo(episodeItem);
    });

    container.appendChild(btn);
  });
}

function renderShowFacts(data) {
  const container = document.getElementById('tvShowFacts');
  if (!container) return;
  const facts = [];
  if (data.rating) {
    facts.push(`<span class="rating">★ ${escapeHtml(data.rating)}</span>`);
  }
  if (data.total_seasons) {
    facts.push(`<span>${data.total_seasons} ${data.total_seasons === 1 ? 'season' : 'seasons'}</span>`);
  }
  if (data.total_episodes) {
    facts.push(`<span>${data.total_episodes} ${data.total_episodes === 1 ? 'episodes' : 'episodes'}</span>`);
  }
  if (data.genres && data.genres.length) {
    facts.push(`<span>${escapeHtml(data.genres.join(' · '))}</span>`);
  }
  container.innerHTML = facts.join('');
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
// Device Detection Footer
// ==========================================
function detectClientDevice() {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const maxTouch = navigator.maxTouchPoints || 0;

  // 1. Smart TV detection
  const isTv = /VIDAA|Hisense|SmartTV|Tizen|webOS|NetCast|AppleTV|HbbTV|Roku|CrKey|FireTV|AFTT|AFTM|AFTA|Android.*TV/i.test(ua)
    || typeof window.hisense !== 'undefined'
    || typeof window.webOS !== 'undefined'
    || typeof window.tizen !== 'undefined';

  if (isTv) {
    let tvName = 'Smart TV';
    if (/VIDAA|Hisense/i.test(ua) || typeof window.hisense !== 'undefined') tvName = 'Smart TV (VIDAA)';
    else if (/webOS|NetCast/i.test(ua) || typeof window.webOS !== 'undefined') tvName = 'LG Smart TV (webOS)';
    else if (/Tizen/i.test(ua) || typeof window.tizen !== 'undefined') tvName = 'Samsung Smart TV (Tizen)';
    else if (/AppleTV/i.test(ua)) tvName = 'Apple TV';
    else if (/AFT/i.test(ua)) tvName = 'Fire TV';
    else if (/Roku/i.test(ua)) tvName = 'Roku TV';
    else if (/Android/i.test(ua)) tvName = 'Android TV';
    return { type: 'tv', label: tvName, icon: 'tv' };
  }

  // 2. iPhone / iPad / iOS
  if (/iPhone/i.test(ua)) {
    return { type: 'iphone', label: 'iPhone (iOS)', icon: 'phone' };
  }
  if (/iPad/i.test(ua) || (platform === 'MacIntel' && maxTouch > 1)) {
    return { type: 'ipad', label: 'iPad (iPadOS)', icon: 'tablet' };
  }

  // 3. Android Phone / Tablet
  if (/Android/i.test(ua)) {
    const isMobile = /Mobile/i.test(ua);
    return { 
      type: 'android', 
      label: isMobile ? 'Android Phone' : 'Android Tablet', 
      icon: isMobile ? 'phone' : 'tablet' 
    };
  }

  // 4. Mac (MacBook, iMac, Mac mini)
  if (/Macintosh|MacIntel|MacPPC|Mac68K/i.test(ua) || (platform && platform.startsWith('Mac'))) {
    return { type: 'mac', label: 'Mac (macOS)', icon: 'laptop' };
  }

  // 5. Windows PC / Laptop
  if (/Windows/i.test(ua) || (platform && platform.startsWith('Win'))) {
    return { type: 'windows', label: 'Windows PC', icon: 'laptop' };
  }

  // 6. Linux PC
  if (/Linux/i.test(ua) || (platform && platform.startsWith('Linux'))) {
    return { type: 'linux', label: 'Linux PC', icon: 'laptop' };
  }

  // Fallback Desktop
  return { type: 'desktop', label: 'Laptop / PC', icon: 'laptop' };
}

function renderFooterDevice() {
  const pills = document.querySelectorAll('.footer-device-pill');
  if (!pills.length) return;
  const device = detectClientDevice();
  const icons = {
    tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>',
    laptop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20"/><path d="M10 16h4"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
    tablet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>'
  };

  pills.forEach(pill => {
    pill.innerHTML = `
      <span class="device-dot"></span>
      <span class="device-icon">${icons[device.icon] || icons.laptop}</span>
      <span class="device-label">${escapeHtml(device.label)}</span>
    `;
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderFooterDevice);
} else {
  renderFooterDevice();
}
