"use client";

import { useEffect, useRef, useState } from "react";
import { AudioEngine, BgmInfo } from "@/game/audio";
import { GameEngine, HudData } from "@/game/engine";
import type { GamePhase } from "@/game/types";

const initialHud: HudData = {
  collected: 0,
  total: 3,
  elapsed: 0,
  stamina: 1,
  danger: 0,
  noise: 0,
  battery: 1,
  sanity: 1,
  depth: 1,
  best: 0,
  sigils: 0,
  sigilTotal: 1,
  scan: 1,
  rescued: 0,
  survivorTotal: 1,
  shields: 0,
  shieldTimer: 0,
  potions: 0,
  crucifix: 0,
  invuln: 0,
  chapter: "迷雾与原罪",
  levelTitle: "归潮街口",
  emotion: "压抑",
  mechanic: "雾中潜行",
  intro: "第一章 · 归潮街口。路灯在雾里像病斑，铃声从没有孩子的街口传来。",
  dossier: "住宅街被雾折叠成同一个路口。邮箱、车铃和迟到的承诺会把你带回第一处罪证。",
  artPromptId: "scene-tidal-street",
  clueLabel: "物证",
  sigilLabel: "信箱",
  exitLabel: "家门",
  sigilPrompt: "把三件日常物放回信箱。",
  exitPrompt: "听自行车铃声，旧家门会在雾最厚的地方等你。",
  guide: "bell",
};

export default function GameCanvas({ onExit, continueRun }: { onExit: () => void; continueRun?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const [phase, setPhase] = useState<GamePhase>("playing");
  const [hud, setHud] = useState<HudData>(initialHud);
  const [dossierVisible, setDossierVisible] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const audio = new AudioEngine();
    audio.start();
    audioRef.current = audio;
    const unlockAudio = () => audio.resume();
    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    window.addEventListener("touchstart", unlockAudio);

    const engine = new GameEngine(canvas, audio, {
      onPhaseChange: setPhase,
      onHud: setHud,
    });
    engineRef.current = engine;
    if (continueRun) engine.continueFromSave();
    engine.start();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
      engine.stop();
      audio.dispose();
    };
  }, [continueRun]);

  const handleRestart = () => {
    audioRef.current?.resume();
    engineRef.current?.restart();
    setHud(initialHud);
    setPhase("playing");
  };

  const handleResume = () => {
    audioRef.current?.resume();
    engineRef.current?.togglePause();
  };

  const summary = engineRef.current?.getRunSummary();

  return (
    <div className="game-shell vignette">
      <canvas ref={canvasRef} className="game-canvas" />
      <GameHud hud={hud} phase={phase} onExit={onExit} />
      <LevelDossier hud={hud} phase={phase} onVisibleChange={setDossierVisible} />
      <MusicPanel audioRef={audioRef} phase={phase} />
      <ObjectivePanel hud={hud} phase={phase} />
      <MessageOverlay dossierVisible={dossierVisible} engineRef={engineRef} phase={phase} />
      <TouchControls engineRef={engineRef} audioRef={audioRef} phase={phase} />

      {phase === "paused" && (
        <Overlay
          title="已暂停"
          body="雾仍在移动。深吸一口气，然后继续下沉。"
          actions={[
            { label: "继续", onClick: handleResume, primary: true },
            { label: "重开", onClick: handleRestart },
            { label: "返回标题", onClick: onExit },
          ]}
        />
      )}

      {phase === "caught" && (
        <Overlay
          title="被雾记住了"
          body={
            summary
              ? `你抵达了第 ${summary.depth} 层，用时 ${fmtTime(summary.time)}。最深记录：${summary.best}。`
              : "杂讯中断。只剩脚步声。"
          }
          danger
          actions={[
            { label: "再来一次", onClick: handleRestart, primary: true },
            { label: "返回标题", onClick: onExit },
          ]}
        />
      )}

      {phase === "escaped" && (
        <Overlay
          title="晨光进入病房"
          body="你没有被原谅。你只是终于停止要求亡者替你沉默。"
          actions={[
            { label: "重新开始", onClick: handleRestart, primary: true },
            { label: "返回标题", onClick: onExit },
          ]}
        />
      )}
    </div>
  );
}

