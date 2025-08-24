let ready = false;
let syncing = false;

export function setReady(val) {
  ready = !!val;
}
export function isReady() {
  return ready;
}
export function setSyncing(val) {
  syncing = !!val;
}
export function isSyncing() {
  return syncing;
}

export default { setReady, isReady, setSyncing, isSyncing };
