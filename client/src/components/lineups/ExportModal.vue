<script setup>
import { onMounted, ref } from 'vue';

const props = defineProps({
  exportRequirements: { type: Array, default: () => [] },
  exportDisabled: { type: Boolean, default: true },
  onConfirm: { type: Function, default: null },
  onReady: { type: Function, default: null },
});
const modalEl = ref(null);
onMounted(() => {
  if (props.onReady) props.onReady(modalEl.value);
});
</script>

<template>
  <div ref="modalEl" class="modal fade" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title h5">Готовность к выгрузке</h2>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
          ></button>
        </div>
        <div class="modal-body">
          <div class="mb-2 text-muted">
            <span v-if="exportRequirements.filter((r) => !r.ok).length === 0"
              >Все условия выполнены. Можно выгружать PDF.</span
            >
            <span v-else
              >Перед выгрузкой PDF убедитесь, что выполнены условия:</span
            >
          </div>
          <ul class="mb-0 ps-3">
            <li
              v-for="r in exportRequirements"
              :key="r.key"
              :class="r.ok ? 'text-success' : 'text-danger'"
            >
              <span class="me-1">{{ r.ok ? '✔' : '✖' }}</span
              >{{ r.text }}
            </li>
          </ul>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            data-bs-dismiss="modal"
          >
            Закрыть
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="exportDisabled"
            @click="() => onConfirm && onConfirm()"
          >
            Экспорт PDF
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
