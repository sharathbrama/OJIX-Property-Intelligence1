import crypto from 'node:crypto';

export interface DemoCredentialIdentity {
  uid: string;
  email: string;
}

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
}

export function resolveDemoCredential<T extends DemoCredentialIdentity>(
  email: string,
  password: string,
  accounts: readonly T[],
  hashesByUid: ReadonlyMap<string, string>,
) {
  const normalizedEmail = email.trim().toLowerCase();
  const matches = accounts.filter(account => {
    if (account.email.trim().toLowerCase() !== normalizedEmail) return false;
    const hash = hashesByUid.get(account.uid);
    return Boolean(hash && verifyPassword(password, hash));
  });
  return matches.length === 1 ? matches[0] : null;
}

export function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

export function generateOtpSalt() {
  return crypto.randomBytes(16).toString('hex');
}

export function hashOtp(email: string, otp: string, salt: string) {
  return crypto.scryptSync(`${email.trim().toLowerCase()}:${otp}`, salt, 32).toString('hex');
}

export function verifyOtp(email: string, otp: string, salt: string, expectedHash: string) {
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const actual = Buffer.from(hashOtp(email, otp, salt), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
