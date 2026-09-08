// ==========================================================================
// Tivra TV - Video Playback, HLS Engine, Popups, and Player Controls
// ==========================================================================

function formatEpisodeName(name) {
  if (!name) return '';
  name = String(name).trim();
  const hasLower = /[a-z]/.test(name);
  const hasUpper = /[A-Z]/.test(name);
  if (hasLower && hasUpper) return name;
  const minorWords = /^(a|an|and|as|at|but|by|en|for|if|in|of|on|or|the|to|v[.]?|via|vs[.]?)$/i;
  return name.toLowerCase().replace(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g, (match, offset) => {
    if (offset > 0 && minorWords.test(match)) return match.toLowerCase();
    return match.charAt(0).toUpperCase() + match.slice(1);
  });
}

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
      const epName = formatEpisodeName(item.episodeName);
      epTagEl.textContent = `S${item.season}:E${item.episode}${epName ? ` "${epName}"` : ''}`;
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
    if (titleEl) titleEl.textContent = item.title || '';
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
  const subBtn = document.getElementById('playerSubtitlesBtn');
  if (subBtn) subBtn.classList.remove('active');
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
      autoSelectBestSubtitle();
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
    let label = height >= 2000 ? `4K (${height}p)`
      : height >= 1400 ? `2K (${height}p)`
      : height >= 900 ? `FHD (${height}p)`
      : height >= 600 ? `HD (${height}p)`
      : `SD (${height}p)`;
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
  closeQuickPopups();
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

function closeQuickPopups() {
  const qPopup = document.getElementById('playerQualityPopup');
  const sPopup = document.getElementById('playerSubtitlesPopup');
  if (qPopup) qPopup.classList.add('hidden');
  if (sPopup) sPopup.classList.add('hidden');
}

function toggleQualityPopup(event) {
  if (event) event.stopPropagation();
  closeSettingsDrawer();
  const sPopup = document.getElementById('playerSubtitlesPopup');
  if (sPopup) sPopup.classList.add('hidden');

  const popup = document.getElementById('playerQualityPopup');
  if (!popup) return;

  const isClosed = popup.classList.contains('hidden');
  if (isClosed) {
    renderQualityPopup();
    popup.classList.remove('hidden');
    setTimeout(() => {
      const activeBtn = popup.querySelector('.quick-popup-item.active') || popup.querySelector('.quick-popup-item');
      if (activeBtn) activeBtn.focus();
    }, 40);
  } else {
    popup.classList.add('hidden');
    const qBtn = document.getElementById('playerQualityBtn');
    if (qBtn) qBtn.focus();
  }
}

function toggleSubtitlesPopup(event) {
  if (event) event.stopPropagation();
  closeSettingsDrawer();
  const qPopup = document.getElementById('playerQualityPopup');
  if (qPopup) qPopup.classList.add('hidden');

  const popup = document.getElementById('playerSubtitlesPopup');
  if (!popup) return;

  const isClosed = popup.classList.contains('hidden');
  if (isClosed) {
    renderSubtitlesPopup();
    popup.classList.remove('hidden');
    setTimeout(() => {
      const activeBtn = popup.querySelector('.quick-popup-item.active') || popup.querySelector('.quick-popup-item');
      if (activeBtn) activeBtn.focus();
    }, 40);
  } else {
    popup.classList.add('hidden');
    const sBtn = document.getElementById('playerSubtitlesBtn');
    if (sBtn) sBtn.focus();
  }
}

