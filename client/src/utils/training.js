export function typeBadgeClass(alias) {
  if (!alias) return 'bg-secondary';
  switch (alias) {
    case 'ICE':
      return 'bg-brand';
    case 'BASIC_FIT':
      return 'bg-success';
    case 'THEORY':
    default:
      return 'bg-secondary';
  }
}
