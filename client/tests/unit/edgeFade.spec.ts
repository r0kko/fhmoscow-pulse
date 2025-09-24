import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import edgeFade, { type ScrollElement } from '@/utils/edgeFade';

type EdgeFadeDirective = {
  mounted: (el: ScrollElement) => void;
  updated: (el: ScrollElement) => void;
  unmounted: (el: ScrollElement) => void;
};

const directive = edgeFade as EdgeFadeDirective;

interface MockElementOptions {
  scrollWidth: number;
  clientWidth: number;
  scrollLeft: number;
}

type EdgeFadeMock = ScrollElement & {
  dispatch: (type: string) => void;
};

function createMockElement({
  scrollWidth,
  clientWidth,
  scrollLeft,
}: MockElementOptions): EdgeFadeMock {
  const classes = new Set<string>();
  const listeners = new Map<string, (event: Event) => void>();

  const element = {
    scrollWidth,
    clientWidth,
    scrollLeft,
    classList: {
      add: (cls: string) => classes.add(cls),
      remove: (...cls: string[]) => cls.forEach((c) => classes.delete(c)),
      contains: (cls: string) => classes.has(cls),
    } as unknown as DOMTokenList,
    addEventListener: vi.fn((event: string, handler: EventListener) =>
      listeners.set(event, handler)
    ) as ScrollElement['addEventListener'],
    removeEventListener: vi.fn((event: string) =>
      listeners.delete(event)
    ) as ScrollElement['removeEventListener'],
    dispatch(type: string) {
      const handler = listeners.get(type);
      if (handler)
        handler({ currentTarget: this as ScrollElement } as unknown as Event);
    },
    __edgeFade: null,
  } as unknown as EdgeFadeMock;

  return element;
}

describe('edgeFade directive', () => {
  let resizeSpy: ReturnType<typeof vi.spyOn>;
  let removeResizeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resizeSpy = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation(() => {});
    removeResizeSpy = vi
      .spyOn(window, 'removeEventListener')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    resizeSpy.mockRestore();
    removeResizeSpy.mockRestore();
  });

  it('hides fades when content fits', () => {
    const el = createMockElement({
      scrollWidth: 200,
      clientWidth: 200,
      scrollLeft: 0,
    });
    directive.mounted(el);
    expect(el.classList.contains('scroll-fade')).toBe(true);
    expect(el.classList.contains('show-left-fade')).toBe(false);
    expect(el.classList.contains('show-right-fade')).toBe(false);
    expect(resizeSpy).toHaveBeenCalledWith('resize', expect.any(Function), {
      passive: true,
    });
  });

  it('toggles fades based on scroll position', () => {
    const el = createMockElement({
      scrollWidth: 500,
      clientWidth: 200,
      scrollLeft: 0,
    });
    directive.mounted(el);
    expect(el.classList.contains('show-right-fade')).toBe(true);

    el.scrollLeft = 100;
    el.dispatch('scroll');
    expect(el.classList.contains('show-left-fade')).toBe(true);
    expect(el.classList.contains('show-right-fade')).toBe(true);

    el.scrollLeft = 400;
    el.dispatch('scroll');
    expect(el.classList.contains('show-right-fade')).toBe(false);
  });

  it('updates fades when content metrics change', () => {
    const el = createMockElement({
      scrollWidth: 600,
      clientWidth: 200,
      scrollLeft: 0,
    });
    directive.mounted(el);
    el.scrollLeft = 450;
    directive.updated(el);
    expect(el.classList.contains('show-left-fade')).toBe(true);
    expect(el.classList.contains('show-right-fade')).toBe(false);
  });

  it('removes listeners on unmount', () => {
    const el = createMockElement({
      scrollWidth: 500,
      clientWidth: 200,
      scrollLeft: 0,
    });
    directive.mounted(el);
    const resizeHandler = el.__edgeFade?.resizeHandler;
    expect(typeof resizeHandler).toBe('function');
    resizeHandler?.();
    directive.unmounted(el);
    expect(el.removeEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function)
    );
    expect(removeResizeSpy).toHaveBeenCalledWith('resize', resizeHandler);
    expect(el.__edgeFade).toBeUndefined();
  });
});
