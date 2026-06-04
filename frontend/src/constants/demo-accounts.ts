export const DEMO_EMAIL_DOMAIN = 'demo.clinic';

/** Must match backend seed default (`SEED_DEMO_PASSWORD` or `Demo123!`). */
export const DEMO_SEED_PASSWORD = 'Demo123!';

export const DEMO_LOGIN_ACCOUNTS = [
  { label: 'Admin', email: 'admin@demo.clinic', role: 'admin' as const },
  { label: 'Doctor', email: 'doctor@demo.clinic', role: 'doctor' as const },
  { label: 'Patient', email: 'patient@demo.clinic', role: 'patient' as const },
];

export function isDemoAccountEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}
