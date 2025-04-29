<template>
  <v-card class="mb-4" variant="outlined">
    <v-card-title class="d-flex justify-space-between align-center">
      <div class="d-flex align-center">
        <v-icon icon="mdi-clipboard-list-outline" class="mr-2"></v-icon>
        Replay Results
        <v-chip class="ml-2" size="small" color="primary">{{ results.length }}</v-chip>
      </div>
      <div>
        <v-btn
          color="primary"
          variant="text"
          prepend-icon="mdi-export"
          class="mr-2"
          @click="$emit('export-results')"
        >
          Export
        </v-btn>
        <v-btn
          color="primary"
          variant="text"
          prepend-icon="mdi-file-pdf-box"
          @click="$emit('generate-pdf')"
        >
          PDF Report
        </v-btn>
      </div>
    </v-card-title>
    
    <v-divider></v-divider>
    
    <!-- Results summary -->
    <v-card-text>
      <v-row>
        <v-col cols="3">
          <v-card flat class="text-center pa-3">
            <div class="text-h4">{{ results.length }}</div>
            <div class="text-subtitle-2">Total Steps</div>
          </v-card>
        </v-col>
        
        <v-col cols="3">
          <v-card flat class="text-center pa-3 bg-success-lighten-5">
            <div class="text-h4 text-success">{{ successCount }}</div>
            <div class="text-subtitle-2">Successful</div>
          </v-card>
        </v-col>
        
        <v-col cols="3">
          <v-card flat class="text-center pa-3 bg-error-lighten-5">
            <div class="text-h4 text-error">{{ errorCount }}</div>
            <div class="text-subtitle-2">Failed</div>
          </v-card>
        </v-col>
        
        <v-col cols="3">
          <v-card flat class="text-center pa-3 bg-warning-lighten-5">
            <div class="text-h4 text-warning">{{ skippedCount }}</div>
            <div class="text-subtitle-2">Skipped</div>
          </v-card>
        </v-col>
      </v-row>
    </v-card-text>
    
    <v-divider></v-divider>
    
    <!-- Result list -->
    <v-list>
      <v-list-item
        v-for="(result, index) in results"
        :key="`result-${index}`"
        :ripple="false"
      >
        <template v-slot:prepend>
          <v-avatar :color="getStatusColor(result.status)" size="small" class="mr-2">
            <v-icon :icon="getStatusIcon(result.status)" color="white" size="small"></v-icon>
          </v-avatar>
        </template>
        
        <template v-slot:default>
          <div>
            <v-list-item-title>{{ result.step }}</v-list-item-title>
            
            <v-list-item-subtitle class="text-capitalize">
              {{ result.status }}
            </v-list-item-subtitle>
            
            <v-expand-transition>
              <div v-if="expandedResult === index" class="pa-4 mt-2 bg-grey-lighten-4 rounded">
                <v-tabs v-model="localResultTab" density="comfortable" class="mb-2">
                  <v-tab value="request" v-if="result.request">Request</v-tab>
                  <v-tab value="response" v-if="result.response">Response</v-tab>
                  <v-tab value="error" v-if="result.error">Error</v-tab>
                  <v-tab value="variables" v-if="hasVariables(result)">Variables</v-tab>
                </v-tabs>
                
                <v-window v-model="localResultTab">
                  <v-window-item value="request" v-if="result.request">
                    <v-card variant="flat" class="pa-2">
                      <pre>{{ formatRequestForDisplay(result.request) }}</pre>
                    </v-card>
                  </v-window-item>
                  
                  <v-window-item value="response" v-if="result.response">
                    <v-card variant="flat" class="pa-2">
                      <pre>{{ formatJson(result.response) }}</pre>
                    </v-card>
                  </v-window-item>
                  
                  <v-window-item value="error" v-if="result.error">
                    <v-alert type="error" border="start" variant="tonal" class="mb-0">
                      {{ result.error }}
                    </v-alert>
                  </v-window-item>
                  
                  <v-window-item value="variables" v-if="hasVariables(result)">
                    <v-card variant="flat" class="pa-2">
                      <v-list density="compact">
                        <v-list-item
                          v-for="(value, name) in result.capturedVariables"
                          :key="name"
                        >
                          <v-list-item-title class="font-weight-bold">{{ name }}</v-list-item-title>
                          <v-list-item-subtitle>{{ value }}</v-list-item-subtitle>
                        </v-list-item>
                      </v-list>
                    </v-card>
                  </v-window-item>
                </v-window>
              </div>
            </v-expand-transition>
          </div>
        </template>
        
        <template v-slot:append>
          <v-btn
            icon="mdi-chevron-down"
            variant="text"
            size="small"
            :class="{ 'rotate-icon': expandedResult === index }"
            @click="$emit('toggle-result', index)"
          ></v-btn>
        </template>
      </v-list-item>
    </v-list>
  </v-card>
