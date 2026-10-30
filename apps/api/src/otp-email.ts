import nodemailer from 'nodemailer';

export interface OtpEmailInput {
  to: string;
  name: string;
  otp: string;
  purpose: 'login' | 'registration' | 'password_reset';
  from: string;
}

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export type SmtpTransportFactory = (settings: {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
}) => { sendMail(message: Record<string, unknown>): Promise<unknown> };

export async function sendOtpEmailWithSmtp(
  settings: SmtpSettings,
  message: OtpEmailInput,
  transportFactory: SmtpTransportFactory = nodemailer.createTransport as unknown as SmtpTransportFactory,
) {
  const safeName = message.name.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[char] || '');
  const isRegistration = message.purpose === 'registration';
  const isPasswordReset = message.purpose === 'password_reset';
  const subject = isRegistration ? 'Verify your OJIX account' : isPasswordReset ? 'Reset your OJIX password' : 'Your OJIX secure sign-in code';
  const title = isRegistration ? 'Verify your OJIX account' : isPasswordReset ? 'Reset your password' : 'Confirm your secure sign-in';
  const action = isRegistration ? 'complete your account registration' : isPasswordReset ? 'set a new password for your OJIX account' : 'sign in to your OJIX workspace';
  const digitCells = message.otp.split('').map(digit => `<td style="width:42px;height:50px;padding:0 3px"><div style="height:50px;line-height:50px;border:1px solid #dbe4ef;border-radius:7px;background:#ffffff;color:#1d4278;font-size:26px;font-weight:800;text-align:center">${digit}</div></td>`).join('');
  const text = `Hello ${message.name},\n\nYour OJIX verification code is ${message.otp}. Use it to ${action}.\n\nThe code expires in 10 minutes and can be used once. Email verification does not verify your mobile number. If you did not request this code, ignore this email and do not share it.\n\nOJIX Property Intelligence`;
  const html = `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#f2f5f9;font-family:Arial,Helvetica,sans-serif;color:#334155">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e1e7ef;border-radius:10px;overflow:hidden">
<tr><td style="padding:22px 28px;background:#1d4278;color:#ffffff"><div style="font-size:18px;font-weight:800;letter-spacing:.2px">OJIX <span style="color:#f28a52">Property Intelligence</span></div><div style="margin-top:5px;color:#d9e4f2;font-size:10px;font-weight:700;letter-spacing:1.1px">ACCOUNT SECURITY</div></td></tr>
<tr><td style="padding:26px 28px 12px"><h1 style="margin:0 0 12px;color:#1d2d44;font-size:22px;line-height:1.3">${title}</h1><p style="margin:0 0 8px;font-size:14px;line-height:1.6">Hello ${safeName},</p><p style="margin:0;color:#53647a;font-size:14px;line-height:1.6">Enter this code to ${action}:</p></td></tr>
<tr><td style="padding:12px 28px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f9;border-radius:8px"><tr><td style="padding:16px 14px 8px;color:#53647a;font-size:13px;font-weight:700">Code requested</td></tr><tr><td style="padding:0 10px 16px"><table role="presentation" align="left" cellpadding="0" cellspacing="4"><tr>${digitCells}</tr></table></td></tr></table></td></tr>
<tr><td style="padding:0 28px 26px"><p style="margin:0 0 8px;color:#334155;font-size:13px;line-height:1.6"><strong>Expires in 10 minutes.</strong> This code can be used once.</p><p style="margin:0 0 12px;color:#64748b;font-size:12px;line-height:1.6">Email verification does not verify your mobile number. If you did not request this code, ignore this email and do not share it.</p><div style="padding-top:13px;border-top:1px solid #e8edf3;color:#7b8797;font-size:11px;line-height:1.5">OJIX Property Intelligence<br/>Secure account verification</div></td></tr>
</table></body></html>`;
  const transporter = transportFactory({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: { user: settings.user, pass: settings.pass },
  });
  await transporter.sendMail({ from: message.from, to: message.to, subject, html, text });
}
