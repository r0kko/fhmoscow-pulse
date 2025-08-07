<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { apiFetch } from '../api.js';
import InfoField from '../components/InfoField.vue';

const route = useRoute();
const type = route.params.type;

const user = ref(null);
const passport = ref(null);
const inn = ref(null);
const snils = ref(null);
const loading = ref(true);
const error = ref('');

function formatDate(str) {
  if (!str) return '';
  const [year, month, day] = str.split('-');
  return `${day}.${month}.${year}`;
}

const config = {
  passport: { title: 'Паспорт РФ', icon: 'bi bi-passport' },
  inn: { title: 'ИНН', icon: 'bi bi-person-badge' },
  snils: { title: 'СНИЛС', icon: 'bi bi-card-checklist' },
  'driver-license': { title: 'Водительское удостоверение', icon: 'bi bi-car-front' },
}[type] || { title: 'Документ', icon: '' };

onMounted(async () => {
  try {
    if (type === 'passport') {
      user.value = (await apiFetch('/users/me')).user;
      passport.value = (await apiFetch('/passports/me')).passport;
    } else if (type === 'inn') {
      inn.value = (await apiFetch('/inns/me')).inn;
    } else if (type === 'snils') {
      snils.value = (await apiFetch('/snils/me')).snils;
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="py-3">
    <div class="container">
      <nav aria-label="breadcrumb" class="mb-2">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item"><RouterLink to="/">Главная</RouterLink></li>
          <li class="breadcrumb-item"><RouterLink to="/profile">Документы и данные</RouterLink></li>
          <li class="breadcrumb-item active" aria-current="page">{{ config.title }}</li>
        </ol>
      </nav>
      <h1 class="mb-3">{{ config.title }}</h1>
      <div v-if="loading" class="text-center my-5">
        <div class="spinner-border" role="status" aria-label="Загрузка">
          <span class="visually-hidden">Загрузка…</span>
        </div>
      </div>
      <div v-else>
        <div v-if="error" class="text-danger">{{ error }}</div>
        <div v-else>
          <div class="card section-card tile fade-in shadow-sm">
            <div class="card-body">
              <i :class="config.icon + ' fs-3 mb-3'"></i>
              <div v-if="type === 'passport' && passport && user" class="row row-cols-1 row-cols-sm-2 g-3">
                <div class="col">
                  <InfoField id="lastName" label="Фамилия" :value="user.last_name" />
                </div>
                <div class="col">
                  <InfoField id="firstName" label="Имя" :value="user.first_name" />
                </div>
                <div class="col">
                  <InfoField id="patronymic" label="Отчество" :value="user.patronymic" />
                </div>
                <div class="col">
                  <InfoField
                    id="birthDate"
                    label="Дата рождения"
                    icon="bi bi-calendar-event"
                    :value="user.birth_date ? formatDate(user.birth_date) : ''"
                  />
                </div>
                <div class="col">
                  <InfoField
                    id="series"
                    label="Серия и номер"
                    icon="bi bi-file-earmark-text"
                    :value="passport.series + ' ' + passport.number"
                  />
                </div>
                <div class="col">
                  <InfoField
                    id="validity"
                    label="Срок действия"
                    icon="bi bi-calendar"
                    :value="
                      passport.issue_date && passport.valid_until
                        ?
                            formatDate(passport.issue_date) +
                            ' - ' +
                            formatDate(passport.valid_until)
                        : ''
                    "
                  />
                </div>
              </div>
              <div v-else-if="type === 'inn' && inn">
                <InfoField id="inn" label="ИНН" :value="inn.number" />
                <p class="mt-3 mb-0 text-muted">
                  Для изменения или удаления нужно обратиться в офис ФХМ с оригиналом документа и паспортом
                </p>
              </div>
              <div v-else-if="type === 'snils' && snils">
                <InfoField id="snils" label="СНИЛС" :value="snils.number" />
                <p class="mt-3 mb-0 text-muted">
                  Для изменения или удаления нужно обратиться в офис ФХМ с оригиналом документа и паспортом
                </p>
              </div>
              <div v-else-if="type === 'driver-license'">
                <p class="mb-0 text-muted">
                  Для изменения или удаления нужно обратиться в офис ФХМ с оригиналом документа и паспортом
                </p>
              </div>
              <div v-else>
                <p class="mb-0 text-muted">Данные отсутствуют.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-in {
  animation: fadeIn 0.4s ease-out;
}

.section-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 0;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
