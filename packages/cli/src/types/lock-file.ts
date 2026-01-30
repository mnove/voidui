/**
 * Lock file types for tracking installed component versions
 */

export interface ComponentLockEntry {
  /**
   * The installed version of the component (semver format)
   * @example "1.2.0"
   */
  installedVersion: string;

  /**
   * ISO 8601 timestamp of when the component was installed
   * @example "2025-01-20T10:30:00Z"
   */
  installedAt: string;

  /**
   * SHA-256 checksum of the installed component file
   * @example "sha256:abc123..."
   */
  checksum: string;

  /**
   * Optional custom registry URL if not using default
   * @example "https://custom-registry.dev/r"
   */
  registryUrl?: string;
}

export interface LockFile {
  /**
   * Optional JSON schema reference
   */
  $schema?: string;

  /**
   * Lock file format version
   * @example "1.0"
   */
  version: string;

  /**
   * Map of component names to their lock entries
   */
  components: Record<string, ComponentLockEntry>;
}