function GameHud({ hud, phase, onExit }: { hud: HudData; phase: GamePhase; onExit: () => void }) {
  if (phase === "caught" || phase === "escaped") return null;

  return (
    <>
      <div className="hud-panel">
        <div className="hud-row hud-depth">
          <span>{hud.chapter}</span>
          <strong>
            {hud.depth}. {hud.levelTitle}
            {hud.best > 0 && <em> / 最深 {hud.best}</em>}
          </strong>
        </div>
        <HudRow label="心理" value={hud.emotion} />
        <HudRow label="玩法" value={hud.mechanic} />
        <HudRow label={hud.clueLabel} value={`${hud.collected} / ${hud.total}`} />
        <HudRow label={hud.sigilLabel} value={`${hud.sigils} / ${hud.sigilTotal}`} />
        <HudRow label="同行者" value={hud.survivorTotal > 0 ? "跟随中" : `已救 ${hud.rescued}`} />
        <HudRow label="护盾" value={hud.shieldTimer > 0 ? `${hud.shieldTimer.toFixed(1)}s` : "无"} />
        <HudRow label="药水" value={`${hud.potions} 瓶`} />
        <HudRow label="十字架" value={`${hud.crucifix} 个`} />
        <HudRow label="时间" value={fmtTime(hud.elapsed)} />
        <Meter
          label="电量"
          value={hud.battery}
          percentText={`${Math.round(hud.battery * 100)}%`}
          tone={hud.battery < 0.25 ? "danger" : hud.battery < 0.5 ? "warn" : "normal"}
        />
        <Meter label="理智" value={hud.sanity} tone={hud.sanity < 0.3 ? "danger" : hud.sanity < 0.55 ? "warn" : "normal"} />
        <Meter label="体力" value={hud.stamina} tone={hud.stamina < 0.25 ? "warn" : "normal"} />
        <Meter label="声呐" value={hud.scan} tone={hud.scan >= 1 ? "normal" : "dim"} />
        <Meter label="噪音" value={hud.noise} tone={hud.noise > 0.7 ? "warn" : "dim"} />
        <Meter label="杂讯" value={hud.danger} tone={hud.danger > 0.55 ? "danger" : "dim"} />
      </div>

      <div className="quick-help">
        <span>WASD 移动</span>
        <span>Shift 冲刺</span>
        <span>鼠标照明</span>
        <span>Space 挥击</span>
        <span>Q 声呐</span>
        <span>E 互动</span>
        <span>1 药水</span>
        <span>2 十字架</span>
        <button onClick={onExit} type="button">
          返回标题
        </button>
      </div>
    </>
  );
}

function MusicPanel({
  audioRef,
  phase,
}: {
  audioRef: React.RefObject<AudioEngine | null>;
  phase: GamePhase;
}) {
  const [info, setInfo] = useState<BgmInfo>({ index: 0, label: "归潮磁带 01", playing: false, cycle: true });

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const next = audioRef.current?.getBgmInfo();
      if (next) setInfo(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [audioRef]);

  if (phase === "caught" || phase === "escaped") return null;

  const run = (fn: (audio: AudioEngine) => void) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.resume();
    fn(audio);
    setInfo(audio.getBgmInfo());
  };

  return (
    <div className="music-panel" aria-label="background music controls">
      <span>BGM：{info.label}</span>
      <button type="button" onClick={() => run((audio) => audio.previousBgm())}>
        上一首
      </button>
      <button type="button" onClick={() => run((audio) => audio.toggleBgm())}>
        {info.playing ? "暂停" : "播放"}
      </button>
      <button type="button" onClick={() => run((audio) => audio.nextBgm())}>
        下一首
      </button>
      <button type="button" onClick={() => run((audio) => audio.toggleCycle())}>
        {info.cycle ? "三首循环" : "单曲循环"}
      </button>
    </div>
  );
}

function HudRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="hud-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LevelDossier({
  hud,
  phase,
  onVisibleChange,
}: {
  hud: HudData;
  phase: GamePhase;
  onVisibleChange: (visible: boolean) => void;
}) {
  const [visible, setVisible] = useState(true);
  const [artReady, setArtReady] = useState(false);
  const key = `${hud.depth}-${hud.levelTitle}`;
  const artSrc = `/assets/scenes/${hud.artPromptId}.png`;

  useEffect(() => {
    if (phase !== "playing") return;
    setVisible(true);
    onVisibleChange(true);
    const id = window.setTimeout(() => {
      setVisible(false);
      onVisibleChange(false);
    }, 6200);
    return () => window.clearTimeout(id);
  }, [key, onVisibleChange, phase]);

  useEffect(() => {
    if (phase !== "playing") onVisibleChange(false);
  }, [onVisibleChange, phase]);

  useEffect(() => {
    setArtReady(false);
  }, [artSrc]);

  if (phase !== "playing" || !visible) return null;

  return (
    <aside className="level-dossier" aria-label="level dossier">
      <div className={`dossier-art dossier-art-${hud.emotion}`} aria-hidden="true">
        <img
          alt=""
          className={artReady ? "is-ready" : ""}
          onError={() => setArtReady(false)}
          onLoad={() => setArtReady(true)}
          src={artSrc}
        />
        <span>{hud.artPromptId}</span>
      </div>
      <div className="dossier-copy">
        <span className="dossier-kicker">FOG ARCHIVE / DEPTH {String(hud.depth).padStart(2, "0")}</span>
        <strong>{hud.chapter} · {hud.levelTitle}</strong>
        <p>{hud.dossier}</p>
        <em>{hud.intro}</em>
        <small>
          目标：寻找{hud.clueLabel}，完成{hud.sigilLabel}，显影{hud.exitLabel}。
        </small>
      </div>
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          onVisibleChange(false);
        }}
        aria-label="关闭关卡档案"
      >
        ×
      </button>
    </aside>
  );
}

function ObjectivePanel({ hud, phase }: { hud: HudData; phase: GamePhase }) {
  if (phase === "caught" || phase === "escaped") return null;

  const cluesDone = hud.collected >= hud.total;
  const sigilsDone = hud.sigils >= hud.sigilTotal;
  const title = !cluesDone
    ? `${hud.mechanic}：寻找${hud.clueLabel}`
    : !sigilsDone
      ? `面对记忆：完成${hud.sigilLabel}`
      : `出口显影：${hud.exitLabel}`;
  const body = !cluesDone
    ? `跟随${guideText(hud.guide)}，收集${hud.clueLabel}（${hud.collected}/${hud.total}）。`
    : !sigilsDone
      ? `${hud.sigilPrompt}（${hud.sigils}/${hud.sigilTotal}）`
      : hud.exitPrompt;

  return (
    <div className="objective-panel">
      <strong>{title}</strong>
      <span>{body}</span>
      <em>不要寻找箭头。听杂音、看灰烬、辨认背影和光的方向。</em>
    </div>
  );
}

