type ScrollElement = HTMLElement & { __edgeFade?: { resizeHandler: () => void } };

function updateFades(el: ScrollElement): void {
  const { scrollLeft, scrollWidth, clientWidth } = el;
  const hasOverflow = scrollWidth > clientWidth + 1; // tolerance
  const atStart = scrollLeft <= 0;
  const atEnd = scrollLeft + clientWidth >= scrollWidth - 1; // tolerance

  if (!hasOverflow) {
    el.classList.remove('show-left-fade', 'show-right-fade');
    return;
  }
  if (atStart) el.classList.remove('show-left-fade');
  else el.classList.add('show-left-fade');

  if (atEnd) el.classList.remove('show-right-fade');
  else el.classList.add('show-right-fade');
}

function onScroll(event: Event): void {
  const target = event.currentTarget as ScrollElement | null;
  if (target) updateFades(target);
}

function onResize(el: ScrollElement): void {
  updateFades(el);
}

import type { Directive } from 'vue';

const edgeFadeDirective: Directive<HTMLElement, void> = {
  mounted(el: ScrollElement): void {
    // opt-in class to enable overlays
    el.classList.add('scroll-fade');
    // initialize
    updateFades(el);
    // listeners
    const resizeHandler = () => onResize(el);
    el.__edgeFade = { resizeHandler };
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', resizeHandler, { passive: true });
  },
  updated(el: ScrollElement): void {
    // content might have changed
    updateFades(el);
  },
  unmounted(el: ScrollElement): void {
    el.removeEventListener('scroll', onScroll);
    if (el.__edgeFade?.resizeHandler) {
      window.removeEventListener('resize', el.__edgeFade.resizeHandler);
    }
    delete el.__edgeFade;
  },
};

export default edgeFadeDirective;
