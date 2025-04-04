/**
 * Storage debugging utility for chrome extension
 * This helps diagnose issues with data transfer between tabs
 */

// Print all storage items for debugging
function dumpStorageContents() {
  chrome.storage.local.get(null, (items) => {
    console.log('Chrome storage contents:', items);
    
    // Display information about key data structures
    if (items.latestRecordedData) {
      console.log('Latest recorded data:', {
        count: items.latestRecordedData.length,
        firstItem: items.latestRecordedData[0],
        lastItem: items.latestRecordedData[items.latestRecordedData.length - 1]
      });
    } else {
      console.log('No latestRecordedData found in storage');
    }
    
    if (items.replayWindowData) {
      console.log('Replay window data:', {
        count: items.replayWindowData.length,
        firstItem: items.replayWindowData[0],
        lastItem: items.replayWindowData[items.replayWindowData.length - 1]
      });
    } else {
      console.log('No replayWindowData found in storage');
    }
  });
}

// Clear storage for testing
function clearStorage() {
  chrome.storage.local.clear(() => {
    console.log('Storage cleared');
    dumpStorageContents();
  });
}

// Monitor storage changes
function monitorStorageChanges() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    console.log(`Storage changed in ${areaName}:`, changes);
    
    // Look specifically for our key data
    if (changes.latestRecordedData) {
      const newCount = changes.latestRecordedData.newValue ? changes.latestRecordedData.newValue.length : 0;
      const oldCount = changes.latestRecordedData.oldValue ? changes.latestRecordedData.oldValue.length : 0;
      console.log(`latestRecordedData changed: ${oldCount} -> ${newCount} items`);
    }
    
    if (changes.replayWindowData) {
      const newCount = changes.replayWindowData.newValue ? changes.replayWindowData.newValue.length : 0;
      const oldCount = changes.replayWindowData.oldValue ? changes.replayWindowData.oldValue.length : 0;
      console.log(`replayWindowData changed: ${oldCount} -> ${newCount} items`);
    }
  });
}

// Initialize debugging tools
function initStorageDebug() {
  console.log('Storage debugging tools initialized');
  monitorStorageChanges();
  dumpStorageContents();
}

// Make functions available globally
window.storageDebug = {
  dump: dumpStorageContents,
  clear: clearStorage,
  init: initStorageDebug
};

// Auto-start monitoring
monitorStorageChanges();
