/**
 * Add command implementation
 * Installs components with version tracking
 */

import chalk from "chalk";
import { locateComponent } from "../utils/component-locator.js";
import { computeChecksum } from "../utils/checksum.js";
import { fetchRegistryItem } from "../utils/registry.js";
import { execShadcnAdd } from "../utils/shadcn.js";
import {
  readOrCreateLockFile,
  writeLockFile,
  updateComponentEntry,
  isComponentTracked,
} from "../utils/lock-file.js";

interface AddCommandOptions {
  /**
   * Add tracking to existing component without reinstalling
   */
  scan?: boolean;

  /**
   * Force reinstall even if component exists
   */
  force?: boolean;

  /**
   * Registry URL
   */
  registry?: string;
}

const DEFAULT_REGISTRY_URL = "https://voidui.dev/r";

/**
 * Main add command handler
 * Installs a component and tracks it in voidui.lock.json
 *
 * @param component - Component name
 * @param options - Command options
 */
export async function addCommand(
  component: string | undefined,
  options: AddCommandOptions,
): Promise<void> {
  const registryUrl = options.registry || DEFAULT_REGISTRY_URL;
  const cwd = process.cwd();

  // Validate component name
  if (!component) {
    console.error(chalk.red("❌ Component name is required"));
    console.error(chalk.gray("\nUsage:"));
    console.error(chalk.gray("  voidui add <component>"));
    console.error(chalk.gray("  voidui add <component> --scan"));
    console.error(chalk.gray("  voidui add <component> --force"));
    process.exit(1);
  }

  console.log(chalk.blue(`\n📦 Adding ${component}...\n`));

  // 1. Check if component already exists locally
  const location = await locateComponent(component, cwd);

  if (location.exists && !options.scan && !options.force) {
    console.error(
      chalk.red(`❌ Component "${component}" already exists in your project`),
    );
    console.error(chalk.gray(`   Location: ${location.path}`));
    console.error(
      chalk.gray(
        "\n   Use --scan to add version tracking without reinstalling",
      ),
    );
    console.error(
      chalk.gray("   Use --force to reinstall and update tracking"),
    );
    process.exit(1);
  }

  // 2. Fetch registry metadata to get current version
  console.log(chalk.gray("Fetching registry metadata..."));
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

  const currentVersion = versioning.currentVersion;

  // 3. Install component via shadcn if needed
  if (!options.scan) {
    try {
      await execShadcnAdd(component, { registryUrl });
    } catch (error) {
      console.error(chalk.red("\n❌ Installation failed:"));
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  // 4. Locate the installed component
  const componentLocation = await locateComponent(component, cwd);

  if (!componentLocation.exists) {
    console.error(
      chalk.red(`❌ Component was not installed at expected location`),
    );
    console.error(chalk.gray(`   Expected: ${componentLocation.path}`));
    console.error(chalk.gray("\n   This might be a configuration issue."));
    console.error(
      chalk.gray("   Check your components.json or project structure."),
    );
    process.exit(1);
  }

  // 5. Compute checksum of installed file
  console.log(chalk.gray("Computing checksum..."));
  const checksum = await computeChecksum(componentLocation.path);

  // 6. Read or create lock file
  const lockFile = await readOrCreateLockFile(cwd);

  // Check if already tracked
  if (isComponentTracked(lockFile, component) && !options.force) {
    console.log(
      chalk.yellow(
        `⚠️  Component "${component}" is already tracked in lock file`,
      ),
    );
    console.log(
      chalk.gray("   Use --force to update the tracking information"),
    );
    return;
  }

  // 7. Update lock file
  const updatedLockFile = updateComponentEntry(lockFile, component, {
    installedVersion: currentVersion,
    installedAt: new Date().toISOString(),
    checksum: checksum,
    registryUrl: registryUrl,
  });

  await writeLockFile(cwd, updatedLockFile);

  // 8. Success message
  console.log(
    chalk.green(
      `\n✓ Added ${component}@${currentVersion} with version tracking`,
    ),
  );
  console.log(chalk.gray(`  Checksum: ${checksum.substring(0, 20)}...`));
  console.log(chalk.gray(`  Location: ${componentLocation.path}`));

  if (options.scan) {
    console.log(
      chalk.yellow(
        "\n  Note: Existing component was scanned. Checksum reflects current state.",
      ),
    );
  }

  console.log(
    chalk.gray(`\nRun \`voidui diff ${component}\` to check for updates`),
  );
  console.log("");
}
