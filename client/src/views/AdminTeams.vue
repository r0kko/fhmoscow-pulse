<script setup>
import { ref, onMounted, computed } from 'vue';
import { apiFetch } from '../api.js';
import { auth } from '../auth.js';

const teams = ref([]);
const current = ref(new Set());
const selected = ref(new Set());
const loading = ref(false);
const saving = ref(false);
const syncing = ref(false);
const error = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [all, mine] = await Promise.all([
      apiFetch('/teams'),
      apiFetch('/user-teams'),
    ]);
    teams.value = all.teams;
    current.value = new Set(mine.teams.map((t) => t.id));
    selected.value = new Set(current.value);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function toggle(id, checked) {
  if (checked) selected.value.add(id);
  else selected.value.delete(id);
}

const changed = computed(() => {
  if (current.value.size !== selected.value.size) return true;
  for (const id of selected.value) if (!current.value.has(id)) return true;
  return false;
});

async function save() {
  if (!changed.value) return;
  saving.value = true;
  error.value = '';
  const toAdd = [...selected.value].filter((id) => !current.value.has(id));
  const toRemove = [...current.value].filter((id) => !selected.value.has(id));
  try {
    for (const id of toAdd) {
      await apiFetch('/user-teams', {
        method: 'POST',
        body: JSON.stringify({ team_id: id }),
      });
    }
    for (const id of toRemove) {
      await apiFetch(`/user-teams/${id}`, { method: 'DELETE' });
    }
    current.value = new Set(selected.value);
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function sync() {
  syncing.value = true;
  error.value = '';
  try {
    await apiFetch('/teams/sync', { method: 'POST' });
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    syncing.value = false;
  }
}
</script>

<template>
  <div class="py-4">
    <div class="container">
      <h1 class="mb-3 text-start">Команды</h1>

      <div class="card section-card">
        <div class="card-body">
          <div v-if="loading" class="text-center my-5">
            <span class="spinner-border spinner-brand" aria-hidden="true"></span>
          </div>
          <div v-else>
            <div v-if="teams.length">
              <div v-for="team in teams" :key="team.id" class="form-check">
                <input
                  :id="`team-${team.id}`"
                  class="form-check-input"
                  type="checkbox"
                  :checked="selected.has(team.id)"
                  @change="toggle(team.id, $event.target.checked)"
                />
                <label class="form-check-label" :for="`team-${team.id}`">
                  {{ team.full_name }}
                </label>
              </div>
              <button
                class="btn btn-brand mt-3"
                :disabled="saving || !changed"
                @click="save"
              >
                <span
                  v-if="saving"
                  class="spinner-border spinner-border-sm spinner-brand me-2"
                ></span>
                Сохранить
              </button>
              <button
                v-if="auth.roles.includes('ADMIN')"
                class="btn btn-outline-secondary mt-3 ms-2"
                :disabled="syncing"
                @click="sync"
              >
                <span
                  v-if="syncing"
                  class="spinner-border spinner-border-sm me-2"
                ></span>
                Обновить список
              </button>
            </div>
            <p v-else class="mb-0">Нет доступных команд.</p>
            <div v-if="error" class="text-danger mt-2">{{ error }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 0;
}
</style>
