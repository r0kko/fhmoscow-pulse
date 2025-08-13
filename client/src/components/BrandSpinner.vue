<script setup>
const props = defineProps({
  label: { type: String, default: 'Загрузка' },
  small: { type: Boolean, default: false },
});
</script>

<template>
  <div class="text-center my-3" aria-live="polite">
    <div
      class="spinner-border spinner-brand"
      :class="{ 'spinner-border-sm': small }"
      role="status"
      :aria-label="label"
    ></div>
  </div>
</template>

<style scoped>
/* Inherits .spinner-brand color from brand.css */
</style>
