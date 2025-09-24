<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api';
import PageNav from '@/components/PageNav.vue';
import { loadPageSize, savePageSize } from '../utils/pageSize';
import {
  cleanAddress,
  suggestAddress,
  type AddressSuggestion,
  type CleanAddressResult,
} from '../dadata';
import { useToast } from '../utils/toast';
import ConfirmModal from '@/components/ConfirmModal.vue';
import { formatRussianPhone, normalizeRussianPhone } from '../utils/personal';
import type {
  AddressSummary,
  AdminMedicalCenter,
  AdminMedicalCenterListResponse,
} from '../types/admin';

interface ConfirmModalInstance {
  open: () => void;
}

interface MedicalCenterForm {
  name: string;
  inn: string;
  address: AddressSummary;
  phone: string;
  email: string;
  website: string;
}

function createEmptyForm(): MedicalCenterForm {
  return {
    name: '',
    inn: '',
    address: { result: '' },
    phone: '',
    email: '',
    website: '',
  };
}

const centers = ref<AdminMedicalCenter[]>([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref<number>(loadPageSize('adminMedCentersPageSize', 8));
const isLoading = ref(false);
const error = ref('');

const form = ref<MedicalCenterForm>(createEmptyForm());
const phoneInput = ref('');
const editing = ref<AdminMedicalCenter | null>(null);
const modalRef = ref<HTMLDivElement | null>(null);
let modal: InstanceType<typeof Modal> | null = null;
const formError = ref('');
const addrSuggestions = ref<AddressSuggestion[]>([]);
let addrTimeout: ReturnType<typeof setTimeout> | null = null;

const confirmRef = ref<ConfirmModalInstance | null>(null);
const confirmMessage = ref('');
let confirmAction: (() => Promise<void>) | null = null;

const { showToast } = useToast();

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / Math.max(pageSize.value, 1)))
);

function updatePhoneFromDigits(raw: string): void {
  const normalized = normalizeRussianPhone(raw);
  form.value.phone = normalized;
  phoneInput.value = formatRussianPhone(normalized);
}

function formatPhone(value: string | null | undefined): string {
  return formatRussianPhone(value ?? '');
}

async function load(): Promise<void> {
  try {
    isLoading.value = true;
    const params = new URLSearchParams({
      page: String(currentPage.value),
      limit: String(pageSize.value),
    });
    const data = await apiFetch<AdminMedicalCenterListResponse>(
      `/medical-centers?${params}`
    );
    centers.value = data.centers ?? [];
    total.value = Number.isFinite(data.total) ? data.total : 0;
    error.value = '';
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Не удалось загрузить';
    centers.value = [];
    total.value = 0;
  } finally {
    isLoading.value = false;
  }
}

function closeFormModal(): void {
  modal?.hide();
}

function resetForm(center?: AdminMedicalCenter | null): void {
  if (center) {
    form.value = {
      name: center.name ?? '',
      inn: center.inn ?? '',
      address: { result: center.address?.result ?? '' },
      phone: center.phone ?? '',
      email: center.email ?? '',
      website: center.website ?? '',
    };
  } else {
    form.value = createEmptyForm();
  }
  updatePhoneFromDigits(form.value.phone);
  formError.value = '';
  addrSuggestions.value = [];
}

function openCreate(): void {
  editing.value = null;
  resetForm(null);
  modal?.show();
}

function openEdit(center: AdminMedicalCenter): void {
  editing.value = center;
  resetForm(center);
  modal?.show();
}

function applyAddrSuggestion(suggestion: AddressSuggestion): void {
  form.value.address = { result: suggestion.value };
  addrSuggestions.value = [];
}

async function onAddrBlur(): Promise<void> {
  if (!form.value.address.result) {
    addrSuggestions.value = [];
    return;
  }
  try {
    const cleaned: CleanAddressResult | null = await cleanAddress(
      form.value.address.result
    );
    if (cleaned?.result) {
      form.value.address = { result: cleaned.result };
    }
  } finally {
    addrSuggestions.value = [];
  }
}

function onPhoneInput(event: Event): void {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  updatePhoneFromDigits(target.value);
}

function onPhoneKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Backspace' && event.key !== 'Delete') return;
  event.preventDefault();
  form.value.phone = form.value.phone.slice(0, -1);
  phoneInput.value = formatRussianPhone(form.value.phone);
}

async function save(): Promise<void> {
  try {
    formError.value = '';
    const payload: Record<string, unknown> = {
      name: form.value.name.trim(),
      inn: form.value.inn.trim(),
      phone: form.value.phone,
      email: form.value.email.trim(),
      website: form.value.website.trim(),
    };
    const address = form.value.address.result?.trim();
    if (address) {
      payload['address'] = { result: address } satisfies AddressSummary;
    }

    const isEditing = Boolean(editing.value);
    const endpoint = isEditing
      ? `/medical-centers/${editing.value?.id}`
      : '/medical-centers';
    const method = isEditing ? 'PUT' : 'POST';

    await apiFetch(endpoint, {
      method,
      body: JSON.stringify(payload),
    });
    closeFormModal();
    showToast(isEditing ? 'Запись обновлена' : 'Запись добавлена');
    await load();
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Ошибка сохранения';
  }
}

function confirmRemove(center: AdminMedicalCenter): void {
  confirmMessage.value = `Удалить медицинский центр «${center.name}»?`;
  confirmAction = async () => {
    try {
      await apiFetch(`/medical-centers/${center.id}`, { method: 'DELETE' });
      showToast('Запись удалена');
      await load();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Не удалось удалить запись'
      );
    }
  };
  confirmRef.value?.open();
}

function onConfirm(): void {
  const action = confirmAction;
  confirmAction = null;
  if (action) void action();
}

onMounted(() => {
  modal = new Modal(modalRef.value);
  void load();
});

onBeforeUnmount(() => {
  if (addrTimeout) clearTimeout(addrTimeout);
  modal?.hide();
  modal?.dispose();
  modal = null;
});

watch(currentPage, () => {
  void load();
});

watch(pageSize, (val) => {
  currentPage.value = 1;
  savePageSize('adminMedCentersPageSize', val);
  void load();
});

watch(
  () => form.value.address.result,
  (value) => {
    if (addrTimeout) clearTimeout(addrTimeout);
    if (!value || value.trim().length < 3) {
      addrSuggestions.value = [];
      return;
    }
    const query = value.trim();
    addrTimeout = setTimeout(async () => {
      addrSuggestions.value = await suggestAddress(query);
    }, 300);
  }
);
</script>

