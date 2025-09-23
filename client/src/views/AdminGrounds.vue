<script setup>
import {
  ref,
  reactive,
  onMounted,
  onBeforeUnmount,
  watch,
  computed,
} from 'vue';
import { RouterLink } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';
import { useToast } from '../utils/toast';
import { apiFetch } from '../api';
import { loadPageSize, savePageSize } from '../utils/pageSize';
import PageNav from '../components/PageNav.vue';
import { suggestAddress, cleanAddress } from '../dadata';
import BrandSpinner from '../components/BrandSpinner.vue';
import GroundFiltersModal from '../components/GroundFiltersModal.vue';
import { withHttp } from '../utils/url';
import metroIcon from '../assets/metro.svg';
import yandexLogo from '../assets/yandex-maps.svg';

const grounds = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(loadPageSize('adminGroundsPageSize', 8));
const isLoading = ref(false);
const error = ref('');

// Search and filters
const q = ref('');
const filters = reactive({
  withoutAddress: false,
  withYandex: false,
  imported: false,
  withClubs: false,
  withTeams: false,
});
const filtersModal = ref(null);

const form = ref({
  name: '',
  address: { result: '' },
  yandex_url: '',
});
const editing = ref(null);
const modalRef = ref(null);
let modal;
const formError = ref('');
const errors = ref({});
const addressSuggestions = ref([]);
let addrTimeout;
const saveLoading = ref(false);
const syncLoading = ref(false);
const { showToast } = useToast();

function topChips(items, max = 3) {
  const list = Array.isArray(items) ? items : [];
  return {
    visible: list.slice(0, max),
    hidden: Math.max(0, list.length - max),
  };
}

// Links management
const linksModalRef = ref(null);
let linksModal;
const linksLoading = ref(false);
const selectedGround = ref(null);
const links = ref({ clubs: [], teams: [] });
const attachClub = ref({ q: '', options: [], selected: '', loading: false });
const attachTeam = ref({ q: '', options: [], selected: '', loading: false });
let linkSearchTimeout;

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize.value))
);

function metroNames(address) {
  if (!address || !Array.isArray(address.metro) || !address.metro.length) {
    return '';
  }
  return address.metro
    .slice(0, 2)
    .map((m) => m.name)
    .join(', ');
}

onMounted(() => {
  modal = new Modal(modalRef.value);
  if (linksModalRef.value) linksModal = new Modal(linksModalRef.value);
  // restore saved filters
  try {
    const saved = localStorage.getItem('adminGroundsFilters');
    if (saved) Object.assign(filters, JSON.parse(saved));
  } catch {}
  load();
});

onBeforeUnmount(() => {
  try {
    clearTimeout(addrTimeout);
  } catch {}
  try {
    modal?.hide?.();
    modal?.dispose?.();
  } catch {}
  try {
    linksModal?.hide?.();
    linksModal?.dispose?.();
  } catch {}
});

watch(currentPage, load);
watch(pageSize, (val) => {
  currentPage.value = 1;
  savePageSize('adminGroundsPageSize', val);
  load();
});
let searchTimeout;
watch(q, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentPage.value = 1;
    load();
  }, 300);
});

watch(
  () => ({ ...filters }),
  () => {
    try {
      localStorage.setItem('adminGroundsFilters', JSON.stringify(filters));
    } catch {}
    currentPage.value = 1;
    load();
  },
  { deep: true }
);
watch(
  () => form.value.address.result,
  (val) => {
    clearTimeout(addrTimeout);
    if (!val || val.length < 3) {
      addressSuggestions.value = [];
      return;
    }
    const query = val.trim();
    addrTimeout = setTimeout(async () => {
      addressSuggestions.value = await suggestAddress(query);
    }, 300);
  }
);

function openCreate() {
  editing.value = null;
  form.value = {
    name: '',
    address: { result: '' },
    yandex_url: '',
    capacity: '',
    phone: '',
    website: '',
  };
  formError.value = '';
  errors.value = {};
  addressSuggestions.value = [];
  modal.show();
}

