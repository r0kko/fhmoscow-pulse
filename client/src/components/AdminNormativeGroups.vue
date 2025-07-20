<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';

const groups = ref([]);
const total = ref(0);
const seasons = ref([]);
const currentPage = ref(1);
const pageSize = 8;
const isLoading = ref(false);
const error = ref('');
const form = ref({ season_id: '', name: '', required: false });
const editing = ref(null);
const modalRef = ref(null);
let modal;
const formError = ref('');

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize))
);

onMounted(() => {
  modal = new Modal(modalRef.value);
  load();
  loadSeasons();
});

watch(currentPage, load);

async function load() {
  try {
    isLoading.value = true;
    const params = new URLSearchParams({
      page: currentPage.value,
      limit: pageSize,
    });
    const data = await apiFetch(`/normative-groups?${params}`);
    groups.value = data.groups;
    total.value = data.total;
    error.value = '';
  } catch (e) {
    error.value = e.message;
    groups.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function loadSeasons() {
  try {
    const params = new URLSearchParams({ page: 1, limit: 100 });
    const data = await apiFetch(`/camp-seasons?${params}`);
    seasons.value = data.seasons;
  } catch (_e) {
    seasons.value = [];
  }
}

function openCreate() {
  editing.value = null;
  form.value = { season_id: '', name: '', required: false };
  formError.value = '';
  if (!seasons.value.length) loadSeasons();
  modal.show();
}

function openEdit(g) {
  editing.value = g;
  form.value = { season_id: g.season_id, name: g.name, required: g.required };
  formError.value = '';
  if (!seasons.value.length) loadSeasons();
  modal.show();
}

async function save() {
  const payload = {
    season_id: form.value.season_id,
    name: form.value.name,
    required: form.value.required,
  };
  try {
    if (editing.value) {
      await apiFetch(`/normative-groups/${editing.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/normative-groups', {
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

async function removeGroup(g) {
  if (!confirm('Удалить запись?')) return;
  try {
    await apiFetch(`/normative-groups/${g.id}`, { method: 'DELETE' });
    await load();
  } catch (e) {
    alert(e.message);
  }
}

const refresh = () => {
  load();
  loadSeasons();
};

defineExpose({ refresh });
</script>

<template>
  <div class="mb-4">
    <div class="card section-card tile fade-in shadow-sm">
      <div
        class="card-header d-flex justify-content-between align-items-center"
      >
        <h2 class="h5 mb-0">Группы нормативов</h2>
        <button class="btn btn-brand" @click="openCreate">
          <i class="bi bi-plus-lg me-1"></i>Добавить
        </button>
      </div>
      <div class="card-body p-3">
        <div v-if="error" class="alert alert-danger mb-3">{{ error }}</div>
        <div v-if="isLoading" class="text-center my-3">
          <div class="spinner-border" role="status"></div>
        </div>
        <div v-if="groups.length" class="table-responsive d-none d-sm-block">
          <table class="table admin-table table-striped align-middle mb-0">
            <thead>
              <tr>
                <th>Сезон</th>
                <th>Название</th>
                <th>Обязательная</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="g in groups" :key="g.id">
                <td>
                  {{
                    seasons.find((s) => s.id === g.season_id)?.name ||
                    g.season_id
                  }}
                </td>
                <td>{{ g.name }}</td>
                <td>{{ g.required ? 'Да' : 'Нет' }}</td>
                <td class="text-end">
                  <button
                    class="btn btn-sm btn-secondary me-2"
                    @click="openEdit(g)"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn btn-sm btn-danger" @click="removeGroup(g)">
                    <i class="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="groups.length" class="d-block d-sm-none">
          <div v-for="g in groups" :key="g.id" class="card training-card mb-2">
            <div class="card-body p-2 d-flex justify-content-between">
              <div>
                <h6 class="mb-1">{{ g.name }}</h6>
                <p class="mb-1">
                  {{ seasons.find((s) => s.id === g.season_id)?.name || g.season_id }}
                </p>
                <p class="mb-1">Обязательная: {{ g.required ? 'Да' : 'Нет' }}</p>
              </div>
              <div>
                <button class="btn btn-sm btn-secondary me-2" @click="openEdit(g)">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-danger" @click="removeGroup(g)">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
        <p v-else-if="!isLoading" class="text-muted mb-0">Записей нет.</p>
      </div>
    </div>
    <nav class="mt-3" v-if="totalPages > 1">
      <ul class="pagination justify-content-center">
        <li class="page-item" :class="{ disabled: currentPage === 1 }">
          <button
            class="page-link"
            @click="currentPage--"
            :disabled="currentPage === 1"
          >
            Пред
          </button>
        </li>
        <li
          class="page-item"
          v-for="p in totalPages"
          :key="p"
          :class="{ active: currentPage === p }"
        >
          <button class="page-link" @click="currentPage = p">{{ p }}</button>
        </li>
        <li class="page-item" :class="{ disabled: currentPage === totalPages }">
          <button
            class="page-link"
            @click="currentPage++"
            :disabled="currentPage === totalPages"
          >
            След
          </button>
        </li>
      </ul>
    </nav>
    <div ref="modalRef" class="modal fade" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <form @submit.prevent="save">
            <div class="modal-header">
              <h5 class="modal-title">
                {{ editing ? 'Изменить группу' : 'Добавить группу' }}
              </h5>
              <button
                type="button"
                class="btn-close"
                @click="modal.hide()"
              ></button>
            </div>
            <div class="modal-body">
              <div v-if="formError" class="alert alert-danger">
                {{ formError }}
              </div>
              <div class="form-floating mb-3">
                <select
                  id="groupSeason"
                  v-model="form.season_id"
                  class="form-select"
                  required
                >
                  <option value="" disabled>Выберите сезон</option>
                  <option v-for="s in seasons" :key="s.id" :value="s.id">
                    {{ s.name }}
                  </option>
                </select>
                <label for="groupSeason">Сезон</label>
              </div>
  <div class="form-floating mb-3">
    <input
      id="groupName"
      v-model="form.name"
      class="form-control"
      placeholder="Название"
      required
    />
    <label for="groupName">Наименование</label>
  </div>
  <div class="form-check mb-3">
    <input
      id="groupRequired"
      type="checkbox"
      class="form-check-input"
      v-model="form.required"
    />
    <label class="form-check-label" for="groupRequired">Обязательная</label>
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
              <button type="submit" class="btn btn-primary">Сохранить</button>
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
