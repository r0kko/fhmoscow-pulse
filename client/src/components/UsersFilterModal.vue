<script setup>
import { ref, watch, onMounted } from 'vue';
import Modal from 'bootstrap/js/dist/modal';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  search: { type: String, default: '' },
  status: { type: String, default: '' },
  role: { type: String, default: '' },
  roles: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:modelValue', 'apply', 'reset']);

const el = ref(null);
let instance;

const s = ref(props.search);
const st = ref(props.status);
const r = ref(props.role);

function open() {
  s.value = props.search;
  st.value = props.status;
  r.value = props.role;
  instance?.show();
}
function close() {
  instance?.hide();
  emit('update:modelValue', false);
}
function apply() {
  emit('apply', { search: s.value, status: st.value, role: r.value });
  close();
}
function reset() {
  s.value = '';
  st.value = '';
  r.value = '';
  emit('reset');
  close();
}

onMounted(() => {
  instance = new Modal(el.value);
  if (props.modelValue) open();
  el.value?.addEventListener('hidden.bs.modal', () => {
    emit('update:modelValue', false);
  });
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
            @click="close"
          ></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label for="fltSearch" class="form-label">Поиск</label>
            <input
              id="fltSearch"
              v-model.trim="s"
              type="search"
              class="form-control"
              placeholder="ФИО, телефон, email"
              aria-label="Поиск по ФИО, телефону, email"
            />
          </div>
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
