"use client";

import { useMemo, useState } from "react";
import StorySceneImage from "@/components/StorySceneImage";
import { STORY_SCENES, type StoryChoice, type StoryScene } from "@/game/storyScenes";

type ChoiceRecord = {
  sceneId: string;
  sceneTitle: string;
  label: string;
  consequence: string;
  moralTag: string;
};

type StoryScore = {
  survivors: number;
  abandoned: number;
  ashes: number;
  carried: number;
  truth: number;
  silence: number;
  mercy: number;
  selfForgiven: number;
  burden: number;
  forgetting: number;
  fogPressure: number;
};

const PLAYABLE_SCENES = STORY_SCENES.filter((scene) => scene.kind !== "ending");
const ENDING_SCENES = STORY_SCENES.filter((scene) => scene.kind === "ending");
const ENDING_BY_ID = new Map(ENDING_SCENES.map((scene) => [scene.id, scene]));
const FINAL_DOOR_SCENE_ID = "scene-38-walk-through-door";

const MORAL_TAG_LABELS: Record<string, string> = {
  survivorsSaved: "救下同行者",
  survivorsAbandoned: "放弃同行者",
  ashesReturned: "归还灰烬",
  ashesCarried: "携带灰烬",
  truthFocused: "追寻真相",
  forgiveGuCheng: "接过顾承名字",
  refuseForgiveness: "拒绝宽恕",
  selfForgiven: "接受自我宽恕",
  burdenContinues: "继续背负",
  truthFaced: "说出真相",
  silenceChosen: "沉默守护",
  forgetting: "选择遗忘",
};

const INITIAL_SCORE: StoryScore = {
  survivors: 0,
  abandoned: 0,
  ashes: 0,
  carried: 0,
  truth: 0,
  silence: 0,
  mercy: 0,
  selfForgiven: 0,
  burden: 0,
  forgetting: 0,
  fogPressure: 0,
};

