<template>
  <div>
    <v-tabs 
      v-model="activeTab" 
      density="comfortable" 
      class="mb-2"
      @click.stop
    >
      <v-tab value="details" @click.stop>Step Details</v-tab>
      <v-tab value="request" @click.stop>Request</v-tab>
      <v-tab value="response" v-if="hasResult && results.response" @click.stop>Response</v-tab>
      <v-tab value="captures" @click.stop>Variable Captures</v-tab>
      <v-tab value="substitutions" @click.stop>Substitutions</v-tab>
      <v-tab value="captured" v-if="hasResult && hasCapturedVariables" @click.stop>Captured Vars</v-tab>
    </v-tabs>
    
    <v-window v-model="activeTab" @click.stop>
      <!-- Step configuration tab -->
      <v-window-item value="details">
        <v-card variant="flat" class="pa-2">
          <v-table density="compact">
            <tbody>
              <tr>
                <td class="font-weight-bold">URL:</td>
                <td>{{ step.url }}</td>
              </tr>
              <!-- URL modifiée avec la baseUrl si disponible -->
              <tr v-if="executionOptions && executionOptions.baseUrl">
                <td class="font-weight-bold">URL Modifiée:</td>
                <td class="text-primary">
                  {{ getModifiedUrl(step.url, executionOptions.baseUrl) }}
                </td>
              </tr>
              <tr>
                <td class="font-weight-bold">Method:</td>
                <td>{{ step.method }}</td>
              </tr>
              <tr v-if="step.description">
                <td class="font-weight-bold">Description:</td>
                <td>{{ step.description }}</td>
              </tr>
              <tr v-if="hasResult">
                <td class="font-weight-bold">Status:</td>
                <td class="text-capitalize">
                  {{ getResultStatus() }}
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </v-window-item>
      
      <!-- Request details tab -->
      <v-window-item value="request">
        <v-card variant="flat" class="pa-2">
          <pre>{{ hasResult && results.request ? formatRequestForDisplay(results.request) : formatStepRequestForDisplay(step) }}</pre>
        </v-card>
      </v-window-item>
      
      <!-- Response details tab -->
      <v-window-item value="response" v-if="hasResult && results.response">
        <v-card variant="flat" class="pa-2">
          <pre>{{ formatJson(results.response) }}</pre>
        </v-card>
      </v-window-item>
      
      <!-- Captured variables tab -->
      <v-window-item value="captured" v-if="hasResult && hasCapturedVariables">
        <v-card variant="flat" class="pa-2">
          <v-list density="compact">
            <v-list-item
              v-for="(value, name) in results.capturedVariables"
              :key="name"
            >
              <v-list-item-title class="font-weight-bold">{{ name }}</v-list-item-title>
              <v-list-item-subtitle>{{ value }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card>
      </v-window-item>

      <!-- Variable Captures tab -->
      <v-window-item value="captures">
        <v-card variant="flat" class="pa-2">
          <div class="text-subtitle-2 mb-2">Définir des captures de variables par regex</div>
          <p class="text-caption mb-4">
            Créez des expressions régulières pour capturer des données depuis la réponse. Les variables capturées seront disponibles pour les prochaines étapes.
          </p>
          <v-btn 
            color="primary" 
            variant="outlined" 
            prepend-icon="mdi-plus" 
            class="mb-4" 
            @click.stop="$emit('open-capture-dialog')"
          >
            Ajouter une capture
          </v-btn>
          <v-row>
            <v-col cols="12" md="6" lg="4" v-for="(capture, captureIndex) in getStepCaptures()" :key="captureIndex">
              <v-card class="mb-2 capture-card" outlined>
                <v-card-title class="d-flex justify-space-between align-center py-2">
                  <span class="font-weight-bold">{{ capture.name }}</span>
                  <v-btn icon size="small" color="error" @click.stop="removeCapture(captureIndex)"><v-icon>mdi-delete</v-icon></v-btn>
                </v-card-title>
                <v-card-text class="py-1">
                  <div><strong>Regex:</strong> {{ capture.regex }}</div>
                  <div><strong>Source:</strong> {{ getSourceLabel(capture.source) }}</div>
                  <div><strong>Obligatoire:</strong> <v-chip size="x-small" :color="capture.required ? 'error' : 'info'">{{ capture.required ? 'Oui' : 'Non' }}</v-chip></div>
                  <div v-if="capture.errorOnCapture" class="text-error"><strong>Erreur:</strong> {{ capture.errorOnCapture }}</div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-card>
      </v-window-item>

      <!-- Variable Substitutions tab -->
      <v-window-item value="substitutions">
        <v-card variant="flat" class="pa-2">
          <div class="text-subtitle-2 mb-2">Définir des substitutions de variables</div>
          <p class="text-caption mb-4">
            Créez des règles de substitution pour remplacer des valeurs dans la requête par des variables capturées précédemment.
          </p>
          <v-btn 
            color="primary" 
            variant="outlined" 
            prepend-icon="mdi-plus" 
            class="mb-4" 
            @click.stop="$emit('open-substitution-dialog')"
          >
            Ajouter une substitution
          </v-btn>
          <v-row>
            <v-col cols="12" md="6" lg="4" v-for="(substitution, subIndex) in getStepSubstitutions()" :key="subIndex">
              <v-card class="mb-2 substitution-card" outlined>
                <v-card-title class="d-flex justify-space-between align-center py-2">
                  <span class="font-weight-bold">{{ substitution.targetVariable || 'Substitution' }}</span>
                  <v-btn icon size="small" color="error" @click.stop="removeSubstitution(subIndex)"><v-icon>mdi-delete</v-icon></v-btn>
                </v-card-title>
                <v-card-text class="py-1">
                  <div><strong>Regex:</strong> {{ substitution.regex }}</div>
                  <div v-if="substitution.targetVariable"><strong>Remplacer par:</strong> {{ substitution.targetVariable }}</div>
                  <div v-if="substitution.sourceStep !== undefined"><strong>De l'étape:</strong> {{ substitution.sourceStep + 1 }}</div>
                  <div v-if="substitution.value"><strong>Valeur fixe:</strong> {{ substitution.value }}</div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-card>
      </v-window-item>
    </v-window>
  </div>
</template>

<script>
import { ref, computed } from 'vue';

export default {
  name: 'StepDetails',
  props: {
    step: {
      type: Object,
      required: true
    },
    index: {
      type: Number,
      required: true
    },
    results: {
      type: Object,
      default: null
    },
    executionOptions: {
      type: Object,
      default: () => ({})
    },
    sourceOptions: {
      type: Array,
      default: () => [
        { title: 'Corps de la réponse', value: 'body' },
        { title: 'En-têtes de la réponse', value: 'headers' },
        { title: 'URL de la réponse', value: 'url' }
      ]
    }
  },
  emits: ['update-step', 'open-capture-dialog', 'open-substitution-dialog'],
  setup(props, { emit }) {
    const activeTab = ref('details');
    
    const hasResult = computed(() => !!props.results);
    
    const hasCapturedVariables = computed(() => 
      props.results && 
      props.results.capturedVariables && 
      Object.keys(props.results.capturedVariables).length > 0
    );
    
    // Methods
    const getResultStatus = () => {
      if (!props.results) return null;
      if (props.results.error) return 'error';
      return props.results.status || 'success';
    };
    
    const getStepCaptures = () => {
      if (!props.step.variableCaptures) {
        // Initialize if it doesn't exist
        emit('update-step', {
          ...props.step,
          variableCaptures: []
        });
        return [];
      }
      return props.step.variableCaptures;
    };
    
    const removeCapture = (captureIndex) => {
      const captures = [...(props.step.variableCaptures || [])];
      captures.splice(captureIndex, 1);
      
      emit('update-step', {
        ...props.step,
        variableCaptures: captures
      });
    };
    
    const getSourceLabel = (source) => {
      const found = props.sourceOptions.find(opt => opt.value === source);
      return found ? found.title : source;
    };
    
    const getStepSubstitutions = () => {
      if (!props.step.variableSubstitutions) {
        // Initialize if it doesn't exist
        emit('update-step', {
          ...props.step,
          variableSubstitutions: []
        });
        return [];
      }
      return props.step.variableSubstitutions;
    };
    
    const removeSubstitution = (subIndex) => {
      const substitutions = [...(props.step.variableSubstitutions || [])];
      substitutions.splice(subIndex, 1);
      
      emit('update-step', {
        ...props.step,
        variableSubstitutions: substitutions
      });
    };
    
    const getModifiedUrl = (originalUrl, baseUrl) => {
      if (!baseUrl || !originalUrl) {
        return originalUrl;
      }
      
      try {
        // Parse original URL
        const urlObj = new URL(originalUrl);
        
        // Parse baseUrl
        let baseUrlObj;
        try {
          if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
            baseUrlObj = new URL('http://' + baseUrl);
          } else {
            baseUrlObj = new URL(baseUrl);
          }
        } catch (e) {
          console.warn('Invalid baseUrl format:', baseUrl, e);
          return originalUrl;
        }
        
        // Build new URL with original path and query but new origin
        const newUrl = new URL(urlObj.pathname + urlObj.search + urlObj.hash, baseUrlObj.origin);
        
        return newUrl.href;
      } catch (e) {
        console.warn('Error applying baseUrl:', e);
        return originalUrl;
      }
    };
    
    const formatRequestForDisplay = (request) => {
      if (!request) return 'No request data available';
      
      try {
        // Create a simplified request object
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
        
        // Add body only if it exists
        if (request.body || request.requestBody) {
          try {
            const body = request.body || request.requestBody;
            
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
        
        return JSON.stringify(simplifiedRequest, null, 2);
      } catch (e) {
        console.error('Error formatting request for display:', e);
        return `Error formatting request: ${e.message}`;
      }
    };
    
    const formatStepRequestForDisplay = (step) => {
      if (!step) return 'No step data available';
      
      try {
        // Create a simplified step object
        const simplifiedStep = {
          url: step.url || '',
          method: step.method || '',
          headers: step.headers || {}
        };
        
        // Add query parameters
        if (step.queryParameters) {
          simplifiedStep.queryParameters = step.queryParameters;
        } else if (step.url && step.url.includes('?')) {
          try {
            const url = new URL(step.url);
            const params = {};
            url.searchParams.forEach((value, key) => {
              params[key] = value;
            });
            simplifiedStep.queryParameters = params;
          } catch (e) {
            console.warn('Error parsing URL query parameters:', e);
          }
        }
        
        // Add body from possible sources
        if (step.body) {
          simplifiedStep.body = extractBodyContent(step.body);
        } else if (step.requestBody) {
          simplifiedStep.body = extractBodyContent(step.requestBody);
        } else if (step._originalRequestBody) {
          simplifiedStep.body = extractBodyContent(step._originalRequestBody);
        } else if (step.request && step.request.body) {
          simplifiedStep.body = extractBodyContent(step.request.body);
        }
        
        return JSON.stringify(simplifiedStep, null, 2);
      } catch (e) {
        console.error('Error formatting step for display:', e);
        return `Error formatting step: ${e.message}`;
      }
    };
    
    const extractBodyContent = (body) => {
      // Handle Odoo-specific format with content wrapper
      if (body && body.content && body.content['application/json']) {
        return body;  // Return the complete structure as is
      }
      
      // Handle string bodies
      if (typeof body === 'string') {
        try {
          return JSON.parse(body);
        } catch {
          return body;
        }
      }
      
      return body;
    };
    
    const formatJson = (data) => {
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
        } else {
          return String(data);
        }
      } catch (e) {
        console.error('Error formatting JSON:', e);
        return `Error formatting data: ${e.message}`;
      }
    };
    
    return {
      activeTab,
      hasResult,
      hasCapturedVariables,
      getResultStatus,
      getStepCaptures,
      removeCapture,
      getSourceLabel,
      getStepSubstitutions,
      removeSubstitution,
      getModifiedUrl,
      formatRequestForDisplay,
      formatStepRequestForDisplay,
      formatJson
    };
  }
}
</script>

<style scoped>
pre {
  background-color: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  overflow: auto;
  max-height: 250px;
  font-size: 12px;
  font-family: 'Courier New', Courier, monospace;
  width: 100%;
}

.capture-card {
  box-shadow: rgba(17, 17, 26, 0.1) 0px 1px 0px, rgba(17, 17, 26, 0.1) 0px 8px 24px, rgba(17, 17, 26, 0.1) 0px 16px 48px;
}

.substitution-card {
  border-left: 4px solid #7B1FA2 !important;
  box-shadow: rgba(17, 17, 26, 0.1) 0px 1px 0px, rgba(17, 17, 26, 0.1) 0px 8px 24px, rgba(17, 17, 26, 0.1) 0px 16px 48px;
}
</style>