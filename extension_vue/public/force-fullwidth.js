/**
 * Force fullwidth layout for tab mode
 */

// Apply full width styles to the document
function forceFullWidth() {
  // Check if we're in tab mode
  const urlParams = new URLSearchParams(window.location.search);
  const isTabMode = urlParams.get('tab') || urlParams.get('page') === 'replay-window';
  
  if (!isTabMode) return;
  
  console.log('Forcing full width layout for tab mode');
  
  // Force HTML and body to take full width and height
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
  
  // Force the app container to take full width
  const appElement = document.getElementById('app');
  if (appElement) {
    appElement.style.cssText = `
      width: 100vw !important;
      height: 100vh !important;
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
    `;
    
    // Also ensure all direct children take full width
    for (let i = 0; i < appElement.children.length; i++) {
      const child = appElement.children[i];
      child.style.cssText += `
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        box-sizing: border-box !important;
      `;
    }
  }
  
  // Add a class to the body for CSS targeting
  document.body.classList.add('force-fullwidth');
  
  console.log('Full width layout applied');
}

// Run on DOMContentLoaded and after window load
document.addEventListener('DOMContentLoaded', forceFullWidth);
window.addEventListener('load', () => {
  forceFullWidth();
  // Run again after a short delay to ensure Vue has rendered
  setTimeout(forceFullWidth, 100);
});

console.log('Force full width script loaded');
