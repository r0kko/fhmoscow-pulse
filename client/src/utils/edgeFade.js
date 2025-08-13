function updateFades(el) {
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

function onScroll(e) {
  updateFades(e.currentTarget);
}

function onResize(el) {
  updateFades(el);
}

export default {
  mounted(el) {
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
  updated(el) {
    // content might have changed
    updateFades(el);
  },
  unmounted(el) {
    el.removeEventListener('scroll', onScroll);
    if (el.__edgeFade?.resizeHandler) {
      window.removeEventListener('resize', el.__edgeFade.resizeHandler);
    }
    delete el.__edgeFade;
  },
};
