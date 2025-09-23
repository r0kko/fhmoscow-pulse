export type TrainingAlias = 'ICE' | 'BASIC_FIT' | 'THEORY' | string | null | undefined;

export function typeBadgeClass(alias: TrainingAlias): string {
  if (!alias) return 'bg-secondary';
  switch (alias) {
    case 'ICE':
      return 'bg-brand';
    case 'BASIC_FIT':
      return 'bg-success';
    default:
      return 'bg-secondary';
  }
}
