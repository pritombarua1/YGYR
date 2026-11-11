// Runs the whole event from this laptop:
//   1. builds the web app
//   2. starts the game server (Worker + Durable Object, locally)
//   3. serves the web app on port 4173
//   4. opens a free Cloudflare quick tunnel so phones can reach it from anywhere
//   5. runs a small updater on 127.0.0.1:8790 (the app's Update button: pull from GitHub, rebuild,
//      restart the game + web servers; the public link and the game itself are kept)
// Then opens the host screen in the browser. Ctrl+C (or closing the window) stops everything.

import { spawn, execSync, exec } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, writeFileSync } from "node:fs";
import readline from "node:readline";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB = 5180; // see vite.config.ts
const API = 8787;
const UPDATER = 8790; // see vite.config.ts (/updater is proxied here)
const isWin = process.platform === "win32";
const children = [];
let stopping = false;
const restarting = new Set(); // children stopped on purpose by the updater

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) {
    try {
      if (isWin) execSync(`taskkill /pid ${c.pid} /T /F`, { stdio: "ignore" });
      else c.kill();
    } catch {
      // already gone
    }
  }
  process.exit(code);
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

function run(name, command, { quiet = false, onText } = {}) {
  const child = spawn(command, { cwd: root, shell: true, stdio: ["ignore", "pipe", "pipe"] });
  children.push(child);
  const tail = []; // last lines of output, shown if it stops unexpectedly (quiet servers stay quiet otherwise)
  const onData = (buf) => {
    const text = buf.toString();
    onText?.(text);
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      tail.push(line.replace(/\x1b\[[0-9;]*m/g, ""));
      if (tail.length > 25) tail.shift();
      if (!quiet) console.log(`  [${name}] ${line}`);
    }
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
  child.on("exit", (code) => {
    if (stopping || restarting.has(child)) return;
    console.log(`\n  [${name}] stopped unexpectedly (code ${code}). Its last messages:`);
    for (const line of tail) console.log(`    ${line}`);
    console.log("\n  Shutting everything down.");
    stop(1);
  });
  return child;
}

/** Who is listening on a port (Windows): { pid, command } or null. */
function listener(port) {
  if (!isWin) return null;
  try {
    const out = execSync("netstat -ano -p tcp", { encoding: "utf8" });
    const line = out.split(/\r?\n/).find((l) => /LISTENING/.test(l) && new RegExp(`[:.]${port}\\s`).test(l));
    if (!line) return null;
    const pid = Number(line.trim().split(/\s+/).pop());
    if (!pid) return null;
    let command = "";
    try {
      command = execSync(`powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine"`, { encoding: "utf8" }).trim();
    } catch {
      // can't read it: treat as someone else's
    }
    return { pid, command };
  } catch {
    return null;
  }
}

/** Asks a yes/no question; Enter = yes. */
function askYes(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (a) => (rl.close(), resolve(!/^\s*n/i.test(a))));
  });
}

/**
 * The ports must be free before starting, or a new server quits while an old one answers in its
 * place. An older copy of this contest still running (another start.bat window, a crashed run) is
 * offered to be stopped; anything else using a port is named so it can be closed.
 */
async function freePorts() {
  const ports = [API, WEB, UPDATER];
  const busy = ports.map((port) => ({ port, who: listener(port) })).filter((b) => b.who);
  if (!busy.length) return;
  // ours = runs from this folder, or is this launcher (start.bat starts it as "node scripts\start.mjs")
  const ours = (cmd) => cmd.toLowerCase().includes(root.toLowerCase()) || /scripts[\\/]start\.mjs/i.test(cmd);
  const others = busy.filter((b) => !ours(b.who.command));
  if (others.length) {
    for (const b of others) console.log(`\n  Port ${b.port} is being used by another program (process ${b.who.pid}): ${b.who.command.slice(0, 120) || "unknown"}`);
    console.log("  Close that program (or restart the laptop) and run start.bat again.");
    stop(1);
  }
  banner([
    "ANOTHER COPY OF THE CONTEST IS ALREADY RUNNING",
    "",
    "(another start.bat window, or one that didn't close properly)",
    "Players and scores are kept either way: they're saved on this laptop.",
  ]);
  if (!(await askYes("  Stop it and start fresh here? [Y/n] "))) {
    console.log("  OK, leaving it running. Use the window that's already open.");
    stop(0);
  }
  for (const b of busy) {
    try {
      execSync(`taskkill /pid ${b.who.pid} /T /F`, { stdio: "ignore" });
    } catch {
      // already gone
    }
  }
  await new Promise((r) => setTimeout(r, 1500));
  const still = ports.filter((p) => listener(p));
  if (still.length) {
    console.log(`  Couldn't free port ${still.join(", ")}. Restart the laptop and run start.bat again.`);
    stop(1);
  }
  console.log("  Stopped the old copy.");
}

