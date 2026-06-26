"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import CinematicStoryMode, { storySceneCountLabel } from "@/components/CinematicStoryMode";
import GameCanvas from "@/components/GameCanvas";

const TITLE_TRACKS = [
  { label: "归潮磁带", src: "/audio/silent.mp3" },
  { label: "疗养院磁带", src: "/audio/silent1.mp3" },
  { label: "破晓磁带", src: "/audio/silent2.mp3" },
];

const STORY_LINES = [
  "雾不是天气。它从灰洄镇旧疗养院的地下层升起，穿过锈蚀的铁门，把整座港镇拖进一场迟来的审判。",
  "你醒在归潮街口，手里只有一支快没电的手电。每一层都像某段记忆的遗址：公寓、医院、教堂、学校、海岸，还有没有尽头的更深处。",
  "找到物证，完成仪式，救下仍在雾里呼救的人。下沉越深，怪物越密，补给也会越多，直到你决定自己能走到哪里。",
  "出口不会用箭头标出来。听收音机、看灰烬、辨认水纹和微弱的光。雾会撒谎，但记忆总会留下方向。",
];

const DOSSIERS = [
  {
    label: "故事背景",
    code: "CASE 01",
    title: "灰洄镇不会放人",
    body: "雾从旧疗养院的地下层向外翻涌，吞掉街灯、楼梯间和海岸线。你不是来逃出去的，你是来把被雾扣押的记忆一件件取回。",
    bullets: ["归潮街口是第一层入口", "旧疗养院是雾的源头", "每次下沉都会改写路线和补给"],
  },
  {
    label: "操作",
    code: "FIELD 02",
    title: "用光和声音活下去",
    body: "移动、手电、声呐和道具构成核心节奏。你越急，噪音越高；你越贪，电量越少。所有操作都服务于一个目标：在黑暗里判断方向。",
    bullets: [
      "WASD / 方向键移动，鼠标控制手电",
      "Shift 冲刺，Space 挥击驱散近身怪物",
      "E 互动、Q 声呐，1 药水护盾，2 十字架定身",
    ],
  },
  {
    label: "下沉规则",
    code: "DEPTH 03",
    title: "越深越危险，也越值得",
    body: "每一层都是一个新的心理场景：更多怪物、更远目标、更复杂仪式。完成物证和信笺后，出口会显影；你可以撤离，也可以带着补给继续下沉。",
    bullets: ["层数越深，路线和怪物密度越高", "下沉会补充电池、药水和十字架", "最深层数会被保存为纪录"],
  },
  {
    label: "玩法策略",
    code: "TACTIC 04",
    title: "不要找箭头，找异常",
    body: "雾会误导视线，但不会抹掉痕迹。灰烬、水纹、收音机杂音、背影和弱光都在暗示目标方向。保留一次保命道具，比多拿一件物证更重要。",
    bullets: ["先听环境提示，再决定是否冲刺", "怪物逼近时用十字架争取距离", "电量低于 25% 时停止无意义照明"],
  },
];

const SURVIVAL_LOOP = ["侦听线索", "搜集物证", "完成仪式", "解救幸存者", "显影出口", "继续下沉"];

