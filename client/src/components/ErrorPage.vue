<script setup>
import { RouterLink } from 'vue-router';
const logo = '/vite.svg';

defineProps({
  code: { type: String, required: true },
  message: { type: String, required: true },
});
</script>

<template>
  <div
    class="d-flex flex-column align-items-center justify-content-center vh-100 text-center p-3"
  >
    <img :src="logo" alt="FHM" class="mb-4" style="max-height: 100px" />
    <h1 class="display-3 fw-bold">{{ code }}</h1>
    <p class="lead mb-4">{{ message }}</p>
    <RouterLink to="/" class="btn btn-brand">На главную</RouterLink>
  </div>
</template>

<style scoped>
.display-3 {
  animation: fadeIn 0.6s ease-out;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
