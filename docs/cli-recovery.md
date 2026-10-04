# CLI Recovery Procedures

Run these commands on the API host from the built API package.

## Issue a new administrator setup link

    node dist/cli.js admin:issue-setup-link --email owner@lingostore.example

The command resets the pending setup state, revokes sessions, creates a fresh single-use MFA secret, and prints a 15-minute setup URL.

## Emergency MFA reset

    node dist/cli.js admin:reset-mfa --email owner@lingostore.example

The command replaces the administrator MFA credential, replaces recovery codes, revokes sessions, and prints the new secret and recovery codes once.

Transfer the output through a secure channel and never put it in tickets, chat, logs, or shell history.

## After recovery
- Sign in and verify MFA.
- Save recovery codes in the approved password manager.
- Review Admin sessions and audit logs.
- Investigate why recovery was necessary.
