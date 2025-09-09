<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';

const modalRef = ref(null);
let modal;
const router = useRouter();

const loading = ref(false);
const error = ref('');
const judge = ref(null);
const precheck = ref(null);
const passedRulesTest = ref(false);
const generating = ref(false);

function open(user) {
  judge.value = user;
  error.value = '';
  precheck.value = null;
  passedRulesTest.value = false;
  modal.show();
  load();
}

async function load() {
  if (!judge.value) return;
  loading.value = true;
  error.value = '';
  try {
    const data = await apiFetch(
      `/documents/admin/contracts/judges/${judge.value.id}/precheck`
    );
    precheck.value = data.precheck;
  } catch (e) {
    error.value = e.message || 'Не удалось загрузить проверки';
  } finally {
    loading.value = false;
  }
}

function close() {
  modal.hide();
}

function canGenerate() {
  if (!precheck.value) return false;
  const c = precheck.value.checks;
  return (
    c.ageOk &&
    c.simpleESign?.has &&
    c.taxation?.isNotPerson &&
    c.documents?.all &&
    passedRulesTest.value
  );
}

async function generate() {
  if (!judge.value) return;
  if (!canGenerate()) return;
  generating.value = true;
  try {
    const res = await apiFetch(
      `/documents/admin/contracts/judges/${judge.value.id}/application`,
      { method: 'POST' }
    );
    const url = res?.file?.url;
    if (url) {
      window.open(url, '_blank', 'noopener');
    }
    close();
  } catch (e) {
    error.value = e.message || 'Не удалось сформировать договор';
  } finally {
    generating.value = false;
  }
}

function goToEditUserSnils() {
  if (!judge.value) return;
  // Navigate to admin user edit with INN/SNILS tab preselected
  close();
  router.push({
    path: `/admin/users/${judge.value.id}`,
    query: { tab: 'inn' },
  });
}

onMounted(() => {
  modal = new Modal(modalRef.value);
});

defineExpose({ open });
</script>

