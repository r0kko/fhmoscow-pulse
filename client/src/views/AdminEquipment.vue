<script setup>
import { ref, onMounted, watch, onBeforeUnmount, computed } from 'vue';
import { RouterLink } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';
import { useToast } from '../utils/toast.js';
import { loadPageSize, savePageSize } from '../utils/pageSize.js';
import PageNav from '../components/PageNav.vue';
import BrandSpinner from '../components/BrandSpinner.vue';

const items = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(loadPageSize('adminEquipmentPageSize', 10));
const isLoading = ref(false);
const error = ref('');

const types = ref([]);
const manufacturers = ref([]);
const sizes = ref([]);

// Filters
const filters = ref({
  type_id: '',
  manufacturer_id: '',
  size_id: '',
  status: '',
  number: '',
  orderBy: '',
  order: '',
});

const editing = ref(null);
const form = ref({ type_id: '', manufacturer_id: '', size_id: '', number: '' });
const formError = ref('');
const fieldErrors = ref({});
const modalRef = ref(null);
let modal;
const saveLoading = ref(false);
const { showToast } = useToast();

// Issue modal
const issueRef = ref(null);
let issueModal;
const issueLoading = ref(false);
const issueTarget = ref(null);
const userQuery = ref('');
const userOptions = ref([]);
const userSelected = ref('');
let userTimeout;
const issueError = ref('');

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize.value))
);

onMounted(async () => {
  modal = new Modal(modalRef.value);
  if (issueRef.value) issueModal = new Modal(issueRef.value);
  await loadDictionaries();
  // restore saved filters
  try {
    const saved = localStorage.getItem('adminEquipmentFilters');
    if (saved) Object.assign(filters.value, JSON.parse(saved));
  } catch {}
  await load();
});

onBeforeUnmount(() => {
  try {
    modal?.hide?.();
    modal?.dispose?.();
  } catch {}
  try {
    issueModal?.hide?.();
    issueModal?.dispose?.();
  } catch {}
});

watch(pageSize, async (val) => {
  currentPage.value = 1;
  savePageSize('adminEquipmentPageSize', val);
  await load();
});

watch(currentPage, load);

watch(
  () => ({ ...filters.value }),
  async () => {
    try {
      localStorage.setItem(
        'adminEquipmentFilters',
        JSON.stringify(filters.value)
      );
    } catch {}
    currentPage.value = 1;
    await load();
  },
  { deep: true }
);

function resetFilters() {
  filters.value = { type_id: '', manufacturer_id: '', size_id: '', status: '' };
}

function openIssue(it) {
  issueTarget.value = it;
  userSelected.value = '';
  userOptions.value = [];
  userQuery.value = '';
  issueError.value = '';
  issueModal?.show?.();
}

async function loadDictionaries() {
  const [t, m, s] = await Promise.all([
    apiFetch('/equipment/types'),
    apiFetch('/equipment/manufacturers'),
    apiFetch('/equipment/sizes'),
  ]);
  types.value = (t.types || []).map((x) => ({ value: x.id, label: x.name }));
  manufacturers.value = (m.manufacturers || []).map((x) => ({
    value: x.id,
    label: x.name,
  }));
  sizes.value = (s.sizes || []).map((x) => ({ value: x.id, label: x.name }));
}

