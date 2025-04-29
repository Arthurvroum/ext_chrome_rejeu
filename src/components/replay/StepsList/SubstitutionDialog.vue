<template>
    <v-dialog :model-value="modelValue" @update:model-value="$emit('update:model-value', $event)" max-width="600px">
      <v-card>
        <v-card-title class="bg-primary text-white">Nouvelle substitution de variable</v-card-title>
        <v-card-text>
          <v-form ref="form" @submit.prevent="handleSave">
            <v-text-field 
              v-model="localForm.regex" 
              label="Expression régulière à remplacer" 
              :rules="[v => !!v || 'L\'expression est requise']" 
              required
            ></v-text-field>
            
            <v-radio-group v-model="localForm.mode" class="mt-3">
              <v-radio value="variable" label="Utiliser une variable capturée"></v-radio>
              <v-radio value="fixed" label="Utiliser une valeur fixe"></v-radio>
            </v-radio-group>
            
            <template v-if="localForm.mode === 'variable'">
              <v-select 
                v-model="localForm.sourceStep" 
                :items="availableSteps" 
                label="Étape source" 
                item-title="label" 
                item-value="value" 
                :rules="[v => v !== null || 'L\'étape source est requise']"
                required
              ></v-select>
              
              <v-select 
                v-if="localForm.sourceStep !== null"
                v-model="localForm.targetVariable" 
                :items="getAvailableVariables(localForm.sourceStep)" 
                label="Variable à utiliser" 
                :rules="[v => !!v || 'La variable est requise']"
                required
              ></v-select>
            </template>
            
            <template v-else>
              <v-text-field 
                v-model="localForm.value" 
                label="Valeur fixe" 
                :rules="[v => !!v || 'La valeur est requise']" 
                required
              ></v-text-field>
            </template>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="$emit('update:model-value', false)">Annuler</v-btn>
          <v-btn color="primary" @click="handleSave">Enregistrer</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </template>
  
  <script>
  import { ref, watch, onMounted } from 'vue';
  
  export default {
    name: 'SubstitutionDialog',
    props: {
      modelValue: {
        type: Boolean,
        required: true
      },
      form: {
        type: Object,
        required: true
      },
      availableSteps: {
        type: Array,
        required: true
      },
      getAvailableVariables: {
        type: Function,
        required: true
      }
    },
    emits: ['update:model-value', 'save'],
    setup(props, { emit }) {
      const form = ref(null);
      // Use a local copy of the form data
      const localForm = ref({ ...props.form });
      
      // Watch for changes in the form prop
      watch(() => props.form, (newForm) => {
        localForm.value = { ...newForm };
      }, { deep: true });
      
      // Watch for dialog opening to log
      watch(() => props.modelValue, (isOpen) => {
        if (isOpen) {
          console.log('SubstitutionDialog opened with form:', localForm.value);
        }
      });
      
      onMounted(() => {
        console.log('SubstitutionDialog mounted with form:', props.form);
      });
      
      const handleSave = () => {
        // Debug log
        console.log('Save button clicked in SubstitutionDialog with form data:', localForm.value);
        
        // Validation
        if (!localForm.value.regex) {
          console.error('Validation failed: regex is missing');
          return;
        }
        
        if (localForm.value.mode === 'variable') {
          if (localForm.value.sourceStep === null || !localForm.value.targetVariable) {
            console.error('Validation failed: sourceStep or targetVariable is missing');
            return;
          }
        } else if (!localForm.value.value) {
          console.error('Validation failed: fixed value is missing');
          return;
        }
        
        // Clone the object to avoid reference issues
        const formData = { ...localForm.value };
        console.log('Emitting save event with data:', formData);
        
        // Emit the save event with the form data
        emit('save', formData);
        
        // Close the dialog
        emit('update:model-value', false);
      };
      
      return {
        form,
        localForm,
        handleSave
      };
    }
  }
  </script>