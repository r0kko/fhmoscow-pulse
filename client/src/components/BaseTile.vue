<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

const props = defineProps({
  // Route location or path for tile navigation. When absent or disabled, renders as a non-link.
  to: { type: [String, Object], default: null },
  // When true, renders inert and with aria-disabled
  disabled: { type: Boolean, default: false },
  // When true, applies section styling (larger radius/padding)
  section: { type: Boolean, default: false },
  // Optional ARIA label for discoverability
  ariaLabel: { type: String, default: null },
  // Additional classes to append to the card
  extraClass: { type: [String, Array, Object], default: '' },
  // Optional role override when not a link (e.g., 'button' for intercept tiles)
  role: { type: String, default: 'group' },
  // Optional: force opening in new tab for external links
  target: { type: String, default: null },
  rel: { type: String, default: null },
});

const isLink = computed(() => Boolean(props.to) && !props.disabled);
const hrefLike = computed(() => {
  const t = props.to;
  return (
    typeof t === 'string' &&
    (/^https?:\/\//i.test(t) || t.startsWith('#') || /^mailto:|^tel:/i.test(t))
  );
});
const componentTag = computed(() =>
  isLink.value ? (hrefLike.value ? 'a' : RouterLink) : 'div'
);
const linkAttrs = computed(() => {
  if (!isLink.value) return {};
  if (hrefLike.value) {
    const isHttp =
      typeof props.to === 'string' && /^https?:\/\//i.test(props.to);
    return {
      href: props.to,
      target: props.target || (isHttp ? '_blank' : null),
      rel: props.rel || (isHttp ? 'noopener noreferrer' : null),
    };
  }
  return { to: props.to };
});
const tileRole = computed(() => (isLink.value ? null : props.role || 'group'));
</script>

<template>
  <component
    :is="componentTag"
    v-bind="linkAttrs"
    class="card tile text-body"
    :class="[props.section ? 'section-card' : null, props.extraClass]"
    :aria-label="props.ariaLabel || null"
    :aria-disabled="props.disabled ? 'true' : null"
    :tabindex="isLink ? null : 0"
    :role="tileRole"
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
