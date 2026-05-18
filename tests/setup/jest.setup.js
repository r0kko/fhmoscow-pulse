import { afterAll } from '@jest/globals';

afterAll(async () => {
  const instances = Array.from(globalThis.__FHMO_SEQUELIZE_INSTANCES__ || []);
  await Promise.allSettled(
    instances.map(async (instance) => {
      try {
        await instance.close?.();
      } finally {
        globalThis.__FHMO_SEQUELIZE_INSTANCES__?.delete?.(instance);
      }
    })
  );

  for (const handle of process._getActiveHandles()) {
    if (
      handle?.constructor?.name === 'Socket' &&
      Number(handle.remotePort) === 5432
    ) {
      handle.destroy();
    }
  }
});
