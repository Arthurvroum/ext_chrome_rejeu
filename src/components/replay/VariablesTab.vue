<template>
  <div class="variables-tab">
    <!-- Section des variables globales -->
    <v-card class="mb-4 variables-card" variant="outlined">
      <v-card-title class="d-flex justify-space-between align-center variables-header">
        <div class="d-flex align-center">
          <v-icon icon="mdi-earth-box" class="mr-2"></v-icon>
          Variables Globales
        </div>
        
        <v-chip
          v-if="globalVariables && globalVariables.length > 0"
          color="info"
          size="small"
        >
          {{ globalVariables.length }} variables globales
        </v-chip>
      </v-card-title>

      <!-- Empty state when no global variables -->
      <v-card-text v-if="!globalVariables || globalVariables.length === 0" class="text-center pa-6">
        <v-icon icon="mdi-variable-box" size="64" color="grey-lighten-1" class="mb-4"></v-icon>
        <div class="text-h6 mb-2">Aucune variable globale définie</div>
        <div class="text-body-2 text-grey mb-6">
          Ajoutez des variables globales à partir du bouton "Global Variables" dans les options d'exécution.
        </div>
      </v-card-text>

      <!-- Global variables list with scroll -->
      <v-card-text v-else class="scrollable-section">
        <v-table density="compact">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Expression régulière</th>
              <th>Source</th>
              <th>Valeur capturée</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(variable, index) in globalVariables" :key="index">
              <td>
                <v-chip color="info" size="small">{{ variable.name }}</v-chip>
              </td>
              <td>{{ variable.regex }}</td>
              <td>{{ getSourceLabel(variable.source) }}</td>
              <td>
                <span v-if="getGlobalCapturedValue(variable.name)">
                  {{ getGlobalCapturedValue(variable.name) }}
                </span>
                <span v-else class="text-grey">Non capturée</span>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
    </v-card>
    
    <!-- Section des variables capturées par étape (existante) -->
    <v-card class="mb-4 variables-card">
      <v-card-title class="d-flex justify-space-between align-center variables-header">
        <div class="d-flex align-center">
          <v-icon icon="mdi-variable" class="mr-2"></v-icon>
          Variables capturées
        </div>
        
        <v-chip
          v-if="totalCapturedVariables > 0"
          color="primary"
          size="small"
        >
          {{ totalCapturedVariables }} variables capturées
        </v-chip>
      </v-card-title>

      <!-- Empty state when no variables -->
      <v-card-text v-if="totalCapturedVariables === 0 && !hasCapturingSteps" class="text-center pa-6">
        <v-icon icon="mdi-database-search" size="64" color="grey-lighten-1" class="mb-4"></v-icon>
        <div class="text-h6 mb-2">Aucune variable capturée</div>
        <div class="text-body-2 text-grey mb-6">Aucune étape de ce scénario ne définit des captures de variables.</div>
      </v-card-text>

      <!-- Empty state when variables defined but none captured -->
      <v-card-text v-else-if="totalCapturedVariables === 0 && hasCapturingSteps" class="text-center pa-6">
        <v-icon icon="mdi-database-minus" size="64" color="amber-darken-2" class="mb-4"></v-icon>
        <div class="text-h6 mb-2">Variables définies mais non capturées</div>
        <div class="text-body-2 text-grey mb-6">
          Des captures de variables sont définies mais aucune n'a été trouvée dans les réponses.
          Lancez le replay pour capturer des variables.
        </div>
      </v-card-text>

      <!-- Variables list with scroll -->
      <div v-else class="scrollable-section steps-variables-section">
        <v-expansion-panels>
          <v-expansion-panel v-for="(step, index) in stepsWithVariables" :key="index">
            <v-expansion-panel-title>
              <div class="d-flex align-center w-100">
                <v-chip
                  size="small"
                  :color="getMethodColor(step.method)"
                  class="mr-2"
                >
                  {{ step.method }}
                </v-chip>
                
                <span>{{ step.name || `Step ${step.index + 1}` }}</span>
                
                <!-- Show count of captured variables -->
                <v-chip
                  size="x-small"
                  :color="getCapturedVariablesCount(step) > 0 ? 'success' : 'warning'"
                  class="ml-2"
                >
                  {{ getCapturedVariablesCount(step) }} / {{ getDefinedVariablesCount(step) }}
                </v-chip>
              </div>
            </v-expansion-panel-title>
            
            <v-expansion-panel-text>
              <div>
                <div class="subtitle-1 mb-3">Captures de variables</div>
                
                <v-table density="compact">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Expression</th>
                      <th>Source</th>
                      <th>Valeur</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(capture, captureIndex) in step.variableCaptures" :key="captureIndex">
                      <td>{{ capture.name }}</td>
                      <td>{{ capture.regex }}</td>
                      <td>{{ getSourceLabel(capture.source) }}</td>
                      <td>
                        <span v-if="getCapturedValue(step, capture.name)">
                          {{ getCapturedValue(step, capture.name) }}
                        </span>
                        <span v-else class="text-grey">Non capturée</span>
                      </td>
                      <td>
                        <v-chip
                          size="x-small"
                          :color="getCapturedValue(step, capture.name) ? 'success' : (capture.required ? 'error' : 'amber-darken-2')"
                        >
                          <v-icon start size="x-small" v-if="getCapturedValue(step, capture.name)">
                            mdi-check
                          </v-icon>
                          <v-icon start size="x-small" v-else>
                            {{ capture.required ? 'mdi-alert' : 'mdi-minus' }}
                          </v-icon>
                          {{ getCapturedValue(step, capture.name) ? 'Capturée' : (capture.required ? 'Manquante (requise)' : 'Non trouvée') }}
                        </v-chip>
                      </td>
                    </tr>
                  </tbody>
                </v-table>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </div>
    </v-card>
  </div>
