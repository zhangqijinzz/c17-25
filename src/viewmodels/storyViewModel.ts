import {
  characterColors,
  createId,
  createStarterStory,
  type StoryCharacter,
  type StoryClue,
  type StoryDocument,
  type StoryScene,
} from '../models/story';
import { getStats, getTimelineWarning, orderedScenes, validateName } from '../models/storyRules';
import type { StoryRepository } from '../repositories/storyRepository';
import type { UiStateRepository } from '../repositories/uiStateRepository';

export type ViewModelStatus = 'loading' | 'ready' | 'editing' | 'error' | 'completed';

export interface StoryViewState {
  status: ViewModelStatus;
  story: StoryDocument | null;
  stats: ReturnType<typeof getStats>;
  notice: string;
  error: string;
  search: string;
  activeSection: 'overview' | 'characters' | 'clues';
  collapsedSceneIds: string[];
}

type Listener = () => void;

export class StoryViewModel {
  private state: StoryViewState = {
    status: 'loading',
    story: null,
    stats: { characters: 0, scenes: 0, clues: 0, unresolvedClues: 0, completion: 0 },
    notice: '',
    error: '',
    search: '',
    activeSection: 'overview',
    collapsedSceneIds: [],
  };
  private readonly listeners = new Set<Listener>();

  constructor(
    private readonly repository: StoryRepository,
    private readonly uiState: UiStateRepository,
  ) {}

  get snapshot(): StoryViewState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  initialize(): void {
    try {
      const story = this.repository.load();
      this.setState({
        status: story.status === 'complete' ? 'completed' : 'ready',
        story,
        stats: getStats(story),
        error: '',
        collapsedSceneIds: this.loadCollapsed(story),
      });
    } catch {
      this.setState({ status: 'error', error: '故事读取失败，请重置为示例项目。' });
    }
  }

  setSearch(search: string): void {
    this.setState({ search });
  }

  setSection(activeSection: StoryViewState['activeSection']): void {
    this.setState({ activeSection });
  }

  selectScene(sceneId: string): void {
    this.updateStory((story) => ({ ...story, selectedSceneId: sceneId }));
  }

  toggleSceneCollapsed(sceneId: string): void {
    const collapsed = this.state.collapsedSceneIds;
    this.setCollapsed(collapsed.includes(sceneId) ? collapsed.filter((id) => id !== sceneId) : [...collapsed, sceneId]);
  }

  collapseOtherScenes(sceneId: string): void {
    const story = this.requireStory();
    this.setCollapsed(story.scenes.map((scene) => scene.id).filter((id) => id !== sceneId));
    this.setState({ notice: '已收起其他场景，专注当前这一幕' });
  }

  expandAllScenes(): void {
    this.setCollapsed([]);
    this.setState({ notice: '已展开全部场景' });
  }

  isSceneCollapsed(sceneId: string): boolean {
    if (!this.state.collapsedSceneIds.includes(sceneId)) return false;
    const keyword = this.state.search.trim().toLowerCase();
    if (!keyword) return true;
    // 搜索命中的收起场景强制展开，保证结果一定看得见；已保存的收起状态不被改写
    const scene = this.state.story?.scenes.find((item) => item.id === sceneId);
    return !scene || !this.sceneMatches(scene, keyword);
  }

  addCharacter(name: string, role: string): void {
    const cleanName = validateName(name);
    if (cleanName === '至少输入 2 个字') {
      this.setState({ notice: cleanName });
      return;
    }
    const story = this.requireStory();
    const character: StoryCharacter = {
      id: createId('character'),
      name: cleanName,
      role: role.trim() || '待定义角色',
      color: characterColors[story.characters.length % characterColors.length],
    };
    this.updateStory((current) => ({ ...current, characters: [...current.characters, character] }));
    this.setState({ notice: `已加入人物「${character.name}」` });
  }

  addScene(title: string, summary: string): void {
    const cleanTitle = validateName(title);
    if (cleanTitle === '至少输入 2 个字') {
      this.setState({ notice: cleanTitle });
      return;
    }
    const story = this.requireStory();
    const scene: StoryScene = {
      id: createId('scene'),
      title: cleanTitle,
      order: story.scenes.length + 1,
      summary: summary.trim() || '还没有写下这一幕发生了什么。',
      conflict: '',
      characterIds: [],
      clueIds: [],
    };
    this.updateStory((current) => ({ ...current, scenes: [...current.scenes, scene], selectedSceneId: scene.id }));
    this.setState({ notice: `已创建场景「${scene.title}」` });
  }

  updateScene(sceneId: string, patch: Partial<Pick<StoryScene, 'title' | 'summary' | 'conflict'>>): void {
    this.updateStory((story) => ({
      ...story,
      scenes: story.scenes.map((scene) => (scene.id === sceneId ? { ...scene, ...patch } : scene)),
    }), false);
  }

  toggleCharacter(sceneId: string, characterId: string): void {
    this.updateStory((story) => ({
      ...story,
      scenes: story.scenes.map((scene) => {
        if (scene.id !== sceneId) return scene;
        const hasCharacter = scene.characterIds.includes(characterId);
        return { ...scene, characterIds: hasCharacter ? scene.characterIds.filter((id) => id !== characterId) : [...scene.characterIds, characterId] };
      }),
    }));
  }

