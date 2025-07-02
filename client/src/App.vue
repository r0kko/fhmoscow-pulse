<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'
import FooterBar from './components/FooterBar.vue'

const route = useRoute()
const showLayout = computed(() => !route.matched.some((r) => r.meta.hideLayout))
const mainClass = computed(() =>
  showLayout.value ? 'flex-grow-1 container py-3' : 'flex-grow-1'
)
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
