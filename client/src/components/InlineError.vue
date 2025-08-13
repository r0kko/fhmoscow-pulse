<script setup>
const props = defineProps({
  message: { type: String, required: true },
});
</script>

<template>
  <div
    class="invalid-feedback d-block d-flex align-items-start gap-1"
    role="alert"
  >
    <i class="bi bi-exclamation-circle text-danger" aria-hidden="true"></i>
    <span>{{ message }}</span>
  </div>
</template>

<style scoped>
/* Ensure icon aligns with text baseline in compact spaces */
i {
  line-height: 1;
}
</style>
