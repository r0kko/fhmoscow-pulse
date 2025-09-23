import { render } from '@testing-library/vue';
import type { Component } from 'vue';
import {
  createRouter,
  createMemoryHistory,
  type Router,
  type RouteRecordRaw,
} from 'vue-router';

type RawRenderOptions = NonNullable<Parameters<typeof render>[1]>;

interface RenderWithRouterOptions extends RawRenderOptions {
  routes?: RouteRecordRaw[];
}

const defaultRoutes: RouteRecordRaw[] = [
  { path: '/', component: { template: '<div />' } },
];

export function renderWithRouter(
  component: Component,
  options: RenderWithRouterOptions = {}
) {
  const { routes = defaultRoutes, global, ...restOptions } = options;
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes,
  });

  const mergedGlobal = {
    ...global,
    plugins: [router, ...(global?.plugins ?? [])],
  } satisfies RawRenderOptions['global'];

  return render(component, {
    ...restOptions,
    global: mergedGlobal,
  });
}
