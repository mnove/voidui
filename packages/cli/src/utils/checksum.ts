/**
 * Utilities for computing and comparing SHA-256 checksums
 */

import { createHash } from "crypto";
import { readFile } from "fs/promises";

/**
 * Compute SHA-256 checksum of a file
 * Normalizes line endings (CRLF -> LF) for cross-platform consistency
 *
 * @param filePath - Absolute path to the file
 * @returns Checksum in format: "sha256:abc123..."
 */
export async function computeChecksum(filePath: string): Promise<string> {
  const content = await readFile(filePath, "utf-8");

  // Normalize line endings (CRLF -> LF) for cross-platform consistency
  const normalizedContent = content.replace(/\r\n/g, "\n");

  const hash = createHash("sha256");
  hash.update(normalizedContent, "utf-8");

  const digest = hash.digest("hex");
  return `sha256:${digest}`;
}

/**
 * Compare two checksums for equality
 *
 * @param expected - Expected checksum
 * @param actual - Actual checksum
 * @returns True if checksums match
 */
export function compareChecksums(expected: string, actual: string): boolean {
  return expected === actual;
}

/**
 * Format a checksum for display (truncated)
 *
 * @param checksum - Full checksum string
 * @returns Truncated checksum for display (e.g., "sha256:abc123...def789")
 */
export function formatChecksum(checksum: string): string {
  if (!checksum.startsWith("sha256:")) {
    return checksum;
  }

  const hash = checksum.substring(7); // Remove "sha256:" prefix
  if (hash.length <= 16) {
    return checksum;
  }

  // Show first 6 and last 6 characters
  const start = hash.substring(0, 6);
  const end = hash.substring(hash.length - 6);
  return `sha256:${start}...${end}`;
}
