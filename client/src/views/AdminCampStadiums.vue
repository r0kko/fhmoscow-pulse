<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { RouterLink } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';
import { suggestAddress, cleanAddress } from '../dadata.js';
import RefereeGroupAssignments from '../components/RefereeGroupAssignments.vue';

const activeTab = ref('stadiums');

const phoneInput = ref('');

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
  form.value.phone = digits;
  phoneInput.value = formatPhone(digits);
}

function onPhoneKeydown(e) {
  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault();
    form.value.phone = form.value.phone.slice(0, -1);
    phoneInput.value = formatPhone(form.value.phone);
  }
}

const stadiums = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = 8;
const isLoading = ref(false);
const error = ref('');

const parkingTypes = ref([]);

/* training types */
const trainingTypes = ref([]);
const typesTotal = ref(0);
const typesPage = ref(1);
const typesLoading = ref(false);
const typesError = ref('');
const typeForm = ref({ name: '', default_capacity: '' });
const typeEditing = ref(null);
const typeModalRef = ref(null);
let typeModal;
const typeFormError = ref('');

/* trainings */
const trainings = ref([]);
const trainingsTotal = ref(0);
const trainingsPage = ref(1);
const trainingsLoading = ref(false);
const trainingsError = ref('');
const stadiumOptions = ref([]);
const refereeGroups = ref([]);
const trainingForm = ref({
  type_id: '',
  camp_stadium_id: '',
  start_at: '',
  end_at: '',
  capacity: '',
  groups: [],
});
const trainingEditing = ref(null);
const trainingModalRef = ref(null);
let trainingModal;
const trainingFormError = ref('');
const registrationList = ref([]);
const registrationTotal = ref(0);
const registrationPage = ref(1);
const registrationLoading = ref(false);
const registrationError = ref('');
const registrationModalRef = ref(null);
let registrationModal;
const registrationTraining = ref(null);
const addForm = ref({ user_id: '', training_role_id: '' });
const addLoading = ref(false);
const judges = ref([]);
const trainingRoles = ref([]);
const assignmentsRef = ref(null);

const form = ref({
  name: '',
  address: { result: '' },
  yandex_url: '',
  capacity: '',
  phone: '',
  website: '',
  parking: [],
});
const editing = ref(null);
const modalRef = ref(null);
let modal;
const formError = ref('');
const addressSuggestions = ref([]);
let addrTimeout;

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));
const typesTotalPages = computed(() => Math.max(1, Math.ceil(typesTotal.value / pageSize)));
const registrationsTotalPages = computed(() =>
  Math.max(1, Math.ceil(registrationTotal.value / pageSize))
);


onMounted(() => {
  modal = new Modal(modalRef.value);
  load();
  loadParkingTypes();
  loadTypes();
  loadTrainings();
  loadStadiumOptions();
  loadRefereeGroups();
  });

watch(currentPage, () => {
  if (activeTab.value === 'stadiums') load();
});
watch(typesPage, () => {
  if (activeTab.value === 'types') loadTypes();
});
watch(trainingsPage, () => {
  if (activeTab.value === 'trainings') loadTrainings();
});
watch(registrationPage, () => {
  if (registrationTraining.value) {
    loadRegistrations(registrationTraining.value.id);
  }
});

watch(activeTab, (val) => {
  if (val === 'types' && !trainingTypes.value.length) {
    loadTypes();
  } else if (val === 'trainings' && !trainings.value.length) {
    loadTrainings();
    if (!stadiumOptions.value.length) loadStadiumOptions();
  } else if (val === 'judges') {
    assignmentsRef.value?.refresh();
  }
});

watch(
    () => form.value.address.result,
    (val) => {
      clearTimeout(addrTimeout);
      if (!val || val.length < 3) {
        addressSuggestions.value = [];
        return;
      }
      const query = val.trim();
      addrTimeout = setTimeout(async () => {
        addressSuggestions.value = await suggestAddress(query);
      }, 300);
    }
);

