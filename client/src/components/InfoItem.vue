<template>
  <div class="info-item">
    <p class="text-muted small mb-1">{{ label }}</p>
    <p class="mb-0">{{ value || placeholder }}</p>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: '' },
  placeholder: { type: String, default: '—' },
});
</script>

<style scoped>
.info-item + .info-item {
  margin-top: 0.5rem;
}
</style>