async function waitFor(url, seconds) {
  for (let i = 0; i < seconds * 2; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function findCloudflared() {
  try {
    execSync(isWin ? "where cloudflared" : "which cloudflared", { stdio: "ignore" });
    return "cloudflared";
  } catch {
    // winget installs here, but the PATH only refreshes in a new window
    const spots = ["C:\\Program Files (x86)\\cloudflared\\cloudflared.exe", "C:\\Program Files\\cloudflared\\cloudflared.exe"];
    const hit = spots.find((p) => existsSync(p));
    return hit ? `"${hit}"` : null;
  }
}

function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === "IPv4" && !a.internal)
    .map((a) => a.address);
}

function banner(lines) {
  const bar = "=".repeat(64);
  console.log(`\n  ${bar}`);
  for (const l of lines) console.log(`    ${l}`);
  console.log(`  ${bar}\n`);
}

const openBrowser = (url) => {
  if (!process.env.NO_OPEN) exec(isWin ? `start "" "${url}"` : `open "${url}"`);
};

/** Asks a question without echoing what's typed (the laptop may already be on the projector). */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.includes(question)) process.stdout.write(s);
      else if (s !== "\r\n" && s !== "\n") process.stdout.write("*");
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

// ---------------------------------------------------------------------------

// First make sure no older copy is still running, before anything is written (its password file included).
await freePorts();

