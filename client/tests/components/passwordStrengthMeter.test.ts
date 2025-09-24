import { fireEvent, render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import { defineComponent, ref } from 'vue';
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter.vue';

const Wrapper = defineComponent({
  components: { PasswordStrengthMeter },
  setup() {
    const pwd = ref('');
    return { pwd };
  },
  template: `
    <div>
      <input aria-label="Пароль" v-model="pwd" />
      <PasswordStrengthMeter :password="pwd" />
    </div>
  `,
});

describe('PasswordStrengthMeter', () => {
  it('exposes progress semantics and updates value', async () => {
    render(Wrapper);

    const input = screen.getByRole('textbox', { name: 'Пароль' });
    await fireEvent.update(input, 'abc');

    const bar = await screen.findByRole('progressbar', {
      name: 'Надёжность пароля',
    });
    const now1 = Number(bar.getAttribute('aria-valuenow'));
    expect(now1).toBeGreaterThanOrEqual(0);

    await fireEvent.update(input, 'Very$trongP4ssw0rd');
    const now2 = Number(bar.getAttribute('aria-valuenow'));
    expect(now2).toBeGreaterThan(now1);
    expect(now2).toBeLessThanOrEqual(100);
  });
});
