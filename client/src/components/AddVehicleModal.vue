<script setup>
import { ref, onMounted } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { cleanVehicle } from '../dadata';
import { apiFetch } from '../api';

const emit = defineEmits(['saved']);

const modalRef = ref(null);
let modal;

const form = ref({ vehicle: '', number: '' });
const errors = ref({});

const plateRegex =
  /^[ABEKMHOPCTYXАВЕКМНОРСТУХ]\d{3}[ABEKMHOPCTYXАВЕКМНОРСТУХ]{2}\d{2,3}$/;

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
  if (!form.value.number || !plateRegex.test(form.value.number)) {
    errors.value.number = 'Введите корректный госномер';
    return;
  }
  const clean = await cleanVehicle(form.value.vehicle);
  if (!clean) {
    errors.value.vehicle = 'Введите корректно марку и модель';
    return;
  }
  if (clean.qc === 1) {
    errors.value.vehicle =
      'Попробуйте ввести марку или номер иначе или оставить только марку';
    return;
  }
  if (clean.qc === 2) {
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
    if (err.message.includes('госномер')) {
      errors.value.number = err.message;
    } else {
      errors.value.vehicle = err.message || 'Не удалось сохранить';
    }
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
