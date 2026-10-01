import { createStarterStory, type StoryDocument } from '../models/story';
import { sanitizeStory } from '../models/storyRules';
import { DOCUMENT_STORAGE_KEY, type StorageService } from '../services/storageService';

export interface StoryRepository {
  load(): StoryDocument;
  save(story: StoryDocument): void;
}

export class LocalStoryRepository implements StoryRepository {
  constructor(private readonly storage: StorageService) {}

  load(): StoryDocument {
    const raw = this.storage.read(DOCUMENT_STORAGE_KEY);
    if (!raw) return createStarterStory();
    try {
      return sanitizeStory(JSON.parse(raw)) ?? createStarterStory();
    } catch {
      return createStarterStory();
    }
  }

  save(story: StoryDocument): void {
    this.storage.write(DOCUMENT_STORAGE_KEY, JSON.stringify(story));
  }
}
