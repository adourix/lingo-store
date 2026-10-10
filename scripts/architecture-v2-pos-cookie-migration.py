from pathlib import Path
import re

p = Path('apps/api/src/server.ts')
s = p.read_text()

s = s.replace('  posRefreshInput,\n', '')

s, n = re.subn(
    r'const getPosSession = async \(req: FastifyRequest\) => \{.*?\n\};\nconst audit = async',
    '''const getPosSession = async (req: FastifyRequest) => {
  const raw = req.cookies["__Host-lingo_pos_sid"];
  if (!raw) return null;
  const now = new Date();
  const s = await prisma.session.findUnique({
    where: { tokenHash: sha(raw) },
    include: { staffUser: true, customerAccount: true, terminal: true },
  });
  if (
    !s ||
    s.kind !== SessionKind.POS ||
    s.state !== "ACTIVE" ||
    s.revokedAt ||
    s.expiresAt <= now ||
    s.idleExpiresAt <= now ||
    !s.staffUser ||
    !s.terminal ||
    !s.staffUser.isActive ||
    s.staffUser.status !== StaffStatus.ACTIVE ||
    !s.terminal.isActive
  )
    return null;
  const lastSeenAt = new Date();
  await prisma.$transaction([
    prisma.session.update({
      where: { id: s.id },
      data: {
        lastSeenAt,
        idleExpiresAt: new Date(Math.min(s.expiresAt.getTime(), Date.now() + 1800 * 1000)),
      },
    }),
    prisma.terminal.update({ where: { id: s.terminal.id }, data: { lastSeenAt } }),
  ]);
  return s;
};
const audit = async''',
    s,
    flags=re.S,
)
assert n == 1, f'getPosSession replacement count={n}'

s = s.replace(
    '  if (p.startsWith("/api/pos/")) return true;\n',
    '  if (p === "/api/pos/auth/login" || p === "/api/pos/auth/enroll") return true;\n',
)

s = s.replace(
    '  const csrfName = req.url.split("?")[0].startsWith("/api/admin/")\n    ? "__Host-lingo_admin_csrf"\n    : "__Host-lingo_csrf";',
    '  const path = req.url.split("?")[0];\n  const csrfName = path.startsWith("/api/admin/")\n    ? "__Host-lingo_admin_csrf"\n    : path.startsWith("/api/pos/")\n      ? "__Host-lingo_pos_csrf"\n      : "__Host-lingo_csrf";',
)
s = s.replace(
    '  const name = req.url.split("?")[0].startsWith("/api/admin/")\n    ? "__Host-lingo_admin_csrf"\n    : "__Host-lingo_csrf";',
    '  const path = req.url.split("?")[0];\n  const name = path.startsWith("/api/admin/")\n    ? "__Host-lingo_admin_csrf"\n    : path.startsWith("/api/pos/")\n      ? "__Host-lingo_pos_csrf"\n      : "__Host-lingo_csrf";',
)

s = s.replace(
    '  reply.setCookie(kind === SessionKind.ADMIN ? "__Host-lingo_admin_csrf" : "__Host-lingo_csrf", c, {',
    '  reply.setCookie(\n    kind === SessionKind.ADMIN\n      ? "__Host-lingo_admin_csrf"\n      : kind === SessionKind.POS\n        ? "__Host-lingo_pos_csrf"\n        : "__Host-lingo_csrf",\n    c,\n    {',
)
s = s.replace('    ...csrfOpts,\n    maxAge,\n  });\n  return c;\n};', '      ...csrfOpts,\n      maxAge,\n    },\n  );\n  return c;\n};', 1)

old_enroll_return = '''      return {
        terminal: { id: t.id, name: t.name },
        deviceCredential: credential,
      };'''
new_enroll_return = '''      reply.setCookie("__Host-lingo_terminal", credential, {
        ...cookieOpts,
        maxAge: 180 * 24 * 60 * 60,
      });
      return { terminal: { id: t.id, name: t.name } };'''
assert old_enroll_return in s
s = s.replace(old_enroll_return, new_enroll_return, 1)

s, n = re.subn(
    r'const issueDeviceTokens = async .*?\napp.post<ApiRouteGeneric>\(\n  "/api/pos/auth/login",',
    'app.post<ApiRouteGeneric>(\n  "/api/pos/auth/login",',
    s,
    flags=re.S,
)
assert n == 1, f'issueDeviceTokens removal count={n}'

