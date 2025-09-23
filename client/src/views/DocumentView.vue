<script setup>
import { ref, onMounted, computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { apiFetch } from '../api';
import InfoItem from '../components/InfoItem.vue';

const route = useRoute();
const type = route.params.type;

const user = ref(null);
const passport = ref(null);
const inn = ref(null);
const taxation = ref(null);
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
  passport: {
    title: 'Удостоверение личности',
    crumb: 'Паспорт',
  },
  inn: {
    title: 'Индивидуальный номер налогоплательщика',
    crumb: 'ИНН',
  },
  snils: {
    title: 'Страховой номер индивидуального лицевого счёта',
    crumb: 'СНИЛС',
  },
  'driver-license': {
    title: 'Водительское удостоверение',
    crumb: 'ВУ',
  },
}[type] || { title: 'Документ', crumb: 'Документ' };

onMounted(async () => {
  try {
    if (type === 'passport') {
      user.value = (await apiFetch('/users/me')).user;
      passport.value = (await apiFetch('/passports/me')).passport;
    } else if (type === 'inn') {
      inn.value = (await apiFetch('/inns/me')).inn;
      try {
        taxation.value = (await apiFetch('/taxations/me')).taxation;
      } catch (_e) {
        taxation.value = null;
      }
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
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/">Главная</RouterLink>
          </li>
          <li class="breadcrumb-item">
            <RouterLink to="/profile">Мои данные</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">
            {{ config.crumb }}
          </li>
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
              <div v-if="type === 'passport' && passport && user">
                <div class="row g-3">
                  <div class="col-12 col-sm-6">
                    <InfoItem label="ФИО" :value="fullName" />
                  </div>
                  <div class="col-12 col-sm-6">
                    <InfoItem
                      label="Дата рождения"
                      :value="
                        user.birth_date ? formatDate(user.birth_date) : ''
                      "
                    />
                  </div>
                  <div class="col-12"><hr class="my-2" /></div>
                  <div class="col-12 col-sm-6">
                    <InfoItem
                      label="Тип документа"
                      :value="passport.document_type_name || 'Паспорт РФ'"
                    />
                  </div>
                  <div class="col-12 col-sm-6">
                    <InfoItem
                      label="Серия и номер"
                      :value="passport.series + ' ' + passport.number"
                    />
                  </div>
                  <div class="col-12 col-sm-6">
                    <InfoItem label="Срок действия" :value="validity" />
                  </div>
                  <div class="col-12 col-sm-6">
                    <InfoItem
                      label="Орган выдачи"
                      :value="passport.issuing_authority"
                    />
                  </div>
                  <div class="col-12 col-sm-6">
                    <InfoItem
                      label="Код подразделения"
                      :value="passport.issuing_authority_code"
                    />
                  </div>
                  <div class="col-12 col-sm-6">
                    <InfoItem
                      label="Место рождения"
                      :value="passport.place_of_birth"
                    />
                  </div>
                </div>
                <div
                  class="alert alert-warning d-flex align-items-center mt-3 mb-0"
                >
                  <i class="bi bi-exclamation-triangle-fill me-2"></i>
                  <div>
                    Для изменения или удаления нужно обратиться в офис ФХМ с
                    оригиналом документа и паспортом
                  </div>
                </div>
              </div>
              <div v-else-if="type === 'inn' && inn">
                <div class="row g-3">
                  <div class="col-12 col-sm-6">
                    <InfoItem label="Номер" :value="inn.number" />
                  </div>
                  <div v-if="taxation?.type?.name" class="col-12 col-sm-6">
                    <InfoItem
                      label="Тип налогообложения"
                      :value="taxation.type.name"
                    />
                  </div>
                  <div v-if="taxation?.check_date" class="col-12 col-sm-6">
                    <InfoItem
                      label="Дата проверки"
                      :value="formatDate(taxation.check_date)"
                    />
                  </div>
                  <div
                    v-if="taxation?.registration_date"
                    class="col-12 col-sm-6"
                  >
                    <InfoItem
                      label="Дата регистрации"
                      :value="formatDate(taxation.registration_date)"
                    />
                  </div>
                  <div v-if="taxation?.ogrn" class="col-12 col-sm-6">
                    <InfoItem label="ОГРНИП" :value="taxation.ogrn" />
                  </div>
                  <div v-if="taxation?.okved" class="col-12 col-sm-6">
                    <InfoItem label="ОКВЭД" :value="taxation.okved" />
                  </div>
                </div>
                <div
                  class="alert alert-warning d-flex align-items-center mt-3 mb-0"
                >
                  <i class="bi bi-exclamation-triangle-fill me-2"></i>
                  <div>
                    Для изменения или удаления нужно обратиться в офис ФХМ с
                    оригиналом документа и паспортом
                  </div>
                </div>
              </div>
              <div v-else-if="type === 'snils' && snils">
                <InfoItem label="Номер" :value="snils.number" />
                <div
                  class="alert alert-warning d-flex align-items-center mt-3 mb-0"
                >
                  <i class="bi bi-exclamation-triangle-fill me-2"></i>
                  <div>
                    Для изменения или удаления нужно обратиться в офис ФХМ с
                    оригиналом документа и паспортом
                  </div>
                </div>
              </div>
              <div v-else-if="type === 'driver-license'">
                <div class="alert alert-warning d-flex align-items-center mb-0">
                  <i class="bi bi-exclamation-triangle-fill me-2"></i>
                  <div>
                    Для изменения или удаления нужно обратиться в офис ФХМ с
                    оригиналом документа и паспортом
                  </div>
                </div>
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

/* Mobile adjustments for headings and spacing now handled globally in mobile.css
   and brand.css (.section-card). View-specific overrides removed. */

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
