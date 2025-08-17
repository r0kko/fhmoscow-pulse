<script setup>
import { ref, onMounted, computed } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';

const users = ref([]);
const teams = ref([]);
const currentUser = ref(null);
const current = ref(new Set());
const selected = ref(new Set());
const loadingUsers = ref(false);
const loadingModal = ref(false);
const saving = ref(false);
const syncing = ref(false);
const listError = ref('');
const modalError = ref('');
const modalRef = ref(null);
let modal;

onMounted(async () => {
  modal = new Modal(modalRef.value);
  await load();
});

async function load() {
  loadingUsers.value = true;
  listError.value = '';
  try {
    const [{ users: staff }, { teams: allTeams }] = await Promise.all([
      apiFetch('/users?role=SPORT_SCHOOL_STAFF&limit=1000'),
      apiFetch('/teams'),
    ]);
    users.value = staff;
    teams.value = allTeams;
  } catch (e) {
    listError.value = e.message;
  } finally {
    loadingUsers.value = false;
  }
}

function open(user) {
  currentUser.value = user;
  current.value = new Set();
  selected.value = new Set();
  modalError.value = '';
  loadingModal.value = true;
  apiFetch(`/users/${user.id}/teams`)
    .then((res) => {
      current.value = new Set(res.teams.map((t) => t.id));
      selected.value = new Set(current.value);
    })
    .catch((e) => {
      modalError.value = e.message;
    })
    .finally(() => {
      loadingModal.value = false;
      modal.show();
    });
}

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
  if (!currentUser.value || !changed.value) return;
  saving.value = true;
  modalError.value = '';
  const toAdd = [...selected.value].filter((id) => !current.has(id));
  const toRemove = [...current].filter((id) => !selected.value.has(id));
  try {
    for (const id of toAdd) {
      await apiFetch(`/users/${currentUser.value.id}/teams`, {
        method: 'POST',
        body: JSON.stringify({ team_id: id }),
      });
    }
    for (const id of toRemove) {
      await apiFetch(`/users/${currentUser.value.id}/teams/${id}`, {
        method: 'DELETE',
      });
    }
    current.value = new Set(selected.value);
    modal.hide();
  } catch (e) {
    modalError.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function sync() {
  syncing.value = true;
  listError.value = '';
  try {
    await apiFetch('/teams/sync', { method: 'POST' });
    await load();
  } catch (e) {
    listError.value = e.message;
  } finally {
    syncing.value = false;
  }
}

function name(u) {
  return [u.last_name, u.first_name, u.middle_name].filter(Boolean).join(' ');
}
</script>

<template>
  <div class="py-4">
    <div class="container">
      <h1 class="mb-3 text-start">Команды</h1>

      <div class="card section-card mb-2">
        <div class="card-body">
          <div v-if="loadingUsers" class="text-center my-5">
            <span class="spinner-border spinner-brand" aria-hidden="true"></span>
          </div>
          <div v-else>
            <div v-if="users.length">
              <table class="table align-middle">
                <thead>
                  <tr>
                    <th scope="col">Сотрудник</th>
                    <th scope="col" class="text-end">
                      <button
                        class="btn btn-outline-secondary btn-sm"
                        :disabled="syncing"
                        @click="sync"
                      >
                        <span
                          v-if="syncing"
                          class="spinner-border spinner-border-sm me-2"
                        ></span>
                        Обновить список
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="user in users" :key="user.id">
                    <td>{{ name(user) }}</td>
                    <td class="text-end">
                      <button class="btn btn-brand btn-sm" @click="open(user)">
                        Назначить команды
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="mb-0">Нет сотрудников спортивной школы.</p>
            <div v-if="listError" class="text-danger mt-2">{{ listError }}</div>
          </div>
        </div>
      </div>
    </div>

    <div ref="modalRef" class="modal fade" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title h5">
              Команды для {{ currentUser ? name(currentUser) : '' }}
            </h2>
            <button
              type="button"
              class="btn-close"
              aria-label="Close"
              @click="modal.hide()"
            ></button>
          </div>
          <div class="modal-body">
            <div v-if="loadingModal" class="text-center my-5">
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
              </div>
              <p v-else class="mb-0">Нет доступных команд.</p>
            </div>
            <div v-if="modalError" class="text-danger mt-2">{{ modalError }}</div>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-outline-secondary"
              @click="modal.hide()"
            >
              Отмена
            </button>
            <button
              class="btn btn-brand"
              :disabled="saving || !changed"
              @click="save"
            >
              <span
                v-if="saving"
                class="spinner-border spinner-border-sm spinner-brand me-2"
              ></span>
              Сохранить
            </button>
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

