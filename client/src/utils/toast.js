import { reactive, readonly } from 'vue';

const state = reactive({
  items: [], // { id, message, variant, timeoutId }
});

let idSeq = 1;

function push(message, variant = 'secondary', duration = 3000) {
  const id = idSeq++;
  const item = { id, message, variant, timeoutId: null };
  state.items.push(item);
  if (duration > 0) {
    item.timeoutId = setTimeout(() => remove(id), duration);
  }
  return id;
}

function remove(id) {
  const idx = state.items.findIndex((t) => t.id === id);
  if (idx >= 0) {
    const [item] = state.items.splice(idx, 1);
    if (item?.timeoutId) clearTimeout(item.timeoutId);
  }
}

export function useToast() {
  return {
    toasts: readonly(state.items),
    showToast: push,
    hideToast: remove,
  };
}
