<script setup lang="ts">
import { toRefs } from 'vue';

interface BrandSpinnerProps {
  label?: string;
  small?: boolean;
}

const props = withDefaults(defineProps<BrandSpinnerProps>(), {
  label: 'Загрузка',
  small: false,
});

const { label, small } = toRefs(props);
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
