// Tab manager for chrome extension

// Store tab references
let advancedTabId = null;
let replayTabId = null;

// Use existing global context if available, or define local reference
const tabManagerGlobal = typeof globalContext !== 'undefined' ? globalContext : 
                      (typeof self !== 'undefined' ? self : 
                       (typeof window !== 'undefined' ? window : {}));

// Listen for messages to open tabs
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Tab Manager received message:', request.action);
  
  if (request.action === 'openAdvancedWindow') {
    openAdvancedTab(request.tab || 'record', sendResponse);
    return true; // Keep the message channel open for async response
  }
  else if (request.action === 'openReplayWindow') {
    openReplayTab(request.data, sendResponse);
    return true;
  }
  else if (request.action === 'updateReplayProgress') {
    updateReplayProgress(request.progressData, sendResponse);
    return true;
  }
  return false;
});

// Function to open the advanced tab
function openAdvancedTab(tab = 'record', callback) {
  console.log('Opening advanced tab:', tab);
  // Save replay data to storage for the new tab to access
  chrome.storage.local.set({
    openingAdvancedTab: true,
    advancedTabType: tab
  }, () => {
    // Create a new tab
    chrome.tabs.create({
      url: chrome.runtime.getURL(`index.html?tab=${tab}`),
      active: true
    }, (tab) => {
      advancedTabId = tab.id;
      if (callback) callback({ success: true, tabId: tab.id });
    });
  });
}

// Improve the function to open a replay tab with better logging and data verification
function openReplayTab(replayData, callback) {
  // Validate data first
  const dataLength = replayData ? (Array.isArray(replayData) ? replayData.length : 0) : 0;
  console.log('Opening replay tab with valid data:', dataLength, 'items');
  
  if (!replayData || dataLength === 0) {
    console.warn('No replay data provided or empty data array');
  }
  
  // Add extra data validation
  const validatedData = Array.isArray(replayData) ? JSON.parse(JSON.stringify(replayData)) : [];
  
  // Use a try-catch block for more robust error handling
  try {
    // Save replay data to storage with robust approach
    chrome.storage.local.set({ 
      replayWindowData: validatedData,
      latestRecordedData: validatedData, // Set both keys for redundancy
      replayWindowDataCount: validatedData.length,
      isLiveReplay: true,
      dataTimestamp: Date.now() // Add timestamp to prevent caching issues
    }, () => {
      // Verify data was saved successfully before opening the tab
      chrome.storage.local.get(['replayWindowData'], (result) => {
        const savedCount = result.replayWindowData ? result.replayWindowData.length : 0;
        console.log('Verified saved data:', savedCount, 'items');
        
        if (savedCount === 0 && dataLength > 0) {
          console.error('Critical error: Storage failed to save data');
          
          // Attempt emergency direct data passing via URL state param
          let stateParam = '';
          try {
            // Only pass minimal data via URL if absolutely necessary
            const minimalData = validatedData.map(req => ({
              url: req.url,
              method: req.method
            }));
            
            if (minimalData.length <= 20) { // Limit to prevent URL length issues
              stateParam = `&state=${encodeURIComponent(JSON.stringify({
                directData: true,
                count: minimalData.length
              }))}`;
            }
          } catch (e) {
            console.error('Failed to create state param:', e);
          }
          
          // Now open the tab
          chrome.tabs.create({
            url: chrome.runtime.getURL(`index.html?page=replay-window${stateParam}`),
            active: true
          }, (tab) => {
            replayTabId = tab.id;
            if (callback) callback({ 
              success: true, 
              tabId: tab.id,
              dataCount: validatedData.length,
              storageFailed: true
            });
          });
        } else {
          // Normal tab creation path
          chrome.tabs.create({
            url: chrome.runtime.getURL("index.html?page=replay-window"),
            active: true
          }, (tab) => {
            replayTabId = tab.id;
            if (callback) callback({ 
              success: true, 
              tabId: tab.id,
              dataCount: validatedData.length 
            });
          });
        }
      });
    });
  } catch (error) {
    console.error('Error in openReplayTab:', error);
    // Fallback: Still try to open the tab even if there's an error
    chrome.tabs.create({
      url: chrome.runtime.getURL("index.html?page=replay-window&error=true"),
      active: true
    }, (tab) => {
      replayTabId = tab.id;
      if (callback) callback({ 
        success: false, 
        tabId: tab.id,
        error: error.message
      });
    });
  }
}

// Function to update replay progress in the replay tab
function updateReplayProgress(progressData, callback) {
  // Store progress data for the replay tab to access
  chrome.storage.local.set({ 
    replayProgress: progressData,
    replayProgressTimestamp: Date.now()
  }, () => {
    // Notify all tabs that there's new progress data
    chrome.runtime.sendMessage({ action: 'replayProgressUpdated', data: progressData });
    if (callback) callback({ success: true });
  });
}

// Track tab closures
chrome.tabs.onRemoved.addListener((tabId) => {
  if (advancedTabId === tabId) {
    advancedTabId = null;
  }
  if (replayTabId === tabId) {
    replayTabId = null;
    // Clear replay data when tab is closed
    chrome.storage.local.remove(['replayWindowData', 'isLiveReplay', 'replayProgress']);
  }
});

// Make these functions available globally
// Use existing globalContext if available
if (typeof tabManagerGlobal !== 'undefined') {
  // Export the functions to the global scope
  tabManagerGlobal.tabManager = {
    openAdvancedTab,
    openReplayTab,
    updateReplayProgress
  };
  
  // Also export as individual functions for direct access
  tabManagerGlobal.openAdvancedTab = openAdvancedTab;
  tabManagerGlobal.openReplayTab = openReplayTab;
  tabManagerGlobal.updateReplayProgress = updateReplayProgress;
}

console.log('Tab manager loaded - version 1.5');