#!/usr/bin/env node
import { Command } from "commander";
import { snapshotCommand } from "./commands/snapshot.js";
import { augmentCommand } from "./commands/augment.js";
import { diffCommand } from "./commands/diff.js";
import { addCommand } from "./commands/add.js";
import { updateCommand } from "./commands/update.js";

const program = new Command();

program
  .name("voidui")
  .description("CLI tools for voidui component versioning")
  .version("0.1.0");

program
  .command("snapshot")
  .description("Create a version snapshot of a component")
  .argument("<component>", "Component name (e.g., separator)")
  .argument("<version>", "Version number in semver format (e.g., 1.0.0)")
  .action(async (component: string, version: string) => {
    try {
      await snapshotCommand(component, version);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

program
  .command("augment")
  .description("Augment registry output with versioning metadata")
  .action(async () => {
    try {
      await augmentCommand();
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

program
  .command("diff")
  .description("Compare local components against registry versions")
  .argument("[component]", "Component name (e.g., separator)")
  .argument("[from-version]", "Source version (optional)")
  .argument("[to-version]", "Target version (optional)")
  .option("--code", "Show full code diff with syntax highlighting")
  .option("--registry <url>", "Registry URL", "https://voidui.dev/r")
  .action(async (component, fromVersion, toVersion, options) => {
    try {
      await diffCommand(component, fromVersion, toVersion, options);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

program
  .command("add")
  .description("Install a component with version tracking")
  .argument("[component]", "Component name (e.g., separator)")
  .option("--scan", "Add tracking to existing component without reinstalling")
  .option("--force", "Reinstall and update lock file")
  .option("--registry <url>", "Registry URL", "https://voidui.dev/r")
  .action(async (component, options) => {
    try {
      await addCommand(component, options);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

program
  .command("update")
  .description("Update a component to the latest version")
  .argument("[component]", "Component name (e.g., separator)")
  .option("--force", "Overwrite local changes")
  .option("--merge", "Automatically attempt 3-way merge")
  .option("--registry <url>", "Registry URL", "https://voidui.dev/r")
  .action(async (component, options) => {
    try {
      await updateCommand(component, options);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

program.parse();
