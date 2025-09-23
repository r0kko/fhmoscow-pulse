<script setup>
import { ref, reactive, onMounted } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { useToast } from '../utils/toast';
import { apiFetch } from '../api';
import ConfirmModal from './ConfirmModal.vue';

const props = defineProps({
  userId: { type: String, required: true },
});

// Links state
const links = reactive({ clubs: [], teams: [], loading: false, error: '' });

// Toast
const { showToast } = useToast();

// Attach Club modal
const clubModalRef = ref(null);
let clubModal;
const attachClub = reactive({
  loading: false,
  q: '',
  options: [],
  selected: '',
});

// Attach Team modal
const teamModalRef = ref(null);
let teamModal;
const attachTeam = reactive({
  loading: false,
  q: '',
  options: [],
  selected: '',
});

// Confirm detach
const confirmRef = ref(null);
const confirmTitle = ref('Подтверждение');
const confirmMessage = ref('');
let pendingDetach = null; // () => Promise<void>

onMounted(() => {
  if (clubModalRef.value) clubModal = new Modal(clubModalRef.value);
  if (teamModalRef.value) teamModal = new Modal(teamModalRef.value);
  refreshLinks();
});

async function refreshLinks() {
  links.loading = true;
  links.error = '';
  try {
    const data = await apiFetch(`/users/${props.userId}/sport-schools`);
    links.clubs = data.clubs || [];
    links.teams = data.teams || [];
  } catch (e) {
    links.error = e.message || 'Не удалось загрузить назначения';
  } finally {
    links.loading = false;
  }
}

// Clubs attach flow
async function openAttachClub() {
  attachClub.loading = true;
  attachClub.selected = '';
  try {
    const q = attachClub.q ? `&search=${encodeURIComponent(attachClub.q)}` : '';
    const data = await apiFetch(`/clubs?limit=50${q}`);
    attachClub.options = (data.clubs || []).map((c) => ({
      id: c.id,
      label: c.name,
    }));
  } finally {
    attachClub.loading = false;
  }
  try {
    clubModal?.show?.();
  } catch (_) {}
}
async function confirmAttachClub() {
  if (!attachClub.selected) return;
  attachClub.loading = true;
  try {
    await apiFetch(`/users/${props.userId}/clubs`, {
      method: 'POST',
      body: JSON.stringify({ club_id: attachClub.selected }),
    });
    try {
      clubModal?.hide?.();
    } catch (_) {}
    await refreshLinks();
    showToast('Клуб успешно прикреплён');
  } finally {
    attachClub.loading = false;
  }
}

// Teams attach flow
async function openAttachTeam() {
  attachTeam.loading = true;
  attachTeam.selected = '';
  try {
    const q = attachTeam.q ? `&search=${encodeURIComponent(attachTeam.q)}` : '';
    const data = await apiFetch(`/teams?limit=50${q}`);
    attachTeam.options = (data.teams || []).map((t) => ({
      id: t.id,
      label: `${t.name}${t.birth_year ? ` (${t.birth_year})` : ''}`,
    }));
  } finally {
    attachTeam.loading = false;
  }
  try {
    teamModal?.show?.();
  } catch (_) {}
}
async function confirmAttachTeam() {
  if (!attachTeam.selected) return;
  attachTeam.loading = true;
  try {
    await apiFetch(`/users/${props.userId}/teams`, {
      method: 'POST',
      body: JSON.stringify({ team_id: attachTeam.selected }),
    });
    try {
      teamModal?.hide?.();
    } catch (_) {}
    await refreshLinks();
    showToast('Команда успешно прикреплена');
  } finally {
    attachTeam.loading = false;
  }
}

// Detach flow
function askDetachClub(club) {
  confirmTitle.value = 'Открепить клуб';
  confirmMessage.value = `Открепить клуб «${club.name}»?`;
  pendingDetach = async () => {
    await apiFetch(`/users/${props.userId}/clubs/${club.id}`, {
      method: 'DELETE',
    });
    await refreshLinks();
    showToast('Клуб откреплён');
  };
  confirmRef.value?.open?.();
}
function askDetachTeam(team) {
  confirmTitle.value = 'Открепить команду';
  const name = `${team.name}${team.birth_year ? ` (${team.birth_year})` : ''}`;
  confirmMessage.value = `Открепить команду «${name}»?`;
  pendingDetach = async () => {
    await apiFetch(`/users/${props.userId}/teams/${team.id}`, {
      method: 'DELETE',
    });
    await refreshLinks();
    showToast('Команда откреплена');
  };
  confirmRef.value?.open?.();
}
function onConfirm() {
  if (typeof pendingDetach === 'function') pendingDetach();
}
</script>