export default function CinematicStoryMode({ onExit }: { onExit: () => void }) {
  const [sceneId, setSceneId] = useState(PLAYABLE_SCENES[0]?.id ?? STORY_SCENES[0].id);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [panelIndex, setPanelIndex] = useState(0);
  const [choiceLog, setChoiceLog] = useState<ChoiceRecord[]>([]);

  const score = useMemo(() => calculateScore(choiceLog), [choiceLog]);
  const resolvedEnding = useMemo(() => resolveEnding(choiceLog), [choiceLog]);
  const scene =
    (endingId ? ENDING_BY_ID.get(endingId) : STORY_SCENES.find((entry) => entry.id === sceneId)) ?? STORY_SCENES[0];
  const panel = scene.panels[Math.min(panelIndex, scene.panels.length - 1)];
  const activeChoice = choiceLog.find((entry) => entry.sceneId === scene.id);
  const playableIndex = Math.max(0, PLAYABLE_SCENES.findIndex((entry) => entry.id === scene.id));
  const sceneNumber = `${scene.order} / ${scene.act}`;
  const isEnding = scene.kind === "ending";
  const isFinalDoor = scene.id === FINAL_DOOR_SCENE_ID;
  const needsChoice = !!scene.choices?.length && !activeChoice && !isEnding;
  const canAdvancePanel = panelIndex < scene.panels.length - 1;
  const progress = isEnding
    ? 100
    : Math.round(((playableIndex + panelIndex / Math.max(1, scene.panels.length)) / PLAYABLE_SCENES.length) * 100);
  const latestChoice = choiceLog[choiceLog.length - 1];

  const advancePanel = (direction: 1 | -1) => {
    setPanelIndex((value) => {
      const next = value + direction;
      return Math.max(0, Math.min(scene.panels.length - 1, next));
    });
  };

  const choose = (choice: StoryChoice) => {
    setChoiceLog((value) => [
      ...value.filter((entry) => entry.sceneId !== scene.id),
      {
        sceneId: scene.id,
        sceneTitle: scene.title,
        label: choice.label,
        consequence: choice.consequence,
        moralTag: choice.moralTag,
      },
    ]);
  };

  const continueStory = () => {
    if (isEnding) {
      restartStory();
      return;
    }

    if (canAdvancePanel) {
      advancePanel(1);
      return;
    }

    if (needsChoice) return;

    if (isFinalDoor) {
      setEndingId(resolvedEnding.scene.id);
      setPanelIndex(0);
      return;
    }

    const next = PLAYABLE_SCENES[playableIndex + 1];
    if (next) {
      setSceneId(next.id);
      setEndingId(null);
      setPanelIndex(0);
    }
  };

  const restartStory = () => {
    setSceneId(PLAYABLE_SCENES[0]?.id ?? STORY_SCENES[0].id);
    setEndingId(null);
    setPanelIndex(0);
    setChoiceLog([]);
  };

  const primaryActionLabel = getPrimaryActionLabel({
    isEnding,
    isFinalDoor,
    canAdvancePanel,
    needsChoice,
  });

  return (
    <main className="story-mode story-mode-immersive vignette">
      <div className="story-mode-backdrop" aria-hidden="true">
        <StorySceneImage scene={scene} />
      </div>

      <header className="story-mode-topbar story-mode-topbar-immersive">
        <div>
          <span>{sceneNumber}</span>
          <h1>{scene.title}</h1>
        </div>
        <nav aria-label="story mode actions">
          <a className="story-archive-link" href="/story-archive">
            场景档案
          </a>
          <button type="button" onClick={restartStory}>
            重新开始
          </button>
          <button type="button" onClick={onExit}>
            返回封面
          </button>
        </nav>
      </header>

      <section className="story-immersive-shell">
        <div className="story-immersive-status" aria-label="run status">
          <StateMeter label="同行者" value={score.survivors} max={2} />
          <StateMeter label="灰烬" value={score.ashes} max={3} />
          <StateMeter label="真相" value={score.truth} max={4} />
          <StateMeter label="宽恕" value={score.selfForgiven + score.mercy} max={6} />
          <StateMeter label="雾压" value={score.fogPressure} max={6} danger />
        </div>

        <article className="story-immersive-card">
          <div className="story-progress" aria-label="story progress">
            <span style={{ width: `${progress}%` }} />
          </div>

          <div className="story-scene-heading story-immersive-heading">
            <span>{scene.location}</span>
            <h2>{scene.subtitle}</h2>
          </div>

          <p className="story-scene-description">{scene.description}</p>

          <section className="story-comic-panel story-comic-panel-immersive" aria-label="comic panel">
            <div className="story-comic-panel-head">
              <span>
                漫画格 {panelIndex + 1} / {scene.panels.length}
              </span>
              <div>
                <button type="button" onClick={() => advancePanel(-1)} disabled={panelIndex === 0}>
                  上一格
                </button>
                <button type="button" onClick={() => advancePanel(1)} disabled={!canAdvancePanel}>
                  下一格
                </button>
              </div>
            </div>
            <h3>{panel.shot}</h3>
            <p>{panel.imageDirection}</p>
            {panel.narration && <blockquote>{panel.narration}</blockquote>}
            {panel.dialogue && <p className="story-dialogue">{panel.dialogue}</p>}
            {panel.interaction && <p className="story-interaction">{panel.interaction}</p>}
          </section>

          {scene.choices && !isEnding && (
            <section className="story-play-choices story-play-choices-immersive" aria-label="story choices">
              <span>关键选择</span>
              <div className="story-choice-actions">
                {scene.choices.map((choice) => {
                  const active = activeChoice?.label === choice.label;

                  return (
                    <button
                      key={`${scene.id}-${choice.label}`}
                      className={active ? "is-active" : ""}
                      type="button"
                      onClick={() => choose(choice)}
                      disabled={canAdvancePanel}
                    >
                      <strong>{choice.label}</strong>
                      <small>{getMoralTagLabel(choice.moralTag)}</small>
                      <span>{choice.consequence}</span>
                    </button>
                  );
                })}
              </div>
              {canAdvancePanel && <p>读完当前场景的漫画格后再做选择。</p>}
            </section>
          )}

          {isEnding && (
            <section className="story-ending-card" aria-label="resolved ending">
              <span>结局判定</span>
              <h3>{scene.title}</h3>
              <p>{resolvedEnding.reason}</p>
            </section>
          )}

          <div className="story-next-row story-next-row-immersive">
            <div>
              <span>当前倾向</span>
              <strong>{resolvedEnding.scene.title}</strong>
              {latestChoice && <em>最近选择：{latestChoice.label}</em>}
            </div>
            <button className="story-next-action" type="button" onClick={continueStory} disabled={needsChoice && !canAdvancePanel}>
              {primaryActionLabel}
            </button>
          </div>
        </article>
      </section>
    </main>
  );
}

