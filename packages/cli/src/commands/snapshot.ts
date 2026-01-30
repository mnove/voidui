import path from "path";
import chalk from "chalk";
import type {
  ComponentChangelog,
  ChangelogEntry,
  ChangelogChange,
} from "../types/changelog.js";
import { componentChangelogSchema } from "../validators/changelog.js";
import {
  fileExists,
  readJsonFile,
  writeJsonFile,
  copyFile,
  ensureDir,
} from "../utils/file-operations.js";
import {
  promptForChange,
  promptForMore,
  promptForBreaking,
} from "../utils/prompts.js";

export async function snapshotCommand(
  component: string,
  version: string,
): Promise<void> {
  console.log(
    chalk.blue(`\n📸 Creating snapshot for ${component}@${version}\n`),
  );

  // 1. Validate paths
  const cwd = process.cwd();

  // Detect if running from monorepo root or www-docs
  let registryPath: string;
  if (await fileExists(path.join(cwd, "registry/components/ui"))) {
    // Running from www-docs
    registryPath = path.join(cwd, "registry/components/ui");
  } else {
    // Running from monorepo root
    registryPath = path.join(cwd, "apps/www-docs/registry/components/ui");
  }

  const componentFile = path.join(registryPath, `${component}.tsx`);
  const changelogFile = path.join(registryPath, `${component}.changelog.json`);
  const versionsDir = path.join(registryPath, `${component}.versions`);

  // 2. Check component exists
  if (!(await fileExists(componentFile))) {
    console.error(chalk.red(`❌ Component "${component}" not found`));
    console.error(chalk.gray(`   Expected: ${componentFile}`));
    process.exit(1);
  }

  // 3. Validate version format
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error(
      chalk.red("❌ Version must be in semver format (e.g., 1.0.0)"),
    );
    process.exit(1);
  }

  // 4. Create versions directory if needed
  await ensureDir(versionsDir);

  // 5. Check if version already exists
  const versionFile = path.join(versionsDir, `${version}.tsx`);
  if (await fileExists(versionFile)) {
    console.error(chalk.red(`❌ Version ${version} already exists`));
    console.error(chalk.gray(`   File: ${versionFile}`));
    process.exit(1);
  }

  // 6. Copy component file to versions folder
  await copyFile(componentFile, versionFile);
  console.log(chalk.green(`✓ Created snapshot: ${versionFile}`));

  // 7. Interactive changelog entry
  console.log(chalk.blue("\n📝 Creating changelog entry...\n"));

  const changeEntries: ChangelogChange[] = [];
  let addMore = true;

  while (addMore) {
    const change = await promptForChange();
    if (!change) {
      console.error(chalk.red("\n❌ Cancelled"));
      process.exit(1);
    }

    changeEntries.push(change);

    if (changeEntries.length > 0) {
      addMore = await promptForMore("Add another change?");
    }
  }

  const breaking = await promptForBreaking();

  // 8. Update or create changelog file
  let changelog: ComponentChangelog | null =
    await readJsonFile<ComponentChangelog>(changelogFile);

  if (!changelog) {
    // Create new changelog
    changelog = {
      component,
      currentVersion: version,
      entries: [],
    };
  }

  // 9. Add new entry to the beginning
  const newEntry: ChangelogEntry = {
    version,
    date: new Date().toISOString(),
    changes: changeEntries,
    ...(breaking && { breaking }),
  };

  changelog.entries.unshift(newEntry);
  changelog.currentVersion = version;

  // 10. Validate with Zod schema
  try {
    componentChangelogSchema.parse(changelog);
  } catch (error) {
    console.error(chalk.red("\n❌ Changelog validation failed:"));
    console.error(error);
    process.exit(1);
  }

  // 11. Write changelog
  await writeJsonFile(changelogFile, changelog);
  console.log(chalk.green(`\n✓ Updated changelog: ${changelogFile}`));

  // 12. Success message with next steps
  console.log(chalk.blue("\n✨ Snapshot created successfully!\n"));
  console.log(chalk.gray("Next steps:"));
  console.log(chalk.gray("  1. Review the changes"));
  console.log(chalk.gray("  2. Run: pnpm registry:build"));
  console.log(chalk.gray("  3. Commit the changes\n"));
}
