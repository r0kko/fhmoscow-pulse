export function toSortedUnique<T>(
  list: ReadonlyArray<T> | null | undefined,
  selector: (item: T) => string | null | undefined
): string[] {
  const items = new Set<string>();
  (list ?? []).forEach((item) => {
    const raw = selector(item);
    const normalized = raw?.toString().trim();
    if (normalized) items.add(normalized);
  });
  return Array.from(items).sort((a, b) =>
    String(a).localeCompare(String(b), 'ru', { sensitivity: 'base' })
  );
}

export function addUnique(list: string[], value: string): void {
  const val = (value ?? '').trim();
  if (!val) return;
  if (!list.includes(val)) list.push(val);
}

export function removeFrom(list: string[], value: string): void {
  const index = list.indexOf(value);
  if (index >= 0) list.splice(index, 1);
}
