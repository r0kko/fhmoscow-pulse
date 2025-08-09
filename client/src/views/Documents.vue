<script setup>
import { ref, onMounted } from 'vue';
import { apiFetch } from '../api.js';

const loading = ref(true);
const error = ref('');
const current = ref(null);
const signTypes = ref([]);
const selected = ref('');
const code = ref('');
const verifyError = ref('');
const success = ref(false);

const signInfo = {
  HANDWRITTEN: [
    'Нужно приехать в офис в рабочее время',
    'Потребуется оригинал паспорта для идентификации личности',
    'Подтверждение займет некоторое время',
  ],
  KONTOUR_SIGN: [
    'Можно сделать не выходя из дома, в любое время',
    'Потребуется регистрация в сервисе с дистанционной проверкой документов в МВД',
    'Юридическая значимость гарантируется СКБ Контур',
  ],
};

onMounted(async () => {
  try {
    const [me, types] = await Promise.all([
      apiFetch('/sign-types/me'),
      apiFetch('/sign-types'),
    ]);
    current.value = me.signType;
    signTypes.value = (types.signTypes || []).filter((t) =>
      ['HANDWRITTEN', 'KONTOUR_SIGN'].includes(t.alias)
    );
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});

async function choose(alias) {
  selected.value = alias;
  code.value = '';
  verifyError.value = '';
  success.value = false;
  try {
    await apiFetch('/sign-types/send-code', { method: 'POST' });
  } catch (e) {
    verifyError.value = e.message;
  }
}

async function submit() {
  try {
    await apiFetch('/sign-types/select', {
      method: 'POST',
      body: JSON.stringify({ alias: selected.value, code: code.value }),
    });
    const res = await apiFetch('/sign-types/me');
    current.value = res.signType;
    success.value = true;
  } catch (e) {
    verifyError.value = e.message;
  }
}
</script>

<template>
  <div class="py-3">
    <div class="container">
      <h1 class="mb-3">Документы</h1>
      <div v-if="loading" class="text-center my-5">
        <div class="spinner-border" role="status" aria-label="Загрузка">
          <span class="visually-hidden">Загрузка…</span>
        </div>
      </div>
      <div v-else>
        <div v-if="error" class="text-danger">{{ error }}</div>
        <div v-else>
          <div v-if="current" class="alert alert-info mb-0">
            Раздел скоро будет доступен.
          </div>
          <div v-else>
            <p class="mb-3">Выберите способ подписания первичных документов</p>
            <div class="row g-3">
              <div v-for="t in signTypes" :key="t.alias" class="col-md-6">
                <div class="card section-card tile fade-in h-100 shadow-sm">
                  <div class="card-body d-flex flex-column">
                    <h2 class="h5 mb-3">{{ t.name }}</h2>
                    <ul class="list-unstyled flex-grow-1 mb-3">
                      <li
                        v-for="(item, i) in signInfo[t.alias]"
                        :key="i"
                        class="d-flex mb-2"
                      >
                        <i
                          class="bi bi-check-circle text-brand me-2"
                          aria-hidden="true"
                        ></i>
                        <span>{{ item }}</span>
                      </li>
                    </ul>
                    <div class="text-end mt-auto">
                      <button
                        type="button"
                        class="btn btn-primary"
                        @click="choose(t.alias)"
                      >
                        Выбрать
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              v-if="selected"
              class="card section-card tile fade-in mt-3 shadow-sm"
            >
              <div class="card-body">
                <p class="mb-3">Мы отправили код на вашу почту</p>
                <div class="mb-3">
                  <label for="code" class="form-label">Код из письма</label>
                  <input
                    id="code"
                    v-model="code"
                    class="form-control"
                    type="text"
                    maxlength="6"
                  />
                </div>
                <div v-if="verifyError" class="text-danger mb-2">
                  {{ verifyError }}
                </div>
                <div v-if="success" class="text-success mb-2">
                  Подпись сохранена
                </div>
                <button
                  type="button"
                  class="btn btn-primary"
                  :disabled="code.length !== 6"
                  @click="submit"
                >
                  Подтвердить
                </button>
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

@media (max-width: 575.98px) {
  .section-card {
    margin-left: -1rem;
    margin-right: -1rem;
  }

  .section-card .card-body {
    padding: 0.75rem;
    font-size: 0.875rem;
  }

  .py-3 {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
  }

  h1 {
    font-size: 1.25rem;
    margin-bottom: 1rem !important;
  }
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