<template>
  <div class="card section-card tile fade-in shadow-sm mt-4">
    <div class="card-body">
      <h2 class="card-title h5 mb-3">Клубы и команды</h2>
      <div v-if="links.error" class="alert alert-danger mb-2">
        {{ links.error }}
      </div>
      <div class="stack-sections">
        <!-- Клубы -->
        <div class="section-block">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h3 class="h6 mb-0">Клубы</h3>
            <button
              class="btn btn-sm btn-brand"
              :disabled="links.loading"
              @click="openAttachClub"
            >
              Прикрепить клуб
            </button>
          </div>
          <div v-if="links.loading" class="text-muted">Загрузка...</div>
          <div v-else-if="!links.clubs.length" class="alert alert-info mb-0">
            Клубы не привязаны
          </div>
          <ul v-else class="stack-list list-unstyled mb-0">
            <li v-for="c in links.clubs" :key="c.id" class="stack-item">
              <div
                class="fw-semibold me-2 flex-grow-1 club-name"
                :title="c.name"
              >
                {{ c.name }}
              </div>
              <button
                class="btn btn-link text-danger p-0"
                aria-label="Открепить клуб"
                @click="askDetachClub(c)"
              >
                <i class="bi bi-x-lg"></i>
              </button>
            </li>
          </ul>
        </div>

        <!-- Divider between sections -->
        <hr class="section-divider" />

        <!-- Команды -->
        <div class="section-block">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h3 class="h6 mb-0">Команды</h3>
            <button
              class="btn btn-sm btn-brand"
              :disabled="links.loading"
              @click="openAttachTeam"
            >
              Прикрепить команду
            </button>
          </div>
          <div v-if="links.loading" class="text-muted">Загрузка...</div>
          <div v-else-if="!links.teams.length" class="alert alert-info mb-0">
            Команды не привязаны
          </div>
          <ul v-else class="stack-list list-unstyled mb-0">
            <li v-for="t in links.teams" :key="t.id" class="stack-item">
              <div
                class="fw-semibold me-2 flex-grow-1 team-name"
                :title="t.name"
              >
                <span>{{ t.name }}</span>
                <template v-if="t.birth_year">
                  <span class="meta-divider" aria-hidden="true"></span>
                  <span class="team-meta text-muted">{{ t.birth_year }}</span>
                </template>
              </div>
              <button
                class="btn btn-link text-danger p-0"
                aria-label="Открепить команду"
                @click="askDetachTeam(t)"
              >
                <i class="bi bi-x-lg"></i>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Attach Club Modal -->
    <div
      ref="clubModalRef"
      class="modal fade"
      tabindex="-1"
      aria-modal="true"
      role="dialog"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Прикрепить клуб</h5>
            <button
              type="button"
              class="btn-close"
              aria-label="Закрыть"
              @click="clubModal?.hide?.()"
            />
          </div>
          <div class="modal-body">
            <div class="input-group mb-2">
              <span class="input-group-text"
                ><i class="bi bi-search" aria-hidden="true"></i
              ></span>
              <input
                v-model="attachClub.q"
                class="form-control"
                placeholder="Поиск клуба"
                @keyup.enter="openAttachClub"
              />
              <button
                class="btn btn-outline-brand"
                :disabled="attachClub.loading"
                @click="openAttachClub"
              >
                Найти
              </button>
            </div>
            <select
              v-model="attachClub.selected"
              class="form-select"
              aria-label="Выбор клуба"
            >
              <option value="">— Выберите клуб —</option>
              <option
                v-for="opt in attachClub.options"
                :key="opt.id"
                :value="opt.id"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div class="modal-footer">
            <button
              class="btn btn-outline-secondary"
              :disabled="attachClub.loading"
              @click="clubModal?.hide?.()"
            >
              Отмена
            </button>
            <button
              class="btn btn-brand"
              :disabled="attachClub.loading || !attachClub.selected"
              @click="confirmAttachClub"
            >
              <span
                v-if="attachClub.loading"
                class="spinner-border spinner-border-sm me-1"
                role="status"
                aria-hidden="true"
              ></span>
              Прикрепить
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Attach Team Modal -->
    <div
      ref="teamModalRef"
      class="modal fade"
      tabindex="-1"
      aria-modal="true"
      role="dialog"
    >
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Прикрепить команду</h5>
            <button
              type="button"
              class="btn-close"
              aria-label="Закрыть"
              @click="teamModal?.hide?.()"
            />
          </div>
          <div class="modal-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <div class="input-group" style="max-width: 420px">
                <span class="input-group-text"
                  ><i class="bi bi-search"></i
                ></span>
                <input
                  v-model="attachTeam.q"
                  class="form-control"
                  placeholder="Поиск команды"
                  @keyup.enter="openAttachTeam"
                />
                <button
                  class="btn btn-outline-brand"
                  :disabled="attachTeam.loading"
                  @click="openAttachTeam"
                >
                  Найти
                </button>
              </div>
              <div class="d-flex gap-2">
                <select
                  v-model="attachTeam.selected"
                  class="form-select form-select-sm"
                  style="min-width: 260px"
                >
                  <option value="">— Выберите команду —</option>
                  <option
                    v-for="opt in attachTeam.options"
                    :key="opt.id"
                    :value="opt.id"
                  >
                    {{ opt.label }}
                  </option>
                </select>
                <button
                  class="btn btn-sm btn-brand"
                  :disabled="attachTeam.loading || !attachTeam.selected"
                  @click="confirmAttachTeam"
                >
                  <span
                    v-if="attachTeam.loading"
                    class="spinner-border spinner-border-sm me-1"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Прикрепить
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirm Modal -->
    <ConfirmModal
      ref="confirmRef"
      :title="confirmTitle"
      confirm-text="Открепить"
      confirm-variant="danger"
      @confirm="onConfirm"
    >
      <p class="mb-0">{{ confirmMessage }}</p>
    </ConfirmModal>
  </div>
</template>

<style scoped>
/* Uses global .section-card from brand.css */
.stack-sections {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.section-block {
  /* no extra card chrome inside; rely on parent card */
}
.section-divider {
  margin: 0.25rem 0 0.5rem 0;
  border: 0;
  border-top: 1px solid var(--border-subtle);
}
.stack-list {
  margin: 0;
  padding: 0;
}
.stack-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0;
}
.stack-item + .stack-item {
  border-top: 1px solid var(--border-subtle);
}
.club-name,
.team-name {
  white-space: normal;
  word-break: break-word;
}
.meta-divider::before {
  content: '·';
  color: #adb5bd;
  margin: 0 0.375rem;
}
.team-meta {
  font-weight: 500;
}
</style>
