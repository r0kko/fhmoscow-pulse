import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { mount } from '@vue/test-utils';
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

    await rerender({
      id: 'pwd',
      label: 'Пароль',
      modelValue: '321',
      'onUpdate:modelValue': modelSpy,
    });

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

    await rerender({
      id: 'pwd',
      label: 'Пароль',
      modelValue: 'Обновлен',
      'onUpdate:modelValue': modelSpy,
    });

    await rerender({
      id: 'pwd',
      label: 'Пароль',
      modelValue: null,
      'onUpdate:modelValue': modelSpy,
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Пароль')).toHaveValue('');
    });
  });

  it('handles modifier state and selection errors without breaking UX', async () => {
    render(PasswordInput, {
      props: {
        id: 'pwd',
        label: 'Пароль',
        modelValue: 'секрет',
        ariaInvalid: 'true',
      },
    });

    const input = screen.getByLabelText('Пароль') as HTMLInputElement;
    const toggle = screen.getByRole('button', { name: 'Показать пароль' });

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveClass('is-invalid');

    if (!('requestAnimationFrame' in window)) {
      Object.defineProperty(window, 'requestAnimationFrame', {
        configurable: true,
        writable: true,
        value: (cb: FrameRequestCallback) => {
          cb(0);
          return 1 as unknown as number;
        },
      });
    }

    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 1 as unknown as number;
      });

    const selectionSpy = vi
      .spyOn(input, 'setSelectionRange')
      .mockImplementation(() => {
        throw new Error('blocked');
      });

    await fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await fireEvent.click(toggle);

    const capsEvent = new KeyboardEvent('keydown');
    vi.spyOn(capsEvent, 'getModifierState').mockImplementation(() => {
      throw new Error('caps unavailable');
    });
    input.dispatchEvent(capsEvent);

    expect(screen.queryByText('Включен Caps Lock')).not.toBeInTheDocument();

    const originalSelection = input.setSelectionRange;
    const inputPrototype = Object.getPrototypeOf(
      input
    ) as typeof HTMLInputElement.prototype;
    const originalSelectionDescriptor = Object.getOwnPropertyDescriptor(
      inputPrototype,
      'selectionStart'
    );
    // simulate environments without setSelectionRange
    // @ts-expect-error overriding for test purposes
    input.setSelectionRange = undefined;
    Object.defineProperty(inputPrototype, 'selectionStart', {
      configurable: true,
      get() {
        return null;
      },
      set(value: number | null) {
        originalSelectionDescriptor?.set?.call(this, value as number);
      },
    });
    await fireEvent.click(toggle);
    await fireEvent.click(toggle);
    input.setSelectionRange = originalSelection;
    if (originalSelectionDescriptor) {
      Object.defineProperty(
        inputPrototype,
        'selectionStart',
        originalSelectionDescriptor
      );
    }

    selectionSpy.mockRestore();
    rafSpy.mockRestore();
  });

  it('falls back to an empty string when native event has no target value', () => {
    const wrapper = mount(PasswordInput, {
      props: {
        id: 'pwd',
        label: 'Пароль',
      },
    });

    (wrapper.vm as unknown as { onInput: (event: Event) => void }).onInput(
      new Event('input')
    );

    expect(wrapper.emitted()['update:modelValue']?.[0]).toEqual(['']);
    wrapper.unmount();
  });

  it('skips redundant local sync when incoming value is identical', async () => {
    const wrapper = mount(PasswordInput, {
      props: {
        id: 'pwd',
        label: 'Пароль',
        modelValue: 'Отличается',
      },
    });

    const input = wrapper.get('input');
    await input.setValue('Совпадает');

    await wrapper.setProps({ modelValue: 'Совпадает' });

    expect((input.element as HTMLInputElement).value).toBe('Совпадает');

    wrapper.unmount();
  });

  it('falls back to input length when cursor position is unavailable', () => {
    const wrapper = mount(PasswordInput, {
      props: {
        id: 'pwd',
        label: 'Пароль',
        modelValue: 'секрет',
      },
    });

    const vm = wrapper.vm as unknown as {
      inputEl: { value: string } | null;
      toggleVisibility: () => void;
    };

    const mockEl = {
      value: 'секрет',
      selectionStart: undefined as number | undefined,
      setSelectionRange: vi.fn(),
      focus: vi.fn(),
    };

    vm.inputEl = mockEl as unknown as HTMLInputElement;

    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 1 as unknown as number;
      });

    vm.toggleVisibility();

    expect(mockEl.setSelectionRange).toHaveBeenCalledWith(
      mockEl.value.length,
      mockEl.value.length
    );

    rafSpy.mockRestore();
    wrapper.unmount();
  });
});
