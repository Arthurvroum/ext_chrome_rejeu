<template>
  <div 
    class="list-item"
    :class="{ 
      'list-item-disabled': step.skip,
      'list-item-success': getStepResultStatus() === 'success',
      'list-item-error': getStepResultStatus() === 'error',
      'list-item-in-progress': index === currentStepIndex && isReplaying
    }"
  >
    <v-list-item
      :ripple="false"
      @click="$emit('toggle-step')"
      class="step-item"
    >
      <template v-slot:prepend>
        <!-- Step configuration checkbox-->
        <v-checkbox
          v-model="localEnabled"
          hide-details
          density="compact"
          color="primary"
          :disabled="isReplaying"
          @change="updateStepEnabled"
          @click.stop
        ></v-checkbox>
        
        <!-- Current step indicator when replaying -->
        <v-progress-circular
          v-if="index === currentStepIndex && isReplaying"
          indeterminate
          color="primary"
          size="28"
          width="3"
          class="ml-2 step-progress-indicator pulse-animation"
        ></v-progress-circular>
        
        <!-- Result status icon when results available -->
        <v-avatar 
          v-else-if="results" 
          :color="getStatusColor(getStepResultStatus())" 
          size="small" 
          class="ml-2"
        >
          <v-icon 
            :icon="getStatusIcon(getStepResultStatus())" 
            color="white" 
            size="small"
          ></v-icon>
        </v-avatar>
      </template>
      
      <template v-slot:default>
        <div>
          <v-list-item-title class="d-flex align-center">
            <v-chip
              size="small"
              :color="getMethodColor(step.method)"
              class="mr-2"
            >
              {{ step.method }}
            </v-chip>
            <span :class="{'font-weight-bold': index === currentStepIndex && isReplaying, 'text-primary': index === currentStepIndex && isReplaying}">
              {{ step.name || `Step ${index + 1}` }}
            </span>
            
            <!-- Current step badge -->
            <v-chip
              v-if="index === currentStepIndex && isReplaying"
              size="small"
              color="primary"
              class="ml-2 current-step-badge pulse-animation"
            >
              <v-icon start icon="mdi-loading" size="x-small" class="rotating-icon"></v-icon>
              EN COURS
            </v-chip>
          </v-list-item-title>
          
          <v-list-item-subtitle class="text-truncate">
            {{ step.url }}
          </v-list-item-subtitle>
          
          <!-- Error message -->
          <v-alert
            v-if="hasResultError()"
            type="error"
            variant="tonal"
            density="compact"
            class="mt-2"
          >
            {{ getResultError() }}
          </v-alert>
        </div>
      </template>
      
      <template v-slot:append>
        <v-btn
          icon="mdi-chevron-down"
          variant="text"
          size="small"
          :class="{ 'rotate-icon': expanded }"
          @click.stop="$emit('toggle-step')"
        ></v-btn>
      </template>
    </v-list-item>
    
    <!-- Déplacé en dehors du v-list-item pour une meilleure animation -->
    <v-expand-transition>
      <div v-if="expanded" class="pa-4 mx-4 mt-2 mb-4 bg-grey-lighten-4 rounded">
        <StepDetails 
          :step="step"
          :index="index"
          :results="results"
          :execution-options="executionOptions"
          :source-options="captureSourceOptions"
          @open-capture-dialog="$emit('open-capture-dialog')"
          @open-substitution-dialog="$emit('open-substitution-dialog')"
          @update-step="updateChildStep"
        />
      </div>
    </v-expand-transition>
  </div>
</template>

<script>
import { ref, watch } from 'vue';
import StepDetails from './StepDetails.vue';

export default {
  name: 'StepItem',
  components: {
    StepDetails
  },
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
    currentStepIndex: {
      type: Number,
      default: -1
    },
    isReplaying: {
      type: Boolean,
      default: false
    },
    progressStatus: {
      type: String,
      default: null
    },
    expanded: {
      type: Boolean,
      default: false
    },
    executionOptions: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['toggle-step', 'update-step', 'open-capture-dialog', 'open-substitution-dialog'],
  setup(props, { emit }) {
    const localEnabled = ref(props.step.enabled);
    
    const captureSourceOptions = [
      { title: 'Corps de la réponse', value: 'body' },
      { title: 'En-têtes de la réponse', value: 'headers' },
      { title: 'URL de la réponse', value: 'url' }
    ];
    
    // Watch for props changes
    watch(() => props.step.enabled, (newValue) => {
      localEnabled.value = newValue;
    });
    
    // Methods
    const updateStepEnabled = () => {
      emit('update-step', { 
        enabled: localEnabled.value, 
        skip: !localEnabled.value 
      });
    };
    
    const updateChildStep = (updatedData) => {
      emit('update-step', { ...updatedData });
    };
    
    const getMethodColor = (method) => {
      const colors = {
        GET: 'primary',
        POST: 'success',
        PUT: 'warning',
        DELETE: 'error',
        PATCH: 'info'
      };
      return colors[method] || 'grey';
    };
    
    const getStepResultStatus = () => {
      // Check real-time progress status first
      if (props.progressStatus) {
        return props.progressStatus;
      }

      // Otherwise use final result
      if (!props.results) return null;
      
      if (props.results.error) return 'error';
      return 'success';
    };
    
    const hasResultError = () => {
      return props.results && 
             props.results.status === 'error' &&
             props.results.error;
    };
    
    const getResultError = () => {
      if (!hasResultError()) return '';
      return props.results.error;
    };
    
    const getStatusColor = (status) => {
      if (status === 'success') return 'success';
      if (status === 'error') return 'error';
      if (status === 'skipped') return 'warning';
      if (status === 'in-progress') return 'info';
      return 'grey';
    };
    
    const getStatusIcon = (status) => {
      if (status === 'success') return 'mdi-check';
      if (status === 'error') return 'mdi-close';
      if (status === 'skipped') return 'mdi-skip-next';
      if (status === 'in-progress') return 'mdi-loading';
      return 'mdi-help';
    };
    
    return {
      localEnabled,
      captureSourceOptions,
      updateStepEnabled,
      updateChildStep,
      getMethodColor,
      getStepResultStatus,
      hasResultError,
      getResultError,
      getStatusColor,
      getStatusIcon
    };
  }
}
</script>

<style scoped>
.rotate-icon {
  transform: rotate(180deg);
  transition: transform 0.3s ease;
}

.list-item-disabled {
  opacity: 0.7;
}

.list-item-success {
  border-left: 4px solid var(--v-success-base, #4CAF50);
}

.list-item-error {
  border-left: 4px solid var(--v-error-base, #FF5252);
}

.list-item-skipped {
  border-left: 4px solid var(--v-warning-base, #FFC107);
}

.list-item-in-progress {
  border-left: 4px solid var(--v-primary-base, #1976D2);
  background-color: rgba(25, 118, 210, 0.1);
  animation: pulse-background 2s infinite;
}

.step-item {
  min-height: 60px !important;
  margin-bottom: 10px !important;
}

.step-progress-indicator {
  animation: pulse 1.5s infinite;
}

.current-step-badge {
  font-weight: bold;
  animation: pulse 1.5s infinite;
}

.rotating-icon {
  animation: rotate 1.5s linear infinite;
}

.pulse-animation {
  animation: pulse 1.5s infinite ease-in-out;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse-background {
  0% { background-color: rgba(25, 118, 210, 0.1); }
  50% { background-color: rgba(25, 118, 210, 0.2); }
  100% { background-color: rgba(25, 118, 210, 0.1); }
}
</style>