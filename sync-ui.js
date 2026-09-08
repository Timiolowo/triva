// ============================================================================
// Tivra TV - Household Sync UI & Beautiful UI Micro-Interactions
// Adapted from Beautiful UI (https://www.beautifului.dev) Task Rows & Spinner Ring
// 3-Step Sequence (~10s) with Frosted Glassmorphic Button & Pure GPU Transitions
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
   * Beautiful UI Spinner Ring component
   */
  function renderSpinnerRing(active, stepNumber) {
    const size = 22, stroke = 2;
    const r = (size - stroke) / 2; // 10
    const c = 2 * Math.PI * r;     // ~62.8
    return `
      <span class="bui-spinner-ring">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="${stroke}" />
          ${active ? `
            <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(c * 0.28).toFixed(1)} ${(c * 0.72).toFixed(1)}" class="bui-spin" />
          ` : ''}
        </svg>
        <span class="bui-spinner-step" style="color:${active ? '#fff' : 'rgba(255,255,255,0.45)'};">${stepNumber}</span>
      </span>
    `;
  }

  function renderBadge(tone, iconHtml) {
    return `<span class="${tone === 'green' ? 'bui-badge-green' : 'bui-badge-red'}">${iconHtml}</span>`;
  }

  function renderPill(tone, text, iconHtml = '') {
    return `<span class="${tone === 'green' ? 'bui-pill-green' : 'bui-pill-red'}">${text}${iconHtml ? ' ' + iconHtml : ''}</span>`;
  }

  let activeSyncTimers = [];

  function clearSyncTimers() {
    activeSyncTimers.forEach(t => clearTimeout(t));
    activeSyncTimers = [];
  }

  /**
   * Update the 3 Beautiful UI Task Rows
   */
  function updateTaskRows(step, code = '', customLabel = '') {
    const card = document.getElementById('syncTasksCard');
    const row1 = document.getElementById('buiRow1');
    const row2 = document.getElementById('buiRow2');
    const row3 = document.getElementById('buiRow3');

    const badge1 = document.getElementById('buiBadge1');
    const badge2 = document.getElementById('buiBadge2');
    const badge3 = document.getElementById('buiBadge3');

    const amount1 = document.getElementById('buiAmount1');
    const amount2 = document.getElementById('buiAmount2');
    const amount3 = document.getElementById('buiAmount3');

    const pill1 = document.getElementById('buiPill1');
    const pill2 = document.getElementById('buiPill2');
    const pill3 = document.getElementById('buiPill3');

    if (!card) return;

    if (step === 0) {
      card.classList.add('hidden');
      return;
    }

    card.classList.remove('hidden');

    if (step === 1) {
      // Step 1: Connecting
      if (row1) row1.className = 'bui-task-row is-active';
      if (row2) row2.className = 'bui-task-row';
      if (row3) row3.className = 'bui-task-row';

      if (badge1) badge1.innerHTML = renderSpinnerRing(true, 1);
      if (badge2) badge2.innerHTML = renderSpinnerRing(false, 2);
      if (badge3) badge3.innerHTML = renderSpinnerRing(false, 3);

      if (amount1) amount1.textContent = code;
      if (amount2) amount2.textContent = '';
      if (amount3) amount3.textContent = '';

      if (pill1) pill1.innerHTML = '';
      if (pill2) pill2.innerHTML = '';
      if (pill3) pill3.innerHTML = '';
    } else if (step === 2) {
      // Step 2: Syncing history
      if (row1) row1.className = 'bui-task-row';
      if (row2) row2.className = 'bui-task-row is-active';
      if (row3) row3.className = 'bui-task-row';

      if (badge1) badge1.innerHTML = renderBadge('green', ICONS.check);
      if (badge2) badge2.innerHTML = renderSpinnerRing(true, 2);
      if (badge3) badge3.innerHTML = renderSpinnerRing(false, 3);

      if (pill1) pill1.innerHTML = renderPill('green', 'Connected');
      if (amount2) amount2.textContent = customLabel || 'Syncing...';
      if (pill2) pill2.innerHTML = '';
      if (pill3) pill3.innerHTML = '';
    } else if (step === 3) {
      // Step 3: Pairing devices
      if (row1) row1.className = 'bui-task-row';
      if (row2) row2.className = 'bui-task-row';
      if (row3) row3.className = 'bui-task-row is-active';

      if (badge1) badge1.innerHTML = renderBadge('green', ICONS.check);
      if (badge2) badge2.innerHTML = renderBadge('green', ICONS.check);
      if (badge3) badge3.innerHTML = renderSpinnerRing(true, 3);

      if (pill1) pill1.innerHTML = renderPill('green', 'Connected');
      if (pill2) pill2.innerHTML = renderPill('green', 'Completed');
      if (amount3) amount3.textContent = 'Pairing...';
      if (pill3) pill3.innerHTML = '';
    } else if (step === 4) {
      // All 3 Steps Completed
      if (row1) row1.className = 'bui-task-row';
      if (row2) row2.className = 'bui-task-row';
      if (row3) row3.className = 'bui-task-row';

      if (badge1) badge1.innerHTML = renderBadge('green', ICONS.check);
      if (badge2) badge2.innerHTML = renderBadge('green', ICONS.check);
      if (badge3) badge3.innerHTML = renderBadge('green', ICONS.check);

      if (pill1) pill1.innerHTML = renderPill('green', 'Connected');
      if (pill2) pill2.innerHTML = renderPill('green', 'Completed');
      if (pill3) pill3.innerHTML = renderPill('green', 'Active');

      if (amount3) amount3.textContent = 'Household Synced';
    } else if (step === -1) {
      // Error / Failed
      if (badge3) badge3.innerHTML = renderBadge('red', ICONS.x);
      if (pill3) pill3.innerHTML = renderPill('red', 'Failed', ICONS.retry);
    }
  }

  /**
   * Apply custom sync key with Beautiful UI 3-step sequence over ~10 seconds
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

    clearSyncTimers();

    // 1. Initial State: Button shows connecting and Step 1 begins
    if (btn) {
      btn.disabled = true;
      btn.classList.remove('is-connected', 'is-error');
      btn.classList.add('is-connecting');
    }
    if (btnText) btnText.textContent = 'Connecting (1/3)...';
    if (btnIcon) btnIcon.classList.add('hidden');
    if (btnSuccess) btnSuccess.classList.add('hidden');
    if (btnSpinner) btnSpinner.classList.remove('hidden');

    // Launch Step 1 (0s - 3.2s)
    updateTaskRows(1, val);

    // Save key to storage and push local items
    let syncFailed = false;
    try {
      localStorage.setItem('tivra_sync_key', val);
      if (typeof pushAllLocalHistory === 'function') {
        pushAllLocalHistory(val).catch(() => {});
      }
    } catch (e) {
      syncFailed = true;
    }

    // Step 2 timer at 3.2s (3200ms)
    activeSyncTimers.push(setTimeout(() => {
      if (syncFailed) return;
      if (btnText) btnText.textContent = 'Syncing (2/3)...';
      updateTaskRows(2, val, 'Merging items');

      if (typeof fetchRemoteHistory === 'function') {
        fetchRemoteHistory(true).catch(() => {});
      }
    }, 3200));

    // Step 3 timer at 6.8s (6800ms)
    activeSyncTimers.push(setTimeout(() => {
      if (syncFailed) return;
      if (btnText) btnText.textContent = 'Pairing (3/3)...';
      updateTaskRows(3, val);
    }, 6800));

    // Completion timer at 9.6s (~10s total sequence)
    activeSyncTimers.push(setTimeout(() => {
      if (syncFailed) {
        // Failed flow
        if (btnSpinner) btnSpinner.classList.add('hidden');
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('is-connecting');
          btn.classList.add('is-error');
        }
        if (btnText) btnText.textContent = 'Failed to Connect';
        if (btnIcon) btnIcon.classList.remove('hidden');
        updateTaskRows(-1, val);
        if (typeof showToast === 'function') {
          showToast('Could not connect. Check network and try again.');
        }
        activeSyncTimers.push(setTimeout(() => {
          if (btn) btn.classList.remove('is-error');
          if (btnText) btnText.textContent = 'Connect';
        }, 2500));
        return;
      }

      // Success flow
      updateTaskRows(4, val);

      if (btnSpinner) btnSpinner.classList.add('hidden');
      if (btnSuccess) btnSuccess.classList.remove('hidden');
      if (btnText) btnText.textContent = 'Connected!';
      if (btn) {
        btn.classList.remove('is-connecting');
        btn.classList.add('is-connected');
      }

      // Update modal household active key display
      if (typeof updateSyncStatusUI === 'function') {
        updateSyncStatusUI(val, false);
      }
      if (typeof showToast === 'function') {
        showToast(`Connected to Household: ${val}`);
      }

      // Close modal smoothly after user sees the 3-step completion
      activeSyncTimers.push(setTimeout(() => {
        if (typeof closeSyncModal === 'function') {
          closeSyncModal();
        }
        // Reset button and task rows after closing
        activeSyncTimers.push(setTimeout(() => {
          if (btn) {
            btn.disabled = false;
            btn.classList.remove('is-connected', 'is-connecting', 'is-error');
          }
          if (btnText) btnText.textContent = 'Connect';
          if (btnIcon) btnIcon.classList.remove('hidden');
          if (btnSuccess) btnSuccess.classList.add('hidden');
          if (btnSpinner) btnSpinner.classList.add('hidden');
          updateTaskRows(0);
        }, 400));
      }, 900));

    }, 9600));
  };

  /**
   * Reset to auto-discovered Home Wi-Fi sync
   */
  window.resetToWifiSync = function resetToWifiSync() {
    clearSyncTimers();
    const input = document.getElementById('customSyncKeyInput');
    if (input) input.value = '';
    if (typeof setSyncKey === 'function') {
      setSyncKey('');
    }
    updateTaskRows(0);
    if (typeof updateSyncStatusUI === 'function') {
      updateSyncStatusUI('HOME', true);
    }
    if (typeof showToast === 'function') {
      showToast('Reset to Home Wi-Fi Auto-Sync');
    }
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
