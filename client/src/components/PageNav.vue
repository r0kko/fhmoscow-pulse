<script setup lang="ts">
import Pagination from './Pagination.vue';

type PageNavProps = {
  page: number;
  totalPages: number;
  pageSize: number;
  sizes?: number[];
  small?: boolean;
};

const props = withDefaults(defineProps<PageNavProps>(), {
  sizes: () => [5, 10, 20],
  small: true,
});

const emit = defineEmits<{
  'update:page': [value: number];
  'update:pageSize': [value: number];
}>();

function updatePage(page: number): void {
  emit('update:page', page);
}

function updatePageSize(event: Event): void {
  const target = event.target as HTMLSelectElement | null;
  if (!target) return;
  const val = Number(target.value);
  if (Number.isNaN(val)) return;
  emit('update:pageSize', val);
}
</script>

<template>
  <nav class="mt-3 page-nav d-flex align-items-center justify-content-between">
    <div class="page-size">
      <select
        :value="pageSize"
        class="form-select w-auto"
        :class="{ 'form-select-sm': small }"
        aria-label="Количество на странице"
        @change="updatePageSize"
      >
        <option v-for="s in sizes" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>
    <Pagination
      :model-value="page"
      :total-pages="totalPages"
      @update:model-value="updatePage"
    />
  </nav>
</template>

<style scoped>
/* Inherits brand pagination styles */
@media (max-width: 575.98px) {
  /* Hide page-size selector on narrow screens to reduce clutter */
  .page-nav .page-size {
    display: none;
  }
}
</style>
