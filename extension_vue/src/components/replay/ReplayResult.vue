<template>
  <div 
    class="result-item"
    :class="{ 'success': result.status === 'success', 'error': result.status === 'error', 'skipped': result.status === 'skipped' }"
  >
    <div class="result-header">
      <span class="result-step">{{ result.step }}</span>
      <span class="result-status">{{ result.status }}</span>
    </div>
    
    <div class="result-details" v-if="expanded">
      <div v-if="result.status === 'error'">
        <h5>Error</h5>
        <pre>{{ result.error }}</pre>
      </div>
      
      <div v-if="result.status === 'success'">
        <div class="detail-section">
          <h5>Request</h5>
          <pre>{{ formatJson(result.request) }}</pre>
        </div>
        
        <div class="detail-section">
          <h5>Response</h5>
          <pre>{{ formatJson(result.response) }}</pre>
        </div>
        
        <div class="detail-section" v-if="result.capturedVariables && Object.keys(result.capturedVariables).length">
          <h5>Captured Variables</h5>
          <pre>{{ formatJson(result.capturedVariables) }}</pre>
        </div>
      </div>
    </div>
    
    <button class="toggle-details" @click="toggleDetails">
      {{ expanded ? 'Hide Details' : 'Show Details' }}
    </button>
  </div>
</template>

<script>
import { formatJson } from '../../utils/formatting';

export default {
  name: 'ReplayResult',
  props: {
    result: {
      type: Object,
      required: true
    },
    expanded: {
      type: Boolean,
      default: false
    }
  },
  methods: {
    formatJson,
    toggleDetails() {
      this.$emit('toggle-details');
    }
  }
}
</script>

<style scoped>
.result-item {
  border: 1px solid #dee2e6;
  border-radius: 10px;
  margin-bottom: 15px;
  padding: 20px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.05);
  transition: all 0.3s ease;
}

.result-item:hover {
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.result-item.success {
  border-left: 6px solid #28a745;
}

.result-item.error {
  border-left: 6px solid #dc3545;
}

.result-item.skipped {
  border-left: 6px solid #ffc107;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-step {
  font-weight: bold;
  font-size: 1.2rem;
}

.result-status {
  padding: 5px 10px;
  border-radius: 20px;
  font-weight: bold;
  text-transform: uppercase;
  font-size: 0.8rem;
}

.success .result-status {
  background-color: #d4edda;
  color: #155724;
}

.error .result-status {
  background-color: #f8d7da;
  color: #721c24;
}

.skipped .result-status {
  background-color: #fff3cd;
  color: #856404;
}

.result-details {
  margin-top: 15px;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 10px;
  box-shadow: inset 0 2px 5px rgba(0,0,0,0.05);
}

.detail-section {
  margin-bottom: 20px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

h5 {
  margin: 0 0 10px 0;
  font-size: 1rem;
}

pre {
  background-color: #ffffff;
  padding: 15px;
  border-radius: 5px;
  overflow: auto;
  max-height: 300px;
  font-size: 0.9rem;
  margin: 0;
}

.toggle-details {
  background: none;
  color: #007bff;
  padding: 8px 15px;
  margin-top: 15px;
  box-shadow: none;
  text-decoration: underline;
  font-size: 1rem;
  border: none;
  cursor: pointer;
}

.toggle-details:hover {
  color: #0056b3;
  background: rgba(0, 123, 255, 0.05);
  border-radius: 5px;
  text-decoration: none;
}
</style>
