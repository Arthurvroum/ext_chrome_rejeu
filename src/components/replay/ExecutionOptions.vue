<template>
  <v-card class="mb-4" variant="outlined">
    <v-card-title class="d-flex align-center">
      <v-icon icon="mdi-cog" class="mr-2"></v-icon>
      Execution Options
    </v-card-title>
    
    <v-card-text>
      <v-row class="align-center justify-center">
        <!-- Stop on Error -->
        <v-col cols="12" sm="6" md="2" class="d-flex align-center" style="height: 56px;">
          <v-switch
            v-model="localStopOnError"
            color="error"
            hide-details
            label="Stop on Error"
            @update:model-value="updateStopOnError"
            density="comfortable"
          ></v-switch>
        </v-col>
        
        <!-- Spacer plus large -->
        <v-col md="1.5" class="d-none d-md-block"></v-col>
        
        <!-- Error on Capture -->
        <v-col cols="12" sm="6" md="2" class="d-flex align-center" style="height: 56px;">
          <div>
            <v-switch
              v-model="localErrorOnCapture"
              color="warning"
              hide-details
              label="Error on Capture"
              @update:model-value="updateErrorOnCapture"
              density="comfortable"
            ></v-switch>
            <div class="text-caption text-grey">
              Déclenche une erreur si une variable est capturée
            </div>
          </div>
        </v-col>
        
        <!-- Spacer plus large -->
        <v-col md="1.5" class="d-none d-md-block"></v-col>
        
        <!-- Intervalle avec éléments agrandis -->
        <v-col cols="12" sm="6" md="2" class="d-flex align-center" style="height: 56px;">
          <div class="d-flex align-center">
            <div class="mr-2" style="font-size: 16px;">Intervalle (ms):</div>
            <v-text-field
              v-model.number="localStepInterval"
              type="number"
              :min="0"
              :max="10000"
              hide-details
              density="comfortable"
              style="width: 120px;"
              class="mr-1"
              @update:model-value="updateStepInterval"
            ></v-text-field>
          </div>
        </v-col>
        
        <!-- Spacer plus large -->
        <v-col md="1.5" class="d-none d-md-block"></v-col>
        
        <!-- Global Variables button avec taille agrandie -->
        <v-col cols="12" sm="6" md="2" class="d-flex align-center" style="height: 56px;">
          <v-btn
            color="info"
            prepend-icon="mdi-atom-variant"
            @click="showGlobalVariablesDialog = true"
            class="global-vars-btn"
            size="large"
          >
            Global Variables
          </v-btn>
        </v-col>
        
        <!-- Base URL et boutons de contrôle (reste inchangé) -->
        <v-col cols="12" sm="12" md="12" class="d-flex align-center justify-space-between mt-3">
          <!-- Base URL Field -->
          <v-text-field
            v-model="localBaseUrl"
            label="Base URL"
            placeholder="http://example.com"
            hint="Modifie la base URL pour toutes les requêtes"
            persistent-hint
            prepend-icon="mdi-earth"
            clearable
            @update:model-value="updateBaseUrl"
            class="mr-2"
            style="max-width: 500px;"
          ></v-text-field>
          
          <!-- Buttons -->
          <div class="d-flex">
            <v-btn
              v-if="isReplaying"
              color="primary"
              :loading="isReplaying"
              size="large"
              class="mr-2"
              prepend-icon="mdi-play"
              @click="$emit('start-replay')"
            >
              Start Replay
            </v-btn>
            
            <div v-else class="custom-animated-button mr-2" @click="startReplayWithAnimation">
              <span>Start Replay</span>
              <div class="icon">
                <v-icon class="fa-play">mdi-play</v-icon>
              </div>
            </div>
            
            <div class="custom-animated-button clear-results-btn" @click="clearResultsWithAnimation">
              <span>Clear Results</span>
              <div class="icon">
                <v-icon class="fa-remove">mdi-delete</v-icon>
              </div>
            </div>
          </div>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
  
  <!-- Modal pour les variables globales -->
  <v-dialog v-model="showGlobalVariablesDialog" max-width="800px">
    <v-card>
      <v-card-title class="bg-info text-white">
        <v-icon start icon="mdi-variable" class="mr-2"></v-icon>
        Variables Globales
      </v-card-title>
      
      <v-card-text class="pa-4">
        <p class="text-body-2 mb-4">
          Les variables globales seront disponibles pour toutes les requêtes. Vous pouvez ajouter des variables à capturer globalement.
        </p>
        
        <!-- Formulaire d'ajout de variable -->
        <v-form @submit.prevent="addGlobalVariable">
          <v-row>
            <v-col cols="12" sm="4">
              <v-text-field
                v-model="newVariable.name"
                label="Nom de la variable"
                placeholder="ma_variable"
                :rules="[v => !!v || 'Le nom est requis']"
                required
              ></v-text-field>
            </v-col>
            
            <v-col cols="12" sm="5">
              <v-text-field
                v-model="newVariable.regex"
                label="Expression régulière"
                placeholder="regex pour capturer la valeur"
                :rules="[v => !!v || 'L\'expression est requise']"
                required
              ></v-text-field>
            </v-col>
            
            <v-col cols="12" sm="3">
              <v-select
                v-model="newVariable.source"
                :items="captureSourceOptions"
                label="Source"
                item-title="title"
                item-value="value"
                required
              ></v-select>
            </v-col>
            
            <v-col cols="12" class="d-flex justify-end">
              <v-btn
                color="primary"
                @click="addGlobalVariable"
                :disabled="!newVariable.name || !newVariable.regex"
                prepend-icon="mdi-plus"
              >
                Ajouter la variable
              </v-btn>
            </v-col>
          </v-row>
        </v-form>
        
        <v-divider class="my-4"></v-divider>
        
        <!-- Liste des variables existantes -->
        <h3 class="text-h6 mb-3">Variables globales ({{ localGlobalVariables.length }})</h3>
        
        <v-alert
          v-if="localGlobalVariables.length === 0"
          type="info"
          variant="tonal"
          class="mb-4"
        >
          Aucune variable globale définie. Ajoutez une variable en utilisant le formulaire ci-dessus.
        </v-alert>
        
        <v-card 
          v-for="(variable, index) in localGlobalVariables" 
          :key="index"
          variant="outlined"
          class="mb-2 capture-card"
        >
          <v-card-text class="d-flex justify-space-between align-center py-2">
            <div>
              <div class="d-flex align-center">
                <v-chip color="info" size="small" class="mr-2">{{ variable.name }}</v-chip>
                <span class="text-body-2">{{ variable.regex }}</span>
              </div>
              <div class="text-caption text-grey">
                Source: {{ getSourceLabel(variable.source) }}
              </div>
            </div>
            
            <v-btn
              color="error"
              icon
              size="small"
              variant="text"
              @click="removeGlobalVariable(index)"
            >
              <v-icon>mdi-delete</v-icon>
            </v-btn>
          </v-card-text>
        </v-card>
      </v-card-text>
      
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn 
          color="primary" 
          @click="saveGlobalVariables"
        >
          Enregistrer
        </v-btn>
        <v-btn 
          text 
          @click="showGlobalVariablesDialog = false"
        >
          Fermer
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: 'ExecutionOptions',
  props: {
    stopOnError: {
      type: Boolean,
      default: true
    },
    errorOnCapture: {
      type: Boolean,
      default: false
    },
    stepInterval: {
      type: Number,
      default: 1000
    },
    isReplaying: {
      type: Boolean,
      default: false
    },
    baseUrl: {
      type: String,
      default: ''
    },
    globalVariables: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      localStopOnError: this.stopOnError,
      localErrorOnCapture: this.errorOnCapture,
      localStepInterval: this.stepInterval,
      localBaseUrl: this.baseUrl,
      localGlobalVariables: this.globalVariables ? [...this.globalVariables] : [],
      buttonSuccess: false,
      clearSuccess: false,
      showGlobalVariablesDialog: false,
      newVariable: {
        name: '',
        regex: '',
        source: 'body'
      },
      captureSourceOptions: [
        { title: 'Corps de la réponse', value: 'body' },
        { title: 'En-têtes de la réponse', value: 'headers' },
        { title: 'URL de la réponse', value: 'url' }
      ]
    }
  },
  watch: {
    stopOnError(newVal) {
      this.localStopOnError = newVal;
    },
    errorOnCapture(newVal) {
      this.localErrorOnCapture = newVal;
    },
    stepInterval(newVal) {
      this.localStepInterval = newVal;
    },
    baseUrl(newVal) {
      this.localBaseUrl = newVal;
    },
    globalVariables(newVal) {
      this.localGlobalVariables = newVal ? [...newVal] : [];
    }
  },
  methods: {
    updateStopOnError(value) {
      this.$emit('update:stop-on-error', value);
    },
    updateErrorOnCapture(value) {
      this.$emit('update:error-on-capture', value);
    },
    updateStepInterval(value) {
      this.$emit('update:step-interval', value);
    },
    updateBaseUrl(value) {
      this.$emit('update:base-url', value);
    },
    startReplayWithAnimation() {
      // Émettre immédiatement l'événement sans animation de succès
      this.$emit('start-replay');
    },
    clearResultsWithAnimation() {
      // Émettre immédiatement l'événement sans animation de succès
      this.$emit('clear-results');
    },
    addGlobalVariable() {
      if (this.newVariable.name && this.newVariable.regex) {
        this.localGlobalVariables.push({ ...this.newVariable });
        this.newVariable.name = '';
        this.newVariable.regex = '';
      }
    },
    removeGlobalVariable(index) {
      const removedVariable = this.localGlobalVariables[index];
      this.localGlobalVariables.splice(index, 1);
      
      // Émettre un événement pour informer le parent qu'une variable globale a été supprimée
      this.$emit('remove-global-variable', removedVariable);
    },
    saveGlobalVariables() {
      this.$emit('update:global-variables', [...this.localGlobalVariables]);
      this.showGlobalVariablesDialog = false;
      
      // Afficher un message de confirmation
      this.$root.$emit('show-snackbar', {
        text: 'Variables globales enregistrées avec succès',
        color: 'success',
        timeout: 3000
      });
    },
    getSourceLabel(source) {
      const option = this.captureSourceOptions.find(opt => opt.value === source);
      return option ? option.title : source;
    }
  }
}
</script>

