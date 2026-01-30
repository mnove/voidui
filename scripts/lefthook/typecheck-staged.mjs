import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function getRepoRoot() {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  });
  if (result.status === 0) return result.stdout.trim();
  return process.cwd();
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function findOwningPackageJson({ repoRoot, filePath }) {
  let currentDir = path.dirname(filePath);
  const rootPackageJson = path.join(repoRoot, "package.json");

  while (true) {
    const candidate = path.join(currentDir, "package.json");
    if (fileExists(candidate)) {
      if (path.resolve(candidate) === path.resolve(rootPackageJson))
        return null;
      return candidate;
    }

    if (path.resolve(currentDir) === path.resolve(repoRoot)) return null;
    const parent = path.dirname(currentDir);
    if (parent === currentDir) return null;
    currentDir = parent;
  }
}

function readPackageJson(packageJsonPath) {
  const raw = fs.readFileSync(packageJsonPath, "utf8");
  return JSON.parse(raw);
}

function pickTypecheckScript(scripts) {
  if (!scripts) return null;
  const candidates = ["check", "type-check", "typecheck", "check-types"];
  for (const name of candidates) {
    if (typeof scripts[name] === "string") return name;
  }
  return null;
}

const repoRoot = getRepoRoot();
const stagedFiles = process.argv.slice(2);

if (stagedFiles.length === 0) process.exit(0);

const packageJsonCache = new Map();
const touchedPackages = new Map(); // packageName -> {packageJsonPath, script}

for (const file of stagedFiles) {
  const absPath = path.isAbsolute(file) ? file : path.join(repoRoot, file);
  if (!fileExists(absPath)) continue;

  const packageJsonPath = findOwningPackageJson({
    repoRoot,
    filePath: absPath,
  });
  if (!packageJsonPath) continue;

  let pkg = packageJsonCache.get(packageJsonPath);
  if (!pkg) {
    pkg = readPackageJson(packageJsonPath);
    packageJsonCache.set(packageJsonPath, pkg);
  }

  const packageName = pkg.name;
  if (!packageName) continue;

  if (!touchedPackages.has(packageName)) {
    const script = pickTypecheckScript(pkg.scripts);
    touchedPackages.set(packageName, { packageJsonPath, script });
  }
}

if (touchedPackages.size === 0) process.exit(0);

let finalStatus = 0;

for (const [packageName, info] of touchedPackages.entries()) {
  if (!info.script) continue;

  const result = spawnSync(
    "pnpm",
    ["--filter", packageName, "run", info.script],
    {
      stdio: "inherit",
    },
  );

  if (result.status !== 0) {
    finalStatus = result.status ?? 1;
    break;
  }
}

process.exit(finalStatus);
