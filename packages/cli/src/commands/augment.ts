import path from "path";
import chalk from "chalk";
import { glob } from "glob";
import type { ComponentChangelog } from "../types/changelog.js";
import {
  fileExists,
  readJsonFile,
  writeJsonFile,
  readDir,
} from "../utils/file-operations.js";

interface RegistryFile {
  path: string;
  content?: string;
  type: string;
  target?: string;
}

interface RegistryItem {
  name: string;
  type: string;
  title?: string;
  description?: string;
  dependencies?: string[];
  devDependencies?: string[];
  registryDependencies?: string[];
  files: RegistryFile[];
  meta?: {
    versioning?: {
      currentVersion: string;
      changelog: ComponentChangelog;
      availableVersions: string[];
    };
  };
}

interface Registry {
  $schema?: string;
  name?: string;
  homepage?: string;
  items?: RegistryItem[];
}

export async function augmentCommand(): Promise<void> {
  console.log(
    chalk.blue("\n🔧 Augmenting registry with versioning metadata...\n"),
  );

  const cwd = process.cwd();

  // Detect if running from monorepo root or www-docs
  let registryPath: string;
  let outputPath: string;

  if (await fileExists(path.join(cwd, "registry/components/ui"))) {
    // Running from www-docs
    registryPath = path.join(cwd, "registry/components/ui");
    outputPath = path.join(cwd, "public/r");
  } else {
    // Running from monorepo root
    registryPath = path.join(cwd, "apps/www-docs/registry/components/ui");
    outputPath = path.join(cwd, "apps/www-docs/public/r");
  }

  // Check if output directory exists
  if (!(await fileExists(outputPath))) {
    console.error(
      chalk.red(
        '❌ Registry output not found. Run "pnpm registry:build:raw" first.',
      ),
    );
    process.exit(1);
  }

  let augmentedCount = 0;

  // Find all changelog files
  const changelogPattern = path.join(registryPath, "*.changelog.json");
  const changelogFiles = await glob(changelogPattern.replace(/\\/g, "/"));

  for (const changelogFilePath of changelogFiles) {
    const componentName = path
      .basename(changelogFilePath)
      .replace(".changelog.json", "");

    // Read changelog
    const changelog = await readJsonFile<ComponentChangelog>(changelogFilePath);
    if (!changelog) {
      console.warn(
        chalk.yellow(`⚠️  Could not read changelog for ${componentName}`),
      );
      continue;
    }

    // Find available versions
    const versionsDir = path.join(registryPath, `${componentName}.versions`);
    let availableVersions: string[] = [];

    if (await fileExists(versionsDir)) {
      const files = await readDir(versionsDir);
      availableVersions = files
        .filter((f) => f.endsWith(".tsx"))
        .map((f) => f.replace(".tsx", ""))
        .sort((a, b) => {
          // Semantic version sort (descending)
          const aParts = a.split(".").map(Number);
          const bParts = b.split(".").map(Number);
          for (let i = 0; i < 3; i++) {
            const aVal = aParts[i] ?? 0;
            const bVal = bParts[i] ?? 0;
            if (bVal !== aVal) {
              return bVal - aVal;
            }
          }
          return 0;
        });
    }

    // Read generated registry item
    const registryItemPath = path.join(outputPath, `${componentName}.json`);
    const registryItem = await readJsonFile<RegistryItem>(registryItemPath);

    if (!registryItem) {
      console.warn(
        chalk.yellow(`⚠️  No registry output found for ${componentName}`),
      );
      continue;
    }

    // Augment with meta field
    registryItem.meta = {
      versioning: {
        currentVersion: changelog.currentVersion,
        changelog,
        availableVersions,
      },
    };

    // Write back
    await writeJsonFile(registryItemPath, registryItem);
    console.log(chalk.green(`✓ Augmented: ${componentName}.json`));
    augmentedCount++;
  }

  // Update main registry.json
  const mainRegistryPath = path.join(outputPath, "registry.json");
  const mainRegistry = await readJsonFile<Registry>(mainRegistryPath);

  if (mainRegistry && mainRegistry.items) {
    for (const item of mainRegistry.items) {
      const itemPath = path.join(outputPath, `${item.name}.json`);
      const itemData = await readJsonFile<RegistryItem>(itemPath);

      if (itemData?.meta) {
        item.meta = itemData.meta;
      }
    }

    await writeJsonFile(mainRegistryPath, mainRegistry);
    console.log(chalk.green("✓ Augmented: registry.json"));
  }

  console.log(
    chalk.blue(
      `\n✨ Augmentation complete! ${augmentedCount} component(s) updated.\n`,
    ),
  );
}
