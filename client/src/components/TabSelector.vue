<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  tabs: { type: Array, default: () => [] }, // [{ key, label, disabled? }]
  navFill: { type: Boolean, default: true },
  justify: { type: String, default: 'between' }, // '', 'between', 'center', 'start', 'end'
  ariaLabel: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue', 'change']);

const navClass = computed(() => {
  const cls = ['nav', 'nav-pills', 'tab-selector'];
  if (props.navFill) cls.push('nav-fill');
  if (props.justify) cls.push(`justify-content-${props.justify}`);
  return cls.join(' ');
});

function selectTab(key, disabled) {
  if (disabled) return;
  if (key === props.modelValue) return;
  emit('update:modelValue', key);
  emit('change', key);
}
</script>

<template>
  <ul
    v-edge-fade
    :class="navClass"
    role="tablist"
    :aria-label="ariaLabel || null"
  >
    <li v-for="t in tabs" :key="String(t.key)" class="nav-item">
      <button
        type="button"
        class="nav-link"
        :class="{ active: modelValue === t.key, disabled: t.disabled }"
        role="tab"
        :aria-selected="modelValue === t.key"
        :aria-disabled="t.disabled ? 'true' : null"
        @click="selectTab(t.key, t.disabled)"
        @keydown.enter="selectTab(t.key, t.disabled)"
      >
        {{ t.label }}
      </button>
    </li>
  </ul>
</template>

<style scoped>
/* No local styles: rely on brand.css .tab-selector */
</style>
