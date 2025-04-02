/**
 * Utility to properly size the popup window
 */

// Function to properly size the popup
function resizePopupToFit() {
  // Check if we're in a popup context (not a tab)
  const isPopup = window.location.search === '';
  
  if (!isPopup) return;
  
  console.log("Popup detected, applying proper sizing");
  
  // Set body styles directly with !important to override any other styles
  document.body.style.cssText = `
    width: 600px !important;
    height: 600px !important;
    min-width: 600px !important;
    min-height: 600px !important;
    overflow: auto !important;
  `;
  
  // Get the app element
  const app = document.getElementById('app');
  
  if (app) {
    // Ensure the app has proper sizing with !important
    app.style.cssText = `
      width: 600px !important;
      height: 600px !important;
      min-height: 600px !important;
      overflow: auto !important;
    `;
    
    // Apply the popup class
    document.body.classList.add('popup-mode');
  }
  
  // Force document dimensions
  document.documentElement.style.cssText = `
    min-height: 600px !important;
    min-width: 600px !important;
    overflow: auto !important;
  `;
}

// Run on load and resize
window.addEventListener('DOMContentLoaded', function() {
  console.log("DOM Content Loaded - sizing popup");
  setTimeout(resizePopupToFit, 0);
});

window.addEventListener('load', function() {
  console.log("Window Loaded - sizing popup");
  setTimeout(resizePopupToFit, 0);
  // Also set after a slight delay to ensure it takes effect
  setTimeout(resizePopupToFit, 500);
});

// Make this available globally
window.popupSizer = {
  resize: resizePopupToFit
};

console.log("Popup sizer loaded");
