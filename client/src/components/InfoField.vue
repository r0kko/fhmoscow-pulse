<template>
  <div class="input-group">
    <span v-if="icon" class="input-group-text">
      <i :class="icon"></i>
    </span>
    <div class="form-floating flex-grow-1" style="min-width: 0">
      <component
        :is="multiline ? 'textarea' : 'input'"
        :id="id"
        ref="field"
        type="text"
        class="form-control"
        :value="displayValue"
        readonly
        :placeholder="label"
        rows="1"
        :style="multiline ? { height: textareaHeight } : {}"
      />
      <label :for="id">{{ label }}</label>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

interface InfoFieldProps {
  id: string;
  label: string;
  icon?: string | null;
  value?: string | number | null;
  placeholder?: string;
  multiline?: boolean;
}

const props = withDefaults(defineProps<InfoFieldProps>(), {
  icon: null,
  value: '',
  placeholder: '—',
  multiline: false,
});

const field = ref<HTMLInputElement | HTMLTextAreaElement | null>(null);
const textareaHeight = ref('auto');
let resizeBound = false;

const displayValue = computed(() => {
  const val = props.value;
  if (val === null || val === undefined || val === '') {
    return props.placeholder;
  }
  return String(val);
});

function adjustHeight(): void {
  if (!props.multiline) return;
  const el = field.value;
  if (!el || !(el instanceof HTMLTextAreaElement)) return;
  el.style.height = 'auto';
  textareaHeight.value = `${el.scrollHeight}px`;
}

function bindResize(): void {
  if (resizeBound || typeof window === 'undefined') return;
  window.addEventListener('resize', adjustHeight, { passive: true });
  resizeBound = true;
}

function unbindResize(): void {
  if (!resizeBound || typeof window === 'undefined') return;
  window.removeEventListener('resize', adjustHeight);
  resizeBound = false;
}

onMounted(() => {
  if (!props.multiline) return;
  bindResize();
  nextTick(adjustHeight);
});

onBeforeUnmount(unbindResize);

watch(
  () => props.multiline,
  (isMultiline) => {
    if (isMultiline) {
      bindResize();
      nextTick(adjustHeight);
    } else {
      unbindResize();
      textareaHeight.value = 'auto';
    }
  }
);

watch(
  displayValue,
  () => {
    if (!props.multiline) return;
    nextTick(adjustHeight);
  },
  { flush: 'post' }
);
</script>

<style scoped>
textarea.form-control {
  resize: none;
  overflow: hidden;
  word-break: break-word;
  overflow-wrap: anywhere;
}
</style>
