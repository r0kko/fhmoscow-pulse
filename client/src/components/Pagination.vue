<template>
  <ul class="pagination mb-0">
    <li class="page-item" :class="{ disabled: modelValue === 1 }">
      <button class="page-link" :disabled="modelValue === 1" @click="prev">
        Пред
      </button>
    </li>
    <li
      v-for="p in visiblePages"
      :key="p + '-page'"
      class="page-item"
      :class="{ active: p === modelValue, disabled: p === '...' }"
    >
      <span v-if="p === '...'" class="page-link">&hellip;</span>
      <button v-else class="page-link" @click="setPage(p)">{{ p }}</button>
    </li>
    <li class="page-item" :class="{ disabled: modelValue === totalPages }">
      <button
        class="page-link"
        :disabled="modelValue === totalPages"
        @click="next"
      >
        След
      </button>
    </li>
  </ul>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: { type: Number, required: true },
  totalPages: { type: Number, required: true },
});
const emit = defineEmits(['update:modelValue']);

const visiblePages = computed(() => {
  const totalVal = Math.max(1, props.totalPages);
  const current = props.modelValue;
  const pages = [];
  if (totalVal <= 7) {
    for (let i = 1; i <= totalVal; i++) pages.push(i);
    return pages;
  }
  pages.push(1);
  const start = Math.max(2, current - 1);
  const end = Math.min(totalVal - 1, current + 1);
  if (start > 2) pages.push('...');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalVal - 1) pages.push('...');
  pages.push(totalVal);
  return pages;
});

function setPage(p) {
  if (p === '...') return;
  emit('update:modelValue', p);
}
function prev() {
  if (props.modelValue > 1) emit('update:modelValue', props.modelValue - 1);
}
function next() {
  if (props.modelValue < props.totalPages)
    emit('update:modelValue', props.modelValue + 1);
}
</script>