function renderQualityPopup() {
  const container = document.getElementById('quickQualityList');
  if (!container) return;
  container.innerHTML = '';

  // 1. Auto Option
  const autoBtn = document.createElement('button');
  autoBtn.type = 'button';
  autoBtn.className = `quick-popup-item ${state.currentQualityLevel === -1 ? 'active' : ''}`;
  autoBtn.tabIndex = 0;
  autoBtn.innerHTML = `
    <span>Auto</span>
    <span class="quick-popup-check ${state.currentQualityLevel === -1 ? '' : 'hidden'}">${SVG_ICONS.check}</span>
  `;
  autoBtn.onclick = (e) => {
    e.stopPropagation();
    setQualityLevel(-1);
  };
  container.appendChild(autoBtn);

  // 2. Specific resolutions from HLS
  if (state.availableLevels && state.availableLevels.length > 0) {
    const seenHeights = new Set();
    const sortedLevels = [...state.availableLevels].sort((a, b) => b.height - a.height);
    sortedLevels.forEach(lvl => {
      if (seenHeights.has(lvl.height)) return;
      seenHeights.add(lvl.height);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `quick-popup-item ${state.currentQualityLevel === lvl.index ? 'active' : ''}`;
      btn.tabIndex = 0;
      btn.innerHTML = `
        <span>${escapeHtml(lvl.label)}</span>
        <span class="quick-popup-check ${state.currentQualityLevel === lvl.index ? '' : 'hidden'}">${SVG_ICONS.check}</span>
      `;
      btn.onclick = (e) => {
        e.stopPropagation();
        setQualityLevel(lvl.index);
      };
      container.appendChild(btn);
    });
  }
}

function autoSelectBestSubtitle() {
  const subPrefs = loadSubtitlePreferences();
  if (subPrefs.preferredLang === 'off') return;

  const allSubs = [];
  const seenUrls = new Set();
  [...(state.nativeSubtitles || []), ...(state.subtitlesList || [])].forEach(sub => {
    if (!sub || !sub.url || seenUrls.has(sub.url)) return;
    seenUrls.add(sub.url);
    allSubs.push(sub);
  });

  if (allSubs.length === 0) return;

  // If a valid subtitle is already active and selected, keep it
  if (state.activeSubtitleId && state.activeSubtitleId !== 'off') {
    if (allSubs.some(s => s.url === state.activeSubtitleId)) return;
  }

  const prefCode = (subPrefs.preferredLang || 'en').toLowerCase();

  // 1. Exact language code match (e.g. 'en')
  let match = allSubs.find(s => (s.lang || '').toLowerCase() === prefCode);

  // 2. Starts with / includes language code or 'english'
  if (!match) {
    match = allSubs.find(s => {
      const sLang = (s.lang || '').toLowerCase();
      const sName = (s.languageName || s.label || '').toLowerCase();
      return sLang.startsWith(prefCode) || sName.includes(prefCode) || sName.includes('english');
    });
  }

  // 3. Mark as default from stream
  if (!match) {
    match = allSubs.find(s => s.default);
  }

  // 4. Fallback to first available subtitle
  if (!match) {
    match = allSubs[0];
  }

  if (match) {
    selectSubtitle(match.url, match.label || match.languageName || 'English', match.lang || 'en', true);
  }
}

