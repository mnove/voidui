/**
 * 3-way merge utilities for component updates
 * Handles merging local changes with upstream updates
 */

import { diff3Merge } from "node-diff3";

export interface MergeResult {
  /**
   * Whether the merge was successful (no conflicts)
   */
  success: boolean;

  /**
   * Merged content (may contain conflict markers if !success)
   */
  content: string;

  /**
   * Number of conflicts found
   */
  conflictCount: number;
}

/**
 * Perform a 3-way merge of component files
 *
 * @param base - Original version (what was installed)
 * @param ours - Current local version (potentially modified)
 * @param theirs - New version from registry
 * @param labels - Optional labels for conflict markers
 * @returns Merge result
 */
export function threeWayMerge(
  base: string,
  ours: string,
  theirs: string,
  labels?: {
    ours?: string;
    theirs?: string;
  },
): MergeResult {
  // Split content into lines for diff3
  const baseLines = base.split("\n");
  const oursLines = ours.split("\n");
  const theirsLines = theirs.split("\n");

  // Perform 3-way merge
  const mergeResults = diff3Merge(oursLines, baseLines, theirsLines);

  let conflictCount = 0;
  const mergedLines: string[] = [];

  for (const result of mergeResults) {
    if (result.ok) {
      // No conflict, use the merged result
      mergedLines.push(...result.ok);
    } else if (result.conflict) {
      // Conflict detected
      conflictCount++;

      // Add conflict markers
      mergedLines.push(
        `<<<<<<< ${labels?.ours || "ours (your changes)"}`,
        ...result.conflict.a,
        "=======",
        ...result.conflict.b,
        `>>>>>>> ${labels?.theirs || "theirs (upstream)"}`,
      );
    }
  }

  return {
    success: conflictCount === 0,
    content: mergedLines.join("\n"),
    conflictCount,
  };
}

/**
 * Check if content contains merge conflict markers
 *
 * @param content - File content to check
 * @returns True if conflict markers are present
 */
export function hasConflictMarkers(content: string): boolean {
  return (
    content.includes("<<<<<<<") &&
    content.includes("=======") &&
    content.includes(">>>>>>>")
  );
}

/**
 * Count the number of conflict regions in content
 *
 * @param content - File content
 * @returns Number of conflict regions
 */
export function countConflicts(content: string): number {
  const matches = content.match(/<<<<<<</g);
  return matches ? matches.length : 0;
}

/**
 * Generate a user-friendly message for merge results
 *
 * @param result - Merge result
 * @param componentPath - Path to component file
 * @returns Formatted message
 */
export function formatMergeMessage(
  result: MergeResult,
  componentPath: string,
): string {
  if (result.success) {
    return `✓ Successfully merged your changes with the latest version`;
  }

  return `⚠️  Merge completed with ${result.conflictCount} conflict${result.conflictCount > 1 ? "s" : ""}

Conflict markers have been added to: ${componentPath}

To resolve:
1. Open the file and search for "<<<<<<<"
2. Edit each conflict region to keep the code you want
3. Remove the conflict markers (<<<<<<<, =======, >>>>>>>)
4. Save the file
5. Run: voidui add ${componentPath.split("/").pop()?.replace(".tsx", "")} --force`;
}
