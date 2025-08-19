<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import Modal from 'bootstrap/js/dist/modal';

const props = defineProps({
  title: { type: String, default: 'Подтверждение' },
  confirmText: { type: String, default: 'Подтвердить' },
  cancelText: { type: String, default: 'Отмена' },
  confirmVariant: { type: String, default: 'danger' },
});

const emit = defineEmits(['confirm', 'cancel']);

const el = ref(null);
let instance;

onMounted(() => {
  instance = new Modal(el.value, { backdrop: 'static' });
});

onBeforeUnmount(() => {
  try {
    instance?.hide();
  } catch (_) {}
  instance = undefined;
});

function open() {
  instance?.show();
}

function close() {
  instance?.hide();
}

defineExpose({ open, close });

function onConfirm() {
  emit('confirm');
  close();
}

function onCancel() {
  emit('cancel');
  close();
}
</script>

<template>
  <div
    ref="el"
    class="modal fade"
    tabindex="-1"
    aria-modal="true"
    role="dialog"
  >
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title h5">{{ title }}</h2>
          <button
            type="button"
            class="btn-close"
            aria-label="Закрыть"
            @click="onCancel"
          ></button>
        </div>
        <div class="modal-body">
          <slot>
            <p class="mb-0">Подтвердите выполнение действия.</p>
          </slot>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="onCancel">
            {{ cancelText }}
          </button>
          <button
            type="button"
            class="btn"
            :class="`btn-${confirmVariant}`"
            @click="onConfirm"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Inherit project design system */
</style>
