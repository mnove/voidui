/**
 * Diff command implementation
 * Compares local components against registry versions
 */

import path from "path";
import chalk from "chalk";
import { readFile } from "fs/promises";
import { fileExists, readJsonFile } from "../utils/file-operations.js";
import { locateComponent } from "../utils/component-locator.js";
import { computeChecksum, compareChecksums } from "../utils/checksum.js";
import {
  fetchRegistryItem,
  extractComponentCode,
  fetchComponentVersion,
} from "../utils/registry.js";
import {
  formatDiff,
  formatChangelog,
  formatChangelogSummary,
} from "../utils/diff-formatter.js";
import { lockFileSchema } from "../validators/lock-file.js";
import type { LockFile } from "../types/lock-file.js";
import type { ChangelogEntry } from "../types/changelog.js";

interface DiffCommandOptions {
  code?: boolean;
  registry?: string;
}

const DEFAULT_REGISTRY_URL = "https://voidui.dev/r";

/**
 * Main diff command handler
 *
 * Supports three modes:
 * 1. `voidui diff separator` - Check local vs latest
 * 2. `voidui diff separator --code` - Show code diff
 * 3. `voidui diff separator 1.0.0 1.2.0` - Compare registry versions
 */
export async function diffCommand(
  component: string | undefined,
  fromVersion: string | undefined,
  toVersion: string | undefined,
  options: DiffCommandOptions,
): Promise<void> {
  const registryUrl = options.registry || DEFAULT_REGISTRY_URL;

  // Validate component name is provided
  if (!component) {
    console.error(chalk.red("❌ Component name is required"));
    console.error(chalk.gray("\nUsage:"));
    console.error(chalk.gray("  voidui diff <component>"));
    console.error(chalk.gray("  voidui diff <component> --code"));
    console.error(
      chalk.gray("  voidui diff <component> <from-version> <to-version>"),
    );
    process.exit(1);
  }

  // Determine which mode to run
  if (fromVersion && toVersion) {
    // Mode 3: Compare two registry versions
    await compareRegistryVersions(
      component,
      fromVersion,
      toVersion,
      registryUrl,
    );
  } else if (fromVersion && !toVersion) {
    // Invalid: only one version specified
    console.error(
      chalk.red("❌ Both from-version and to-version must be specified"),
    );
    console.error(chalk.gray("\nUsage:"));
    console.error(
      chalk.gray("  voidui diff <component> <from-version> <to-version>"),
    );
    process.exit(1);
  } else {
    // Mode 1 or 2: Check local vs registry
    await compareLocalVsRegistry(component, registryUrl, options);
  }
}

/**
 * Mode 1 & 2: Compare local component against registry
 */
async function compareLocalVsRegistry(
  component: string,
  registryUrl: string,
  options: DiffCommandOptions,
): Promise<void> {
  const cwd = process.cwd();

  console.log(chalk.blue(`\n📊 Checking ${component}...\n`));

  // 1. Locate component in user's project
  const location = await locateComponent(component, cwd);

  if (!location.exists) {
    console.error(
      chalk.red(`❌ Component "${component}" not found in your project`),
    );
    console.error(chalk.gray(`   Expected at: ${location.path}`));
    process.exit(1);
  }

  // 2. Read lock file if exists
  const lockFilePath = path.join(cwd, "voidui.lock.json");
  const lockFileExists = await fileExists(lockFilePath);
  let lockFile: LockFile | null = null;
  let installedVersion: string | null = null;
  let expectedChecksum: string | null = null;

  if (lockFileExists) {
    const rawLockFile = await readJsonFile<unknown>(lockFilePath);

    if (rawLockFile) {
      try {
        const parsedLockFile = lockFileSchema.parse(rawLockFile);
        lockFile = parsedLockFile;
        const entry = parsedLockFile.components[component];

        if (entry) {
          installedVersion = entry.installedVersion;
          expectedChecksum = entry.checksum;
        }
      } catch (error) {
        console.error(
          chalk.yellow(
            "⚠️  Lock file is corrupted. Continuing without version tracking.",
          ),
        );
      }
    }
  }

  // 3. Compute local file checksum
  const actualChecksum = await computeChecksum(location.path);
  const isModified =
    expectedChecksum && !compareChecksums(expectedChecksum, actualChecksum);

  // 4. Fetch registry metadata
  const registryItem = await fetchRegistryItem(component, registryUrl);

  if (!registryItem) {
    console.error(
      chalk.red(`❌ Component "${component}" not found in registry`),
    );
    console.error(chalk.gray(`   Registry: ${registryUrl}`));
    console.error(
      chalk.gray(
        `   Available at: ${registryUrl.replace("/r", "/components")}`,
      ),
    );
    process.exit(1);
  }

  const versioning = registryItem.meta?.versioning;

  if (!versioning) {
    console.error(
      chalk.red(
        `❌ Component "${component}" does not have version tracking enabled`,
      ),
    );
    process.exit(1);
  }

  const latestVersion = versioning.currentVersion;

  // 5. Display version information
  if (installedVersion) {
    const modifiedText = isModified ? chalk.yellow(" (modified ⚠️ )") : "";
    console.log(
      `Your version:  ${chalk.bold(installedVersion)}${modifiedText}`,
    );
  } else {
    if (!lockFileExists) {
      console.log(
        chalk.yellow(
          "⚠️  No lock file found. Lock file will be created when you run:",
        ),
      );
      console.log(chalk.gray(`   voidui add ${component}\n`));
    } else {
      console.log(
        chalk.yellow(
          `⚠️  Component "${component}" not found in lock file. Install with:`,
        ),
      );
      console.log(chalk.gray(`   voidui add ${component}\n`));
    }
  }

  console.log(`Latest:        ${chalk.bold(latestVersion)}`);

  // 6. Show code diff if requested
  if (options.code) {
    console.log(
      chalk.blue(
        `\n📝 Comparing ${installedVersion || "local"} → ${latestVersion}\n`,
      ),
    );

    // Read local file content
    const localContent = await readFile(location.path, "utf-8");

    // Get latest version content from registry
    const latestContent = extractComponentCode(registryItem);

    // Generate and display diff
    const diff = formatDiff(
      localContent,
      latestContent,
      `${component}@${installedVersion || "local"}.tsx`,
      `${component}@${latestVersion}.tsx`,
    );

    console.log(diff);
    console.log(""); // Empty line
    return;
  }

  // 7. Show changelog summary if versions differ
  if (installedVersion && installedVersion !== latestVersion) {
    console.log(
      chalk.blue(`\nChanges from ${installedVersion} to ${latestVersion}:\n`),
    );

    const relevantEntries = getEntriesBetweenVersions(
      versioning.changelog.entries,
      installedVersion,
      latestVersion,
    );

    if (relevantEntries.length > 0) {
      for (const entry of relevantEntries) {
        console.log(formatChangelogSummary(entry));
      }
    } else {
      console.log(chalk.gray("No changelog entries found."));
    }

    console.log(
      chalk.gray(
        `\nRun \`voidui diff ${component} --code\` to see code changes`,
      ),
    );
    console.log(
      chalk.gray(`Run \`voidui update ${component}\` to update to latest`),
    );
  } else if (!installedVersion) {
    // Show latest version info
    console.log(chalk.blue("\nLatest changes:\n"));

    const latestEntry = versioning.changelog.entries[0];
    if (latestEntry) {
      console.log(formatChangelogSummary(latestEntry));
    }

    console.log(
      chalk.gray(`\nRun \`voidui diff ${component} --code\` to see code`),
    );
  } else {
    // Versions are the same
    console.log(chalk.green("\n✓ You're on the latest version!"));

    if (isModified) {
      console.log(
        chalk.yellow(
          "\nNote: Your local file has been modified from the installed version.",
        ),
      );
    }
  }

  console.log(""); // Empty line
}

