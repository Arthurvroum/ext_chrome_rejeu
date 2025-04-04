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

<style scoped>
.warning-message {
  background-color: #fff3cd;
  color: #856404;
  border: 1px solid #ffeeba;
  border-radius: 8px;
  padding: 15px;
  margin: 15px 0;
  display: flex;
  align-items: center;
}

.warning-icon {
  font-size: 24px;
  margin-right: 15px;
}

.warning-text {
  text-align: left;
}

.warning-text p {
  margin-top: 5px;
  margin-bottom: 0;
}
</style>
