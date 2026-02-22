<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';

type TabKey = string | number;

interface TabDefinition {
  key: TabKey;
  label: string;
  subLabel?: string;
  badge?: number | string;
  alert?: boolean;
  alertLabel?: string;
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

const navRef = ref<HTMLElement | null>(null);
const tabButtonRefs = ref<Array<HTMLButtonElement | null>>([]);

function selectTab(key: TabKey, disabled?: boolean): void {
  if (disabled) return;
  if (key === currentValue.value) return;
  emit('update:modelValue', key);
  emit('change', key);
}

function scrollActiveTab(behavior: ScrollBehavior = 'auto'): void {
  const navEl = navRef.value;
  if (!navEl) return;
  const active = navEl.querySelector<HTMLElement>('.nav-link.active');
  if (!active) return;
  const navRect = navEl.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  const activeLeft = activeRect.left - navRect.left + navEl.scrollLeft;
  const activeRight = activeLeft + activeRect.width;
  const scrollLeft = navEl.scrollLeft;
  const viewWidth = navEl.clientWidth;
  if (activeLeft >= scrollLeft && activeRight <= scrollLeft + viewWidth) return;
  const target = activeLeft - Math.max(viewWidth / 2 - activeRect.width / 2, 0);
  navEl.scrollTo({
    left: Math.max(target, 0),
    behavior,
  });
}

function queueScroll(behavior: ScrollBehavior = 'auto'): void {
  void nextTick(() => {
    scrollActiveTab(behavior);
  });
}

function setTabButtonRef(index: number, el: HTMLButtonElement | null): void {
  tabButtonRefs.value[index] = el;
}

function findNextEnabledIndex(
  startIndex: number,
  step: number,
  total: number
): number {
  let checked = 0;
  let cursor = startIndex;
  while (checked < total) {
    cursor = (cursor + step + total) % total;
    if (!tabItems.value[cursor]?.disabled) return cursor;
    checked += 1;
  }
  return startIndex;
}

function onTabKeydown(event: KeyboardEvent, index: number): void {
  const total = tabItems.value.length;
  if (!total) return;
  let nextIndex: number | null = null;
  if (event.key === 'ArrowRight') {
    nextIndex = findNextEnabledIndex(index, 1, total);
  } else if (event.key === 'ArrowLeft') {
    nextIndex = findNextEnabledIndex(index, -1, total);
  } else if (event.key === 'Home') {
    nextIndex = tabItems.value.findIndex((tab) => !tab.disabled);
  } else if (event.key === 'End') {
    for (let i = total - 1; i >= 0; i -= 1) {
      if (!tabItems.value[i]?.disabled) {
        nextIndex = i;
        break;
      }
    }
  }
  if (nextIndex == null || nextIndex < 0 || nextIndex >= total) return;
  event.preventDefault();
  const nextTab = tabItems.value[nextIndex];
  if (!nextTab) return;
  selectTab(nextTab.key, nextTab.disabled);
  void nextTick(() => {
    tabButtonRefs.value[nextIndex]?.focus();
  });
}

onMounted(() => {
  queueScroll('auto');
});

watch(
  () => currentValue.value,
  () => {
    queueScroll('smooth');
  }
);

watch(
  () => tabItems.value.map((tab) => tab.key),
  () => {
    queueScroll('auto');
  }
);
</script>

<template>
  <div ref="navRef" v-edge-fade class="tab-selector-wrap">
    <ul
      class="nav nav-pills tab-selector"
      :class="navClass"
      role="tablist"
      :aria-label="ariaLabelText || undefined"
    >
      <li v-for="(t, index) in tabItems" :key="String(t.key)" class="nav-item">
        <button
          :ref="(el) => setTabButtonRef(index, el as HTMLButtonElement | null)"
          type="button"
          class="nav-link"
          :class="{ active: currentValue === t.key, disabled: t.disabled }"
          role="tab"
          :aria-selected="currentValue === t.key"
          :aria-disabled="t.disabled ? 'true' : undefined"
          @click="selectTab(t.key, t.disabled)"
          @keydown.enter="selectTab(t.key, t.disabled)"
          @keydown="onTabKeydown($event, index)"
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
            <span
              v-else-if="t.alert"
              class="notif-dot"
              :title="t.alertLabel || 'Есть уведомления'"
              aria-hidden="true"
            ></span>
            <span v-if="t.badge && Number(t.badge) > 0" class="visually-hidden">
              {{ String(t.badge) }}
            </span>
            <span v-else-if="t.alert" class="visually-hidden">
              {{ t.alertLabel || 'Есть уведомления' }}
            </span>
          </span>
          <small v-if="t.subLabel" class="d-block text-muted lh-1">{{
            t.subLabel
          }}</small>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped></style>
