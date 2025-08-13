<script setup>
const props = defineProps({
  icon: { type: String, default: 'bi-info-circle' },
  title: { type: String, default: 'Нет данных' },
  description: { type: String, default: '' },
});
</script>

<template>
  <div class="empty-state text-center py-4 px-3">
    <div
      class="icon-wrap bg-light rounded-circle d-inline-flex align-items-center justify-content-center mb-2"
    >
      <i :class="`bi ${icon} text-brand`" aria-hidden="true"></i>
    </div>
    <div class="fw-semibold mb-1">{{ title }}</div>
    <div v-if="description" class="text-muted small">{{ description }}</div>
    <div class="mt-3">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.icon-wrap {
  width: 3rem;
  height: 3rem;
}
.icon-wrap i {
  font-size: 1.25rem;
}
</style>
