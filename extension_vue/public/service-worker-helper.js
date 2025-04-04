/**
 * Helper utilities for Chrome Extension Manifest V3 service worker compatibility
 */

// Service worker global scope helper
const isServiceWorker = typeof window === 'undefined';
const globalScope = isServiceWorker ? self : window;

// Safe accessor for global variables 
function getGlobal(name) {
  if (isServiceWorker) {
    return self[name];
  } else {
    return window[name];
  }
}

// Safe setter for global variables
function setGlobal(name, value) {
  if (isServiceWorker) {
    self[name] = value;
  } else {
    window[name] = value;
  }
}

// Make utilities globally available in the appropriate context
const utilities = {
  isServiceWorker,
  globalScope,
  getGlobal,
  setGlobal
};

// Export the utilities to the appropriate global scope
if (isServiceWorker) {
  Object.assign(self, utilities);
} else {
  Object.assign(window, utilities);
}

// Log the environment
console.log(`Running in ${isServiceWorker ? 'service worker' : 'window'} context`);