watch(
  () => trainingForm.value.type_id,
  (val) => {
    const tt = trainingTypes.value.find((t) => t.id === val);
    if (tt && tt.default_capacity && (!trainingEditing.value || !trainingForm.value.capacity)) {
      trainingForm.value.capacity = tt.default_capacity;
    }
  }
);

watch(
  () => trainingForm.value.start_at,
  (val) => {
    if (!val) return;
    const start = new Date(val);
    const end = new Date(start.getTime() + 90 * 60000);
    if (!trainingEditing.value) {
      trainingForm.value.end_at = end.toISOString().slice(0, 16);
    }
  }
);

watch(
  [() => trainingForm.value.start_at, () => trainingForm.value.end_at],
  ([start, end]) => {
    if (start && end && new Date(end) <= new Date(start)) {
      trainingFormError.value = 'Время окончания должно быть позже начала';
    } else {
      trainingFormError.value = '';
    }
  }
);

async function loadParkingTypes() {
  try {
    const data = await apiFetch('/camp-stadiums/parking-types');
    parkingTypes.value = data.parkingTypes;
  } catch (_) {
    parkingTypes.value = [];
  }
}

async function load() {
  try {
    isLoading.value = true;
    const params = new URLSearchParams({
      page: currentPage.value,
      limit: pageSize,
    });
    const data = await apiFetch(`/camp-stadiums?${params}`);
    stadiums.value = data.stadiums;
    total.value = data.total;
  } catch (e) {
    error.value = e.message;
  } finally {
    isLoading.value = false;
  }
}

function makeParkingForm() {
  return parkingTypes.value.map((t) => ({ type: t.alias, price: '', enabled: false }));
}

function openCreate() {
  editing.value = null;
  form.value = {
    name: '',
    address: { result: '' },
    yandex_url: '',
    capacity: '',
    phone: '',
    website: '',
    parking: makeParkingForm(),
  };
  phoneInput.value = '';
  formError.value = '';
  addressSuggestions.value = [];
  modal.show();
}

function openEdit(s) {
  editing.value = s;
  form.value = {
    name: s.name,
    address: { result: s.address?.result || '' },
    yandex_url: s.yandex_url || '',
    capacity: s.capacity || '',
    phone: s.phone || '',
    website: s.website || '',
    parking: parkingTypes.value.map((t) => {
      const found = (s.parking || []).find((p) => p.type === t.alias);
      return { type: t.alias, price: found?.price || '', enabled: !!found };
    }),
  };
  phoneInput.value = formatPhone(form.value.phone);
  formError.value = '';
  addressSuggestions.value = [];
  modal.show();
}

