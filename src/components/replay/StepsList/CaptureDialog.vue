<template>
    <v-dialog :model-value="modelValue" @update:model-value="$emit('update:model-value', $event)" max-width="500px">
      <v-card>
        <v-card-title class="bg-primary text-white">Nouvelle capture de variable</v-card-title>
        <v-card-text>
          <v-form ref="form" @submit.prevent="handleSave">
            <v-text-field 
              v-model="localForm.name" 
              label="Nom de variable" 
              :rules="[v => !!v || 'Le nom est requis']" 
              required
            ></v-text-field>
            
            <v-text-field 
              v-model="localForm.regex" 
              label="Expression régulière" 
              :rules="[v => !!v || 'L\'expression est requise']" 
              required
            ></v-text-field>
            
            <v-select 
              v-model="localForm.source" 
              :items="sourceOptions" 
              label="Source" 
              item-title="title" 
              item-value="value" 
              required
            ></v-select>
            
            <v-switch 
              v-model="localForm.required" 
              color="error" 
              label="Capture obligatoire"
            ></v-switch>
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
    name: 'CaptureDialog',
    props: {
      modelValue: {
        type: Boolean,
        required: true
      },
      form: {
        type: Object,
        required: true
      },
      sourceOptions: {
        type: Array,
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
          console.log('CaptureDialog opened with form:', localForm.value);
        }
      });
      
      onMounted(() => {
        console.log('CaptureDialog mounted with form:', props.form);
      });
      
      const handleSave = () => {
        // Debug log
        console.log('Save button clicked in CaptureDialog with form data:', localForm.value);
        
        // Basic validation
        if (!localForm.value.name || !localForm.value.regex) {
          console.error('Validation failed: name or regex is missing');
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