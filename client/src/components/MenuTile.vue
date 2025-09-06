<script setup>
import BaseTile from './BaseTile.vue';

const props = defineProps({
  title: { type: String, required: true },
  icon: { type: String, default: '' },
  to: { type: [String, Object], default: null },
  placeholder: { type: Boolean, default: false },
  note: { type: String, default: '' },
  imageSrc: { type: String, default: '' },
  imageAlt: { type: String, default: '' },
});
</script>

<template>
  <BaseTile
    :to="props.to || null"
    :disabled="props.placeholder || !props.to"
    :aria-label="props.to ? props.title : null"
    :section="false"
    :extra-class="[
      'menu-card',
      'fade-in',
      { 'placeholder-card': props.placeholder || !props.to },
    ]"
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
      <template v-else>
        <i :class="props.icon + ' icon fs-3'" aria-hidden="true"></i>
      </template>
      <span v-if="props.note" class="tile-note text-muted small">{{
        props.note
      }}</span>
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
</style>
