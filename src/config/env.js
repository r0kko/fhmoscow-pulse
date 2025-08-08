import dotenv from 'dotenv';

// Centralized, quiet dotenv initialization.
// Do not auto-load .env during tests to allow per-test env control.
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ quiet: true });
}
