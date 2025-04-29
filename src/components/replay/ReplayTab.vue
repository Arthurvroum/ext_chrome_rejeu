<template>
  <div class="replay-tab">
    <v-container fluid class="replay-tab-container">
      <!-- Header section - more compact -->
      <replay-header 
        :execution-status="executionStatus"
        :auto-loaded-data="autoLoadedData"
        @load-file="loadScenarioFile"
        @clear-data="clearAllReplayData"
      />
      
      <v-fade-transition>
        <v-card v-if="scenario || recordedRequestsData" flat class="mt-1 scenario-card">
          <!-- Extra-compact title and subtitle -->
          <div class="ultra-compact-header">
            <div class="header-with-tabs">
              <v-card-title class="text-body-1 py-1 px-3 font-weight-bold">
                {{ (scenario?.info?.title) || 'Recently Recorded Scenario' }}
                <v-chip color="primary" variant="flat" size="x-small" class="ml-2">
                  {{ scenarioSteps.length }} steps
                </v-chip>
                
                <v-spacer></v-spacer>
                
                <v-tabs
                  v-model="activeTab"
                  density="compact"
                  color="primary"
                  class="tabs-right"
                >
                  <v-tab value="replay">Replay</v-tab>
                  <v-tab value="variables">Variables</v-tab>
                </v-tabs>
              </v-card-title>
              
              <v-card-subtitle v-if="scenario?.info?.description || !scenario" class="text-caption pt-0 pb-1 px-3">
                {{ (scenario?.info?.description) || 'This is your recently recorded scenario ready for replay.' }}
              </v-card-subtitle>
            </div>
            
            <v-window v-model="activeTab">
              <!-- Tab Replay - Contenu existant -->
              <v-window-item value="replay">
                <!-- Execution options card - fixed below header -->
                <execution-options 
                  v-model:stop-on-error="executionOptions.stopOnError"
                  v-model:step-interval="executionOptions.stepInterval"
                  v-model:error-on-capture="executionOptions.errorOnCapture"
                  v-model:show-runtime-progress="executionOptions.showRuntimeProgress"
                  v-model:base-url="executionOptions.baseUrl"
                  v-model:global-variables="executionOptions.globalVariables"
                  :is-replaying="isReplaying"
                  @start-replay="startReplay"
                  @clear-results="clearResults"
                  @remove-global-variable="removeGlobalVariableFromSteps"
                  class="mt-1"
                />
                
                <!-- Steps list - scrollable section -->
                <div class="steps-container">
                  <steps-list 
                    :steps="scenarioSteps"
                    :expanded-step="expandedStep"
                    :is-replaying="isReplaying"
                    :results="replayResults"
                    :current-step-index="currentStepIndex"
                    :show-runtime-progress="executionOptions.showRuntimeProgress"
                    :execution-options="executionOptions"
                    @toggle-step="toggleStepDetails"
                    @toggle-all-steps="toggleAllSteps"
                    @update-step="updateStep"
                    @export-results="exportReplayResults"
                    @generate-pdf="generatePdfReport"
                  />
                </div>
              </v-window-item>
              
              <!-- Tab Variables -->
              <v-window-item value="variables">
                <variables-tab
                  :steps="scenarioSteps"
                  :results="replayResults"
                  :global-variables="executionOptions.globalVariables"
                />
              </v-window-item>
            </v-window>
          </div>
        </v-card>
      </v-fade-transition>
      
      <!-- Empty state when no data is loaded -->
      <v-card v-if="!scenario && !recordedRequestsData" class="mt-4 pa-8 d-flex align-center justify-center flex-column">
        <v-icon icon="mdi-file-document-outline" size="64" color="grey-lighten-1" class="mb-4"></v-icon>
        <div class="text-h6 mb-2">No scenario loaded</div>
        <div class="text-body-2 text-grey mb-6">Please load an OpenAPI 3.0 file to get started or record a new session.</div>
        <v-btn
          color="primary"
          prepend-icon="mdi-upload"
          @click="$refs.fileInput.click()"
        >
          Load Scenario File
        </v-btn>
        <input
          ref="fileInput"
          type="file"
          style="display: none"
          @change="loadScenarioFile"
          accept=".json"
        >
      </v-card>
    </v-container>
  </div>
</template>

<script>
// Import components
import ReplayHeader from './ReplayHeader.vue';
import ExecutionOptions from './ExecutionOptions.vue';
import StepsList from './StepsList/index.vue';
import VariablesTab from './VariablesTab.vue';