function StateMeter({
  label,
  value,
  max,
  danger = false,
}: {
  label: string;
  value: number;
  max: number;
  danger?: boolean;
}) {
  const width = `${Math.min(100, Math.round((value / max) * 100))}%`;

  return (
    <div className={`story-state-meter ${danger ? "is-danger" : ""}`}>
      <div>
        <span>{label}</span>
        <strong>
          {value}/{max}
        </strong>
      </div>
      <i>
        <b style={{ width }} />
      </i>
    </div>
  );
}

function getMoralTagLabel(tag: string): string {
  return MORAL_TAG_LABELS[tag] ?? tag;
}

function calculateScore(log: ChoiceRecord[]): StoryScore {
  return log.reduce<StoryScore>((score, entry) => {
    switch (entry.moralTag) {
      case "survivorsSaved":
        score.survivors += 1;
        score.mercy += 1;
        break;
      case "survivorsAbandoned":
        score.abandoned += 1;
        score.fogPressure += 1;
        break;
      case "ashesReturned":
        score.ashes += 1;
        score.mercy += 1;
        break;
      case "ashesCarried":
        score.carried += 1;
        score.fogPressure += 1;
        break;
      case "truthFocused":
        score.truth += 1;
        break;
      case "forgiveGuCheng":
        score.mercy += 1;
        score.truth += 1;
        break;
      case "refuseForgiveness":
        score.truth += 1;
        break;
      case "selfForgiven":
        score.selfForgiven += 1;
        break;
      case "burdenContinues":
        score.burden += 1;
        score.fogPressure += 1;
        break;
      case "truthFaced":
        score.truth += 2;
        break;
      case "silenceChosen":
        score.silence += 2;
        score.truth += 1;
        break;
      case "forgetting":
        score.forgetting += 1;
        score.fogPressure += 2;
        break;
    }

    return score;
  }, { ...INITIAL_SCORE });
}

function resolveEnding(log: ChoiceRecord[]): { scene: StoryScene; reason: string } {
  const score = calculateScore(log);
  const hasTag = (tag: string) => log.some((entry) => entry.moralTag === tag);

  if (score.forgetting > 0 || score.abandoned >= 2 || score.fogPressure >= 5) {
    return {
      scene: getEnding("ending-denial"),
      reason: "你选择了遗忘，或多次让同行者与名字留在雾里。雾把逃避记录成新的循环。",
    };
  }

  if (hasTag("truthFaced") && score.selfForgiven > 0 && score.ashes >= 2 && score.survivors >= 2) {
    return {
      scene: getEnding("ending-redemption"),
      reason: "你救下同行者、归还名字、接受自我宽恕，并决定把真相带回现实。",
    };
  }

  if (hasTag("silenceChosen") && score.selfForgiven > 0 && score.truth >= 2) {
    return {
      scene: getEnding("ending-truth"),
      reason: "你看清了真相，也学会与自己和解，但最终选择让记忆成为私人的守护仪式。",
    };
  }

  if (score.survivors >= 2 && score.ashes >= 2) {
    return {
      scene: getEnding("ending-sacrifice"),
      reason: "你把他人的名字放在出口之前。门已经打开，但你仍然愿意回到雾中继续归还。",
    };
  }

  return {
    scene: getEnding("ending-endless"),
    reason: "你没有彻底堕落，也还没有完成承诺。雾保留下一轮下沉的机会。",
  };
}

function getEnding(id: string): StoryScene {
  return ENDING_BY_ID.get(id) ?? ENDING_SCENES[ENDING_SCENES.length - 1] ?? STORY_SCENES[STORY_SCENES.length - 1];
}

function getPrimaryActionLabel({
  isEnding,
  isFinalDoor,
  canAdvancePanel,
  needsChoice,
}: {
  isEnding: boolean;
  isFinalDoor: boolean;
  canAdvancePanel: boolean;
  needsChoice: boolean;
}) {
  if (isEnding) return "重新开始";
  if (canAdvancePanel) return "阅读下一格";
  if (needsChoice) return "先做出选择";
  if (isFinalDoor) return "推门进入结局";
  return "继续下一场";
}

export function storySceneCountLabel(): string {
  return `${PLAYABLE_SCENES.length} 场 / ${ENDING_SCENES.length} 结局`;
}
