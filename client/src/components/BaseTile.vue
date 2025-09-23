<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, type RouteLocationRaw } from 'vue-router';

type ClassValue =
  | string
  | Record<string, boolean>
  | Array<string | Record<string, boolean>>;

type ComponentTag = 'a' | 'button' | 'div' | typeof RouterLink;

interface BaseTileProps {
  to?: RouteLocationRaw | null;
  replace?: boolean;
  disabled?: boolean;
  section?: boolean;
  ariaLabel?: string | null;
  extraClass?: ClassValue;
  role?: string;
  target?: string | null;
  rel?: string | null;
}

const props = withDefaults(defineProps<BaseTileProps>(), {
  to: null,
  replace: false,
  disabled: false,
  section: false,
  ariaLabel: null,
  extraClass: '',
  role: 'group',
  target: null,
  rel: null,
});

const isLink = computed<boolean>(() => Boolean(props.to) && !props.disabled);

const hrefLike = computed<boolean>(() => {
  if (typeof props.to !== 'string') return false;
  if (/^https?:\/\//i.test(props.to)) return true;
  if (props.to.startsWith('#')) return true;
  return /^mailto:|^tel:/i.test(props.to);
});

const componentTag = computed<ComponentTag>(() => {
  if (isLink.value) return hrefLike.value ? 'a' : RouterLink;
  if (props.role === 'button') return 'button';
  return 'div';
});

const linkAttrs = computed<Record<string, unknown>>(() => {
  if (!isLink.value) return {};

  if (hrefLike.value && typeof props.to === 'string') {
    const isHttp = /^https?:\/\//i.test(props.to);
    return {
      href: props.to,
      target: props.target ?? (isHttp ? '_blank' : null),
      rel: props.rel ?? (isHttp ? 'noopener noreferrer' : null),
    };
  }

  return {
    to: props.to as RouteLocationRaw,
    replace: props.replace || undefined,
  };
});

const tileRole = computed<string | null>(() => {
  if (isLink.value || componentTag.value === 'button') return null;
  return props.role || 'group';
});
</script>

<template>
  <component
    :is="componentTag"
    v-bind="linkAttrs"
    class="card tile text-body"
    :class="[props.section ? 'section-card' : null, props.extraClass]"
    :aria-label="props.ariaLabel || null"
    :aria-disabled="props.disabled ? 'true' : null"
    :tabindex="componentTag === 'button' || isLink ? null : 0"
    :role="tileRole"
    :type="componentTag === 'button' ? 'button' : null"
  >
    <slot />
  </component>
</template>

<style scoped>
.card.tile {
  text-decoration: none;
}
.card.tile[aria-disabled='true'] {
  cursor: default;
  opacity: 0.65;
}
</style>
