/**
 * Registry API types for fetching component metadata
 */

import type { ComponentChangelog } from "./changelog.js";

export interface RegistryItemVersioning {
  /**
   * Current/latest version of the component
   * @example "1.2.0"
   */
  currentVersion: string;

  /**
   * Complete changelog with all version entries
   */
  changelog: ComponentChangelog;

  /**
   * List of all available versions (sorted descending)
   * @example ["1.2.0", "1.1.0", "1.0.0"]
   */
  availableVersions: string[];
}

export interface RegistryFile {
  /**
   * Relative path of the file in the component
   * @example "registry/components/ui/separator.tsx"
   */
  path: string;

  /**
   * File content (source code)
   */
  content: string;

  /**
   * File type
   * @example "registry:ui"
   */
  type: string;

  /**
   * Target path where the file should be copied
   * @example "components/ui/separator.tsx"
   */
  target?: string;
}

export interface RegistryItem {
  /**
   * Component name
   * @example "separator"
   */
  name: string;

  /**
   * Component type
   * @example "registry:ui"
   */
  type: string;

  /**
   * Display title
   * @example "Separator"
   */
  title?: string;

  /**
   * Component description
   */
  description?: string;

  /**
   * List of files included in this component
   */
  files: RegistryFile[];

  /**
   * Optional metadata including versioning info
   */
  meta?: {
    /**
     * Versioning metadata (voidui extension)
     */
    versioning?: RegistryItemVersioning;
  };

  /**
   * Dependencies required by this component
   */
  dependencies?: string[];

  /**
   * Dev dependencies
   */
  devDependencies?: string[];
}
