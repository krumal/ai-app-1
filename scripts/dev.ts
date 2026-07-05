const commands = [
  {
    label: "api",
    cmd: ["bun", "run", "dev:server"],
  },
  {
    label: "web",
    cmd: ["bun", "run", "dev:web"],
  },
];

export {};

const children = commands.map(({ cmd, label }) =>
  Bun.spawn(cmd, {
    cwd: process.cwd(),
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      LOCALTASKS_PROCESS_LABEL: label,
    },
  }),
);

let shuttingDown = false;

async function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    child.kill();
  }

  await Promise.allSettled(children.map((child) => child.exited));
  process.exit(exitCode);
}

for (const child of children) {
  child.exited.then((code) => {
    if (!shuttingDown && code !== 0) {
      shutdown(code);
    }
  });
}

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));

await Promise.all(children.map((child) => child.exited));