export default {
  name: 'ReplayTab',
  components: {
    ReplayHeader,
    ExecutionOptions,
    StepsList,
    VariablesTab
  },
  data() {
    return {
      scenario: null,
      scenarioSteps: [],
      expandedStep: null,
      expandedResult: null,
      isReplaying: false,
      replayResults: [],
      executionOptions: {
        stopOnError: true,
        stepInterval: 1000, // Intervalle de 1 seconde par défaut
        showRuntimeProgress: true, // Afficher la progression en temps réel par défaut
        errorOnCapture: false,
        baseUrl: '', // Nouvelle propriété pour la base URL
        globalVariables: [] // Variables globales à capturer pour toutes les requêtes
      },
      recordedRequestsData: null,
      autoLoadedData: false,
      executionStatus: 'Ready to start',
      currentStepIndex: -1, // Index de l'étape en cours d'exécution
      activeTab: 'replay' // Onglet actif par défaut
    }
  },
  computed: {
    executionStatusClass() {
      if (this.executionStatus.includes('Error') || this.executionStatus.includes('Failed')) {
        return 'error';
      } else if (this.executionStatus.includes('Complete')) {
        return 'success';
      } else if (this.executionStatus.includes('Running')) {
        return 'in-progress';
      }
      return '';
    }
  },
  mounted() {
    console.log('ReplayTab mounted, checking for data...');
    
    // Add diagnostic output to help troubleshoot
    this.dumpStorageContents();
    
    // More robust data loading with multiple sources and fallbacks
    chrome.storage.local.get([
      'latestRecordedData', 
      'autoLoadLatestRecording', 
      'replayWindowData', 
      'replayWindowDataCount'
    ], (result) => {
      console.log('Storage data check:', {
        autoLoad: result.autoLoadLatestRecording,
        latestRecordedCount: result.latestRecordedData?.length || 0,
        replayWindowCount: result.replayWindowData?.length || 0,
        countMetadata: result.replayWindowDataCount || 0
      });
      
      // Check URL parameters for state data (emergency fallback)
      const urlParams = new URLSearchParams(window.location.search);
      const stateParam = urlParams.get('state');
      if (stateParam) {
        try {
          const state = JSON.parse(decodeURIComponent(stateParam));
          console.log('Found state param in URL:', state);
          if (state.directData) {
            // This is just diagnostic info - actual data still comes from storage
            console.log('URL indicates direct data transfer was attempted');
          }
        } catch (e) {
          console.error('Error parsing state param:', e);
        }
      }
      
      // First try to load data from replayWindowData (passed directly)
      if (result.replayWindowData && result.replayWindowData.length > 0) {
        console.log('Loading data from replayWindowData:', result.replayWindowData.length, 'requests');
        this.recordedRequestsData = result.replayWindowData;
        this.autoLoadedData = true;
        this.convertRecordedDataToScenario();
        
        // Extraire et définir la baseUrl commune après la conversion
        this.setCommonBaseUrl();
        return;
      }
      
      // Then try loading from latestRecordedData
      if (result.latestRecordedData && result.latestRecordedData.length > 0) {
        console.log('Loading data from latestRecordedData:', result.latestRecordedData.length, 'requests');
        this.recordedRequestsData = result.latestRecordedData;
        this.autoLoadedData = true;
        this.convertRecordedDataToScenario();
        
        // Extraire et définir la baseUrl commune après la conversion
        this.setCommonBaseUrl();
        
        // Reset the auto-load flag to prevent reloading on refresh only if specifically set
        if (result.autoLoadLatestRecording) {
          chrome.storage.local.set({ autoLoadLatestRecording: false });
        }
      } else {
        console.log('No data to auto-load');
        // Show a message to the user
        this.showNoDataMessage();
      }
    });
  },
  methods: {
    loadScenarioFile(event) {
      let file;
      
      // Check if event is a File object directly
      if (event instanceof File) {
        file = event;
      } 
      // Check if event is a DOM event with files
      else if (event.target && event.target.files && event.target.files[0]) {
        file = event.target.files[0];
      } 
      else {
        console.error('Invalid file input:', event);
        this.$root.$emit('show-snackbar', {
          text: 'Invalid file input provided',
          color: 'error'
        });
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          
          // Vérifier si c'est un fichier exporté avec des requêtes brutes
          if (data.rawRequests && Array.isArray(data.rawRequests)) {
            console.log('Fichier exporté avec requêtes brutes détecté:', data.rawRequests.length);
            console.log('Structure d\'une requête brute:', JSON.stringify(data.rawRequests[0], null, 2));
            
            // Stocker les requêtes exactement comme elles sont, sans modification
            this.recordedRequestsData = data.rawRequests.map(req => {
              // Préserver la structure exacte du corps de la requête
              // Aucune modification ou transformation n'est appliquée
              return {
                ...req,
                body: req.body || req.requestBody // S'assurer que nous avons le corps sous le bon nom
              };
            });
            
            this.autoLoadedData = true;
            this.convertRecordedDataToScenario();
            
            // Extraire et définir la base URL commune
            this.$nextTick(() => {
              this.setCommonBaseUrl();
            });
            
            this.$root.$emit('show-snackbar', {
              text: 'Fichier exporté chargé avec succès - ' + data.rawRequests.length + ' requêtes',
              color: 'success',
              timeout: 3000
            });
            return;
          }
          
          // Format OpenAPI traditionnel
          this.processScenario(data);
        } catch (error) {
          this.$root.$emit('show-snackbar', {
            text: 'Error parsing file: ' + error.message,
            color: 'error'
          });
        }
      };
      reader.readAsText(file);
    },
    
    processScenario(data) {
      // Validate that it's an OpenAPI spec
      if (!data.openapi || !data.paths) {
        // Vérifier s'il s'agit de notre propre format d'exportation non-OpenAPI
        if (data.rawRequests && Array.isArray(data.rawRequests)) {
          console.log('Fichier exporté avec format spécial RAW détecté:', data.rawRequests.length);
          
          // Utiliser directement les rawRequests sans aucune transformation
          this.recordedRequestsData = data.rawRequests;
          this.autoLoadedData = true;
          this.convertRecordedDataToScenario();
          
          this.$root.$emit('show-snackbar', {
            text: 'Fichier au format RAW chargé avec succès - ' + data.rawRequests.length + ' requêtes',
            color: 'success',
            timeout: 3000
          });
          return;
        }
        
        this.$root.$emit('show-snackbar', {
          text: 'Format de fichier invalide. Veuillez charger un fichier OpenAPI 3.0 ou un export de Ark Replayr.',
          color: 'error'
        });
        return;
      }
      
      // Check if this is our own exported recording
      const isArkRecording = data['x-ark-replayr'] && 
                            data['x-ark-replayr'].type === 'recording';
      
      // Set different flags based on the source
      if (isArkRecording) {
        this.$root.$emit('show-snackbar', {
          text: 'Fichier OpenAPI avec métadonnées complètes chargé',
          color: 'success',
          timeout: 3000
        });
      } else {
        // Pour les fichiers OpenAPI standards, on prévient que la structure sera modifiée
        this.$root.$emit('show-snackbar', {
          text: 'Fichier OpenAPI importé - certains détails peuvent être limités, préférez le format RAW pour les exportations',
          color: 'info',
          timeout: 5000
        });
      }
      
      this.scenario = data;
      this.scenarioSteps = this.extractStepsFromOpenAPI(data);
      
      // Maintenant, vérifions si le fichier OpenAPI contient notre extension spéciale avec les corps bruts
      if (data['x-ark-replayr'] && data['x-ark-replayr'].rawBodies) {
        console.log('Extension x-ark-replayr avec corps bruts trouvée:', Object.keys(data['x-ark-replayr'].rawBodies).length);
        
        // Restaurer les corps bruts originaux dans les étapes
        this.scenarioSteps.forEach((step, index) => {
          const operationId = step.originalOperationId || `op${index}`;
          if (data['x-ark-replayr'].rawBodies[operationId]) {
            console.log(`Restauration du corps brut pour l'opération ${operationId}`);
            step.requestBody = data['x-ark-replayr'].rawBodies[operationId];
            step._originalRequestBody = data['x-ark-replayr'].rawBodies[operationId];
          }
        });
      }
      
      // Extraire et définir la base URL commune après le chargement complet du scénario
      this.$nextTick(() => {
        this.setCommonBaseUrl();
      });
    },
    
    extractStepsFromOpenAPI(openApiSpec) {
      const steps = [];
      
      // Extract steps from paths
      for (const [path, pathItem] of Object.entries(openApiSpec.paths)) {
        for (const [method, operation] of Object.entries(pathItem)) {
          if (method === 'parameters' || method === 'summary' || method === 'description') continue;
          
          // Get the original full URL from the extension property
          const fullUrl = operation['x-original-url'] || '';
          
          const step = {
            name: operation.summary || operation.operationId,
            description: operation.description,
            url: fullUrl, // Use the full URL instead of just the path
            method: method.toUpperCase(),
            skip: false,
            parameters: operation.parameters,
            requestBody: operation.requestBody,
            responses: operation.responses,
            variableSubstitutions: [],
            variableCaptures: [],
            // Mark as imported so we can handle it specially
            importedFromOpenAPI: true,
            originalPath: path
          };
          
          // Extract variable substitutions from x-variable-substitution extension
          if (operation['x-variable-substitution']) {
            step.variableSubstitutions = operation['x-variable-substitution'];
          }
          
          // Extract variable captures from x-variable-capture extension
          if (operation['x-variable-capture']) {
            step.variableCaptures = operation['x-variable-capture'];
          }
          
          steps.push(step);
        }
      }
      
      // Show warning about imported requests
      this.$nextTick(() => {
        this.$root.$emit('show-snackbar', {
          text: 'Imported requests may have limited functionality due to browser security restrictions.',
          color: 'warning',
          timeout: 8000
        });
      });
      
      return steps;
    },
    
    updateStep(index, updatedStep) {
      if (index >= 0 && index < this.scenarioSteps.length) {
        this.scenarioSteps[index] = { ...this.scenarioSteps[index], ...updatedStep };
        // Force reactivity
        this.scenarioSteps = [...this.scenarioSteps];
      }
    },
    
    toggleStepDetails(index) {
      this.expandedStep = this.expandedStep === index ? null : index;
    },
    
    toggleResultDetails(index) {
      this.expandedResult = this.expandedResult === index ? null : index;
    },
    
    convertRecordedDataToScenario() {
      if (!this.recordedRequestsData || !this.recordedRequestsData.length) {
        console.warn('No recorded data to convert to scenario');
        return;
      }
      
      console.log('Converting', this.recordedRequestsData.length, 'recorded requests to scenario steps');
      console.log('First request sample:', JSON.stringify(this.recordedRequestsData[0]));
      
      // Convert recorded data to scenario steps with validation
      this.scenarioSteps = this.recordedRequestsData.map((request, index) => {
        // Ensure the URL is valid
        let path = '(unknown path)';
        try {
          const url = request.url || '';
          path = this.getPathFromUrl(url);
        } catch (e) {
          console.warn('Error parsing URL:', e);
        }
        
        // Préserver la structure exacte du corps de la requête sans aucune modification
        // Stocker directement la référence à l'objet original
        let requestBody = request.requestBody || request.body;
        
        // IMPORTANT: Log détaillé pour diagnostiquer la structure exacte
        console.log(`Request ${index + 1} body:`, JSON.stringify(requestBody, null, 2));
        
        return {
          name: `Request ${index + 1}: ${request.method || 'GET'} ${path}`,
          url: request.url || '',
          method: request.method || 'GET',
          enabled: true,
          skip: false,
          requestHeaders: request.requestHeaders || {},
          // Stocker exactement le même objet sans transformation
          requestBody: requestBody,
          responseHeaders: request.responseHeaders || {},
          variableSubstitutions: [],
          variableCaptures: request.variableCapture || [],
          // Conserver le corps original pour référence et pour les exportations
          _originalRequestBody: requestBody,
          // Flag indiquant que cette requête est importée depuis un fichier
          _imported: true,
          // Métadonnées supplémentaires pour le debugging
          _importMetadata: {
            timestamp: new Date().toISOString(),
            originalFormat: typeof requestBody,
            hasBeenTransformed: false
          }
        };
      });
      
      console.log('Converted to', this.scenarioSteps.length, 'scenario steps');
      console.log('Sample converted step:', JSON.stringify(this.scenarioSteps[0], null, 2));
    },
    
    getPathFromUrl(url) {
      try {
        const urlObj = new URL(url);
        return urlObj.pathname;
      } catch (e) {
        return url;
      }
    },
    
    toggleAllSteps(enabled) {
      this.scenarioSteps.forEach(step => {
        step.skip = !enabled;
        step.enabled = enabled;
      });
    },
    
    startReplay() {
      // First clear any previous results
      this.clearResults();
      
      // For imported OpenAPI scenarios (not our own recordings), show a warning
      const isImportedOpenAPI = this.scenario && 
                                (!this.scenario['x-ark-replayr'] || 
                                 this.scenario['x-ark-replayr'].type !== 'recording');
      
      if (isImportedOpenAPI) {
        this.$root.$emit('show-snackbar', {
          text: 'Imported requests may have CORS limitations. For best results, record requests directly.',
          color: 'warning',
          timeout: 6000
        });
      }
      
      this.isReplaying = true;
      this.replayResults = [];
      this.executionStatus = 'Running replay...';
      this.currentStepIndex = -1; // Réinitialiser l'index de l'étape courante
      
      // Update skip status based on enabled property
      this.scenarioSteps.forEach(step => {
        step.skip = !step.enabled;
      });
      
      // Importer le service replayService
      import('../../services/replayService').then(module => {
        const replayService = module.default;
        
        // Écouter les événements d'avancement des étapes
        window.addEventListener('step-execution-progress', this.handleStepProgress);
        
        // Lancer l'exécution avec le service replayService
        replayService.startReplay(this.scenarioSteps, this.executionOptions)
          .then(results => {
            this.isReplaying = false;
            this.replayResults = results;
            this.executionStatus = 'Execution Complete';
            this.currentStepIndex = -1; // Réinitialiser l'index de l'étape courante
            
            // Show success message
            this.$root.$emit('show-snackbar', {
              text: `Replay completed: ${this.replayResults.filter(r => r.status === 'success').length} of ${this.replayResults.length} steps successful`,
              color: 'success',
              timeout: 4000
            });
          })
          .catch(error => {
            this.isReplaying = false;
            this.executionStatus = 'Execution Failed';
            alert('Replay failed: ' + error.message);
          })
          .finally(() => {
            // Supprimer l'écouteur d'événement
            window.removeEventListener('step-execution-progress', this.handleStepProgress);
          });
      }).catch(error => {
        this.isReplaying = false;
        this.executionStatus = 'Error loading replay service';
        console.error('Failed to load replayService:', error);
        alert('Error loading replay service: ' + error.message);
      });
    },
    
    // Nouvelle méthode pour gérer les événements de progression des étapes
    handleStepProgress(event) {
      const { currentStepIndex, results, status } = event.detail;
      
      console.log(`Step progress: step ${currentStepIndex + 1}, status: ${status}`);
      
      // Mettre à jour l'index de l'étape courante pour l'animation
      this.currentStepIndex = currentStepIndex;
      
      // Mettre à jour les résultats si disponibles
      if (results && Array.isArray(results)) {
        this.replayResults = results;
      }
      
      // Mettre à jour le statut d'exécution
      if (status === 'completed') {
        this.executionStatus = 'Execution Complete';
      } else if (status === 'error') {
        this.executionStatus = 'Error in execution';
      } else if (status === 'stopped') {
        this.executionStatus = 'Execution stopped due to error';
      }
    },
    
    clearResults() {
      // Clear the local results array
      this.replayResults = [];
      
      // Also clear any stored replay progress data
      chrome.storage.local.remove([
        'replayProgress', 
        'replayProgressTimestamp'
      ], () => {
        console.log('Previous replay results cleared');
      });
    },
    
    exportReplayResults() {
      // Préparation des données brutes pour préserver la structure originale
      const rawRequests = this.recordedRequestsData ? 
        // Utiliser exactement les requêtes originales sans aucune transformation
        JSON.parse(JSON.stringify(this.recordedRequestsData)) : 
        this.scenarioSteps.map(step => {
          // Si nous avons le corps original stocké, utiliser celui-là
          const originalBody = step._originalRequestBody || step.requestBody;
          
          // Log pour déboguer la structure originale
          console.log('Exporting original body structure:', JSON.stringify(originalBody, null, 2));
          
          return {
            url: step.url,
            method: step.method,
            requestHeaders: step.requestHeaders || {},
            // Utiliser le corps original sans aucune transformation
            requestBody: originalBody,
            body: originalBody, // Copie dupliquée pour assurer la compatibilité
            responseHeaders: step.responseHeaders || {},
            // Inclure les captures de variables si elles existent
            variableCapture: step.variableCaptures || []
          };
        });
        
      // Format d'exportation spécial NON-OpenAPI pour préserver la structure exacte
      const resultData = {
        timestamp: new Date().toISOString(),
        scenario: this.scenario ? this.scenario.info?.title : 'Recorded Requests Replay',
        description: this.scenario ? this.scenario.info?.description : 'Replay of recorded network requests',
        executionOptions: this.executionOptions,
        results: this.replayResults,
        // Exporter les requêtes exactement comme elles sont, sans transformation
        rawRequests: rawRequests,
        // Indicateur pour le format d'exportation
        exportFormat: {
          version: "2.2", // Version mise à jour pour indiquer la compatibilité améliorée
          preservesRawStructure: true,
          date: new Date().toISOString(),
          preservesOriginalBodyStructure: true,
          isStandardOpenAPI: false // Indiquer explicitement que ce n'est PAS un format OpenAPI standard
        }
      };
      
      // On n'utilise plus la structure OpenAPI car elle déforme les corps de requêtes
      // if (this.scenario && !resultData.openapi) {
      //   resultData.openapi = "3.0.0";
      //   resultData.paths = {};
      // }
      
      const blob = new Blob([JSON.stringify(resultData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `raw-requests-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      
      // Cleanup pour éviter les fuites de mémoire
      a.onclick = () => {
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 150);
      };
      
      a.click();
      
      // Notification de succès
      this.$root.$emit('show-snackbar', {
        text: 'Le fichier a été exporté avec succès au format RAW préservant la structure exacte de requêtes',
        color: 'success',
        timeout: 4000
      });
    },
    
    generatePdfReport() {
      try {
        // Import jsPDF dynamically if not already loaded
        import('jspdf').then(({ jsPDF }) => {
          import('jspdf-autotable').then(() => {
            const doc = new jsPDF();
            
            // Add title
            doc.setFontSize(20);
            doc.setTextColor(0, 51, 102);
            doc.text('Network Request Replay Results', 14, 20);
            
            // Add timestamp
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
            
            // Add scenario info
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text(`Scenario: ${this.scenario ? this.scenario.info.title : 'Recorded Requests Replay'}`, 14, 40);
            if (this.scenario && this.scenario.info.description) {
              doc.setFontSize(10);
              doc.text(`Description: ${this.scenario.info.description}`, 14, 47);
            }
            
            // Add summary section
            doc.setFontSize(14);
            doc.setTextColor(0, 51, 102);
            doc.text('Execution Summary', 14, 60);
            
            const successCount = this.replayResults.filter(r => r.status === 'success').length;
            const errorCount = this.replayResults.filter(r => r.status === 'error').length;
            const skippedCount = this.replayResults.filter(r => r.status === 'skipped').length;
            
            // Summary table
            doc.autoTable({
              startY: 65,
              head: [['Metric', 'Value']],
              body: [
                ['Total Steps', this.replayResults.length.toString()],
                ['Successful', successCount.toString()],
                ['Failed', errorCount.toString()],
                ['Skipped', skippedCount.toString()],
                ['Success Rate', `${this.replayResults.length ? Math.round((successCount / this.replayResults.length) * 100) : 0}%`]
              ],
              theme: 'grid',
              headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255] },
              styles: { overflow: 'linebreak' },
            });
            
            // Add results section
            let yPos = doc.autoTable.previous.finalY + 15;
            doc.setFontSize(14);
            doc.setTextColor(0, 51, 102);
            doc.text('Detailed Results', 14, yPos);
            
            // Results table
            const resultRows = this.replayResults.map((result, index) => {
              return [
                (index + 1).toString(),
                result.step,
                result.status.toUpperCase(),
                result.status === 'error' ? (result.error || 'Error occurred') : 'OK'
              ];
            });
            
            // If multiple pages needed, ensure good layout
            doc.autoTable({
              startY: yPos + 5,
              head: [['#', 'Step', 'Status', 'Details']],
              body: resultRows,
              theme: 'grid',
              headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255] },
              styles: { overflow: 'linebreak' },
              columnStyles: {
                0: { cellWidth: 10 },
                2: { cellWidth: 25 }
              },
              didDrawCell: (data) => {
                // Add color to the status cell based on status
                if (data.column.index === 2 && data.section === 'body') {
                  const status = this.replayResults[data.row.index].status;
                  if (status === 'success') {
                    doc.setFillColor(0, 128, 0, 0.1); // light green
                    doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                  } else if (status === 'error') {
                    doc.setFillColor(255, 0, 0, 0.1); // light red
                    doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                  } else if (status === 'skipped') {
                    doc.setFillColor(255, 165, 0, 0.1); // light orange
                    doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                  }
                }
              }
            });
            
            // Add footer with page numbers
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
              doc.setPage(i);
              doc.setFontSize(10);
              doc.setTextColor(100, 100, 100);
              doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, 
                doc.internal.pageSize.getHeight() - 10, { align: 'center' });
            }
            
            // Save the PDF
            doc.save(`replay-report-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.pdf`);
          });
        }).catch(error => {
          console.error('Error loading PDF libraries:', error);
          alert('Could not generate PDF. Please check console for errors.');
        });
      } catch (error) {
        console.error('Error generating PDF report:', error);
        alert('Error generating PDF report: ' + error.message);
      }
    },
    
    clearAllReplayData() {
      // Use Vuetify dialog for confirmation
      if (confirm('Are you sure you want to clear all replay data? This action cannot be undone.')) {
        chrome.storage.local.remove([
          'latestRecordedData', 
          'replayWindowData', 
          'replayWindowDataCount',
          'autoLoadLatestRecording', 
          'replayProgress', 
          'dataTimestamp'
        ], () => {
          this.recordedRequestsData = null;
          this.scenario = null;
          this.scenarioSteps = [];
          this.replayResults = [];
          this.autoLoadedData = false;
          
          this.$root.$emit('show-snackbar', {
            text: 'All replay data has been cleared.',
            color: 'success'
          });
        });
      }
    },
    
    dumpStorageContents() {
      chrome.storage.local.get(null, (items) => {
        console.log('All storage contents:', Object.keys(items));
        
        // Check specific data structures
        if (items.latestRecordedData) {
          console.log('latestRecordedData info:', {
            count: items.latestRecordedData.length,
            firstItem: items.latestRecordedData[0] ? 
              { url: items.latestRecordedData[0].url, method: items.latestRecordedData[0].method } : null
          });
        }
        
        if (items.replayWindowData) {
          console.log('replayWindowData info:', {
            count: items.replayWindowData.length,
            firstItem: items.replayWindowData[0] ? 
              { url: items.replayWindowData[0].url, method: items.replayWindowData[0].method } : null
          });
        }
      });
    },
    
    showNoDataMessage() {
      // Add UI indication that no data was found
      this.executionStatus = 'No recorded data found to replay';
    },
    
    // Add the missing formatJson method
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

    async loadReplayFromFile(event) {
      try {
        const file = event.target.files[0];
        if (!file) {
          console.error('No file selected');
          return;
        }
        
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const fileContent = e.target.result;
            const jsonData = JSON.parse(fileContent);
            console.log('File content parsed as JSON:', jsonData);
            
            // Détection du format de fichier importé
            if (jsonData.rawRequests && Array.isArray(jsonData.rawRequests)) {
              // Fichier exporté avec nos modifications pour préserver la structure brute
              console.log('Detected raw requests format with preserved structure:', jsonData.rawRequests.length);
              this.recordedRequestsData = jsonData.rawRequests;
              this.scenarioSteps = await this.replayService.convertRecordedDataToScenario(jsonData.rawRequests);
            } 
            // Pour la rétrocompatibilité avec les anciens fichiers exportés
            else if (jsonData.results && Array.isArray(jsonData.results)) {
              this.recordedRequestsData = jsonData.results.map(result => result.request);
              this.scenarioSteps = await this.replayService.convertRecordedDataToScenario(jsonData.results.map(result => result.request));
            } 
            // Pour les fichiers OpenAPI standard
            else if (jsonData.openapi || jsonData.swagger) {
              this.scenarioSteps = this.replayService.extractStepsFromOpenAPI(jsonData);
              console.log('Extracted steps from OpenAPI:', this.scenarioSteps.length);
            } 
            // Pour les fichiers .har ou d'autres formats similaires
            else if (jsonData.log && jsonData.log.entries) {
              const entries = jsonData.log.entries.map(entry => {
                return {
                  url: entry.request.url,
                  method: entry.request.method,
                  requestHeaders: entry.request.headers.reduce((obj, header) => {
                    obj[header.name] = header.value;
                    return obj;
                  }, {}),
                  requestBody: this.extractBodyFromHAR(entry.request),
                  responseHeaders: entry.response.headers.reduce((obj, header) => {
                    obj[header.name] = header.value;
                    return obj;
                  }, {})
                };
              });
              
              this.recordedRequestsData = entries;
              this.scenarioSteps = await this.replayService.convertRecordedDataToScenario(entries);
            } 
            // Si aucun format reconnu, essayer de traiter comme un tableau brut de requêtes
            else if (Array.isArray(jsonData)) {
              console.log('Processing array of requests:', jsonData.length);
              this.recordedRequestsData = jsonData;
              this.scenarioSteps = await this.replayService.convertRecordedDataToScenario(jsonData);
            } 
            else {
              throw new Error('Format de fichier non reconnu');
            }
            
            this.setupScenario();
            
            // Récupérer les options d'exécution si elles existent
            if (jsonData.executionOptions) {
              this.executionOptions = jsonData.executionOptions;
            }
            
            // Effacer le fichier sélectionné pour permettre de réimporter le même fichier
            event.target.value = '';
            
            console.log('Loaded steps:', this.scenarioSteps.length);
          } catch (error) {
            console.error('Error processing file content:', error);
            this.showAlert('error', `Erreur lors de l'analyse du fichier: ${error.message}`);
          }
        };
        
        reader.readAsText(file);
      } catch (error) {
        console.error('Error loading file:', error);
        this.showAlert('error', `Erreur lors du chargement du fichier: ${error.message}`);
      }
    },
    
    // Nouvelle fonction pour extraire le corps de la requête à partir d'un format HAR
    extractBodyFromHAR(request) {
      if (!request.postData) return null;
      
      // Si le corps est déjà disponible en texte
      if (request.postData.text) {
        try {
          if (request.postData.mimeType.includes('json')) {
            return JSON.parse(request.postData.text);
          }
          return request.postData.text;
        } catch (e) {
          return request.postData.text;
        }
      }
      
      // Si le corps est dans un format de paramètres
      if (request.postData.params && request.postData.params.length > 0) {
        return request.postData.params.reduce((obj, param) => {
          obj[param.name] = param.value;
          return obj;
        }, {});
      }
      
      return null;
    },

    exportToFile() {
      try {
        if (!this.recordedRequestsData || this.recordedRequestsData.length === 0) {
          this.showAlert('error', 'Aucune donnée à exporter');
          return;
        }

        // Créer un objet contenant les requêtes brutes et les options d'exécution
        const exportData = {
          timestamp: new Date().toISOString(),
          rawRequests: this.recordedRequestsData,
          executionOptions: this.executionOptions || {}
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `network-recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        a.click();

        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 150);
        
        this.showAlert('success', 'Export réussi!');
      } catch (error) {
        console.error('Error exporting data:', error);
        this.showAlert('error', `Erreur lors de l'exportation: ${error.message}`);
      }
    },

    /**
     * Extraire et définir la base URL commune à partir des étapes chargées
     */
    setCommonBaseUrl() {
      // Importer le service replayService
      import('../../services/replayService').then(module => {
        const replayService = module.default;
        // Extraire la base URL commune des étapes
        const commonBaseUrl = replayService.extractCommonBaseUrl(this.scenarioSteps);
        console.log('Base URL commune extraite:', commonBaseUrl);
        
        // Définir la base URL dans les options d'exécution
        if (commonBaseUrl) {
          this.executionOptions.baseUrl = commonBaseUrl;
          console.log('Base URL définie dans les options d\'exécution:', this.executionOptions.baseUrl);
        } else {
          console.warn('Aucune base URL commune trouvée dans les étapes');
        }
      }).catch(error => {
        console.error('Erreur lors de l\'extraction de la base URL commune:', error);
      });
    },

    /**
     * Supprimer une variable globale de toutes les étapes
     * @param {Object} removedVariable - La variable globale supprimée
     */
    removeGlobalVariableFromSteps(removedVariable) {
      console.log('Suppression de la variable globale de toutes les étapes:', removedVariable);
      
      if (!removedVariable || !removedVariable.name) {
        console.warn('Variable globale invalide à supprimer');
        return;
      }
      
      // Parcourir toutes les étapes pour supprimer la variable
      this.scenarioSteps.forEach((step) => {
        if (step.variableCaptures && step.variableCaptures.length > 0) {
          // Filtrer les variableCaptures pour supprimer celle qui correspond à la variable globale
          step.variableCaptures = step.variableCaptures.filter(
            capture => capture.name !== removedVariable.name
          );
        }
      });
      
      // Afficher un message de confirmation
      this.$root.$emit('show-snackbar', {
        text: `Variable globale "${removedVariable.name}" supprimée de toutes les étapes`,
        color: 'success',
        timeout: 3000
      });
    },
  }
}
</script>