/**
 * Mode 3: Compare two registry versions
 */
async function compareRegistryVersions(
  component: string,
  fromVersion: string,
  toVersion: string,
  registryUrl: string,
): Promise<void> {
  console.log(
    chalk.blue(`\n📊 Comparing ${component} ${fromVersion} → ${toVersion}\n`),
  );

  // Fetch registry metadata
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
      chalk.red(
        `❌ Component "${component}" does not have version tracking enabled`,
      ),
    );
    process.exit(1);
  }

  // Validate versions exist
  const availableVersions = versioning.availableVersions;

  if (!availableVersions.includes(fromVersion)) {
    console.error(
      chalk.red(`❌ Version "${fromVersion}" not found for ${component}`),
    );
    console.error(chalk.gray(`   Available: ${availableVersions.join(", ")}`));
    process.exit(1);
  }

  if (!availableVersions.includes(toVersion)) {
    console.error(
      chalk.red(`❌ Version "${toVersion}" not found for ${component}`),
    );
    console.error(chalk.gray(`   Available: ${availableVersions.join(", ")}`));
    process.exit(1);
  }

  // Show changelog between versions
  console.log(chalk.blue(`Changes from ${fromVersion} to ${toVersion}:\n`));

  const changelog = formatChangelog(
    versioning.changelog.entries,
    fromVersion,
    toVersion,
  );
  console.log(changelog);

  // Try to fetch code for both versions and show diff
  const fromContent = await fetchComponentVersion(
    component,
    fromVersion,
    registryUrl,
  );
  const toContent = await fetchComponentVersion(
    component,
    toVersion,
    registryUrl,
  );

  if (fromContent && toContent) {
    console.log(chalk.blue("\n📝 Code changes:\n"));
    const diff = formatDiff(
      fromContent,
      toContent,
      `${component}@${fromVersion}.tsx`,
      `${component}@${toVersion}.tsx`,
    );
    console.log(diff);
  } else {
    // Show note about why we can't show code diff
    console.log(
      chalk.gray(
        "\nNote: Code diff for historical versions is not yet supported in production.",
      ),
    );
    console.log(
      chalk.gray(
        "      This feature requires registry infrastructure for version endpoints.",
      ),
    );
    if (registryUrl.includes("localhost")) {
      console.log(
        chalk.yellow(
          "\n      For local testing, make sure version files exist at:",
        ),
      );
      console.log(
        chalk.gray(
          `      registry/components/ui/${component}.versions/${fromVersion}.tsx`,
        ),
      );
      console.log(
        chalk.gray(
          `      registry/components/ui/${component}.versions/${toVersion}.tsx`,
        ),
      );
    }
  }

  console.log(""); // Empty line
}

/**
 * Get changelog entries between two versions
 */
function getEntriesBetweenVersions(
  entries: ChangelogEntry[],
  fromVersion: string,
  toVersion: string,
): ChangelogEntry[] {
  const fromIndex = entries.findIndex((e) => e.version === fromVersion);
  const toIndex = entries.findIndex((e) => e.version === toVersion);

  if (fromIndex === -1 || toIndex === -1) {
    return [];
  }

  // Entries are sorted newest first, extract range between versions
  const start = Math.min(fromIndex, toIndex);
  const end = Math.max(fromIndex, toIndex);

  // Return entries in chronological order (oldest first)
  return entries.slice(start, end + 1).reverse();
}
