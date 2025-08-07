<script setup>
import { ref, watch, nextTick } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch, apiFetchBlob } from '../api.js';

const userQuery = ref('');
const userSuggestions = ref([]);
const selectedUser = ref(null);
let userTimeout;
let selecting = false;

watch(userQuery, () => {
  clearTimeout(userTimeout);
  if (!selecting && selectedUser.value) selectedUser.value = null;
  if (!userQuery.value || userQuery.value.length < 2) {
    userSuggestions.value = [];
    return;
  }
  userTimeout = setTimeout(async () => {
    try {
      const params = new URLSearchParams({ search: userQuery.value, limit: 5 });
      const data = await apiFetch(`/users?${params}`);
      userSuggestions.value = data.users;
    } catch (_err) {
      userSuggestions.value = [];
    }
  }, 300);
});

function selectUser(u) {
  selecting = true;
  selectedUser.value = u;
  userQuery.value = `${u.last_name} ${u.first_name}`;
  userSuggestions.value = [];
  nextTick(() => {
    selecting = false;
  });
}

async function downloadConsent() {
  if (!selectedUser.value) return;
  try {
    const blob = await apiFetchBlob(`/documents/consent/${selectedUser.value.id}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'consent.pdf';
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert(e.message);
  }
}
</script>

<template>
  <div class="container mt-4">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item">
          <RouterLink to="/admin">Администрирование</RouterLink>
        </li>
        <li class="breadcrumb-item active" aria-current="page">Документы</li>
      </ol>
    </nav>
    <h1 class="mb-3">Документы</h1>
    <div class="card section-card tile fade-in shadow-sm">
      <div class="card-body">
        <div class="mb-3 position-relative">
          <div class="form-floating">
            <input
              id="userSearch"
              v-model="userQuery"
              class="form-control"
              placeholder="Пользователь"
            />
            <label for="userSearch">Пользователь</label>
          </div>
          <ul
            v-if="userSuggestions.length"
            class="list-group position-absolute w-100"
            style="z-index: 1050"
          >
            <li
              v-for="u in userSuggestions"
              :key="u.id"
              class="list-group-item list-group-item-action"
              @mousedown.prevent="selectUser(u)"
            >
              {{ u.last_name }} {{ u.first_name }}
            </li>
          </ul>
        </div>
        <button
          class="btn btn-brand"
          :disabled="!selectedUser"
          @click="downloadConsent"
        >
          Скачать согласие
        </button>
      </div>
    </div>
  </div>
</template>
