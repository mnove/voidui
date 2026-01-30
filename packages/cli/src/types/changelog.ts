export type ChangeType =
  | "added"
  | "changed"
  | "deprecated"
  | "removed"
  | "fixed"
  | "security";

export interface ChangelogChange {
  type: ChangeType;
  description: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: ChangelogChange[];
  breaking?: boolean;
}

export interface ComponentChangelog {
  component: string;
  currentVersion: string;
  entries: ChangelogEntry[];
}
