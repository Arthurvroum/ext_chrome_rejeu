// Tab manager for chrome extension - using standard script approach (non-ES module)

// Store tab references
let advancedTabId = null;
let replayTabId = null;

// Function to open the advanced tab
function openAdvancedTab(tab = 'record', callback) {
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

// Function to open a dedicated replay tab
function openReplayTab(replayData, callback) {
  console.log('Opening replay tab with data:', replayData?.length || 0, 'items');
  // Save replay data to storage for the new tab to access
  chrome.storage.local.set({ 
    replayWindowData: replayData,
    isLiveReplay: true 
  }, () => {
    // Create a new tab
    chrome.tabs.create({
      url: chrome.runtime.getURL("index.html?page=replay-window"),
      active: true
    }, (tab) => {
      replayTabId = tab.id;
      if (callback) callback({ success: true, tabId: tab.id });
    });
  });
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

console.log('Tab manager loaded - version 1.2');

// No global exposure needed - functions will be available directly via importScripts