async function load() {
  try {
    isLoading.value = true;
    error.value = '';
    const params = new URLSearchParams({
      page: String(currentPage.value),
      limit: String(pageSize.value),
    });
    if (filters.value.type_id) params.set('type_id', filters.value.type_id);
    if (filters.value.manufacturer_id)
      params.set('manufacturer_id', filters.value.manufacturer_id);
    if (filters.value.size_id) params.set('size_id', filters.value.size_id);
    if (filters.value.status) params.set('status', filters.value.status);
    if (filters.value.number)
      params.set('number', String(filters.value.number));
    if (filters.value.orderBy) params.set('orderBy', filters.value.orderBy);
    if (filters.value.order) params.set('order', filters.value.order);
    const data = await apiFetch(`/equipment?${params.toString()}`);
    items.value = data.items || [];
    total.value = data.total || 0;
  } catch (e) {
    error.value = e?.message || 'Не удалось загрузить данные';
  } finally {
    isLoading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  fieldErrors.value = {};
  formError.value = '';
  form.value = { type_id: '', manufacturer_id: '', size_id: '', number: '' };
  modal.show();
}

function openEdit(it) {
  editing.value = it;
  fieldErrors.value = {};
  formError.value = '';
  form.value = {
    type_id: it.type?.id || '',
    manufacturer_id: it.manufacturer?.id || '',
    size_id: it.size?.id || '',
    number: it.number,
  };
  modal.show();
}

function validateForm() {
  const e = {};
  if (!form.value.type_id) e.type_id = 'Выберите тип';
  if (!form.value.manufacturer_id) e.manufacturer_id = 'Выберите производителя';
  if (!form.value.size_id) e.size_id = 'Выберите размер';
  const n = Number(form.value.number);
  if (!Number.isInteger(n) || n < 1 || n > 300) {
    e.number = 'Номер должен быть от 1 до 300';
  }
  fieldErrors.value = e;
  return Object.keys(e).length === 0;
}

async function save() {
  formError.value = '';
  if (!validateForm()) {
    formError.value = 'Исправьте ошибки в форме';
    return;
  }
  const payload = {
    type_id: form.value.type_id,
    manufacturer_id: form.value.manufacturer_id,
    size_id: form.value.size_id,
    number: Number(form.value.number),
  };
  try {
    saveLoading.value = true;
    if (editing.value) {
      await apiFetch(`/equipment/${editing.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showToast('Экипировка обновлена', 'success');
    } else {
      await apiFetch('/equipment', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast('Экипировка добавлена', 'success');
    }
    modal.hide();
    await load();
  } catch (e) {
    formError.value = e?.message || 'Ошибка при сохранении';
  } finally {
    saveLoading.value = false;
  }
}

async function removeItem(it) {
  if (!confirm('Удалить запись об экипировке?')) return;
  try {
    await apiFetch(`/equipment/${it.id}`, { method: 'DELETE' });
    showToast('Запись удалена', 'success');
    await load();
  } catch (e) {
    showToast(e?.userMessage || 'Ошибка при удалении', 'danger');
  }
}

watch(userQuery, () => {
  clearTimeout(userTimeout);
  const q = userQuery.value.trim();
  if (!q || q.length < 2) {
    userOptions.value = [];
    return;
  }
  userTimeout = setTimeout(async () => {
    try {
      const params = new URLSearchParams({
        search: q,
        limit: '20',
        role: 'REFEREE',
      });
      // Include brigade referees as well
      const data = await apiFetch(`/users?${params.toString()}`);
      const seen = new Set((data.users || []).map((u) => u.id));
      const data2 = await apiFetch(
        `/users?${new URLSearchParams({ search: q, limit: '20', role: 'BRIGADE_REFEREE' }).toString()}`
      );
      const merged = [...(data.users || [])];
      (data2.users || []).forEach((u) => {
        if (!seen.has(u.id)) merged.push(u);
      });
      userOptions.value = merged;
    } catch (_) {
      userOptions.value = [];
    }
  }, 300);
});

async function issueConfirm() {
  if (!issueTarget.value || !userSelected.value) return;
  issueLoading.value = true;
  issueError.value = '';
  try {
    await apiFetch(`/equipment/${issueTarget.value.id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userSelected.value }),
    });
    showToast('Выдача оформлена. Документ создан', 'success');
    issueModal.hide();
    await load();
  } catch (e) {
    issueError.value = e?.message || 'Не удалось выдать';
  } finally {
    issueLoading.value = false;
  }
}
</script>

