<script setup lang="ts">
import { computed } from 'vue';

type TabKey = string | number;

interface TabDefinition {
  key: TabKey;
  label: string;
  subLabel?: string;
  badge?: number | string;
  disabled?: boolean;
}

type JustifyOption = '' | 'between' | 'center' | 'start' | 'end';

const props = defineProps<{
  modelValue?: TabKey;
  tabs?: TabDefinition[];
  navFill?: boolean;
  justify?: JustifyOption;
  ariaLabel?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: TabKey];
  change: [value: TabKey];
}>();

const currentValue = computed<TabKey>(() => props.modelValue ?? '');
const tabItems = computed<TabDefinition[]>(() => props.tabs ?? []);
const navFill = computed<boolean>(() => props.navFill ?? true);
const justify = computed<JustifyOption>(() => props.justify ?? 'between');
const ariaLabelText = computed(() => props.ariaLabel ?? '');

const navClass = computed(() => {
  const classes: string[] = [];
  if (navFill.value) classes.push('nav-fill');
  if (justify.value) classes.push(`justify-content-${justify.value}`);
  return classes.join(' ');
});

function selectTab(key: TabKey, disabled?: boolean): void {
  if (disabled) return;
  if (key === currentValue.value) return;
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
    :aria-label="ariaLabelText || undefined"
  >
    <li v-for="t in tabItems" :key="String(t.key)" class="nav-item">
      <button
        type="button"
        class="nav-link"
        :class="{ active: currentValue === t.key, disabled: t.disabled }"
        role="tab"
        :aria-selected="currentValue === t.key"
        :aria-disabled="t.disabled ? 'true' : undefined"
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

<style scoped></style>
