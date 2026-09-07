(function () {
  'use strict';

  var activeItem = null;

  function isSmartTv() {
    var ua = navigator.userAgent || '';
    if (/Hisense|VIDAA|Odin\/|SmartTV|SMART-TV|Tizen|Web0S|WebOS|NetCast|HbbTV|Android TV|GoogleTV|AppleTV|BRAVIA|AFT\w|CrKey|Roku|Vewd|Opera TV|Vestel|DTV|Insignia|TCL|MiTV|PhilipsTV|\bTV\b|LargeScreen/i.test(ua)) {
      return true;
    }
    try {
      if (window.matchMedia && (window.matchMedia('(tv)').matches || window.matchMedia('(display-mode: tv)').matches)) {
        return true;
      }
    } catch (_) {}
    return false;
  }

  function purgeTvDownloadUI() {
    if (!isSmartTv()) return;
    var btn = document.getElementById('mediaInfoDownload');
    if (btn) btn.remove();
    var panel = document.getElementById('downloadPanel');
    if (panel) panel.remove();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', purgeTvDownloadUI);
  } else {
    purgeTvDownloadUI();
  }

  function linkFor(item, quality, format) {
    var params = new URLSearchParams({
      type: item.type || 'movie',
      id: String(item.id),
      title: item.title || '',
      quality: String(quality || '')
    });
    if (item.type === 'tv') {
      params.set('season', String(item.season));
      params.set('episode', String(item.episode));
    }
    if (format) params.set('format', format);
    return location.origin + '/api/download?' + params.toString();
  }

  function setStatus(message, isError) {
    var status = document.getElementById('downloadStatus');
    if (!status) return;
    status.textContent = message || '';
    status.classList.toggle('download-error', !!isError);
  }

  function getSelectedQuality() {
    var select = document.getElementById('downloadQuality');
    return select ? select.value : '';
  }

  async function copyLink() {
    if (!activeItem) return;
    var url = linkFor(activeItem, getSelectedQuality());
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Link copied. Paste it into VLC or an HLS downloader.');
    } catch (error) {
      var input = document.createElement('textarea');
      input.value = url;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      var copied = document.execCommand('copy');
      document.body.removeChild(input);
      setStatus(copied ? 'Link copied. Paste it into VLC or an HLS downloader.' : 'Could not copy the link.', !copied);
    }
  }

  function formatQualityLabel(height) {
    var h = Number(height) || 0;
    if (h >= 2000) return '4K (' + h + 'p)';
    if (h >= 1400) return '2K (' + h + 'p)';
    if (h >= 900) return 'FHD (' + h + 'p)';
    if (h >= 600) return 'HD (' + h + 'p)';
    return 'SD (' + h + 'p)';
  }

  async function showOptions() {
    if (!activeItem) return;
    var panel = document.getElementById('downloadPanel');
    var button = document.getElementById('mediaInfoDownload');
    var select = document.getElementById('downloadQuality');
    var checking = document.getElementById('downloadChecking');
    var ready = document.getElementById('downloadReady');
    if (!panel || !button || !select) return;

    panel.classList.remove('hidden');
    if (checking) checking.classList.remove('hidden');
    if (ready) ready.classList.add('hidden');
    button.disabled = true;
    button.textContent = 'Checking…';
    setStatus('');

    try {
      var response = await fetch(linkFor(activeItem, '', 'json'));
      var data = await response.json();
      if (!response.ok || !data.success || !data.qualities.length) throw new Error(data.error || 'No qualities found');

      select.innerHTML = '';
      data.qualities.forEach(function (height) {
        var option = document.createElement('option');
        option.value = String(height);
        option.textContent = formatQualityLabel(height);
        if (height >= 900 && height <= 1100) option.selected = true;
        else if (height === 720 || height === 714) option.selected = true;
        select.appendChild(option);
      });

      if (checking) checking.classList.add('hidden');
      if (ready) ready.classList.remove('hidden');
      button.textContent = 'Download';
      button.disabled = false;
      setStatus('Copy the link into VLC or your HLS downloader.');
      select.focus();
    } catch (error) {
      if (checking) checking.classList.add('hidden');
      if (ready) ready.classList.add('hidden');
      panel.classList.add('hidden');
      setStatus('');
      button.textContent = 'Unavailable';
      button.disabled = true;
      button.classList.add('btn-unavailable');
      if (typeof window.showToast === 'function') window.showToast(error.message || 'Download is unavailable for this title');
    }
  }

  window.DownloadLinks = {
    isSmartTv: isSmartTv,
    prepare: function (item) {
      if (isSmartTv()) {
        purgeTvDownloadUI();
        return;
      }
      activeItem = item && (item.type === 'movie' || (item.type === 'tv' && item.season && item.episode)) ? item : null;
      var button = document.getElementById('mediaInfoDownload');
      var panel = document.getElementById('downloadPanel');
      var checking = document.getElementById('downloadChecking');
      var ready = document.getElementById('downloadReady');
      if (panel) panel.classList.add('hidden');
      if (checking) checking.classList.add('hidden');
      if (ready) ready.classList.add('hidden');
      setStatus('');
      if (button) {
        button.textContent = 'Download';
        button.disabled = false;
        button.classList.remove('btn-unavailable');
        button.classList.toggle('hidden', !activeItem);
      }
    },
    showOptions: showOptions,
    copyLink: copyLink
  };
}());
