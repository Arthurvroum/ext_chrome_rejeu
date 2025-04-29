// Force fullscreen mode for tab mode
(() => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('tab') || urlParams.get('page') === 'replay-window') {
    document.body.classList.add('tab-mode');
    
    // Force all containers to take full width
    document.documentElement.style.width = '100vw';
    document.documentElement.style.height = '100vh';
    document.body.style.width = '100vw';
    document.body.style.height = '100vh';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.position = 'absolute';
    document.body.style.left = '0';
    document.body.style.top = '0';
    
    // Ensure app container takes full width after Vue mounts
    window.addEventListener('load', function() {
      const appElement = document.getElementById('app');
      if (appElement) {
        appElement.style.cssText = 'width: 100vw !important; height: 100vh !important; position: absolute !important; left: 0 !important; top: 0 !important; margin: 0 !important; padding: 0 !important;';
      }
    });
  }
})();
