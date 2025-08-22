<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import Modal from 'bootstrap/js/dist/modal';

const props = defineProps({
  filters: { type: Object, required: true },
  clubs: { type: Array, default: () => [] },
});
const emit = defineEmits(['apply', 'reset']);

const modalRef = ref(null);
let modal;

const local = reactive({
  clubId: '',
  birthYear: '',
  status: 'ACTIVE',
});

const currentYear = new Date().getFullYear();
const years = computed(() =>
  Array.from({ length: 35 }, (_, i) => currentYear - i)
);

function open() {
  Object.assign(local, {
    clubId: props.filters.clubId || '',
    birthYear: props.filters.birthYear || '',
    status: props.filters.status || 'ACTIVE',
  });
  modal.show();
}

function close() {
  modal.hide();
}

function apply() {
  emit('apply', { ...local });
  modal.hide();
}

function reset() {
  local.clubId = '';
  local.birthYear = '';
  local.status = 'ACTIVE';
  emit('reset');
  modal.hide();
}

onMounted(() => {
  modal = new Modal(modalRef.value);
});

defineExpose({ open });
</script>

<template>
  <div ref="modalRef" class="modal fade" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Фильтры</h5>
          <button
            type="button"
            class="btn-close"
            aria-label="Close"
            @click="close"
          ></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label for="f-status" class="form-label">Статус</label>
            <select id="f-status" v-model="local.status" class="form-select">
              <option value="ACTIVE">Активные</option>
              <option value="ARCHIVED">Архив</option>
              <option value="ALL">Все</option>
            </select>
          </div>
          <div class="mb-3">
            <label for="f-club" class="form-label">Клуб</label>
            <select id="f-club" v-model="local.clubId" class="form-select">
              <option value="">Все</option>
              <option value="none">Без клуба</option>
              <option v-for="c in clubs" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select>
          </div>
          <div class="mb-0">
            <label for="f-year" class="form-label">Год</label>
            <select id="f-year" v-model="local.birthYear" class="form-select">
              <option value="">Все</option>
              <option v-for="y in years" :key="y" :value="y.toString()">
                {{ y }}
              </option>
            </select>
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
