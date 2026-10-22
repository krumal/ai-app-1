import path from "node:path";
import { addProject, getProjectSummaries, loadConfig } from "../../server/config";
import { writeWorld, validateWorld, resolveWorldPath } from "./filesystem";
import { buildPreset, isPresetName, PRESET_NAMES, type PresetName } from "./presets";

type CliOptions = {
  clean: boolean;
  help: boolean;
  listPresets: boolean;
  name: string | null;
  preset: PresetName;
  register: boolean;
  seed: number;
};

const DEFAULT_SEED = 42;

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (options.listPresets) {
    console.log(PRESET_NAMES.join("\n"));
    return;
  }

  const name = options.name ?? `${options.preset}-${options.seed}`;
  const repoPath = resolveWorldPath(name);
  const world = buildPreset({
    preset: options.preset,
    name,
    repoPath,
    seed: options.seed,
  });

  await writeWorld(world, { clean: options.clean });
  const validation = await validateWorld(world);

  if (options.register) {
    await addProject({
      name: world.name,
      repoPath: world.repoPath,
      taskDirName: world.taskDirName,
      listOrder: world.listOrder,
    });
  }

  const config = await loadConfig();
  const summaries = await getProjectSummaries(config);
  const registered = summaries.some((project) => path.resolve(project.repoPath) === world.repoPath);

  console.log(JSON.stringify({
    name: world.name,
    preset: options.preset,
    seed: options.seed,
    repoPath: world.repoPath,
    taskRootPath: validation.taskRootPath,
    registered,
    lists: validation.lists,
    cards: validation.cards,
    directories: world.directories.length,
    files: world.files.length,
  }, null, 2));
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    clean: false,
    help: false,
    listPresets: false,
    name: null,
    preset: "rich",
    register: false,
    seed: DEFAULT_SEED,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;

    switch (arg) {
      case "--clean":
        options.clean = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--list-presets":
        options.listPresets = true;
        break;
      case "--name":
        options.name = requireValue(args, index, arg);
        index += 1;
        break;
      case "--preset": {
        const value = requireValue(args, index, arg);
        if (!isPresetName(value)) {
          throw new Error(`Unknown preset "${value}". Available presets: ${PRESET_NAMES.join(", ")}.`);
        }
        options.preset = value;
        index += 1;
        break;
      }
      case "--register":
        options.register = true;
        break;
      case "--seed": {
        const rawSeed = requireValue(args, index, arg);
        const seed = Number(rawSeed);
        if (!Number.isInteger(seed) || seed < 0) {
          throw new Error("--seed must be a non-negative integer.");
        }
        options.seed = seed;
        index += 1;
        break;
      }
      default:
        throw new Error(`Unknown argument "${arg}". Run with --help for usage.`);
    }
  }

  return options;
}

function requireValue(args: string[], index: number, flag: string) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function printHelp() {
  console.log(`Usage: bun run world:create -- [options]

Creates a local generated repository under .local/worlds/<name> with a .tasks folder.

Options:
  --preset <name>    Preset to generate: ${PRESET_NAMES.join(", ")}. Default: rich
  --name <name>      World directory and project name. Default: <preset>-<seed>
  --seed <number>    Deterministic generation seed. Default: ${DEFAULT_SEED}
  --clean            Delete the existing world before writing it
  --register         Add or select the generated world in ~/.config/localtasks/config.json
  --list-presets     Print available presets
  --help             Show this help
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`world:create failed: ${message}`);
  process.exit(1);
});
