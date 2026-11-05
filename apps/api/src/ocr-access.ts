export type OcrRole = 'owner'|'admin'|'lawyer'|'analyst'|'operations'|'consultant'|'support'|'data_steward'|'viewer';

export const ocrAccess = {
  canIntake: (role: OcrRole) => ['owner','admin','lawyer','analyst','operations'].includes(role),
  canCorrect: (role: OcrRole) => ['owner','analyst'].includes(role),
  canSubmit: (role: OcrRole) => ['owner','analyst'].includes(role),
  canDecide: (role: OcrRole) => role === 'lawyer',
  canConfigure: (role: OcrRole) => ['owner','admin'].includes(role),
  canSteward: (role: OcrRole) => ['owner','admin','data_steward'].includes(role),
  canViewConfidential: (role: OcrRole) => ['owner','admin','lawyer','analyst','operations'].includes(role),
  canViewApproved: (role: OcrRole) => ['consultant','viewer'].includes(role),
  canSupportDiagnostics: (role: OcrRole) => role === 'support',
} as const;
