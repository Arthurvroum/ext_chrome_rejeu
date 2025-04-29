<template>
  <v-card variant="outlined" class="mb-4">
    <v-card-text>
      <v-alert
        :color="isRecording ? 'error' : 'info'"
        :icon="isRecording ? 'mdi-record-circle' : 'mdi-information'"
        border="start"
        variant="tonal"
        class="mb-2"
        density="compact"
      >
        <span v-if="isRecording">Recording in progress... ({{ recordedCount }} requests)</span>
        <span v-else>Ready to record</span>
      </v-alert>
      
      <div class="d-flex flex-column">
        <div class="d-flex justify-space-between align-center button-container mb-2">
          <v-btn 
            :color="isRecording ? 'error' : 'primary'"
            @click="toggleRecording" 
            :disabled="disabled"
            density="comfortable"
            size="small"
            variant="elevated"
            class="flex-grow-1 action-button"
          >
            <v-icon :icon="isRecording ? 'mdi-stop' : 'mdi-record'" size="small" class="mr-1"></v-icon>
            {{ isRecording ? 'Stop' : 'Start Recording' }}
          </v-btn>
        </div>
        
        <div class="d-flex justify-space-between align-center button-container mb-2">
          <v-btn 
            color="info"
            @click="openReplayTab" 
            density="comfortable"
            size="small"
            variant="elevated"
            class="flex-grow-1 action-button"
          >
            <v-icon icon="mdi-tab" size="small" class="mr-1"></v-icon>
            Open Replay Tab
          </v-btn>
        </div>
        
        <div class="d-flex justify-space-between align-center button-container">
          <v-btn 
            color="secondary"
            @click="exportRecording" 
            :disabled="!hasRecordedData"
            density="comfortable"
            size="small"
            variant="elevated"
            class="flex-grow-1 action-button mr-2"
          >
            <v-icon icon="mdi-export" size="small" class="mr-1"></v-icon>
            Export
          </v-btn>
          
          <v-btn 
            color="warning"
            @click="clearRecordings" 
            :disabled="!hasRecordedData"
            density="comfortable"
            size="small"
            variant="elevated"
            class="flex-grow-1 action-button"
          >
            <v-icon icon="mdi-delete" size="small" class="mr-1"></v-icon>
            Clear Data
          </v-btn>
        </div>
      </div>

      <div class="text-caption text-center mt-2">
        {{ status }}
      </div>
    </v-card-text>
  </v-card>
</template>

<script>
export default {
  name: 'RecordControls',
  props: {
    isRecording: {
      type: Boolean,
      default: false
    },
    recordedCount: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      default: 'Ready to record'
    },
    hasRecordedData: {
      type: Boolean,
      default: false
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  methods: {
    toggleRecording() {
      this.$emit('toggle-recording');
    },
    exportRecording() {
      this.$emit('export-recording');
    },
    clearRecordings() {
      this.$emit('clear-recordings');
    },
    openReplayTab() {
      this.$emit('open-replay-tab');
    }
  }
}
</script>

<style scoped>
.button-container {
  width: 100%;
}

.action-button {
  min-width: 0;
  white-space: nowrap;
}
</style>
