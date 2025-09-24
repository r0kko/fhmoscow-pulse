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

  it.each([
    {
      password: '',
      label: 'Слабый',
      className: 'bg-danger',
      value: 0,
    },
    {
      password: 'abc123',
      label: 'Средний',
      className: 'bg-warning',
      value: 40,
    },
    {
      password: 'abc12345',
      label: 'Хороший',
      className: 'bg-info',
      value: 60,
    },
    {
      password: 'Very$trongP4ssw0rd',
      label: 'Сильный',
      className: 'bg-success',
      value: 100,
    },
  ])(
    'classifies password "$password" as $label',
    ({ password, label, className, value }) => {
      render(PasswordStrengthMeter, {
        props: { password },
      });

      const bar = screen.getByRole('progressbar', {
        name: 'Надёжность пароля',
      });
      expect(bar).toHaveClass(className);
      expect(bar).toHaveAttribute('aria-valuenow', String(value));
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  );
});
