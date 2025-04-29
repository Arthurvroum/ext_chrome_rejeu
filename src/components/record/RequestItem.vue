<template>
  <div class="request-item">
    <div class="request-header">
      <span class="method">{{ request.method }}</span>
      <span class="url">{{ request.url }}</span>
      <span class="status" v-if="request.statusCode">{{ request.statusCode }}</span>
    </div>
    
    <div class="request-details" v-if="expanded">
      <div class="detail-section">
        <h4>Request Headers</h4>
        <pre>{{ formatHeaders(request.requestHeaders) }}</pre>
      </div>
      
      <div class="detail-section" v-if="request.requestBody">
        <h4>Request Body</h4>
        <pre>{{ formatBody(request.requestBody) }}</pre>
      </div>
      
      <div class="detail-section" v-if="request.responseHeaders">
        <h4>Response Headers</h4>
        <pre>{{ formatHeaders(request.responseHeaders) }}</pre>
      </div>
      
      <!-- Variable capture form is now a separate component -->
      <variable-capture-form 
        :request="request" 
        @add-capture="addVariableCapture"
      />
    </div>
    
    <button class="toggle-details" @click="toggleDetails">
      {{ expanded ? 'Hide Details' : 'Show Details' }}
    </button>
  </div>
</template>

<script>
import VariableCaptureForm from './VariableCaptureForm.vue';

export default {
  name: 'RequestItem',
  components: {
    VariableCaptureForm
  },
  props: {
    request: {
      type: Object,
      required: true
    },
    expanded: {
      type: Boolean,
      default: false
    }
  },
  methods: {
    toggleDetails() {
      this.$emit('toggle-details');
    },
    
    addVariableCapture(captureConfig) {
      if (!this.request.variableCapture) {
        this.request.variableCapture = [];
      }
      
      this.request.variableCapture.push(captureConfig);
      this.$emit('update-request', this.request);
    },
    
    formatHeaders(headers) {
      if (!headers) return 'No headers available';
      return JSON.stringify(headers, null, 2);
    },
    
    formatBody(body) {
      if (!body) return 'Request body not available in Manifest V3. Use content scripts to capture form submissions.';
      
      // Try to parse as JSON if it's a string
      if (typeof body === 'string') {
        try {
          const parsed = JSON.parse(body);
          return JSON.stringify(parsed, null, 2);
        } catch (e) {
          return body;
        }
      }
      
      return JSON.stringify(body, null, 2);
    }
  }
}
</script>

<style src="../../styles/record/requestItem.css" scoped></style>
