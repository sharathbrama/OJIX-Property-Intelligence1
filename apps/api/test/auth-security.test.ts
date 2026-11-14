import assert from 'node:assert/strict';
import test from 'node:test';
import { generateOtp, generateOtpSalt, hashOtp, hashPassword, resolveDemoCredential, verifyOtp, verifyPassword } from '../src/auth-security.js';
import { classifySmtpFailure, getSmtpConfigurationIssues, readSmtpSettings, sendOtpEmailWithSmtp, smtpPublicError, type SmtpTransportFactory } from '../src/otp-email.js';

const demoRoles = [
  'super-admin', 'owner', 'admin', 'lawyer', 'analyst', 'operations', 'consultant', 'support', 'data_steward', 'viewer',
];

test('same-email demo credentials resolve by stored password hash, not client role', () => {
  const accounts = demoRoles.map(role => ({ uid: `demo-${role}`, email: 'owner@ojix.test', role }));
  const hashes = new Map(accounts.map(account => [account.uid, hashPassword(`test-${account.role}-password`)]));

  for (const account of accounts) {
    assert.equal(resolveDemoCredential(account.email, `test-${account.role}-password`, accounts, hashes)?.uid, account.uid);
  }
  assert.equal(resolveDemoCredential('unknown@example.com', 'test-owner-password', accounts, hashes), null);
  assert.equal(resolveDemoCredential('owner@ojix.test', 'wrong-password', accounts, hashes), null);
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

test('SMTP OTP delivery verifies its Gmail transport before sending the message', async () => {
  let sent: Record<string, unknown> | undefined;
  const calls: string[] = [];
  const settings = readSmtpSettings({ SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '465', SMTP_SECURE: 'true', SMTP_USER: 'sender@gmail.com', SMTP_PASS: 'abcd efgh ijkl mnop' });
  const factory: SmtpTransportFactory = settings => ({
    async verify() { calls.push('verify'); assert.equal(settings.host, 'smtp.gmail.com'); assert.equal(settings.port, 465); assert.equal(settings.secure, true); assert.equal(settings.requireTLS, false); assert.equal(settings.auth.pass, 'abcdefghijklmnop'); return true; },
    async sendMail(message) { calls.push('send'); sent = message; return {}; },
  });
  await sendOtpEmailWithSmtp(
    settings,
    { to: 'recipient@example.com', name: '<Tester>', otp: '123456', purpose: 'login', from: 'OJIX <sender@gmail.com>' },
    factory,
  );
  assert.equal(sent?.to, 'recipient@example.com');
  assert.equal(sent?.from, 'OJIX <sender@gmail.com>');
  assert.equal(sent?.subject, 'Your OJIX secure sign-in code');
  assert.match(String(sent?.html), /One-time security code/);
  assert.match(String(sent?.html), /Automated System Notification/);
  assert.match(String(sent?.html), /All Rights Reserved/);
  assert.match(String(sent?.html), /expires in 10 minutes/i);
  assert.equal([...String(sent?.html).matchAll(/text-align:center">[0-9]<\/div>/g)].length, 6);
  assert.equal(String(sent?.html).includes('<Tester>'), false);
  assert.match(String(sent?.text), /123456/);
  assert.match(String(sent?.text), /can be used once/);
  assert.deepEqual(calls, ['verify', 'send']);
});

test('password recovery email is clearly identified and contains only the one-time code', async () => {
  let sent: Record<string, unknown> | undefined;
  const factory: SmtpTransportFactory = () => ({ async verify() { return true; }, async sendMail(message) { sent = message; return {}; } });
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

test('registration verification email uses the registration purpose and recipient', async () => {
  let sent: Record<string, unknown> | undefined;
  const factory: SmtpTransportFactory = () => ({ async verify() { return true; }, async sendMail(message) { sent = message; return {}; } });
  await sendOtpEmailWithSmtp(
    { host: 'smtp.test.invalid', port: 465, secure: true, user: 'sender@example.com', pass: 'test-secret' },
    { to: 'new-user@example.com', name: 'New User', otp: '123456', purpose: 'registration', from: 'sender@example.com' },
    factory,
  );
  assert.equal(sent?.to, 'new-user@example.com');
  assert.equal(sent?.subject, 'Verify your OJIX account');
  assert.match(String(sent?.text), /complete your account registration/);
});

test('Gmail SMTP settings normalize grouped App Passwords and enforce the expected TLS mode', () => {
  const settings = readSmtpSettings({ SMTP_USER: 'sender@gmail.com', SMTP_PASS: 'abcd efgh ijkl mnop' });
  assert.deepEqual(settings, { host: 'smtp.gmail.com', port: 465, secure: true, user: 'sender@gmail.com', pass: 'abcdefghijklmnop' });
  assert.throws(() => readSmtpSettings({ SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '465', SMTP_SECURE: 'false', SMTP_USER: 'sender@gmail.com', SMTP_PASS: 'abcdefghijklmnop' }), /Gmail SMTP requires/);
  assert.throws(() => readSmtpSettings({ SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '587', SMTP_SECURE: 'true', SMTP_USER: 'sender@gmail.com', SMTP_PASS: 'abcdefghijklmnop' }), /Gmail SMTP requires/);
});

test('Gmail port 587 uses STARTTLS and SMTP_FROM defaults cleanly to the authenticated user', () => {
  const settings = readSmtpSettings({ SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '587', SMTP_SECURE: 'false', SMTP_USER: 'sender@gmail.com', SMTP_PASS: 'abcdefghijklmnop' });
  assert.equal(settings.secure, false);
  assert.deepEqual(getSmtpConfigurationIssues({ SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '587', SMTP_SECURE: 'false', SMTP_USER: 'sender@gmail.com', SMTP_PASS: 'abcdefghijklmnop' }), []);
  assert.deepEqual(getSmtpConfigurationIssues({ SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '465', SMTP_SECURE: 'true', SMTP_USER: 'sender@gmail.com', SMTP_PASS: 'abcdefghijklmnop', SMTP_FROM: 'invalid sender' }), ['SMTP_FROM']);
});

test('SMTP readiness reports missing settings without exposing configured values', () => {
  assert.deepEqual(getSmtpConfigurationIssues({ SMTP_PORT:'465',SMTP_SECURE:'true' }), ['SMTP_USER','SMTP_PASS','SMTP_HOST']);
  assert.deepEqual(getSmtpConfigurationIssues({ SMTP_USER:'sender@gmail.com',SMTP_PASS:'secret',SMTP_PORT:'465',SMTP_SECURE:'true' }), []);
  assert.deepEqual(getSmtpConfigurationIssues({ SMTP_HOST:'smtp.example.com',SMTP_USER:'sender@example.com',SMTP_PASS:'secret',SMTP_PORT:'not-a-port',SMTP_SECURE:'maybe' }), ['SMTP_PORT','SMTP_SECURE']);
});

test('SMTP failures map to useful safe categories', () => {
  assert.equal(classifySmtpFailure(new Error('SMTP_USER and SMTP_PASS must be configured.')),'SMTP_NOT_CONFIGURED');
  assert.equal(classifySmtpFailure(Object.assign(new Error('Invalid login'),{code:'EAUTH',responseCode:535})),'SMTP_AUTH_FAILED');
  assert.equal(classifySmtpFailure(Object.assign(new Error('connect timed out'),{code:'ETIMEDOUT'})),'SMTP_SERVER_UNAVAILABLE');
  assert.equal(classifySmtpFailure(Object.assign(new Error('recipient rejected'),{responseCode:550})),'SMTP_RECIPIENT_REJECTED');
  assert.match(smtpPublicError('SMTP_AUTH_FAILED'),/app password/);
  assert.match(smtpPublicError('SMTP_DELIVERY_FAILED'),/no verification code was sent/);
});

test('SMTP delivery validates recipient and sender before opening a transport', async () => {
  let transportCreated = false;
  const factory: SmtpTransportFactory = () => {
    transportCreated = true;
    return { async verify() { return true; }, async sendMail() { return {}; } };
  };
  const settings = { host: 'smtp.test.invalid', port: 465, secure: true, user: 'sender@example.com', pass: 'test-secret' };
  await assert.rejects(sendOtpEmailWithSmtp(settings, { to: 'not-an-email', name: 'Tester', otp: '123456', purpose: 'login', from: 'sender@example.com' }, factory), /recipient address is invalid/);
  await assert.rejects(sendOtpEmailWithSmtp(settings, { to: 'recipient@example.com', name: 'Tester', otp: '123456', purpose: 'login', from: 'invalid sender' }, factory), /sender address is invalid/);
  assert.equal(transportCreated, false);
});

test('SMTP verification failure prevents OTP message delivery', async () => {
  let sendAttempted = false;
  const factory: SmtpTransportFactory = () => ({
    async verify() { throw Object.assign(new Error('authentication failed'), { code: 'EAUTH', responseCode: 535 }); },
    async sendMail() { sendAttempted = true; return {}; },
  });
  await assert.rejects(sendOtpEmailWithSmtp(
    { host: 'smtp.test.invalid', port: 465, secure: true, user: 'sender@example.com', pass: 'test-secret' },
    { to: 'recipient@example.com', name: 'Tester', otp: '123456', purpose: 'registration', from: 'sender@example.com' },
    factory,
  ), (error: unknown) => {
    assert.match(error instanceof Error ? error.message : '', /authentication failed/);
    assert.equal((error as Error & { smtpStage?: string }).smtpStage, 'verify');
    return true;
  });
  assert.equal(sendAttempted, false);
});

test('SMTP sendMail failure is marked as a delivery-stage failure', async () => {
  const factory: SmtpTransportFactory = () => ({
    async verify() { return true; },
    async sendMail() { throw Object.assign(new Error('recipient rejected'), { code: 'EENVELOPE', responseCode: 550, command: 'DATA' }); },
  });
  await assert.rejects(sendOtpEmailWithSmtp(
    { host: 'smtp.test.invalid', port: 465, secure: true, user: 'sender@example.com', pass: 'test-secret' },
    { to: 'recipient@example.com', name: 'Tester', otp: '123456', purpose: 'password_reset', from: 'sender@example.com' },
    factory,
  ), (error: unknown) => {
    assert.equal(classifySmtpFailure(error), 'SMTP_RECIPIENT_REJECTED');
    assert.equal((error as Error & { smtpStage?: string }).smtpStage, 'sendMail');
    assert.equal((error as Error & { responseCode?: number }).responseCode, 550);
    return true;
  });
});
