<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  tabs: { type: Array, default: () => [] }, // [{ key, label, subLabel?, disabled? }]
  navFill: { type: Boolean, default: true },
  justify: { type: String, default: 'between' }, // '', 'between', 'center', 'start', 'end'
  ariaLabel: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue', 'change']);

const navClass = computed(() => {
  const cls = [];
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
    class="nav nav-pills tab-selector"
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
        <span class="d-block lh-1 fw-semibold">
          {{ t.label }}
          <span
            v-if="t.badge && Number(t.badge) > 0"
            class="notif-badge ms-1"
            :title="String(t.badge)"
            aria-hidden="true"
          >
            {{ Number(t.badge) > 99 ? '99+' : String(t.badge) }}
          </span>
          <span v-if="t.badge && Number(t.badge) > 0" class="visually-hidden">{{
            String(t.badge)
          }}</span>
        </span>
        <small v-if="t.subLabel" class="d-block text-muted lh-1">{{
          t.subLabel
        }}</small>
      </button>
    </li>
  </ul>
</template>

<style scoped>
/* Compact, scrollable tabs on small screens with snap */
.tab-selector {
  gap: 0.25rem;
}
@media (max-width: 575.98px) {
  .tab-selector {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    white-space: nowrap;
    flex-wrap: nowrap;
    scroll-snap-type: x mandatory;
    padding-bottom: 0.25rem;
  }
  .tab-selector::-webkit-scrollbar {
    display: none;
  }
  .tab-selector .nav-item {
    flex: 0 0 auto;
    scroll-snap-align: start;
  }
  .tab-selector .nav-link {
    margin-right: 0.25rem;
  }
}
</style>