<template>
  <div>
    <div class="card section-card tile fade-in shadow-sm mb-4">
      <div
        class="card-header d-flex justify-content-between align-items-center"
      >
        <h2 class="h5 mb-0">Медицинские центры</h2>
        <button class="btn btn-brand" @click="openCreate">
          <i class="bi bi-plus-lg me-1"></i>Добавить
        </button>
      </div>
      <div class="card-body">
        <div v-if="error" class="alert alert-danger mb-3">{{ error }}</div>
        <div v-if="isLoading" class="text-center my-3">
          <div
            class="spinner-border spinner-brand"
            role="status"
            aria-label="Загрузка"
          ></div>
        </div>
        <div v-if="centers.length" class="table-responsive d-none d-sm-block">
          <table class="table table-striped align-middle mb-0">
            <thead>
              <tr>
                <th>Название</th>
                <th>ИНН</th>
                <th>Адрес</th>
                <th>Телефон</th>
                <th>Email</th>
                <th>Сайт</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in centers" :key="c.id">
                <td>{{ c.name }}</td>
                <td>{{ c.inn }}</td>
                <td>{{ c.address?.result || '' }}</td>
                <td>{{ formatPhone(c.phone) }}</td>
                <td>{{ c.email }}</td>
                <td>
                  <a
                    v-if="c.website"
                    :href="c.website"
                    target="_blank"
                    rel="noopener"
                    >{{ c.website }}</a
                  >
                </td>
                <td class="text-end">
                  <button
                    class="btn btn-sm btn-secondary me-2"
                    aria-label="Редактировать центр"
                    @click="openEdit(c)"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button
                    class="btn btn-sm btn-danger"
                    aria-label="Удалить центр"
                    @click="confirmRemove(c)"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="centers.length" class="d-block d-sm-none">
          <div v-for="c in centers" :key="c.id" class="card mb-2">
            <div class="card-body p-2">
              <h3 class="h6 mb-1">{{ c.name }}</h3>
              <p class="mb-1 small">ИНН: {{ c.inn || '—' }}</p>
              <p class="mb-1 small">Адрес: {{ c.address?.result || '—' }}</p>
              <p class="mb-1 small">Телефон: {{ formatPhone(c.phone) }}</p>
              <p class="mb-1 small">Email: {{ c.email || '—' }}</p>
              <p v-if="c.website" class="mb-2 small">
                <a :href="c.website" target="_blank" rel="noopener">
                  {{ c.website }}
                </a>
              </p>
              <div class="text-end">
                <button
                  class="btn btn-sm btn-secondary me-2"
                  @click="openEdit(c)"
                >
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-danger" @click="confirmRemove(c)">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
        <p v-else-if="!isLoading" class="text-muted mb-0">Записей нет.</p>
      </div>
    </div>
    <PageNav
      v-if="totalPages > 1"
      v-model:page="currentPage"
      v-model:page-size="pageSize"
      :total-pages="totalPages"
      :sizes="[5, 8, 10, 20]"
    />

    <div ref="modalRef" class="modal fade" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <form @submit.prevent="save">
            <div class="modal-header">
              <h2 class="modal-title h5">
                {{ editing ? 'Изменить центр' : 'Добавить центр' }}
              </h2>
              <button
                type="button"
                class="btn-close"
                @click="closeFormModal"
              ></button>
            </div>
            <div class="modal-body">
              <div v-if="formError" class="alert alert-danger">
                {{ formError }}
              </div>
              <div class="form-floating mb-3">
                <input
                  id="mcName"
                  v-model="form.name"
                  class="form-control"
                  placeholder="Название"
                  required
                />
                <label for="mcName">Наименование</label>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="mcInn"
                  v-model="form.inn"
                  class="form-control"
                  placeholder="ИНН"
                  required
                />
                <label for="mcInn">ИНН</label>
              </div>
              <div class="form-floating mb-3 position-relative">
                <textarea
                  id="mcAddr"
                  v-model="form.address.result"
                  class="form-control"
                  rows="2"
                  placeholder="Адрес"
                  autocomplete="street-address"
                  @blur="onAddrBlur"
                ></textarea>
                <label for="mcAddr">Адрес</label>
                <ul
                  v-if="addrSuggestions.length"
                  class="list-group position-absolute w-100"
                  style="z-index: 1050"
                >
                  <li
                    v-for="s in addrSuggestions"
                    :key="s.value"
                    class="list-group-item p-0"
                  >
                    <button
                      type="button"
                      class="list-group-item list-group-item-action w-100 text-start border-0 bg-transparent"
                      @mousedown.prevent="applyAddrSuggestion(s)"
                    >
                      {{ s.value }}
                    </button>
                  </li>
                </ul>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="mcPhone"
                  v-model="phoneInput"
                  type="tel"
                  class="form-control"
                  placeholder="Телефон"
                  inputmode="tel"
                  autocomplete="tel"
                  @input="onPhoneInput"
                  @keydown="onPhoneKeydown"
                />
                <label for="mcPhone">Телефон</label>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="mcEmail"
                  v-model="form.email"
                  type="email"
                  class="form-control"
                  placeholder="Email"
                />
                <label for="mcEmail">Email</label>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="mcWeb"
                  v-model="form.website"
                  type="url"
                  class="form-control"
                  placeholder="Сайт"
                />
                <label for="mcWeb">Сайт</label>
              </div>
            </div>
            <div class="modal-footer">
              <button
                type="button"
                class="btn btn-secondary"
                @click="closeFormModal"
              >
                Отмена
              </button>
              <button type="submit" class="btn btn-brand">Сохранить</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <ConfirmModal
      ref="confirmRef"
      confirm-text="Удалить"
      confirm-variant="danger"
      @confirm="onConfirm"
    >
      <p class="mb-0">{{ confirmMessage }}</p>
    </ConfirmModal>
  </div>
</template>

<style scoped>
.list-group {
  max-height: 200px;
  overflow-y: auto;
}

.fade-in {
  animation: fadeIn 0.4s ease-out;
}

/* Use global section-card mobile gutters */

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
