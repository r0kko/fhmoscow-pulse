<script setup>
import { reactive, watch, ref, computed } from 'vue';
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
const errors = reactive({});
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
      Boolean((form.first_name || '').trim()) &&
      Boolean((form.patronymic || '').trim());
    errors.fio = ok ? '' : 'Введите ФИО полностью (фамилия, имя, отчество)';
    // Ensure part-specific errors do not block validation in single field mode
    errors.last_name = '';
    errors.first_name = '';
    errors.patronymic = '';
  } else {
    errors.last_name = form.last_name ? '' : 'Введите фамилию';
    errors.first_name = form.first_name ? '' : 'Введите имя';
    if (props.isNew) {
      errors.patronymic = form.patronymic ? '' : 'Введите отчество';
    }
  }
  errors.sex_id =
    props.showSex && props.requireSex && !form.sex_id ? 'Выберите пол' : '';
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

function setFieldError(field, message) {
  if (field && Object.prototype.hasOwnProperty.call(errors, field)) {
    errors[field] = message || '';
  }
}

defineExpose({ validate, unlock, lock, editing, setFieldError });

const selectedSexName = computed(() => {
  if (!form.sex_id || !Array.isArray(props.sexes)) return '';
  const found = props.sexes.find((s) => s.id === form.sex_id);
  return found ? found.name : '';
});
</script>

<template>
  <div>
    <div v-if="props.frame" class="card mb-4">
      <div class="card-body">
        <div class="d-flex justify-content-between mb-3">
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
                    required
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
                  required
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
                v-model="form.sex_id"
                class="form-select"
                :class="{ 'is-invalid': errors.sex_id }"
                :required="props.requireSex && props.showSex"
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
    <div v-else>
      <fieldset :disabled="!editing">
        <div class="row row-cols-1 row-cols-sm-2 g-3">
          <template v-if="props.singleFio">
            <div class="col">
              <div class="form-floating">
                <input
                  id="fio2"
                  v-model="fioInput"
                  class="form-control"
                  :class="{ 'is-invalid': errors.fio }"
                  placeholder="Фамилия Имя Отчество"
                  required
                  @blur="onFioSingleBlur"
                />
                <label for="fio2">ФИО</label>
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
                  id="lastName2"
                  v-model="form.last_name"
                  class="form-control"
                  :class="{ 'is-invalid': errors.last_name }"
                  placeholder="Фамилия"
                  required
                  @blur="onFioBlur"
                />
                <label for="lastName2">Фамилия</label>
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
                  id="firstName2"
                  v-model="form.first_name"
                  class="form-control"
                  :class="{ 'is-invalid': errors.first_name }"
                  placeholder="Имя"
                  required
                  @blur="onFioBlur"
                />
                <label for="firstName2">Имя</label>
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
                  id="patronymic2"
                  v-model="form.patronymic"
                  class="form-control"
                  placeholder="Отчество"
                  @blur="onFioBlur"
                />
                <label for="patronymic2">Отчество</label>
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
                required
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
              v-model="form.sex_id"
              class="form-select"
              :class="{ 'is-invalid': errors.sex_id }"
              :required="props.requireSex && props.showSex"
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
    </div>

    <p v-if="isNew" class="text-muted">
      Данные для входа будут отправлены на email пользователя
    </p>
  </div>
</template>
