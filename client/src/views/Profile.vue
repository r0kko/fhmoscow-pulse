<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { apiFetch } from '../api.js'

const placeholderGroups = [
  [
    { title: 'Паспорт' },
    { title: 'ИНН и СНИЛС' },
    { title: 'Банковские реквизиты' }
  ],
  [
    { title: 'Тип налогообложения' },
    { title: 'Выданный инвентарь' }
  ]
]

const user = ref(null)

async function fetchProfile() {
  try {
    const data = await apiFetch('/users/me')
    user.value = data.user
  } catch (_err) {
    user.value = null
  }
}

onMounted(fetchProfile)
</script>

<template>
  <div class="container my-4">
    <nav aria-label="breadcrumb" class="mb-3">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item"><RouterLink to="/">Главная</RouterLink></li>
        <li class="breadcrumb-item active" aria-current="page">Персональные данные</li>
      </ol>
    </nav>
    <h1 class="mb-4">Личная информация</h1>
    <div v-if="user">
      <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-4 mb-4">
        <div class="col">
          <div class="card h-100 tile">
            <div class="card-body">
              <h5 class="card-title">Основные данные</h5>
              <p class="mb-1"><strong>Фамилия:</strong> {{ user.last_name }}</p>
              <p class="mb-1"><strong>Имя:</strong> {{ user.first_name }}</p>
              <p class="mb-1"><strong>Отчество:</strong> {{ user.patronymic }}</p>
              <p class="mb-0"><strong>Дата рождения:</strong> {{ user.birth_date }}</p>
            </div>
          </div>
        </div>
        <div class="col">
          <div class="card h-100 tile">
            <div class="card-body">
              <h5 class="card-title">Контакты</h5>
              <p class="mb-1"><strong>Телефон:</strong> {{ user.phone }}</p>
              <p class="mb-0"><strong>Email:</strong> {{ user.email }}</p>
            </div>
          </div>
        </div>
      </div>
      <div
        v-for="(group, index) in placeholderGroups"
        :key="index"
        class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-4 mb-4"
      >
        <div class="col" v-for="block in group" :key="block.title">
          <div class="card h-100 tile text-center">
            <div class="card-body d-flex flex-column justify-content-center">
              <h5 class="card-title mb-3">{{ block.title }}</h5>
              <p class="text-muted mb-0">Информация будет доступна позже</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <p v-else>Данные пользователя не найдены.</p>
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
