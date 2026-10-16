(function () {
  if (/^\/map(?:\/|$)/.test(location.pathname)) return;
  var root = document.documentElement;
  if (typeof window.__ESPACIOS_INPUT_MODALITY_SYNC__ === 'function') {
    window.__ESPACIOS_INPUT_MODALITY_SYNC__();
    return;
  }
  var modality = 'pointer';
  function sync() {
    if (root.dataset.espaciosInputModality !== modality) {
      root.dataset.espaciosInputModality = modality;
    }
  }
  window.__ESPACIOS_INPUT_MODALITY_SYNC__ = sync;
  sync();
  document.addEventListener('pointerdown', function () {
    modality = 'pointer';
    sync();
  }, true);
  document.addEventListener('keydown', function (event) {
    if (event.altKey || event.ctrlKey || event.metaKey ||
        /^(Shift|Control|Alt|Meta|CapsLock)$/.test(event.key)) return;
    modality = 'keyboard';
    sync();
  }, true);
  if (typeof MutationObserver === 'function') {
    new MutationObserver(sync).observe(root, {
      attributes: true,
      attributeFilter: ['data-espacios-input-modality']
    });
  }
})();
