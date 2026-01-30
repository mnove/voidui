/**
 * Utilities for formatting diffs and changelogs for terminal output
 */

import { createPatch } from "diff";
import chalk from "chalk";
import type { ChangelogEntry } from "../types/changelog.js";

export interface DiffOptions {
  /**
   * Number of context lines to show around changes
   * @default 3
   */
  contextLines?: number;
}

/**
 * Generate and format a unified diff between two code strings
 *
 * @param oldContent - Original content
 * @param newContent - New content
 * @param oldLabel - Label for old version (e.g., "separator@1.0.0")
 * @param newLabel - Label for new version (e.g., "separator@1.1.0")
 * @param options - Diff options
 * @returns Formatted diff string with syntax highlighting
 */
export function formatDiff(
  oldContent: string,
  newContent: string,
  oldLabel: string,
  newLabel: string,
  options: DiffOptions = {},
): string {
  const contextLines = options.contextLines ?? 3;

  // Generate unified diff
  const patch = createPatch(
    oldLabel,
    oldContent,
    newContent,
    oldLabel,
    newLabel,
    { context: contextLines },
  );

  // Apply syntax highlighting
  return highlightDiff(patch);
}

/**
 * Apply syntax highlighting to a unified diff
 * Uses chalk for terminal colors
 *
 * @param diffString - Raw unified diff string
 * @returns Colored diff string
 */
export function highlightDiff(diffString: string): string {
  const lines = diffString.split("\n");
  const coloredLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("---") || line.startsWith("+++")) {
      // File headers
      coloredLines.push(chalk.bold(line));
    } else if (line.startsWith("@@")) {
      // Hunk headers (line numbers)
      coloredLines.push(chalk.cyan(line));
    } else if (line.startsWith("+")) {
      // Additions
      coloredLines.push(chalk.green(line));
    } else if (line.startsWith("-")) {
      // Deletions
      coloredLines.push(chalk.red(line));
    } else {
      // Context lines
      coloredLines.push(chalk.gray(line));
    }
  }

  return coloredLines.join("\n");
}

/**
 * Format changelog entries between two versions
 *
 * @param entries - All changelog entries
 * @param fromVersion - Starting version (older)
 * @param toVersion - Ending version (newer)
 * @returns Formatted changelog string
 */
export function formatChangelog(
  entries: ChangelogEntry[],
  fromVersion: string,
  toVersion: string,
): string {
  // Filter entries between versions
  const relevantEntries = filterEntriesBetweenVersions(
    entries,
    fromVersion,
    toVersion,
  );

  if (relevantEntries.length === 0) {
    return chalk.gray("No changes found between these versions.");
  }

  const output: string[] = [];

  for (const entry of relevantEntries) {
    // Version header
    const date = new Date(entry.date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    let versionLine =
      chalk.bold(`Version ${entry.version}`) + chalk.gray(` (${date})`);

    if (entry.breaking) {
      versionLine += " " + chalk.red.bold("BREAKING");
    }

    output.push(versionLine);

    // Changes
    for (const change of entry.changes) {
      const icon = getChangeIcon(change.type);
      const color = getChangeColor(change.type);
      output.push(`  ${icon} ${color(change.description)}`);
    }

    output.push(""); // Empty line between versions
  }

  return output.join("\n");
}

/**
 * Format a single changelog entry summary (for compact display)
 *
 * @param entry - Changelog entry
 * @returns Formatted summary string
 */
export function formatChangelogSummary(entry: ChangelogEntry): string {
  const lines: string[] = [];

  for (const change of entry.changes) {
    const icon = getChangeIcon(change.type);
    const label = getChangeLabel(change.type);
    const color = getChangeColor(change.type);
    lines.push(`  ${icon} ${color(`${label}: ${change.description}`)}`);
  }

  return lines.join("\n");
}

/**
 * Filter changelog entries between two versions
 */
function filterEntriesBetweenVersions(
  entries: ChangelogEntry[],
  fromVersion: string,
  toVersion: string,
): ChangelogEntry[] {
  const fromIndex = entries.findIndex((e) => e.version === fromVersion);
  const toIndex = entries.findIndex((e) => e.version === toVersion);

  if (fromIndex === -1 || toIndex === -1) {
    return [];
  }

  // Entries are typically sorted newest first, so we need the range between indices
  const start = Math.min(fromIndex, toIndex);
  const end = Math.max(fromIndex, toIndex);

  return entries.slice(start, end + 1).reverse(); // Reverse to show oldest first
}

/**
 * Get icon for change type
 */
function getChangeIcon(
  type: "added" | "changed" | "deprecated" | "removed" | "fixed" | "security",
): string {
  switch (type) {
    case "added":
      return "+";
    case "changed":
      return "~";
    case "deprecated":
      return "!";
    case "removed":
      return "-";
    case "fixed":
      return "*";
    case "security":
      return "!";
    default:
      return "•";
  }
}

/**
 * Get label for change type
 */
function getChangeLabel(
  type: "added" | "changed" | "deprecated" | "removed" | "fixed" | "security",
): string {
  switch (type) {
    case "added":
      return "Added";
    case "changed":
      return "Changed";
    case "deprecated":
      return "Deprecated";
    case "removed":
      return "Removed";
    case "fixed":
      return "Fixed";
    case "security":
      return "Security";
    default:
      return "Changed";
  }
}

/**
 * Get color function for change type
 */
function getChangeColor(
  type: "added" | "changed" | "deprecated" | "removed" | "fixed" | "security",
): (text: string) => string {
  switch (type) {
    case "added":
      return chalk.green;
    case "changed":
      return chalk.blue;
    case "deprecated":
      return chalk.yellow;
    case "removed":
      return chalk.red;
    case "fixed":
      return chalk.cyan;
    case "security":
      return chalk.magenta;
    default:
      return chalk.white;
  }
}
