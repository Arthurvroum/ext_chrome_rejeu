import { ref } from 'vue';

export function useVariableSubstitution(props, emit) {
  const showSubstitutionDialog = ref(false);
  const substitutionForm = ref({
    regex: '',
    mode: 'variable',
    sourceStep: null,
    targetVariable: '',
    value: ''
  });
  const substitutionStepIndex = ref(null);
  
  /**
   * Open the substitution dialog for a specific step
   * @param {Number} stepIndex - Index of the step
   */
  const openSubstitutionDialog = (stepIndex) => {
    // Log pour debug
    console.log('Opening substitution dialog for step', stepIndex);
    
    substitutionForm.value = {
      regex: '',
      mode: 'variable',
      sourceStep: null,
      targetVariable: '',
      value: ''
    };
    substitutionStepIndex.value = stepIndex;
    showSubstitutionDialog.value = true;
  };
  
  /**
   * Save a new substitution to the step
   * @param {Object} formData - The form data to save
   */
  const saveSubstitution = (formData) => {
    console.log('saveSubstitution called with:', formData);
    
    if (!formData || !formData.regex) {
      console.error('Invalid form data:', formData);
      return;
    }
    
    const stepIndex = substitutionStepIndex.value;
    if (stepIndex === null || stepIndex === undefined) {
      console.error('No step index specified for substitution, substitutionStepIndex is:', substitutionStepIndex.value);
      return;
    }
    
    if (!props.steps || !props.steps[stepIndex]) {
      console.error(`Step at index ${stepIndex} not found. Steps:`, props.steps);
      return;
    }
    
    const step = props.steps[stepIndex];
    const substitutions = Array.isArray(step.variableSubstitutions) ? [...step.variableSubstitutions] : [];
    
    // Create substitution structure based on selected mode
    let newSubstitution = {
      regex: formData.regex
    };
    
    if (formData.mode === 'variable') {
      // Variable mode: use a previously captured variable
      if (formData.sourceStep === null || !formData.targetVariable) {
        console.error('Missing sourceStep or targetVariable for variable substitution');
        return;
      }
      
      newSubstitution = {
        ...newSubstitution,
        mode: 'variable',
        targetVariable: formData.targetVariable,
        sourceStep: formData.sourceStep
      };
      
      console.log('[SUBSTITUTION] Adding variable substitution:', 
        `regex=${newSubstitution.regex}, ` +
        `targetVariable=${newSubstitution.targetVariable}`);
        
    } else {
      // Fixed value mode
      if (!formData.value) {
        console.error('Missing fixed value for substitution');
        return;
      }
      
      newSubstitution = {
        ...newSubstitution,
        mode: 'fixed',
        value: formData.value
      };
      
      console.log('[SUBSTITUTION] Adding fixed value substitution:', 
        `regex=${newSubstitution.regex}, ` +
        `value=${newSubstitution.value}`);
    }
    
    const updatedSubstitutions = [...substitutions, newSubstitution];
    
    // Logs détaillés pour le débogage
    console.log('[SUBSTITUTION] Current substitutions:', substitutions);
    console.log('[SUBSTITUTION] Substitutions state after adding:', updatedSubstitutions);
    
    // Créer un nouvel objet step avec les substitutions mises à jour
    const updatedStep = {
      ...step,
      variableSubstitutions: updatedSubstitutions
    };
    
    console.log('Emitting update-step with:', stepIndex, updatedStep);
    
    // Emit the update-step event
    emit('update-step', stepIndex, updatedStep);
    
    // Close the dialog
    showSubstitutionDialog.value = false;
  };
  
  /**
   * Get available variables for a specific step
   * @param {Number} stepIndex - Index of the step
   * @returns {Array} - List of available variable names
   */
  const availableVariablesForStep = (stepIndex) => {
    if (stepIndex === null || stepIndex === undefined) {
      console.log('availableVariablesForStep called with null/undefined stepIndex');
      return ['Sélectionnez d\'abord une étape'];
    }
    
    // Initialize available variables array
    let availableVars = [];
    
    // 1. Collect all variables defined in previous steps
    if (props.steps && Array.isArray(props.steps)) {
      for (let i = 0; i < props.steps.length; i++) {
        // Don't include variables from current step or later steps
        // except for first step (special: self-reference possible)
        if (i !== stepIndex || stepIndex === 0) {
          const step = props.steps[i];
          if (step && step.variableCaptures && step.variableCaptures.length > 0) {
            // Add variable names defined in this step
            const stepVars = step.variableCaptures.map(capture => capture.name);
            availableVars = [...availableVars, ...stepVars];
          }
        }
      }
    }
    
    // 2. Add variables actually captured in previous execution
    if (props.results && Array.isArray(props.results)) {
      for (let i = 0; i < props.results.length; i++) {
        // Allow access to captured variables from all executed steps
        if (props.results[i] && props.results[i].capturedVariables) {
          const capturedVars = Object.keys(props.results[i].capturedVariables);
          availableVars = [...availableVars, ...capturedVars];
        }
      }
    }
    
    // Remove duplicates
    const uniqueVars = [...new Set(availableVars)];
    
    // If no variables are available, return explanatory message
    if (uniqueVars.length === 0) {
      if (stepIndex === 0) {
        console.log('Step 0: No variables available');
        return ['Define variables in this step to use them here and in later steps'];
      } else {
        console.log('No variables available for step', stepIndex);
        return ['Define variables in steps to use them here'];
      }
    }
    
    console.log('Variables available for step', stepIndex, ':', uniqueVars);
    return uniqueVars;
  };
  
  return {
    showSubstitutionDialog,
    substitutionForm,
    substitutionStepIndex,
    openSubstitutionDialog,
    saveSubstitution,
    availableVariablesForStep
  };
}