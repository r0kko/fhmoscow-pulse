<script setup>
import { computed, ref, watch } from 'vue';
import { apiFetch } from '../api';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  player: { type: Object, default: null },
  seasonId: { type: String, required: true },
  teamId: { type: String, required: true },
  clubId: { type: String, required: true },
  roles: { type: Array, default: () => [] }, // [{id,name}]
});
const emit = defineEmits(['update:modelValue', 'saved']);

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const saving = ref(false);
const error = ref('');
const form = ref({
  height: null,
  weight: null,
  grip: '',
  jersey_number: null,
  role_id: null,
});

const touched = ref({
  height: false,
  weight: false,
  grip: false,
  jersey: false,
  role: false,
});

const validators = {
  height(v) {
    if (v == null || v === '') return null; // optional
    const n = Number(v);
    if (!Number.isFinite(n)) return 'Укажите число';
    if (n < 90 || n > 220) return 'Рост должен быть от 90 до 220 см';
    return null;
  },
  weight(v) {
    if (v == null || v === '') return null; // optional
    const n = Number(v);
    if (!Number.isFinite(n)) return 'Укажите число';
    if (n < 10 || n > 140) return 'Вес должен быть от 10 до 140 кг';
    return null;
  },
  grip(v) {
    if (!v) return 'Выберите хват';
    if (v !== 'Правый' && v !== 'Левый') return 'Некорректное значение';
    return null;
  },
  jersey(v) {
    if (v == null || v === '') return 'Укажите номер';
    const n = Number(v);
    if (!Number.isFinite(n)) return 'Укажите число';
    if (n < 1 || n > 99) return 'Номер должен быть от 1 до 99';
    return null;
  },
  role(v) {
    if (!v) return 'Выберите амплуа';
    return null;
  },
};

const errors = computed(() => ({
  height: validators.height(form.value.height),
  weight: validators.weight(form.value.weight),
  grip: validators.grip(form.value.grip),
  jersey: validators.jersey(form.value.jersey_number),
  role: validators.role(form.value.role_id),
}));

const isValid = computed(
  () =>
    !errors.value.height &&
    !errors.value.weight &&
    !errors.value.grip &&
    !errors.value.jersey &&
    !errors.value.role
);

watch(
  () => props.player,
  (p) => {
    if (!p) return;
    form.value = {
      height: p.height ?? null,
      weight: p.weight ?? null,
      grip: p.grip ?? '',
      jersey_number: p.jersey_number ?? null,
      role_id: p.role?.id || null,
    };
  },
  { immediate: true }
);

function close() {
  open.value = false;
}

async function save() {
  if (!props.player) return;
  saving.value = true;
  error.value = '';
  try {
    const payload = {
      season_id: props.seasonId,
      team_id: props.teamId,
      club_id: props.clubId,
      height:
        form.value.height == null || form.value.height === ''
          ? null
          : Number(form.value.height),
      weight:
        form.value.weight == null || form.value.weight === ''
          ? null
          : Number(form.value.weight),
      grip: form.value.grip,
      jersey_number:
        form.value.jersey_number == null || form.value.jersey_number === ''
          ? null
          : Number(form.value.jersey_number),
      role_id: form.value.role_id,
    };
    // Frontend guard: prevent submission if invalid
    if (!isValid.value) {
      touched.value = {
        height: true,
        weight: true,
        grip: true,
        jersey: true,
        role: true,
      };
      const firstError =
        errors.value.grip ||
        errors.value.jersey ||
        errors.value.role ||
        errors.value.height ||
        errors.value.weight;
      if (firstError) error.value = firstError;
      return;
    }
    const res = await apiFetch(
      `/players/${props.player.id}/anthro-and-roster`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    emit('saved', res.updated || null);
    close();
  } catch (e) {
    error.value = e?.message || 'Не удалось сохранить изменения';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div
    v-if="open"
    class="modal fade show"
    tabindex="-1"
    role="dialog"
    style="display: block; background: rgba(0, 0, 0, 0.5)"
    aria-modal="true"
  >
    <div class="modal-dialog modal-dialog-scrollable" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Изменить данные игрока</h5>
          <button
            type="button"
            class="btn-close"
            aria-label="Закрыть"
            @click="close"
          ></button>
        </div>
        <div class="modal-body">
          <div v-if="error" class="alert alert-danger">{{ error }}</div>
          <div class="row g-3">
            <div class="col-12">
              <label class="form-label">Игрок</label>
              <div class="form-control-plaintext fw-semibold">
                {{ player?.full_name || '—' }}
              </div>
            </div>

            <div class="col-6">
              <label for="editHeight" class="form-label">Рост (см)</label>
              <input
                id="editHeight"
                v-model.number="form.height"
                type="number"
                class="form-control"
                min="90"
                max="220"
                placeholder="Напр.: 175"
                :aria-invalid="touched.height && !!errors.height"
                @blur="touched.height = true"
              />
              <div
                v-if="touched.height && errors.height"
                class="invalid-feedback d-block"
              >
                {{ errors.height }}
              </div>
            </div>
            <div class="col-6">
              <label for="editWeight" class="form-label">Вес (кг)</label>
              <input
                id="editWeight"
                v-model.number="form.weight"
                type="number"
                class="form-control"
                min="10"
                max="140"
                placeholder="Напр.: 65"
                :aria-invalid="touched.weight && !!errors.weight"
                @blur="touched.weight = true"
              />
              <div
                v-if="touched.weight && errors.weight"
                class="invalid-feedback d-block"
              >
                {{ errors.weight }}
              </div>
            </div>
            <div class="col-12">
              <label for="editGrip" class="form-label">Хват</label>
              <select
                id="editGrip"
                v-model="form.grip"
                class="form-select"
                :aria-invalid="touched.grip && !!errors.grip"
                @blur="touched.grip = true"
              >
                <option disabled value="">— Выберите хват —</option>
                <option value="Правый">Правый</option>
                <option value="Левый">Левый</option>
              </select>
              <div
                v-if="touched.grip && errors.grip"
                class="invalid-feedback d-block"
              >
                {{ errors.grip }}
              </div>
            </div>
            <div class="col-6">
              <label for="editJersey" class="form-label">Игровой номер</label>
              <input
                id="editJersey"
                v-model.number="form.jersey_number"
                type="number"
                class="form-control"
                min="1"
                max="99"
                placeholder="1–99"
                :aria-invalid="touched.jersey && !!errors.jersey"
                @blur="touched.jersey = true"
              />
              <div
                v-if="touched.jersey && errors.jersey"
                class="invalid-feedback d-block"
              >
                {{ errors.jersey }}
              </div>
            </div>
            <div class="col-6">
              <label for="editRole" class="form-label">Амплуа</label>
              <select
                id="editRole"
                v-model="form.role_id"
                class="form-select"
                :aria-invalid="touched.role && !!errors.role"
                @blur="touched.role = true"
              >
                <option disabled :value="null">— Выберите амплуа —</option>
                <option v-for="r in roles" :key="r.id" :value="r.id">
                  {{ r.name }}
                </option>
              </select>
              <div
                v-if="touched.role && errors.role"
                class="invalid-feedback d-block"
              >
                {{ errors.role }}
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="close">
            Отмена
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="saving || !isValid"
            @click="save"
          >
            <span v-if="saving" class="spinner-border spinner-border-sm me-2" />
            Сохранить
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal .form-label {
  margin-bottom: 0.25rem;
}
</style>
