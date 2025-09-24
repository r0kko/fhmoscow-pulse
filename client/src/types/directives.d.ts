import type { Directive } from 'vue';

type EdgeFadeDirective = Directive<HTMLElement, void>;

declare module '@vue/runtime-core' {
  interface GlobalDirectives {
    edgeFade: EdgeFadeDirective;
    vEdgeFade: EdgeFadeDirective;
  }
}

declare module 'vue' {
  interface GlobalDirectives {
    edgeFade: EdgeFadeDirective;
    vEdgeFade: EdgeFadeDirective;
  }
}

export {};
