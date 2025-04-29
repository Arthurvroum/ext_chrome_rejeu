/**
 * Service Worker Compatibility Helper
 * Provides utilities for working with both window and service worker contexts
 */

// Detect context - service worker or window
const isServiceWorker = typeof self !== 'undefined' && typeof window === 'undefined';
const isWindow = typeof window !== 'undefined';

// Global context reference that works in both environments
const globalContext = isServiceWorker ? self : (isWindow ? window : {});

// Log the detected environment
console.log(`Running in ${isServiceWorker ? 'service worker' : (isWindow ? 'window' : 'unknown')} context`);

// Make utilities available in global context
const utilities = {
  isServiceWorker,
  isWindow,
  globalContext,
  getGlobal,
  setGlobal,
  log: logMessage
};

// Export to the global context
if (isServiceWorker) {
  Object.assign(self, utilities);
} else if (isWindow) {
  Object.assign(window, utilities);
}

// Safe accessor for global objects - gets from the appropriate context
function getGlobal(name) {
  if (isServiceWorker) {
    return self[name];
  } else if (isWindow) {
    return window[name];
  }
  return undefined;
}

// Safe setter for global objects - sets in the appropriate context
function setGlobal(name, value) {
  if (isServiceWorker) {
    self[name] = value;
  } else if (isWindow) {
    window[name] = value;
  }
}

// Log helper that works in both contexts
function logMessage(level, message, data) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}]`;
  
  if (data !== undefined) {
    console[level](`${prefix} ${message}`, data);
  } else {
    console[level](`${prefix} ${message}`);
  }
}

// Ensure console methods are available
if (typeof console === 'undefined') {
  const globalScope = isServiceWorker ? self : (isWindow ? window : {});
  globalScope.console = {
    log: function() {},
    error: function() {},
    warn: function() {},
    info: function() {}
  };
}
