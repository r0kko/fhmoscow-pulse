import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import edgeFade from '@/utils/edgeFade.js';

function createMockElement({ scrollWidth, clientWidth, scrollLeft }) {
  const classes = new Set();
  const listeners = new Map();
  return {
    scrollWidth,
    clientWidth,
    scrollLeft,
    classList: {
      add: (cls) => classes.add(cls),
      remove: (...cls) => cls.forEach((c) => classes.delete(c)),
      contains: (cls) => classes.has(cls),
    },
    addEventListener: vi.fn((event, handler) => listeners.set(event, handler)),
    removeEventListener: vi.fn((event) => listeners.delete(event)),
    dispatch(type) {
      const handler = listeners.get(type);
      if (handler) handler({ currentTarget: this });
    },
    __edgeFade: null,
  };
}

describe('edgeFade directive', () => {
  let resizeSpy;
  let removeResizeSpy;

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
    edgeFade.mounted(el);
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
    edgeFade.mounted(el);
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
    edgeFade.mounted(el);
    el.scrollLeft = 450;
    edgeFade.updated(el);
    expect(el.classList.contains('show-left-fade')).toBe(true);
    expect(el.classList.contains('show-right-fade')).toBe(false);
  });

  it('removes listeners on unmount', () => {
    const el = createMockElement({
      scrollWidth: 500,
      clientWidth: 200,
      scrollLeft: 0,
    });
    edgeFade.mounted(el);
    const resizeHandler = el.__edgeFade?.resizeHandler;
    edgeFade.unmounted(el);
    expect(el.removeEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function)
    );
    expect(removeResizeSpy).toHaveBeenCalledWith('resize', resizeHandler);
    expect(el.__edgeFade).toBeUndefined();
  });
});
