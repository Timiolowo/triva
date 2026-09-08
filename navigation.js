// ==========================================================================
// Tivra TV - Smart TV Spatial Remote Navigation Engine
// ==========================================================================

function focusFirstInView(viewName) {
  const container = document.getElementById(`${viewName}View`);
  if (!container) return;

  const focusables = getFocusableElements(container);
  if (focusables.length > 0) {
    focusAndReveal(focusables[0]);
  }
}

// ==========================================
// Spatial Smart TV Remote Navigation Engine
// ==========================================
function setupRemoteNavigation() {
  document.addEventListener('click', (e) => {
    const qPopup = document.getElementById('playerQualityPopup');
    const sPopup = document.getElementById('playerSubtitlesPopup');
    const qBtn = document.getElementById('playerQualityBtn');
    const sBtn = document.getElementById('playerSubtitlesBtn');
    if (qPopup && !qPopup.classList.contains('hidden') && !qPopup.contains(e.target) && !qBtn?.contains(e.target)) {
      qPopup.classList.add('hidden');
    }
    if (sPopup && !sPopup.classList.contains('hidden') && !sPopup.contains(e.target) && !sBtn?.contains(e.target)) {
      sPopup.classList.add('hidden');
    }
  });

  document.addEventListener('keydown', (e) => {
    const action = getRemoteAction(e);
    const searchForm = document.getElementById('searchForm');
    const mediaInfoOverlay = document.getElementById('mediaInfoOverlay');
    const syncModal = document.getElementById('syncModal');
    if (action === 'back' && e.target.tagName === 'INPUT' && (e.key === 'Backspace' || e.keyCode === 8)) return;

    if (action === 'back' && mediaInfoOverlay && !mediaInfoOverlay.classList.contains('hidden')) {
      e.preventDefault();
      closeMediaInfo();
      return;
    }

    if (action === 'back' && syncModal && !syncModal.classList.contains('hidden')) {
      e.preventDefault();
      closeSyncModal();
      return;
    }

    if (action === 'back' && searchForm && !searchForm.classList.contains('hidden')) {
      e.preventDefault();
      closeHeaderSearch();
      return;
    }

    if (action === 'back') {
      const qPopup = document.getElementById('playerQualityPopup');
      const sPopup = document.getElementById('playerSubtitlesPopup');
      if ((qPopup && !qPopup.classList.contains('hidden')) || (sPopup && !sPopup.classList.contains('hidden'))) {
        e.preventDefault();
        closeQuickPopups();
        return;
      }
      if (state.currentView === 'player') {
        e.preventDefault();
        if (typeof handlePlayerBack === 'function') {
          handlePlayerBack();
        } else {
          exitPlayer();
        }
        return;
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
