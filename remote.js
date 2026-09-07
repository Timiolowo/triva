(function () {
  'use strict';

  // 1. Detect Smart TV / Hisense VIDAA
  var ua = navigator.userAgent || '';
  var isSmartTv = /Hisense|VIDAA|Odin\/|SmartTV|SMART-TV|Tizen|Web0S|WebOS|NetCast|HbbTV|Android TV|GoogleTV|AppleTV|BRAVIA|AFT\w|CrKey|Roku|Vewd|Opera TV|Vestel|DTV|Insignia|TCL|MiTV|PhilipsTV|\bTV\b|LargeScreen/i.test(ua);

  // 2. Low-Memory Buffer Capping for HLS.js on Smart TVs (Prevents VIDAA browser crash)
  function applyTvHlsConfig() {
    if (window.Hls && window.Hls.DefaultConfig && isSmartTv) {
      window.Hls.DefaultConfig.maxBufferLength = 20;
      window.Hls.DefaultConfig.maxMaxBufferLength = 40;
      window.Hls.DefaultConfig.maxBufferSize = 30 * 1024 * 1024; // 30MB max buffer in RAM
      window.Hls.DefaultConfig.backBufferLength = 15; // Rapidly prune watched segments
    }
  }

  applyTvHlsConfig();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyTvHlsConfig);
  }

  // 3. Screen Wake Lock (Keeps TV screen on during video playback)
  var wakeLockSentinel = null;

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator && !wakeLockSentinel) {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        wakeLockSentinel.addEventListener('release', function () {
          wakeLockSentinel = null;
        });
      }
    } catch (_) {}
  }

  function releaseWakeLock() {
    try {
      if (wakeLockSentinel) {
        wakeLockSentinel.release();
        wakeLockSentinel = null;
      }
    } catch (_) {}
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      var video = document.getElementById('nativeVideoPlayer');
      if (video && !video.paused) requestWakeLock();
    }
  });

  // Attach wake lock triggers to video player
  function hookVideoEvents() {
    var video = document.getElementById('nativeVideoPlayer');
    if (!video || video._wakeLockHooked) return;
    video._wakeLockHooked = true;
    video.addEventListener('play', requestWakeLock);
    video.addEventListener('playing', requestWakeLock);
    video.addEventListener('pause', releaseWakeLock);
    video.addEventListener('ended', releaseWakeLock);
    video.addEventListener('emptied', releaseWakeLock);
  }

  // 4. Physical Remote Media Keys & Accidental Exit Protection
  var lastBackTime = 0;

  window.addEventListener('keydown', function (e) {
    var code = e.keyCode || e.which;
    hookVideoEvents();

    var video = document.getElementById('nativeVideoPlayer');
    var isPlayerVisible = video && video.offsetParent !== null && !video.closest('.hidden');

    // A. Physical Media Keys during playback
    if (isPlayerVisible) {
      // Play
      if (e.key === 'MediaPlay' || e.key === 'Play' || code === 415 || code === 250) {
        e.preventDefault();
        if (video.paused) video.play().catch(function () {});
        return;
      }
      // Pause
      if (e.key === 'MediaPause' || e.key === 'Pause' || code === 19) {
        e.preventDefault();
        if (!video.paused) video.pause();
        return;
      }
      // Play / Pause Toggle
      if (e.key === 'MediaPlayPause' || code === 179) {
        e.preventDefault();
        var playBtn = document.getElementById('playerPlayPauseBtn');
        if (playBtn) playBtn.click();
        else if (video.paused) video.play().catch(function () {});
        else video.pause();
        return;
      }
      // Fast Forward (10s)
      if (e.key === 'MediaFastForward' || e.key === 'FastForward' || code === 417 || code === 228) {
        e.preventDefault();
        var fwdBtn = document.getElementById('playerForwardBtn');
        if (fwdBtn) fwdBtn.click();
        else if (video.duration) video.currentTime = Math.min(video.duration, video.currentTime + 10);
        return;
      }
      // Rewind (10s)
      if (e.key === 'MediaRewind' || e.key === 'Rewind' || code === 412 || code === 227) {
        e.preventDefault();
        var rwdBtn = document.getElementById('playerRewindBtn');
        if (rwdBtn) rwdBtn.click();
        else video.currentTime = Math.max(0, video.currentTime - 10);
        return;
      }
      // Stop
      if (e.key === 'MediaStop' || e.key === 'Stop' || code === 413 || code === 178) {
        e.preventDefault();
        var exitBtn = document.getElementById('playerExitBtn');
        if (exitBtn) exitBtn.click();
        return;
      }
    }

    // B. Accidental Exit Protection on Home Screen
    var isBackKey = e.key === 'Escape' || e.key === 'Back' || e.key === 'Backspace' ||
                    code === 8 || code === 27 || code === 461 || code === 10009 || code === 10182;

    if (isBackKey && !isPlayerVisible) {
      // Don't intercept if user is typing in search
      if (e.target && e.target.tagName === 'INPUT' && (code === 8 || e.key === 'Backspace')) return;

      var homeView = document.getElementById('homeView');
      var isHomeActive = homeView && homeView.classList.contains('active');
      var searchForm = document.getElementById('searchForm');
      var isSearchOpen = searchForm && !searchForm.classList.contains('hidden');
      var mediaOverlay = document.getElementById('mediaInfoOverlay');
      var isModalOpen = mediaOverlay && !mediaOverlay.classList.contains('hidden');

      // Only protect if at top-level home screen with no overlays open
      if (isHomeActive && !isSearchOpen && !isModalOpen) {
        var now = Date.now();
        if (now - lastBackTime < 2500) {
          // Double tap within 2.5s -> allow exit
          return;
        }
        e.preventDefault();
        lastBackTime = now;
        if (typeof window.showToast === 'function') {
          window.showToast('Press Back again to exit');
        }
      }
    }
  }, true);

})();
