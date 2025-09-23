<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import Modal from 'bootstrap/js/dist/modal';

const props = withDefaults(
  defineProps<{
    title?: string;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: string;
  }>(),
  {
    title: 'Подтверждение',
    confirmText: 'Подтвердить',
    cancelText: 'Отмена',
    confirmVariant: 'danger',
  }
);

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

const el = ref<HTMLDivElement | null>(null);
let instance: InstanceType<typeof Modal> | null = null;

onMounted(() => {
  instance = new Modal(el.value, { backdrop: 'static' });
});

onBeforeUnmount(() => {
  instance?.hide();
  instance?.dispose();
  instance = null;
});

function open(): void {
  instance?.show();
}

function close(): void {
  instance?.hide();
}

defineExpose({ open, close });

function onConfirm(): void {
  emit('confirm');
  close();
}

function onCancel(): void {
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
