import assert from 'node:assert/strict';
import test from 'node:test';
import { generateOtp, generateOtpSalt, hashOtp, hashPassword, resolveDemoCredential, verifyOtp, verifyPassword } from '../src/auth-security.js';
import { sendOtpEmailWithSmtp, type SmtpTransportFactory } from '../src/otp-email.js';

const demoRoles = [
  'super-admin', 'owner', 'admin', 'lawyer', 'analyst', 'operations', 'consultant', 'support', 'data_steward', 'viewer',
];

test('same-email demo credentials resolve by stored password hash, not client role', () => {
  const accounts = demoRoles.map(role => ({ uid: `demo-${role}`, email: 'keerthana1234p@gmail.com', role }));
  const hashes = new Map(accounts.map(account => [account.uid, hashPassword(`test-${account.role}-password`)]));

  for (const account of accounts) {
    assert.equal(resolveDemoCredential(account.email, `test-${account.role}-password`, accounts, hashes)?.uid, account.uid);
  }
  assert.equal(resolveDemoCredential('unknown@example.com', 'test-owner-password', accounts, hashes), null);
  assert.equal(resolveDemoCredential('keerthana1234p@gmail.com', 'wrong-password', accounts, hashes), null);
});

test('demo credential resolution rejects ambiguous matching password hashes', () => {
  const accounts = [
    { uid: 'first', email: 'same@example.com' },
    { uid: 'second', email: 'same@example.com' },
  ];
  const hash = hashPassword('shared-test-password');
  assert.equal(resolveDemoCredential('same@example.com', 'shared-test-password', accounts, new Map([['first', hash], ['second', hash]])), null);
});

test('password hashes verify without storing the original password', () => {
  const hash = hashPassword('test-password');
  assert.notEqual(hash, 'test-password');
  assert.equal(verifyPassword('test-password', hash), true);
  assert.equal(verifyPassword('incorrect-password', hash), false);
});

test('OTP generation is six digits and OTP hashes bind normalized email', () => {
  const otp = generateOtp();
  const salt = generateOtpSalt();
  assert.match(otp, /^\d{6}$/);
  assert.equal(hashOtp(' USER@example.com ', otp, salt), hashOtp('user@example.com', otp, salt));
  assert.notEqual(hashOtp('other@example.com', otp, salt), hashOtp('user@example.com', otp, salt));
  assert.notEqual(hashOtp('user@example.com', otp, generateOtpSalt()), hashOtp('user@example.com', otp, generateOtpSalt()));
  assert.equal(verifyOtp('user@example.com', otp, salt, hashOtp('user@example.com', otp, salt)), true);
  assert.equal(verifyOtp('user@example.com', '000000', salt, hashOtp('user@example.com', otp, salt)), false);
  assert.equal(verifyOtp('user@example.com', otp, salt, 'invalid'), false);
});

test('SMTP OTP delivery uses the configured mock transport without logging or returning the code', async () => {
  let sent: Record<string, unknown> | undefined;
  const factory: SmtpTransportFactory = () => ({ async sendMail(message) { sent = message; return {}; } });
  await sendOtpEmailWithSmtp(
    { host: 'smtp.test.invalid', port: 465, secure: true, user: 'sender@example.com', pass: 'test-secret' },
    { to: 'recipient@example.com', name: '<Tester>', otp: '123456', purpose: 'login', from: 'OJIX <sender@example.com>' },
    factory,
  );
  assert.equal(sent?.to, 'recipient@example.com');
  assert.equal(sent?.from, 'OJIX <sender@example.com>');
  assert.equal(sent?.subject, 'Your OJIX secure sign-in code');
  assert.match(String(sent?.html), /One-time security code/);
  assert.match(String(sent?.html), /Automated System Notification/);
  assert.match(String(sent?.html), /All Rights Reserved/);
  assert.match(String(sent?.html), /expires in 10 minutes/i);
  assert.equal([...String(sent?.html).matchAll(/text-align:center">[0-9]<\/div>/g)].length, 6);
  assert.equal(String(sent?.html).includes('<Tester>'), false);
  assert.match(String(sent?.text), /123456/);
  assert.match(String(sent?.text), /can be used once/);
});

test('password recovery email is clearly identified and contains only the one-time code', async () => {
  let sent: Record<string, unknown> | undefined;
  const factory: SmtpTransportFactory = () => ({ async sendMail(message) { sent = message; return {}; } });
  await sendOtpEmailWithSmtp(
    { host: 'smtp.test.invalid', port: 465, secure: true, user: 'sender@example.com', pass: 'test-secret' },
    { to: 'recipient@example.com', name: 'Reviewer', otp: '654321', purpose: 'password_reset', from: 'OJIX <sender@example.com>' },
    factory,
  );
  assert.equal(sent?.subject, 'Reset your OJIX password');
  assert.match(String(sent?.text), /set a new password/);
  assert.match(String(sent?.text), /654321/);
  assert.equal(String(sent?.text).includes('existing password'), false);
});
