<script setup>
const props = defineProps({
  width: { type: String, default: 'clamp(14rem, 70vw, 18rem)' },
  height: { type: String, default: '5.5rem' },
  radius: { type: String, default: 'var(--radius-tile)' },
  block: { type: Boolean, default: false },
});
</script>

<template>
  <div
    class="skeleton"
    :style="{
      width: props.width,
      height: props.height,
      borderRadius: props.radius,
      display: props.block ? 'block' : 'inline-block',
    }"
    aria-hidden="true"
  />
</template>

<style scoped>
.skeleton {
  background: linear-gradient(90deg, #f1f3f5 25%, #eceff3 37%, #f1f3f5 63%);
  background-size: 400% 100%;
  animation: skeleton-loading 1.2s ease-in-out infinite;
  flex: 0 0 auto;
  scroll-snap-align: start;
  border: 1px solid var(--border-subtle);
}
@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
  }
}
@keyframes skeleton-loading {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: 0 0;
  }
}
</style>
