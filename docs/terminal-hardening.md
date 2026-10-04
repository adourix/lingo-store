# POS Terminal Hardening

Use a dedicated shop account with no administrator privileges.

## Required controls
- Full-disk encryption.
- Automatic OS security updates.
- Managed Chromium in kiosk mode.
- No personal browser profiles or extensions.
- Disable password managers and browser sync.
- Restrict outbound traffic to the POS host and required update/provider endpoints.
- Start Chromium automatically after boot.
- Prevent sleep/lock during the business shift while preserving OS security updates.
- Keep the terminal behind the shop network or an allow-list where possible.
- Record terminal name, physical location, assigned operator, and hardware identifier.
- Revoke the terminal immediately when it is lost, replaced, or decommissioned.

## Enrollment
1. Create a short-lived enrollment code in Admin.
2. Open /enroll on the managed terminal.
3. Enter the code and terminal name.
4. Confirm the terminal appears in Admin.
5. Perform a cashier login and verify the POS surface cannot reach Admin routes.

## Verification
- Browser storage contains no bearer/session token.
- POS authentication uses HttpOnly host-only cookies.
- Printer access remains client-side.
- Offline sales remain within configured risk limits.
