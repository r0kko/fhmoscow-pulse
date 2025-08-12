<script setup>
import { ref, reactive, onMounted } from 'vue';
import Modal from 'bootstrap/js/dist/modal';

const props = defineProps({
  filters: { type: Object, required: true },
  signTypes: { type: Array, required: true },
  statuses: { type: Array, required: true },
  docTypes: { type: Array, required: true },
});
const emit = defineEmits(['apply']);

const modalRef = ref(null);
let modal;

const local = reactive({
  search: '',
  number: '',
  signType: '',
  status: '',
  docType: '',
  dateFrom: '',
  dateTo: '',
});

function open() {
  Object.assign(local, props.filters);
  modal.show();
}

function close() {
  modal.hide();
}

function apply() {
  emit('apply', { ...local });
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
            <label for="f-recipient" class="form-label">Получатель</label>
            <input
              id="f-recipient"
              v-model="local.search"
              type="search"
              class="form-control"
              placeholder="ФИО"
            />
          </div>
          <div class="mb-3">
            <label for="f-number" class="form-label">Номер</label>
            <input
              id="f-number"
              v-model="local.number"
              type="search"
              class="form-control"
              placeholder="25.08/1"
            />
          </div>
          <div class="mb-3">
            <label for="f-doc-type" class="form-label">Тип документа</label>
            <select id="f-doc-type" v-model="local.docType" class="form-select">
              <option value="">Все</option>
              <option v-for="dt in docTypes" :key="dt.alias" :value="dt.alias">
                {{ dt.name }}
              </option>
            </select>
          </div>
          <div class="mb-3">
            <label for="f-sign-type" class="form-label">Тип подписи</label>
            <select
              id="f-sign-type"
              v-model="local.signType"
              class="form-select"
            >
              <option value="">Все</option>
              <option v-for="st in signTypes" :key="st.alias" :value="st.alias">
                {{ st.name }}
              </option>
            </select>
          </div>
          <div class="mb-3">
            <label for="f-status" class="form-label">Статус</label>
            <select id="f-status" v-model="local.status" class="form-select">
              <option value="">Все</option>
              <option v-for="s in statuses" :key="s.alias" :value="s.alias">
                {{ s.name }}
              </option>
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label">Дата документа</label>
            <div class="d-flex gap-2">
              <input
                v-model="local.dateFrom"
                type="date"
                class="form-control"
              />
              <input v-model="local.dateTo" type="date" class="form-control" />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="close">
            Отмена
          </button>
          <button type="button" class="btn btn-primary" @click="apply">
            Применить
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
