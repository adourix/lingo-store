import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_DIR = path.join(ROOT_DIR, "apps/api");
const container = "lingo-store-ci-postgres";
const port = "55432";
const db = "lingo_store";
const migratorUrl = `postgresql://lingo_migrator:migrator-test-password@localhost:${port}/${db}`;
const appUrl = `postgresql://lingo_app:app-test-password@localhost:${port}/${db}`;

function run(command, args, env = process.env, cwd = ROOT_DIR) {
  execFileSync(command, args, { cwd, env, stdio: "inherit" });
}

function docker(args) {
  run("docker", args);
}

function cleanup() {
  try {
    docker(["rm", "-f", container]);
  } catch {}
}

if (process.env.CI !== "true") {
  run("node", ["--import", "tsx", "--test", "src/tests/*.test.ts"], process.env, API_DIR);
  process.exit(0);
}

cleanup();
try {
  docker([
    "run",
    "-d",
    "--name",
    container,
    "-e",
    "POSTGRES_USER=postgres",
    "-e",
    "POSTGRES_PASSWORD=postgres",
    "-e",
    `POSTGRES_DB=${db}`,
    "-p",
    `127.0.0.1:${port}:5432`,
    "postgres:17",
  ]);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = spawnSync(
      "docker",
      ["exec", container, "pg_isready", "-U", "postgres", "-d", db],
      { stdio: "ignore" },
    );
    if (result.status === 0) break;
    if (attempt === 29) throw new Error("PostgreSQL did not become ready in time");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  docker([
    "exec",
    container,
    "psql",
    "-U",
    "postgres",
    "-d",
    db,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "CREATE ROLE lingo_migrator LOGIN PASSWORD 'migrator-test-password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT; CREATE ROLE lingo_app LOGIN PASSWORD 'app-test-password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT; CREATE ROLE lingo_readonly LOGIN PASSWORD 'readonly-test-password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT; REVOKE CREATE ON SCHEMA public FROM PUBLIC; GRANT CONNECT ON DATABASE lingo_store TO lingo_migrator, lingo_app, lingo_readonly; GRANT USAGE, CREATE ON SCHEMA public TO lingo_migrator; GRANT USAGE ON SCHEMA public TO lingo_app, lingo_readonly;",
  ]);

  run("pnpm", ["exec", "prisma", "migrate", "deploy", "--schema=./prisma/schema.prisma"], {
    ...process.env,
    DATABASE_URL: migratorUrl,
    MIGRATOR_DATABASE_URL: migratorUrl,
  });
  run("pnpm", ["exec", "tsx", "apps/api/seed.ts"], {
    ...process.env,
    DATABASE_URL: migratorUrl,
    MIGRATOR_DATABASE_URL: migratorUrl,
  });

  const rolesSql = execFileSync("cat", [path.join(ROOT_DIR, "infra/postgres/roles.sql")], {
    encoding: "utf8",
  });
  const grantResult = spawnSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1"],
    { input: rolesSql, stdio: ["pipe", "inherit", "inherit"] },
  );
  if (grantResult.status !== 0) process.exit(grantResult.status ?? 1);

  run(
    "node",
    ["--import", "tsx", "--test", "src/tests/*.test.ts"],
    { ...process.env, TEST_DATABASE_URL: appUrl },
    API_DIR,
  );
} finally {
  cleanup();
}
