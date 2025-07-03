<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'
import FooterBar from './components/FooterBar.vue'

const route = useRoute()
const showLayout = computed(() => !route.matched.some((r) => r.meta.hideLayout))
const mainClass = computed(() => {
  if (!showLayout.value) return 'flex-grow-1'
  const base = 'flex-grow-1 py-3'
  return route.meta.fluid
    ? `${base} container-fluid px-0`
    : `${base} container`
})
</script>

<template>
  <div class="d-flex flex-column min-vh-100">
    <NavBar v-if="showLayout" />
    <main id="main" :class="mainClass">
      <router-view />
    </main>
    <FooterBar v-if="showLayout" />
  </div>
</template>
