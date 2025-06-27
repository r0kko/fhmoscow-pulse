<template>
  <div
    class="cookie-notice alert alert-info d-flex align-items-center position-fixed bottom-0 start-50 translate-middle-x mb-3 fade"
    :class="{ show: visible }"
    role="alert"
  >
    <span class="me-3">
      Продолжая работу с сайтом, вы соглашаетесь с использованием файлов cookie и обработкой персональных данных в соответствии с законодательством.
    </span>
    <button type="button" class="btn btn-primary btn-sm" @click="accept">Принять</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const visible = ref(false)

function accept() {
  localStorage.setItem('cookieConsent', 'true')
  visible.value = false
}

onMounted(() => {
  if (!localStorage.getItem('cookieConsent')) {
    visible.value = true
  }
})
</script>

<style scoped>
.cookie-notice {
  z-index: 1080;
}
</style>
