<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';
import PageNav from '../components/PageNav.vue';
import RefereeGroupAssignments from '../components/RefereeGroupAssignments.vue';
import { toDateTimeLocal, fromDateTimeLocal } from '../utils/time.js';

import RefereeGroups from '../components/RefereeGroups.vue';

const route = useRoute();
const router = useRouter();
const activeTab = ref(route.query.tab || 'trainings');

/* training types */
const trainingTypes = ref([]);
const trainingTypesLoaded = ref(false);
const typesError = ref('');

/* trainings */
const trainings = ref([]);
const trainingsTotal = ref(0);
const trainingsPage = ref(1);
const trainingsPageSize = ref(
  parseInt(localStorage.getItem('adminCampsTrainingsPageSize') || '20', 10)
);
const trainingsLoading = ref(false);
const trainingsError = ref('');
const trainingsView = ref('upcoming');
const trainingsFilterGround = ref('');
const trainingsFilterGroup = ref('');
const groundOptions = ref([]);
const refereeGroups = ref([]);
const trainingForm = ref({
  type_id: '',
  ground_id: '',
  url: '',
  start_at: '',
  end_at: '',
  capacity: '',
});
const trainingEditing = ref(null);
const trainingModalRef = ref(null);
let trainingModal;
const trainingFilterModalRef = ref(null);
let trainingFilterModal;
const selectedTrainingType = computed(() =>
  trainingTypes.value.find((t) => t.id === trainingForm.value.type_id)
);
const trainingFormError = ref('');
const trainingSaveLoading = ref(false);
const assignmentsRef = ref(null);
const groupsRef = ref(null);
const trainingsTotalPages = computed(() =>
  Math.max(1, Math.ceil(trainingsTotal.value / trainingsPageSize.value))
);

onMounted(() => {
  loadTrainingTypes();
  loadTrainings();
  loadGroundOptions();
  loadRefereeGroups();
  if (activeTab.value === 'groups') groupsRef.value?.refresh();
});

onBeforeUnmount(() => {
  try {
    trainingModal?.hide?.();
    trainingModal?.dispose?.();
  } catch {}
  try {
    trainingFilterModal?.hide?.();
    trainingFilterModal?.dispose?.();
  } catch {}
});

watch(trainingsPage, () => {
  if (activeTab.value === 'trainings') loadTrainings();
});
watch([trainingsPageSize, trainingsFilterGround, trainingsFilterGroup], () => {
  trainingsPage.value = 1;
  if (activeTab.value === 'trainings') loadTrainings();
});
watch(trainingsPageSize, (val) => {
  localStorage.setItem('adminCampsTrainingsPageSize', String(val));
});
watch(trainingsView, () => {
  trainingsPage.value = 1;
  if (activeTab.value === 'trainings') loadTrainings();
});

watch(
  () => route.query.tab,
  (val) => {
    if (typeof val === 'string' && val !== activeTab.value) {
      activeTab.value = val;
    }
  }
);

watch(activeTab, (val) => {
  router.replace({ query: { ...route.query, tab: val } });
  if (val === 'trainings' && !trainings.value.length) {
    if (!trainingTypesLoaded.value) loadTrainingTypes();
    loadTrainings();
    if (!groundOptions.value.length) loadGroundOptions();
  } else if (val === 'judges') {
    assignmentsRef.value?.refresh();
  } else if (val === 'groups') {
    groupsRef.value?.refresh();
  }
});

watch(
  () => trainingForm.value.type_id,
  (val) => {
    const tt = trainingTypes.value.find((t) => t.id === val);
    if (
      tt &&
      tt.default_capacity &&
      (!trainingEditing.value || !trainingForm.value.capacity)
    ) {
      trainingForm.value.capacity = tt.default_capacity;
    }
    if (tt?.online) {
      trainingForm.value.ground_id = '';
    } else {
      trainingForm.value.url = '';
    }
  }
);

watch(
  () => trainingForm.value.start_at,
  (val) => {
    if (!val) return;
    const start = parseInput(val);
    const end = new Date(start.getTime() + 90 * 60000);
    if (!trainingEditing.value) {
      trainingForm.value.end_at = toInputValue(end.toISOString());
    }
  }
);

watch(
  [() => trainingForm.value.start_at, () => trainingForm.value.end_at],
  ([start, end]) => {
    if (start && end && parseInput(end) <= parseInput(start)) {
      trainingFormError.value = 'Время окончания должно быть позже начала';
    } else {
      trainingFormError.value = '';
    }
  }
);

