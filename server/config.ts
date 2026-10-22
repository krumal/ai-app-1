import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { getTaskRootPath } from "./task-paths";
import type { AppConfig, ProjectConfig, ProjectSummary } from "../shared/types";

const DEFAULT_TASK_DIR_NAME = ".tasks";

function getConfigDir() {
  return path.join(process.env.HOME ?? homedir(), ".config", "localtasks");
}

function resolveConfigPath() {
  return path.join(getConfigDir(), "config.json");
}

function createDefaultConfig(): AppConfig {
  return {
    version: 1,
    activeProjectId: null,
    projects: [],
  };
}

async function ensureConfigDir() {
  await mkdir(getConfigDir(), { recursive: true });
}

async function fileExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function maybeBootstrapCurrentRepo(config: AppConfig) {
  const cwdTaskRoot = path.join(process.cwd(), DEFAULT_TASK_DIR_NAME);
  if (!(await fileExists(cwdTaskRoot))) {
    return config;
  }

  const repoPath = process.cwd();
  const projectId = toProjectId(path.basename(repoPath));
  const project: ProjectConfig = {
    id: projectId,
    name: path.basename(repoPath),
    repoPath,
    taskDirName: DEFAULT_TASK_DIR_NAME,
    listOrder: ["tasks"],
  };

  return {
    ...config,
    activeProjectId: project.id,
    projects: [project],
  };
}

export async function loadConfig(): Promise<AppConfig> {
  await ensureConfigDir();
  const configPath = resolveConfigPath();

  if (!(await fileExists(configPath))) {
    const seeded = await maybeBootstrapCurrentRepo(createDefaultConfig());
    await saveConfig(seeded);
    return seeded;
  }

  const raw = await readFile(configPath, "utf8");
  const parsed = JSON.parse(raw) as AppConfig;

  return {
    version: 1,
    activeProjectId: parsed.activeProjectId ?? null,
    projects: Array.isArray(parsed.projects)
      ? parsed.projects.map((project) => ({
          id: project.id,
          name: project.name,
          repoPath: path.resolve(project.repoPath),
          taskDirName: project.taskDirName || DEFAULT_TASK_DIR_NAME,
          listOrder: Array.isArray(project.listOrder) ? project.listOrder : ["tasks"],
        }))
      : [],
  };
}