</template>

<script>
export default {
  name: 'VariablesTab',
  props: {
    steps: {
      type: Array,
      required: true
    },
    results: {
      type: Array,
      default: () => []
    },
    globalVariables: {
      type: Array,
      default: () => []
    }
  },
  computed: {
    stepsWithVariables() {
      return this.steps
        .map((step, index) => ({
          ...step,
          index,
          hasVariableCaptures: this.hasVariableCaptures(step),
          hasCapturedVariables: this.hasCapturedVariables(index)
        }))
        .filter(step => step.hasVariableCaptures || step.hasCapturedVariables);
    },
    
    totalCapturedVariables() {
      let count = 0;
      this.steps.forEach((step, index) => {
        if (this.results && this.results[index] && this.results[index].capturedVariables) {
          count += Object.keys(this.results[index].capturedVariables).length;
        }
      });
      return count;
    },
    
    hasCapturingSteps() {
      return this.steps.some(step => 
        step.variableCaptures && step.variableCaptures.length > 0
      );
    }
  },
  methods: {
    hasVariableCaptures(step) {
      return step.variableCaptures && step.variableCaptures.length > 0;
    },
    
    hasCapturedVariables(index) {
      return this.results && 
             this.results[index] && 
             this.results[index].capturedVariables && 
             Object.keys(this.results[index].capturedVariables).length > 0;
    },
    
    getCapturedVariablesCount(step) {
      if (!this.results || !this.results[step.index] || !this.results[step.index].capturedVariables) {
        return 0;
      }
      return Object.keys(this.results[step.index].capturedVariables).length;
    },
    
    getDefinedVariablesCount(step) {
      return (step.variableCaptures || []).length;
    },
    
    getCapturedValue(step, name) {
      if (!this.results || !this.results[step.index] || !this.results[step.index].capturedVariables) {
        return null;
      }
      return this.results[step.index].capturedVariables[name] || null;
    },
    
    getMethodColor(method) {
      const colors = {
        GET: 'primary',
        POST: 'success',
        PUT: 'warning',
        DELETE: 'error',
        PATCH: 'info'
      };
      return colors[method] || 'grey';
    },
    
    getSourceLabel(source) {
      const sources = {
        'body': 'Corps de la réponse',
        'responseBody': 'Corps de la réponse',
        'headers': 'En-têtes de la réponse',
        'responseHeaders': 'En-têtes de la réponse',
        'url': 'URL de la réponse'
      };
      return sources[source] || source;
    },
    
    getGlobalCapturedValue(name) {
      if (!this.results || !this.results.globalVariables) {
        return null;
      }
      return this.results.globalVariables[name] || null;
    }
  }
}
</script>

<style src="../../styles/replay/VariablesTab.css" scoped></style>
