/**
 * Zod validators for lock file structure
 */

import { z } from "zod";

/**
 * Validates a semver version string (e.g., "1.2.0")
 */
const semverSchema = z.string().regex(/^\d+\.\d+\.\d+$/, {
  message: "Version must be in semver format (e.g., 1.2.0)",
});

/**
 * Validates a SHA-256 checksum string
 */
const checksumSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/, {
  message: "Checksum must be in format: sha256:[64 hex chars]",
});

/**
 * Validates an ISO 8601 datetime string
 */
const isoDateSchema = z.string().datetime({
  message: "Date must be in ISO 8601 format",
});

/**
 * Schema for a single component lock entry
 */
export const componentLockEntrySchema = z.object({
  installedVersion: semverSchema,
  installedAt: isoDateSchema,
  checksum: checksumSchema,
  registryUrl: z.string().url().optional(),
});

/**
 * Schema for the complete lock file
 */
export const lockFileSchema = z.object({
  $schema: z.string().optional(),
  version: z.string(),
  components: z.record(z.string(), componentLockEntrySchema),
});

/**
 * Infer TypeScript types from schemas
 */
export type ComponentLockEntry = z.infer<typeof componentLockEntrySchema>;
export type LockFile = z.infer<typeof lockFileSchema>;