async function save() {
  const payload = {
    name: form.value.name,
    address: { result: form.value.address.result },
    yandex_url: form.value.yandex_url || undefined,
    capacity: form.value.capacity || undefined,
    phone: form.value.phone || undefined,
    website: form.value.website || undefined,
    parking: form.value.parking
        .filter((p) => p.enabled)
        .map((p) => ({ type: p.type, price: p.price || null })),
  };
  try {
    if (editing.value) {
      await apiFetch(`/camp-stadiums/${editing.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/camp-stadiums', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    modal.hide();
    await load();
  } catch (e) {
    formError.value = e.message;
  }
}

async function removeStadium(s) {
  if (!confirm('Удалить стадион?')) return;
  await apiFetch(`/camp-stadiums/${s.id}`, { method: 'DELETE' });
  await load();
}

function applyAddressSuggestion(sug) {
  form.value.address.result = sug.value;
  addressSuggestions.value = [];
}

async function onAddressBlur() {
  const cleaned = await cleanAddress(form.value.address.result);
  if (cleaned && cleaned.result) {
    form.value.address.result = cleaned.result;
  }
  addressSuggestions.value = [];
}

async function loadTypes() {
  try {
    typesLoading.value = true;
    const params = new URLSearchParams({
      page: typesPage.value,
      limit: pageSize,
    });
    const data = await apiFetch(`/camp-training-types?${params}`);
    trainingTypes.value = data.types;
    typesTotal.value = data.total;
  } catch (e) {
    typesError.value = e.message;
  } finally {
    typesLoading.value = false;
  }
}

function openCreateType() {
  if (!typeModal) {
    typeModal = new Modal(typeModalRef.value)
  }
  typeEditing.value = null;
  typeForm.value = { name: '', default_capacity: '' };
  typeFormError.value = '';
  typeModal.show();
}

function openEditType(t) {
  if (!typeModal) {
    typeModal = new Modal(typeModalRef.value)
  }
  typeEditing.value = t;
  typeForm.value = {
    name: t.name,
    default_capacity: t.default_capacity || '',
  };
  typeFormError.value = '';
  typeModal.show();
}

async function saveType() {
  const payload = {
    name: typeForm.value.name,
    default_capacity: typeForm.value.default_capacity || undefined,
  };
  try {
    if (typeEditing.value) {
      await apiFetch(`/camp-training-types/${typeEditing.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/camp-training-types', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    typeModal.hide();
    await loadTypes();
  } catch (e) {
    typeFormError.value = e.message;
  }
}


async function loadTrainings() {
  try {
    trainingsLoading.value = true;
    const params = new URLSearchParams({
      page: trainingsPage.value,
      limit: pageSize,
    });
    const data = await apiFetch(`/camp-trainings?${params}`);
    trainings.value = data.trainings;
    trainingsTotal.value = data.total;
  } catch (e) {
    trainingsError.value = e.message;
  } finally {
    trainingsLoading.value = false;
  }
}


async function loadStadiumOptions() {
  try {
    const params = new URLSearchParams({ page: 1, limit: 100 });
    const data = await apiFetch(`/camp-stadiums?${params}`);
    stadiumOptions.value = data.stadiums;
  } catch (_) {
    stadiumOptions.value = [];
  }
}

async function loadRefereeGroups(seasonId) {
  try {
    const params = new URLSearchParams({ page: 1, limit: 100 });
    if (seasonId) params.set('season_id', seasonId);
    const data = await apiFetch(`/referee-groups?${params}`);
    refereeGroups.value = data.groups;
  } catch (_) {
    refereeGroups.value = [];
  }
}

function openCreateTraining() {
  if (!trainingModal) {
    trainingModal = new Modal(trainingModalRef.value)
  }
  trainingEditing.value = null;
  if (!stadiumOptions.value.length) loadStadiumOptions();
  loadRefereeGroups();
  trainingForm.value = {
    type_id: '',
    camp_stadium_id: '',
    start_at: '',
    end_at: '',
    capacity: '',
    groups: [],
  };
  trainingFormError.value = '';
  trainingModal.show();
}

function toInputValue(str) {
  if (!str) return '';
  const d = new Date(str);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}


function formatDateTimeRange(start, end) {
  if (!start) return '';
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  const startDate = new Date(start);
  const endDate = new Date(end);
  const date = `${pad(startDate.getDate())}.${pad(startDate.getMonth() + 1)}.${
    startDate.getFullYear()}`;
  const startTime = `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`;
  const endTime = `${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
  return `${date} ${startTime} - ${endTime}`;
}

function openEditTraining(t) {
  if (!trainingModal) {
    trainingModal = new Modal(trainingModalRef.value)
  }
  trainingEditing.value = t;
  loadRefereeGroups(t.season?.id);
  trainingForm.value = {
    type_id: t.type?.id || '',
    camp_stadium_id: t.stadium?.id || '',
    start_at: toInputValue(t.start_at),
    end_at: toInputValue(t.end_at),
    capacity: t.capacity || '',
    groups: (t.groups || []).map((g) => g.id),
  };
  trainingFormError.value = '';
  trainingModal.show();
}

async function saveTraining() {
  if (
    new Date(trainingForm.value.end_at) <= new Date(trainingForm.value.start_at)
  ) {
    trainingFormError.value = 'Время окончания должно быть позже начала';
    return;
  }
  const payload = {
    type_id: trainingForm.value.type_id,
    camp_stadium_id: trainingForm.value.camp_stadium_id,
    start_at: new Date(trainingForm.value.start_at).toISOString(),
    end_at: new Date(trainingForm.value.end_at).toISOString(),
    capacity: trainingForm.value.capacity || undefined,
    groups: trainingForm.value.groups,
  };
  try {
    if (trainingEditing.value) {
      await apiFetch(`/camp-trainings/${trainingEditing.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/camp-trainings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    trainingModal.hide();
    await loadTrainings();
  } catch (e) {
    trainingFormError.value = e.message;
  }
}

async function removeTraining(t) {
  if (!confirm('Удалить запись?')) return;
  await apiFetch(`/camp-trainings/${t.id}`, { method: 'DELETE' });
  await loadTrainings();
}

async function loadRegistrations(trainingId) {
  try {
    registrationLoading.value = true;
    const params = new URLSearchParams({
      page: registrationPage.value,
      limit: pageSize,
    });
    const data = await apiFetch(
      `/camp-trainings/${trainingId}/registrations?${params}`
    );
    registrationList.value = data.registrations;
    registrationTotal.value = data.total;
  } catch (e) {
    registrationError.value = e.message;
  } finally {
    registrationLoading.value = false;
  }
}

async function loadJudges() {
  try {
    const data = await apiFetch('/referee-group-users');
    judges.value = data.judges;
  } catch (_) {
    judges.value = [];
  }
}

async function loadTrainingRoles() {
  try {
    const data = await apiFetch('/training-roles');
    trainingRoles.value = data.roles;
  } catch (_) {
    trainingRoles.value = [];
  }
}

async function addRegistration() {
  if (!registrationTraining.value) return;
  if (!addForm.value.user_id || !addForm.value.training_role_id) return;
  try {
    addLoading.value = true;
    await apiFetch(
      `/camp-trainings/${registrationTraining.value.id}/registrations`,
      {
        method: 'POST',
        body: JSON.stringify(addForm.value),
      }
    );
    addForm.value.user_id = '';
    addForm.value.training_role_id = '';
    await loadRegistrations(registrationTraining.value.id);
    await loadTrainings();
  } catch (e) {
    alert(e.message);
  } finally {
    addLoading.value = false;
  }
}

function openRegistrations(t) {
  if (!registrationModal) {
    registrationModal = new Modal(registrationModalRef.value);
  }
  registrationTraining.value = t;
  registrationPage.value = 1;
  registrationError.value = '';
  if (!judges.value.length) loadJudges();
  if (!trainingRoles.value.length) loadTrainingRoles();
  loadRegistrations(t.id);
  registrationModal.show();
}

async function removeRegistration(userId) {
  if (!registrationTraining.value) return;
  if (!confirm('Удалить запись?')) return;
  try {
    await apiFetch(
      `/camp-trainings/${registrationTraining.value.id}/registrations/${userId}`,
      { method: 'DELETE' }
    );
    await loadRegistrations(registrationTraining.value.id);
    await loadTrainings();
  } catch (e) {
    alert(e.message);
  }
}
</script>

<template>
  <div class="container mt-4">
    <nav aria-label="breadcrumb" class="mb-3">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item">
          <RouterLink to="/admin">Администрирование</RouterLink>
        </li>
        <li class="breadcrumb-item active" aria-current="page">Сборы</li>
      </ol>
    </nav>
    <div class="card tile mb-4">
      <div class="card-body p-2">
        <ul class="nav nav-pills nav-fill justify-content-between mb-0">
          <li class="nav-item">
            <button class="nav-link" :class="{ active: activeTab === 'stadiums' }" @click="activeTab = 'stadiums'">
              Стадионы
            </button>
          </li>
          <li class="nav-item">
            <button class="nav-link" :class="{ active: activeTab === 'types' }" @click="activeTab = 'types'">
              Типы тренировок
            </button>
          </li>
          <li class="nav-item">
            <button class="nav-link" :class="{ active: activeTab === 'trainings' }" @click="activeTab = 'trainings'">
              Тренировки
            </button>
          </li>
          <li class="nav-item">
            <button class="nav-link" :class="{ active: activeTab === 'judges' }" @click="activeTab = 'judges'">
              Судьи
            </button>
          </li>
        </ul>
      </div>
    </div>
    <div v-if="activeTab === 'stadiums'">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <div v-if="isLoading" class="text-center my-3">
        <div class="spinner-border" role="status"></div>
      </div>
      <div v-if="stadiums.length" class="card tile fade-in">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h2 class="h5 mb-0">Стадионы</h2>
          <button class="btn btn-brand" @click="openCreate">
            <i class="bi bi-plus-lg me-1"></i>Добавить
          </button>
        </div>
        <div class="card-body p-3">
          <div class="table-responsive">
            <table class="table admin-table table-striped align-middle mb-0">
          <thead>
          <tr>
            <th>Название</th>
            <th>Адрес</th>
            <th class="text-center">Вместимость</th>
            <th>Телефон</th>
            <th class="d-none d-md-table-cell">Сайт</th>
            <th class="d-none d-lg-table-cell">Парковка</th>
            <th></th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="st in stadiums" :key="st.id">
            <td>{{ st.name }}</td>
            <td>{{ st.address?.result }}</td>
            <td class="text-center">{{ st.capacity }}</td>
            <td>{{ formatPhone(st.phone) }}</td>
            <td class="d-none d-md-table-cell">
              <a v-if="st.website" :href="st.website" target="_blank">{{ st.website }}</a>
            </td>
            <td class="d-none d-lg-table-cell">
              <div v-if="st.parking?.length">
                <span v-for="p in st.parking" :key="p.type" class="d-block">
                  {{ p.type_name }}<span v-if="p.price"> — {{ p.price }} ₽</span>
                </span>
              </div>
              <span v-else class="text-muted">Нет</span>
            </td>
            <td class="text-end">
              <button class="btn btn-sm btn-secondary me-2" @click="openEdit(st)">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-danger" @click="removeStadium(st)">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
          </tbody>
            </table>
          </div>
        </div>
      </div>
      <nav class="mt-3" v-if="totalPages > 1">
        <ul class="pagination justify-content-center">
          <li class="page-item" :class="{ disabled: currentPage === 1 }">
            <button class="page-link" @click="currentPage--" :disabled="currentPage === 1">Пред</button>
          </li>
          <li class="page-item" v-for="p in totalPages" :key="p" :class="{ active: currentPage === p }">
            <button class="page-link" @click="currentPage = p">{{ p }}</button>
          </li>
          <li class="page-item" :class="{ disabled: currentPage === totalPages }">
            <button class="page-link" @click="currentPage++" :disabled="currentPage === totalPages">След</button>
          </li>
        </ul>
      </nav>
    </div>

  </div>

  <div v-if="activeTab === 'types'">
    <div v-if="typesError" class="alert alert-danger">{{ typesError }}</div>
    <div v-if="typesLoading" class="text-center my-3">
      <div class="spinner-border" role="status"></div>
    </div>
    <div v-if="trainingTypes.length" class="card tile fade-in">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h2 class="h5 mb-0">Типы тренировок</h2>
        <button class="btn btn-brand" @click="openCreateType">
          <i class="bi bi-plus-lg me-1"></i>Добавить
        </button>
      </div>
      <div class="card-body p-3">
        <div class="table-responsive">
          <table class="table admin-table table-striped align-middle mb-0">
        <thead>
        <tr>
          <th>Название</th>
          <th class="text-center">Емкость</th>
          <th></th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="t in trainingTypes" :key="t.id">
          <td>{{ t.name }}</td>
          <td class="text-center">{{ t.default_capacity }}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-secondary" @click="openEditType(t)">
              <i class="bi bi-pencil"></i>
            </button>
          </td>
        </tr>
        </tbody>
          </table>
        </div>
        </div>
      </div>
    <nav class="mt-3" v-if="typesTotalPages > 1">
      <ul class="pagination justify-content-center">
        <li class="page-item" :class="{ disabled: typesPage === 1 }">
          <button class="page-link" @click="typesPage--" :disabled="typesPage === 1">Пред</button>
        </li>
        <li class="page-item" v-for="p in typesTotalPages" :key="p" :class="{ active: typesPage === p }">
          <button class="page-link" @click="typesPage = p">{{ p }}</button>
        </li>
        <li class="page-item" :class="{ disabled: typesPage === typesTotalPages }">
          <button class="page-link" @click="typesPage++" :disabled="typesPage === typesTotalPages">След</button>
        </li>
      </ul>
    </nav>

    <div ref="typeModalRef" class="modal fade" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <form @submit.prevent="saveType">
            <div class="modal-header">
              <h5 class="modal-title">{{ typeEditing ? 'Изменить тип' : 'Добавить тип' }}</h5>
              <button type="button" class="btn-close" @click="typeModal.hide()"></button>
            </div>
            <div class="modal-body">
              <div v-if="typeFormError" class="alert alert-danger">{{ typeFormError }}</div>
              <div class="form-floating mb-3">
                <input
                  id="ttName"
                  v-model="typeForm.name"
                  class="form-control"
                  placeholder="Название"
                  required
                  :disabled="!!typeEditing"
                />
                <label for="ttName">Наименование</label>
              </div>
              <div class="form-floating mb-3">
                <input id="ttCap" v-model="typeForm.default_capacity" type="number" min="0" class="form-control" placeholder="Емкость" />
                <label for="ttCap">Стандартная емкость группы</label>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="typeModal.hide()">Отмена</button>
              <button type="submit" class="btn btn-brand">Сохранить</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>

  <div v-if="activeTab === 'trainings'">
    <div v-if="trainingsError" class="alert alert-danger">{{ trainingsError }}</div>
    <div v-if="trainingsLoading" class="text-center my-3">
      <div class="spinner-border" role="status"></div>
    </div>
    <div v-if="trainings.length" class="card tile fade-in">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h2 class="h5 mb-0">Тренировки</h2>
        <button class="btn btn-brand" @click="openCreateTraining">
          <i class="bi bi-plus-lg me-1"></i>Добавить
        </button>
      </div>
      <div class="card-body p-3">
        <div class="table-responsive">
          <table class="table admin-table table-striped align-middle mb-0">
        <thead>
        <tr>
          <th>Тип</th>
          <th>Стадион</th>
          <th>Дата и время</th>
          <th class="text-center">Вместимость</th>
          <th v-for="g in refereeGroups" :key="g.id" class="text-center">{{ g.name }}</th>
          <th></th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="t in trainings" :key="t.id">
          <td>{{ t.type?.name }}</td>
          <td>{{ t.stadium?.name }}</td>
          <td>{{ formatDateTimeRange(t.start_at, t.end_at) }}</td>
          <td class="text-center">{{ t.capacity }}</td>
          <td v-for="g in refereeGroups" :key="g.id" class="text-center">
            <i
              v-if="t.groups?.some(gr => gr.id === g.id)"
              class="bi bi-check-lg text-success"
              aria-label="\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u043e"
            ></i>
            <i
              v-else
              class="bi bi-dash-lg text-muted"
              aria-label="\u041d\u0435 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e"
            ></i>
          </td>
          <td class="text-end">
            <button class="btn btn-sm btn-primary me-2" @click="openRegistrations(t)">
              <i class="bi bi-people"></i>
            </button>
            <button class="btn btn-sm btn-secondary me-2" @click="openEditTraining(t)">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-danger" @click="removeTraining(t)">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
        </tbody>
          </table>
        </div>
        </div>
      </div>
    <nav class="mt-3" v-if="Math.ceil(trainingsTotal / pageSize) > 1">
      <ul class="pagination justify-content-center">
        <li class="page-item" :class="{ disabled: trainingsPage === 1 }">
          <button class="page-link" @click="trainingsPage--" :disabled="trainingsPage === 1">Пред</button>
        </li>
        <li class="page-item" v-for="p in Math.max(1, Math.ceil(trainingsTotal / pageSize))" :key="p" :class="{ active: trainingsPage === p }">
          <button class="page-link" @click="trainingsPage = p">{{ p }}</button>
        </li>
        <li class="page-item" :class="{ disabled: trainingsPage === Math.max(1, Math.ceil(trainingsTotal / pageSize)) }">
          <button class="page-link" @click="trainingsPage++" :disabled="trainingsPage === Math.max(1, Math.ceil(trainingsTotal / pageSize))">След</button>
        </li>
      </ul>
    </nav>

    <div ref="trainingModalRef" class="modal fade" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <form @submit.prevent="saveTraining">
            <div class="modal-header">
              <h5 class="modal-title">{{ trainingEditing ? 'Изменить тренировку' : 'Добавить тренировку' }}</h5>
              <button type="button" class="btn-close" @click="trainingModal.hide()"></button>
            </div>
            <div class="modal-body">
              <div v-if="trainingFormError" class="alert alert-danger">{{ trainingFormError }}</div>
              <div class="mb-3">
                <label class="form-label">Тип</label>
                <select v-model="trainingForm.type_id" class="form-select" required>
                  <option value="" disabled>Выберите тип</option>
                  <option v-for="tt in trainingTypes" :key="tt.id" :value="tt.id">{{ tt.name }}</option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label">Стадион</label>
                <select v-model="trainingForm.camp_stadium_id" class="form-select" required>
                  <option value="" disabled>Выберите стадион</option>
                  <option v-for="s in stadiumOptions" :key="s.id" :value="s.id">{{ s.name }}</option>
                </select>
              </div>
              <div class="form-floating mb-3">
                <input id="trStart" v-model="trainingForm.start_at" type="datetime-local" class="form-control" required />
                <label for="trStart">Начало</label>
              </div>
              <div class="form-floating mb-3">
                <input id="trEnd" v-model="trainingForm.end_at" type="datetime-local" class="form-control" required />
                <label for="trEnd">Окончание</label>
              </div>
              <div class="form-floating mb-3">
                <input id="trCap" v-model="trainingForm.capacity" type="number" min="0" class="form-control" />
                <label for="trCap">Вместимость</label>
              </div>
              <div class="mb-3">
                <label class="form-label d-block">Группы судей</label>
                <div v-for="g in refereeGroups" :key="g.id" class="form-check">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    :id="`trg-${g.id}`"
                    :value="g.id"
                    v-model="trainingForm.groups"
                  />
                  <label class="form-check-label" :for="`trg-${g.id}`">{{ g.name }}</label>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="trainingModal.hide()">Отмена</button>
              <button type="submit" class="btn btn-brand">Сохранить</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>

  <div ref="registrationModalRef" class="modal fade" tabindex="-1">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Участники</h5>
          <button type="button" class="btn-close" @click="registrationModal.hide()"></button>
        </div>
      <div class="modal-body">
        <div v-if="registrationError" class="alert alert-danger">{{ registrationError }}</div>
        <div v-if="registrationLoading" class="text-center my-3">
          <div class="spinner-border" role="status"></div>
        </div>
        <div class="row g-2 align-items-end mb-3">
          <div class="col">
            <label class="form-label">Судья</label>
            <select v-model="addForm.user_id" class="form-select">
              <option value="" disabled>Выберите судью</option>
              <option v-for="j in judges" :key="j.user.id" :value="j.user.id">
                {{ j.user.last_name }} {{ j.user.first_name }} {{ j.user.patronymic }}
              </option>
            </select>
          </div>
          <div class="col">
            <label class="form-label">Роль</label>
            <select v-model="addForm.training_role_id" class="form-select">
              <option value="" disabled>Выберите роль</option>
              <option v-for="r in trainingRoles" :key="r.id" :value="r.id">
                {{ r.name }}
              </option>
            </select>
          </div>
          <div class="col-auto">
            <button class="btn btn-brand" @click="addRegistration" :disabled="addLoading">
              Добавить
            </button>
          </div>
        </div>
        <div v-if="registrationList.length" class="table-responsive">
          <table class="table admin-table table-striped align-middle mb-0">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Роль</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in registrationList" :key="r.user.id">
                <td>{{ r.user.last_name }} {{ r.user.first_name }} {{ r.user.patronymic }}</td>
                <td>{{ r.role?.name }}</td>
                <td class="text-end">
                  <button class="btn btn-sm btn-danger" @click="removeRegistration(r.user.id)">Удалить</button>
                </td>
              </tr>
            </tbody>
            </table>
          </div>
          <p v-else-if="!registrationLoading" class="text-muted mb-0">Нет записей.</p>
        </div>
        <div class="modal-footer" v-if="registrationsTotalPages > 1">
          <ul class="pagination pagination-sm mb-0">
            <li class="page-item" :class="{ disabled: registrationPage === 1 }">
              <button class="page-link" @click="registrationPage--" :disabled="registrationPage === 1">Пред</button>
            </li>
            <li
              class="page-item"
              v-for="p in registrationsTotalPages"
              :key="p"
              :class="{ active: registrationPage === p }"
            >
              <button class="page-link" @click="registrationPage = p">{{ p }}</button>
            </li>
            <li
              class="page-item"
              :class="{ disabled: registrationPage === registrationsTotalPages }"
            >
              <button
                class="page-link"
                @click="registrationPage++"
                :disabled="registrationPage === registrationsTotalPages"
              >
                След
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  <div v-if="activeTab === 'judges'" class="mb-4">
    <RefereeGroupAssignments ref="assignmentsRef" />
  </div>

  <div ref="modalRef" class="modal fade" tabindex="-1">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <form @submit.prevent="save">
          <div class="modal-header">
            <h5 class="modal-title">{{ editing ? 'Изменить стадион' : 'Добавить стадион' }}</h5>
            <button type="button" class="btn-close" @click="modal.hide()"></button>
          </div>
          <div class="modal-body">
            <div v-if="formError" class="alert alert-danger">{{ formError }}</div>
            <div class="form-floating mb-3">
              <input id="stadName" v-model="form.name" class="form-control" placeholder="Название" required />
              <label for="stadName">Наименование</label>
            </div>
            <div class="form-floating mb-3 position-relative">
              <textarea id="stadAddr" v-model="form.address.result" @blur="onAddressBlur" class="form-control" rows="2" placeholder="Адрес"></textarea>
              <label for="stadAddr">Адрес</label>
              <ul v-if="addressSuggestions.length" class="list-group position-absolute w-100" style="z-index: 1050">
                <li v-for="s in addressSuggestions" :key="s.value" class="list-group-item list-group-item-action" @mousedown.prevent="applyAddressSuggestion(s)">
                  {{ s.value }}
                </li>
              </ul>
            </div>
            <div class="form-floating mb-3">
              <input id="stadYandex" v-model="form.yandex_url" class="form-control" placeholder="URL в Яндекс.Картах" />
              <label for="stadYandex">URL в Яндекс.Картах</label>
            </div>
            <div class="form-floating mb-3">
              <input id="stadCapacity" v-model="form.capacity" type="number" class="form-control" placeholder="Вместимость" />
              <label for="stadCapacity">Вместимость</label>
            </div>
            <div class="form-floating mb-3">
              <input
                  id="stadPhone"
                  type="tel"
                  v-model="phoneInput"
                  @input="onPhoneInput"
                  @keydown="onPhoneKeydown"
                  class="form-control"
                  placeholder="+7 (___) ___-__-__"
              />
              <label for="stadPhone">Телефон</label>
            </div>
            <div class="form-floating mb-3">
              <input id="stadWebsite" v-model="form.website" class="form-control" placeholder="Сайт" />
              <label for="stadWebsite">Сайт</label>
            </div>
            <div class="mb-3" v-if="parkingTypes.length">
              <h6 class="mb-2">Парковка</h6>
              <div v-for="(p, idx) in form.parking" :key="p.type" class="row g-2 align-items-center mb-2">
                <div class="col-auto">
                  <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" v-model="p.enabled" :id="`p-${idx}`" />
                    <label class="form-check-label" :for="`p-${idx}`">{{ parkingTypes[idx].name }}</label>
                  </div>
                </div>
                <div class="col" v-if="p.enabled">
                  <input v-model="p.price" type="number" min="0" step="0.01" class="form-control" placeholder="Цена" />
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="modal.hide()">Отмена</button>
            <button type="submit" class="btn btn-brand">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.list-group {
  max-height: 200px;
  overflow-y: auto;
}
</style>