export function documentStatusBadgeClass(alias: string | null | undefined) {
  switch (String(alias || '')) {
    case 'SIGNED':
    case 'POSTED':
      return 'bg-success-subtle text-success border';
    case 'AWAITING_SIGNATURE':
      return 'bg-warning-subtle text-warning border';
    case 'CANCELED':
      return 'bg-danger-subtle text-danger border';
    case 'CREATED':
    case 'DRAFT':
    default:
      return 'bg-secondary-subtle text-secondary border';
  }
}
