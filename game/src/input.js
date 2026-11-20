// Keyboard + mouse input with edge-triggered "pressed" queries.

const down = new Set();
const hit = new Set();
let mouseX = 0, mouseY = 0, mouseDown = false, mouseHit = false;

const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'KeyC', 'KeyR']);

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (BLOCK.has(e.code)) e.preventDefault();
    if (!down.has(e.code)) hit.add(e.code);
    down.add(e.code);
  });
  window.addEventListener('keyup', (e) => down.delete(e.code));
  window.addEventListener('blur', () => { down.clear(); });
  window.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
  });
  window.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouseDown = true; mouseHit = true; }
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
}

export const key = (code) => down.has(code);
export const pressed = (code) => hit.has(code);
export const anyKey = () => hit.size > 0;
export const mouse = () => ({ x: mouseX, y: mouseY, down: mouseDown, hit: mouseHit });
export const clearMouse = () => { mouseHit = false; };
/** Used by the test/screenshot harness to inject synthetic input. */
export function injectDown(code) { if (!down.has(code)) hit.add(code); down.add(code); }
export function injectUp(code) { down.delete(code); }

/** Called once per frame after the game update: edge states reset. */
export function endFrame() {
  hit.clear();
  mouseHit = false;
}

// polish pass: quick-save / quick-load + minimap zoom keybinds
// expansion pass: radio toggle key
export const BINDINGS = {
  quickSave: 'F5',
  quickLoad: 'F9',
  zoomCycle: 'KeyC',
  respawnHint: 'KeyR',
  radio: 'KeyR',
};
