<template>
    <v-card-text class="results-summary">
      <v-row>
        <v-col cols="3">
          <v-card flat class="text-center pa-3">
            <div class="text-h4">{{ steps.length }}</div>
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
  </template>
  
  <script>
  import { computed } from 'vue';
  
  export default {
    name: 'ResultsSummary',
    props: {
      steps: {
        type: Array,
        required: true
      },
      results: {
        type: Array,
        required: true
      }
    },
    setup(props) {
      const successCount = computed(() => 
        props.results.filter(r => r && r.status === 'success').length);
      
      const errorCount = computed(() => 
        props.results.filter(r => r && r.status === 'error').length);
      
      const skippedCount = computed(() => 
        props.results.filter(r => r && r.status === 'skipped').length);
      
      return {
        successCount,
        errorCount,
        skippedCount
      };
    }
  }
  </script>
  
  <style scoped>
  .results-summary {
    flex-shrink: 0;
  }
  </style>