<script setup>
import { computed } from 'vue';
import { useToast } from '../utils/toast.js';

const { toasts, hideToast } = useToast();
const hasToasts = computed(() => toasts.length > 0);

function onKeydown(e, id) {
  if (e.key === 'Escape') hideToast(id);
}
</script>

<template>
  <div
    v-if="hasToasts"
    class="toast-container position-fixed bottom-0 end-0 p-3"
    style="z-index: 1080"
    aria-live="polite"
    aria-atomic="true"
  >
    <div
      v-for="t in toasts"
      :key="t.id"
      class="toast show"
      :class="`text-bg-${t.variant}`"
      role="status"
      tabindex="0"
      @keydown="(e) => onKeydown(e, t.id)"
    >
      <div class="d-flex align-items-center">
        <div class="toast-body">{{ t.message }}</div>
        <button
          type="button"
          class="btn-close btn-close-white me-2 m-auto"
          aria-label="Закрыть"
          @click="hideToast(t.id)"
        ></button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toast {
  opacity: 1;
}
</style>