  moveScene(sceneId: string, direction: 'up' | 'down'): void {
    const scenes = orderedScenes(this.requireStory());
    const index = scenes.findIndex((scene) => scene.id === sceneId);
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= scenes.length) return;
    [scenes[index], scenes[nextIndex]] = [scenes[nextIndex], scenes[index]];
    this.updateStory((story) => ({ ...story, scenes: scenes.map((scene, sceneIndex) => ({ ...scene, order: sceneIndex + 1 })) }));
    // 落点必须可见：被移动的场景若处于收起状态，移动后自动展开
    const wasCollapsed = this.state.collapsedSceneIds.includes(sceneId);
    if (wasCollapsed) {
      this.setCollapsed(this.state.collapsedSceneIds.filter((id) => id !== sceneId));
    }
    this.setState({ notice: wasCollapsed ? '时间线顺序已更新，落点场景已自动展开' : '时间线顺序已更新' });
  }

  addClue(title: string, setupSceneId: string, payoffSceneId: string): void {
    const cleanTitle = validateName(title);
    if (cleanTitle === '至少输入 2 个字') {
      this.setState({ notice: cleanTitle });
      return;
    }
    if (!setupSceneId) {
      this.setState({ notice: '请先选择伏笔埋下的场景' });
      return;
    }
    const clue: StoryClue = { id: createId('clue'), title: cleanTitle, setupSceneId, payoffSceneId };
    this.updateStory((story) => ({
      ...story,
      clues: [...story.clues, clue],
      scenes: story.scenes.map((scene) => scene.id === setupSceneId ? { ...scene, clueIds: [...scene.clueIds, clue.id] } : scene),
    }));
    this.setState({ notice: payoffSceneId ? '伏笔关系已建立' : '伏笔已记录，等待回收' });
  }

  completeProject(): void {
    this.updateStory((story) => ({ ...story, status: 'complete' }));
    this.setState({ status: 'completed', notice: '项目已标记为完成，仍可继续编辑' });
  }

  resetProject(): void {
    const story = createStarterStory();
    this.persist(story);
    this.setState({ status: 'ready', story, stats: getStats(story), notice: '已恢复示例项目', error: '', collapsedSceneIds: this.loadCollapsed(story) });
  }

  get visibleCharacters(): StoryCharacter[] {
    const story = this.requireStory();
    const keyword = this.state.search.trim().toLowerCase();
    return story.characters.filter((character) => `${character.name}${character.role}`.toLowerCase().includes(keyword));
  }

  get visibleScenes(): StoryScene[] {
    const story = this.requireStory();
    const keyword = this.state.search.trim().toLowerCase();
    return orderedScenes(story).filter((scene) => this.sceneMatches(scene, keyword));
  }

  get scenePositions(): Map<string, number> {
    const positions = new Map<string, number>();
    const story = this.state.story;
    if (story) {
      orderedScenes(story).forEach((scene, index) => positions.set(scene.id, index));
    }
    return positions;
  }

  get selectedScene(): StoryScene | null {
    const story = this.state.story;
    return story?.scenes.find((scene) => scene.id === story.selectedSceneId) ?? null;
  }

  get timelineWarning(): string | null {
    const story = this.state.story;
    return story ? getTimelineWarning(story) : null;
  }

  private requireStory(): StoryDocument {
    if (!this.state.story) throw new Error('故事尚未初始化');
    return this.state.story;
  }

  private sceneMatches(scene: StoryScene, keyword: string): boolean {
    return `${scene.title}${scene.summary}${scene.conflict}`.toLowerCase().includes(keyword);
  }

  private loadCollapsed(story: StoryDocument): string[] {
    const sceneIds = new Set(story.scenes.map((scene) => scene.id));
    return this.uiState.loadCollapsedSceneIds(story.id).filter((id) => sceneIds.has(id));
  }

  private setCollapsed(collapsedSceneIds: string[]): void {
    this.setState({ collapsedSceneIds });
    this.persistCollapsed();
  }

  private persistCollapsed(): void {
    const story = this.state.story;
    if (!story) return;
    try {
      this.uiState.saveCollapsedSceneIds(story.id, this.state.collapsedSceneIds);
    } catch {
      this.setState({ status: 'error', error: '收起状态保存失败，但当前页面中的状态仍然有效。' });
    }
  }

  private updateStory(updater: (story: StoryDocument) => StoryDocument, showEditing = true): void {
    const story = updater(this.requireStory());
    this.persist(story);
    this.setState({ story, stats: getStats(story), status: showEditing ? 'editing' : this.state.status, error: '' });
  }

  private persist(story: StoryDocument): void {
    try {
      this.repository.save({ ...story, updatedAt: new Date().toISOString() });
    } catch {
      this.setState({ status: 'error', error: '保存失败，但当前编辑仍保留在页面中。' });
    }
  }

  private setState(patch: Partial<StoryViewState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
}