<template>
  <div class="py-3 admin-equipment-page">
    <div class="container">
      <nav aria-label="breadcrumb" class="mb-2">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Экипировка</li>
        </ol>
      </nav>

      <div class="d-flex align-items-center mb-3">
        <h1 class="h4 mb-0 me-auto">Экипировка</h1>
        <div class="btn-group">
          <button class="btn btn-primary" type="button" @click="openCreate">
            <i class="bi bi-plus-lg me-1" aria-hidden="true"></i> Добавить
          </button>
        </div>
      </div>

      <div class="card section-card mb-2">
        <div class="card-body">
          <div class="row g-2 align-items-end">
            <div class="col-12 col-sm-4">
              <label class="form-label" for="flt-type">Тип</label>
              <select
                id="flt-type"
                class="form-select"
                v-model="filters.type_id"
              >
                <option value="">Все типы</option>
                <option v-for="t in types" :key="t.value" :value="t.value">
                  {{ t.label }}
                </option>
              </select>
            </div>
            <div class="col-12 col-sm-4">
              <label class="form-label" for="flt-mfr">Производитель</label>
              <select
                id="flt-mfr"
                class="form-select"
                v-model="filters.manufacturer_id"
              >
                <option value="">Все производители</option>
                <option
                  v-for="m in manufacturers"
                  :key="m.value"
                  :value="m.value"
                >
                  {{ m.label }}
                </option>
              </select>
            </div>
            <div class="col-12 col-sm-3">
              <label class="form-label" for="flt-size">Размер</label>
              <select
                id="flt-size"
                class="form-select"
                v-model="filters.size_id"
              >
                <option value="">Все размеры</option>
                <option v-for="s in sizes" :key="s.value" :value="s.value">
                  {{ s.label }}
                </option>
              </select>
            </div>
            <div class="col-12 col-sm-3">
              <label class="form-label" for="flt-status">Статус</label>
              <select
                id="flt-status"
                class="form-select"
                v-model="filters.status"
              >
                <option value="">Все</option>
                <option value="free">Свободна</option>
                <option value="awaiting">Ожидает подписи</option>
                <option value="issued">Выдана</option>
              </select>
            </div>
            <div class="col-12 col-sm-2">
              <label class="form-label" for="flt-number">Номер</label>
              <input
                id="flt-number"
                type="number"
                min="1"
                max="300"
                class="form-control"
                v-model.number="filters.number"
                placeholder="№"
              />
            </div>
            <div class="col-12 col-sm-1 d-grid">
              <button
                type="button"
                class="btn btn-outline-secondary"
                @click="resetFilters"
                title="Сбросить фильтры"
              >
                <i class="bi bi-x-circle" aria-hidden="true"></i>
                <span class="visually-hidden">Сбросить фильтры</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="error" class="alert alert-danger" role="alert">
        {{ error }}
      </div>

      <div class="card mb-3">
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table admin-table table-striped align-middle mb-0">
              <thead>
                <tr>
                  <th style="width: 26%">Тип</th>
                  <th style="width: 24%">Производитель</th>
                  <th style="width: 12%">Размер</th>
                  <th style="width: 18%">Владелец</th>
                  <th style="width: 8%">Номер</th>
                  <th style="width: 12%" class="text-end">Действия</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="isLoading">
                  <td colspan="5" class="text-center py-4">
                    <BrandSpinner />
                  </td>
                </tr>
                <tr v-else-if="!items.length">
                  <td colspan="5" class="text-center py-4">Пока нет записей</td>
                </tr>
                <tr v-for="it in items" :key="it.id">
                  <td>{{ it.type?.name }}</td>
                  <td>{{ it.manufacturer?.name }}</td>
                  <td>{{ it.size?.name }}</td>
                  <td>
                    <span v-if="it.owner">
                      {{ it.owner.last_name }} {{ it.owner.first_name }}
                    </span>
                    <span
                      v-else-if="it.document_id"
                      class="badge bg-warning text-dark"
                      >Ожидает подписи</span
                    >
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td>{{ it.number }}</td>
                  <td class="text-end">
                    <button
                      class="btn btn-sm btn-outline-primary me-1"
                      @click="openEdit(it)"
                    >
                      <i class="bi bi-pencil" aria-hidden="true"></i>
                      <span class="visually-hidden">Редактировать</span>
                    </button>
                    <button
                      v-if="!it.owner && !it.document_id"
                      class="btn btn-sm btn-outline-success me-1"
                      @click="openIssue(it)"
                    >
                      <i
                        class="bi bi-box-arrow-up-right"
                        aria-hidden="true"
                      ></i>
                      <span class="visually-hidden">Выдать</span>
                    </button>
                    <!-- No duplicate owner display in actions to avoid null errors -->
                    <button
                      class="btn btn-sm btn-outline-danger"
                      @click="removeItem(it)"
                    >
                      <i class="bi bi-trash" aria-hidden="true"></i>
                      <span class="visually-hidden">Удалить</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div
          class="card-footer d-flex align-items-center justify-content-between"
        >
          <div class="d-flex align-items-center gap-2">
            <label class="mb-0 small text-muted" for="pageSize"
              >На странице</label
            >
            <select
              id="pageSize"
              class="form-select form-select-sm"
              style="width: auto"
              v-model.number="pageSize"
            >
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
            </select>
          </div>
          <PageNav v-model="currentPage" :total-pages="totalPages" />
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div ref="modalRef" class="modal fade" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              {{ editing ? 'Редактирование экипировки' : 'Новая экипировка' }}
            </h5>
            <button
              type="button"
              class="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
            ></button>
          </div>
          <div class="modal-body">
            <div v-if="formError" class="alert alert-danger" role="alert">
              {{ formError }}
            </div>
            <div class="mb-3">
              <label class="form-label">Тип</label>
              <select class="form-select" v-model="form.type_id">
                <option value="" disabled>Выберите тип</option>
                <option v-for="t in types" :key="t.value" :value="t.value">
                  {{ t.label }}
                </option>
              </select>
              <div v-if="fieldErrors.type_id" class="invalid-feedback d-block">
                {{ fieldErrors.type_id }}
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label">Производитель</label>
              <select class="form-select" v-model="form.manufacturer_id">
                <option value="" disabled>Выберите производителя</option>
                <option
                  v-for="m in manufacturers"
                  :key="m.value"
                  :value="m.value"
                >
                  {{ m.label }}
                </option>
              </select>
              <div
                v-if="fieldErrors.manufacturer_id"
                class="invalid-feedback d-block"
              >
                {{ fieldErrors.manufacturer_id }}
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label">Размер</label>
              <select class="form-select" v-model="form.size_id">
                <option value="" disabled>Выберите размер</option>
                <option v-for="s in sizes" :key="s.value" :value="s.value">
                  {{ s.label }}
                </option>
              </select>
              <div v-if="fieldErrors.size_id" class="invalid-feedback d-block">
                {{ fieldErrors.size_id }}
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label">Номер</label>
              <input
                type="number"
                min="1"
                max="300"
                class="form-control"
                v-model.number="form.number"
              />
              <div v-if="fieldErrors.number" class="invalid-feedback d-block">
                {{ fieldErrors.number }}
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-outline-secondary"
              data-bs-dismiss="modal"
            >
              Отмена
            </button>
            <button
              type="button"
              class="btn btn-primary"
              :disabled="saveLoading"
              @click="save"
            >
              <span
                v-if="saveLoading"
                class="spinner-border spinner-border-sm me-1"
                role="status"
                aria-hidden="true"
              ></span>
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Issue Modal -->
  <div ref="issueRef" class="modal fade" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Выдача экипировки</h5>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
          ></button>
        </div>
        <div class="modal-body">
          <div v-if="issueError" class="alert alert-danger" role="alert">
            {{ issueError }}
          </div>
          <p class="text-muted mb-2">
            Выберите получателя (судью). Будет создан акт передачи для подписи.
          </p>
          <label class="form-label">Получатель</label>
          <div class="input-group mb-2">
            <span class="input-group-text"><i class="bi bi-search"></i></span>
            <input
              type="text"
              class="form-control"
              placeholder="Фамилия, имя, email или телефон"
              v-model.trim="userQuery"
            />
          </div>
          <div class="mb-3">
            <select class="form-select" size="6" v-model="userSelected">
              <option v-for="u in userOptions" :key="u.id" :value="u.id">
                {{ u.last_name }} {{ u.first_name }} {{ u.patronymic }} —
                {{ u.email || u.phone || '' }}
              </option>
            </select>
          </div>
          <div v-if="issueLoading" class="text-center my-2">
            <div
              class="spinner-border spinner-brand"
              role="status"
              aria-label="Загрузка"
            ></div>
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            data-bs-dismiss="modal"
          >
            Отмена
          </button>
          <button
            type="button"
            class="btn btn-success"
            :disabled="!userSelected || issueLoading"
            @click="issueConfirm"
          >
            Выдать
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Keep tables aligned with admin design code */
</style>
