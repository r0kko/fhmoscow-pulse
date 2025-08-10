<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import Pagination from './Pagination.vue';
import { apiFetch } from '../api.js';
import { formatMinutesSeconds } from '../utils/time.js';

const types = ref([]);
const total = ref(0);
const seasons = ref([]);
const units = ref([]);
const valueTypes = ref([]);
const sexes = ref([]);
const groupsDict = ref([]);
const zonesDict = ref([]);
const currentPage = ref(1);
const pageSize = ref(
  parseInt(localStorage.getItem('normativeTypesPageSize') || '15', 10)
);
const isLoading = ref(false);
const error = ref('');
const saving = ref(false);

const currentValueType = computed(
  () => valueTypes.value.find((v) => v.id === form.value.value_type_id) || null
);
const filteredZones = computed(() =>
  zonesDict.value.filter((z) => ['GREEN', 'YELLOW'].includes(z.alias))
);
const isMoreBetter = computed(
  () => currentValueType.value?.alias === 'MORE_BETTER'
);

const form = ref({
  season_id: '',
  name: '',
  required: false,
  value_type_id: '',
  unit_id: '',
  group_id: '',
  zones: [],
});
const editing = ref(null);
const modalRef = ref(null);
let modal;
const formError = ref('');

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize.value))
);

onMounted(async () => {
  modal = new Modal(modalRef.value);
  await loadDictionaries();
  await load();
});

watch(
  () => form.value.season_id,
  async (val) => {
    if (!val) {
      groupsDict.value = [];
      zonesDict.value = [];
      return;
    }
    try {
      const [groupData, zoneData] = await Promise.all([
        apiFetch(`/normative-groups?season_id=${val}&page=1&limit=100`),
        apiFetch('/normative-zones'),
      ]);
      groupsDict.value = groupData.groups;
      zonesDict.value = zoneData.zones;
    } catch (_e) {
      groupsDict.value = [];
      zonesDict.value = [];
    }
  }
);

watch(currentPage, load);

watch(pageSize, (val) => {
  localStorage.setItem('normativeTypesPageSize', val);
  currentPage.value = 1;
  load();
});

watch([zonesDict, sexes], () => {
  const allowedIds = filteredZones.value.map((z) => z.id);
  form.value.zones = form.value.zones.filter(
    (z) =>
      allowedIds.includes(z.zone_id) &&
      sexes.value.some((s) => s.id === z.sex_id)
  );
});

const currentUnit = computed(
  () => units.value.find((u) => u.id === form.value.unit_id) || null
);

