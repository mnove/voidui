/**
 * Utilities for locating components in user projects
 */

import path from "path";
import { fileExists, readJsonFile } from "./file-operations.js";

export interface ComponentLocation {
  /**
   * Absolute path to the component file
   */
  path: string;

  /**
   * Whether the component file exists
   */
  exists: boolean;
}

interface ComponentsConfig {
  aliases?: {
    components?: string;
    ui?: string;
    utils?: string;
  };
}

/**
 * Locate a component file in the user's project
 * Tries common paths and reads components.json for path aliases
 *
 * @param componentName - Name of the component (e.g., "separator")
 * @param cwd - Current working directory
 * @returns Component location with path and existence flag
 */
export async function locateComponent(
  componentName: string,
  cwd: string,
): Promise<ComponentLocation> {
  const fileName = `${componentName}.tsx`;

  // Try to read components.json for aliases
  let componentAlias: string | undefined;
  const configPath = path.join(cwd, "components.json");

  if (await fileExists(configPath)) {
    const config = await readJsonFile<ComponentsConfig>(configPath);
    if (config?.aliases?.ui) {
      componentAlias = config.aliases.ui;
    } else if (config?.aliases?.components) {
      componentAlias = config.aliases.components;
    }
  }

  // Build list of paths to try
  const pathsToTry: string[] = [];

  // If we have an alias from config, try that first
  if (componentAlias) {
    // Handle path aliases like "@/components/ui"
    const cleanAlias = componentAlias.replace(/^@\//, "");
    pathsToTry.push(path.join(cwd, cleanAlias, fileName));

    // Also try with "src/" prefix if alias doesn't start with it
    if (!cleanAlias.startsWith("src/")) {
      pathsToTry.push(path.join(cwd, "src", cleanAlias, fileName));
    }
  }

  // Common fallback paths
  pathsToTry.push(
    path.join(cwd, "components", "ui", fileName),
    path.join(cwd, "src", "components", "ui", fileName),
    path.join(cwd, "app", "components", "ui", fileName),
    path.join(cwd, "lib", "components", "ui", fileName),
  );

  // Try each path in order
  for (const tryPath of pathsToTry) {
    if (await fileExists(tryPath)) {
      return {
        path: tryPath,
        exists: true,
      };
    }
  }

  // Component not found, return the most common default path
  const defaultPath = componentAlias
    ? path.join(cwd, componentAlias.replace(/^@\//, ""), fileName)
    : path.join(cwd, "components", "ui", fileName);

  return {
    path: defaultPath,
    exists: false,
  };
}