export async function saveConfig(config: AppConfig) {
  await ensureConfigDir();
  await writeFile(resolveConfigPath(), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function getConfigPath() {
  return resolveConfigPath();
}

export async function getProjectSummaries(
  config: AppConfig,
): Promise<ProjectSummary[]> {
  return Promise.all(
    config.projects.map(async (project) => {
      const taskRootPath = getTaskRootPath(project);
      const exists = await fileExists(taskRootPath);

      return {
        ...project,
        taskRootPath,
        exists,
      };
    }),
  );
}

export async function addProject(input: {
  name: string;
  repoPath: string;
  taskDirName?: string;
  listOrder?: string[];
}) {
  const config = await loadConfig();
  const repoPath = path.resolve(input.repoPath.trim());
  getTaskRootPath({ repoPath, taskDirName: input.taskDirName || DEFAULT_TASK_DIR_NAME });
  const repoStat = await stat(repoPath);

  if (!repoStat.isDirectory()) {
    throw new Error("Project path must point to a directory.");
  }

  const existingProject = config.projects.find(
    (project) => path.resolve(project.repoPath) === repoPath,
  );

  if (existingProject) {
    const nextConfig: AppConfig = {
      ...config,
      activeProjectId: existingProject.id,
      projects: config.projects.map((project) =>
        project.id === existingProject.id
          ? {
              ...project,
              name: input.name.trim() || project.name,
              taskDirName: input.taskDirName || project.taskDirName,
              listOrder: input.listOrder?.length ? input.listOrder : project.listOrder,
            }
          : project,
      ),
    };

    await saveConfig(nextConfig);
    return nextConfig;
  }

  const baseId = toProjectId(input.name || path.basename(repoPath));
  let projectId = baseId;
  let suffix = 2;

  while (config.projects.some((project) => project.id === projectId)) {
    projectId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const project: ProjectConfig = {
    id: projectId,
    name: input.name.trim() || path.basename(repoPath),
    repoPath,
    taskDirName: input.taskDirName || DEFAULT_TASK_DIR_NAME,
    listOrder: input.listOrder?.length ? input.listOrder : ["tasks"],
  };

  const nextConfig: AppConfig = {
    ...config,
    activeProjectId: project.id,
    projects: [...config.projects, project],
  };

  await saveConfig(nextConfig);
  return nextConfig;
}

export async function pickProjectDirectory() {
  const picker = await getProjectDirectoryPicker();
  const child = Bun.spawn(picker.command, {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);

  const errorText = stderr.trim();
  if (exitCode !== 0) {
    if (picker.isCancel(exitCode, errorText)) {
      return null;
    }

    throw new Error(errorText || "Could not open the project directory picker.");
  }

  const pickedPath = stripTrailingPathSeparators(stdout.trim());
  return pickedPath || null;
}

type DirectoryPicker = {
  command: string[];
  isCancel(exitCode: number, stderr: string): boolean;
};

type CommandAvailability = (command: string) => boolean | Promise<boolean>;

async function getProjectDirectoryPicker(): Promise<DirectoryPicker> {
  return resolveProjectDirectoryPicker(process.platform, commandExists);
}

export async function resolveProjectDirectoryPicker(
  platform: NodeJS.Platform,
  commandAvailable: CommandAvailability,
): Promise<DirectoryPicker> {
  if (platform === "darwin") {
    return {
      command: [
        "osascript",
        "-e",
        'set pickedFolder to choose folder with prompt "Select a repository"',
        "-e",
        "POSIX path of pickedFolder",
      ],
      isCancel: (_exitCode, stderr) =>
        stderr.includes("User canceled") || stderr.includes("(-128)"),
    };
  }

  if (platform === "win32") {
    return {
      command: [
        "powershell.exe",
        "-NoProfile",
        "-STA",
        "-Command",
        [
          "Add-Type -AssemblyName System.Windows.Forms",
          "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
          '$dialog.Description = "Select a repository"',
          "$dialog.ShowNewFolderButton = $false",
          "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
          "  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
          "  Write-Output $dialog.SelectedPath",
          "}",
        ].join("\n"),
      ],
      isCancel: () => false,
    };
  }

  if (platform === "linux") {
    if (await commandAvailable("zenity")) {
      return {
        command: [
          "zenity",
          "--file-selection",
          "--directory",
          "--title=Select a repository",
        ],
        isCancel: (exitCode) => exitCode === 1,
      };
    }

    if (await commandAvailable("kdialog")) {
      return {
        command: [
          "kdialog",
          "--title",
          "Select a repository",
          "--getexistingdirectory",
          process.env.HOME ?? "/",
        ],
        isCancel: (exitCode) => exitCode === 1,
      };
    }

    if (await commandAvailable("yad")) {
      return {
        command: ["yad", "--file", "--directory", "--title=Select a repository"],
        isCancel: (exitCode) => exitCode === 1,
      };
    }

    throw new Error("Install zenity, kdialog, or yad to use the project directory picker on Linux.");
  }

  throw new Error(`Project directory picker is not supported on ${platform}.`);
}

async function commandExists(command: string) {
  const child = Bun.spawn(["sh", "-lc", `command -v ${command}`], {
    stdout: "ignore",
    stderr: "ignore",
  });

  return (await child.exited) === 0;
}

export function stripTrailingPathSeparators(value: string) {
  const root = path.parse(value).root;
  let end = value.length;

  while (end > root.length && /[/\\]/.test(value[end - 1])) {
    end -= 1;
  }

  return value.slice(0, end);
}

export async function setActiveProject(projectId: string) {
  const config = await loadConfig();

  if (!config.projects.some((project) => project.id === projectId)) {
    throw new Error(`Project "${projectId}" was not found.`);
  }

  const nextConfig: AppConfig = {
    ...config,
    activeProjectId: projectId,
  };

  await saveConfig(nextConfig);
  return nextConfig;
}

export async function deleteProject(projectId: string) {
  const config = await loadConfig();
  const remainingProjects = config.projects.filter((project) => project.id !== projectId);

  if (remainingProjects.length === config.projects.length) {
    throw new Error(`Project "${projectId}" was not found.`);
  }

  const nextConfig: AppConfig = {
    ...config,
    activeProjectId:
      config.activeProjectId === projectId
        ? remainingProjects[0]?.id ?? null
        : config.activeProjectId,
    projects: remainingProjects,
  };

  await saveConfig(nextConfig);
  return nextConfig;
}

export function toProjectId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}
