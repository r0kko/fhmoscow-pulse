<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'
import FooterBar from './components/FooterBar.vue'

const route = useRoute()
const showLayout = computed(() => route.path !== '/login')
</script>

<template>
  <NavBar v-if="showLayout" />
  <router-view />
  <FooterBar v-if="showLayout" />
</template>