async function load() {
  try {
    isLoading.value = true;
    const params = new URLSearchParams({
      page: currentPage.value,
      limit: pageSize.value,
    });
    const data = await apiFetch(`/normative-types?${params}`);
    types.value = data.types;
    total.value = data.total;
    const pages = Math.max(1, Math.ceil(total.value / pageSize.value));
    if (currentPage.value > pages) {
      currentPage.value = pages;
    }
    error.value = '';
  } catch (e) {
    error.value = e.message;
    types.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function loadDictionaries() {
  try {
    const [seasonData, unitData, valueData, sexData] = await Promise.all([
      apiFetch('/camp-seasons?page=1&limit=100'),
      apiFetch('/measurement-units'),
      apiFetch('/normative-value-types'),
      apiFetch('/sexes'),
    ]);
    seasons.value = seasonData.seasons;
    units.value = unitData.units;
    valueTypes.value = valueData.valueTypes;
    sexes.value = sexData.sexes;
  } catch (_) {
    seasons.value = [];
    units.value = [];
    valueTypes.value = [];
    sexes.value = [];
  }
}

function openCreate() {
  editing.value = null;
  form.value = {
    season_id: '',
    name: '',
    required: false,
    value_type_id: '',
    unit_id: '',
    group_id: '',
    zones: [],
  };
  formError.value = '';
  modal.show();
}

function validateForm() {
  if (!form.value.group_id) {
    formError.value = 'Выберите группу нормативов';
    return false;
  }
  const unit = currentUnit.value;
  for (const z of filteredZones.value) {
    for (const s of sexes.value) {
      const zone = getZone(z.id, s.id);
      const val = isMoreBetter.value ? zone.min_value : zone.max_value;
      if (val == null || val === '') {
        formError.value = 'Заполните все значения зон';
        return false;
      }
      if (unit?.alias === 'MIN_SEC') {
        if (!/^\d{1,2}:\d{2}$/.test(String(val))) {
          formError.value = 'Неверный формат времени';
          return false;
        }
      } else if (isNaN(parseFloat(String(val).replace(',', '.')))) {
        formError.value = 'Неверное числовое значение';
        return false;
      }
    }
  }
  return true;
}

function openEdit(t) {
  editing.value = t;
  const unit = units.value.find((u) => u.id === t.unit_id);
  form.value = {
    season_id: t.season_id,
    name: t.name,
    required: t.required,
    value_type_id: t.value_type_id,
    unit_id: t.unit_id,
    group_id: t.groups?.[0]?.group_id || '',
    zones: (t.zones || []).map((z) => {
      const res = { ...z };
      if (unit?.alias === 'MIN_SEC') {
        if (res.min_value != null)
          res.min_value = formatMinutesSeconds(res.min_value);
        if (res.max_value != null)
          res.max_value = formatMinutesSeconds(res.max_value);
      }
      return res;
    }),
  };
  formError.value = '';
  modal.show();
}

async function save() {
  if (!validateForm()) return;
  const payload = { ...form.value };
  payload.required = !!payload.required;
  payload.groups = form.value.group_id
    ? [
        {
          group_id: form.value.group_id,
          required: false,
        },
      ]
    : [];
  delete payload.group_id;
  const allowedIds = filteredZones.value.map((z) => z.id);
  payload.zones = payload.zones
    .filter((z) => allowedIds.includes(z.zone_id))
    .map((z) => ({
      zone_id: z.zone_id,
      sex_id: z.sex_id,
      min_value: isMoreBetter.value ? z.min_value : null,
      max_value: isMoreBetter.value ? null : z.max_value,
    }));
  try {
    saving.value = true;
    if (editing.value) {
      await apiFetch(`/normative-types/${editing.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/normative-types', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    modal.hide();
    await load();
  } catch (e) {
    formError.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function removeType(t) {
  if (!confirm('Удалить запись?')) return;
  try {
    await apiFetch(`/normative-types/${t.id}`, { method: 'DELETE' });
    await load();
  } catch (e) {
    alert(e.message);
  }
}

function getZone(zoneId, sexId) {
  let z = form.value.zones.find(
    (v) => v.zone_id === zoneId && v.sex_id === sexId
  );
  if (!z) {
    z = { zone_id: zoneId, sex_id: sexId, min_value: null, max_value: null };
    form.value.zones.push(z);
  }
  return z;
}

function onZoneInput(zoneId, sexId, val) {
  const zone = getZone(zoneId, sexId);
  if (isMoreBetter.value) {
    zone.min_value = val;
    zone.max_value = null;
  } else {
    zone.max_value = val;
    zone.min_value = null;
  }
}

const refresh = () => {
  load();
  loadDictionaries();
};

defineExpose({ refresh });
</script>

<template>
  <div class="mb-4">
    <div class="card section-card tile fade-in shadow-sm">
      <div
        class="card-header d-flex justify-content-between align-items-center"
      >
        <h2 class="h5 mb-0">Типы нормативов</h2>
        <button class="btn btn-brand" @click="openCreate">
          <i class="bi bi-plus-lg me-1"></i>Добавить
        </button>
      </div>
      <div class="card-body p-3">
        <div v-if="error" class="alert alert-danger mb-3">{{ error }}</div>
        <div v-if="isLoading" class="text-center my-3">
          <div class="spinner-border" role="status"></div>
        </div>
        <div v-if="types.length" class="table-responsive d-none d-sm-block">
          <table class="table admin-table table-striped align-middle mb-0">
            <thead>
              <tr>
                <th>Сезон</th>
                <th>Название</th>
                <th>Обязательный</th>
                <th class="d-none d-md-table-cell">Тип значения</th>
                <th class="d-none d-md-table-cell">Ед. изм.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in types" :key="t.id">
                <td>
                  {{
                    seasons.find((s) => s.id === t.season_id)?.name ||
                    t.season_id
                  }}
                </td>
                <td>{{ t.name }}</td>
                <td>{{ t.required ? 'Да' : 'Нет' }}</td>
                <td class="d-none d-md-table-cell">
                  {{
                    valueTypes.find((v) => v.id === t.value_type_id)?.name ||
                    t.value_type_id
                  }}
                </td>
                <td class="d-none d-md-table-cell">
                  {{ units.find((u) => u.id === t.unit_id)?.name || t.unit_id }}
                </td>
                <td class="text-end">
                  <button
                    class="btn btn-sm btn-secondary me-2"
                    aria-label="Редактировать тип"
                    @click="openEdit(t)"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button
                    class="btn btn-sm btn-danger"
                    aria-label="Удалить тип"
                    @click="removeType(t)"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="types.length" class="d-block d-sm-none">
          <div v-for="t in types" :key="t.id" class="card training-card mb-2">
            <div class="card-body p-2 d-flex justify-content-between">
              <div>
                <h6 class="mb-1">{{ t.name }}</h6>
                <p class="mb-1">
                  {{
                    seasons.find((s) => s.id === t.season_id)?.name ||
                    t.season_id
                  }}
                </p>
                <p class="mb-1">
                  Обязательный: {{ t.required ? 'Да' : 'Нет' }}
                </p>
              </div>
              <div>
                <button
                  class="btn btn-sm btn-secondary me-2"
                  aria-label="Редактировать тип"
                  @click="openEdit(t)"
                >
                  <i class="bi bi-pencil"></i>
                </button>
                <button
                  class="btn btn-sm btn-danger"
                  aria-label="Удалить тип"
                  @click="removeType(t)"
                >
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
        <p v-else-if="!isLoading" class="text-muted mb-0">Записей нет.</p>
      </div>
    </div>
    <nav
      v-if="types.length"
      class="mt-3 d-flex align-items-center justify-content-between"
    >
      <select
        v-model.number="pageSize"
        class="form-select form-select-sm w-auto"
      >
        <option :value="15">15</option>
        <option :value="30">30</option>
        <option :value="50">50</option>
      </select>
      <Pagination v-model="currentPage" :total-pages="totalPages" />
    </nav>
    <div ref="modalRef" class="modal fade" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <form @submit.prevent="save">
            <div class="modal-header">
              <h2 class="modal-title h5">
                {{ editing ? 'Изменить тип' : 'Добавить тип' }}
              </h2>
              <button
                type="button"
                class="btn-close"
                aria-label="Закрыть"
                @click="modal.hide()"
              ></button>
            </div>
            <div class="modal-body">
              <div v-if="formError" class="alert alert-danger">
                {{ formError }}
              </div>
              <div class="form-floating mb-3">
                <select
                  id="typeSeason"
                  v-model="form.season_id"
                  class="form-select"
                  required
                >
                  <option value="" disabled>Выберите сезон</option>
                  <option v-for="s in seasons" :key="s.id" :value="s.id">
                    {{ s.name }}
                  </option>
                </select>
                <label for="typeSeason">Сезон</label>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="typeName"
                  v-model="form.name"
                  class="form-control"
                  placeholder="Название"
                  required
                />
                <label for="typeName">Наименование</label>
              </div>
              <div class="form-check mb-3">
                <input
                  id="typeReq"
                  v-model="form.required"
                  type="checkbox"
                  class="form-check-input"
                />
                <label for="typeReq" class="form-check-label"
                  >Обязательный</label
                >
              </div>
              <div class="form-floating mb-3">
                <select
                  id="typeValue"
                  v-model="form.value_type_id"
                  class="form-select"
                  required
                >
                  <option value="" disabled>Тип значения</option>
                  <option v-for="v in valueTypes" :key="v.id" :value="v.id">
                    {{ v.name }}
                  </option>
                </select>
                <label for="typeValue">Тип значения</label>
              </div>
              <div class="form-floating mb-3">
                <select
                  id="typeUnit"
                  v-model="form.unit_id"
                  class="form-select"
                  required
                >
                  <option value="" disabled>Единица измерения</option>
                  <option v-for="u in units" :key="u.id" :value="u.id">
                    {{ u.name }}
                  </option>
                </select>
                <label for="typeUnit">Ед. измерения</label>
              </div>
              <div class="mb-3">
                <label for="typeGroup" class="form-label">Группа</label>
                <select
                  id="typeGroup"
                  v-model="form.group_id"
                  class="form-select"
                  required
                >
                  <option value="" disabled>Выберите группу</option>
                  <option v-for="g in groupsDict" :key="g.id" :value="g.id">
                    {{ g.name }}
                  </option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label">Зоны</label>
                <div
                  v-if="filteredZones.length && sexes.length"
                  class="table-responsive"
                >
                  <table class="table table-sm align-middle">
                    <thead>
                      <tr>
                        <th>Зона</th>
                        <th v-for="s in sexes" :key="s.id">{{ s.name }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="z in filteredZones" :key="z.id">
                        <td>{{ z.name }}</td>
                        <td v-for="s in sexes" :key="s.id">
                          <input
                            :type="
                              currentUnit?.alias === 'MIN_SEC'
                                ? 'text'
                                : 'number'
                            "
                            class="form-control form-control-sm"
                            :step="
                              currentUnit?.alias === 'SECONDS' &&
                              currentUnit.fractional
                                ? '0.01'
                                : '1'
                            "
                            :pattern="
                              currentUnit?.alias === 'MIN_SEC'
                                ? '\\d{1,2}:\\d{2}'
                                : null
                            "
                            :placeholder="isMoreBetter ? 'Мин' : 'Макс'"
                            :value="
                              isMoreBetter
                                ? getZone(z.id, s.id).min_value
                                : getZone(z.id, s.id).max_value
                            "
                            @input="
                              onZoneInput(z.id, s.id, $event.target.value)
                            "
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p v-else class="text-muted">Нет зон для сезона</p>
              </div>
            </div>
            <div class="modal-footer">
              <button
                type="button"
                class="btn btn-secondary"
                @click="modal.hide()"
              >
                Отмена
              </button>
              <button type="submit" class="btn btn-primary" :disabled="saving">
                <span
                  v-if="saving"
                  class="spinner-border spinner-border-sm me-2"
                ></span>
                Сохранить
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.training-card {
  border-radius: 0.5rem;
  border: 1px solid #dee2e6;
}

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
