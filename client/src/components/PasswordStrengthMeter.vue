<script setup lang="ts">
import { computed } from 'vue';

type PasswordStrengthProps = {
  password?: string;
};

const props = withDefaults(defineProps<PasswordStrengthProps>(), {
  password: '',
});

const strength = computed<number>(() => {
  const val = props.password || '';
  let score = 0;
  if (val.length >= 8) score += 1;
  if (/[A-Za-z]/.test(val)) score += 1;
  if (/[0-9]/.test(val)) score += 1;
  if (/[A-Z]/.test(val)) score += 1;
  if (/[^A-Za-z0-9]/.test(val)) score += 1;
  if (val.length >= 12) score += 1;
  return Math.min(score, 5);
});

const strengthPercent = computed(() => (strength.value / 5) * 100);

const strengthLabel = computed(() => {
  if (strength.value <= 1) return 'Слабый';
  if (strength.value === 2) return 'Средний';
  if (strength.value === 3) return 'Хороший';
  return 'Сильный';
});

const strengthClass = computed(() => {
  if (strength.value <= 1) return 'bg-danger';
  if (strength.value === 2) return 'bg-warning';
  if (strength.value === 3) return 'bg-info';
  return 'bg-success';
});
</script>

<template>
  <div>
    <div class="progress" style="height: 6px">
      <div
        class="progress-bar"
        :class="strengthClass"
        :style="{ width: strengthPercent + '%' }"
        role="progressbar"
        aria-label="Надёжность пароля"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(strengthPercent)"
      ></div>
    </div>
    <small class="text-muted password-strength-label">
      {{ strengthLabel }}
    </small>
  </div>
</template>

<style scoped>
.password-strength-label {
  font-size: var(--fs-sm);
}
</style>
