<script setup>
import { computed } from 'vue';

const props = defineProps({
  saving: { type: Boolean, default: false },
  pendingPlayers: { type: Boolean, default: false },
  pendingStaff: { type: Boolean, default: false },
  isOnline: { type: Boolean, default: true },
});

const text = computed(() => {
  if (props.saving) return 'Идёт сохранение изменений…';
  if (props.pendingPlayers || props.pendingStaff)
    return props.isOnline
      ? 'Синхронизируем изменения…'
      : 'Вы офлайн — синхронизируем при подключении';
  return 'Все изменения синхронизированы';
});
</script>

<template>
  <div
    class="mb-2 small text-muted d-flex align-items-center"
    aria-live="polite"
  >
    <div>{{ text }}</div>
    <div class="ms-2" :title="isOnline ? 'Онлайн' : 'Оффлайн'">
      <span
        :style="{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
        }"
        :class="isOnline ? 'bg-success' : 'bg-danger'"
      ></span>
    </div>
  </div>
</template>

<style scoped>
.bg-success {
  background-color: #16a34a;
}
.bg-danger {
  background-color: #dc2626;
}
</style>