async function loadTrainingTypes() {
  if (trainingTypesLoaded.value) return;
  try {
    const params = new URLSearchParams({ limit: 1000 });
    const data = await apiFetch(`/camp-training-types?${params}`);
    trainingTypes.value = data.types;
    trainingTypesLoaded.value = true;
  } catch (e) {
    typesError.value = e.message;
  }
}

async function loadTrainings() {
  try {
    trainingsLoading.value = true;
    const params = new URLSearchParams({
      page: trainingsPage.value,
      limit: trainingsPageSize.value,
    });
    if (trainingsFilterGround.value) {
      params.set('ground_id', trainingsFilterGround.value);
    }
    if (trainingsFilterGroup.value) {
      params.set('group_id', trainingsFilterGroup.value);
    }
    let url = '/camp-trainings';
    if (trainingsView.value === 'upcoming') {
      url += '/upcoming';
    } else if (trainingsView.value === 'past') {
      url += '/past';
    }
    const data = await apiFetch(`${url}?${params}`);
    trainings.value = data.trainings;
    trainingsTotal.value = data.total;
  } catch (e) {
    trainingsError.value = e.message;
  } finally {
    trainingsLoading.value = false;
  }
}

async function loadGroundOptions() {
  try {
    const params = new URLSearchParams({ page: 1, limit: 100 });
    const data = await apiFetch(`/grounds?${params}`);
    groundOptions.value = data.grounds;
  } catch (_) {
    groundOptions.value = [];
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
    trainingModal = new Modal(trainingModalRef.value);
  }
  trainingEditing.value = null;
  if (!groundOptions.value.length) loadGroundOptions();
  trainingForm.value = {
    type_id: '',
    ground_id: '',
    url: '',
    start_at: '',
    end_at: '',
    capacity: '',
  };
  trainingFormError.value = '';
  trainingModal.show();
}

function openTrainingFilters() {
  if (!trainingFilterModal) {
    trainingFilterModal = new Modal(trainingFilterModalRef.value);
  }
  if (!groundOptions.value.length) loadGroundOptions();
  if (!refereeGroups.value.length) loadRefereeGroups();
  trainingFilterModal.show();
}

function toInputValue(str) {
  return toDateTimeLocal(str);
}

function parseInput(val) {
  return new Date(fromDateTimeLocal(val));
}