s, n = re.subn(
    r'app.post<ApiRouteGeneric>\(\n  "/api/pos/auth/login",.*?\napp.post<ApiRouteGeneric>\("/api/pos/auth/unlock",',
    '''app.post<ApiRouteGeneric>(
  "/api/pos/auth/login",
  {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "15 minutes",
        keyGenerator: (req: FastifyRequest) =>
          req.ip + ":" + String(bodyField(req.body, "username") || ""),
      },
    },
  },
  async (req: RequestWithSession, reply) => {
    const parsed = posLoginInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const rawCredential = req.cookies["__Host-lingo_terminal"] || "";
    const term = rawCredential
      ? await prisma.terminal.findUnique({ where: { credentialHash: sha(rawCredential) } })
      : null;
    const stale =
      rawCredential && !term
        ? await prisma.terminal.findFirst({
            where: {
              previousCredentialHash: sha(rawCredential),
              previousCredentialExpiresAt: { gt: new Date() },
            },
          })
        : null;
    const { username, password } = parsed.data;
    const u = username && (await prisma.staffUser.findUnique({ where: { username } }));
    if (stale) {
      await prisma.session.updateMany({
        where: { terminalId: stale.id, kind: SessionKind.POS, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await audit(undefined, "pos.credential.reuse", "terminal", stale.id, false, {}, req);
    }
    if (
      !term?.isActive ||
      !u ||
      !u.isActive ||
      u.status !== StaffStatus.ACTIVE ||
      !(await hasPermission(u.id, "pos.use")) ||
      !u.passwordHash ||
      !(await verifyPassword(String(password || ""), u.passwordHash))
    )
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    if (needsPasswordRehash(u.passwordHash))
      await prisma.staffUser.update({
        where: { id: u.id },
        data: { passwordHash: await hashPassword(password) },
      });
    const nextCredential = token();
    const sessionRaw = token();
    const now = new Date();
    await prisma.$transaction([
      prisma.terminal.update({
        where: { id: term.id },
        data: {
          credentialHash: sha(nextCredential),
          previousCredentialHash: rawCredential ? sha(rawCredential) : null,
          previousCredentialExpiresAt: rawCredential ? new Date(Date.now() + 300000) : null,
          lastSeenAt: now,
        },
      }),
      prisma.session.create({
        data: {
          tokenHash: sha(sessionRaw),
          kind: SessionKind.POS,
          state: "ACTIVE",
          staffUserId: u.id,
          terminalId: term.id,
          expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
          idleExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
          ip: req.ip,
          userAgent: String(req.headers["user-agent"] || ""),
        },
      }),
    ]);
    reply.setCookie("__Host-lingo_terminal", nextCredential, {
      ...cookieOpts,
      maxAge: 180 * 24 * 60 * 60,
    });
    reply.setCookie("__Host-lingo_pos_sid", sessionRaw, {
      ...cookieOpts,
      maxAge: 12 * 60 * 60,
    });
    reply.setCookie("__Host-lingo_pos_csrf", token(), { ...csrfOpts, maxAge: 12 * 60 * 60 });
    await audit(u.id, "pos.login", "terminal", term.id, true, {}, req);
    return {
      user: { id: u.id, name: u.name },
      terminal: { id: term.id, name: term.name },
    };
  },
);
app.post<ApiRouteGeneric>("/api/pos/auth/unlock",''',
    s,
    flags=re.S,
)
assert n == 1, f'login replacement count={n}'

s, n = re.subn(
    r'app.post<ApiRouteGeneric>\("/api/pos/auth/refresh".*?\napp.post<ApiRouteGeneric>\("/api/pos/auth/unlock",',
    'app.post<ApiRouteGeneric>("/api/pos/auth/unlock",',
    s,
    flags=re.S,
)
assert n == 1, f'refresh removal count={n}'

s = s.replace(
    '''    await prisma.deviceSession.updateMany({
      where: { id: requestSession(req).id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };''',
    '''    await prisma.session.updateMany({
      where: { id: requestSession(req).id, kind: SessionKind.POS, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    reply.clearCookie("__Host-lingo_pos_sid", cookieOpts);
    reply.clearCookie("__Host-lingo_pos_csrf", csrfOpts);
    return { ok: true };''',
    1,
)

old_revoke = '''      prisma.terminal.update({
        where: { id: t.id },
        data: {
          isActive: false,
          previousCredentialHash: null,
          previousCredentialExpiresAt: null,
          credentialHash: sha(token()),
        },
      }),'''
new_revoke = '''      prisma.terminal.update({
        where: { id: t.id },
        data: {
          isActive: false,
          previousCredentialHash: null,
          previousCredentialExpiresAt: null,
          credentialHash: sha(token()),
        },
      }),'''
assert old_revoke in s
# Keep the terminal mutation; POS Session revocation below is now authoritative.

p.write_text(s)
print('patched server.ts')