<style>
.replay-tab {
  width: 100%;
  height: 100%;
}

.replay-tab-container {
  width: 100%;
  height: 100%;
  padding: 16px;
}

/* Ultra-compact header with no spacing */
.ultra-compact-header {
  display: flex;
  flex-direction: column;
  padding: 0 !important;
  margin: 0 !important;
  line-height: 1 !important;
}

.scenario-card {
  display: flex;
  flex-direction: column;
}

/* Make steps section properly scrollable */
.steps-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin-top: 2px;
}

/* Force minimal spacing for title and subtitle */
.replay-tab .v-card-title {
  line-height: 1.1 !important;
  padding: 6px 12px !important;
  min-height: 0 !important;
  margin: 0 !important;
}

.replay-tab .v-card-subtitle {
  line-height: 1.1 !important;
  padding: 0px 12px 6px 12px !important;
  min-height: 0 !important;
  margin: 0 !important;
}

/* Header avec onglets */
.header-with-tabs {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.header-with-tabs .v-card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Onglets à droite */
.tabs-right {
  margin-left: auto;
  min-width: 200px;
}

/* Style pour la section Variables */
.variables-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  margin-top: 20px;
  background-color: #f5f5f5;
  border-radius: 8px;
  min-height: 300px;
}

.variables-title {
  font-size: 24px;
  margin-bottom: 16px;
  color: #333;
}

.variables-description {
  text-align: center;
  color: #666;
}

/* S'assurer que l'espacement est correct */
.v-window {
  margin-top: 0 !important;
  padding-top: 0 !important;
}
</style>
