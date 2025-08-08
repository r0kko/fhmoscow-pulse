<script setup>
import { ref, reactive, watch, onMounted } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { cleanPassport, suggestFmsUnit } from '../dadata.js';

const props = defineProps({
  user: Object,
});
const emit = defineEmits(['saved']);

const modalRef = ref(null);
let modal;

const step = ref(1);

const form = reactive({
  document_type: 'CIVIL',
  country: 'RU',
  series: '',
  number: '',
  issue_date: '',
  valid_until: '',
  issuing_authority: '',
  issuing_authority_code: '',
  place_of_birth: '',
});

const errors = reactive({});
const suggestions = ref([]);
const searchTimeout = ref(null);
const checkStatus = reactive({ status: '', message: '' });
const seriesNumber = ref('');

onMounted(() => {
  modal = new Modal(modalRef.value);
});

function open() {
  step.value = 1;
  Object.keys(form).forEach((k) => (form[k] = ''));
  form.document_type = 'CIVIL';
  form.country = 'RU';
  seriesNumber.value = '';
  checkStatus.status = '';
  checkStatus.message = '';
  modal.show();
}

defineExpose({ open });

function next() {
  if (step.value === 1) {
    step.value = 2;
  } else if (step.value === 2) {
    if (
      form.document_type === 'CIVIL' &&
      form.country === 'RU' &&
      checkStatus.status !== 'valid'
    ) {
      errors.series = 'Проверьте паспорт';
      return;
    }
    step.value = 3;
  }
}

function prev() {
  if (step.value > 1) step.value--;
}

async function checkPassport() {
  checkStatus.status = 'pending';
  checkStatus.message = 'Проверка...';
  const query = seriesNumber.value;
  const data = await cleanPassport(query);
  if (data && data.qc === 0) {
    form.series = data.series.replace(/\s+/g, '');
    form.number = data.number;
    checkStatus.status = 'valid';
    checkStatus.message = 'Паспорт действителен';
    errors.series = '';
  } else if (data && data.qc === 10) {
    checkStatus.status = 'invalid';
    checkStatus.message = 'Паспорт недействителен';
    errors.series = 'Паспорт недействителен';
  } else {
    checkStatus.status = 'error';
    checkStatus.message = 'Ошибка проверки';
    errors.series = 'Ошибка проверки';
  }
}

function updateSuggestions() {
  clearTimeout(searchTimeout.value);
  const q = form.issuing_authority_code;
  if (!q || q.length < 3) {
    suggestions.value = [];
    return;
  }
  searchTimeout.value = setTimeout(async () => {
    suggestions.value = await suggestFmsUnit(q);
  }, 300);
}

watch(() => form.issuing_authority_code, updateSuggestions);

function onIssuingCodeInput(e) {
  let digits = e.target.value.replace(/\D/g, '').slice(0, 6);
  if (digits.length > 3) {
    digits = digits.slice(0, 3) + '-' + digits.slice(3);
  }
  form.issuing_authority_code = digits;
}

function applySuggestion(s) {
  form.issuing_authority = s.data.name;
  form.issuing_authority_code = s.data.code;
  suggestions.value = [];
}

function calcValid() {
  if (form.country !== 'RU' || form.document_type !== 'CIVIL') return;
  if (!props.user || !props.user.birth_date || !form.issue_date) return;
  const birth = new Date(props.user.birth_date);
  const issue = new Date(form.issue_date);
  const age = (issue - birth) / (365.25 * 24 * 3600 * 1000);
  let until;
  if (age < 20) {
    until = new Date(birth);
    until.setFullYear(until.getFullYear() + 20);
  } else if (age < 45) {
    until = new Date(birth);
    until.setFullYear(until.getFullYear() + 45);
  } else {
    until = new Date(birth);
    until.setFullYear(until.getFullYear() + 100);
    form.valid_until = until.toISOString().slice(0, 10);
    return;
  }
  if (until) {
    until.setDate(until.getDate() + 90);
    form.valid_until = until.toISOString().slice(0, 10);
  } else {
    form.valid_until = '';
  }
}

watch(() => form.issue_date, calcValid);

function validate() {
  if (form.document_type === 'CIVIL' && form.country === 'RU') {
    errors.series = form.series ? '' : 'Введите серию';
    errors.number = form.number ? '' : 'Введите номер';
    errors.issue_date = form.issue_date ? '' : 'Введите дату';
    errors.issuing_authority_code = form.issuing_authority_code
      ? ''
      : 'Укажите код';
    errors.issuing_authority = form.issuing_authority
      ? ''
      : 'Выберите подразделение';
  }
  return !Object.values(errors).some(Boolean);
}

