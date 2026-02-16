declare module '@playwright/test' {
  interface Route {
    fulfill(options: {
      status?: number;
      contentType?: string;
      body?: string;
    }): Promise<void>;
  }

  interface Locator {
    toBeVisible(): Promise<void>;
    toHaveCount(count: number): Promise<void>;
    click(): Promise<void>;
  }

  interface RoleOptions {
    name?: string | RegExp;
    level?: number;
  }

  interface TextOptions {
    exact?: boolean;
  }

  interface Page {
    goto(url: string, options?: Record<string, unknown>): Promise<void>;
    route(
      url: string | RegExp,
      handler: (route: Route) => Promise<void> | void
    ): Promise<void>;
    getByRole(role: string, options?: RoleOptions): Locator;
    getByText(text: string | RegExp, options?: TextOptions): Locator;
  }

  interface TestArgs {
    page: Page;
  }

  type TestFn = (args: TestArgs) => Promise<void> | void;

  export const test: (name: string, fn: TestFn) => void;
  export const expect: (locator: Locator) => {
    toBeVisible(): Promise<void>;
    toHaveCount(count: number): Promise<void>;
  };
}
