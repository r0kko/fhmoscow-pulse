<script setup>
import { computed } from 'vue';
import { withHttp } from '../utils/url';

const props = defineProps({
  url: { type: String, default: '' },
  label: { type: String, default: 'Чат' },
});

const href = computed(() => (props.url ? withHttp(props.url) : ''));
const icon = computed(() =>
  /telegram|t\.me|tg:/.test(props.url || '')
    ? 'bi-telegram'
    : 'bi-chat-dots-fill'
);
</script>

<template>
  <a
    v-if="href"
    :href="href"
    class="chat-fab btn btn-brand d-inline-flex align-items-center justify-content-center shadow"
    target="_blank"
    rel="noopener"
    :aria-label="label"
    :title="label"
  >
    <i :class="`bi ${icon}`" aria-hidden="true"></i>
  </a>
  <span v-else aria-hidden="true" />
  <!-- empty span to avoid rendering errors when url missing -->
</template>

<style scoped>
.chat-fab {
  position: fixed;
  left: max(1rem, env(safe-area-inset-left));
  bottom: max(1rem, env(safe-area-inset-bottom));
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  z-index: 1030;
  padding: 0;
}
.chat-fab i {
  font-size: 1.25rem;
}

@media (max-width: 575.98px) {
  .chat-fab {
    width: 2.75rem;
    height: 2.75rem;
  }
}
</style>