const STORY_ARC = [
  {
    code: "CHAPTER 01",
    title: "归潮街口",
    subtitle: "雾先记起迟到的人",
    image: "/assets/scenes/scene-tidal-street.png",
    body:
      "你在灰洄镇醒来。邮箱里没有信，水洼里却有一枚婚戒。车铃从没有孩子的街口传来，像有人还在等一句“我马上回来”。",
    beats: ["拾回钥匙、小票、婚戒", "关闭公寓里的争吵收音机", "电梯打开时，家门变成医院走廊"],
  },
  {
    code: "CHAPTER 02",
    title: "铁锈医院",
    subtitle: "心跳比怪物更吵",
    image: "/assets/scenes/scene-rust-hospital.png",
    body:
      "手术灯照着一件小小的雨衣。你拉下急救电闸，走廊醒来，输液管垂下，像要替你数清那晚刹车前的每一次心跳。",
    beats: ["让三台急救电闸重新亮起", "在肉墙地下道搬运心脏保险丝", "配电箱尖叫后，事故现场从墙缝里显影"],
  },
  {
    code: "CHAPTER 03",
    title: "灰烬教堂",
    subtitle: "不要再把他们叫作事故",
    image: "/assets/scenes/scene-ash-church.png",
    body:
      "灰烬落地时像翻页。那些没有脸的人跪在长椅之间，等待自己的名字。你越往前走，越明白救赎不是删掉记忆，而是承认它发生过。",
    beats: ["把名字还给幻影", "在沉没学校找回作业本", "黑板浮现：我等到天黑"],
  },
  {
    code: "CHAPTER 04",
    title: "破晓海岸",
    subtitle: "真相不等于原谅",
    image: "/assets/scenes/scene-dawn-coast.png",
    body:
      "退潮露出车灯碎片、病历夹和街牌。镜子把争吵拼回原样。黑影转身离开，没有原谅你，也没有诅咒你，只把病房门留在晨光里。",
    beats: ["转动反光镜，让阴影承认真相", "在病房放下药水、十字架、手电和婚戒", "孩子问：你还会忘记我吗"],
  },
];

const CAST_CARDS = [
  { name: "主角", role: "携灯者", image: "/assets/characters/character-survivor-player.png", text: "他不是英雄，只是终于愿意沿着雾往回走。" },
  { name: "幸存者", role: "同行者", image: "/assets/characters/character-rescued-survivor.png", text: "她会跟着你下沉，也会在必要时替你挡下一次死亡。" },
  { name: "幻觉影子", role: "理智裂缝", image: "/assets/characters/hallucination-shadow.png", text: "当理智降低，它们会站在视野边缘，提醒你记忆正在失真。" },
];

const THREAT_CARDS = [
  { name: "徘徊者", image: "/assets/monsters/monster-wanderer.png", text: "被遗忘的轮廓。它不急着追你，只是在雾里重复同一段路。" },
  { name: "追猎者", image: "/assets/monsters/monster-stalker.png", text: "听见逃跑就开始靠近。越慌张，它越像已经知道你会往哪边跑。" },
  { name: "聆听者", image: "/assets/monsters/monster-listener.png", text: "没有眼睛，只收集声音。静止有时比奔跑更像生路。" },
  { name: "残暴者", image: "/assets/monsters/monster-brute.png", text: "缓慢、沉重、不可争辩。它像事故本身，迟早会走到你面前。" },
  { name: "匍匐者", image: "/assets/monsters/monster-crawler.png", text: "贴着地面从水声里滑出。你看见它时，距离通常已经不够了。" },
];

const ITEM_CARDS = [
  { name: "电池", image: "/assets/items/item-battery.png", text: "让手电多活一段路，但不能替你决定照向哪里。" },
  { name: "药水", image: "/assets/items/item-potion.png", text: "十秒之内，死亡认不出你。十秒之后，它会重新点名。" },
  { name: "十字架", image: "/assets/items/item-crucifix-relic.png", text: "短暂定住附近的怪物。这里的信仰只剩延迟，不剩答案。" },
  { name: "线索纸条", image: "/assets/items/item-clue-note.png", text: "每张纸都像证词的一角。拼齐它们，出口才会显影。" },
];

