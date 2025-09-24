<template>
  <div class="info-item">
    <p class="text-muted small mb-1">{{ label }}</p>
    <p class="mb-0">{{ displayValue }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface InfoItemProps {
  label: string;
  value?: string | number | null;
  placeholder?: string;
}

const props = withDefaults(defineProps<InfoItemProps>(), {
  value: '',
  placeholder: '—',
});

const displayValue = computed(() => {
  const val = props.value;
  if (val === null || val === undefined || val === '') {
    return props.placeholder;
  }
  return String(val);
});
</script>

<style scoped>
.info-item + .info-item {
  margin-top: 0.5rem;
}
</style>
