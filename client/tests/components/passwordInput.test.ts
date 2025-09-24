import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { defineComponent, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import PasswordInput from '@/components/PasswordInput.vue';

type PasswordInputProps = InstanceType<typeof PasswordInput>['$props'];

describe('PasswordInput', () => {
  function renderModel(props: Partial<PasswordInputProps> = {}) {
    const Wrapper = defineComponent({
      components: { PasswordInput },
      setup() {
        const value = ref('Начальный пароль');
        return { value, extraProps: props };
      },
      template:
        '<PasswordInput id="pwd" label="Пароль" v-model="value" v-bind="extraProps" />',
    });

    return render(Wrapper);
  }

  it('toggles visibility and keeps value in sync with v-model', async () => {
    const view = renderModel({ autofocus: true });

    const input = screen.getByLabelText('Пароль');
    expect(input).toHaveValue('Начальный пароль');
    expect(input).toHaveAttribute('type', 'password');
    await fireEvent.update(input, 'Секрет');
    expect(input).toHaveValue('Секрет');

    const toggle = screen.getByRole('button', { name: 'Показать пароль' });
    await fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveAttribute('aria-label', 'Скрыть пароль');
    expect(screen.getByLabelText('Пароль')).toHaveAttribute('type', 'text');

    await fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Пароль')).toHaveAttribute('type', 'password');

    view.unmount();
  });

  it('surfaces caps lock hint and renders validation state', async () => {
    const modelSpy = vi.fn();
    const { rerender } = render(PasswordInput, {
      props: {
        id: 'pwd',
        label: 'Пароль',
        modelValue: '123',
        error: 'Пароль обязателен',
        'onUpdate:modelValue': modelSpy,
      },
    });

    const input = screen.getByLabelText('Пароль');
    expect(input).toHaveClass('is-invalid');
    expect(screen.getByText('Пароль обязателен')).toBeInTheDocument();

    await fireEvent.update(input, '321');
    expect(modelSpy).toHaveBeenCalledWith('321');

    const event = new KeyboardEvent('keydown');
    vi.spyOn(event, 'getModifierState').mockReturnValue(true);
    window.dispatchEvent(event);

    await screen.findByText('Включен Caps Lock');

    await rerender({
      id: 'pwd',
      label: 'Пароль',
      modelValue: 'Обновлен',
      'onUpdate:modelValue': modelSpy,
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Пароль')).toHaveValue('Обновлен');
    });
  });
});
