// ============================================================================
// Tivra TV - Household Sync UI & Beautiful UI Micro-Interactions
// Adapted from Beautiful UI (https://www.beautifului.dev) Task Rows & Spinner Ring
// Pure GPU-composited, zero CPU reflows, TV-safe memory footprint
// ============================================================================

(function() {
  'use strict';

  // Beautiful UI Icons
  const ICONS = {
    check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>',
    x: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>',
    retry: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="bui-spin"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>'
  };

  /**
   * Render the Beautiful UI Task Row feedback state
   * @param {'idle' | 'running' | 'done' | 'failed'} status 
   * @param {string} label 
   * @param {string} amount 
   */
  function renderTaskRow(status, label = '', amount = '') {
    const row = document.getElementById('syncFeedbackRow');
    const badgeEl = document.getElementById('syncFeedbackBadge');
    const labelEl = document.getElementById('syncFeedbackLabel');
    const amountEl = document.getElementById('syncFeedbackAmount');
    const pillEl = document.getElementById('syncFeedbackPill');

    if (!row) return;

    if (status === 'idle') {
      row.classList.add('hidden');
      return;
    }

    row.classList.remove('hidden');
    if (labelEl) labelEl.textContent = label;
    if (amountEl) amountEl.textContent = amount;

    if (status === 'running') {
      if (badgeEl) {
        badgeEl.className = 'bui-spinner-ring';
        badgeEl.innerHTML = `
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="2.2" />
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="16 40" />
          </svg>
        `;
      }
      if (pillEl) pillEl.innerHTML = '';
    } else if (status === 'done') {
      if (badgeEl) {
        badgeEl.className = 'bui-badge-green';
        badgeEl.innerHTML = ICONS.check;
      }
      if (pillEl) {
        pillEl.innerHTML = `<span class="bui-pill-green">Completed</span>`;
      }
    } else if (status === 'failed') {
      if (badgeEl) {
        badgeEl.className = 'bui-badge-red';
        badgeEl.innerHTML = ICONS.x;
      }
      if (pillEl) {
        pillEl.innerHTML = `<span class="bui-pill-red">Failed ${ICONS.retry}</span>`;
      }
    }
  }

  /**
   * Apply custom sync key with Beautiful UI connecting animation sequence
   */
  window.applyCustomSyncKey = function applyCustomSyncKey() {
    const input = document.getElementById('customSyncKeyInput');
    const btn = document.getElementById('syncConnectBtn');
    const btnText = document.getElementById('syncConnectBtnText');
    const btnIcon = document.getElementById('syncConnectBtnIcon');
    const btnSpinner = document.getElementById('syncConnectBtnSpinner');
    const btnSuccess = document.getElementById('syncConnectBtnSuccess');

    if (!input) return;
    const val = (input.value || '').trim().toUpperCase();
    if (!val) {
      if (typeof showToast === 'function') showToast('Please enter a Household Code');
      input.focus();
      return;
    }

    // 1. Enter Beautiful UI Connecting State
    if (btn) {
      btn.disabled = true;
      btn.classList.remove('is-connected', 'is-error');
      btn.classList.add('is-connecting');
    }
    if (btnText) btnText.textContent = 'Connecting...';
    if (btnIcon) btnIcon.classList.add('hidden');
    if (btnSuccess) btnSuccess.classList.add('hidden');
    if (btnSpinner) btnSpinner.classList.remove('hidden');

    // Show Beautiful UI Task Row in running state
    renderTaskRow('running', 'Syncing watch history with household...', val);

    // Guaranteed minimum animation time (850ms) for smooth visual recognition
    const minAnimPromise = new Promise(resolve => setTimeout(resolve, 850));

    // Perform actual sync operations
    const syncPromise = (async () => {
      try {
        localStorage.setItem('tivra_sync_key', val);
        if (typeof pushAllLocalHistory === 'function') {
          await pushAllLocalHistory(val);
        }
        if (typeof fetchRemoteHistory === 'function') {
          await fetchRemoteHistory(true);
        }
        return true;
      } catch (err) {
        return false;
      }
    })();

    Promise.all([syncPromise, minAnimPromise])
      .then(([ok]) => {
        if (!ok) throw new Error('Sync failed');

        // 2. Beautiful UI Success State (pop-in green badge, completed pill)
        if (btnSpinner) btnSpinner.classList.add('hidden');
        if (btnSuccess) btnSuccess.classList.remove('hidden');
        if (btnText) btnText.textContent = 'Connected!';
        if (btn) {
          btn.classList.remove('is-connecting');
          btn.classList.add('is-connected');
        }

        // Render Completed Beautiful UI Task Row
        renderTaskRow('done', 'Household Synced', val);

        // Update modal status card immediately
        if (typeof updateSyncStatusUI === 'function') {
          updateSyncStatusUI(val, false);
        }
        if (typeof showToast === 'function') {
          showToast(`Connected to Household: ${val}`);
        }

        // 3. Keep confirmation visible for 750ms so the user clearly sees it
        setTimeout(() => {
          if (typeof closeSyncModal === 'function') {
            closeSyncModal();
          }
          // Reset button and task row after exit
          setTimeout(() => {
            if (btn) {
              btn.disabled = false;
              btn.classList.remove('is-connected', 'is-connecting', 'is-error');
            }
            if (btnText) btnText.textContent = 'Connect';
            if (btnIcon) btnIcon.classList.remove('hidden');
            if (btnSuccess) btnSuccess.classList.add('hidden');
            if (btnSpinner) btnSpinner.classList.add('hidden');
            renderTaskRow('idle');
          }, 300);
        }, 750);
      })
      .catch(() => {
        // 4. Beautiful UI Failed State (pop-in red badge, retry pill)
        if (btnSpinner) btnSpinner.classList.add('hidden');
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('is-connecting');
          btn.classList.add('is-error');
        }
        if (btnText) btnText.textContent = 'Failed to Connect';
        if (btnIcon) btnIcon.classList.remove('hidden');

        renderTaskRow('failed', 'Connection failed. Check network.', val);
        if (typeof showToast === 'function') {
          showToast('Could not connect. Check network and try again.');
        }

        setTimeout(() => {
          if (btn) btn.classList.remove('is-error');
          if (btnText) btnText.textContent = 'Connect';
        }, 2500);
      });
  };

  /**
   * Reset to auto-discovered Home Wi-Fi sync
   */
  window.resetToWifiSync = function resetToWifiSync() {
    if (typeof setSyncKey === 'function') {
      setSyncKey('');
    }
    renderTaskRow('idle');
    if (typeof closeSyncModal === 'function') {
      closeSyncModal();
    }
  };

  // Keyboard shortcut: Press Enter inside customSyncKeyInput to connect
  document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('customSyncKeyInput');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          window.applyCustomSyncKey();
        }
      });
    }
  });

})();
