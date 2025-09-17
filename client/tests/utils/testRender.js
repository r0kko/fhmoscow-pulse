import { render } from '@testing-library/vue';
import { createRouter, createMemoryHistory } from 'vue-router';

export function renderWithRouter(component, options = {}) {
  const routes = options.routes || [
    { path: '/', component: { template: '<div />' } },
  ];
  const router = createRouter({ history: createMemoryHistory(), routes });

  return render(component, {
    global: {
      plugins: [router],
      stubs: options.stubs || {},
      components: options.components || {},
      config: options.config || {},
    },
    ...options,
  });
}
