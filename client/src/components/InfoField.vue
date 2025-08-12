<template>
  <div class="input-group">
    <span v-if="icon" class="input-group-text">
      <i :class="icon"></i>
    </span>
    <div class="form-floating flex-grow-1">
      <component
        :is="multiline ? 'textarea' : 'input'"
        :id="id"
        ref="field"
        type="text"
        class="form-control"
        :value="value || placeholder"
        readonly
        :placeholder="label"
        rows="1"
        :style="multiline ? { height: textareaHeight } : {}"
      />
      <label :for="id">{{ label }}</label>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';

defineProps({
  id: { type: String, required: true },
  label: { type: String, required: true },
  icon: { type: String, default: null },
  value: { type: [String, Number], default: '' },
  placeholder: { type: String, default: '—' },
  multiline: { type: Boolean, default: false },
});

const field = ref(null);
const textareaHeight = ref('auto');

function adjustHeight() {
  if (!field.value) return;
  field.value.style.height = 'auto';
  textareaHeight.value = field.value.scrollHeight + 'px';
}

onMounted(adjustHeight);
watch(() => value, adjustHeight);
</script>

<style scoped>
textarea.form-control {
  resize: none;
  overflow: hidden;
}
</style>
