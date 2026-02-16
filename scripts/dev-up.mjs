import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import pg from "pg";

const { Client } = pg;

const IS_WINDOWS = process.platform === "win32";
const ROOT = process.cwd();
const CONTAINER_NAME = process.env.OPSOS_DB_CONTAINER_NAME ?? "opsos-postgres";
const POSTGRES_IMAGE = process.env.OPSOS_DB_IMAGE ?? "postgres:16";

function log(message) {
  console.log(`[dev:up] ${message}`);
}

function fail(message) {
  console.error(`[dev:up] ${message}`);
  process.exit(1);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    let value = match[2].trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function parseDatabaseConnection(connectionString) {
  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch {
    fail("DATABASE_URL is not a valid URL.");
  }

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    fail("DATABASE_URL must use postgres:// or postgresql://");
  }

  const host = parsed.hostname;
  const port = Number(parsed.port || "5432");
  const database = parsed.pathname.replace(/^\//, "");
  const user = decodeURIComponent(parsed.username || "postgres");
  const password = decodeURIComponent(parsed.password || "");

  if (!database) {
    fail("DATABASE_URL must include a database name.");
  }

  return {
    host,
    port,
    database,
    user,
    password,
  };
}

function isLocalHost(host) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

async function canConnect(connectionString) {
  const client = new Client({
    connectionString,
  });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

function runChecked(command, args, label) {
  log(label);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: IS_WINDOWS,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runCapture(command, args) {
  return spawnSync(command, args, {
    encoding: "utf8",
    shell: IS_WINDOWS,
  });
}

function ensureDockerInstalled() {
  const check = runCapture("docker", ["--version"]);
  if (check.status !== 0) {
    fail(
      "Docker is required for auto-start. Install Docker Desktop or start your database manually.",
    );
  }
}

function inspectContainer(name) {
  const result = runCapture("docker", ["container", "inspect", name]);
  if (result.status !== 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(result.stdout);
    return Array.isArray(parsed) ? parsed[0] : null;
  } catch {
    return null;
  }
}

function createContainer(config) {
  if (!config.password) {
    fail(
      "DATABASE_URL password is empty. Add a password before auto-creating a Postgres container.",
    );
  }

  log(
    `Creating Postgres container '${CONTAINER_NAME}' (image ${POSTGRES_IMAGE}) on port ${config.port}`,
  );
  const result = spawnSync(
    "docker",
    [
      "run",
      "--name",
      CONTAINER_NAME,
      "-e",
      `POSTGRES_USER=${config.user}`,
      "-e",
      `POSTGRES_PASSWORD=${config.password}`,
      "-e",
      `POSTGRES_DB=${config.database}`,
      "-p",
      `${config.port}:5432`,
      "-d",
      POSTGRES_IMAGE,
    ],
    {
      stdio: "inherit",
      shell: IS_WINDOWS,
    },
  );

  if (result.status !== 0) {
    fail("Failed to create local Postgres container.");
  }
}

function startContainer(name) {
  log(`Starting existing Postgres container '${name}'`);
  const result = spawnSync("docker", ["start", name], {
    stdio: "inherit",
    shell: IS_WINDOWS,
  });
  if (result.status !== 0) {
    fail("Failed to start existing Postgres container.");
  }
}

async function waitForDatabase(connectionString, maxAttempts = 30, waitMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (await canConnect(connectionString)) {
      return;
    }
    log(`Waiting for Postgres to be ready (${attempt}/${maxAttempts})...`);
    await new Promise((resolve) => {
      setTimeout(resolve, waitMs);
    });
  }
  fail("Postgres did not become ready in time.");
}

async function ensureDatabaseReady(connectionString) {
  if (await canConnect(connectionString)) {
    log("Database connection is healthy.");
    return;
  }

  const config = parseDatabaseConnection(connectionString);

  if (!isLocalHost(config.host)) {
    fail(
      `Cannot auto-start non-local host '${config.host}'. Start that database first, then re-run.`,
    );
  }

  ensureDockerInstalled();

  const inspection = inspectContainer(CONTAINER_NAME);
  if (!inspection) {
    createContainer(config);
  } else if (!inspection.State?.Running) {
    startContainer(CONTAINER_NAME);
  } else {
    log(`Container '${CONTAINER_NAME}' is already running.`);
  }

  await waitForDatabase(connectionString);
  log("Database is ready.");
}

function startDevServer() {
  log("Starting Next.js dev server...");
  const child = spawn("npm", ["run", "dev"], {
    stdio: "inherit",
    shell: IS_WINDOWS,
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

function printHelp() {
  console.log(
    [
      "Usage: npm run dev:up [-- --no-dev]",
      "",
      "Runs the full local startup flow without resetting data:",
      "1) Starts local Postgres via Docker if needed",
      "2) Runs Prisma client generation",
      "3) Runs prisma db push (no reset)",
      "4) Starts Next.js dev server",
      "",
      "Options:",
      "  --no-dev  Run setup only, skip starting Next.js",
    ].join("\n"),
  );
}

async function main() {
  loadEnvFile(path.join(ROOT, ".env"));

  const args = process.argv.slice(2);
  const showHelp = args.includes("--help") || args.includes("-h");
  const noDev = args.includes("--no-dev");

  if (showHelp) {
    printHelp();
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    fail("DATABASE_URL is missing. Add it to your .env file.");
  }

  await ensureDatabaseReady(connectionString);
  runChecked("npm", ["run", "prisma:generate"], "Generating Prisma client...");
  runChecked("npx", ["prisma", "db", "push"], "Applying Prisma schema (safe, no reset)...");

  if (noDev) {
    log("Setup finished.");
    return;
  }

  startDevServer();
}

await main();