function renderSubtitlesPopup() {
  const container = document.getElementById('quickSubtitlesList');
  if (!container) return;
  container.innerHTML = '';

  // Auto-match best subtitle if not already active
  autoSelectBestSubtitle();

  const allSubs = [];
  const seenUrls = new Set();
  [...(state.nativeSubtitles || []), ...(state.subtitlesList || [])].forEach(sub => {
    if (!sub || !sub.url || seenUrls.has(sub.url)) return;
    seenUrls.add(sub.url);
    allSubs.push(sub);
  });

  // 1. Off option
  const isOff = !state.activeSubtitleId || state.activeSubtitleId === 'off';
  const offBtn = document.createElement('button');
  offBtn.type = 'button';
  offBtn.className = `quick-popup-item ${isOff ? 'active' : ''}`;
  offBtn.tabIndex = 0;
  offBtn.innerHTML = `
    <span>Off</span>
    <span class="quick-popup-check ${isOff ? '' : 'hidden'}">${SVG_ICONS.check}</span>
  `;
  offBtn.onclick = (e) => {
    e.stopPropagation();
    selectSubtitle('off', 'Off', 'off');
  };
  container.appendChild(offBtn);

  // 2. Available subtitles (shows the stream captions & OpenSubtitles)
  if (allSubs.length > 0) {
    allSubs.slice(0, 8).forEach(sub => {
      const isAct = state.activeSubtitleId === sub.url;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `quick-popup-item ${isAct ? 'active' : ''}`;
      btn.tabIndex = 0;
      const label = sub.label || sub.languageName || 'English';
      btn.innerHTML = `
        <span>${escapeHtml(label)}</span>
        <span class="quick-popup-check ${isAct ? '' : 'hidden'}">${SVG_ICONS.check}</span>
      `;
      btn.onclick = (e) => {
        e.stopPropagation();
        selectSubtitle(sub.url, label, sub.lang);
      };
      container.appendChild(btn);
    });
  }

  // 3. More settings link
  const settingsBtn = document.createElement('button');
  settingsBtn.type = 'button';
  settingsBtn.className = 'quick-popup-item quick-popup-footer-item';
  settingsBtn.tabIndex = 0;
  settingsBtn.innerHTML = `<span>More Subtitle Options ›</span>`;
  settingsBtn.onclick = (e) => {
    e.stopPropagation();
    closeQuickPopups();
    openDrawerSubmenu('subtitles');
  };
  container.appendChild(settingsBtn);
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
      autoSelectBestSubtitle();
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

  // Auto-match preferred language if not already active
  autoSelectBestSubtitle();

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
  const subBtn = document.getElementById('playerSubtitlesBtn');
  if (subBtn) subBtn.classList.toggle('active', subUrl !== 'off');

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
  if (!silent) closeQuickPopups();
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
  closeQuickPopups();
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
  const clientX = (event.touches && event.touches.length) ? event.touches[0].clientX : event.clientX;
  if (clientX === undefined) return;
  const clickX = clientX - rect.left;
  const pct = Math.max(0, Math.min(1, clickX / rect.width));
  video.currentTime = pct * video.duration;
}

function setupProgressBarDragging() {
  const bar = document.getElementById('playerProgressBar');
  const video = document.getElementById('nativeVideoPlayer');
  if (!bar || !video) return;

  let isDragging = false;

  const seek = (clientX) => {
    if (!video.duration || clientX === undefined) return;
    const rect = bar.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    video.currentTime = pct * video.duration;
  };

  bar.addEventListener('pointerdown', (e) => {
    isDragging = true;
    try { bar.setPointerCapture(e.pointerId); } catch (_) {}
    seek(e.clientX);
  });

  bar.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    seek(e.clientX);
  });

  const stop = (e) => {
    if (isDragging) {
      isDragging = false;
      try { bar.releasePointerCapture(e.pointerId); } catch (_) {}
    }
  };

  bar.addEventListener('pointerup', stop);
  bar.addEventListener('pointercancel', stop);
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

if (typeof document !== 'undefined') {
  ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange'].forEach(evt => {
    document.addEventListener(evt, () => {
      const fsBtn = document.getElementById('playerFullscreenBtn');
      if (!fsBtn) return;
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      fsBtn.title = isFs ? 'Exit Fullscreen' : 'Fullscreen';
      fsBtn.setAttribute('aria-label', isFs ? 'Exit Fullscreen' : 'Toggle fullscreen');
      const svg = fsBtn.querySelector('svg');
      if (svg) {
        svg.innerHTML = isFs
          ? '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
          : '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
      }
    });
  });
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

function handlePlayerBack() {
  // 1. If in browser fullscreen, exit fullscreen first and stay on the player in windowed mode
  if (document.fullscreenElement) {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    showPlayerControls();
    showToast('Exited Fullscreen');
    return;
  }

  // 2. If mobile virtual rotation is active, return to portrait first
  if (state.isRotated && typeof toggleScreenRotation === 'function') {
    toggleScreenRotation();
    showPlayerControls();
    return;
  }

  // 3. Otherwise exit the player back to previous screen
  exitPlayer();
}

function exitPlayer() {
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
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
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
  clearTimeout(state.playerControlsTimer);
  state.playerControlsTimer = null;
  clearInterval(state.clockTimer);
  state.clockTimer = null;
  clearInterval(state.stallWatchdogTimer);
  state.stallWatchdogTimer = null;
  closeSettingsDrawer();
  closeQuickPopups();
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
        handlePlayerBack();
        return;
      }
    } else {
      // Controls currently visible
      if (action === 'back') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (document.fullscreenElement) {
          handlePlayerBack();
          return;
        }
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