// The host password protects creating/resuming a game and the control phone.
let password = "";
while (!password) {
  password = await askHidden("\n  Choose a host password for today (for the big screen and the control phone): ");
  if (!password) console.log("  It can't be empty.");
  else if (/["\\$`]/.test(password)) {
    console.log('  Please avoid " \\ $ and ` in the password (letters, numbers and - _ ! are fine).');
    password = "";
  }
}
// wrangler reads local secrets from worker/.dev.vars (git-ignored).
writeFileSync(path.join(root, "worker", ".dev.vars"), `HOST_PASSWORD=${JSON.stringify(password)}\n`);

console.log("\n  Building the web app...");
// Force same-origin API calls, even if web/.env.production points at a deployed Worker.
execSync("npm run build -w web", { cwd: root, stdio: "inherit", env: { ...process.env, VITE_API_URL: "" } });

console.log("\n  Starting the game server and web server...");
let servers = startServers();
if (!(await serversUp())) stop(1);
startUpdater();

function startServers() {
  return [run("game", `npm run dev -w worker`, { quiet: true }), run("web", `npx -w web vite preview --host --port ${WEB} --strictPort`, { quiet: true })];
}

async function serversUp() {
  if (!(await waitFor(`http://127.0.0.1:${API}/`, 60))) {
    console.log(`  The game server didn't start. Is something else using port ${API}?`);
    return false;
  }
  if (!(await waitFor(`http://127.0.0.1:${WEB}/`, 30))) {
    console.log(`  The web server didn't start. Is something else using port ${WEB}?`);
    return false;
  }
  return true;
}

// ---- Updater ---------------------------------------------------------------
// GET  /updater/status  -> what version this is and whether GitHub has a newer one
// POST /updater/update  -> { password } : pull, install, rebuild, restart the servers

const git = (args) => execSync(`git ${args}`, { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
const update = { state: "idle", message: "", needsRestart: false };

function versionInfo(fetchFirst) {
  try {
    git("rev-parse --is-inside-work-tree");
  } catch {
    return { git: false, reason: "This copy isn't linked to GitHub. Run start.bat again (it links it), or download it with git clone." };
  }
  let online = true;
  if (fetchFirst) {
    try {
      execSync("git fetch -q", { cwd: root, stdio: "ignore", timeout: 20000 });
    } catch {
      online = false;
    }
  }
  const current = git("rev-parse --short HEAD");
  const date = git("log -1 --format=%cd --date=short");
  let behind = 0;
  let changes = [];
  try {
    behind = Number(git("rev-list --count HEAD..@{u}")) || 0;
    if (behind) changes = git("log --format=%s HEAD..@{u}").split("\n").slice(0, 8);
  } catch {
    // no upstream yet
  }
  const dirty = git("status --porcelain --untracked-files=no") !== "";
  return { git: true, online, current, date, behind, changes, dirty };
}

async function runUpdate() {
  const before = git("rev-parse HEAD");
  update.state = "pulling";
  update.message = "Downloading the latest version...";
  console.log("\n  [update] " + update.message);
  try {
    execSync("git pull --ff-only", { cwd: root, stdio: "inherit", timeout: 120000 });
  } catch {
    update.state = "failed";
    update.message = "Couldn't pull from GitHub (offline, or files were changed on this laptop). Nothing was changed.";
    console.log("  [update] " + update.message);
    return;
  }
  const changed = git(`diff --name-only ${before} HEAD`).split("\n");
  update.needsRestart = changed.some((f) => f === "start.bat" || f.startsWith("scripts/"));

  // Stop the game + web servers (Windows can't replace files they have open); the tunnel stays up.
  update.state = "installing";
  update.message = "Installing and rebuilding...";
  console.log("  [update] " + update.message);
  for (const c of servers) {
    restarting.add(c);
    try {
      if (isWin) execSync(`taskkill /pid ${c.pid} /T /F`, { stdio: "ignore" });
      else c.kill();
    } catch {
      // already gone
    }
  }
  try {
    if (changed.some((f) => f.endsWith("package.json") || f === "package-lock.json")) execSync("npm install --no-fund --no-audit", { cwd: root, stdio: "inherit" });
    execSync("npm run build -w web", { cwd: root, stdio: "inherit", env: { ...process.env, VITE_API_URL: "" } });
  } catch {
    update.message = "The new version didn't build. Starting the servers again anyway; close this window and run start.bat if it misbehaves.";
    console.log("  [update] " + update.message);
  }
  update.state = "starting";
  servers = startServers();
  const ok = await serversUp();
  update.state = ok ? "done" : "failed";
  update.message = ok
    ? update.needsRestart
      ? "Updated. Part of the launcher changed too: next time, close the black window and run start.bat to use it."
      : "Updated and restarted."
    : "The servers didn't come back. Close the black window and run start.bat.";
  console.log("  [update] " + update.message);
}

function startUpdater() {
  const reply = (res, status, data) => {
    res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(data));
  };
  createServer((req, res) => {
    if (req.method === "GET" && req.url.startsWith("/updater/status")) {
      const busy = !["idle", "done", "failed"].includes(update.state);
      return reply(res, 200, { ...(busy ? {} : versionInfo(req.url.includes("fetch=1"))), update });
    }
    if (req.method === "POST" && req.url === "/updater/update") {
      let body = "";
      req.on("data", (d) => (body += d));
      req.on("end", () => {
        let given = "";
        try {
          given = JSON.parse(body).password;
        } catch {
          // bad body
        }
        if (given !== password) return reply(res, 401, { error: "Wrong host password." });
        if (!["idle", "done", "failed"].includes(update.state)) return reply(res, 409, { error: "Already updating." });
        reply(res, 202, { started: true });
        runUpdate();
      });
      return;
    }
    reply(res, 404, { error: "Not found" });
  })
    .on("error", () => console.log(`  (Updater off: port ${UPDATER} is busy. The app's Update button won't work this time.)`))
    .listen(UPDATER, "127.0.0.1");
}

const cloudflared = process.env.NO_TUNNEL ? null : findCloudflared(); // NO_TUNNEL=1: this Wi-Fi only (testing)
if (!cloudflared) {
  const lan = lanAddresses().map((ip) => `http://${ip}:${WEB}/host`);
  banner([
    "RUNNING ON THIS WI-FI ONLY (cloudflared not found, so no public link)",
    "",
    "Host screen - open one of these on this laptop:",
    ...lan.map((u) => `  ${u}`),
    "",
    "Phones must be on the same Wi-Fi. Run start.bat again to try",
    "installing cloudflared for a public link.",
    "Keep this window open. Closing it ends the game.",
  ]);
  openBrowser(lan[0] ?? `http://localhost:${WEB}/host`);
} else {
  console.log("  Opening a public link through Cloudflare (free quick tunnel)...");
  let found = false;
  run("tunnel", `${cloudflared} tunnel --no-autoupdate --url http://localhost:${WEB}`, {
    quiet: true,
    onText: async (text) => {
      const url = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
      if (!url || found) return;
      found = true;
      console.log(`  Got ${url} - waiting for it to come online...`);
      await waitFor(url, 60);
      banner([
        "PAPER PLANE CONTEST IS LIVE",
        "",
        "Host screen (opening in your browser now):",
        `  ${url}/host`,
        "Control phone (runs everything; big screen shows a QR):",
        `  ${url}/control`,
        "",
        "Players scan the QR code on the host screen.",
        "Works on any Wi-Fi or mobile data.",
        "",
        "Keep this window open and the laptop awake.",
        "If it closes, run start.bat again: the game is kept. Choose",
        '"Resume a game" on the big screen (PIN + password).',
      ]);
      openBrowser(`${url}/host`);
    },
  });
  setTimeout(() => {
    if (!found) console.log("  Still waiting for the tunnel... check the internet connection.");
  }, 30000);
}
