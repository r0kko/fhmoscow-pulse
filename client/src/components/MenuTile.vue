<script setup>
import BaseTile from './BaseTile.vue';

const props = defineProps({
  title: { type: String, required: true },
  icon: { type: String, default: '' },
  to: { type: [String, Object], default: null },
  replace: { type: Boolean, default: false },
  placeholder: { type: Boolean, default: false },
  note: { type: String, default: '' },
  imageSrc: { type: String, default: '' },
  imageAlt: { type: String, default: '' },
  locked: { type: Boolean, default: false },
});
</script>

<template>
  <BaseTile
    :to="props.to || null"
    :replace="props.replace"
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
