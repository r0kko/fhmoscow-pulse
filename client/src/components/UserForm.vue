<script setup>
import { onBeforeUnmount, reactive, watch, ref, computed } from 'vue';
import { suggestFio, cleanFio } from '../dadata';

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  isNew: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
  sexes: { type: Array, default: () => [] },
  showSex: { type: Boolean, default: true },
  requireSex: { type: Boolean, default: true },
  frame: { type: Boolean, default: true },
  // When true, replace separate last/first/patronymic inputs with a single FIO field.
  singleFio: { type: Boolean, default: false },
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
const errors = reactive({
  fio: '',
  last_name: '',
  first_name: '',
  patronymic: '',
  birth_date: '',
  sex_id: '',
  phone: '',
  email: '',
});
const suggestions = reactive({
  last_name: [],
  first_name: [],
  patronymic: [],
});
// Single FIO mode state
const fioInput = ref('');
const fioQc = ref(null); // 0 = confident, 1 = needs manual check, null = unknown
const timeouts = {
  last_name: null,
  first_name: null,
  patronymic: null,
};
const suggestAbort = {
  last_name: null,
  first_name: null,
  patronymic: null,
};
const lastSuggestQuery = reactive({
  last_name: '',
  first_name: '',
  patronymic: '',
});
const todayIso = new Date().toISOString().slice(0, 10);

const fieldLabels = {
  fio: 'ФИО',
  last_name: 'Фамилия',
  first_name: 'Имя',
  patronymic: 'Отчество',
  birth_date: 'Дата рождения',
  sex_id: 'Пол',
  phone: 'Телефон',
  email: 'Email',
};

const fieldInputIds = {
  fio: 'fio',
  last_name: 'lastName',
  first_name: 'firstName',
  patronymic: 'patronymic',
  birth_date: 'birthDate',
  sex_id: 'sexSelect',
  phone: 'phone',
  email: 'email',
};

const validationOrder = [
  'fio',
  'last_name',
  'first_name',
  'birth_date',
  'sex_id',
  'phone',
  'email',
];

watch(
  () => props.modelValue,
  (val) => {
    Object.assign(form, val || {});
    phoneInput.value = formatPhone(form.phone || '');
    if (props.singleFio) {
      fioInput.value = [form.last_name, form.first_name, form.patronymic]
        .filter(Boolean)
        .join(' ')
        .trim();
    }
  },
  { immediate: true }
);

watch(form, (val) => {
  emit('update:modelValue', { ...val });
});

