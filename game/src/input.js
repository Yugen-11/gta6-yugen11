// Palmar Bay — keyboard and mouse input. Keys are a live set the game
// reads each frame; the mouse feeds an orbit camera, through pointer lock
// when the player clicks the canvas, or by dragging when lock is refused
// (as in a headless browser or a screenshot run).

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // keys pressed since the last frame was read
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mouseClicked = false; // left button pressed since last read
    this.locked = false;
    this.wheelDelta = 0;

    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.keys.add(event.code);
      this.pressed.add(event.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        event.preventDefault();
      }
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      // A key pressed before the blur must not fire as a fresh press when
      // the window comes back.
      this.pressed.clear();
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    canvas.addEventListener('mousedown', (event) => {
      if (event.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
        if (!this.locked) {
          try {
            canvas.requestPointerLock();
          } catch {
            // Pointer lock is a nicety; drag-orbit still works without it.
          }
        }
      }
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown = false;
    });
    window.addEventListener('mousemove', (event) => {
      if (this.locked) {
        this.mouseDX += event.movementX;
        this.mouseDY += event.movementY;
      } else if (this.mouseDown) {
        this.mouseDX += event.movementX;
        this.mouseDY += event.movementY;
      }
    });
    canvas.addEventListener('wheel', (event) => {
      this.wheelDelta += event.deltaY;
      event.preventDefault();
    }, { passive: false });
  }

  isDown(code) {
    return this.keys.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  // Call once per frame, after the game has read the input.
  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseClicked = false;
    this.wheelDelta = 0;
  }
}