export default function Home() {
  const [mode, setMode] = useState<"title" | "new" | "continue" | "story">("title");
  const [hasSave, setHasSave] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);
  const [trackIndex, setTrackIndex] = useState(0);
  const [dossierIndex, setDossierIndex] = useState(0);
  const [uiOpacity, setUiOpacity] = useState(0.82);
  const [musicOn, setMusicOn] = useState(true);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dossier = DOSSIERS[dossierIndex];
  const titleStyle = { "--title-ui-opacity": uiOpacity } as CSSProperties;

  useEffect(() => {
    setHasSave(typeof window !== "undefined" && GameHasSave());
  }, [mode]);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "story") {
      setMode("story");
    }
  }, []);

  useEffect(() => {
    if (mode !== "title") return;
    const id = window.setInterval(() => {
      setStoryIndex((value) => (value + 1) % STORY_LINES.length);
    }, 5200);
    return () => window.clearInterval(id);
  }, [mode]);

  // 仅在进入标题页或切换曲目时创建/销毁音频元素，避免每次开关都重建导致的竞态
  useEffect(() => {
    if (mode !== "title") return;

    const audio = new Audio(TITLE_TRACKS[trackIndex].src);
    audio.loop = true;
    audio.volume = 0.38;
    audio.preload = "auto";
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = "";
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, [mode, trackIndex]);

  // 单独响应播放/暂停状态，作用在已存在的音频元素上
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (musicOn && mode === "title") {
      audio.play().then(() => setAutoplayBlocked(false)).catch(() => setAutoplayBlocked(true));
    } else {
      audio.pause();
      setAutoplayBlocked(false);
    }
  }, [musicOn, mode, trackIndex]);

  useEffect(() => {
    if (mode !== "title" || !musicOn) return;

    const resumeTitleMusic = () => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.play().then(() => setAutoplayBlocked(false)).catch(() => setAutoplayBlocked(true));
    };

    window.addEventListener("pointerdown", resumeTitleMusic);
    window.addEventListener("keydown", resumeTitleMusic);
    return () => {
      window.removeEventListener("pointerdown", resumeTitleMusic);
      window.removeEventListener("keydown", resumeTitleMusic);
    };
  }, [mode, musicOn]);

  const toggleMusic = () => {
    setMusicOn((value) => !value);
    setAutoplayBlocked(false);
  };

  const nextTrack = () => {
    setTrackIndex((value) => (value + 1) % TITLE_TRACKS.length);
    setMusicOn(true);
    setAutoplayBlocked(false);
  };

  if (mode === "story") {
    return <CinematicStoryMode onExit={() => setMode("title")} />;
  }

  if (mode !== "title") {
    return <GameCanvas continueRun={mode === "continue"} onExit={() => setMode("title")} />;
  }

  return (
    <main className="title-screen vignette" style={titleStyle}>
      <div className="cover-scene" aria-hidden="true">
        <div className="cover-skyline" />
        <div className="cover-traffic cover-traffic-left">
          <span />
          <span />
          <span />
        </div>
        <div className="cover-traffic cover-traffic-right">
          <span />
          <span />
          <span />
        </div>
        <div className="cover-road" />
        <div className="cover-figure" />
        <div className="cover-fog cover-fog-a" />
        <div className="cover-fog cover-fog-b" />
        <div className="cover-ash" />
        <div className="cover-static" />
      </div>

      <section id="title-cover" className="title-shell">
        <header className="title-hero">
          <p className="eyebrow">ORIGINAL PSYCHOLOGICAL HORROR / ENDLESS DESCENT</p>
          <h1>雾会记得</h1>
          <p className="subtitle">THE FOG REMEMBERS</p>
        </header>

        <section className="story-console" aria-label="story background">
          <div className="story-marker">CASE FILE {String(storyIndex + 1).padStart(2, "0")}</div>
          <p key={storyIndex}>{STORY_LINES[storyIndex]}</p>
        </section>

        <section className="title-command-deck" aria-label="launch controls">
          <div className="cover-tuning" aria-label="title text opacity">
            <span>文字显影</span>
            <input
              aria-label="调节封面文字透明度"
              max="1"
              min="0.46"
              onChange={(event) => setUiOpacity(Number(event.target.value))}
              step="0.02"
              type="range"
              value={uiOpacity}
            />
            <strong>{Math.round(uiOpacity * 100)}%</strong>
          </div>

          <div className={`tape-deck ${musicOn && !autoplayBlocked ? "is-playing" : ""}`}>
            <span className="deck-label">NOW PLAYING</span>
            <strong>{TITLE_TRACKS[trackIndex].label}</strong>
            <div className="cassette-window" aria-hidden="true">
              <span className="cassette-reel cassette-reel-left" />
              <span className="cassette-band" />
              <span className="cassette-reel cassette-reel-right" />
            </div>
            <span>
              {autoplayBlocked
                ? "浏览器等待一次点击后开始播放"
                : musicOn
                  ? "磁带正在转动"
                  : "磁带待机，按播放唤醒封面音轨"}
            </span>
          </div>

          <nav className="title-actions" aria-label="main actions">
            {hasSave && (
              <button className="ghost-button" onClick={() => setMode("continue")} type="button">
                继续下沉
              </button>
            )}
            <button className="primary-button" onClick={() => setMode("new")} type="button">
              坠入迷雾
            </button>
            <button className="ghost-button" onClick={() => setMode("story")} type="button">
              电影漫画模式 / {storySceneCountLabel()}
            </button>
            <button className="ghost-button compact" onClick={toggleMusic} type="button">
              {musicOn ? "BGM 暂停" : "BGM 播放"}
            </button>
            <button className="ghost-button compact" onClick={nextTrack} type="button">
              切换磁带
            </button>
          </nav>
        </section>

        <a className="scroll-cue" href="#fog-archive">
          下滑读取雾档案
        </a>
      </section>

      <section id="fog-archive" className="archive-section" aria-label="fog archive">
        <div className="archive-visual" aria-hidden="true" />

        <div className="archive-terminal">
          <div className="archive-heading">
            <span>FOG ARCHIVE TERMINAL</span>
            <h2>下沉前简报</h2>
          </div>

          <div className="archive-tabs" role="tablist" aria-label="archive pages">
            {DOSSIERS.map((entry, index) => (
              <button
                key={entry.code}
                className={index === dossierIndex ? "is-active" : ""}
                onClick={() => setDossierIndex(index)}
                role="tab"
                type="button"
                aria-selected={index === dossierIndex}
              >
                <span>{entry.label}</span>
                <small>{entry.code}</small>
              </button>
            ))}
          </div>

          <article className="archive-page">
            <span>{dossier.code}</span>
            <h3>{dossier.title}</h3>
            <p>{dossier.body}</p>
            <ul>
              {dossier.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>

        <aside className="protocol-board" aria-label="survival loop">
          <a className="archive-back" href="#title-cover">
            返回封面
          </a>
          <span>RUN LOOP</span>
          <h2>一局的核心玩法</h2>
          <ol>
            {SURVIVAL_LOOP.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p>建议佩戴耳机。存档会记录你到达的最深层数和携带的道具。</p>
        </aside>
      </section>

      <section id="story-pages" className="story-pages" aria-label="complete story archive">
        <header className="story-pages-heading">
          <span>COMPLETE CASE THREAD</span>
          <h2>雾档案：从下沉到晨光</h2>
          <p>这是一条完整闭环：迟到、否认、追责、归还名字、承认真相，最后在病房里放下所有用来逃避死亡的东西。</p>
        </header>

        <div className="story-arc">
          {STORY_ARC.map((chapter, index) => (
            <article className="story-card" key={chapter.code}>
              <div className="story-card-image">
                <img alt="" src={chapter.image} />
                <span>{chapter.code}</span>
              </div>
              <div className="story-card-copy">
                <small>{String(index + 1).padStart(2, "0")} / 04</small>
                <h3>{chapter.title}</h3>
                <strong>{chapter.subtitle}</strong>
                <p>{chapter.body}</p>
                <ul>
                  {chapter.beats.map((beat) => (
                    <li key={beat}>{beat}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>

        <section className="story-compendium" aria-label="characters threats and items">
          <CompendiumGroup title="同行者与幻觉" cards={CAST_CARDS} />
          <CompendiumGroup title="雾中威胁" cards={THREAT_CARDS} compact />
          <CompendiumGroup title="求生物件" cards={ITEM_CARDS} compact />
        </section>
      </section>
    </main>
  );
}

function CompendiumGroup({
  title,
  cards,
  compact = false,
}: {
  title: string;
  cards: Array<{ name: string; role?: string; image: string; text: string }>;
  compact?: boolean;
}) {
  return (
    <div className={`compendium-group ${compact ? "is-compact" : ""}`}>
      <h3>{title}</h3>
      <div className="compendium-grid">
        {cards.map((card) => (
          <article className="compendium-card" key={card.name}>
            <img alt="" src={card.image} />
            <div>
              <strong>{card.name}</strong>
              {card.role && <span>{card.role}</span>}
              <p>{card.text}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function GameHasSave(): boolean {
  try {
    return !!localStorage.getItem("fog-save-v1");
  } catch {
    return false;
  }
}
