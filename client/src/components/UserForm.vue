<script setup>
import { reactive, watch, ref } from 'vue';
import { suggestFio, cleanFio } from '../dadata.js';

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  isNew: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
  sexes: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:modelValue', 'editing-changed']);

const form = reactive({
  last_name: '',
  first_name: '',
  patronymic: '',
  birth_date: '',
  sex_id: '',
  phone: '',
  email: '',
});

const phoneInput = ref('');
const errors = reactive({});
const suggestions = reactive({
  last_name: [],
  first_name: [],
  patronymic: [],
});
const timeouts = {
  last_name: null,
  first_name: null,
  patronymic: null,
};

watch(
  () => props.modelValue,
  (val) => {
    Object.assign(form, val || {});
    phoneInput.value = formatPhone(form.phone || '');
  },
  { immediate: true }
);

watch(form, (val) => {
  emit('update:modelValue', { ...val });
});

function updateSuggestions(field, part) {
  if (!editing.value) return;
  clearTimeout(timeouts[field]);
  const value = form[field];
  if (!value || value.length < 2) {
    suggestions[field] = [];
    return;
  }
  const query = value.trim();
  timeouts[field] = setTimeout(async () => {
    suggestions[field] = await suggestFio(query, [part]);
  }, 300);
}

watch(
  () => form.last_name,
  () => updateSuggestions('last_name', 'SURNAME')
);
watch(
  () => form.first_name,
  () => updateSuggestions('first_name', 'NAME')
);
watch(
  () => form.patronymic,
  () => updateSuggestions('patronymic', 'PATRONYMIC')
);

function formatPhone(digits) {
  if (!digits) return '';
  let out = '+7';
  if (digits.length > 1) out += ' (' + digits.slice(1, 4);
  if (digits.length >= 4) out += ') ';
  if (digits.length >= 4) out += digits.slice(4, 7);
  if (digits.length >= 7) out += '-' + digits.slice(7, 9);
  if (digits.length >= 9) out += '-' + digits.slice(9, 11);
  return out;
}

function onPhoneInput(e) {
  let digits = e.target.value.replace(/\D/g, '');
  if (!digits.startsWith('7')) digits = '7' + digits.replace(/^7*/, '');
  digits = digits.slice(0, 11);
  form.phone = digits;
  phoneInput.value = formatPhone(digits);
}

function onPhoneKeydown(e) {
  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault();
    form.phone = form.phone.slice(0, -1);
    phoneInput.value = formatPhone(form.phone);
  }
}

async function onFioBlur() {
  const query =
    `${form.last_name} ${form.first_name} ${form.patronymic}`.trim();
  const cleaned = await cleanFio(query);
  if (cleaned) {
    if (cleaned.surname) form.last_name = cleaned.surname;
    if (cleaned.name) form.first_name = cleaned.name;
    if (cleaned.patronymic) form.patronymic = cleaned.patronymic;
  }
  suggestions.last_name = [];
  suggestions.first_name = [];
  suggestions.patronymic = [];
}

function applySuggestion(sug) {
  if (sug.data.surname) form.last_name = sug.data.surname;
  if (sug.data.name) form.first_name = sug.data.name;
  if (sug.data.patronymic) form.patronymic = sug.data.patronymic;
  suggestions.last_name = [];
  suggestions.first_name = [];
  suggestions.patronymic = [];
}

function validate() {
  errors.last_name = form.last_name ? '' : 'Введите фамилию';
  errors.first_name = form.first_name ? '' : 'Введите имя';
  errors.sex_id = form.sex_id ? '' : 'Выберите пол';
  if (!form.birth_date) {
    errors.birth_date = 'Введите дату рождения';
  } else {
    const date = new Date(form.birth_date);
    errors.birth_date = date <= new Date() ? '' : 'Введите корректную дату';
  }
  errors.phone = form.phone.length === 11 ? '' : 'Неверный номер';
  errors.email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)
    ? ''
    : 'Неверный email';
  return !Object.values(errors).some(Boolean);
}

const editing = ref(!props.locked);

watch(editing, (val) => emit('editing-changed', val));

function unlock() {
  if (!props.locked) editing.value = true;
}

function lock() {
  editing.value = false;
}

defineExpose({ validate, unlock, lock, editing });
</script>

