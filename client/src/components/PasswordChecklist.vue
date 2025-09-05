<script setup>
import { computed } from 'vue';
import { evaluatePassword } from '../utils/passwordPolicy.js';

const props = defineProps({
  password: { type: String, default: '' },
});

const status = computed(() => evaluatePassword(props.password));
</script>

<template>
  <ul class="password-checklist" aria-live="polite">
    <li :class="{ ok: status.checks.meetsMin }">Минимум 8 символов</li>
    <li :class="{ ok: status.checks.hasLetter && status.checks.hasDigit }">
      Латинские буквы и цифры
    </li>
    <li :class="{ ok: status.checks.hasNoWhitespace }">Без пробелов</li>
    <li
      :class="{ ok: status.checks.notSequential && status.checks.notRepeating }"
    >
      Не простые последовательности или повторы
    </li>
    <li class="hint">Рекомендуем: заглавные буквы, спецсимволы</li>
  </ul>
  <div class="visually-hidden" aria-hidden="true">
    <!-- a11y helper; screen readers will announce change via aria-live on list -->
  </div>
</template>

<style scoped>
.password-checklist {
  margin: 0 0 0.5rem 0;
  padding-left: 1.2rem;
  font-size: var(--fs-sm);
}
.password-checklist li {
  list-style: none;
  position: relative;
  padding-left: 1.25rem;
  color: var(--bs-secondary-color, #6c757d);
}
.password-checklist li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: var(--bs-secondary-color, #6c757d);
}
.password-checklist li.ok {
  color: var(--bs-success, #198754);
}
.password-checklist li.ok::before {
  content: '•';
  font-weight: 700;
}
.password-checklist .hint {
  opacity: 0.8;
}
</style>
