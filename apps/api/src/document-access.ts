export type DocumentFileAccess = 'allow' | 'not_found' | 'forbidden';

/** Mirrors the existing API file and signed-link policy without changing role grants. */
export function documentFileAccess(input: {
  role: string | undefined;
  propertyStatus?: string | null;
  reviewStatus?: string | null;
}): DocumentFileAccess {
  if (input.role === 'consultant' || input.role === 'viewer') {
    return ['approved', 'complete'].includes(String(input.propertyStatus || '')) && input.reviewStatus === 'approved'
      ? 'allow'
      : 'not_found';
  }
  if (input.role === 'data_steward' || input.role === 'support') return 'forbidden';
  return 'allow';
}
