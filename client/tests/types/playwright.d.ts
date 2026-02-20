declare module '@playwright/test' {
  interface Request {
    method(): string;
  }

  interface Route {
    request(): Request;
    fulfill(options: {
      status?: number;
      contentType?: string;
      body?: string;
    }): Promise<void>;
  }

  interface Locator {
    toBeVisible(): Promise<void>;
    toHaveCount(count: number): Promise<void>;
    fill(value: string): Promise<void>;
    blur(): Promise<void>;
    selectOption(value: string): Promise<void>;
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
    getByLabel(text: string | RegExp, options?: TextOptions): Locator;
  }

  interface TestArgs {
    page: Page;
  }

  type TestFn = (args: TestArgs) => Promise<void> | void;

  export const test: (name: string, fn: TestFn) => void;
  export function expect(target: Locator): {
    toBeVisible(): Promise<void>;
    toHaveCount(count: number): Promise<void>;
  };
  export function expect(target: Page): {
    toHaveURL(url: string | RegExp): Promise<void>;
  };
}
