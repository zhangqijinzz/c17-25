import { useEffect, useState } from 'react';
import { LocalStoryRepository } from '../repositories/storyRepository';
import { LocalUiStateRepository } from '../repositories/uiStateRepository';
import { BrowserStorageService } from '../services/storageService';
import { StoryViewModel } from '../viewmodels/storyViewModel';

const storage = new BrowserStorageService();
const viewModel = new StoryViewModel(new LocalStoryRepository(storage), new LocalUiStateRepository(storage));

export function useStoryViewModel(): StoryViewModel {
  const [, refresh] = useState(0);
  useEffect(() => {
    const unsubscribe = viewModel.subscribe(() => refresh((value) => value + 1));
    viewModel.initialize();
    return unsubscribe;
  }, []);
  return viewModel;
}
