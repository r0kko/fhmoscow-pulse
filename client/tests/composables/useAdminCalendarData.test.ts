import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from '@/api';
import {
  useAdminCalendarData,
  type AdminCalendarLoadParams,
} from '@/composables/useAdminCalendarData';

vi.mock('@/api', () => ({
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const baseParams: AdminCalendarLoadParams = {
  dayWindow: 14,
  horizonDays: 56,
  direction: 'forward',
  anchorDate: '2030-01-01',
  search: '',
  homeClubs: [],
  awayClubs: [],
  tournaments: [],
  groups: [],
  stadiums: [],
};

const Harness = defineComponent({
  name: 'CalendarDataHarness',
  setup() {
    return useAdminCalendarData();
  },
  render() {
    return h('div');
  },
});

describe('useAdminCalendarData', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('keeps controller bound to latest request after older request finalizes', async () => {
    const first = createDeferred<unknown>();
    const second = createDeferred<unknown>();
    const signals: AbortSignal[] = [];

    apiFetchMock.mockImplementation(async (_path, options) => {
      const signal = options?.signal;
      if (signal) signals.push(signal as AbortSignal);
      if (signals.length === 1) return first.promise;
      return second.promise;
    });

    const wrapper = mount(Harness);
    const vm = wrapper.vm as unknown as {
      loadCalendar: (params: AdminCalendarLoadParams) => Promise<unknown>;
      cancelPending: () => void;
    };

    const firstRequest = vm.loadCalendar(baseParams);
    await Promise.resolve();
    const secondRequest = vm.loadCalendar({
      ...baseParams,
      search: 'Спартак',
    });
    await Promise.resolve();

    expect(signals).toHaveLength(2);
    const [firstSignal, secondSignal] = signals;
    expect(firstSignal).toBeDefined();
    expect(secondSignal).toBeDefined();
    if (!firstSignal || !secondSignal) {
      throw new Error('Expected two abort signals for overlapping requests');
    }
    expect(firstSignal.aborted).toBe(true);
    expect(secondSignal.aborted).toBe(false);

    first.resolve({});
    await firstRequest;

    vm.cancelPending();
    expect(secondSignal.aborted).toBe(true);

    second.resolve({});
    await secondRequest;
    wrapper.unmount();
  });
});
