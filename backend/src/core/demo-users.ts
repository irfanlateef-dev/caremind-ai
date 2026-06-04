/** Demo clinic accounts created by `npm run seed` — MFA is never used or offered. */
export const DEMO_EMAIL_DOMAIN = 'demo.clinic';

export const DEMO_ORG_SLUG = 'demo-clinic';

export const DEMO_SEED_EMAILS = [
  'admin@demo.clinic',
  'doctor@demo.clinic',
  'patient@demo.clinic',
] as const;

export type DemoSeedEmail = (typeof DEMO_SEED_EMAILS)[number];

export function isDemoAccountEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}
