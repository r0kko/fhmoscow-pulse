<script setup lang="ts">
const props = defineProps<{
  title: string;
  editing: boolean;
  saving: boolean;
  canEdit?: boolean;
}>();

const emit = defineEmits<{
  edit: [];
}>();
</script>

<template>
  <div class="d-flex justify-content-between align-items-center mb-3 gap-2">
    <h2 class="h5 mb-0">{{ title }}</h2>
    <button
      v-if="canEdit !== false && !editing"
      type="button"
      class="btn btn-outline-secondary btn-sm"
      :disabled="saving"
      @click="emit('edit')"
    >
      Редактировать
    </button>
  </div>
</template>
