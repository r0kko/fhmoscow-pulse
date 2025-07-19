<script setup>
import { RouterLink } from 'vue-router';
import RefereeNormativeResults from '../components/RefereeNormativeResults.vue';
</script>

<template>
  <div class="py-3">
    <div class="container">
      <nav aria-label="breadcrumb" class="mb-3">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/">Главная</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Результаты</li>
        </ol>
      </nav>
      <RefereeNormativeResults />
    </div>
  </div>
</template>
