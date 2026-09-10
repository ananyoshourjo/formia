const { spawn } = require("node:child_process");
const readline = require("node:readline");

const { isProcessRunning, terminateProcessTree, waitForProcessExit } = require("./process-utils.cjs");

class CodexAppServer {
  constructor({ cwd, version, onNotification, onOutput }) {
    this.cwd = cwd;
    this.version = version;
    this.onNotification = onNotification;
    this.onOutput = onOutput;
    this.process = null;
    this.pending = new Map();
    this.nextRequestId = 1;
    this.closedError = null;
    this.stoppingPromise = null;
  }

  start() {
    return new Promise((resolve, reject) => {
      const command = process.platform === "win32" ? "codex.cmd" : "codex";
      this.process = spawn(command, ["-c", "service_tier=fast", "app-server", "--listen", "stdio://"], {
        cwd: this.cwd,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        shell: process.platform === "win32",
      });

      const output = readline.createInterface({ input: this.process.stdout });
      output.on("line", (line) => this.handleLine(line));
      this.process.stderr.on("data", (chunk) => this.onOutput?.(String(chunk).trim()));
      this.process.once("error", (error) => {
        this.closedError = error;
        reject(error);
        this.rejectPending(error);
      });
      this.process.once("close", (code, signal) => {
        const error = new Error(`Codex App Server exited${code == null ? "" : ` with code ${code}`}${signal ? ` (${signal})` : ""}`);
        this.closedError = error;
        this.rejectPending(error);
      });

      this.initialize().then(resolve, reject);
    });
  }

  handleLine(line) {
    if (!line.trim()) return;

    let message;
    try {
      message = JSON.parse(line);
    } catch {
      this.onOutput?.(line);
      return;
    }

    if (message.id != null && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message || "Codex request failed"));
      else pending.resolve(message.result);
      return;
    }

    if (message.method) this.onNotification?.(message);
  }

  initialize() {
    return this.request("initialize", {
      clientInfo: {
        name: "formia",
        title: "Formia",
        version: this.version,
      },
    }).then(() => this.notify("initialized", {}));
  }

  request(method, params) {
    if (!this.process || this.process.exitCode != null) return Promise.reject(this.closedError || new Error("Codex App Server is not running"));

    const id = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.process.stdin.write(`${JSON.stringify({ method, id, params })}\n`);
    });
  }

  notify(method, params) {
    if (!this.process || this.process.exitCode != null) return;
    this.process.stdin.write(`${JSON.stringify({ method, params })}\n`);
  }

  rejectPending(error) {
    for (const { reject } of this.pending.values()) reject(error);
    this.pending.clear();
  }

  async stop() {
    if (this.stoppingPromise) return this.stoppingPromise;
    if (!this.process || this.process.killed) return;

    const processId = this.process.pid;
    this.process = null;
    this.stoppingPromise = (async () => {
      if (!processId || !isProcessRunning(processId)) return;
      if (process.platform === "win32") await terminateProcessTree(processId);
      else process.kill(processId);
      await waitForProcessExit(processId);
    })().catch((error) => {
      if (processId && isProcessRunning(processId)) throw error;
    }).finally(() => {
      this.stoppingPromise = null;
    });

    return this.stoppingPromise;
  }
}

module.exports = { CodexAppServer };
