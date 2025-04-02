/**
 * Troubleshooting script for Network Recorder Extension
 * 
 * To use: add a button to your popup/options page that calls:
 * runDiagnostics()
 */

// Main diagnostic function
async function runDiagnostics() {
  console.log('Starting extension diagnostics...');
  const results = {
    time: new Date().toISOString(),
    browserInfo: {},
    permissionsStatus: {},
    contentScriptStatus: {},
    backgroundStatus: {},
    storageStatus: {},
    communicationTests: {}
  };
  
  // 1. Get browser info
  results.browserInfo = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    vendor: navigator.vendor
  };
  
  // 2. Check permissions
  try {
    results.permissionsStatus.webRequest = await checkPermission('webRequest');
    results.permissionsStatus.tabs = await checkPermission('tabs');
    results.permissionsStatus.storage = await checkPermission('storage');
    results.permissionsStatus.scripting = await checkPermission('scripting');
  } catch (e) {
    results.permissionsStatus.error = e.message;
  }
  
  // 3. Test background script
  try {
    const bgResponse = await sendMessagePromise({ action: 'checkExtensionStatus' });
    results.backgroundStatus.isResponding = !!bgResponse;
    results.backgroundStatus.details = bgResponse;
  } catch (e) {
    results.backgroundStatus.isResponding = false;
    results.backgroundStatus.error = e.message;
  }
  
  // 4. Test storage
  try {
    await chrome.storage.local.set({ diagnoseTest: 'test-value' });
    const data = await chrome.storage.local.get('diagnoseTest');
    results.storageStatus.working = data.diagnoseTest === 'test-value';
    await chrome.storage.local.remove('diagnoseTest');
  } catch (e) {
    results.storageStatus.working = false;
    results.storageStatus.error = e.message;
  }
  
  // 5. Check current tab's content script
  try {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (tabs.length > 0) {
      results.contentScriptStatus.activeTabId = tabs[0].id;
      
      try {
        const response = await sendTabMessagePromise(tabs[0].id, { action: 'getObserverStatus' });
        results.contentScriptStatus.responding = true;
        results.contentScriptStatus.details = response;
      } catch (e) {
        results.contentScriptStatus.responding = false;
        results.contentScriptStatus.error = e.message;
      }
    }
  } catch (e) {
    results.contentScriptStatus.error = e.message;
  }
  
  // Print results to console
  console.log('Diagnostic Results:', results);
  
  // Create a visual report
  const report = formatResults(results);
  document.body.innerHTML += report;
  
  return results;
}

// Format the diagnostic results into HTML
function formatResults(results) {
  // Create a nicely formatted HTML representation
  return `
    <div style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.8); z-index:9999; overflow:auto; padding:20px; color:white; font-family:monospace;">
      <h2>Extension Diagnostics</h2>
      <p><strong>Time:</strong> ${results.time}</p>
      
      <h3>Browser Info</h3>
      <pre>${JSON.stringify(results.browserInfo, null, 2)}</pre>
      
      <h3>Permissions Status</h3>
      <pre>${JSON.stringify(results.permissionsStatus, null, 2)}</pre>
      
      <h3>Background Script</h3>
      <pre>${JSON.stringify(results.backgroundStatus, null, 2)}</pre>
      
      <h3>Storage Status</h3>
      <pre>${JSON.stringify(results.storageStatus, null, 2)}</pre>
      
      <h3>Content Script Status</h3>
      <pre>${JSON.stringify(results.contentScriptStatus, null, 2)}</pre>
      
      <p><button onclick="this.parentNode.parentNode.remove()" style="padding:10px; margin-top:20px;">Close</button></p>
    </div>
  `;
}

// Helper functions
async function checkPermission(permission) {
  try {
    const response = await chrome.permissions.contains({ permissions: [permission] });
    return response;
  } catch (e) {
    return { granted: false, error: e.message };
  }
}

// Promise wrapper for chrome.runtime.sendMessage
function sendMessagePromise(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

// Promise wrapper for chrome.tabs.sendMessage
function sendTabMessagePromise(tabId, message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

// Make diagnostic function globally available
window.runDiagnostics = runDiagnostics;
