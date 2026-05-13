const handlers = new Map();

function key(jobType, operation) {
  return `${jobType}:${operation}`;
}

export function registerAsyncJobHandler(jobType, operation, handler) {
  if (!jobType || !operation || !handler?.processItem) {
    throw new Error('invalid_async_job_handler');
  }
  handlers.set(key(jobType, operation), handler);
}

export function getAsyncJobHandler(jobType, operation) {
  return handlers.get(key(jobType, operation)) || null;
}

export function listAsyncJobHandlers() {
  return [...handlers.keys()];
}

export default {
  registerAsyncJobHandler,
  getAsyncJobHandler,
  listAsyncJobHandlers,
};