function Meter({
  label,
  value,
  tone,
  percentText,
}: {
  label: string;
  value: number;
  tone: "normal" | "dim" | "warn" | "danger";
  percentText?: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className={`meter meter-${tone}`}>
      <div className="meter-label">
        <span>{label}</span>
        <span>{percentText ?? `${Math.round(clamped * 100)}%`}</span>
      </div>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${clamped * 100}%` }} />
      </div>
    </div>
  );
}

function Overlay({
  title,
  body,
  actions,
  danger = false,
}: {
  title: string;
  body: string;
  danger?: boolean;
  actions: Array<{ label: string; onClick: () => void; primary?: boolean }>;
}) {
  return (
    <div className={`end-overlay ${danger ? "is-danger" : ""}`}>
      <div className="end-panel">
        <h2>{title}</h2>
        <p>{body}</p>
        <div className="overlay-actions">
          {actions.map((action) => (
            <button
              key={action.label}
              className={action.primary ? "primary-button compact" : "ghost-button"}
              onClick={action.onClick}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageOverlay({
  dossierVisible,
  engineRef,
  phase,
}: {
  dossierVisible: boolean;
  engineRef: React.RefObject<GameEngine | null>;
  phase: GamePhase;
}) {
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const m = engineRef.current?.getMessage();
      setMsg(m && m.timer > 0 ? m.text : "");
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engineRef]);

  if (phase !== "playing" || !msg) return null;
  return <div className={`message-overlay ${dossierVisible ? "with-dossier" : ""}`}>{msg}</div>;
}

function TouchControls({
  engineRef,
  audioRef,
  phase,
}: {
  engineRef: React.RefObject<GameEngine | null>;
  audioRef: React.RefObject<AudioEngine | null>;
  phase: GamePhase;
}) {
  const stickRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const [stick, setStick] = useState({ x: 0, y: 0, active: false });

  useEffect(() => {
    return () => {
      engineRef.current?.setVirtualMove(0, 0, false);
      engineRef.current?.setVirtualInteract(false);
    };
  }, [engineRef]);

  if (phase !== "playing") return null;

  const updateStick = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = stickRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) / 2;
    const max = radius - 22;
    const cx = rect.left + radius;
    const cy = rect.top + radius;
    const rawX = e.clientX - cx;
    const rawY = e.clientY - cy;
    const len = Math.hypot(rawX, rawY);
    const scale = len > max ? max / len : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    const nx = max > 0 ? x / max : 0;
    const ny = max > 0 ? y / max : 0;
    setStick({ x, y, active: true });
    engineRef.current?.setVirtualMove(nx, ny, Math.hypot(nx, ny) > 0.78);
  };

  const endStick = () => {
    activePointer.current = null;
    setStick({ x: 0, y: 0, active: false });
    engineRef.current?.setVirtualMove(0, 0, false);
  };

  const trigger = (action: "attack" | "scan" | "potion" | "crucifix") => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    audioRef.current?.resume();
    if (action === "attack") engineRef.current?.triggerAttack();
    else if (action === "scan") engineRef.current?.triggerScan();
    else if (action === "potion") engineRef.current?.triggerPotion();
    else engineRef.current?.triggerCrucifix();
  };

  const setInteract = (active: boolean) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    audioRef.current?.resume();
    engineRef.current?.setVirtualInteract(active);
  };

  return (
    <div className="touch-controls" aria-label="touch controls">
      <div
        ref={stickRef}
        className={`touch-stick ${stick.active ? "is-active" : ""}`}
        onPointerDown={(e) => {
          e.preventDefault();
          audioRef.current?.resume();
          activePointer.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateStick(e);
        }}
        onPointerMove={(e) => {
          if (activePointer.current === e.pointerId) updateStick(e);
        }}
        onPointerUp={endStick}
        onPointerCancel={endStick}
      >
        <span style={{ transform: `translate(${stick.x}px, ${stick.y}px)` }} />
      </div>

      <div className="touch-actions">
        <button type="button" className="touch-button touch-button-attack" onPointerDown={trigger("attack")}>
          击
        </button>
        <button type="button" className="touch-button" onPointerDown={trigger("scan")}>
          扫
        </button>
        <button type="button" className="touch-button touch-button-potion" onPointerDown={trigger("potion")}>
          药
        </button>
        <button type="button" className="touch-button touch-button-cross" onPointerDown={trigger("crucifix")}>
          架
        </button>
        <button
          type="button"
          className="touch-button"
          onPointerDown={setInteract(true)}
          onPointerUp={setInteract(false)}
          onPointerCancel={setInteract(false)}
          onPointerLeave={setInteract(false)}
        >
          E
        </button>
      </div>
    </div>
  );
}

function guideText(guide: HudData["guide"]): string {
  switch (guide) {
    case "ash":
      return "灰烬飘落";
    case "ghost":
      return "幽灵背影";
    case "radio":
      return "收音机杂音";
    case "light":
      return "光影折射";
    case "heartbeat":
      return "心跳急促";
    case "bell":
      return "自行车铃声";
    case "water":
      return "水纹流向";
    case "silence":
      return "静默中的晨光";
  }
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
