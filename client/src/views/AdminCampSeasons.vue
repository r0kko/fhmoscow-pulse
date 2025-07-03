<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { RouterLink } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';

const seasons = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = 8;
const isLoading = ref(false);
const error = ref('');
const form = ref({ name: '' });
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
});

watch(currentPage, load);

async function load() {
  isLoading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams({
      page: currentPage.value,
      limit: pageSize,
    });
    const data = await apiFetch(`/camp-seasons?${params}`);
    seasons.value = data.seasons;
    total.value = data.total;
  } catch (e) {
    error.value = e.message;
  } finally {
    isLoading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  form.value.name = '';
  formError.value = '';
  modal.show();
}

function openEdit(season) {
  editing.value = season;
  form.value.name = season.name;
  formError.value = '';
  modal.show();
}

async function save() {
  const payload = { name: form.value.name };
  try {
    if (editing.value) {
      await apiFetch(`/camp-seasons/${editing.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/camp-seasons', {
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

async function removeSeason(season) {
  if (!confirm('Удалить запись?')) return;
  try {
    await apiFetch(`/camp-seasons/${season.id}`, { method: 'DELETE' });
    await load();
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
        <li class="breadcrumb-item active" aria-current="page">Сезоны</li>
      </ol>
    </nav>
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h1 class="mb-0">Сезоны</h1>
      <button class="btn btn-brand" @click="openCreate">
        <i class="bi bi-plus-lg me-1"></i>Добавить
      </button>
    </div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="isLoading" class="text-center my-3">
      <div class="spinner-border" role="status"></div>
    </div>
    <div v-if="seasons.length" class="table-responsive">
      <table class="table table-striped align-middle">
        <thead>
          <tr>
            <th>Название</th>
            <th>Alias</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in seasons" :key="s.id">
            <td>{{ s.name }}</td>
            <td>{{ s.alias }}</td>
            <td class="text-end">
              <button
                class="btn btn-sm btn-secondary me-2"
                @click="openEdit(s)"
              >
                Изменить
              </button>
              <button class="btn btn-sm btn-danger" @click="removeSeason(s)">
                Удалить
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else-if="!isLoading" class="text-muted">Записей нет.</p>
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
                {{ editing ? 'Изменить сезон' : 'Добавить сезон' }}
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
                <input
                  id="seasonName"
                  v-model="form.name"
                  class="form-control"
                  placeholder="Название"
                  required
                />
                <label for="seasonName">Наименование</label>
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
