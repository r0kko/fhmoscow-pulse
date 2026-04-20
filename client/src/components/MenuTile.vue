<script setup lang="ts">
import { computed } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import BaseTile from './BaseTile.vue';

interface MenuTileProps {
  title: string;
  icon?: string;
  to?: RouteLocationRaw | null;
  button?: boolean;
  replace?: boolean;
  placeholder?: boolean;
  note?: string;
  imageSrc?: string;
  imageAlt?: string;
  locked?: boolean;
  busy?: boolean;
}

const props = withDefaults(defineProps<MenuTileProps>(), {
  icon: '',
  to: null,
  button: false,
  replace: false,
  placeholder: false,
  note: '',
  imageSrc: '',
  imageAlt: '',
  locked: false,
  busy: false,
});

const extraClasses = computed(() => [
  'menu-card',
  'fade-in',
  { 'placeholder-card': props.placeholder || (!props.to && !props.button) },
]);

const accessibleLabel = computed(() =>
  props.to || props.button ? props.title : null
);
const tileBindings = computed(() => ({
  ariaLabel: accessibleLabel.value ?? null,
  role: props.button ? 'button' : 'group',
}));
</script>

<template>
  <BaseTile
    :to="props.to || null"
    :replace="props.replace"
    :disabled="props.placeholder || props.busy || (!props.to && !props.button)"
    v-bind="tileBindings"
    :section="false"
    :extra-class="extraClasses"
  >
    <div class="card-body">
      <p class="card-title small mb-2">{{ props.title }}</p>
      <template v-if="props.imageSrc">
        <img
          :src="props.imageSrc"
          :alt="props.imageAlt || ''"
          class="image-icon"
          height="24"
        />
      </template>
      <template v-else-if="props.busy">
        <span
          class="spinner-border spinner-border-sm icon"
          aria-hidden="true"
        ></span>
      </template>
      <template v-else>
        <i :class="props.icon + ' icon fs-3'" aria-hidden="true"></i>
      </template>
      <i
        v-if="props.locked"
        class="bi bi-lock-fill lock-badge"
        aria-hidden="true"
      ></i>
      <span v-if="props.locked" class="visually-hidden">Доступ ограничен</span>
      <span
        v-if="props.note && !props.locked"
        class="tile-note text-muted small"
        >{{ props.note }}</span
      >
    </div>
  </BaseTile>
</template>

<style scoped>
.image-icon {
  position: absolute;
  bottom: 0.75rem;
  right: 0.75rem;
  display: inline-block;
}
.lock-badge {
  position: absolute;
  bottom: 0.75rem;
  left: 0.75rem;
  color: var(--bs-gray-600, #6c757d);
}
</style>
