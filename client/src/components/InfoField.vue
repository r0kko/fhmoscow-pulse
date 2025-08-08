<template>
  <div class="input-group">
    <span v-if="icon" class="input-group-text">
      <i :class="icon"></i>
    </span>
    <div class="form-floating flex-grow-1">
      <input
        :id="id"
        type="text"
        class="form-control"
        :value="value || placeholder"
        readonly
        :placeholder="label"
      />
      <label :for="id">{{ label }}</label>
    </div>
    <button
      v-if="copyable && value"
      type="button"
      class="btn btn-outline-secondary"
      title="Скопировать"
      aria-label="Скопировать"
      data-bs-toggle="tooltip"
      @click="$emit('copy')"
    >
      <i class="bi bi-clipboard"></i>
    </button>
  </div>
</template>

<script setup>
defineEmits(['copy']);

defineProps({
  id: { type: String, required: true },
  label: { type: String, required: true },
  icon: { type: String, default: null },
  value: { type: [String, Number], default: '' },
  placeholder: { type: String, default: '—' },
  copyable: { type: Boolean, default: false },
});
</script>
