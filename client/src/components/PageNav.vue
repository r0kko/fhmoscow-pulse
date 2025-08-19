<script setup>
import Pagination from './Pagination.vue';

const props = defineProps({
  page: { type: Number, required: true },
  totalPages: { type: Number, required: true },
  pageSize: { type: Number, required: true },
  sizes: { type: Array, default: () => [5, 10, 20] },
  small: { type: Boolean, default: true },
});
const emit = defineEmits(['update:page', 'update:pageSize']);

function updatePage(p) {
  emit('update:page', p);
}
function updatePageSize(e) {
  const val = Number(e.target.value);
  emit('update:pageSize', val);
}
</script>

<template>
  <nav class="mt-3 d-flex align-items-center justify-content-between">
    <select
      :value="pageSize"
      class="form-select w-auto"
      :class="{ 'form-select-sm': small }"
      aria-label="Количество на странице"
      @change="updatePageSize"
    >
      <option v-for="s in sizes" :key="s" :value="s">{{ s }}</option>
    </select>
    <Pagination
      :model-value="page"
      :total-pages="totalPages"
      @update:model-value="updatePage"
    />
  </nav>
</template>

<style scoped>
/* Inherits brand pagination styles */
</style>
