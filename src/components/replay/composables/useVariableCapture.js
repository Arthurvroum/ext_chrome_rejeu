import { ref } from 'vue';

export function useVariableCapture(props, emit) {
  const captureSourceOptions = [
    { title: 'Corps de la réponse', value: 'body' },
    { title: 'En-têtes de la réponse', value: 'headers' },
    { title: 'URL de la réponse', value: 'url' }
  ];
  
  const showCaptureDialog = ref(false);
  const captureForm = ref({
    name: '',
    regex: '',
    source: 'body',
    required: false,
  });
  const captureStepIndex = ref(null);
  
  /**
   * Open the capture dialog for a specific step
   * @param {Number} stepIndex - Index of the step
   */
  const openCaptureDialog = (stepIndex) => {
    // Log pour debug
    console.log('Opening capture dialog for step', stepIndex);
    
    // Initialiser le formulaire avec un nom dynamique pour éviter les doublons
    captureForm.value = { 
      name: ``,
      regex: '', 
      source: 'body', 
      required: false 
    };
    
    captureStepIndex.value = stepIndex;
    showCaptureDialog.value = true;
  };
  
  /**
   * Save a new capture to the step
   * @param {Object} formData - The form data to save
   */
  const saveCapture = (formData) => {
    console.log('saveCapture called with:', formData);
    
    if (!formData || !formData.name || !formData.regex) {
      console.error('Invalid form data:', formData);
      return;
    }
    
    const stepIndex = captureStepIndex.value;
    if (stepIndex === null || stepIndex === undefined) {
      console.error('No step index specified for capture, captureStepIndex is:', captureStepIndex.value);
      return;
    }
    
    if (!props.steps || !props.steps[stepIndex]) {
      console.error(`Step at index ${stepIndex} not found. Steps:`, props.steps);
      return;
    }
    
    const step = props.steps[stepIndex];
    const captures = Array.isArray(step.variableCaptures) ? [...step.variableCaptures] : [];
    const newCapture = { ...formData };
    const updatedCaptures = [...captures, newCapture];
    
    // Log pour debug
    console.log('Saving capture:', newCapture, 'for step', stepIndex);
    console.log('Current captures:', captures);
    console.log('Updated captures will be:', updatedCaptures);
    
    // Créer un nouvel objet step avec les captures mises à jour
    const updatedStep = {
      ...step,
      variableCaptures: updatedCaptures
    };
    
    console.log('Emitting update-step with:', stepIndex, updatedStep);
    
    // Emit the update-step event
    emit('update-step', stepIndex, updatedStep);
    
    // Close the dialog
    showCaptureDialog.value = false;
  };
  
  return {
    captureSourceOptions,
    showCaptureDialog,
    captureForm,
    captureStepIndex,
    openCaptureDialog,
    saveCapture
  };
}