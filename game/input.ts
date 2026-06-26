import { InputState, Vec2 } from "./types";

export function createInput(
  canvas: HTMLCanvasElement,
  getCamera: () => Vec2,
): { state: InputState; dispose: () => void } {
  const state: InputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    sprint: false,
    pausePressed: false,
    restartPressed: false,
    attackPressed: false,
    scanPressed: false,
    interact: false,
    usePotion: false,
    useCrucifix: false,
    virtualMove: { x: 0, y: 0 },
    virtualSprint: false,
    aim: null,
    toggleFlashlight: false,
    useRadio: false,
    returnAsh: false,
  };

  const setKey = (e: KeyboardEvent, down: boolean) => {
    switch (e.key.toLowerCase()) {
      case "w":
      case "arrowup":
        state.up = down;
        break;
      case "s":
      case "arrowdown":
        state.down = down;
        break;
      case "a":
      case "arrowleft":
        state.left = down;
        break;
      case "d":
      case "arrowright":
        state.right = down;
        break;
      case "shift":
        state.sprint = down;
        break;
      case "escape":
      case "p":
        if (down && !e.repeat) state.pausePressed = true;
        break;
      case "r":
        if (down && !e.repeat) state.restartPressed = true;
        break;
      case "q":
        if (down && !e.repeat) state.scanPressed = true;
        break;
      case "e":
        state.interact = down;
        break;
      case "1":
        if (down && !e.repeat) state.usePotion = true;
        break;
      case "2":
        if (down && !e.repeat) state.useCrucifix = true;
        break;
      case "f":
        // 切换手电模式（广角/聚焦）
        if (down && !e.repeat) state.toggleFlashlight = true;
        break;
      case "3":
        // 使用收音机扫描
        if (down && !e.repeat) state.useRadio = true;
        break;
      case "g":
        // 归还灰烬
        if (down && !e.repeat) state.returnAsh = true;
        break;
      case " ":
      case "spacebar":
        if (down && !e.repeat) state.attackPressed = true;
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const onMouseMove = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const cam = getCamera();
    state.aim = {
      x: e.clientX - rect.left + cam.x,
      y: e.clientY - rect.top + cam.y,
    };
  };

  const onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
      state.attackPressed = true;
      e.preventDefault();
    }
  };

  const onContextMenu = (e: MouseEvent) => e.preventDefault();
  const onKeyDown = (e: KeyboardEvent) => setKey(e, true);
  const onKeyUp = (e: KeyboardEvent) => setKey(e, false);

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("contextmenu", onContextMenu);

  return {
    state,
    dispose: () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("contextmenu", onContextMenu);
    },
  };
}
