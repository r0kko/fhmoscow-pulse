<script setup>
import { ref, onMounted } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { cleanVehicle } from '../dadata.js';
import { apiFetch } from '../api.js';

const emit = defineEmits(['saved']);

const modalRef = ref(null);
let modal;

const form = ref({ vehicle: '', number: '' });
const errors = ref({});

function open() {
  form.value = { vehicle: '', number: '' };
  errors.value = {};
  modal.show();
}

defineExpose({ open });

function onNumberInput(e) {
  form.value.number = e.target.value.toUpperCase().replace(/\s/g, '');
}

async function save() {
  errors.value = {};
  const clean = await cleanVehicle(form.value.vehicle);
  if (!clean || [1, 2].includes(clean.qc)) {
    errors.value.vehicle = 'Введите корректно марку и модель';
    return;
  }
  try {
    await apiFetch('/vehicles', {
      method: 'POST',
      body: JSON.stringify({
        vehicle: form.value.vehicle,
        number: form.value.number,
      }),
    });
    modal.hide();
    emit('saved');
  } catch (err) {
    errors.value.number = 'Не удалось сохранить';
  }
}

onMounted(() => {
  modal = new Modal(modalRef.value);
});
</script>

<template>
  <div ref="modalRef" class="modal fade" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Добавить транспортное средство</h5>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Закрыть"
          ></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label class="form-label">Марка и модель</label>
            <input
              v-model="form.vehicle"
              class="form-control"
              :class="{ 'is-invalid': errors.vehicle }"
            />
            <div class="invalid-feedback">{{ errors.vehicle }}</div>
          </div>
          <div class="mb-3">
            <label class="form-label">Госномер</label>
            <input
              :value="form.number"
              class="form-control"
              :class="{ 'is-invalid': errors.number }"
              @input="onNumberInput"
            />
            <div class="invalid-feedback">{{ errors.number }}</div>
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            data-bs-dismiss="modal"
          >
            Отмена
          </button>
          <button type="button" class="btn btn-brand" @click="save">
            Сохранить
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
