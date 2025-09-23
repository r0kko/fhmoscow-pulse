<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import type { UserRoleOption } from '../types/admin';

const props = withDefaults(
  defineProps<{
    modelValue?: boolean;
    status?: string;
    role?: string;
    roles?: UserRoleOption[];
  }>(),
  {
    modelValue: false,
    status: '',
    role: '',
    roles: () => [] as UserRoleOption[],
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'apply', payload: { status: string; role: string }): void;
  (e: 'reset'): void;
}>();

const el = ref<HTMLDivElement | null>(null);
let instance: InstanceType<typeof Modal> | null = null;
let skipHiddenEmit = false;

const st = ref<string>(props.status);
const r = ref<string>(props.role);

function open(): void {
  st.value = props.status;
  r.value = props.role;
  instance?.show();
}

function close(emitUpdate = false): void {
  if (emitUpdate) {
    skipHiddenEmit = true;
    emit('update:modelValue', false);
  }
  instance?.hide();
}

function apply(): void {
  emit('apply', { status: st.value, role: r.value });
  close(true);
}

function reset(): void {
  st.value = '';
  r.value = '';
  emit('reset');
  close(true);
}

onMounted(() => {
  instance = new Modal(el.value);
  if (props.modelValue) open();
  el.value?.addEventListener('hidden.bs.modal', () => {
    if (skipHiddenEmit) {
      skipHiddenEmit = false;
      return;
    }
    emit('update:modelValue', false);
  });
});

onBeforeUnmount(() => {
  instance?.hide();
  instance?.dispose();
  instance = null;
});

watch(
  () => props.modelValue,
  (val) => {
    if (val) open();
    else close();
  }
);

defineExpose({ open, close });
</script>

<template>
  <div
    ref="el"
    class="modal fade"
    tabindex="-1"
    role="dialog"
    aria-modal="true"
  >
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title h5">Фильтры</h2>
          <button
            type="button"
            class="btn-close"
            aria-label="Закрыть"
            @click="close(true)"
          ></button>
        </div>
        <div class="modal-body">
          <div class="row g-2">
            <div class="col-12 col-sm-6">
              <label for="fltStatus" class="form-label">Статус</label>
              <select id="fltStatus" v-model="st" class="form-select">
                <option value="">Все статусы</option>
                <option value="ACTIVE">Активные</option>
                <option value="INACTIVE">Заблокированные</option>
                <option value="AWAITING_CONFIRMATION">
                  Требуют подтверждения
                </option>
              </select>
            </div>
            <div class="col-12 col-sm-6">
              <label for="fltRole" class="form-label">Роль</label>
              <select id="fltRole" v-model="r" class="form-select">
                <option value="">Все роли</option>
                <option value="NO_ROLE">Без роли</option>
                <option
                  v-for="roleOpt in roles"
                  :key="roleOpt.id"
                  :value="roleOpt.alias"
                >
                  {{ roleOpt.name }}
                </option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            @click="reset"
          >
            Сбросить
          </button>
          <button type="button" class="btn btn-brand" @click="apply">
            Применить
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Inherits project design system */
</style>
