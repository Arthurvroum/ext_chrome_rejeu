<template>
  <div class="replay-option" v-if="show">
    <p>Recording completed with {{ requestCount }} requests.</p>
    <div class="replay-buttons">
      <button @click="openReplay" class="replay-now-btn">
        Open Replay Tab
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ReplayOption',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    requestCount: {
      type: Number,
      default: 0
    }
  },
  methods: {
    openReplay() {
      this.$emit('open-replay');
    }
  }
}
</script>

<style src="../../styles/record/replayOption.css" scoped></style>