async function save() {
  if (!validate()) return;
  emit('saved', { ...form });
  modal.hide();
}
</script>

<template>
  <div ref="modalRef" class="modal fade" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Добавить паспорт</h5>
          <button
            type="button"
            class="btn-close"
            @click="modal.hide()"
          ></button>
        </div>
        <div class="modal-body">
          <div v-if="step === 1">
            <div class="mb-3">
              <label class="form-label">Тип документа</label>
              <select v-model="form.document_type" class="form-select">
                <option value="CIVIL">Паспорт гражданина</option>
                <option value="FOREIGN">Заграничный паспорт</option>
                <option value="RESIDENCE_PERMIT">Вид на жительство</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label">Страна</label>
              <select v-model="form.country" class="form-select">
                <option value="RU">Российская Федерация</option>
              </select>
            </div>
          </div>
          <div v-else-if="step === 2">
            <div class="mb-3">
              <label class="form-label">Серия и номер</label>
              <input
                v-model="seriesNumber"
                class="form-control"
                :class="{ 'is-invalid': errors.series }"
              />
              <div class="invalid-feedback">{{ errors.series }}</div>
            </div>
            <button
              type="button"
              class="btn btn-outline-secondary"
              @click="checkPassport"
              v-if="form.document_type === 'CIVIL' && form.country === 'RU'"
            >
              Проверить паспорт
            </button>
            <div class="mt-2" v-if="checkStatus.message">
              <i
                :class="{
                  'bi bi-check-circle text-success':
                    checkStatus.status === 'valid',
                  'bi bi-x-circle text-danger':
                    checkStatus.status === 'invalid',
                  'bi bi-exclamation-circle text-warning':
                    checkStatus.status === 'error',
                }"
                class="me-1"
              ></i>
              {{ checkStatus.message }}
            </div>
          </div>
          <div v-else>
            <div class="mb-3 position-relative">
              <label class="form-label">Код подразделения</label>
              <input
                v-model="form.issuing_authority_code"
                @input="onIssuingCodeInput"
                maxlength="7"
                class="form-control"
                :class="{ 'is-invalid': errors.issuing_authority_code }"
              />
              <div class="invalid-feedback">
                {{ errors.issuing_authority_code }}
              </div>
              <ul
                v-if="suggestions.length"
                class="list-group position-absolute w-100"
                style="z-index: 1050"
              >
                <li
                  v-for="s in suggestions"
                  :key="s.value"
                  class="list-group-item list-group-item-action"
                  @mousedown.prevent="applySuggestion(s)"
                >
                  {{ s.value }}
                </li>
              </ul>
            </div>
            <div class="mb-3">
              <label class="form-label">Кем выдан</label>
              <div class="input-group">
                <span class="input-group-text bg-light"
                  ><i class="bi bi-lock"></i
                ></span>
                <input
                  v-model="form.issuing_authority"
                  class="form-control"
                  readonly
                />
              </div>
              <div class="invalid-feedback d-block">
                {{ errors.issuing_authority }}
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label">Дата выдачи</label>
              <input
                type="date"
                v-model="form.issue_date"
                class="form-control"
                :class="{ 'is-invalid': errors.issue_date }"
              />
              <div class="invalid-feedback">{{ errors.issue_date }}</div>
            </div>
            <div
              class="mb-3"
              v-if="form.country !== 'RU' || form.document_type !== 'CIVIL'"
            >
              <label class="form-label">Действителен до</label>
              <input
                type="date"
                v-model="form.valid_until"
                class="form-control"
              />
            </div>
            <div class="mb-3" v-else>
              <label class="form-label">Действителен до</label>
              <input
                type="date"
                v-model="form.valid_until"
                class="form-control"
                disabled
              />
            </div>
            <div class="mb-3">
              <label class="form-label">Место рождения</label>
              <input v-model="form.place_of_birth" class="form-control" />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            @click="prev"
            v-if="step > 1"
          >
            Назад
          </button>
          <button
            type="button"
            class="btn btn-brand"
            v-if="step < 3"
            @click="next"
          >
            Далее
          </button>
          <button
            type="button"
            class="btn btn-brand"
            v-if="step === 3"
            @click="save"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.input-group-text.bg-light {
  color: #6c757d;
}
</style>
