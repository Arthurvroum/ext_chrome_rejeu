<template>
  <div class="variable-capture">
    <h4>Variable Capture</h4>
    
    <div class="capture-form">
      <div class="form-row">
        <div class="form-group">
          <label>Variable Name:</label>
          <input type="text" v-model="captureName" placeholder="e.g. authToken">
        </div>
        
        <div class="form-group">
          <label>Regex Pattern:</label>
          <input type="text" v-model="captureRegex" placeholder="e.g. token:([A-Za-z0-9]+)">
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>Source:</label>
          <select v-model="captureSource">
            <option value="responseBody">Response Body</option>
            <option value="responseHeaders">Response Headers</option>
            <option value="url">URL</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>
            <input type="checkbox" v-model="captureRequired">
            Required
          </label>
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>
            <input type="checkbox" v-model="captureFailOnError">
            Fail on Error
          </label>
        </div>
        
        <div class="form-group">
          <label>Scope:</label>
          <select v-model="captureScope">
            <option value="global">Global</option>
            <option value="step">This Step Only</option>
          </select>
        </div>
      </div>
      
      <button 
        @click="addCapture" 
        :disabled="!isValid"
        class="add-button"
      >
        Add Variable Capture
      </button>
    </div>
    
    <div v-if="hasCaptureConfig" class="existing-captures">
      <h5>Existing Captures:</h5>
      <div 
        v-for="(capture, index) in request.variableCapture" 
        :key="index" 
        class="capture-item"
      >
        <div class="capture-info">
          <strong>{{ capture.name }}</strong> - {{ capture.regex }}
          <span class="capture-source">({{ capture.source }})</span>
        </div>
        <button class="remove-button" @click="removeCapture(index)">✕</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'VariableCaptureForm',
  props: {
    request: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      captureName: '',
      captureRegex: '',
      captureSource: 'responseBody',
      captureRequired: true,
      captureFailOnError: false,
      captureScope: 'global'
    }
  },
  computed: {
    isValid() {
      return this.captureName && this.captureRegex;
    },
    hasCaptureConfig() {
      return this.request.variableCapture && this.request.variableCapture.length > 0;
    }
  },
  methods: {
    addCapture() {
      if (!this.isValid) return;
      
      const captureConfig = {
        name: this.captureName,
        regex: this.captureRegex,
        source: this.captureSource,
        required: this.captureRequired,
        failOnError: this.captureFailOnError,
        scope: this.captureScope
      };
      
      this.$emit('add-capture', captureConfig);
      
      // Reset form
      this.captureName = '';
      this.captureRegex = '';
    },
    
    removeCapture(index) {
      if (!this.request.variableCapture) return;
      
      // Create a copy of the array
      const updatedCaptures = [...this.request.variableCapture];
      updatedCaptures.splice(index, 1);
      
      // Update the request
      this.request.variableCapture = updatedCaptures;
      this.$emit('update-request', this.request);
    }
  }
}
</script>

<style scoped>
.variable-capture {
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 5px;
  margin-top: 15px;
}

h4 {
  margin: 0 0 10px 0;
  color: #495057;
}

.capture-form {
  background-color: white;
  padding: 15px;
  border-radius: 5px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}

.form-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.form-group {
  flex: 1;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
}

input[type="text"], select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
}

.add-button {
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 15px;
  cursor: pointer;
  font-weight: bold;
  margin-top: 10px;
  width: 100%;
}

.add-button:hover:not(:disabled) {
  background-color: #0069d9;
}

.add-button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
  opacity: 0.65;
}

.existing-captures {
  margin-top: 15px;
}

h5 {
  margin: 0 0 10px 0;
  font-size: 14px;
}

.capture-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: white;
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 5px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.capture-info {
  flex: 1;
}

.capture-source {
  color: #6c757d;
  font-size: 12px;
}

.remove-button {
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  font-size: 12px;
  padding: 0;
}

.remove-button:hover {
  background-color: #c82333;
}
</style>