function updateSuggestions(field, part) {
  if (!editing.value) return;
  clearTimeout(timeouts[field]);
  if (suggestAbort[field]) {
    suggestAbort[field].abort();
    suggestAbort[field] = null;
  }
  const value = form[field];
  if (!value || value.length < 2) {
    suggestions[field] = [];
    lastSuggestQuery[field] = '';
    return;
  }
  const query = value.trim();
  if (query === lastSuggestQuery[field]) return;
  timeouts[field] = setTimeout(async () => {
    const controller = new AbortController();
    suggestAbort[field] = controller;
    try {
      suggestions[field] = await suggestFio(query, [part], {
        signal: controller.signal,
      });
      lastSuggestQuery[field] = query;
    } catch {
      suggestions[field] = [];
    } finally {
      if (suggestAbort[field] === controller) {
        suggestAbort[field] = null;
      }
    }
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

function normalizePhoneDigits(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`;
  } else if (!digits.startsWith('7')) {
    digits = `7${digits}`;
  }
  return digits.slice(0, 11);
}

function getCaretForDigitCount(formatted, digitCount) {
  if (digitCount <= 0) return 0;
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      count += 1;
      if (count >= digitCount) return i + 1;
    }
  }
  return formatted.length;
}

function onPhoneInput(e) {
  const target = e.target;
  const rawValue = target.value || '';
  const rawCaret = target.selectionStart ?? rawValue.length;
  const digitsBeforeCaret = rawValue
    .slice(0, rawCaret)
    .replace(/\D/g, '').length;
  const digits = normalizePhoneDigits(rawValue);
  const normalizedDigitsBeforeCaret = Math.min(
    digitsBeforeCaret,
    digits.length
  );
  form.phone = digits;
  const formatted = formatPhone(digits);
  phoneInput.value = formatted;
  const caretPos = getCaretForDigitCount(
    formatted,
    normalizedDigitsBeforeCaret
  );
  requestAnimationFrame(() => {
    target.setSelectionRange(caretPos, caretPos);
  });
}

async function onFioBlur() {
  const query =
    `${form.last_name} ${form.first_name} ${form.patronymic}`.trim();
  const cleaned = await cleanFio(query);
  if (cleaned) {
    if (cleaned.surname) form.last_name = cleaned.surname;
    if (cleaned.name) form.first_name = cleaned.name;
    if (cleaned.patronymic) form.patronymic = cleaned.patronymic;
    // If service confidently detected gender, map it to sex_id when available
    if (cleaned.gender && cleaned.qc === 0 && Array.isArray(props.sexes)) {
      const g = String(cleaned.gender).toUpperCase(); // 'М', 'Ж', 'НД'
      let desiredCode = '';
      if (g === 'М') desiredCode = 'MALE';
      else if (g === 'Ж') desiredCode = 'FEMALE';
      // Skip if unsure
      if (desiredCode && !form.sex_id) {
        const norm = (v) => (v || '').toString().trim().toLowerCase();
        let pick = props.sexes.find(
          (s) => norm(s.code) === desiredCode.toLowerCase()
        );
        if (!pick) {
          // Fall back to name matching (RU/EN)
          pick = props.sexes.find((s) => {
            const name = norm(s.name);
            return desiredCode === 'MALE'
              ? name.includes('муж') || name.includes('male')
              : name.includes('жен') || name.includes('female');
          });
        }
        if (pick) form.sex_id = pick.id;
      }
    }
  }
  suggestions.last_name = [];
  suggestions.first_name = [];
  suggestions.patronymic = [];
  lastSuggestQuery.last_name = '';
  lastSuggestQuery.first_name = '';
  lastSuggestQuery.patronymic = '';
}

async function onFioSingleBlur() {
  const query = (fioInput.value || '').trim();
  if (!query) {
    form.last_name = '';
    form.first_name = '';
    form.patronymic = '';
    fioQc.value = null;
    return;
  }
  const cleaned = await cleanFio(query);
  if (cleaned) {
    if (cleaned.surname) form.last_name = cleaned.surname;
    if (cleaned.name) form.first_name = cleaned.name;
    if (cleaned.patronymic) form.patronymic = cleaned.patronymic;
    fioInput.value =
      cleaned.result ||
      `${form.last_name} ${form.first_name} ${form.patronymic}`.trim();
    fioQc.value = typeof cleaned.qc === 'number' ? cleaned.qc : null;
    if (cleaned.gender && cleaned.qc === 0 && Array.isArray(props.sexes)) {
      const g = String(cleaned.gender).toUpperCase();
      let desiredCode = '';
      if (g === 'М') desiredCode = 'MALE';
      else if (g === 'Ж') desiredCode = 'FEMALE';
      if (desiredCode && !form.sex_id) {
        const norm = (v) => (v || '').toString().trim().toLowerCase();
        let pick = props.sexes.find(
          (s) => norm(s.code) === desiredCode.toLowerCase()
        );
        if (!pick) {
          pick = props.sexes.find((s) => {
            const nm = norm(s.name);
            return (
              (desiredCode === 'MALE' &&
                (nm.includes('муж') || nm.includes('male'))) ||
              (desiredCode === 'FEMALE' &&
                (nm.includes('жен') || nm.includes('female')))
            );
          });
        }
        if (pick) form.sex_id = pick.id;
      }
    }
  } else {
    // Fallback: split by space
    const parts = query.split(/\s+/).filter(Boolean);
    form.last_name = parts[0] || '';
    form.first_name = parts[1] || '';
    form.patronymic = parts.slice(2).join(' ');
    fioQc.value = 1;
  }
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
  if (props.singleFio) {
    const ok =
      Boolean((form.last_name || '').trim()) &&
      Boolean((form.first_name || '').trim());
    errors.fio = ok ? '' : 'Введите минимум фамилию и имя';
    // Ensure part-specific errors do not block validation in single field mode
    errors.last_name = '';
    errors.first_name = '';
    errors.patronymic = '';
  } else {
    errors.last_name = form.last_name ? '' : 'Введите фамилию';
    errors.first_name = form.first_name ? '' : 'Введите имя';
    errors.patronymic = '';
  }
  errors.sex_id =
    props.showSex && props.requireSex && !form.sex_id ? 'Выберите пол' : '';
  if (!form.birth_date) {
    errors.birth_date = 'Введите дату рождения';
  } else {
    errors.birth_date =
      form.birth_date <= todayIso ? '' : 'Введите корректную дату';
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

function setFieldError(field, message) {
  if (!field) return;
  if (
    props.singleFio &&
    (field === 'last_name' || field === 'first_name' || field === 'patronymic')
  ) {
    errors.fio = message || '';
    return;
  }
  if (Object.prototype.hasOwnProperty.call(errors, field)) {
    errors[field] = message || '';
  }
}

const errorSummary = computed(() =>
  validationOrder
    .filter((field) => Boolean(errors[field]))
    .map((field) => ({
      field,
      label: fieldLabels[field] || field,
      message: errors[field],
    }))
);

function focusFirstInvalidField() {
  const first = errorSummary.value[0];
  if (!first) return;
  const id = fieldInputIds[first.field];
  if (!id) return;
  const element = document.getElementById(id);
  element?.focus?.();
}

defineExpose({
  validate,
  unlock,
  lock,
  editing,
  setFieldError,
  focusFirstInvalidField,
  getErrorSummary: () => errorSummary.value,
});

onBeforeUnmount(() => {
  Object.values(timeouts).forEach((timer) => {
    if (timer) clearTimeout(timer);
  });
  Object.values(suggestAbort).forEach((controller) => controller?.abort?.());
});
</script>

<template>
  <div>
    <div :class="{ 'card mb-4': props.frame }">
      <div :class="{ 'card-body': props.frame }">
        <div v-if="props.frame" class="d-flex justify-content-between mb-3">
          <h2 class="card-title h5 mb-0">Основные данные и контакты</h2>
          <button
            v-if="!editing && !props.locked"
            type="button"
            class="btn btn-link p-0"
            aria-label="Редактировать"
            @click="unlock"
          >
            <i class="bi bi-pencil"></i>
          </button>
        </div>
        <fieldset :disabled="!editing">
          <div
            v-if="errorSummary.length"
            class="alert alert-danger py-2"
            role="alert"
            aria-live="assertive"
          >
            <div class="fw-semibold mb-1">Проверьте поля формы:</div>
            <ul class="mb-0 ps-3">
              <li v-for="item in errorSummary" :key="item.field">
                {{ item.label }}: {{ item.message }}
              </li>
            </ul>
          </div>
          <div class="row row-cols-1 row-cols-sm-2 g-3">
            <template v-if="props.singleFio">
              <div class="col">
                <div class="form-floating">
                  <input
                    id="fio"
                    v-model="fioInput"
                    class="form-control"
                    :class="{ 'is-invalid': errors.fio }"
                    placeholder="Фамилия Имя Отчество"
                    aria-required="true"
                    autocomplete="name"
                    @blur="onFioSingleBlur"
                  />
                  <label for="fio">ФИО</label>
                  <div class="invalid-feedback">{{ errors.fio }}</div>
                </div>
                <small v-if="fioQc === 1" class="text-warning d-block mt-1"
                  >Проверьте результат: распознано с допущениями</small
                >
              </div>
            </template>
            <template v-else>
              <div class="col position-relative">
                <div class="form-floating">
                  <input
                    id="lastName"
                    v-model="form.last_name"
                    class="form-control"
                    :class="{ 'is-invalid': errors.last_name }"
                    placeholder="Фамилия"
                    aria-required="true"
                    autocomplete="family-name"
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
                    class="list-group-item p-0"
                  >
                    <button
                      type="button"
                      class="list-group-item list-group-item-action w-100 text-start border-0 bg-transparent"
                      @mousedown.prevent="applySuggestion(s)"
                    >
                      {{ s.data.surname }}
                    </button>
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
                    aria-required="true"
                    autocomplete="given-name"
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
                    class="list-group-item p-0"
                  >
                    <button
                      type="button"
                      class="list-group-item list-group-item-action w-100 text-start border-0 bg-transparent"
                      @mousedown.prevent="applySuggestion(s)"
                    >
                      {{ s.data.name }}
                    </button>
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
                    autocomplete="additional-name"
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
                    class="list-group-item p-0"
                  >
                    <button
                      type="button"
                      class="list-group-item list-group-item-action w-100 text-start border-0 bg-transparent"
                      @mousedown.prevent="applySuggestion(s)"
                    >
                      {{ s.data.patronymic }}
                    </button>
                  </li>
                </ul>
              </div>
            </template>
            <div class="col">
              <div class="form-floating">
                <input
                  id="birthDate"
                  v-model="form.birth_date"
                  type="date"
                  class="form-control"
                  :class="{ 'is-invalid': errors.birth_date }"
                  placeholder="Дата рождения"
                  aria-required="true"
                  autocomplete="bday"
                  :max="todayIso"
                />
                <label for="birthDate">Дата рождения</label>
                <div class="invalid-feedback">{{ errors.birth_date }}</div>
              </div>
            </div>
          </div>

          <div v-if="props.showSex" class="row g-3 mt-3">
            <div class="col">
              <label class="form-label">Пол</label>
              <select
                id="sexSelect"
                v-model="form.sex_id"
                class="form-select"
                :class="{ 'is-invalid': errors.sex_id }"
                :aria-required="props.requireSex && props.showSex"
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
                  aria-required="true"
                  autocomplete="tel"
                  inputmode="tel"
                  @input="onPhoneInput"
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
                  type="text"
                  class="form-control"
                  :class="{ 'is-invalid': errors.email }"
                  placeholder="Email"
                  aria-required="true"
                  autocomplete="email"
                />
                <label for="email">Email</label>
                <div class="invalid-feedback">{{ errors.email }}</div>
              </div>
            </div>
          </div>
        </fieldset>

        <div v-if="editing && props.frame" class="mt-3">
          <slot name="actions"></slot>
        </div>
      </div>
    </div>

    <p v-if="isNew" class="text-muted">
      Данные для входа будут отправлены на email пользователя
    </p>
  </div>
</template>
