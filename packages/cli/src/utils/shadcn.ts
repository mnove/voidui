/**
 * shadcn CLI integration utilities
 * Handles executing shadcn CLI commands
 */

import { spawn } from "child_process";
import chalk from "chalk";

export interface ShadcnOptions {
  /**
   * Registry URL
   */
  registryUrl: string;

  /**
   * Whether to show command output
   * @default true
   */
  silent?: boolean;
}

/**
 * Execute shadcn add command to install a component
 *
 * @param componentName - Component to install
 * @param options - Execution options
 * @returns Promise that resolves when installation completes
 */
export async function execShadcnAdd(
  componentName: string,
  options: ShadcnOptions,
): Promise<void> {
  const { registryUrl, silent = false } = options;

  // Build the component URL
  const componentUrl = `${registryUrl}/${componentName}`;

  if (!silent) {
    console.log(chalk.blue(`\n📦 Installing ${componentName} via shadcn...\n`));
  }

  return new Promise((resolve, reject) => {
    // Spawn npx shadcn@latest add <component-url>
    const child = spawn(
      "npx",
      [
        "shadcn@latest",
        "add",
        componentUrl,
        "--yes", // Auto-confirm prompts
        "--overwrite", // Overwrite if exists (for --force mode)
      ],
      {
        stdio: silent ? "pipe" : "inherit", // Inherit to show output to user
        shell: true,
      },
    );

    child.on("error", (error) => {
      reject(
        new Error(
          `Failed to execute shadcn CLI: ${error.message}\nMake sure npx is available in your PATH.`,
        ),
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        if (!silent) {
          console.log(chalk.green(`\n✓ Component installed successfully\n`));
        }
        resolve();
      } else {
        reject(
          new Error(
            `shadcn CLI exited with code ${code}. Installation failed.`,
          ),
        );
      }
    });
  });
}

/**
 * Check if shadcn CLI is available
 *
 * @returns Promise that resolves to true if shadcn is available
 */
export async function isShadcnAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("npx", ["shadcn@latest", "--version"], {
      stdio: "pipe",
      shell: true,
    });

    child.on("error", () => {
      resolve(false);
    });

    child.on("close", (code) => {
      resolve(code === 0);
    });
  });
}
