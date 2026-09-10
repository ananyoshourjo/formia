const { spawn } = require("node:child_process");

function stripAnsi(value) {
  return String(value).replace(/[\u001B\u009B][[\]()#;?]*(?:(?:(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d\/#&.:=?%@~_]*)*)?\u0007|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g, "");
}

function isProcessRunning(processId) {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function terminateProcessTree(processId) {
  return new Promise((resolve, reject) => {
    if (!isProcessRunning(processId)) {
      resolve();
      return;
    }

    const killer = spawn("taskkill.exe", ["/PID", String(processId), "/T", "/F"], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    killer.stdout.on("data", (chunk) => { output += String(chunk); });
    killer.stderr.on("data", (chunk) => { output += String(chunk); });
    killer.once("error", reject);
    killer.once("close", (code) => {
      if (code === 0 || !isProcessRunning(processId)) resolve();
      else reject(new Error(stripAnsi(output).trim() || `Could not stop process ${processId}.`));
    });
  });
}

async function waitForProcessExit(processId, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (isProcessRunning(processId)) {
    if (Date.now() >= deadline) throw new Error(`Process ${processId} did not stop.`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

module.exports = {
  isProcessRunning,
  stripAnsi,
  terminateProcessTree,
  waitForProcessExit,
};
