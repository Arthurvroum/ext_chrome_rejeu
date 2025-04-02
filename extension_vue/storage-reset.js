// This script clears extension storage
chrome.storage.local.clear(() => {
  console.log('Extension storage has been cleared');
});
