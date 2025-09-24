declare module '@playwright/test' {
  interface Locator {
    toBeVisible(): Promise<void>;
  }

  interface RoleOptions {
    name?: string | RegExp;
    level?: number;
  }

  interface Page {
    goto(url: string, options?: Record<string, unknown>): Promise<void>;
    getByRole(role: string, options?: RoleOptions): Locator;
  }

  interface TestArgs {
    page: Page;
  }

  type TestFn = (args: TestArgs) => Promise<void> | void;

  export const test: (name: string, fn: TestFn) => void;
  export const expect: (locator: Locator) => {
    toBeVisible(): Promise<void>;
  };
}
