/** PRIV-A-40: the privacy switches a clinic records. Off until the decision is recorded. */
export type PrivacyGateKey = 'NAM_COLLECTION' | 'HEALTH_CARD_CAPTURE';
export const PRIVACY_GATE_KEYS: PrivacyGateKey[] = ['NAM_COLLECTION', 'HEALTH_CARD_CAPTURE'];

export interface PrivacyGate {
  gate: PrivacyGateKey;
  enabled: boolean;
  decisionRef: string | null;
  decidedAt: string | null;
  decidedByName: string | null;
}

/** Turning a gate on needs a non-blank decisionRef (at most 200 characters, not NAM-shaped). */
export interface PrivacyGateRequest { enabled: boolean; decisionRef: string | null }

/** PRIV-A-06: answer of the three link revocation endpoints. */
export interface RevokedLinks { revoked: number }
