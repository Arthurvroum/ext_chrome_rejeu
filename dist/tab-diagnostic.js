/**
 * Tab opening diagnostic utility
 * This helps debug issues with tab opening functionality
 */

// Test opening advanced tab
function testOpenAdvancedTab() {
  console.log('Testing openAdvancedTab...');
  chrome.runtime.sendMessage({
    action: 'openAdvancedWindow',
    tab: 'record'
  }, (response) => {
    console.log('Advanced tab open response:', response);
    if (!response || !response.success) {
      console.error('Failed to open advanced tab through messaging');
      // Try direct method
      tryDirectTabOpen('record');
    }
  });
}

// Test opening replay tab
function testOpenReplayTab() {
  console.log('Testing openReplayTab...');
  
  // Create sample data
  const sampleData = [
    { method: 'GET', url: 'https://example.com/api/test' }
  ];
  
  chrome.runtime.sendMessage({
    action: 'openReplayWindow',
    data: sampleData
  }, (response) => {
    console.log('Replay tab open response:', response);
    if (!response || !response.success) {
      console.error('Failed to open replay tab through messaging');
      // Try direct method
      tryDirectTabOpen('replay');
    }
  });
}

// Fallback direct tab opening
function tryDirectTabOpen(mode) {
  let url = 'index.html';
  if (mode === 'replay') {
    url += '?page=replay-window';
  } else {
    url += `?tab=${mode}`;
  }
  
  chrome.tabs.create({
    url: chrome.runtime.getURL(url),
    active: true
  }, (tab) => {
    console.log(`Opened ${mode} tab directly with ID:`, tab.id);
  });
}

// Run all tests
function runTabTests() {
  console.log('Starting tab opening diagnostic tests...');
  
  // Test message passing first
  chrome.runtime.sendMessage({ action: 'checkExtensionStatus' }, (response) => {
    console.log('Extension status check:', response);
    
    // Only continue if background responded
    if (response) {
      setTimeout(testOpenAdvancedTab, 1000);
      
      // Run replay test after a delay
      setTimeout(testOpenReplayTab, 3000);
    } else {
      console.error('Background script not responding');
      alert('Background script not responding');
    }
  });
}

// Export diagnostic functions
window.tabDiagnostic = {
  testAdvancedTab: testOpenAdvancedTab,
  testReplayTab: testOpenReplayTab,
  runAll: runTabTests
};

console.log('Tab diagnostic tools loaded');
