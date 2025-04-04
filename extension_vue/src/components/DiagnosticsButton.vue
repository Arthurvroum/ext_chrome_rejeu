<template>
  <div class="diagnostics-wrapper">
    <button @click="runDiagnostics" class="diagnostics-button">
      Diagnostics
    </button>
    <div v-if="showResults" class="diagnostics-results">
      <h3>Extension Diagnostics</h3>
      <p><strong>Time:</strong> {{ results.time }}</p>
      
      <h4>Background Script</h4>
      <pre v-if="results.backgroundStatus">{{ formatJson(results.backgroundStatus) }}</pre>
      
      <h4>Content Script Status</h4>
      <pre v-if="results.contentScriptStatus">{{ formatJson(results.contentScriptStatus) }}</pre>
      
      <div class="tab-functions">
        <h4>Tab Functions</h4>
        <button @click="testAdvancedTab" class="test-button">Test Advanced Tab</button>
        <button @click="testReplayTab" class="test-button">Test Replay Tab</button>
      </div>
      
      <div class="action-buttons">
        <button @click="showResults = false">Close</button>
        <button @click="runDiagnostics">Refresh</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DiagnosticsButton',
  data() {
    return {
      showResults: false,
      results: {
        time: '',
        backgroundStatus: null,
        contentScriptStatus: null
      }
    }
  },
  methods: {
    async runDiagnostics() {
      this.results.time = new Date().toISOString();
      this.showResults = true;
      
      // Test background script
      try {
        this.results.backgroundStatus = await this.sendMessagePromise({ 
          action: 'checkExtensionStatus' 
        });
      } catch (e) {
        this.results.backgroundStatus = { 
          isResponding: false, 
          error: e.message 
        };
      }
      
      // Test content script in active tab
      try {
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        if (tabs.length > 0) {
          try {
            const response = await this.sendTabMessagePromise(
              tabs[0].id, 
              { action: 'pingContentScript' }
            );
            this.results.contentScriptStatus = {
              responding: true,
              tabId: tabs[0].id,
              details: response
            };
          } catch (e) {
            this.results.contentScriptStatus = {
              responding: false,
              tabId: tabs[0].id,
              error: e.message
            };
          }
        }
      } catch (e) {
        this.results.contentScriptStatus = { error: e.message };
      }
    },
    
    // Promise wrapper for chrome.runtime.sendMessage
    sendMessagePromise(message) {
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
    },
    
    // Promise wrapper for chrome.tabs.sendMessage
    sendTabMessagePromise(tabId, message) {
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
    },
    
    formatJson(data) {
      if (!data) return 'No data available';
      
      try {
        if (typeof data === 'object') {
          return JSON.stringify(data, null, 2);
        } else if (typeof data === 'string') {
          // Try to parse as JSON if it's a string
          try {
            const parsed = JSON.parse(data);
            return JSON.stringify(parsed, null, 2);
          } catch {
            // If parsing fails, just return the string
            return data;
          }
        }
        return String(data);
      } catch (e) {
        console.error('Error formatting JSON:', e);
        return String(data);
      }
    },
    
    testAdvancedTab() {
      console.log('Testing advanced tab opening...');
      chrome.runtime.sendMessage({
        action: 'openAdvancedWindow',
        tab: 'record'
      }, (response) => {
        console.log('Advanced tab response:', response);
        if (!response || !response.success) {
          alert('Failed to open advanced tab. Check console for details.');
        }
      });
    },
    
    testReplayTab() {
      console.log('Testing replay tab opening...');
      const sampleData = [{ method: 'GET', url: 'https://example.com/test' }];
      
      chrome.runtime.sendMessage({
        action: 'openReplayWindow',
        data: sampleData
      }, (response) => {
        console.log('Replay tab response:', response);
        if (!response || !response.success) {
          alert('Failed to open replay tab. Check console for details.');
        }
      });
    }
  }
}
</script>

<style scoped>
.diagnostics-wrapper {
  position: relative;
}

.diagnostics-button {
  background-color: #17a2b8;
  color: white;
  border: none;
  padding: 5px 10px;
  font-size: 0.8rem;
  border-radius: 4px;
  cursor: pointer;
}

.diagnostics-results {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80%;
  max-width: 600px;
  max-height: 80vh;
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.3);
  z-index: 9999;
  overflow: auto;
  text-align: left;
}

h3, h4 {
  margin-top: 0;
}

pre {
  background-color: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  overflow: auto;
  max-height: 200px;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.action-buttons button {
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  border: none;
  background-color: #6c757d;
  color: white;
}

.action-buttons button:last-child {
  background-color: #007bff;
}

.tab-functions {
  margin-top: 15px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.test-button {
  margin-right: 10px;
  padding: 5px 10px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.test-button:hover {
  background-color: #0056b3;
}
</style>
