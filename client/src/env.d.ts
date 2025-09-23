/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<
    Record<string, unknown>,
    Record<string, unknown>,
    unknown
  >;
  export default component;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare global {
  interface Window {
    __csrfHmac?: string;
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    requiresAuth?: boolean;
    requiresAdmin?: boolean;
    requiresAdministrator?: boolean;
    requiresReferee?: boolean;
    requiresStaff?: boolean;
    forbidBrigade?: boolean;
    hideLayout?: boolean;
    fluid?: boolean;
  }
}

export {};
