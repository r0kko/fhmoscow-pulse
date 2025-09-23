import { reactive, readonly } from 'vue';

export interface ToastItem {
  id: number;
  message: string;
  variant: string;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

interface ToastState {
  items: ToastItem[];
}

const state: ToastState = reactive({
  items: [],
});

let idSeq = 1;

function push(
  message: string,
  variant: string = 'secondary',
  duration = 3000
): number {
  const id = idSeq++;
  const item: ToastItem = { id, message, variant, timeoutId: null };
  state.items.push(item);
  if (duration > 0) {
    item.timeoutId = setTimeout(() => remove(id), duration);
  }
  return id;
}

function remove(id: number): void {
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
  } as const;
}
