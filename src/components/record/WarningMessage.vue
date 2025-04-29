<template>
  <div class="warning-message">
    <div class="warning-icon">⚠️</div>
    <div class="warning-text">
      <strong>{{ title }}</strong>
      <p>{{ message }}</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'WarningMessage',
  props: {
    title: {
      type: String,
      default: 'Warning'
    },
    message: {
      type: String,
      required: true
    }
  }
}
</script>

<style src="../../styles/record/warningMessage.css" scoped></style>
