declare module 'bootstrap/js/dist/modal' {
  interface ModalOptions {
    backdrop?: 'static' | boolean;
    keyboard?: boolean;
    focus?: boolean;
  }

  export default class Modal {
    constructor(element: Element | null, options?: ModalOptions);
    show(): void;
    hide(): void;
    dispose(): void;
  }
}

declare module 'bootstrap/js/dist/tooltip' {
  interface TooltipOptions {
    trigger?: string;
    placement?: string;
  }

  export default class Tooltip {
    constructor(element: Element | null, options?: TooltipOptions);
    dispose(): void;
  }
}