<template>
  <div>
    <div class="card mb-4">
      <div class="card-body">
        <div class="d-flex justify-content-between mb-3">
          <h2 class="card-title h5 mb-0">Основные данные и контакты</h2>
          <button
            v-if="!editing && !props.locked"
            type="button"
            class="btn btn-link p-0"
            @click="unlock"
          >
            <i class="bi bi-pencil"></i>
          </button>
        </div>
        <fieldset :disabled="!editing">
          <div class="row row-cols-1 row-cols-sm-2 g-3">
            <div class="col position-relative">
              <div class="form-floating">
                <input
                  id="lastName"
                  v-model="form.last_name"
                  class="form-control"
                  :class="{ 'is-invalid': errors.last_name }"
                  placeholder="Фамилия"
                  required
                  @blur="onFioBlur"
                />
                <label for="lastName">Фамилия</label>
                <div class="invalid-feedback">{{ errors.last_name }}</div>
              </div>
              <ul
                v-if="suggestions.last_name.length"
                class="list-group position-absolute w-100"
                style="z-index: 1050"
              >
                <li
                  v-for="s in suggestions.last_name"
                  :key="s.value"
                  class="list-group-item list-group-item-action"
                  @mousedown.prevent="applySuggestion(s)"
                >
                  {{ s.data.surname }}
                </li>
              </ul>
            </div>
            <div class="col position-relative">
              <div class="form-floating">
                <input
                  id="firstName"
                  v-model="form.first_name"
                  class="form-control"
                  :class="{ 'is-invalid': errors.first_name }"
                  placeholder="Имя"
                  required
                  @blur="onFioBlur"
                />
                <label for="firstName">Имя</label>
                <div class="invalid-feedback">{{ errors.first_name }}</div>
              </div>
              <ul
                v-if="suggestions.first_name.length"
                class="list-group position-absolute w-100"
                style="z-index: 1050"
              >
                <li
                  v-for="s in suggestions.first_name"
                  :key="s.value"
                  class="list-group-item list-group-item-action"
                  @mousedown.prevent="applySuggestion(s)"
                >
                  {{ s.data.name }}
                </li>
              </ul>
            </div>
            <div class="col position-relative">
              <div class="form-floating">
                <input
                  id="patronymic"
                  v-model="form.patronymic"
                  class="form-control"
                  placeholder="Отчество"
                  @blur="onFioBlur"
                />
                <label for="patronymic">Отчество</label>
              </div>
              <ul
                v-if="suggestions.patronymic.length"
                class="list-group position-absolute w-100"
                style="z-index: 1050"
              >
                <li
                  v-for="s in suggestions.patronymic"
                  :key="s.value"
                  class="list-group-item list-group-item-action"
                  @mousedown.prevent="applySuggestion(s)"
                >
                  {{ s.data.patronymic }}
                </li>
              </ul>
            </div>
            <div class="col">
              <div class="form-floating">
                <input
                  id="birthDate"
                  v-model="form.birth_date"
                  type="date"
                  class="form-control"
                  :class="{ 'is-invalid': errors.birth_date }"
                  placeholder="Дата рождения"
                  required
                />
                <label for="birthDate">Дата рождения</label>
                <div class="invalid-feedback">{{ errors.birth_date }}</div>
              </div>
            </div>
          </div>
          <div class="row g-3 mt-3">
            <div class="col">
              <label class="form-label">Пол</label>
              <select
                v-model="form.sex_id"
                class="form-select"
                :class="{ 'is-invalid': errors.sex_id }"
                required
              >
                <option value="" disabled>Выберите...</option>
                <option v-for="s in props.sexes" :key="s.id" :value="s.id">
                  {{ s.name }}
                </option>
              </select>
              <div class="invalid-feedback">{{ errors.sex_id }}</div>
            </div>
          </div>
          <div class="row row-cols-1 row-cols-sm-2 g-3 mt-3">
            <div class="col">
              <div class="form-floating">
                <input
                  id="phone"
                  v-model="phoneInput"
                  class="form-control"
                  :class="{ 'is-invalid': errors.phone }"
                  placeholder="Телефон"
                  required
                  @input="onPhoneInput"
                  @keydown="onPhoneKeydown"
                />
                <label for="phone">Телефон</label>
                <div class="invalid-feedback">{{ errors.phone }}</div>
              </div>
            </div>
            <div class="col">
              <div class="form-floating">
                <input
                  id="email"
                  v-model="form.email"
                  type="email"
                  class="form-control"
                  :class="{ 'is-invalid': errors.email }"
                  placeholder="Email"
                  required
                />
                <label for="email">Email</label>
                <div class="invalid-feedback">{{ errors.email }}</div>
              </div>
            </div>
          </div>
        </fieldset>
        <div v-if="editing" class="mt-3">
          <slot name="actions"></slot>
        </div>
      </div>
    </div>

    <p v-if="isNew" class="text-muted">
      Пароль будет сгенерирован автоматически
    </p>
  </div>
</template>
