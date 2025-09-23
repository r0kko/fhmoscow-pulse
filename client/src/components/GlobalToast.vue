<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useToast, type ToastItem } from '../utils/toast';

const { toasts, hideToast } = useToast();

const typedToasts = computed<readonly ToastItem[]>(() => toasts);
const hasToasts = computed(() => typedToasts.value.length > 0);

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && typedToasts.value.length) {
    const last = typedToasts.value[typedToasts.value.length - 1];
    if (last) hideToast(last.id);
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown));
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
      v-for="t in typedToasts"
      :key="t.id"
      class="toast show"
      :class="`text-bg-${t.variant}`"
      role="status"
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
