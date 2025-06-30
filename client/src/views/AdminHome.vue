<script setup>
import { RouterLink } from 'vue-router'

const tiles = [
  { title: 'Управление пользователями', icon: 'bi-people', to: '/users' },
  {
    title: 'Медицинские справки',
    icon: 'bi-file-earmark-medical',
    to: '/medical-certificates'
  }
]
</script>

<template>
  <div class="container mt-4">
    <h1 class="mb-4 text-center">Администрирование</h1>
    <div class="row g-4">
      <div class="col-6 col-md-4" v-for="tile in tiles" :key="tile.to">
        <RouterLink :to="tile.to" class="card h-100 text-center tile text-decoration-none text-body">
          <div class="card-body d-flex flex-column justify-content-center align-items-center">
            <i :class="tile.icon + ' fs-1 mb-3'"></i>
            <h5 class="card-title">{{ tile.title }}</h5>
          </div>
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tile {
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}
.tile:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
}
</style>
