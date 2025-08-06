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
      @click="$emit('copy')"
      title="Скопировать"
      aria-label="Скопировать"
      data-bs-toggle="tooltip"
    >
      <i class="bi bi-clipboard"></i>
    </button>
  </div>
</template>

<script setup>
defineProps({
  id: String,
  label: String,
  icon: String,
  value: [String, Number],
  placeholder: { type: String, default: '—' },
  copyable: Boolean,
});
</script>
