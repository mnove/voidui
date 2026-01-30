/**
 * Lock file management utilities
 * Handles reading, writing, and updating voidui.lock.json
 */

import path from "path";
import { lockFileSchema } from "../validators/lock-file.js";
import type { LockFile, ComponentLockEntry } from "../types/lock-file.js";
import { fileExists, readJsonFile, writeJsonFile } from "./file-operations.js";

const LOCK_FILE_NAME = "voidui.lock.json";
const LOCK_FILE_VERSION = "1.0";

/**
 * Read existing lock file or return null if not found
 *
 * @param cwd - Current working directory
 * @returns Lock file or null
 */
export async function readLockFile(cwd: string): Promise<LockFile | null> {
  const lockFilePath = path.join(cwd, LOCK_FILE_NAME);

  if (!(await fileExists(lockFilePath))) {
    return null;
  }

  const rawLockFile = await readJsonFile<unknown>(lockFilePath);

  if (!rawLockFile) {
    return null;
  }

  try {
    const lockFile = lockFileSchema.parse(rawLockFile);
    return lockFile;
  } catch (error) {
    throw new Error(
      `Lock file is corrupted. Please delete ${LOCK_FILE_NAME} and re-install components.`,
    );
  }
}

/**
 * Read lock file or create a new empty one if it doesn't exist
 *
 * @param cwd - Current working directory
 * @returns Lock file
 */
export async function readOrCreateLockFile(cwd: string): Promise<LockFile> {
  const existing = await readLockFile(cwd);

  if (existing) {
    return existing;
  }

  // Create new lock file structure
  return {
    version: LOCK_FILE_VERSION,
    components: {},
  };
}

/**
 * Write lock file to disk
 *
 * @param cwd - Current working directory
 * @param lockFile - Lock file to write
 */
export async function writeLockFile(
  cwd: string,
  lockFile: LockFile,
): Promise<void> {
  const lockFilePath = path.join(cwd, LOCK_FILE_NAME);
  await writeJsonFile(lockFilePath, lockFile);
}

/**
 * Update a component entry in the lock file
 *
 * @param lockFile - Lock file to update
 * @param componentName - Component name
 * @param entry - Component entry data
 * @returns Updated lock file
 */
export function updateComponentEntry(
  lockFile: LockFile,
  componentName: string,
  entry: ComponentLockEntry,
): LockFile {
  return {
    ...lockFile,
    components: {
      ...lockFile.components,
      [componentName]: entry,
    },
  };
}

/**
 * Remove a component entry from the lock file
 *
 * @param lockFile - Lock file to update
 * @param componentName - Component name to remove
 * @returns Updated lock file
 */
export function removeComponentEntry(
  lockFile: LockFile,
  componentName: string,
): LockFile {
  const { [componentName]: _, ...remainingComponents } = lockFile.components;

  return {
    ...lockFile,
    components: remainingComponents,
  };
}

/**
 * Check if a component is tracked in the lock file
 *
 * @param lockFile - Lock file
 * @param componentName - Component name
 * @returns True if component is tracked
 */
export function isComponentTracked(
  lockFile: LockFile,
  componentName: string,
): boolean {
  return componentName in lockFile.components;
}

/**
 * Get component entry from lock file
 *
 * @param lockFile - Lock file
 * @param componentName - Component name
 * @returns Component entry or null
 */
export function getComponentEntry(
  lockFile: LockFile,
  componentName: string,
): ComponentLockEntry | null {
  return lockFile.components[componentName] || null;
}
