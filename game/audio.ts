export interface AudioFrame {
  staticLevel: number;
  isMoving: boolean;
  dt: number;
  sprinting: boolean;
  danger: number;
  sanity: number;
  battery: number;
}

export interface BgmInfo {
  index: number;
  label: string;
  playing: boolean;
  cycle: boolean;
}

export class AudioEngine {
  private static readonly BGM_TRACKS: Array<{ label: string; src: string }> = [
    { label: "归潮磁带 01", src: "/audio/silent.mp3" },
    { label: "疗养院磁带 02", src: "/audio/silent1.mp3" },
    { label: "破晓磁带 03", src: "/audio/silent2.mp3" },
  ];
  private static readonly BGM_VOLUME = 0.36;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private drone: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private staticGain: GainNode | null = null;
  private bgm: HTMLAudioElement | null = null;
  private bgmIndex = 0;
  private manualBgm = false;
  private cycleBgm = true;
  private stepCooldown = 0;
  private heartCooldown = 0;
  private started = false;

  start() {
    if (this.started || typeof window === "undefined") return;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.48;
    this.master.connect(this.ctx.destination);
    this.buildDrone();
    this.buildStatic();
    this.buildBgm();
    this.started = true;
    this.tryPlayBgm();
  }

  resume() {
    this.ctx?.resume().catch(() => undefined);
    this.tryPlayBgm();
  }

  setBgm(index: number, manual = false) {
    if (!manual && this.manualBgm) return;
    if (manual) this.manualBgm = true;
    const next = ((Math.floor(index) % AudioEngine.BGM_TRACKS.length) + AudioEngine.BGM_TRACKS.length) % AudioEngine.BGM_TRACKS.length;
    if (next !== this.bgmIndex) {
      this.bgmIndex = next;
      if (this.bgm) {
        const wasPaused = this.bgm.paused;
        this.bgm.pause();
        this.bgm.src = AudioEngine.BGM_TRACKS[this.bgmIndex].src;
        this.bgm.load();
        if (!wasPaused) this.tryPlayBgm();
      }
    }
    this.tryPlayBgm();
  }

  nextBgm() {
    this.setBgm(this.bgmIndex + 1, true);
  }

  previousBgm() {
    this.setBgm(this.bgmIndex - 1, true);
  }

  toggleBgm() {
    if (!this.bgm) this.buildBgm();
    if (!this.bgm) return;
    if (this.bgm.paused) this.tryPlayBgm();
    else this.bgm.pause();
  }

  toggleCycle() {
    this.cycleBgm = !this.cycleBgm;
    if (this.bgm) this.bgm.loop = !this.cycleBgm;
  }

  getBgmInfo(): BgmInfo {
    const track = AudioEngine.BGM_TRACKS[this.bgmIndex];
    return {
      index: this.bgmIndex,
      label: track.label,
      playing: !!this.bgm && !this.bgm.paused,
      cycle: this.cycleBgm,
    };
  }

  update(frame: AudioFrame) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.droneGain) {
      this.droneGain.gain.setTargetAtTime(0.08 + frame.danger * 0.08, now, 0.5);
    }
    if (this.staticGain) {
      this.staticGain.gain.setTargetAtTime(frame.staticLevel * 0.16 + (1 - frame.battery) * 0.05, now, 0.08);
    }

    this.stepCooldown -= frame.dt;
    if (frame.isMoving && this.stepCooldown <= 0) {
      this.stepCooldown = frame.sprinting ? 0.22 : 0.38;
      this.playClick(frame.sprinting ? 120 : 90, 0.04);
    }

    this.heartCooldown -= frame.dt;
    if (frame.danger > 0.12 && this.heartCooldown <= 0) {
      this.heartCooldown = 0.9 - frame.danger * 0.45;
      this.playTone(58, 0.08, 0.12 + frame.danger * 0.12, "sine");
    }
  }

  playPickup() {
    this.playTone(640, 0.12, 0.12, "triangle");
  }

  playBattery() {
    this.playTone(780, 0.16, 0.1, "sine");
  }

  playScare() {
    this.playTone(90, 0.35, 0.3, "sawtooth");
  }

  playDescend() {
    this.playTone(140, 0.45, 0.22, "sawtooth");
  }

  playLunge() {
    this.playTone(360, 0.18, 0.18, "square");
  }

  playHit() {
    this.playClick(70, 0.22);
  }

  playSwing() {
    this.playTone(230, 0.08, 0.08, "triangle");
  }

  dispose() {
    if (this.bgm) {
      this.bgm.pause();
      this.bgm.src = "";
      this.bgm = null;
    }
    this.drone?.stop();
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.started = false;
  }

  private buildBgm() {
    if (typeof window === "undefined" || this.bgm) return;
    const bgm = new Audio(AudioEngine.BGM_TRACKS[this.bgmIndex].src);
    bgm.loop = !this.cycleBgm;
    bgm.preload = "auto";
    bgm.volume = AudioEngine.BGM_VOLUME;
    bgm.addEventListener("ended", () => {
      if (this.cycleBgm) this.setBgm(this.bgmIndex + 1, this.manualBgm);
    });
    this.bgm = bgm;
  }

  private tryPlayBgm() {
    if (!this.bgm) this.buildBgm();
    this.bgm?.play().catch(() => undefined);
  }

  private buildDrone() {
    if (!this.ctx || !this.master) return;
    this.drone = this.ctx.createOscillator();
    this.drone.frequency.value = 42;
    this.drone.type = "sine";
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.07;
    this.drone.connect(this.droneGain);
    this.droneGain.connect(this.master);
    this.drone.start();
  }

  private buildStatic() {
    if (!this.ctx || !this.master) return;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1500;
    filter.Q.value = 3;
    this.staticGain = this.ctx.createGain();
    this.staticGain.gain.value = 0;
    source.connect(filter);
    filter.connect(this.staticGain);
    this.staticGain.connect(this.master);
    source.start();
  }

  private playTone(freq: number, duration: number, volume: number, type: OscillatorType) {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration);
  }

  private playClick(freq: number, volume: number) {
    this.playTone(freq, 0.06, volume, "square");
  }
}
