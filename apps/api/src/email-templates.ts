const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const escapeUrl = (value: string) => escapeHtml(value);

const shell = (title: string, preheader: string, content: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6f8;color:#172033;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f6f8;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e8ee;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px;border-bottom:1px solid #edf0f4;">
                <div style="font-size:22px;font-weight:800;letter-spacing:-0.4px;color:#111827;">Lingo Store</div>
                <div style="margin-top:5px;font-size:12px;color:#667085;">Retail management, made simple.</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">${content}</td>
            </tr>
            <tr>
              <td style="padding:22px 32px;background:#fafbfc;border-top:1px solid #edf0f4;color:#667085;font-size:12px;line-height:1.6;">
                <div>Lingo Store</div>
                <div>This is an automated message. Please do not reply unless the message asks you to.</div>
              </td>
            </tr>
          </table>
          <div style="max-width:600px;padding:14px 20px;color:#98a2b3;font-size:11px;line-height:1.5;text-align:center;">
            © Lingo Store
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const button = (url: string, label: string) => `
  <a href="${escapeUrl(url)}" style="display:inline-block;padding:13px 20px;background:#111827;color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:700;">${escapeHtml(label)}</a>
`;

const heading = (title: string, body: string) => `
  <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;color:#111827;">${escapeHtml(title)}</h1>
  <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#475467;">${escapeHtml(body)}</p>
`;

export const customerEmailVerificationHtml = (verifyUrl: string) =>
  shell(
    "Verify your Lingo Store email",
    "Verify your email address to finish setting up your Lingo Store account.",
    `${heading(
      "Verify your email",
      "Thanks for creating a Lingo Store account. Confirm your email address to activate account features.",
    )}
    ${button(verifyUrl, "Verify email address")}
    <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#667085;">If you did not create this account, you can safely ignore this email.</p>`,
  );

export const customerPasswordResetHtml = (resetUrl: string) =>
  shell(
    "Reset your Lingo Store password",
    "Use the secure link to choose a new Lingo Store password.",
    `${heading(
      "Reset your password",
      "We received a request to reset the password for your Lingo Store account. Use the button below to choose a new password.",
    )}
    ${button(resetUrl, "Reset password")}
    <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#667085;">If you did not request a password reset, no action is required.</p>`,
  );

export const staffPasswordResetHtml = (resetUrl: string) =>
  shell(
    "Reset your Lingo Store staff password",
    "Use the secure link to choose a new staff password.",
    `${heading(
      "Reset your staff password",
      "A password reset was requested for your Lingo Store staff account. Use the secure link below to continue.",
    )}
    ${button(resetUrl, "Reset staff password")}
    <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#667085;">If you did not request this, contact your store administrator.</p>`,
  );

export const staffSetupHtml = (params: {
  name: string;
  setupUrl: string;
  expiresAt: Date;
}) =>
  shell(
    "Set up your Lingo Store staff account",
    "Your Lingo Store staff account is ready for secure setup.",
    `${heading(
      `Welcome, ${params.name}`,
      "Your Lingo Store staff account has been created. Use the secure setup link to choose your password and finish MFA enrollment.",
    )}
    ${button(params.setupUrl, "Set up staff account")}
    <div style="margin-top:24px;padding:16px;background:#f8fafc;border:1px solid #e4e7ec;border-radius:10px;">
      <div style="font-size:12px;font-weight:700;color:#344054;margin-bottom:5px;">Security note</div>
      <div style="font-size:12px;line-height:1.6;color:#667085;">This invitation expires at ${escapeHtml(params.expiresAt.toISOString())}. The link is intended only for you and should not be forwarded.</div>
    </div>
    <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#667085;">If you were not expecting this invitation, contact your store administrator.</p>`,
  );