<template>
  <div
    ref="modalRef"
    class="modal fade"
    tabindex="-1"
    aria-hidden="true"
    aria-modal="true"
    role="dialog"
  >
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Формирование договора</h5>
          <button
            type="button"
            class="btn-close"
            aria-label="Close"
            @click="close"
          ></button>
        </div>
        <div class="modal-body">
          <div v-if="error" class="alert alert-danger" role="alert">
            {{ error }}
            <button
              type="button"
              class="btn btn-sm btn-outline-light ms-2"
              @click="load"
            >
              Повторить
            </button>
          </div>
          <div v-else>
            <div v-if="!precheck || loading" class="text-center py-4">
              <div
                class="spinner-border spinner-brand"
                role="status"
                aria-hidden="true"
              ></div>
              <div class="mt-2">Загрузка проверок…</div>
            </div>
            <div v-else>
              <div class="mb-3">
                <h3 class="h6 mb-1">Получатель</h3>
                <p class="mb-0">
                  <strong>
                    {{ precheck.user.lastName }} {{ precheck.user.firstName }}
                    {{ precheck.user.patronymic || '' }}
                  </strong>
                  <span class="text-muted">
                    ·
                    {{
                      new Date(precheck.user.birthDate).toLocaleDateString(
                        'ru-RU'
                      )
                    }}</span
                  >
                </p>
              </div>

              <h3 class="h6">Проверки</h3>
              <ul class="list-group mb-3">
                <li
                  class="list-group-item d-flex justify-content-between align-items-center"
                >
                  <div>
                    Возраст строго больше 16 лет
                    <small class="d-block text-muted"
                      >Фактически:
                      {{ precheck.checks.ageYears ?? '—' }} лет</small
                    >
                  </div>
                  <i
                    :class="
                      precheck.checks.ageOk
                        ? 'bi bi-check-circle text-success'
                        : 'bi bi-x-circle text-danger'
                    "
                    aria-hidden="true"
                  ></i>
                </li>
                <li
                  class="list-group-item d-flex justify-content-between align-items-center"
                >
                  <div>
                    Наличие простой электронной подписи
                    <small class="d-block text-muted">{{
                      precheck.checks.simpleESign?.name || '—'
                    }}</small>
                  </div>
                  <i
                    :class="
                      precheck.checks.simpleESign?.has
                        ? 'bi bi-check-circle text-success'
                        : 'bi bi-x-circle text-danger'
                    "
                    aria-hidden="true"
                  ></i>
                </li>
                <li
                  class="list-group-item d-flex justify-content-between align-items-center"
                >
                  <div>
                    Налоговый статус не «Физическое лицо»
                    <small class="d-block text-muted">{{
                      precheck.checks.taxation?.typeName || '—'
                    }}</small>
                  </div>
                  <i
                    :class="
                      precheck.checks.taxation?.isNotPerson
                        ? 'bi bi-check-circle text-success'
                        : 'bi bi-x-circle text-danger'
                    "
                    aria-hidden="true"
                  ></i>
                </li>
                <li class="list-group-item">
                  <div
                    class="d-flex justify-content-between align-items-center"
                  >
                    <div>
                      Наличие всех документов (паспорт, ИНН, СНИЛС, банк, адрес)
                    </div>
                    <i
                      :class="
                        precheck.checks.documents?.all
                          ? 'bi bi-check-circle text-success'
                          : 'bi bi-x-circle text-danger'
                      "
                      aria-hidden="true"
                    ></i>
                  </div>
                  <div class="mt-2 small text-muted">
                    <span
                      :class="
                        precheck.checks.documents?.passport
                          ? 'text-success'
                          : 'text-danger'
                      "
                      >Паспорт</span
                    >
                    ·
                    <span
                      :class="
                        precheck.checks.documents?.inn
                          ? 'text-success'
                          : 'text-danger'
                      "
                      >ИНН</span
                    >
                    ·
                    <span
                      :class="
                        precheck.checks.documents?.snils
                          ? 'text-success'
                          : 'text-danger'
                      "
                      >СНИЛС</span
                    >
                    <button
                      v-if="!precheck.checks.documents?.snils"
                      type="button"
                      class="btn btn-link btn-sm p-0 ms-2 align-baseline"
                      @click="goToEditUserSnils"
                      aria-label="Добавить СНИЛС"
                    >
                      Добавить
                    </button>
                    ·
                    <span
                      :class="
                        precheck.checks.documents?.bank
                          ? 'text-success'
                          : 'text-danger'
                      "
                      >Банк</span
                    >
                    ·
                    <span
                      :class="
                        precheck.checks.documents?.address
                          ? 'text-success'
                          : 'text-danger'
                      "
                      >Адрес</span
                    >
                  </div>
                </li>
              </ul>

              <div
                v-if="
                  precheck.checks.isFieldReferee &&
                  precheck.bestNormatives.length
                "
              >
                <h3 class="h6">Лучшие результаты нормативов</h3>
                <div class="table-responsive">
                  <table class="table table-sm align-middle mb-3">
                    <thead>
                      <tr>
                        <th>Норматив</th>
                        <th class="text-end">Значение</th>
                        <th>Зона</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="r in precheck.bestNormatives" :key="r.typeId">
                        <td>{{ r.typeName }}</td>
                        <td class="text-end">
                          {{ r.value }}
                          <small class="text-muted">{{ r.unitAlias }}</small>
                        </td>
                        <td>{{ r.zone?.name || '—' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="form-check mb-2">
                <input
                  id="rulesTest"
                  v-model="passedRulesTest"
                  type="checkbox"
                  class="form-check-input"
                />
                <label class="form-check-label" for="rulesTest"
                  >Успешно сдал тест по правилам</label
                >
              </div>
              <p class="small text-muted mb-0">
                Для формирования договора необходимо выполнить все проверки и
                подтвердить сдачу теста по правилам.
              </p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="close">
            Закрыть
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!canGenerate() || generating"
            @click="generate"
          >
            Сформировать
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
