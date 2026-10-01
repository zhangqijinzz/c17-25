import { useState } from 'react';
import type { StoryScene } from '../models/story';
import type { StoryViewModel } from '../viewmodels/storyViewModel';

interface TimelineBoardProps { viewModel: StoryViewModel; scenes: StoryScene[]; }

export function TimelineBoard({ viewModel, scenes }: TimelineBoardProps) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const submit = () => { viewModel.addScene(title, summary); setTitle(''); setSummary(''); };
  const story = viewModel.snapshot.story;
  const collapsedIds = story?.collapsedSceneIds ?? [];
  const collapsedCount = scenes.filter((scene) => collapsedIds.includes(scene.id)).length;
  return (
    <section className="panel timeline-panel">
      <div className="panel-heading timeline-heading"><div><span className="eyebrow">SEQUENCE / 时间结构</span><h2>故事时间线</h2></div><div className="timeline-actions"><span className="hint">拖动感受节奏 · 点击编辑详情</span><button className="secondary-button" onClick={() => viewModel.collapseOtherScenes(story?.selectedSceneId ?? '')}>收起其他场景</button>{collapsedCount > 0 && <button className="secondary-button" onClick={() => viewModel.expandAllScenes()}>全部展开</button>}<button className="secondary-button" onClick={submit}>＋ 新建场景</button></div></div>
      {viewModel.timelineWarning && <div className="warning-banner">△ {viewModel.timelineWarning}</div>}
      <div className="timeline-rail">
        {scenes.map((scene, index) => {
          const selected = story?.selectedSceneId === scene.id;
          const collapsed = collapsedIds.includes(scene.id);
          const characterCount = story?.characters.filter((character) => scene.characterIds.includes(character.id)).length ?? 0;
          const sceneNumber = String(index + 1).padStart(2, '0');
          if (collapsed) {
            return (
              <div className="scene-item" key={scene.id}>
                <button className="scene-node collapsed" onClick={() => viewModel.toggleSceneCollapse(scene.id)} aria-label={`展开场景 ${scene.title}`}>
                  <span className="scene-index">{sceneNumber}</span>
                  <span className="scene-line" />
                  <span className="scene-dot" />
                  <div className="scene-copy collapsed-copy">
                    <span className="scene-meta">SCENE {sceneNumber} · 已收起 · {characterCount} 位人物{scene.clueIds.length > 0 ? ` · 伏笔 ${scene.clueIds.length}` : ''}</span>
                    <strong>{scene.title}</strong>
                  </div>
                  <span className="collapse-hint">▸</span>
                </button>
              </div>
            );
          }
          return (
            <div className="scene-item" key={scene.id}>
              <button className={selected ? 'scene-node selected' : 'scene-node'} onClick={() => viewModel.selectScene(scene.id)}><span className="scene-index">{sceneNumber}</span><span className="scene-line" /><span className="scene-dot" /><div className="scene-copy"><span className="scene-meta">SCENE {sceneNumber} · {characterCount} 位人物</span><strong>{scene.title}</strong><span>{scene.summary}</span><div className="scene-tags">{scene.conflict && <em>冲突</em>}{scene.clueIds.length > 0 && <em className="clue-tag">伏笔 {scene.clueIds.length}</em>}</div></div></button>
              <button className="collapse-toggle" aria-label={`收起场景 ${scene.title}`} title="收起场景" onClick={() => viewModel.toggleSceneCollapse(scene.id)}>▾</button>
            </div>
          );
        })}
        {scenes.length === 0 && <div className="empty-state">时间线还没有场景。创建第一幕，让故事开始移动。</div>}
      </div>
      <div className="create-scene-row"><input aria-label="场景标题" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="新场景标题，例如：灯塔停电" /><input aria-label="场景摘要" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="一句话写下这一幕发生了什么" /><button onClick={submit}>添加到时间线</button></div>
    </section>
  );
}
