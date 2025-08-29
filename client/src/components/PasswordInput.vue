<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  id: { type: String, required: true },
  label: { type: String, required: true },
  autocomplete: { type: String, default: 'current-password' },
  placeholder: { type: String, default: '' },
  required: { type: Boolean, default: false },
  ariaInvalid: { type: [Boolean, String], default: undefined },
  ariaDescribedby: { type: String, default: undefined },
  disabled: { type: Boolean, default: false },
  autofocus: { type: Boolean, default: false },
  // optional error text (to render invalid state consistently with BS)
  error: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue']);

const visible = ref(false);
const local = ref(props.modelValue || '');
const capsLock = ref(false);
const inputEl = ref(null);

watch(
  () => props.modelValue,
  (v) => {
    if (v !== local.value) local.value = v || '';
  }
);

function onInput(e) {
  emit('update:modelValue', e?.target?.value ?? local.value);
}

function onKeyEvent(e) {
  // Detect caps lock state if available
  try {
    const state = e?.getModifierState?.('CapsLock');
    if (typeof state === 'boolean') capsLock.value = state;
  } catch {
    /* noop */
  }
}

function toggleVisibility() {
  visible.value = !visible.value;
  // restore caret position where possible
  const el = inputEl.value;
  if (el && typeof el.setSelectionRange === 'function') {
    const pos = el.selectionStart;
    requestAnimationFrame(() => {
      try {
        el.setSelectionRange(pos, pos);
        el.focus();
      } catch {
        /* noop */
      }
    });
  }
}

function onWindowKeydown(e) {
  onKeyEvent(e);
}

onMounted(() => {
  if (props.autofocus) inputEl.value?.focus?.();
  window.addEventListener('keydown', onWindowKeydown);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown);
});
</script>

<template>
  <div class="form-floating position-relative">
    <input
      :id="props.id"
      ref="inputEl"
      v-model="local"
      :type="visible ? 'text' : 'password'"
      class="form-control"
      :class="{
        'is-invalid': !!error || ariaInvalid === true || ariaInvalid === 'true',
      }"
      :placeholder="props.placeholder || props.label"
      :autocomplete="props.autocomplete"
      :required="props.required"
      :aria-invalid="props.ariaInvalid"
      :aria-describedby="props.ariaDescribedby"
      :disabled="props.disabled"
      autocapitalize="off"
      spellcheck="false"
      @input="onInput"
      @keydown="onKeyEvent"
    />
    <label :for="props.id">{{ props.label }}</label>
    <button
      type="button"
      class="btn btn-link password-toggle"
      :aria-label="visible ? 'Скрыть пароль' : 'Показать пароль'"
      :title="visible ? 'Скрыть пароль' : 'Показать пароль'"
      @click="toggleVisibility"
    >
      <span v-if="!visible">Показать</span>
      <span v-else>Скрыть</span>
    </button>
    <div v-if="capsLock" class="form-text mt-1">Включен Caps Lock</div>
    <div v-if="error" class="invalid-feedback">{{ error }}</div>
  </div>
</template>

<style scoped>
.password-toggle {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  padding: 0.25rem 0.5rem;
  text-decoration: none;
}
</style>
