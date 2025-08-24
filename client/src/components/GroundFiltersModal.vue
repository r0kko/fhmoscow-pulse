<script setup>
import { ref, reactive, onMounted } from 'vue';
import Modal from 'bootstrap/js/dist/modal';

const props = defineProps({
  filters: { type: Object, required: true },
});
const emit = defineEmits(['apply', 'reset']);

const modalRef = ref(null);
let modal;

const local = reactive({
  withoutAddress: false,
  withYandex: false,
  imported: false,
  withClubs: false,
  withTeams: false,
});

function open() {
  Object.assign(local, {
    withoutAddress: !!props.filters.withoutAddress,
    withYandex: !!props.filters.withYandex,
    imported: !!props.filters.imported,
    withClubs: !!props.filters.withClubs,
    withTeams: !!props.filters.withTeams,
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
  local.withoutAddress = false;
  local.withYandex = false;
  local.imported = false;
  local.withClubs = false;
  local.withTeams = false;
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
          <div class="form-check mb-2">
            <input
              id="f-withoutAddress"
              v-model="local.withoutAddress"
              class="form-check-input"
              type="checkbox"
            />
            <label class="form-check-label" for="f-withoutAddress"
              >Без адреса</label
            >
          </div>
          <div class="form-check mb-2">
            <input
              id="f-withYandex"
              v-model="local.withYandex"
              class="form-check-input"
              type="checkbox"
            />
            <label class="form-check-label" for="f-withYandex"
              >Есть ссылка (Яндекс.Карты)</label
            >
          </div>
          <div class="form-check mb-2">
            <input
              id="f-imported"
              v-model="local.imported"
              class="form-check-input"
              type="checkbox"
            />
            <label class="form-check-label" for="f-imported"
              >Импортированы</label
            >
          </div>
          <hr />
          <div class="form-check mb-2">
            <input
              id="f-withClubs"
              v-model="local.withClubs"
              class="form-check-input"
              type="checkbox"
            />
            <label class="form-check-label" for="f-withClubs">Есть клубы</label>
          </div>
          <div class="form-check mb-0">
            <input
              id="f-withTeams"
              v-model="local.withTeams"
              class="form-check-input"
              type="checkbox"
            />
            <label class="form-check-label" for="f-withTeams"
              >Есть команды</label
            >
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
