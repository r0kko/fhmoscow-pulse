<script setup>
import { ref, onMounted, computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { apiFetch } from '../api.js';
import InfoItem from '../components/InfoItem.vue';

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

const fullName = computed(() =>
  [user.value?.last_name, user.value?.first_name, user.value?.patronymic]
    .filter(Boolean)
    .join(' ')
);

const validity = computed(() => {
  const issue = passport.value?.issue_date
    ? formatDate(passport.value.issue_date)
    : '';
  const exp = passport.value?.valid_until
    ? formatDate(passport.value.valid_until)
    : '';
  if (!issue && !exp) return '';
  return `${issue} — ${exp}`;
});

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
              <div
                v-if="type === 'passport' && passport && user"
                class="row row-cols-1 row-cols-sm-2 g-3"
              >
                <div class="col">
                  <InfoItem label="ФИО" :value="fullName" />
                </div>
                <div class="col">
                  <InfoItem
                    label="Дата рождения"
                    :value="user.birth_date ? formatDate(user.birth_date) : ''"
                  />
                </div>
                <div class="col">
                  <InfoItem label="Место рождения" :value="passport.place_of_birth" />
                </div>
                <div class="col">
                  <InfoItem
                    label="Тип документа"
                    :value="passport.document_type_name || 'Паспорт РФ'"
                  />
                </div>
                <div class="col">
                  <InfoItem
                    label="Серия и номер"
                    :value="passport.series + ' ' + passport.number"
                  />
                </div>
                <div class="col">
                  <InfoItem label="Срок действия" :value="validity" />
                </div>
                <div class="col">
                  <InfoItem
                    label="Орган выдачи"
                    :value="passport.issuing_authority"
                  />
                </div>
                <div class="col">
                  <InfoItem
                    label="Код подразделения"
                    :value="passport.issuing_authority_code"
                  />
                </div>
              </div>
              <div v-else-if="type === 'inn' && inn">
                <InfoItem label="ИНН" :value="inn.number" />
                <p class="mt-3 mb-0 text-muted">
                  Для изменения или удаления нужно обратиться в офис ФХМ с оригиналом документа и паспортом
                </p>
              </div>
              <div v-else-if="type === 'snils' && snils">
                <InfoItem label="СНИЛС" :value="snils.number" />
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
