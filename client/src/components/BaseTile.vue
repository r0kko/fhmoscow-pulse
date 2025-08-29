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
});

const isLink = computed(() => Boolean(props.to) && !props.disabled);
const tileRole = computed(() => (isLink.value ? null : props.role || 'group'));
</script>

<template>
  <component
    :is="isLink ? RouterLink : 'div'"
    :to="isLink ? props.to : null"
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
