<template>
    <v-card class="mb-4 steps-list-card" variant="outlined">
      <v-card-title class="d-flex justify-space-between align-center steps-header">
        <div class="d-flex align-center">
          <v-icon icon="mdi-format-list-numbered" class="mr-2"></v-icon>
          Steps
        </div>
        <div>
          <!-- Control buttons -->
          <v-btn
            size="small"
            variant="text"
            class="mr-2"
            @click="$emit('toggle-all-steps', true)"
          >
            Enable All
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            class="mr-2"
            @click="$emit('toggle-all-steps', false)"
          >
            Skip All
          </v-btn>
          <!-- Export/Report buttons when results exist -->
          <v-btn
            v-if="hasResults"
            color="primary"
            variant="text"
            prepend-icon="mdi-export"
            size="small"
            class="mr-2"
            @click="$emit('export-results')"
          >
            Export
          </v-btn>
          <v-btn
            v-if="hasResults"
            color="primary"
            variant="text"
            prepend-icon="mdi-file-pdf-box"
            size="small"
            @click="$emit('generate-pdf')"
          >
            PDF Report
          </v-btn>
        </div>
      </v-card-title>
  
      <!-- Results summary when available -->
      <ResultsSummary 
        v-if="hasResults" 
        :steps="steps" 
        :results="results"
      />
  
      <v-divider></v-divider>
      
      <!-- Scrollable steps list container -->
      <div class="steps-scrollable-container">
        <v-list class="steps-list">
          <StepItem
            v-for="(step, index) in steps" 
            :key="index"
            :step="step"
            :index="index"
            :current-step-index="currentStepIndex"
            :is-replaying="isReplaying"
            :progress-status="progressStatus[index]"
            :results="results[index]"
            :expanded="expandedStep === index"
            :execution-options="executionOptions"
            @update-step="(updatedStep) => $emit('update-step', index, updatedStep)"
            @toggle-step="$emit('toggle-step', index)"
            @open-capture-dialog="() => openCaptureDialog(index)"
            @open-substitution-dialog="() => openSubstitutionDialog(index)"
          />
        </v-list>
      </div>
    </v-card>
  
    <!-- Dialogs -->
    <CaptureDialog
      v-model="showCaptureDialog"
      :form="captureForm"
      :source-options="captureSourceOptions"
      @save="saveCapture"
    />
    
    <SubstitutionDialog
      v-model="showSubstitutionDialog"
      :form="substitutionForm"
      :available-steps="availableStepsForVariables"
      :get-available-variables="availableVariablesForStep"
      @save="saveSubstitution"
    />
  </template>
  
  <script>
  import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
  import ResultsSummary from './ResultsSummary.vue';
  import StepItem from './StepItem.vue';
  import CaptureDialog from './CaptureDialog.vue';
  import SubstitutionDialog from './SubstitutionDialog.vue';
  import { useStepStatus } from '../composables/useStepStatus';
  import { useVariableCapture } from '../composables/useVariableCapture';
  import { useVariableSubstitution } from '../composables/useVariableSubstitution';
  
  export default {
    name: 'StepsList',
    components: {
      ResultsSummary,
      StepItem,
      CaptureDialog,
      SubstitutionDialog
    },
    props: {
      steps: {
        type: Array,
        required: true
      },
      expandedStep: {
        type: Number,
        default: null
      },
      isReplaying: {
        type: Boolean,
        default: false
      },
      results: {
        type: Array,
        default: () => []
      },
      currentStepIndex: {
        type: Number,
        default: -1
      },
      executionOptions: {
        type: Object,
        default: () => ({})
      }
    },
    emits: [
      'toggle-step',
      'update-step',
      'toggle-all-steps',
      'export-results',
      'generate-pdf'
    ],
    setup(props, { emit }) {
      // Composables
      const { progressStatus, handleStepProgress } = useStepStatus();
      const { 
        captureSourceOptions, 
        showCaptureDialog, 
        captureForm,
        captureStepIndex,
        openCaptureDialog, 
        saveCapture 
      } = useVariableCapture(props, emit);
      
      const { 
        showSubstitutionDialog, 
        substitutionForm,
        substitutionStepIndex,
        openSubstitutionDialog, 
        saveSubstitution,
        availableVariablesForStep 
      } = useVariableSubstitution(props, emit);
  
      // Computed
      const hasResults = computed(() => props.results && props.results.length > 0);
      
      const availableStepsForVariables = computed(() => {
        return props.steps.map((step, index) => ({
          label: `Étape ${index + 1}: ${step.name || step.url}`,
          value: index
        }));
      });
  
      // Lifecycle
      onMounted(() => {
        window.addEventListener('step-execution-progress', handleStepProgress);
        console.log('StepsList: Listening for step-execution-progress events');
      });
      
      onBeforeUnmount(() => {
        window.removeEventListener('step-execution-progress', handleStepProgress);
      });
  
      return {
        hasResults,
        progressStatus,
        availableStepsForVariables,
        
        // Variable Capture
        captureSourceOptions,
        showCaptureDialog,
        captureForm,
        captureStepIndex,
        openCaptureDialog,
        saveCapture,
        
        // Variable Substitution
        showSubstitutionDialog,
        substitutionForm,
        substitutionStepIndex,
        openSubstitutionDialog,
        saveSubstitution,
        availableVariablesForStep
      };
    }
  }
  </script>
  
  <style scoped>
  .steps-list-card {
    display: flex !important;
    flex-direction: column !important;
    height: calc(100vh - 100px) !important;
    max-height: none !important;
    overflow: hidden !important;
  }
  
  .steps-header {
    flex-shrink: 0;
  }
  
  .steps-scrollable-container {
    flex-grow: 1;
    overflow-y: auto;
    min-height: 200px;
    max-height: calc(100vh - 180px);
    overscroll-behavior: contain;
    height: auto !important;
    padding-bottom: 20px;
  }
  
  .steps-list {
    height: auto !important;
    overflow: visible !important;
    padding-bottom: 120px !important;
    margin-bottom: 30px !important;
  }
  
  /* Ajouter un élément invisible après le dernier élément pour forcer le défilement */
  .steps-list::after {
    content: '';
    display: block;
    height: 100px;
    width: 100%;
  }
  </style>