function formatDateTimeRange(start, end) {
  if (!start) return '';
  const startDate = new Date(start);
  const endDate = new Date(end);
  const dateStr = startDate.toLocaleDateString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const startTime = startDate.toLocaleTimeString('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTime = endDate.toLocaleTimeString('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dateStr} ${startTime} - ${endTime}`;
}

function shortGroupName(name) {
  if (!name) return '';
  return name
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase();
}

function shortName(u) {
  if (!u) return '';
  const initials = [u.first_name, u.patronymic]
    .filter(Boolean)
    .map((n) => n.charAt(0) + '.')
    .join(' ');
  return `${u.last_name} ${initials}`.trim();
}

function openEditTraining(t) {
  if (!trainingModal) {
    trainingModal = new Modal(trainingModalRef.value);
  }
  trainingEditing.value = t;
  trainingForm.value = {
    type_id: t.type?.id || '',
    ground_id: t.ground?.id || '',
    url: t.url || '',
    start_at: toInputValue(t.start_at),
    end_at: toInputValue(t.end_at),
    capacity: t.capacity || '',
  };
  trainingFormError.value = '';
  trainingModal.show();
}

async function saveTraining() {
  if (
    parseInput(trainingForm.value.end_at) <=
    parseInput(trainingForm.value.start_at)
  ) {
    trainingFormError.value = 'Время окончания должно быть позже начала';
    return;
  }
  const payload = {
    type_id: trainingForm.value.type_id,
    ...(selectedTrainingType.value?.online
      ? { url: trainingForm.value.url || undefined }
      : { ground_id: trainingForm.value.ground_id }),
    start_at: fromDateTimeLocal(trainingForm.value.start_at),
    end_at: fromDateTimeLocal(trainingForm.value.end_at),
    capacity: trainingForm.value.capacity || undefined,
  };
  try {
    trainingSaveLoading.value = true;
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
  } finally {
    trainingSaveLoading.value = false;
  }
}

async function removeTraining(t) {
  if (!confirm('Удалить запись?')) return;
  await apiFetch(`/camp-trainings/${t.id}`, { method: 'DELETE' });
  await loadTrainings();
}

async function toggleTrainingGroup(training, groupId, checked) {
  const currentIds = (training.groups || []).map((g) => g.id);
  const newIds = checked
    ? Array.from(new Set([...currentIds, groupId]))
    : currentIds.filter((id) => id !== groupId);
  try {
    await apiFetch(`/camp-trainings/${training.id}`, {
      method: 'PUT',
      body: JSON.stringify({ groups: newIds }),
    });
    training.groups = refereeGroups.value.filter((g) => newIds.includes(g.id));
  } catch (e) {
    alert(e.message);
  }
}
</script>

<template>
  <div class="py-3 admin-camps-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Сборы</li>
        </ol>
      </nav>
      <h1 class="mb-3">Сборы</h1>
      <div class="card section-card tile fade-in shadow-sm mb-3 ground-card">
        <div class="card-body p-2">
          <ul
            v-edge-fade
            class="nav nav-pills nav-fill justify-content-between mb-0 tab-selector"
            role="tablist"
          >
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: activeTab === 'trainings' }"
                role="tab"
                :aria-selected="activeTab === 'trainings'"
                @click="activeTab = 'trainings'"
              >
                Тренировки
              </button>
            </li>
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: activeTab === 'judges' }"
                role="tab"
                :aria-selected="activeTab === 'judges'"
                @click="activeTab = 'judges'"
              >
                Судьи
              </button>
            </li>
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: activeTab === 'groups' }"
                role="tab"
                :aria-selected="activeTab === 'groups'"
                @click="activeTab = 'groups'"
              >
                Группы
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div v-if="activeTab === 'trainings'">
        <div v-if="trainingsError" class="alert alert-danger">
          {{ trainingsError }}
        </div>
        <div v-if="trainingsLoading" class="text-center my-3">
          <div
            class="spinner-border spinner-brand"
            role="status"
            aria-label="Загрузка"
          ></div>
        </div>
        <div class="card section-card tile fade-in shadow-sm">
          <div
            class="card-header d-flex justify-content-between align-items-center"
          >
            <h2 class="h5 mb-0">Тренировки</h2>
            <div>
              <button
                class="btn btn-light me-2"
                title="Фильтры"
                aria-label="Фильтры"
                @click="openTrainingFilters"
              >
                <i class="bi bi-funnel"></i>
              </button>
              <button class="btn btn-brand" @click="openCreateTraining">
                <i class="bi bi-plus-lg me-1"></i>Добавить
              </button>
            </div>
          </div>
          <div class="card-body p-3">
            <ul
              v-edge-fade
              class="nav nav-pills nav-fill mb-3 tab-selector"
              role="tablist"
            >
              <li class="nav-item">
                <button
                  class="nav-link"
                  :class="{ active: trainingsView === 'upcoming' }"
                  role="tab"
                  :aria-selected="trainingsView === 'upcoming'"
                  @click="trainingsView = 'upcoming'"
                >
                  Ближайшие
                </button>
              </li>
              <li class="nav-item">
                <button
                  class="nav-link"
                  :class="{ active: trainingsView === 'past' }"
                  role="tab"
                  :aria-selected="trainingsView === 'past'"
                  @click="trainingsView = 'past'"
                >
                  Прошедшие
                </button>
              </li>
            </ul>
            <div
              v-if="trainings.length"
              class="table-responsive d-none d-sm-block"
            >
              <table class="table admin-table table-striped align-middle mb-0">
                <thead>
                  <tr>
                    <th>Тип</th>
                    <th class="d-none d-sm-table-cell">Площадка</th>
                    <th>Дата и время</th>
                    <th class="text-center">Участников</th>
                    <th class="d-none d-md-table-cell">Тренеры</th>
                    <th class="d-none d-md-table-cell">Инвентарь</th>
                    <th
                      v-for="g in refereeGroups"
                      :key="g.id"
                      class="text-center group-col"
                      :title="g.name"
                    >
                      {{ shortGroupName(g.name) }}
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="t in trainings" :key="t.id">
                    <td>{{ t.type?.name }}</td>
                    <td class="d-none d-sm-table-cell">{{ t.ground?.name }}</td>
                    <td>{{ formatDateTimeRange(t.start_at, t.end_at) }}</td>
                    <td class="text-center">
                      {{ t.registered_count }} / {{ t.capacity ?? '—' }}
                    </td>
                    <td class="d-none d-md-table-cell">
                      <span v-if="t.coaches?.length">
                        {{ t.coaches.map(shortName).join(', ') }}
                      </span>
                      <span v-else class="text-muted">—</span>
                    </td>
                    <td class="d-none d-md-table-cell">
                      <span v-if="t.equipment_managers?.length">
                        {{ t.equipment_managers.map(shortName).join(', ') }}
                      </span>
                      <span v-else class="text-muted">—</span>
                    </td>
                    <td
                      v-for="g in refereeGroups"
                      :key="g.id"
                      class="text-center group-col"
                      :title="g.name"
                    >
                      <input
                        type="checkbox"
                        class="form-check-input m-0"
                        :aria-label="`Группа: ${g.name}`"
                        :checked="t.groups?.some((gr) => gr.id === g.id)"
                        @change="
                          toggleTrainingGroup(t, g.id, $event.target.checked)
                        "
                      />
                    </td>
                    <td class="text-end">
                      <RouterLink
                        :to="`/admin/camp-trainings/${t.id}/registrations`"
                        class="btn btn-sm btn-primary me-2"
                        aria-label="Регистрации"
                      >
                        <i class="bi bi-people"></i>
                      </RouterLink>
                      <button
                        class="btn btn-sm btn-secondary me-2"
                        aria-label="Редактировать тренировку"
                        @click="openEditTraining(t)"
                      >
                        <i class="bi bi-pencil"></i>
                      </button>
                      <button
                        class="btn btn-sm btn-danger"
                        aria-label="Удалить тренировку"
                        @click="removeTraining(t)"
                      >
                        <i class="bi bi-trash"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="trainings.length" class="d-block d-sm-none">
              <div
                v-for="t in trainings"
                :key="t.id"
                class="card training-card mb-2"
              >
                <div class="card-body p-2">
                  <div class="d-flex justify-content-between">
                    <div>
                      <h6 class="mb-1">{{ t.type?.name }}</h6>
                      <p class="mb-1">{{ t.ground?.name }}</p>
                      <p class="mb-1">
                        {{ formatDateTimeRange(t.start_at, t.end_at) }}
                      </p>
                      <p class="mb-1">
                        {{ t.registered_count }} / {{ t.capacity ?? '—' }}
                      </p>
                      <p v-if="t.coaches?.length" class="mb-1">
                        Тренеры: {{ t.coaches.map(shortName).join(', ') }}
                      </p>
                      <p v-else class="mb-1">Тренеры: —</p>
                      <p v-if="t.equipment_managers?.length" class="mb-1">
                        Инвентарь:
                        {{ t.equipment_managers.map(shortName).join(', ') }}
                      </p>
                      <p v-else class="mb-1">Инвентарь: —</p>
                    </div>
                    <div class="text-end">
                      <RouterLink
                        :to="`/admin/camp-trainings/${t.id}/registrations`"
                        class="btn btn-sm btn-primary me-2"
                        aria-label="Регистрации"
                      >
                        <i class="bi bi-people"></i>
                      </RouterLink>
                      <button
                        class="btn btn-sm btn-secondary me-2"
                        aria-label="Редактировать тренировку"
                        @click="openEditTraining(t)"
                      >
                        <i class="bi bi-pencil"></i>
                      </button>
                      <button
                        class="btn btn-sm btn-danger"
                        aria-label="Удалить тренировку"
                        @click="removeTraining(t)"
                      >
                        <i class="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                  <div class="mt-2">
                    <div
                      v-for="g in refereeGroups"
                      :key="g.id"
                      class="form-check form-check-inline"
                    >
                      <input
                        :id="`tm-${t.id}-${g.id}`"
                        class="form-check-input"
                        type="checkbox"
                        :checked="t.groups?.some((gr) => gr.id === g.id)"
                        @change="
                          toggleTrainingGroup(t, g.id, $event.target.checked)
                        "
                      />
                      <label
                        class="form-check-label"
                        :for="`tm-${t.id}-${g.id}`"
                      >
                        {{ shortGroupName(g.name) }}
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="alert alert-info mb-0">Тренировок нет.</div>
          </div>
        </div>
        <PageNav
          v-if="trainings.length"
          v-model:page="trainingsPage"
          v-model:page-size="trainingsPageSize"
          :total-pages="trainingsTotalPages"
          :sizes="[20, 40, 100]"
        />

        <div ref="trainingFilterModalRef" class="modal fade" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Фильтры</h5>
                <button
                  type="button"
                  class="btn-close"
                  @click="trainingFilterModal.hide()"
                ></button>
              </div>
              <div class="modal-body">
                <div class="mb-3">
                  <label class="form-label">Площадка</label>
                  <select
                    v-model.number="trainingsFilterGround"
                    class="form-select"
                  >
                    <option value="">Все стадионы</option>
                    <option
                      v-for="s in groundOptions"
                      :key="s.id"
                      :value="s.id"
                    >
                      {{ s.name }}
                    </option>
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label">Группа</label>
                  <select
                    v-model.number="trainingsFilterGroup"
                    class="form-select"
                  >
                    <option value="">Все группы</option>
                    <option
                      v-for="g in refereeGroups"
                      :key="g.id"
                      :value="g.id"
                    >
                      {{ g.name }}
                    </option>
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label">На странице</label>
                  <select
                    v-model.number="trainingsPageSize"
                    class="form-select"
                  >
                    <option :value="20">20</option>
                    <option :value="40">40</option>
                    <option :value="100">100</option>
                  </select>
                </div>
              </div>
              <div class="modal-footer">
                <button
                  type="button"
                  class="btn btn-secondary"
                  @click="trainingFilterModal.hide()"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>

        <div ref="trainingModalRef" class="modal fade" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <form @submit.prevent="saveTraining">
                <div class="modal-header">
                  <h5 class="modal-title">
                    {{
                      trainingEditing
                        ? 'Изменить тренировку'
                        : 'Добавить тренировку'
                    }}
                  </h5>
                  <button
                    type="button"
                    class="btn-close"
                    @click="trainingModal.hide()"
                  ></button>
                </div>
                <div class="modal-body">
                  <div v-if="trainingFormError" class="alert alert-danger">
                    {{ trainingFormError }}
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Тип</label>
                    <select
                      v-model="trainingForm.type_id"
                      class="form-select"
                      required
                    >
                      <option value="" disabled>Выберите тип</option>
                      <option
                        v-for="tt in trainingTypes"
                        :key="tt.id"
                        :value="tt.id"
                      >
                        {{ tt.name }}
                      </option>
                    </select>
                  </div>
                  <div v-if="selectedTrainingType?.online" class="mb-3">
                    <label class="form-label">Ссылка</label>
                    <input
                      v-model="trainingForm.url"
                      type="url"
                      class="form-control"
                    />
                  </div>
                  <div v-else class="mb-3">
                    <label class="form-label">Площадка</label>
                    <select
                      v-model="trainingForm.ground_id"
                      class="form-select"
                      required
                    >
                      <option value="" disabled>Выберите стадион</option>
                      <option
                        v-for="s in groundOptions"
                        :key="s.id"
                        :value="s.id"
                      >
                        {{ s.name }}
                      </option>
                    </select>
                  </div>
                  <div class="form-floating mb-3">
                    <input
                      id="trStart"
                      v-model="trainingForm.start_at"
                      type="datetime-local"
                      class="form-control"
                      required
                    />
                    <label for="trStart">Начало</label>
                  </div>
                  <div class="form-floating mb-3">
                    <input
                      id="trEnd"
                      v-model="trainingForm.end_at"
                      type="datetime-local"
                      class="form-control"
                      required
                    />
                    <label for="trEnd">Окончание</label>
                  </div>
                  <div class="form-floating mb-3">
                    <input
                      id="trCap"
                      v-model="trainingForm.capacity"
                      type="number"
                      min="0"
                      class="form-control"
                    />
                    <label for="trCap">Вместимость</label>
                  </div>
                </div>
                <div class="modal-footer">
                  <button
                    type="button"
                    class="btn btn-secondary"
                    @click="trainingModal.hide()"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    class="btn btn-brand"
                    :disabled="trainingSaveLoading"
                  >
                    <span
                      v-if="trainingSaveLoading"
                      class="spinner-border spinner-border-sm spinner-brand me-2"
                    ></span>
                    Сохранить
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'judges'" class="mb-4">
        <RefereeGroupAssignments ref="assignmentsRef" />
      </div>

      <div v-if="activeTab === 'groups'" class="mb-4">
        <RefereeGroups ref="groupsRef" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.list-group {
  max-height: 200px;
  overflow-y: auto;
}

.group-col {
  width: 2.5rem;
  white-space: nowrap;
}

.ground-card {
  border-radius: 0.75rem;
  overflow: hidden;
  border: 0;
}

.tab-selector {
  gap: 0.5rem;
}

.tab-selector .nav-link {
  border-radius: 0.5rem;
}

.fade-in {
  animation: fadeIn 0.4s ease-out;
}

.section-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 0;
}

.training-card {
  border-radius: 0.5rem;
  border: 1px solid #dee2e6;
}

@media (max-width: 575.98px) {
  .admin-camps-page {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
  }

  .section-card {
    margin-left: -1rem;
    margin-right: -1rem;
  }

  .ground-card {
    margin-left: -1rem;
    margin-right: -1rem;
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
