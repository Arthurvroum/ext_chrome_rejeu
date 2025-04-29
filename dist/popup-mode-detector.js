// This script handles popup/tab mode detection
document.addEventListener('DOMContentLoaded', function() {
  // Check if we're in a tab view
  const urlParams = new URLSearchParams(window.location.search);
  const isTabMode = urlParams.get('tab') || urlParams.get('page') === 'replay-window';
  
  if (isTabMode) {
    document.body.classList.add('tab-mode');
    document.documentElement.style.cssText = `
      width: 100vw !important;
      height: 100vh !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
    `;
    
    document.body.style.cssText = `
      width: 100vw !important;
      height: 100vh !important;
      margin: 0 !important;
      padding: 0 !important;
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      overflow: hidden !important;
    `;
  } else {
    document.body.classList.add('popup-mode');
    // Set the dimensions directly
    document.body.style.width = '600px';
    document.body.style.height = '600px';
    document.body.style.overflow = 'auto';
    
    // Call the popup sizer
    if (window.popupSizer) {
      window.popupSizer.resize();
    }
  }
  
  // Force all direct app children to take full width in tab mode
  if (isTabMode) {
    // Ensure app container takes full width after Vue mounts
    setTimeout(() => {
      const appElement = document.getElementById('app');
      if (appElement) {
        appElement.style.cssText += 'width: 100vw !important; max-width: 100vw !important; position: absolute !important; left: 0 !important; top: 0 !important; margin: 0 !important; padding: 0 !important;';
        
        // Also find any direct children and ensure they take full width
        const children = appElement.children;
        for (let i = 0; i < children.length; i++) {
          children[i].style.cssText += 'width: 100% !important; max-width: 100% !important;';
        }
      }
    }, 100);
  }
});
