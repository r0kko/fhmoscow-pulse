<script setup>
import { ref, reactive, watch } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';
import { formatMinutesSeconds } from '../utils/time.js';

const props = defineProps({
  trainingId: { type: String, required: true },
  seasonId: { type: String, required: true },
  user: { type: Object, required: true },
});
const emit = defineEmits(['changed']);

const modalRef = ref(null);
let modal;

const results = ref([]);
const types = ref([]);
const units = ref([]);
const loading = ref(false);
const error = ref('');
const editing = ref(null);
const form = reactive({ type_id: '', value: '' });
const minutes = ref('');
const seconds = ref('');
const unit = ref(null);
const saving = ref(false);
const formError = ref('');

watch(
  () => form.type_id,
  (val) => {
    const t = types.value.find((x) => x.id === val);
    if (t) {
      unit.value = units.value.find((u) => u.id === t.unit_id) || null;
    } else {
      unit.value = null;
    }
    if (!editing.value || editing.value.type_id !== val) {
      minutes.value = '';
      seconds.value = '';
    }
  }
);

function formatValue(r) {
  const u = units.value.find((x) => x.id === r.unit_id);
  if (u?.alias === 'MIN_SEC') return formatMinutesSeconds(r.value);
  if (u?.alias === 'SECONDS') return Number(r.value).toFixed(2);
  return r.value;
}

async function load() {
  loading.value = true;
  try {
    const [resData, typeData, unitData] = await Promise.all([
      apiFetch(
        `/normative-results?training_id=${props.trainingId}&user_id=${props.user.id}&limit=100`
      ),
      apiFetch(`/normative-types?season_id=${props.seasonId}&limit=100`),
      apiFetch('/measurement-units'),
    ]);
    results.value = resData.results;
    types.value = typeData.types;
    units.value = unitData.units;
    error.value = '';
  } catch (e) {
    error.value = e.message;
    results.value = [];
  } finally {
    loading.value = false;
  }
}

function open() {
  editing.value = null;
  form.type_id = '';
  form.value = '';
  minutes.value = '';
  seconds.value = '';
  formError.value = '';
  if (!modal) modal = new Modal(modalRef.value);
  load();
  modal.show();
}

defineExpose({ open });

function startEdit(r) {
  editing.value = r;
  form.type_id = r.type_id;
  const u = units.value.find((x) => x.id === r.unit_id);
  unit.value = u || null;
  if (u?.alias === 'MIN_SEC') {
    minutes.value = Math.floor(r.value / 60);
    seconds.value = Math.round(r.value % 60);
    form.value = '';
  } else if (u?.alias === 'SECONDS') {
    form.value = Number(r.value).toFixed(2);
  } else {
    form.value = r.value;
  }
  formError.value = '';
}

function startCreate() {
  editing.value = null;
  form.type_id = '';
  form.value = '';
  minutes.value = '';
  seconds.value = '';
  formError.value = '';
}

async function save() {
  if (!form.type_id) {
    formError.value = 'Выберите тип';
    return;
  }
  let val;
  if (unit.value?.alias === 'MIN_SEC') {
    const m = parseInt(minutes.value || '0', 10);
    const s = parseInt(seconds.value || '0', 10);
    if (Number.isNaN(m) || Number.isNaN(s) || s < 0 || s > 59) {
      formError.value = 'Неверное значение';
      return;
    }
    val = `${m}:${String(s).padStart(2, '0')}`;
  } else {
    val = parseFloat(form.value);
    if (Number.isNaN(val)) {
      formError.value = 'Неверное значение';
      return;
    }
    if (unit.value?.alias === 'SECONDS') val = Math.round(val * 100) / 100;
    else if (!unit.value?.fractional) val = Math.round(val);
  }
  const payload = {
    user_id: props.user.id,
    season_id: props.seasonId,
    training_id: props.trainingId,
    type_id: form.type_id,
    value: val,
  };
  try {
    saving.value = true;
    if (editing.value) {
      await apiFetch(`/normative-results/${editing.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/normative-results', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    await load();
    emit('changed');
    startCreate();
  } catch (e) {
    formError.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function removeResult(r) {
  if (!confirm('Удалить запись?')) return;
  try {
    await apiFetch(`/normative-results/${r.id}`, { method: 'DELETE' });
    await load();
    emit('changed');
  } catch (e) {
    alert(e.message);
  }
}
</script>

<template>
  <div ref="modalRef" class="modal fade" tabindex="-1">
    <div class="modal-dialog modal-lg modal-dialog-scrollable modal-fullscreen-sm-down">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            Нормативы {{ props.user.last_name }} {{ props.user.first_name }}
          </h5>
          <button type="button" class="btn-close" @click="modal.hide()" />
        </div>
        <div class="modal-body">
          <div v-if="error" class="alert alert-danger">{{ error }}</div>
          <div v-if="loading" class="text-center my-3">
            <div class="spinner-border" role="status"></div>
          </div>
          <table v-if="results.length" class="table table-sm align-middle mb-3">
            <thead>
              <tr>
                <th>Тип</th>
                <th>Значение</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in results" :key="r.id">
                <td>
                  {{ types.find((t) => t.id === r.type_id)?.name || r.type_id }}
                </td>
                <td>{{ formatValue(r) }}</td>
                <td class="text-end">
                  <button
                    class="btn btn-sm btn-secondary me-2"
                    @click="startEdit(r)"
                  >
                    <i class="bi bi-pencil" />
                  </button>
                  <button
                    class="btn btn-sm btn-danger"
                    @click="removeResult(r)"
                  >
                    <i class="bi bi-trash" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="mb-3">
            <select v-model="form.type_id" class="form-select">
              <option value="" disabled>Тип норматива</option>
              <option v-for="t in types" :key="t.id" :value="t.id">
                {{ t.name }}
              </option>
            </select>
          </div>
          <div v-if="unit?.alias === 'MIN_SEC'" class="row g-2 mb-3">
            <div class="col">
              <input
                type="number"
                class="form-control"
                v-model.number="minutes"
                min="0"
                placeholder="Минуты"
              />
            </div>
            <div class="col">
              <input
                type="number"
                class="form-control"
                v-model.number="seconds"
                min="0"
                max="59"
                placeholder="Секунды"
              />
            </div>
          </div>
          <div v-else class="mb-3">
            <input
              type="number"
              class="form-control"
              v-model="form.value"
              :step="
                unit?.alias === 'SECONDS' && unit.fractional ? '0.01' : '1'
              "
              placeholder="Значение"
            />
          </div>
          <div v-if="formError" class="text-danger small mb-2">
            {{ formError }}
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            @click="startCreate()"
          >
            Очистить
          </button>
          <button
            type="button"
            class="btn btn-primary"
            @click="save"
            :disabled="saving"
          >
            <span
              v-if="saving"
              class="spinner-border spinner-border-sm me-2"
            ></span>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media (max-width: 575.98px) {
  .modal-content {
    height: 100vh;
  }
}
</style>
