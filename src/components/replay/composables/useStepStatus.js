import { ref } from 'vue';

export function useStepStatus() {
  const progressStatus = ref({});
  
  /**
   * Handle step progress event from execution engine
   * @param {Event} event - The event with status details
   */
  const handleStepProgress = (event) => {
    console.log('Step progress event received:', event.detail);
    
    const { currentStepIndex, status } = event.detail;
    
    // Update progress status for this step
    if (currentStepIndex >= 0) {
      progressStatus.value = {
        ...progressStatus.value,
        [currentStepIndex]: status
      };
    }
    
    // Clear status if execution is complete
    if (status === 'stopped' || status === 'completed') {
      console.log('Clearing progress status - execution completed or stopped');
      progressStatus.value = {};
    }
  };
  
  return {
    progressStatus,
    handleStepProgress
  };
}