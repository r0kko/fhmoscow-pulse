<template>
  <div
    v-if="visible"
    class="cookie-notice alert alert-info d-flex flex-column flex-sm-row align-items-center position-fixed bottom-0 start-50 translate-middle-x mb-3 fade show"
    role="alert"
  >
    <span class="me-sm-3 mb-2 mb-sm-0 text-center text-sm-start flex-fill">
      Продолжая работу с сайтом, вы соглашаетесь с использованием файлов cookie
      и обработкой персональных данных в соответствии с законодательством.
    </span>
    <button
      type="button"
      class="btn btn-brand btn-sm cookie-btn"
      @click="accept"
    >
      Принять
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const visible = ref(false);

function accept() {
  localStorage.setItem('cookieConsent', 'true');
  visible.value = false;
}

onMounted(() => {
  if (!localStorage.getItem('cookieConsent')) {
    visible.value = true;
  }
});
</script>

<style scoped>
.cookie-notice {
  z-index: 1080;
}

@media (max-width: 575.98px) {
  .cookie-notice {
    position: static !important;
    transform: none !important;
    left: auto !important;
    bottom: auto !important;
    margin-bottom: 0 !important;
    text-align: center;
  }
  .cookie-btn {
    width: 100%;
  }
}
</style>
