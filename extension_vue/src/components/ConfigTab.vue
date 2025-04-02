<template>
  <div class="config-tab">
    <h3>Configuration</h3>
    
    <div class="config-section">
      <h4>General Settings</h4>
      
      <div class="form-group">
        <label for="max-requests">Maximum Requests to Record:</label>
        <input type="number" id="max-requests" v-model.number="config.maxRequests" min="1">
      </div>
      
      <div class="form-group">
        <label for="request-timeout">Request Timeout (ms):</label>
        <input type="number" id="request-timeout" v-model.number="config.requestTimeout" min="1000">
      </div>
      
      <div class="form-group">
        <label>
          <input type="checkbox" v-model="config.recordRequestHeaders">
          Record Request Headers
        </label>
      </div>
      
      <div class="form-group">
        <label>
          <input type="checkbox" v-model="config.recordRequestBody">
          Record Request Body
        </label>
      </div>
      
      <div class="form-group">
        <label>
          <input type="checkbox" v-model="config.recordResponseHeaders">
          Record Response Headers
        </label>
      </div>
      
      <div class="form-group">
        <label>
          <input type="checkbox" v-model="config.recordResponseBody">
          Record Response Body
        </label>
      </div>
    </div>
    
    <div class="config-section">
      <h4>URL Filtering</h4>
      
      <p>Only record requests that match these patterns (one per line):</p>
      <textarea 
        v-model="urlIncludePatterns" 
        placeholder="Example: https://api.example.com/*"
        rows="4"
      ></textarea>
      
      <p>Exclude requests that match these patterns (one per line):</p>
      <textarea 
        v-model="urlExcludePatterns" 
        placeholder="Example: https://analytics.example.com/*"
        rows="4"
      ></textarea>
    </div>
    
    <div class="config-section">
      <h4>Default Execution Options</h4>
      
      <div class="form-group">
        <label>
          <input type="checkbox" v-model="config.defaultExecutionOptions.stopOnError">
          Stop on First Error
        </label>
      </div>
      
      <div class="form-group">
        <label>
          <input type="checkbox" v-model="config.defaultExecutionOptions.ignoreSSLErrors">
          Ignore SSL Certificate Errors
        </label>
      </div>
      
      <div class="form-group">
        <label for="default-timeout">Default Request Timeout (ms):</label>
        <input type="number" id="default-timeout" v-model.number="config.defaultExecutionOptions.timeout" min="1000">
      </div>
      
      <div class="form-group">
        <label for="max-retries">Max Retries on Failure:</label>
        <input type="number" id="max-retries" v-model.number="config.defaultExecutionOptions.maxRetries" min="0">
      </div>
    </div>
    
    <div class="config-section">
      <h4>Default Variable Options</h4>
      
      <div class="form-group">
        <label>
          <input type="checkbox" v-model="config.defaultVariableOptions.required">
          Variables Required by Default
        </label>
      </div>
      
      <div class="form-group">
        <label>
          <input type="checkbox" v-model="config.defaultVariableOptions.failOnError">
          Fail on Variable Capture Error
        </label>
      </div>
      
      <div class="form-group">
        <label for="variable-scope">Default Variable Scope:</label>
        <select id="variable-scope" v-model="config.defaultVariableOptions.scope">
          <option value="global">Global</option>
          <option value="scenario">Scenario</option>
          <option value="step">Step Only</option>
        </select>
      </div>
    </div>
    
    <div class="action-buttons">
      <button @click="saveConfig">Save Configuration</button>
      <button @click="resetConfig">Reset to Defaults</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ConfigTab',
  data() {
    return {
      config: {
        maxRequests: 100,
        requestTimeout: 30000,
        recordRequestHeaders: true,
        recordRequestBody: true,
        recordResponseHeaders: true,
        recordResponseBody: true,
        urlIncludePatterns: [],
        urlExcludePatterns: [],
        defaultExecutionOptions: {
          stopOnError: true,
          ignoreSSLErrors: false,
          timeout: 30000,
          maxRetries: 3
        },
        defaultVariableOptions: {
          required: true,
          failOnError: true,
          scope: 'global'
        }
      },
      urlIncludePatterns: '',
      urlExcludePatterns: ''
    }
  },
  mounted() {
    this.loadConfig();
  },
  methods: {
    loadConfig() {
      // Load configuration from storage
      chrome.storage.local.get('recordReplayConfig', (result) => {
        if (result.recordReplayConfig) {
          this.config = result.recordReplayConfig;
          this.urlIncludePatterns = this.config.urlIncludePatterns.join('\n');
          this.urlExcludePatterns = this.config.urlExcludePatterns.join('\n');
        }
      });
    },
    saveConfig() {
      // Parse the URL patterns from text areas
      this.config.urlIncludePatterns = this.urlIncludePatterns
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      this.config.urlExcludePatterns = this.urlExcludePatterns
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      // Save to storage
      chrome.storage.local.set({ 'recordReplayConfig': this.config }, () => {
        alert('Configuration saved');
      });
    },
    resetConfig() {
      if (confirm('Reset all settings to defaults?')) {
        this.config = {
          maxRequests: 100,
          requestTimeout: 30000,
          recordRequestHeaders: true,
          recordRequestBody: true,
          recordResponseHeaders: true,
          recordResponseBody: true,
          urlIncludePatterns: [],
          urlExcludePatterns: [],
          defaultExecutionOptions: {
            stopOnError: true,
            ignoreSSLErrors: false,
            timeout: 30000,
            maxRetries: 3
          },
          defaultVariableOptions: {
            required: true,
            failOnError: true,
            scope: 'global'
          }
        };
        
        this.urlIncludePatterns = '';
        this.urlExcludePatterns = '';
        
        chrome.storage.local.remove('recordReplayConfig', () => {
          alert('Configuration reset to defaults');
        });
      }
    }
  }
}
</script>

<style scoped>
.config-tab {
  text-align: left;
}

.config-section {
  margin-bottom: 25px;
  padding: 15px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
}

h3, h4 {
  margin-top: 0;
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 5px;
}

input[type="number"], select {
  width: 200px;
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
}

textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-family: monospace;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

button {
  padding: 8px 15px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #0069d9;
}

button:last-child {
  background-color: #6c757d;
}

button:last-child:hover {
  background-color: #5a6268;
}
</style>
