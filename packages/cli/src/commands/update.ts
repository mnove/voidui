/**
 * Update command implementation
 * Updates components with smart merge support
 */

import path from "path";
import chalk from "chalk";
import prompts from "prompts";
import { readFile, writeFile } from "fs/promises";
import { locateComponent } from "../utils/component-locator.js";
import { computeChecksum, compareChecksums } from "../utils/checksum.js";
import {
  fetchRegistryItem,
  fetchComponentVersion,
  extractComponentCode,
} from "../utils/registry.js";
import {
  readLockFile,
  writeLockFile,
  updateComponentEntry,
  getComponentEntry,
} from "../utils/lock-file.js";
import { threeWayMerge, formatMergeMessage } from "../utils/merge.js";
import { formatDiff } from "../utils/diff-formatter.js";

interface UpdateCommandOptions {
  /**
   * Force overwrite (lose local changes)
   */
  force?: boolean;

  /**
   * Automatically attempt 3-way merge
   */
  merge?: boolean;

  /**
   * Registry URL
   */
  registry?: string;
}

const DEFAULT_REGISTRY_URL = "https://voidui.dev/r";

/**
 * Main update command handler
 * Updates a component to latest version with merge support
 *
 * @param component - Component name
 * @param options - Command options
 */
export async function updateCommand(
  component: string | undefined,
  options: UpdateCommandOptions,
): Promise<void> {
  const registryUrl = options.registry || DEFAULT_REGISTRY_URL;
  const cwd = process.cwd();

  // Validate component name
  if (!component) {
    console.error(chalk.red("❌ Component name is required"));
    console.error(chalk.gray("\nUsage:"));
    console.error(chalk.gray("  voidui update <component>"));
    console.error(chalk.gray("  voidui update <component> --force"));
    console.error(chalk.gray("  voidui update <component> --merge"));
    process.exit(1);
  }

  console.log(chalk.blue(`\n🔄 Updating ${component}...\n`));

  // 1. Read lock file
  const lockFile = await readLockFile(cwd);

  if (!lockFile) {
    console.error(chalk.red("❌ No lock file found"));
    console.error(chalk.gray("\n   Lock file will be created when you run:"));
    console.error(chalk.gray(`   voidui add ${component}`));
    process.exit(1);
  }

  const entry = getComponentEntry(lockFile, component);

  if (!entry) {
    console.error(
      chalk.red(`❌ Component "${component}" is not tracked in lock file`),
    );
    console.error(chalk.gray(`\n   Add tracking with:`));
    console.error(chalk.gray(`   voidui add ${component} --scan`));
    process.exit(1);
  }

  // 2. Fetch latest version from registry
  console.log(chalk.gray("Checking for updates..."));
  const registryItem = await fetchRegistryItem(component, registryUrl);

  if (!registryItem) {
    console.error(
      chalk.red(`❌ Component "${component}" not found in registry`),
    );
    console.error(chalk.gray(`   Registry: ${registryUrl}`));
    process.exit(1);
  }

  const versioning = registryItem.meta?.versioning;

  if (!versioning) {
    console.error(
      chalk.red(`❌ Component "${component}" does not have version tracking`),
    );
    process.exit(1);
  }

  const latestVersion = versioning.currentVersion;

  // 3. Locate component file
  const location = await locateComponent(component, cwd);

  if (!location.exists) {
    console.error(
      chalk.red(`❌ Component file not found at: ${location.path}`),
    );
    process.exit(1);
  }

  // 4. Check for local modifications (even if on latest version)
  const currentChecksum = await computeChecksum(location.path);
  const isModified = !compareChecksums(entry.checksum, currentChecksum);

  // Check if already on latest
  if (entry.installedVersion === latestVersion) {
    if (isModified) {
      console.log(
        chalk.green(`✓ Already on the latest version (${latestVersion})`),
      );
      console.log(chalk.yellow("\n⚠️  However, local modifications detected"));
      console.log(
        chalk.gray("\n  Your file has been modified since installation."),
      );
      console.log(chalk.gray("  To reset to the original version, run:"));
      console.log(chalk.gray(`  voidui add ${component} --force`));
    } else {
      console.log(
        chalk.green(`✓ Already on the latest version (${latestVersion})`),
      );
    }
    return;
  }

  console.log(
    chalk.gray(
      `  Current: ${entry.installedVersion} → Latest: ${latestVersion}`,
    ),
  );

  // Already have location, currentChecksum, isModified from above

  if (isModified) {
    console.log(chalk.yellow("\n⚠️  Local modifications detected"));
  }

  // 5. Determine update strategy
  let updateStrategy: "overwrite" | "merge" | "abort" = "overwrite";

  if (isModified && !options.force && !options.merge) {
    // Interactive prompt
    const response = await prompts({
      type: "select",
      name: "strategy",
      message: "How would you like to update?",
      choices: [
        {
          title: "Attempt 3-way merge (preserve your changes)",
          value: "merge",
        },
        {
          title: "Overwrite (lose your local changes)",
          value: "overwrite",
        },
        {
          title: "Show diff and abort",
          value: "diff",
        },
        {
          title: "Cancel",
          value: "abort",
        },
      ],
      initial: 0,
    });

    if (!response.strategy || response.strategy === "abort") {
      console.log(chalk.gray("\nUpdate cancelled"));
      return;
    }

    if (response.strategy === "diff") {
      // Show diff and exit
      const localContent = await readFile(location.path, "utf-8");
      const latestContent = extractComponentCode(registryItem);
      const diff = formatDiff(
        localContent,
        latestContent,
        `${component}@${entry.installedVersion}.tsx`,
        `${component}@${latestVersion}.tsx`,
      );
      console.log("\n" + diff);
      console.log(
        chalk.gray(
          `\nRun \`voidui update ${component} --merge\` to attempt merge`,
        ),
      );
      console.log(
        chalk.gray(`Run \`voidui update ${component} --force\` to overwrite`),
      );
      return;
    }

    updateStrategy = response.strategy;
  } else if (options.force) {
    updateStrategy = "overwrite";
  } else if (options.merge) {
    updateStrategy = "merge";
  }

  // 6. Perform update
  let newContent: string;
  let mergeSuccess = true;

  if (updateStrategy === "merge" && isModified) {
    // 3-way merge
    console.log(chalk.gray("\n  Performing 3-way merge..."));

    const baseContent = await fetchComponentVersion(
      component,
      entry.installedVersion,
      registryUrl,
    );
    const oursContent = await readFile(location.path, "utf-8");
    const theirsContent = extractComponentCode(registryItem);

    if (!baseContent) {
      console.error(
        chalk.yellow(
          `\n⚠️  Could not fetch base version (${entry.installedVersion})`,
        ),
      );
      console.error(
        chalk.gray("   Falling back to overwrite. Use --force to confirm."),
      );

      const confirmResponse = await prompts({
        type: "confirm",
        name: "overwrite",
        message: "Overwrite local file with latest version?",
        initial: false,
      });

      if (!confirmResponse.overwrite) {
        console.log(chalk.gray("\nUpdate cancelled"));
        return;
      }

      newContent = theirsContent;
    } else {
      const mergeResult = threeWayMerge(
        baseContent,
        oursContent,
        theirsContent,
        {
          ours: "your changes",
          theirs: `v${latestVersion}`,
        },
      );

      newContent = mergeResult.content;
      mergeSuccess = mergeResult.success;

      console.log(formatMergeMessage(mergeResult, location.path));
    }
  } else {
    // Simple overwrite
    newContent = extractComponentCode(registryItem);

    if (isModified) {
      console.log(
        chalk.yellow("\n⚠️  Overwriting local changes with latest version"),
      );
    }
  }

  // 7. Write updated content
  await writeFile(location.path, newContent, "utf-8");

  // 8. Update lock file
  const newChecksum = await computeChecksum(location.path);
  const updatedLockFile = updateComponentEntry(lockFile, component, {
    ...entry,
    installedVersion: latestVersion,
    installedAt: new Date().toISOString(),
    checksum: newChecksum,
  });

  await writeLockFile(cwd, updatedLockFile);

  // 9. Success message
  if (mergeSuccess) {
    console.log(
      chalk.green(
        `\n✓ Updated ${component} from ${entry.installedVersion} to ${latestVersion}`,
      ),
    );
    console.log(chalk.gray(`  Location: ${location.path}`));
  } else {
    console.log(
      chalk.yellow(
        `\n⚠️  Updated ${component} with conflicts. Please resolve manually.`,
      ),
    );
  }

  console.log("");
}
