/**
 * Storage debugging helper for Chrome Extension
 */

// Print all storage contents
function dumpStorageContents() {
  chrome.storage.local.get(null, (items) => {
    console.log('===== STORAGE CONTENTS =====');
    console.log('All keys:', Object.keys(items));
    
    // Check specific data structures
    if (items.latestRecordedData) {
      console.log('latestRecordedData:', {
        count: items.latestRecordedData.length,
        sample: items.latestRecordedData.slice(0, 2)
      });
    } else {
      console.log('latestRecordedData: not found');
    }
    
    if (items.replayWindowData) {
      console.log('replayWindowData:', {
        count: items.replayWindowData.length,
        sample: items.replayWindowData.slice(0, 2)
      });
    } else {
      console.log('replayWindowData: not found');
    }
    
    console.log('===== END STORAGE CONTENTS =====');
  });
}

// Listen for storage changes
function monitorStorageChanges() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    console.log(`Storage changed in ${areaName}:`, changes);
    
    if (changes.replayWindowData) {
      const newCount = changes.replayWindowData.newValue ? changes.replayWindowData.newValue.length : 0;
      const oldCount = changes.replayWindowData.oldValue ? changes.replayWindowData.oldValue.length : 0;
      console.log(`replayWindowData changed: ${oldCount} -> ${newCount} items`);
    }
    
    if (changes.latestRecordedData) {
      const newCount = changes.latestRecordedData.newValue ? changes.latestRecordedData.newValue.length : 0;
      const oldCount = changes.latestRecordedData.oldValue ? changes.latestRecordedData.oldValue.length : 0;
      console.log(`latestRecordedData changed: ${oldCount} -> ${newCount} items`);
    }
  });
}

// Make debugging tools available globally
window.storageDebugger = {
  dump: dumpStorageContents,
  monitor: monitorStorageChanges,
  clear: () => { chrome.storage.local.clear(() => console.log('Storage cleared')); }
};

// Auto-initialize monitoring
monitorStorageChanges();
console.log('Storage debugger loaded. Access with window.storageDebugger');