<style scoped>
/* Animation des boutons */
.custom-animated-button {
  display: inline-block;
  background-color: #1976D2; /* Couleur primaire par défaut de Vuetify */
  width: 200px;
  height: 44px;
  line-height: 44px;
  color: #fff;
  position: relative;
  cursor: pointer;
  overflow: hidden;
  border-radius: 4px;
  box-shadow: 0 3px 5px rgba(0, 0, 0, 0.2);
  transition: all 0.25s cubic-bezier(0.310, -0.105, 0.430, 1.400);
}

.clear-results-btn {
  background-color: #757575; /* Couleur secondaire pour le bouton Clear */
  width: 180px;
}

.custom-animated-button span,
.custom-animated-button .icon {
  display: block;
  height: 100%;
  text-align: center;
  position: absolute;
  top: 0;
}

.custom-animated-button span {
  width: 72%;
  line-height: inherit;
  font-size: 14px;
  text-transform: uppercase;
  left: 0;
  transition: all 0.25s cubic-bezier(0.310, -0.105, 0.430, 1.400);
  font-weight: 500;
}

.custom-animated-button span:after {
  content: '';
  background-color: rgba(0, 0, 0, 0.2);
  width: 2px;
  height: 70%;
  position: absolute;
  top: 15%;
  right: -1px;
}

.custom-animated-button .icon {
  width: 28%;
  right: 0;
  transition: all 0.25s cubic-bezier(0.310, -0.105, 0.430, 1.400);
}

.custom-animated-button .fa-play,
.custom-animated-button .fa-remove {
  font-size: 18px;
  vertical-align: middle;
  transition: all 0.25s cubic-bezier(0.310, -0.105, 0.430, 1.400), height 0.25s ease;
}

/* Suppression de toutes les références à l'icône fa-check */

.custom-animated-button:hover {
  span {
    left: -72%;
    opacity: 0;
  }
  
  .icon {
    width: 100%;
  }
  
  .fa-play, .fa-remove {
    font-size: 24px;
  }
}

/* Suppression de tous les styles spécifiques à l'état "success" */

.custom-animated-button:hover {
  opacity: 0.9;
  transform: scale(1.02);
}

.custom-animated-button:active {
  opacity: 1;
  transform: scale(0.98);
}

/* Animation spécifique pour le bouton Clear Results */
.clear-results-btn:hover {
  background-color: #616161;
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.3);
}
</style>
