<script setup lang="ts">
// @ts-nocheck
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import Modal from 'bootstrap/js/dist/modal';

const open = defineModel<boolean>('open', { required: true });

const props = defineProps<{
  loading: boolean;
  error: string;
  form: {
    date_start: string;
    ground_id: string;
  };
  grounds: Array<{ id: string; name: string }>;
}>();

const emit = defineEmits<{
  save: [];
  change: [Record<string, string>];
}>();

const localDateStart = computed({
  get: () => props.form.date_start || '',
  set: (value: string) => emit('change', { date_start: value || '' }),
});

const localGroundId = computed({
  get: () => props.form.ground_id || '',
  set: (value: string) => emit('change', { ground_id: value || '' }),
});

const modalRef = ref<HTMLElement | null>(null);
let modal: Modal | null = null;

function ensureModal(): void {
  if (!modalRef.value || modal) return;
  modal = new Modal(modalRef.value, { backdrop: true, focus: true });
  modalRef.value.addEventListener('hidden.bs.modal', () => {
    open.value = false;
  });
}

watch(
  () => open.value,
  (value) => {
    ensureModal();
    if (!modal) return;
    if (value) modal.show();
    else modal.hide();
  }
);

onBeforeUnmount(() => {
  modal?.dispose();
  modal = null;
});
</script>

<template>
  <div
    ref="modalRef"
    class="modal fade"
    tabindex="-1"
    aria-labelledby="matchEditModalLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h2 id="matchEditModalLabel" class="modal-title h5">
            Редактирование матча
          </h2>
          <button
            type="button"
            class="btn-close"
            aria-label="Закрыть"
            @click="open = false"
          ></button>
        </div>
        <div class="modal-body">
          <div v-if="props.error" class="alert alert-danger py-2">
            {{ props.error }}
          </div>
          <div class="mb-2">
            <label class="form-label">Дата и время</label>
            <input
              v-model="localDateStart"
              type="datetime-local"
              class="form-control"
              :disabled="props.loading"
            />
          </div>
          <div>
            <label class="form-label">Стадион</label>
            <select
              v-model="localGroundId"
              class="form-select"
              :disabled="props.loading"
            >
              <option value="">Не указан</option>
              <option
                v-for="ground in props.grounds"
                :key="ground.id"
                :value="ground.id"
              >
                {{ ground.name }}
              </option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary icon-action"
            title="Отмена"
            aria-label="Отмена"
            @click="open = false"
          >
            <i class="bi bi-x-lg" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="btn btn-brand icon-action"
            :disabled="props.loading"
            title="Сохранить изменения"
            aria-label="Сохранить изменения"
            @click="emit('save')"
          >
            <span
              v-if="props.loading"
              class="spinner-border spinner-border-sm me-2"
              aria-hidden="true"
            ></span>
            <i v-else class="bi bi-check2" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.icon-action {
  min-width: 2rem;
  min-height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
