<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

type Booleanish = boolean | 'true' | 'false';

interface PasswordInputProps {
  modelValue?: string;
  id: string;
  label: string;
  autocomplete?: string;
  placeholder?: string;
  required?: boolean;
  ariaInvalid?: Booleanish;
  ariaDescribedby?: string;
  disabled?: boolean;
  autofocus?: boolean;
  error?: string;
  maxLength?: number;
}

const props = withDefaults(defineProps<PasswordInputProps>(), {
  modelValue: '',
  autocomplete: 'current-password',
  placeholder: '',
  required: false,
  ariaInvalid: false as Booleanish,
  ariaDescribedby: '',
  disabled: false,
  autofocus: false,
  error: '',
  maxLength: 128,
});

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const visible = ref(false);
const local = ref<string>(props.modelValue);
const capsLock = ref(false);
const inputEl = ref<HTMLInputElement | null>(null);

watch(
  () => props.modelValue,
  (value) => {
    if (value !== local.value) local.value = value ?? '';
  }
);

function onInput(event: Event): void {
  const target = event.target as HTMLInputElement | null;
  const value = target?.value ?? '';
  local.value = value;
  emit('update:modelValue', value);
}

function onKeyEvent(event: KeyboardEvent): void {
  try {
    const state = event.getModifierState?.('CapsLock');
    if (typeof state === 'boolean') capsLock.value = state;
  } catch {
    /* ignore modifier state errors */
  }
}

function toggleVisibility(): void {
  visible.value = !visible.value;
  const el = inputEl.value;
  if (el && typeof el.setSelectionRange === 'function') {
    const pos = el.selectionStart ?? el.value.length;
    requestAnimationFrame(() => {
      try {
        el.setSelectionRange(pos, pos);
        el.focus();
      } catch {
        /* ignore focus errors */
      }
    });
  }
}

function onWindowKeydown(event: KeyboardEvent): void {
  onKeyEvent(event);
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
      :maxlength="props.maxLength"
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
      :aria-pressed="visible ? 'true' : 'false'"
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
  min-height: 44px; /* comfortable tap target */
}
</style>
