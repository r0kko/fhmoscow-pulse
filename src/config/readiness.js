let ready = false;
let syncing = false;

export function setReady(val) {
  ready = !!val;
  import('./metrics.js').then((m) => m.setAppReady?.(ready)).catch(() => {});
}
export function isReady() {
  return ready;
}
export function setSyncing(val) {
  syncing = !!val;
  import('./metrics.js')
    .then((m) => m.setAppSyncing?.(syncing))
    .catch(() => {});
}
export function isSyncing() {
  return syncing;
}

export default { setReady, isReady, setSyncing, isSyncing };
