<template>
  <div
    class="invalid-feedback d-block d-flex align-items-start gap-1"
    role="alert"
  >
    <i class="bi bi-exclamation-circle text-danger" aria-hidden="true"></i>
    <span>{{ message }}</span>
  </div>
</template>

<script setup lang="ts">
interface InlineErrorProps {
  message: string;
}

defineProps<InlineErrorProps>();
</script>

<style scoped>
/* Ensure icon aligns with text baseline in compact spaces */
i {
  line-height: 1;
}
</style>
