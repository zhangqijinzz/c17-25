import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import { getStats, orderedScenes } from '../models/storyRules';
import { LocalStoryRepository } from '../repositories/storyRepository';
import { LocalUiStateRepository } from '../repositories/uiStateRepository';
import { DOCUMENT_STORAGE_KEY, MemoryStorageService } from '../services/storageService';
import { StoryViewModel } from '../viewmodels/storyViewModel';

function createWorkbench(storage = new MemoryStorageService()) {
  const viewModel = new StoryViewModel(new LocalStoryRepository(storage), new LocalUiStateRepository(storage));
  return { storage, viewModel };
}

describe('story view model', () => {
  it('initializes, edits, persists, and restores the main flow', () => {
    const { storage, viewModel } = createWorkbench();
    viewModel.initialize();
    expect(viewModel.snapshot.status).toBe('ready');
    viewModel.addCharacter('阿洛', '修复师');
    viewModel.addScene('地下档案室', '他们找到被隐藏的航海日志。');
    const scene = viewModel.selectedScene;
    expect(scene?.title).toBe('地下档案室');
    viewModel.toggleCharacter(scene?.id ?? '', viewModel.snapshot.story?.characters[2]?.id ?? '');
    expect(viewModel.snapshot.stats.characters).toBe(3);

    const restored = createWorkbench(storage).viewModel;
    restored.initialize();
    expect(restored.snapshot.story?.scenes.some((item) => item.title === '地下档案室')).toBe(true);
    expect(restored.snapshot.story?.characters.some((item) => item.name === '阿洛')).toBe(true);
  });

  it('shows recoverable validation feedback and resets corrupt storage', () => {
    const storage = new MemoryStorageService();
    storage.write(DOCUMENT_STORAGE_KEY, '{broken');
    const { viewModel } = createWorkbench(storage);
    viewModel.initialize();
    viewModel.addCharacter(' ', '');
    expect(viewModel.snapshot.notice).toContain('至少');
    viewModel.resetProject();
    expect(viewModel.snapshot.story?.id).toBe(createStarterStory().id);
  });

  it('keeps collapse state per project and restores it on reopen', () => {
    const { storage, viewModel } = createWorkbench();
    viewModel.initialize();
    const story = viewModel.snapshot.story ?? createStarterStory();
    viewModel.toggleSceneCollapsed(story.scenes[0].id);
    expect(viewModel.isSceneCollapsed(story.scenes[0].id)).toBe(true);

    // 重新打开工作台：同一项目的收起状态与上次离开时一致
    const restored = createWorkbench(storage).viewModel;
    restored.initialize();
    expect(restored.isSceneCollapsed(story.scenes[0].id)).toBe(true);

    // 收起状态按项目 id 分开存放，其他项目留下的记录不会串进来
    storage.write('story-architect.collapsed.v1.another-project', JSON.stringify([story.scenes[1].id]));
    const reopened = createWorkbench(storage).viewModel;
    reopened.initialize();
    expect(reopened.isSceneCollapsed(story.scenes[1].id)).toBe(false);
  });

  it('force-expands collapsed scenes that match the search keyword', () => {
    const { viewModel } = createWorkbench();
    viewModel.initialize();
    const scene = (viewModel.snapshot.story ?? createStarterStory()).scenes[0];
    viewModel.toggleSceneCollapsed(scene.id);
    expect(viewModel.isSceneCollapsed(scene.id)).toBe(true);

    viewModel.setSearch('潮汐');
    expect(viewModel.isSceneCollapsed(scene.id)).toBe(false);
    expect(viewModel.visibleScenes.map((item) => item.id)).toContain(scene.id);

    // 清空搜索后恢复收起，保存下来的收起状态从未被搜索改写
    viewModel.setSearch('');
    expect(viewModel.isSceneCollapsed(scene.id)).toBe(true);
    expect(viewModel.snapshot.collapsedSceneIds).toContain(scene.id);
  });

  it('expands a collapsed scene after moving it so the landing spot stays visible', () => {
    const { viewModel } = createWorkbench();
    viewModel.initialize();
    const moving = orderedScenes(viewModel.snapshot.story ?? createStarterStory())[1];
    viewModel.toggleSceneCollapsed(moving.id);
    viewModel.moveScene(moving.id, 'up');

    expect(orderedScenes(viewModel.snapshot.story ?? createStarterStory())[0].id).toBe(moving.id);
    expect(viewModel.isSceneCollapsed(moving.id)).toBe(false);
    expect(viewModel.snapshot.collapsedSceneIds).not.toContain(moving.id);
  });

  it('never lets collapse state touch scene order, stats, or clue positions', () => {
    const { storage, viewModel } = createWorkbench();
    viewModel.initialize();
    const before = viewModel.snapshot.story ?? createStarterStory();
    viewModel.toggleSceneCollapsed(before.scenes[0].id);
    viewModel.collapseOtherScenes(before.scenes[1].id);

    const after = viewModel.snapshot.story ?? createStarterStory();
    expect(after.scenes.map((scene) => [scene.id, scene.order])).toEqual(before.scenes.map((scene) => [scene.id, scene.order]));
    expect(after.clues).toEqual(before.clues);
    expect(viewModel.snapshot.stats).toEqual(getStats(before));

    // 收起状态不进故事文档，持久化的文档里没有任何视图状态
    const persisted = JSON.parse(storage.read(DOCUMENT_STORAGE_KEY) ?? '{}') as Record<string, unknown>;
    expect('collapsedSceneIds' in persisted).toBe(false);
  });
});
