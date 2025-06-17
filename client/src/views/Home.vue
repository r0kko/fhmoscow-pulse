<script setup>
import { auth } from '../auth.js'
</script>

<template>
  <div class="container mt-4">
    <h1 class="mb-4">Добро пожаловать {{ auth.user?.phone }}</h1>
    <p>Вы успешно вошли в систему.</p>
  </div>
</template>
