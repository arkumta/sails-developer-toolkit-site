import http from "node:http";
import { spawn } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { realpath, stat, access } from "node:fs/promises";
import path from "node:path";

const HOST = "127.0.0.1";
const PORT = 43127;
const TIMEOUT_MS = 5 * 60 * 1000;
const MAX_OUTPUT = 1024 * 1024;

const ALLOWED_ORIGINS = new Set([
  "https://sails-developer-toolkit-site.vercel.app",
  "http://localhost:3000",
]);

const projectArgument = process.argv[2];

if (!projectArgument) {
  console.error(
    'Usage: node scripts/cargo-runner.mjs "/absolute/path/to/your/sails-project"',
  );
  process.exit(1);
}

const projectDir = await realpath(projectArgument);
const projectStats = await stat(projectDir);

if (!projectStats.isDirectory()) {
  console.error("The supplied project path is not a directory.");
  process.exit(1);
}

const manifestPath = path.join(projectDir, "Cargo.toml");

try {
  await access(manifestPath);
} catch {
  console.error("Cargo.toml was not found in the selected project directory.");
  process.exit(1);
}

const token = randomBytes(32).toString("hex");
let running = false;

function safeTokenEqual(received) {
  if (typeof received !== "string") return false;

  const expectedBuffer = Buffer.from(token);
  const receivedBuffer = Buffer.from(received);

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

function sendJson(response, status, data, origin) {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, OPTIONS",
    );
    response.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
  }

  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "no-store");
  response.writeHead(status);
  response.end(JSON.stringify(data));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 4096) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Invalid JSON request."));
      }
    });

    request.on("error", reject);
  });
}

function runCargo(command) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    let stdout = "";
    let stderr = "";
    let outputSize = 0;
    let timedOut = false;
    let outputLimited = false;

    const child = spawn("cargo", [command], {
      cwd: projectDir,
      shell: false,
      windowsHide: true,
      env: process.env,
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");

      setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
      }, 3000).unref();
    }, TIMEOUT_MS);

    function collect(target, chunk) {
      const value = chunk.toString();
      const remaining = MAX_OUTPUT - outputSize;

      if (remaining > 0) {
        const kept = value.slice(0, remaining);
        if (target === "stdout") stdout += kept;
        else stderr += kept;
        outputSize += Buffer.byteLength(kept);
      }

      if (Buffer.byteLength(value) > remaining && !outputLimited) {
        outputLimited = true;
        stderr += "\n[Output truncated at 1 MB.]";
      }
    }

    child.stdout.on("data", (chunk) => collect("stdout", chunk));
    child.stderr.on("data", (chunk) => collect("stderr", chunk));

    child.on("error", (error) => {
      clearTimeout(timeout);

      resolve({
        command: `cargo ${command}`,
        status: "FAIL",
        exitCode: null,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr: `${stderr}\n${error.message}`.trim(),
        timedOut: false,
        generatedAt: new Date().toISOString(),
      });
    });

    child.on("close", (exitCode) => {
      clearTimeout(timeout);

      resolve({
        command: `cargo ${command}`,
        status: exitCode === 0 && !timedOut ? "PASS" : "FAIL",
        exitCode,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr,
        timedOut,
        generatedAt: new Date().toISOString(),
      });
    });
  });
}

const server = http.createServer(async (request, response) => {
  const origin = request.headers.origin;
  const host = request.headers.host;

  if (host !== `${HOST}:${PORT}`) {
    return sendJson(response, 403, { error: "Invalid host." });
  }

  if (request.method === "OPTIONS") {
    if (!ALLOWED_ORIGINS.has(origin)) {
      return sendJson(response, 403, { error: "Origin not allowed." });
    }

    response.writeHead(204, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    });
    return response.end();
  }

  if (!ALLOWED_ORIGINS.has(origin)) {
    return sendJson(response, 403, { error: "Origin not allowed." });
  }

  if (request.method === "GET" && request.url === "/status") {
    return sendJson(
      response,
      200,
      {
        connected: true,
        project: path.basename(projectDir),
      },
      origin,
    );
  }

  if (request.method === "POST" && request.url === "/run") {
    const authorization = request.headers.authorization || "";
    const receivedToken = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!safeTokenEqual(receivedToken)) {
      return sendJson(response, 401, { error: "Invalid runner token." }, origin);
    }

    if (running) {
      return sendJson(
        response,
        409,
        { error: "A Cargo command is already running." },
        origin,
      );
    }

    let body;

    try {
      body = await readBody(request);
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, origin);
    }

    if (!["check", "test"].includes(body.command)) {
      return sendJson(
        response,
        400,
        { error: "Only cargo check and cargo test are supported." },
        origin,
      );
    }

    running = true;

    try {
      const result = await runCargo(body.command);
      return sendJson(response, 200, result, origin);
    } finally {
      running = false;
    }
  }

  return sendJson(response, 404, { error: "Endpoint not found." }, origin);
});

server.listen(PORT, HOST, () => {
  console.log("");
  console.log("Sails Developer Toolkit — Local Cargo Runner");
  console.log("---------------------------------------------");
  console.log(`Project: ${projectDir}`);
  console.log(`Address: http://${HOST}:${PORT}`);
  console.log("");
  console.log("YOUR RUNNER TOKEN (keep it private):");
  console.log(token);
  console.log("");
  console.log("Supported commands: cargo check, cargo test");
  console.log("Keep this Terminal window open while using the runner.");
  console.log("Press Ctrl+C to stop.");
  console.log("");
});
