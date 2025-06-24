<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'
import FooterBar from './components/FooterBar.vue'

const route = useRoute()
const showLayout = computed(() => !['/login', '/register'].includes(route.path))
const mainClass = computed(() =>
  showLayout.value ? 'flex-grow-1 container py-3' : 'flex-grow-1'
)
</script>

<template>
  <div class="d-flex flex-column min-vh-100">
    <NavBar v-if="showLayout" />
    <main :class="mainClass">
      <router-view />
    </main>
    <FooterBar v-if="showLayout" />
  </div>
</template>
