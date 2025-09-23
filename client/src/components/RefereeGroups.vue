<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api';

const groups = ref([]);
const total = ref(0);
const seasons = ref([]);
const filterSeason = ref('');
const currentPage = ref(1);
const pageSize = 8;
const isLoading = ref(false);
const error = ref('');
const form = ref({ season_id: '', name: '' });
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
watch(filterSeason, () => {
  currentPage.value = 1;
  load();
});

async function load() {
  isLoading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams({
      page: currentPage.value,
      limit: pageSize,
    });
    if (filterSeason.value) params.set('season_id', filterSeason.value);
    const data = await apiFetch(`/referee-groups?${params}`);
    groups.value = data.groups;
    total.value = data.total;
  } catch (e) {
    error.value = e.message;
  } finally {
    isLoading.value = false;
  }
}

async function loadSeasons() {
  try {
    const params = new URLSearchParams({ page: 1, limit: 100 });
    const data = await apiFetch(`/camp-seasons?${params}`);
    seasons.value = data.seasons;
  } catch (_) {
    seasons.value = [];
  }
}

function openCreate() {
  editing.value = null;
  form.value = { season_id: '', name: '' };
  formError.value = '';
  if (!seasons.value.length) loadSeasons();
  modal.show();
}

function openEdit(group) {
  editing.value = group;
  form.value = { season_id: group.season_id, name: group.name };
  formError.value = '';
  if (!seasons.value.length) loadSeasons();
  modal.show();
}

async function save() {
  const payload = { season_id: form.value.season_id, name: form.value.name };
  try {
    if (editing.value) {
      await apiFetch(`/referee-groups/${editing.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/referee-groups', {
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

async function removeGroup(group) {
  if (!confirm('Удалить запись?')) return;
  try {
    await apiFetch(`/referee-groups/${group.id}`, { method: 'DELETE' });
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
  <div>
    <div class="card section-card ground-card tile fade-in shadow-sm">
      <div
        class="card-header d-flex justify-content-between align-items-center"
      >
        <h2 class="h5 mb-0">Группы судей</h2>
        <button class="btn btn-brand" @click="openCreate">
          <i class="bi bi-plus-lg me-1"></i>Добавить
        </button>
      </div>
      <div class="card-body p-3">
        <div class="row g-2 mb-3">
          <div class="col-sm">
            <select v-model="filterSeason" class="form-select">
              <option value="">Все сезоны</option>
              <option v-for="s in seasons" :key="s.id" :value="s.id">
                {{ s.name }}
              </option>
            </select>
          </div>
        </div>
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="g in groups" :key="g.id">
                <td>{{ g.season ? g.season.name : '' }}</td>
                <td>{{ g.name }}</td>
                <td class="text-end">
                  <button
                    class="btn btn-sm btn-secondary me-2"
                    aria-label="Редактировать группу"
                    @click="openEdit(g)"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button
                    class="btn btn-sm btn-danger"
                    aria-label="Удалить группу"
                    @click="removeGroup(g)"
                  >
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
                <p class="mb-1">{{ g.season ? g.season.name : '' }}</p>
              </div>
              <div>
                <button
                  class="btn btn-sm btn-secondary me-2"
                  aria-label="Редактировать группу"
                  @click="openEdit(g)"
                >
                  <i class="bi bi-pencil"></i>
                </button>
                <button
                  class="btn btn-sm btn-danger"
                  aria-label="Удалить группу"
                  @click="removeGroup(g)"
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
    <nav v-if="totalPages > 1" class="mt-3">
      <ul class="pagination justify-content-center">
        <li class="page-item" :class="{ disabled: currentPage === 1 }">
          <button
            class="page-link"
            :disabled="currentPage === 1"
            @click="currentPage--"
          >
            Пред
          </button>
        </li>
        <li
          v-for="p in totalPages"
          :key="p"
          class="page-item"
          :class="{ active: currentPage === p }"
        >
          <button class="page-link" @click="currentPage = p">{{ p }}</button>
        </li>
        <li class="page-item" :class="{ disabled: currentPage === totalPages }">
          <button
            class="page-link"
            :disabled="currentPage === totalPages"
            @click="currentPage++"
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
              <h2 class="modal-title h5">
                {{ editing ? 'Изменить группу' : 'Добавить группу' }}
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
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
}

.fade-in {
  animation: fadeIn 0.4s ease-out;
}

.ground-card {
  border-radius: var(--radius-tile);
  overflow: hidden;
}

/* Uses global .section-card from brand.css */
@media (max-width: 575.98px) {
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
