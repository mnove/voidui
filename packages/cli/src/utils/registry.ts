/**
 * Registry API client for fetching component metadata
 */

import path from "path";
import { readFile } from "fs/promises";
import { fileExists } from "./file-operations.js";
import type { RegistryItem } from "../types/registry.js";

/**
 * Fetch component metadata from the registry
 * Includes retry logic for network failures
 *
 * @param componentName - Name of the component (e.g., "separator")
 * @param registryUrl - Base registry URL
 * @returns Registry item or null if not found
 */
export async function fetchRegistryItem(
  componentName: string,
  registryUrl: string,
): Promise<RegistryItem | null> {
  const url = `${registryUrl}/${componentName}.json`;

  try {
    const response = await fetchWithRetry(url, { maxRetries: 1 });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data as RegistryItem;
  } catch (error) {
    if (error instanceof Error && error.message.includes("fetch failed")) {
      throw new Error(
        `Failed to fetch registry data. Check your internet connection.\n   Tried: ${url}`,
      );
    }
    throw error;
  }
}

/**
 * Fetch specific version of a component from the registry
 * Note: This fetches from the versions endpoint in the registry
 *
 * @param componentName - Name of the component
 * @param version - Semantic version (e.g., "1.0.0")
 * @param registryUrl - Base registry URL
 * @returns Component source code or null if not found
 */
export async function fetchComponentVersion(
  componentName: string,
  version: string,
  registryUrl: string,
): Promise<string | null> {
  const item = await fetchRegistryItem(componentName, registryUrl);

  if (!item) {
    return null;
  }

  // If requesting current version, return from files
  if (item.meta?.versioning?.currentVersion === version) {
    return extractComponentCode(item);
  }

  // For historical versions, try localhost file system fallback for local development
  if (registryUrl.includes("localhost") || registryUrl.includes("127.0.0.1")) {
    const localVersion = await tryFetchLocalVersion(componentName, version);
    if (localVersion) {
      return localVersion;
    }
  }

  // For historical versions on production, we'd need to fetch from a versions endpoint
  // This requires registry infrastructure to serve historical versions
  return null;
}

/**
 * Try to fetch a historical version from local file system
 * Only used for local development testing
 *
 * @param componentName - Name of the component
 * @param version - Semantic version
 * @returns Component source code or null if not found
 */
async function tryFetchLocalVersion(
  componentName: string,
  version: string,
): Promise<string | null> {
  // Try common local paths for version files
  const possiblePaths = [
    // From www-docs directory
    path.join(
      process.cwd(),
      "registry",
      "components",
      "ui",
      `${componentName}.versions`,
      `${version}.tsx`,
    ),
    // From monorepo root
    path.join(
      process.cwd(),
      "apps",
      "www-docs",
      "registry",
      "components",
      "ui",
      `${componentName}.versions`,
      `${version}.tsx`,
    ),
  ];

  for (const versionPath of possiblePaths) {
    if (await fileExists(versionPath)) {
      try {
        const content = await readFile(versionPath, "utf-8");
        return content;
      } catch (error) {
        // Continue trying other paths
        continue;
      }
    }
  }

  return null;
}

/**
 * Extract component source code from a registry item
 * Finds the main component file (usually in components/ui/)
 *
 * @param registryItem - Registry item metadata
 * @returns Component source code
 */
export function extractComponentCode(registryItem: RegistryItem): string {
  // Find the main UI component file
  const mainFile = registryItem.files.find(
    (file) =>
      file.type === "registry:ui" || file.path.includes("/components/ui/"),
  );

  if (!mainFile) {
    // Fallback to first file if no UI file found
    return registryItem.files[0]?.content || "";
  }

  return mainFile.content;
}

/**
 * Fetch with retry logic
 *
 * @param url - URL to fetch
 * @param options - Fetch options with maxRetries
 * @returns Fetch response
 */
async function fetchWithRetry(
  url: string,
  options: { maxRetries?: number } = {},
): Promise<Response> {
  const maxRetries = options.maxRetries ?? 1;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "voidui-cli",
        },
      });
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on last attempt
      if (attempt < maxRetries) {
        // Wait 2 seconds before retry
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  throw lastError || new Error("Fetch failed");
}
