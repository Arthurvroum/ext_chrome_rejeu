<template>
  <div class="variable-capture">
    <!-- Affichage des captures existantes -->
    <div v-if="hasCaptureConfig" class="existing-captures">
      <h5>Captures de variables configurées</h5>
      <div 
        v-for="(capture, index) in request.variableCapture" 
        :key="index" 
        class="capture-item"
      >
        <div class="capture-info">
          <strong>{{ capture.name }}</strong> - {{ capture.regex }}
          <div class="capture-source">{{ capture.source }}</div>
        </div>
        <button @click="editCapture(index)" class="edit-button" title="Modifier">
          <i class="fas fa-edit"></i>
        </button>
        <button @click="removeCapture(index)" class="remove-button" title="Supprimer">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
    
    <!-- Bouton pour ajouter une nouvelle capture -->
    <v-btn
      color="primary"
      @click="showAddCaptureDialog"
      class="mt-3"
    >
      <i class="fas fa-plus mr-2"></i> Ajouter une capture de variable
    </v-btn>
    
    <!-- Modal pour l'édition -->
    <v-dialog v-model="showEditDialog" max-width="600px">
      <v-card>
        <v-card-title class="bg-primary text-white">
          {{ editIndex !== null ? 'Modifier la capture' : 'Nouvelle capture de variable' }}
        </v-card-title>
        <v-card-text class="pt-4">
          <v-form @submit.prevent="saveCapture">
            <v-row>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="captureName"
                  label="Nom de variable"
                  variant="outlined"
                  :rules="[v => !!v || 'Le nom est requis']"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="captureRegex"
                  label="Expression régulière"
                  variant="outlined"
                  :rules="[v => !!v || 'L\'expression est requise']"
                ></v-text-field>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="captureSource"
                  label="Source"
                  :items="['responseBody', 'responseHeaders', 'url']"
                  variant="outlined"
                ></v-select>
              </v-col>
              <v-col cols="12" sm="6">
                <v-checkbox
                  v-model="captureRequired"
                  label="Obligatoire"
                ></v-checkbox>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" sm="6">
                <v-checkbox
                  v-model="captureFailOnError"
                  label="Échouer en cas d'erreur"
                ></v-checkbox>
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="captureScope"
                  label="Portée"
                  :items="[
                    { title: 'Globale', value: 'global' },
                    { title: 'Cette étape uniquement', value: 'step' }
                  ]"
                  variant="outlined"
                ></v-select>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" text @click="showEditDialog = false">Annuler</v-btn>
          <v-btn color="primary" @click="saveCapture">Enregistrer</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
export default {
  name: 'VariableCaptureForm',
  props: {
    request: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      showEditDialog: false,
      editIndex: null,
      captureName: '',
      captureRegex: '',
      captureSource: 'responseBody',
      captureRequired: true,
      captureFailOnError: false,
      captureScope: 'global'
    }
  },
  computed: {
    isValid() {
      return this.captureName && this.captureRegex;
    },
    hasCaptureConfig() {
      return this.request.variableCapture && this.request.variableCapture.length > 0;
    }
  },
  methods: {
    showAddCaptureDialog() {
      this.editIndex = null;
      this.captureName = '';
      this.captureRegex = '';
      this.captureSource = 'responseBody';
      this.captureRequired = true;
      this.captureFailOnError = false;
      this.captureScope = 'global';
      this.showEditDialog = true;
    },
    saveCapture() {
      if (!this.captureName || !this.captureRegex) {
        // Validation échouée
        return;
      }
      
      const captureConfig = {
        name: this.captureName,
        regex: this.captureRegex,
        source: this.captureSource,
        required: this.captureRequired,
        failOnError: this.captureFailOnError,
        scope: this.captureScope
      };
      
      if (this.editIndex !== null) {
        // Mode édition - mettre à jour la capture existante
        this.$set(this.request.variableCapture, this.editIndex, captureConfig);
      } else {
        // Nouvelle capture - l'ajouter au tableau
        if (!this.request.variableCapture) {
          this.$set(this.request, 'variableCapture', []);
        }
        this.request.variableCapture.push(captureConfig);
      }
      
      // Réinitialiser et fermer le formulaire
      this.resetForm();
      this.showEditDialog = false;
    },
    editCapture(index) {
      const capture = this.request.variableCapture[index];
      this.captureName = capture.name;
      this.captureRegex = capture.regex;
      this.captureSource = capture.source || 'responseBody';
      this.captureRequired = capture.required !== false; // par défaut true
      this.captureFailOnError = capture.failOnError === true; // par défaut false
      this.captureScope = capture.scope || 'global';
      
      this.editIndex = index;
      this.showEditDialog = true;
    },
    removeCapture(index) {
      this.request.variableCapture.splice(index, 1);
      if (this.request.variableCapture.length === 0) {
        this.$delete(this.request, 'variableCapture');
      }
    },
    resetForm() {
      this.editIndex = null;
      this.captureName = '';
      this.captureRegex = '';
      this.captureSource = 'responseBody';
      this.captureRequired = true;
      this.captureFailOnError = false;
      this.captureScope = 'global';
    }
  }
}
</script>

<style scoped>
.edit-button {
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  font-size: 12px;
  padding: 0;
  margin-right: 5px;
}

.edit-button:hover {
  background-color: #0062cc;
}
</style>