</template>

<script>
export default {
  name: 'ReplayResults',
  props: {
    results: {
      type: Array,
      required: true
    },
    expandedResult: {
      type: Number,
      default: null
    }
  },
  data() {
    return {
      localResultTab: 'request'
    }
  },
  computed: {
    successCount() {
      return this.results.filter(r => r.status === 'success').length;
    },
    errorCount() {
      return this.results.filter(r => r.status === 'error').length;
    },
    skippedCount() {
      return this.results.filter(r => r.status === 'skipped').length;
    }
  },
  methods: {
    getStatusColor(status) {
      if (status === 'success') return 'success';
      if (status === 'error') return 'error';
      if (status === 'skipped') return 'warning';
      return 'grey';
    },
    getStatusIcon(status) {
      if (status === 'success') return 'mdi-check';
      if (status === 'error') return 'mdi-close';
      if (status === 'skipped') return 'mdi-skip-next';
      return 'mdi-help';
    },
    hasVariables(result) {
      return result.capturedVariables && Object.keys(result.capturedVariables).length > 0;
    },
    formatRequestForDisplay(request) {
      if (!request) return 'No request data available';
      
      try {
        // Create a simplified request object with only essential information
        const simplifiedRequest = {
          url: request.url || '',
          method: request.method || '',
          headers: request.headers || request.requestHeaders || {}
        };
        
        // Add query parameters
        if (request.queryParameters) {
          simplifiedRequest.queryParameters = request.queryParameters;
        } else if (request.url && request.url.includes('?')) {
          try {
            const url = new URL(request.url);
            const params = {};
            url.searchParams.forEach((value, key) => {
              params[key] = value;
            });
            simplifiedRequest.queryParameters = params;
          } catch (e) {
            console.warn('Error parsing URL query parameters:', e);
          }
        }
        
        // Add body only if it exists with multiple source support
        if (request.body || request.requestBody) {
          try {
            const body = request.body || request.requestBody;
            
            // Handle string bodies (try to parse as JSON)
            if (typeof body === 'string') {
              try {
                simplifiedRequest.body = JSON.parse(body);
              } catch {
                simplifiedRequest.body = body;
              }
            } else {
              simplifiedRequest.body = body;
            }
          } catch (e) {
            simplifiedRequest.body = "Error parsing request body";
            console.error('Error parsing body:', e);
          }
        }
        
        // Include original path if available (for OpenAPI imports)
        if (request.originalPath) {
          simplifiedRequest.originalPath = request.originalPath;
        }
        
        // Include source information to help debugging
        simplifiedRequest.source = request.importedFromOpenAPI ? 'OpenAPI Import' : 'Direct Recording';
        
        return JSON.stringify(simplifiedRequest, null, 2);
      } catch (e) {
        console.error('Error formatting request for display:', e);
        return `Error formatting request: ${e.message}\n\nOriginal request: ${JSON.stringify(request)}`;
      }
    },
    formatJson(data) {
      if (!data) return 'No data available';
      
      try {
        if (typeof data === 'object') {
          return JSON.stringify(data, null, 2);
        } else if (typeof data === 'string') {
          try {
            const parsed = JSON.parse(data);
            return JSON.stringify(parsed, null, 2);
          } catch {
            return data;
          }
        }
        return String(data);
      } catch (e) {
        console.error('Error formatting JSON:', e);
        return String(data);
      }
    }
  }
}
</script>

<style scoped>
.rotate-icon {
  transform: rotate(180deg);
}

pre {
  background-color: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  overflow: auto;
  max-height: 250px;
  font-size: 12px;
  font-family: 'Courier New', Courier, monospace;
}
</style>
