<template>
  <div>
    <div class="progress" style="height: 6px">
      <div
        class="progress-bar"
        :class="strengthClass"
        :style="{ width: strengthPercent + '%' }"
      ></div>
    </div>
    <small class="text-muted password-strength-label">{{
      strengthLabel
    }}</small>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  password: {
    type: String,
    default: '',
  },
});

const strength = computed(() => {
  const val = props.password || '';
  let score = 0;
  // Базовые требования политики: длина и наличие цифр/букв
  if (val.length >= 8) score++;
  if (/[A-Za-z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  // Доп. очки за верхний регистр/спецсимволы/длину
  if (/[A-Z]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  if (val.length >= 12) score++;
  // Нормируем в диапазон 0..5
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

<style scoped>
.password-strength-label {
  font-size: var(--fs-sm);
}
</style>
