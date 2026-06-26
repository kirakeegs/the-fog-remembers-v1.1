import Link from "next/link";
import StorySceneImage from "@/components/StorySceneImage";
import { STORY_ACTS, STORY_SCENES } from "@/game/storyScenes";

const VISIBLE_ACTS = STORY_ACTS.filter((act) => act.id !== "all");

export default function StoryArchivePage() {
  return (
    <main className="story-archive-page vignette">
      <div className="story-archive-shell">
        <header className="story-archive-header">
          <div>
            <span>SCENE ARCHIVE</span>
            <h1>场景档案</h1>
            <p>
              这里集中存放电影漫画模式的场景说明、玩法目标、分镜和生图提示词。游玩界面只保留沉浸叙事与选择推进。
            </p>
          </div>
          <nav aria-label="archive navigation">
            <Link href="/?mode=story">开始电影漫画模式</Link>
            <Link href="/">返回封面</Link>
          </nav>
        </header>

        {VISIBLE_ACTS.map((act) => {
          const scenes = STORY_SCENES.filter((scene) => scene.act === act.id);
          if (scenes.length === 0) return null;

          return (
            <section className="story-archive-section" key={act.id}>
              <span>{String(scenes.length).padStart(2, "0")} SCENES</span>
              <h2>{act.label}</h2>
              <div className="story-archive-grid">
                {scenes.map((scene) => (
                  <article className="story-archive-card" key={scene.id}>
                    <figure>
                      <StorySceneImage scene={scene} alt={`${scene.title} 场景插画`} />
                      <span>
                        {scene.order} / {scene.kind === "ending" ? "结局" : scene.location}
                      </span>
                    </figure>
                    <div className="story-archive-card-copy">
                      <small>{scene.id}</small>
                      <h3>{scene.title}</h3>
                      <strong>{scene.subtitle}</strong>
                      <p>{scene.description}</p>

                      <details>
                        <summary>场景玩法</summary>
                        <p>情绪：{scene.mood}</p>
                        <p>机制：{scene.mechanic}</p>
                        <p>玩法：{scene.gameplay}</p>
                        <ul>
                          {scene.objectives.map((objective) => (
                            <li key={objective}>{objective}</li>
                          ))}
                        </ul>
                      </details>

                      <details>
                        <summary>漫画分镜</summary>
                        <ul>
                          {scene.panels.map((panel, index) => (
                            <li key={`${scene.id}-panel-${index}`}>
                              <strong>
                                {String(index + 1).padStart(2, "0")} {panel.shot}
                              </strong>
                              <p>{panel.imageDirection}</p>
                              {panel.narration && <p>{panel.narration}</p>}
                              {panel.dialogue && <p>{panel.dialogue}</p>}
                              {panel.interaction && <p>{panel.interaction}</p>}
                            </li>
                          ))}
                        </ul>
                      </details>

                      {scene.choices && (
                        <details>
                          <summary>关键选择</summary>
                          <ul>
                            {scene.choices.map((choice) => (
                              <li key={`${scene.id}-${choice.label}`}>
                                <strong>{choice.label}</strong>
                                <p>{choice.consequence}</p>
                                <small>{choice.moralTag}</small>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}

                      <details>
                        <summary>生图提示词</summary>
                        <pre>{scene.artPrompt}</pre>
                      </details>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
