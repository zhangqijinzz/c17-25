import type { StorageService } from '../services/storageService';

const COLLAPSED_KEY_PREFIX = 'story-architect.collapsed.v1';

export interface UiStateRepository {
  loadCollapsedSceneIds(projectId: string): string[];
  saveCollapsedSceneIds(projectId: string, sceneIds: string[]): void;
}

export class LocalUiStateRepository implements UiStateRepository {
  constructor(private readonly storage: StorageService) {}

  loadCollapsedSceneIds(projectId: string): string[] {
    const raw = this.storage.read(this.key(projectId));
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  saveCollapsedSceneIds(projectId: string, sceneIds: string[]): void {
    this.storage.write(this.key(projectId), JSON.stringify(sceneIds));
  }

  private key(projectId: string): string {
    return `${COLLAPSED_KEY_PREFIX}.${projectId}`;
  }
}
