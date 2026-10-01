import { useState } from 'react';
import type { StoryScene } from '../models/story';
import type { StoryViewModel } from '../viewmodels/storyViewModel';

interface TimelineBoardProps { viewModel: StoryViewModel; scenes: StoryScene[]; }

export function TimelineBoard({ viewModel, scenes }: TimelineBoardProps) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const submit = () => { viewModel.addScene(title, summary); setTitle(''); setSummary(''); };
  const story = viewModel.snapshot.story;
  const positions = viewModel.scenePositions;
  const selectedSceneId = story?.selectedSceneId ?? '';
  const collapsedCount = viewModel.snapshot.collapsedSceneIds.length;
  return (
    <section className="panel timeline-panel">
      <div className="panel-heading timeline-heading">
        <div><span className="eyebrow">SEQUENCE / 时间结构</span><h2>故事时间线</h2></div>
        <div className="timeline-actions">
          <span className="hint">拖动感受节奏 · 点击编辑详情</span>
          {collapsedCount > 0 && <button className="secondary-button" onClick={() => viewModel.expandAllScenes()}>全部展开（{collapsedCount}）</button>}
          <button className="secondary-button" disabled={!selectedSceneId} onClick={() => viewModel.collapseOtherScenes(selectedSceneId)}>收起其他场景</button>
          <button className="secondary-button" onClick={submit}>＋ 新建场景</button>
        </div>
      </div>
      {viewModel.timelineWarning && <div className="warning-banner">△ {viewModel.timelineWarning}</div>}
      <div className="timeline-rail">
        {scenes.map((scene) => {
          const selected = story?.selectedSceneId === scene.id;
          const number = String((positions.get(scene.id) ?? 0) + 1).padStart(2, '0');
          const characterCount = story?.characters.filter((character) => scene.characterIds.includes(character.id)).length ?? 0;
          const tags = (
            <span className="scene-tags">
              {scene.conflict && <em>冲突</em>}
              {scene.clueIds.length > 0 && <em className="clue-tag">伏笔 {scene.clueIds.length}</em>}
            </span>
          );
          if (viewModel.isSceneCollapsed(scene.id)) {
            return (
              <div className={selected ? 'scene-node collapsed selected' : 'scene-node collapsed'} key={scene.id}>
                <span className="scene-index">{number}</span>
                <span className="scene-line" />
                <span className="scene-dot" />
                <div className="scene-copy">
                  <button className="scene-collapsed-bar" onClick={() => viewModel.selectScene(scene.id)}>
                    <span className="scene-meta">SCENE {number}</span>
                    <strong>{scene.title}</strong>
                    {tags}
                  </button>
                  <button className="collapse-toggle" aria-label={`展开场景 ${scene.title}`} onClick={() => viewModel.toggleSceneCollapsed(scene.id)}>▸ 展开</button>
                </div>
              </div>
            );
          }
          return (
            <div className={selected ? 'scene-node selected' : 'scene-node'} key={scene.id}>
              <span className="scene-index">{number}</span>
              <span className="scene-line" />
              <span className="scene-dot" />
              <div className="scene-copy">
                <button className="scene-main" onClick={() => viewModel.selectScene(scene.id)}>
                  <span className="scene-meta">SCENE {number} · {characterCount} 位人物</span>
                  <strong>{scene.title}</strong>
                  <span>{scene.summary}</span>
                  {tags}
                </button>
                <button className="collapse-toggle" aria-label={`收起场景 ${scene.title}`} onClick={() => viewModel.toggleSceneCollapsed(scene.id)}>▾ 收起</button>
              </div>
            </div>
          );
        })}
        {scenes.length === 0 && <div className="empty-state">时间线还没有场景。创建第一幕，让故事开始移动。</div>}
      </div>
      <div className="create-scene-row">
        <input aria-label="场景标题" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="新场景标题，例如：灯塔停电" />
        <input aria-label="场景摘要" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="一句话写下这一幕发生了什么" />
        <button onClick={submit}>添加到时间线</button>
      </div>
    </section>
  );
}
