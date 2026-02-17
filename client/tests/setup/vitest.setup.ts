import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/vue';
import { clearAuth } from '@/auth';
import { resetApiRuntimeForTests } from '@/api';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  clearAuth();
  resetApiRuntimeForTests();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