function openEdit(s) {
  editing.value = s;
  form.value = {
    name: s.name,
    address: { result: s.address?.result || '' },
    yandex_url: s.yandex_url || '',
  };
  formError.value = '';
  errors.value = {};
  addressSuggestions.value = [];
  modal.show();
}

function isValidUrl(value) {
  if (!value) return true;
  try {
    // prepend scheme if missing for validation purposes
    const test = value.match(/^https?:\/\//i) ? value : `https://${value}`;

    new URL(test);
    return true;
  } catch {
    return false;
  }
}

function validateForm() {
  const e = {};
  if (!form.value.name || !form.value.name.trim()) {
    e.name = 'Укажите наименование';
  } else if (form.value.name.length > 255) {
    e.name = 'Макс. длина — 255 символов';
  }
  if (form.value.yandex_url && !isValidUrl(form.value.yandex_url)) {
    e.yandex_url = 'Некорректный URL';
  }
  errors.value = e;
  return Object.keys(e).length === 0;
}

async function save() {
  formError.value = '';
  if (!validateForm()) {
    formError.value = 'Исправьте ошибки в форме';
    return;
  }
  const payload = {
    name: form.value.name,
    address: form.value.address?.result
      ? { result: form.value.address.result }
      : undefined,
    yandex_url: form.value.yandex_url || undefined,
  };
  try {
    saveLoading.value = true;
    if (editing.value) {
      await apiFetch(`/grounds/${editing.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/grounds', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    modal.hide();
    await load();
  } catch (e) {
    formError.value = e.message;
  } finally {
    saveLoading.value = false;
  }
}

async function removeGround(s) {
  if (!confirm('Удалить площадку?')) return;
  await apiFetch(`/grounds/${s.id}`, { method: 'DELETE' });
  await load();
}

function applyAddressSuggestion(sug) {
  form.value.address.result = sug.value;
  addressSuggestions.value = [];
}

async function onAddressBlur() {
  const cleaned = await cleanAddress(form.value.address.result);
  if (cleaned && cleaned.result) {
    form.value.address.result = cleaned.result;
  }
  addressSuggestions.value = [];
}

// global toast via useToast()

async function openLinks(s) {
  selectedGround.value = s;
  links.value = { clubs: [], teams: [] };
  attachClub.value = { q: '', options: [], selected: '', loading: false };
  attachTeam.value = { q: '', options: [], selected: '', loading: false };
  await loadLinks();
  linksModal?.show?.();
}

async function loadLinks() {
  if (!selectedGround.value) return;
  linksLoading.value = true;
  try {
    const [c, t] = await Promise.all([
      apiFetch(`/grounds/${selectedGround.value.id}/clubs`),
      apiFetch(`/grounds/${selectedGround.value.id}/teams`),
    ]);
    links.value = { clubs: c.clubs || [], teams: t.teams || [] };
  } catch (e) {
    showToast(e.message || 'Не удалось загрузить связи');
  } finally {
    linksLoading.value = false;
  }
}

async function refreshGroundRow() {
  if (!selectedGround.value) return;
  try {
    const data = await apiFetch(`/grounds/${selectedGround.value.id}`);
    const idx = grounds.value.findIndex(
      (g) => g.id === selectedGround.value.id
    );
    if (idx !== -1) grounds.value[idx] = data.ground;
    selectedGround.value = data.ground;
  } catch (_) {}
}

async function searchClubOptions() {
  attachClub.value.loading = true;
  try {
    const q = attachClub.value.q?.trim();
    const data = await apiFetch(
      `/clubs?limit=50${q ? `&search=${encodeURIComponent(q)}` : ''}`
    );
    attachClub.value.options = (data.clubs || []).map((c) => ({
      id: c.id,
      label: c.name,
    }));
  } catch (_) {
    attachClub.value.options = [];
  } finally {
    attachClub.value.loading = false;
  }
}

async function searchTeamOptions() {
  attachTeam.value.loading = true;
  try {
    const q = attachTeam.value.q?.trim();
    const data = await apiFetch(
      `/teams?limit=50${q ? `&search=${encodeURIComponent(q)}` : ''}`
    );
    attachTeam.value.options = (data.teams || []).map((t) => ({
      id: t.id,
      label: `${t.name}${t.birth_year ? ` (${t.birth_year})` : ''}`,
    }));
  } catch (_) {
    attachTeam.value.options = [];
  } finally {
    attachTeam.value.loading = false;
  }
}

watch(
  () => attachClub.value.q,
  () => {
    clearTimeout(linkSearchTimeout);
    linkSearchTimeout = setTimeout(searchClubOptions, 250);
  }
);
watch(
  () => attachTeam.value.q,
  () => {
    clearTimeout(linkSearchTimeout);
    linkSearchTimeout = setTimeout(searchTeamOptions, 250);
  }
);

async function attachClubToGround() {
  if (!selectedGround.value || !attachClub.value.selected) return;
  try {
    await apiFetch(`/grounds/${selectedGround.value.id}/clubs`, {
      method: 'POST',
      body: JSON.stringify({ club_id: attachClub.value.selected }),
    });
    await loadLinks();
    await refreshGroundRow();
    attachClub.value = { q: '', options: [], selected: '', loading: false };
    showToast('Клуб прикреплён');
  } catch (e) {
    showToast(e.message || 'Ошибка прикрепления клуба');
  }
}

async function detachClubFromGround(clubId) {
  if (!selectedGround.value || !clubId) return;
  if (!confirm('Открепить клуб от площадки?')) return;
  try {
    await apiFetch(`/grounds/${selectedGround.value.id}/clubs/${clubId}`, {
      method: 'DELETE',
    });
    await loadLinks();
    await refreshGroundRow();
    showToast('Клуб откреплён');
  } catch (e) {
    showToast(e.message || 'Ошибка открепления клуба');
  }
}

async function attachTeamToGround() {
  if (!selectedGround.value || !attachTeam.value.selected) return;
  try {
    await apiFetch(`/grounds/${selectedGround.value.id}/teams`, {
      method: 'POST',
      body: JSON.stringify({ team_id: attachTeam.value.selected }),
    });
    await loadLinks();
    await refreshGroundRow();
    attachTeam.value = { q: '', options: [], selected: '', loading: false };
    showToast('Команда прикреплена');
  } catch (e) {
    showToast(e.message || 'Ошибка прикрепления команды');
  }
}

async function detachTeamFromGround(teamId) {
  if (!selectedGround.value || !teamId) return;
  if (!confirm('Открепить команду от площадки?')) return;
  try {
    await apiFetch(`/grounds/${selectedGround.value.id}/teams/${teamId}`, {
      method: 'DELETE',
    });
    await loadLinks();
    await refreshGroundRow();
    showToast('Команда откреплена');
  } catch (e) {
    showToast(e.message || 'Ошибка открепления команды');
  }
}

async function syncGrounds() {
  try {
    syncLoading.value = true;
    const res = await apiFetch('/grounds/sync', { method: 'POST' });
    const {
      upserts,
      softDeletedTotal,
      softDeletedArchived,
      softDeletedMissing,
    } = res;
    showToast(
      `Синхронизировано: добавлено/обновлено ${upserts}, удалено ${softDeletedTotal} (архив: ${softDeletedArchived}, отсутствуют: ${softDeletedMissing})`
    );
    await load();
  } catch (e) {
    showToast(e.message || 'Ошибка синхронизации');
  } finally {
    syncLoading.value = false;
  }
}

const activeFiltersCount = computed(() => {
  return [
    filters.withoutAddress,
    filters.withYandex,
    filters.imported,
    filters.withClubs,
    filters.withTeams,
  ].filter(Boolean).length;
});

async function load() {
  try {
    isLoading.value = true;
    const params = new URLSearchParams({
      page: String(currentPage.value),
      limit: String(pageSize.value),
    });
    const term = q.value.trim();
    if (term) params.set('search', term);
    if (filters.withoutAddress) params.set('without_address', 'true');
    if (filters.withYandex) params.set('with_yandex', 'true');
    if (filters.imported) params.set('imported', 'true');
    if (filters.withClubs) params.set('with_clubs', 'true');
    if (filters.withTeams) params.set('with_teams', 'true');
    const data = await apiFetch(`/grounds?${params}`);
    total.value = data.total;
    // Snap current page to bounds after total changes to avoid empty pages
    const pages = Math.max(1, Math.ceil(total.value / pageSize.value));
    if (currentPage.value > pages) {
      currentPage.value = pages;
      return; // watcher will trigger reload
    }
    grounds.value = data.grounds;
  } catch (e) {
    error.value = e.message;
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="py-4 admin-grounds-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-3">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Площадки</li>
        </ol>
      </nav>
      <h1 class="mb-3">Площадки</h1>
      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <BrandSpinner v-if="isLoading" label="Загрузка" />
      <div class="card section-card tile fade-in shadow-sm">
        <div class="card-body p-3">
          <div class="row g-2 align-items-end mb-3">
            <div class="col-12 col-sm">
              <div class="input-group">
                <span class="input-group-text" aria-hidden="true">
                  <i class="bi bi-search"></i>
                </span>
                <input
                  v-model="q"
                  type="search"
                  class="form-control"
                  placeholder="Поиск по названию или адресу"
                  aria-label="Поиск площадок"
                />
              </div>
            </div>
            <div class="col-6 col-sm-auto">
              <button
                class="btn btn-outline-secondary w-100"
                type="button"
                @click="filtersModal.open()"
              >
                <i class="bi bi-funnel me-1" aria-hidden="true"></i>
                Фильтры
                <span
                  v-if="activeFiltersCount"
                  class="badge text-bg-secondary ms-2"
                  >{{ activeFiltersCount }}</span
                >
              </button>
            </div>
            <!-- Removed standalone 'Без адреса' switch. Use Filters modal instead. -->
            <div class="col-12 col-sm-auto d-flex gap-2 justify-content-end">
              <button
                class="btn btn-outline-secondary"
                :disabled="syncLoading"
                @click="syncGrounds"
              >
                <span
                  v-if="syncLoading"
                  class="spinner-border spinner-border-sm me-2"
                ></span>
                Синхронизировать
              </button>
              <button class="btn btn-brand" @click="openCreate">
                <i class="bi bi-plus-lg me-1"></i>Добавить
              </button>
            </div>
          </div>
          <!-- Single-column list with dividers (best-practice list-group inside card) -->
          <ul v-if="grounds.length" class="list-group list-group-flush">
            <li v-for="st in grounds" :key="st.id" class="list-group-item py-3">
              <div class="d-flex align-items-start justify-content-between">
                <div class="me-3 flex-grow-1">
                  <div class="d-flex align-items-start gap-2 mb-1">
                    <h3 class="h6 mb-0">{{ st.name }}</h3>
                    <span
                      v-if="st.external_id"
                      class="badge badge-brand"
                      title="Импортировано из внешней системы"
                      >Импортирован</span
                    >
                  </div>
                  <div class="text-muted small d-flex align-items-center mt-1">
                    <a
                      v-if="st.yandex_url"
                      :href="withHttp(st.yandex_url)"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Открыть в Яндекс.Картах"
                      class="me-1 flex-shrink-0"
                    >
                      <img :src="yandexLogo" alt="Яндекс.Карты" height="20" />
                    </a>
                    <span class="flex-grow-1">
                      {{ st.address?.result || '—' }}
                    </span>
                  </div>
                  <div
                    v-if="metroNames(st.address)"
                    class="text-muted small d-flex align-items-center mt-1"
                  >
                    <img
                      :src="metroIcon"
                      alt="Метро"
                      height="14"
                      class="me-1"
                    />
                    <span>{{ metroNames(st.address) }}</span>
                  </div>
                  <div class="d-flex gap-2 small mt-2">
                    <span class="badge text-bg-light border"
                      >Клубы: {{ st.clubs?.length || 0 }}</span
                    >
                    <span class="badge text-bg-light border"
                      >Команды: {{ st.teams?.length || 0 }}</span
                    >
                  </div>
                </div>
                <div class="text-nowrap">
                  <button
                    class="btn btn-sm btn-outline-secondary me-2"
                    aria-label="Связи площадки"
                    @click="openLinks(st)"
                  >
                    <i class="bi bi-link-45deg"></i>
                  </button>
                  <button
                    class="btn btn-sm btn-secondary me-2"
                    aria-label="Редактировать площадку"
                    @click="openEdit(st)"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button
                    class="btn btn-sm btn-danger"
                    aria-label="Удалить площадку"
                    @click="removeGround(st)"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            </li>
          </ul>
          <div v-else-if="!isLoading" class="alert alert-warning mb-0">
            Площадок нет.
          </div>
        </div>
      </div>
      <PageNav
        v-if="totalPages > 1"
        v-model:page="currentPage"
        v-model:page-size="pageSize"
        :total-pages="totalPages"
        :sizes="[5, 8, 10, 20]"
      />
    </div>

    <!-- Ground links modal -->
    <div ref="linksModalRef" class="modal fade" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Связи: {{ selectedGround?.name }}</h5>
            <button
              type="button"
              class="btn-close"
              @click="linksModal.hide()"
            ></button>
          </div>
          <div class="modal-body">
            <div v-if="linksLoading" class="text-center my-2">
              <div
                class="spinner-border spinner-brand"
                role="status"
                aria-label="Загрузка"
              ></div>
            </div>
            <div v-else class="row g-3">
              <div class="col-12 col-md-6">
                <div class="card h-100">
                  <div class="card-body p-2">
                    <h3 class="h6">Клубы</h3>
                    <div class="mb-2">
                      <div class="input-group input-group-sm mb-2">
                        <span class="input-group-text"
                          ><i class="bi bi-search"></i
                        ></span>
                        <input
                          v-model="attachClub.q"
                          type="search"
                          class="form-control"
                          placeholder="Поиск клуба"
                          aria-label="Поиск клуба"
                        />
                      </div>
                      <div class="input-group input-group-sm">
                        <select
                          v-model="attachClub.selected"
                          class="form-select"
                          :disabled="attachClub.loading"
                        >
                          <option value="">Выберите клуб</option>
                          <option
                            v-for="c in attachClub.options"
                            :key="c.id"
                            :value="c.id"
                          >
                            {{ c.label }}
                          </option>
                        </select>
                        <button
                          class="btn btn-outline-secondary"
                          :disabled="!attachClub.selected"
                          @click="attachClubToGround"
                        >
                          Добавить
                        </button>
                      </div>
                    </div>
                    <div class="table-responsive">
                      <table class="table table-sm align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Клуб</th>
                            <th class="text-end"></th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="c in links.clubs" :key="c.id">
                            <td>{{ c.name }}</td>
                            <td class="text-end">
                              <button
                                class="btn btn-sm btn-link text-danger p-0"
                                @click="detachClubFromGround(c.id)"
                              >
                                <i class="bi bi-x-lg"></i>
                              </button>
                            </td>
                          </tr>
                          <tr v-if="!links.clubs.length">
                            <td colspan="2" class="text-muted">
                              Клубы не прикреплены
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <div class="col-12 col-md-6">
                <div class="card h-100">
                  <div class="card-body p-2">
                    <h3 class="h6">Команды</h3>
                    <div class="mb-2">
                      <div class="input-group input-group-sm mb-2">
                        <span class="input-group-text"
                          ><i class="bi bi-search"></i
                        ></span>
                        <input
                          v-model="attachTeam.q"
                          type="search"
                          class="form-control"
                          placeholder="Поиск команды"
                          aria-label="Поиск команды"
                        />
                      </div>
                      <div class="input-group input-group-sm">
                        <select
                          v-model="attachTeam.selected"
                          class="form-select"
                          :disabled="attachTeam.loading"
                        >
                          <option value="">Выберите команду</option>
                          <option
                            v-for="t in attachTeam.options"
                            :key="t.id"
                            :value="t.id"
                          >
                            {{ t.label }}
                          </option>
                        </select>
                        <button
                          class="btn btn-outline-secondary"
                          :disabled="!attachTeam.selected"
                          @click="attachTeamToGround"
                        >
                          Добавить
                        </button>
                      </div>
                    </div>
                    <div class="table-responsive">
                      <table class="table table-sm align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Команда</th>
                            <th class="text-end"></th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="t in links.teams" :key="t.id">
                            <td>
                              {{ t.name
                              }}<span v-if="t.birth_year" class="text-muted">
                                ({{ t.birth_year }})</span
                              >
                            </td>
                            <td class="text-end">
                              <button
                                class="btn btn-sm btn-link text-danger p-0"
                                @click="detachTeamFromGround(t.id)"
                              >
                                <i class="bi bi-x-lg"></i>
                              </button>
                            </td>
                          </tr>
                          <tr v-if="!links.teams.length">
                            <td colspan="2" class="text-muted">
                              Команды не прикреплены
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-secondary"
              @click="linksModal.hide()"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>

    <div ref="modalRef" class="modal fade" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <form @submit.prevent="save">
            <div class="modal-header">
              <h5 class="modal-title">
                {{ editing ? 'Изменить площадку' : 'Добавить площадку' }}
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
                  id="stadName"
                  v-model="form.name"
                  class="form-control"
                  placeholder="Название"
                  :class="{ 'is-invalid': !!errors.name }"
                  required
                />
                <label for="stadName">Наименование</label>
                <div v-if="errors.name" class="invalid-feedback">
                  {{ errors.name }}
                </div>
              </div>
              <div class="form-floating mb-3 position-relative">
                <textarea
                  id="stadAddr"
                  v-model="form.address.result"
                  class="form-control"
                  rows="2"
                  placeholder="Адрес"
                  autocomplete="street-address"
                  @blur="onAddressBlur"
                ></textarea>
                <label for="stadAddr">Адрес</label>
                <ul
                  v-if="addressSuggestions.length"
                  class="list-group position-absolute w-100"
                  style="z-index: 1050"
                >
                  <li
                    v-for="s in addressSuggestions"
                    :key="s.value"
                    class="list-group-item p-0"
                  >
                    <button
                      type="button"
                      class="list-group-item list-group-item-action w-100 text-start border-0 bg-transparent"
                      @mousedown.prevent="applyAddressSuggestion(s)"
                    >
                      {{ s.value }}
                    </button>
                  </li>
                </ul>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="stadYandex"
                  v-model="form.yandex_url"
                  type="url"
                  class="form-control"
                  placeholder="URL в Яндекс.Картах"
                  :class="{ 'is-invalid': !!errors.yandex_url }"
                />
                <label for="stadYandex">URL в Яндекс.Картах</label>
                <div v-if="errors.yandex_url" class="invalid-feedback">
                  {{ errors.yandex_url }}
                </div>
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
              <button
                type="submit"
                class="btn btn-brand"
                :disabled="saveLoading"
              >
                <span
                  v-if="saveLoading"
                  class="spinner-border spinner-border-sm spinner-brand me-2"
                ></span>
                Сохранить
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    <GroundFiltersModal
      ref="filtersModal"
      :filters="filters"
      @apply="(f) => Object.assign(filters, f)"
      @reset="
        () =>
          Object.assign(filters, {
            withoutAddress: false,
            withYandex: false,
            imported: false,
            withClubs: false,
            withTeams: false,
          })
      "
    />
  </div>
</template>

<style scoped>
.fade-in {
  animation: fadeIn 0.4s ease-out;
}

/* Mobile spacing handled globally */

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
