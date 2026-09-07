// ==========================================================================
// Tivra TV - State & Local Storage Management
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
  mediaInfoReturnFocus: null,
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
  stallWatchdogTimer: null,
  lastBackPressTime: 0
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
// Utilities
// ==========================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toastNotification');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden');
  toast.style.animation = 'none';
  void toast.offsetHeight;
  toast.style.animation = '';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2600);
}

function closestElement(element, selector) {
  while (element && element !== document) {
    const matches = element.matches || element.msMatchesSelector || element.webkitMatchesSelector;
    if (matches && matches.call(element, selector)) return element;
    element = element.parentElement;
  }
  return null;
}

// ==========================================
// Subtitle Preferences
// ==========================================
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
        } else if (item.title && typeof fetchJson === 'function') {
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
        if (typeof startPlayback === 'function') {
          startPlayback(item);
        }
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
    
    const existing = list.find(i => i.id === item.id && i.type === item.type && (item.type !== 'tv' || (String(i.season) === String(item.season) && String(item.episode) === String(item.episode))));

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
