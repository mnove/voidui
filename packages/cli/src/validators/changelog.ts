import { z } from "zod";

export const changelogChangeSchema = z.object({
  type: z.enum([
    "added",
    "changed",
    "deprecated",
    "removed",
    "fixed",
    "security",
  ]),
  description: z.string().min(1, "Description cannot be empty"),
});

export const changelogEntrySchema = z.object({
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "Version must be in semver format (e.g., 1.0.0)"),
  date: z.string().datetime("Date must be in ISO 8601 format"),
  changes: z
    .array(changelogChangeSchema)
    .min(1, "At least one change is required"),
  breaking: z.boolean().optional(),
});

export const componentChangelogSchema = z.object({
  component: z.string().min(1, "Component name cannot be empty"),
  currentVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "Version must be in semver format (e.g., 1.0.0)"),
  entries: z
    .array(changelogEntrySchema)
    .min(1, "At least one changelog entry is required"),
});

export type { z } from "zod";
