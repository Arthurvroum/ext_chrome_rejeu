// This script handles popup/tab mode detection
document.addEventListener('DOMContentLoaded', function() {
  // Check if we're in a tab view
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('tab') || urlParams.get('page') === 'replay-window') {
    document.body.classList.add('tab-mode');
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
});
