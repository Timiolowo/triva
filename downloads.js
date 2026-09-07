(function () {
  'use strict';

  var activeItem = null;

  function isSmartTv() {
    var ua = navigator.userAgent || '';
    return /VIDAA|SmartTV|SMART-TV|Tizen|Web0S|WebOS|NetCast|HbbTV|Android TV|BRAVIA|AFT\w|CrKey/i.test(ua);
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

  async function showOptions() {
    if (!activeItem) return;
    var panel = document.getElementById('downloadPanel');
    var button = document.getElementById('mediaInfoDownload');
    var select = document.getElementById('downloadQuality');
    if (!panel || !button || !select) return;

    panel.classList.remove('hidden');
    button.disabled = true;
    select.disabled = true;
    setStatus('Checking available qualities…');

    try {
      var response = await fetch(linkFor(activeItem, '', 'json'));
      var data = await response.json();
      if (!response.ok || !data.success || !data.qualities.length) throw new Error(data.error || 'No qualities found');

      select.innerHTML = '';
      data.qualities.forEach(function (height) {
        var option = document.createElement('option');
        option.value = String(height);
        option.textContent = height + 'p';
        if (height === 720) option.selected = true;
        select.appendChild(option);
      });
      select.disabled = false;
      setStatus('Copy the link into VLC or your HLS downloader.');
      select.focus();
    } catch (error) {
      panel.classList.add('hidden');
      setStatus('');
      if (typeof window.showToast === 'function') window.showToast(error.message || 'Download link is temporarily unavailable');
    } finally {
      button.disabled = false;
    }
  }

  window.DownloadLinks = {
    isSmartTv: isSmartTv,
    prepare: function (item) {
      activeItem = item && (item.type === 'movie' || (item.type === 'tv' && item.season && item.episode)) ? item : null;
      var button = document.getElementById('mediaInfoDownload');
      var panel = document.getElementById('downloadPanel');
      if (panel) panel.classList.add('hidden');
      setStatus('');
      if (button) button.classList.toggle('hidden', !activeItem || isSmartTv());
    },
    showOptions: showOptions,
    copyLink: copyLink
  };
}());
