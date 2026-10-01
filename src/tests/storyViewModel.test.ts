import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import { LocalStoryRepository } from '../repositories/storyRepository';
import { MemoryStorageService } from '../services/storageService';
import { StoryViewModel } from '../viewmodels/storyViewModel';

describe('story view model', () => {
  it('initializes, edits, persists, and restores the main flow', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    expect(viewModel.snapshot.status).toBe('ready');
    viewModel.addCharacter('阿洛', '修复师');
    viewModel.addScene('地下档案室', '他们找到被隐藏的航海日志。');
    const scene = viewModel.selectedScene;
    expect(scene?.title).toBe('地下档案室');
    viewModel.toggleCharacter(scene?.id ?? '', viewModel.snapshot.story?.characters[2]?.id ?? '');
    expect(viewModel.snapshot.stats.characters).toBe(3);

    const restored = new StoryViewModel(repository);
    restored.initialize();
    expect(restored.snapshot.story?.scenes.some((item) => item.title === '地下档案室')).toBe(true);
    expect(restored.snapshot.story?.characters.some((item) => item.name === '阿洛')).toBe(true);
  });

  it('shows recoverable validation feedback and resets corrupt storage', () => {
    const storage = new MemoryStorageService();
    storage.write('{broken');
    const viewModel = new StoryViewModel(new LocalStoryRepository(storage));
    viewModel.initialize();
    viewModel.addCharacter(' ', '');
    expect(viewModel.snapshot.notice).toContain('至少');
    viewModel.resetProject();
    expect(viewModel.snapshot.story?.id).toBe(createStarterStory().id);
  });

  it('keeps collapse state with the project and restores it on reopen', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    const firstSceneId = viewModel.snapshot.story?.scenes[0]?.id ?? '';
    viewModel.toggleSceneCollapse(firstSceneId);
    expect(viewModel.snapshot.story?.collapsedSceneIds).toEqual([firstSceneId]);
    expect(viewModel.snapshot.status).toBe('ready');

    const restored = new StoryViewModel(repository);
    restored.initialize();
    expect(restored.snapshot.story?.collapsedSceneIds).toEqual([firstSceneId]);
    restored.toggleSceneCollapse(firstSceneId);
    expect(restored.snapshot.story?.collapsedSceneIds).toEqual([]);
  });

  it('auto-expands collapsed scenes that match the search keyword', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new MemoryStorageService()));
    viewModel.initialize();
    const storm = viewModel.snapshot.story?.scenes.find((scene) => scene.title === '风暴前夜');
    viewModel.toggleSceneCollapse(storm?.id ?? '');
    expect(viewModel.snapshot.story?.collapsedSceneIds).toContain(storm?.id);

    viewModel.setSearch('罗盘');
    expect(viewModel.snapshot.story?.collapsedSceneIds).not.toContain(storm?.id);
    expect(viewModel.visibleScenes.map((scene) => scene.id)).toEqual([storm?.id]);

    viewModel.setSearch('');
    expect(viewModel.snapshot.story?.collapsedSceneIds).toEqual([]);
  });

  it('keeps the moved scene visible and preserves real order around collapsed scenes', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new MemoryStorageService()));
    viewModel.initialize();
    viewModel.addScene('灯塔停电', '整栋灯塔陷入黑暗。');
    const [first, second, third] = viewModel.snapshot.story?.scenes ?? [];
    viewModel.toggleSceneCollapse(second.id);
    viewModel.toggleSceneCollapse(third.id);

    viewModel.moveScene(first.id, 'down');
    const titles = viewModel.snapshot.story ? [...viewModel.snapshot.story.scenes].sort((a, b) => a.order - b.order).map((scene) => scene.title) : [];
    expect(titles).toEqual(['风暴前夜', '旧港口的来信', '灯塔停电']);
    expect(viewModel.snapshot.story?.collapsedSceneIds).toEqual([second.id, third.id]);

    viewModel.moveScene(third.id, 'up');
    expect(viewModel.snapshot.story?.collapsedSceneIds).toEqual([second.id]);
    const orders = viewModel.snapshot.story?.scenes.map((scene) => scene.order) ?? [];
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('does not let collapse affect stats, order, or clue resolution', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new MemoryStorageService()));
    viewModel.initialize();
    const before = viewModel.snapshot.stats;
    const story = viewModel.snapshot.story;
    viewModel.collapseOtherScenes(story?.selectedSceneId ?? '');
    expect(viewModel.snapshot.story?.collapsedSceneIds).toHaveLength((story?.scenes.length ?? 1) - 1);
    expect(viewModel.snapshot.stats).toEqual(before);
    expect(viewModel.visibleScenes).toHaveLength(story?.scenes.length ?? 0);
    expect(viewModel.timelineWarning).toBeNull();
    viewModel.expandAllScenes();
    expect(viewModel.snapshot.story?.collapsedSceneIds).toEqual([]);
  });
});
