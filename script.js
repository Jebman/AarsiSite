// script.js

document.addEventListener("DOMContentLoaded", () => {
  // ===== Fade-in sections =====
  const contents = document.querySelectorAll('.content');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.2 });
  contents.forEach(c => io.observe(c));

  // ===== Floating flowers =====
  const background = document.querySelector(".background");
  if (background) {
    const floatImages = [
      "resources/peonies1.jpg",
      "resources/peonies2.png",
      "resources/peonies3.jpg",
      "resources/peonies4.jpg",
      "resources/peonies5.jpg"
    ];

    function spawnImage() {
      // wrappers: float (Y) -> sway (X) -> spin (rotate)
      const float = document.createElement("div");
      float.className = "float";
      const sway  = document.createElement("div");
      sway.className = "sway";
      const spin  = document.createElement("div");
      spin.className = "spin";
      const img   = document.createElement("img");

      img.src = floatImages[Math.floor(Math.random() * floatImages.length)];
      const size = 60 + Math.random() * 90; // 60–150px
      img.style.width = size + "px";

      float.style.left = NoFly.randomLeftPercent({ span: 90 }) + "%";

      const floatDuration = 15 + Math.random() * 15; // 15–30s
      const swayDuration  = 4 + Math.random() * 6;   // 4–10s
      const spinDuration  = 20 + Math.random() * 40; // 20–60s

      float.style.animation = `floatUp ${floatDuration}s linear forwards`;
      sway.style.animation  = `sway ${swayDuration}s ease-in-out infinite alternate`;
      spin.style.animation  = `spin ${spinDuration}s linear infinite`;

      spin.appendChild(img);
      sway.appendChild(spin);
      float.appendChild(sway);
      background.appendChild(float);

      setTimeout(() => float.remove(), floatDuration * 1000);
    }

    // initial burst
    for (let i = 0; i < 5; i++) setTimeout(spawnImage, i * 500);
    // then every 2s
    setInterval(spawnImage, 2000);
  }

  // ===== Build Table of Contents from panels =====
  const toc = document.getElementById('toc');
  if (toc) {
    const panels = [...document.querySelectorAll('section.panel[id][data-title]')]
      .filter(p => p.id !== 'panel2'); // don't list the TOC panel itself

    toc.innerHTML = panels.map(p =>
      `<a href="#${p.id}" data-target="${p.id}">${p.dataset.title}</a>`
    ).join('');

    // active link highlight while scrolling
    const links = [...toc.querySelectorAll('a')];
    const linkById = new Map(links.map(a => [a.dataset.target, a]));

    const activeSetter = (id) => {
      links.forEach(a => a.classList.toggle('active', a.dataset.target === id));
    };

    const obs = new IntersectionObserver((entries) => {
      // pick the most visible intersecting panel
      let bestId = null, bestRatio = 0;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        if (e.intersectionRatio > bestRatio) {
          bestRatio = e.intersectionRatio;
          bestId = e.target.id;
        }
      }
      if (bestId && linkById.has(bestId)) activeSetter(bestId);
    }, { threshold: [0.4, 0.6, 0.8] });

    panels.forEach(p => obs.observe(p));

    // set active on initial load to the first target panel
    if (panels[0]) activeSetter(panels[0].id);
  }


  // ===== NoFly manager: avoid spawning flowers over chosen elements =====
  const NoFly = (() => {
    const zones = new Map(); // id -> {el, padding, whenVisible, threshold, active, range, observer}
    let idCounter = 0;

    const vw = () => (window.innerWidth || document.documentElement.clientWidth);
    const pxToPct = px => (px / vw()) * 100;

    function computeRangeForEl(el, padding) {
      const r = el.getBoundingClientRect();
      const minPx = Math.max(0, r.left - padding);
      const maxPx = Math.min(vw(), r.right + padding);
      return [ pxToPct(minPx), pxToPct(maxPx) ]; // percentages
    }

    function add(selectorOrEl, opts = {}) {
      const el = (typeof selectorOrEl === "string") ? document.querySelector(selectorOrEl) : selectorOrEl;
      if (!el) return null;

      const id = `nf_${++idCounter}`;
      const zone = {
        el,
        padding: opts.padding ?? 24,
        whenVisible: opts.whenVisible !== false,   // default: true (only active when element is visible)
        threshold: opts.threshold ?? 0.55,
        active: !opts.whenVisible,
        range: [0, 0],
        observer: null
      };

      if (zone.whenVisible) {
        zone.observer = new IntersectionObserver((entries) => {
          for (const e of entries) {
            if (e.target === el) {
              zone.active = e.isIntersecting;
              if (zone.active) zone.range = computeRangeForEl(el, zone.padding);
            }
          }
        }, { threshold: zone.threshold });
        zone.observer.observe(el);
      } else {
        zone.active = true;
        zone.range = computeRangeForEl(el, zone.padding);
      }

      zones.set(id, zone);
      return id;
    }

    function remove(id) {
      const z = zones.get(id);
      if (z?.observer) z.observer.disconnect();
      zones.delete(id);
    }

    function clear() {
      zones.forEach(z => z.observer?.disconnect());
      zones.clear();
    }

    function updateAll() {
      zones.forEach(z => {
        if (!z.whenVisible || z.active) z.range = computeRangeForEl(z.el, z.padding);
      });
    }

    function combinedRanges() {
      const active = [];
      zones.forEach(z => { if (z.active) active.push([...z.range]); });
      if (!active.length) return [];
      active.sort((a,b) => a[0] - b[0]);

      const merged = [active[0]];
      for (let i = 1; i < active.length; i++) {
        const last = merged[merged.length - 1];
        const cur = active[i];
        if (cur[0] <= last[1]) last[1] = Math.max(last[1], cur[1]); else merged.push(cur);
      }
      return merged;
    }

    function randomLeftPercent({ maxTries = 8, span = 90 } = {}) {
      // span < 100 keeps edges safe since images have width
      const ranges = combinedRanges();
      if (!ranges.length) return Math.random() * span;

      for (let t = 0; t < maxTries; t++) {
        const p = Math.random() * span;
        let blocked = false;
        for (const [a, b] of ranges) {
          if (p >= a && p <= b) { blocked = true; break; }
        }
        if (!blocked) return p;
      }
      // fallback: snap just outside the largest blocked range
      const [a, b] = ranges.reduce((m, r) => (r[1]-r[0] > m[1]-m[0] ? r : m), ranges[0]);
      const leftSide = Math.max(0, a - 1);
      const rightSide = Math.min(span, b + 1);
      return (Math.random() < 0.5) ? leftSide : rightSide;
    }

    window.addEventListener("resize", updateAll);
    window.addEventListener("scroll", updateAll, { passive: true });

    return { add, remove, clear, updateAll, randomLeftPercent };
  })();


  // ===== PHOTO SNAKE GAME =====
  const canvas = document.getElementById("snakeCanvas");
  if (!canvas) return; // only if panel 4 exists
  // Register a no-fly zone for the game canvas (only when the panel is visible)
  const nfSnake = NoFly.add('#snakeCanvas', { whenVisible: true, padding: 32, threshold: 0.6 });

  const ctx = canvas.getContext("2d", { alpha: true });

  // ——— configure assets ———
  // Snake segment textures (random per added segment):
  const SNAKE_SOURCES = [
    "resources/peonies1.jpg",
    "resources/peonies2.png",
    "resources/peonies3.jpg",
    "resources/peonies4.jpg",
    "resources/peonies5.jpg"
  ];
  // Apple textures (different list):
  const APPLE_SOURCES = [
    "resources/peonies1.jpg",
    "resources/peonies2.png",
    "resources/peonies3.jpg",
    "resources/peonies4.jpg",
    "resources/peonies5.jpg"
  ];

  function preload(urls) {
    return Promise.all(urls.map(src =>
      new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => rej(new Error("Failed to load " + src));
        img.src = src;
      })
    ));
  }

  // ——— sizing / grid ———
  const DPR = window.devicePixelRatio || 1;
  // Fewer cells = larger segments. Tweak GRID to taste (12–16 are nice).
  let COLS = 14, ROWS = 14;
  let CELL = 32;   // computed in fitCanvas()
  let OFFSET_X = 0, OFFSET_Y = 0;

  function fitCanvas() {
    // match css size (set in CSS), then scale for DPR
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.round(rect.width  * DPR);
    canvas.height = Math.round(rect.height * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true;
    // Choose an integer cell that fits the canvas and center the grid for crisp edges
    CELL = Math.floor(Math.min(rect.width / COLS, rect.height / ROWS));
    const gridW = CELL * COLS;
    const gridH = CELL * ROWS;

    // Center the grid inside the canvas
    OFFSET_X = Math.floor((rect.width  - gridW) / 2);
    OFFSET_Y = Math.floor((rect.height - gridH) / 2);
  }
  fitCanvas();
  window.addEventListener('resize', () => { fitCanvas(); draw(); });

  // ——— game state ———
  let snake = [];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let apple = { x: 10, y: 10, img: null };
  let score = 0;
  let best = Number(localStorage.getItem("snake.best") || 0);
  let running = false;
  let alive = true;
  let pendingGrowth = 0;
  let tickTimer = null;
  const TICK_MS = 120;

  // UI
  const scoreEl = document.getElementById("snakeScore");
  const bestEl  = document.getElementById("snakeBest");
  const btnStart = document.getElementById("snakeStart");
  const btnPause = document.getElementById("snakePause");
  const btnReset = document.getElementById("snakeReset");
  bestEl.textContent = best;

  // ——— helpers ———
  const randInt = (n) => Math.floor(Math.random() * n);
  const inSnake = (x, y) => snake.some(seg => seg.x === x && seg.y === y);

  let SNAKE_IMAGES = [];
  let APPLE_IMAGES = [];

  function randomSnakeImg() { return SNAKE_IMAGES[randInt(SNAKE_IMAGES.length)]; }
  function randomAppleImg() { return APPLE_IMAGES[randInt(APPLE_IMAGES.length)]; }

  function placeApple() {
    let x, y;
    do {
      x = randInt(COLS);
      y = randInt(ROWS);
    } while (inSnake(x, y));
    apple.x = x; apple.y = y; apple.img = randomAppleImg();
  }

  function resetGame() {
    score = 0;
    scoreEl.textContent = "0";
    alive = true;
    pendingGrowth = 0;
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    // center snake with 4 segments
    const cx = Math.floor(COLS / 2), cy = Math.floor(ROWS / 2);
    snake = [
      { x: cx,     y: cy, img: randomSnakeImg() },
      { x: cx - 1, y: cy, img: randomSnakeImg() },
      { x: cx - 2, y: cy, img: randomSnakeImg() },
      { x: cx - 3, y: cy, img: randomSnakeImg() }
    ];
    placeApple();
    draw(); // initial frame
  }

  function setRunning(on) {
    if (on && !running) {
      running = true;
      tickTimer = setInterval(tick, TICK_MS);
    } else if (!on && running) {
      running = false;
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function gameOver() {
    alive = false;
    setRunning(false);
    best = Math.max(best, score);
    localStorage.setItem("snake.best", String(best));
    bestEl.textContent = best;
    // faint overlay
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, canvas.width / DPR, canvas.height / DPR);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 28px Segoe UI, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Game Over", canvas.width / (2*DPR), canvas.height / (2*DPR) - 10);
    ctx.font = "16px Segoe UI, Arial, sans-serif";
    ctx.fillText("Press Reset or Start", canvas.width / (2*DPR), canvas.height / (2*DPR) + 20);
    ctx.restore();
  }

  function tick() {
    if (!alive) return;

    // update direction (avoid instant reversal)
    if ((nextDir.x !== -dir.x) || (nextDir.y !== -dir.y)) {
      dir = { ...nextDir };
    }

    // new head with same image as previous head (so segment textures "move" with the body)
    const head = { ...snake[0] };
    head.x = (head.x + dir.x + COLS) % COLS;
    head.y = (head.y + dir.y + ROWS) % ROWS;

    // self-collision?
    if (inSnake(head.x, head.y)) {
      snake.unshift(head); // draw the collision frame
      draw();
      return gameOver();
    }

    snake.unshift(head); // move

    const ate = (head.x === apple.x && head.y === apple.y);
    if (ate) {
      score++;
      scoreEl.textContent = score;
      pendingGrowth++;
      placeApple();
    }

    // pop tail; if growth pending, re-add a segment at previous tail cell with a random image
    const tailPrev = snake.pop();
    if (pendingGrowth > 0) {
      pendingGrowth--;
      snake.push({ x: tailPrev.x, y: tailPrev.y, img: randomSnakeImg() });
    }

    draw();
  }

  function draw() {
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;

    // clear
    ctx.clearRect(0, 0, W, H);

    // grid (subtle)
    const gridW = COLS * CELL;
    const gridH = ROWS * CELL;

    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = "#fff";

    // vertical lines
    for (let x = 0; x <= COLS; x++) {
      const px = OFFSET_X + x * CELL + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, OFFSET_Y);
      ctx.lineTo(px, OFFSET_Y + gridH);
      ctx.stroke();
    }
    // horizontal lines
    for (let y = 0; y <= ROWS; y++) {
      const py = OFFSET_Y + y * CELL + 0.5;
      ctx.beginPath();
      ctx.moveTo(OFFSET_X, py);
      ctx.lineTo(OFFSET_X + gridW, py);
      ctx.stroke();
    }
    ctx.restore();

    // apple
    if (apple.img) {
      ctx.drawImage(apple.img, OFFSET_X + apple.x * CELL, OFFSET_Y + apple.y * CELL, CELL, CELL);
    }

    // snake
    for (let i = snake.length - 1; i >= 0; i--) {
      const s = snake[i];
      const x = OFFSET_X + s.x * CELL;
      const y = OFFSET_Y + s.y * CELL;

      if (s.img && s.img.complete) {
        ctx.drawImage(s.img, x, y, CELL, CELL);
      } else {
        ctx.fillStyle = i === 0 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.7)";
        ctx.fillRect(x, y, CELL, CELL);
      }
    }
  }


  // ——— input ———
  function setDir(dx, dy) {
    nextDir = { x: dx, y: dy };
  }

  window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d"," "].includes(key)) {
      // prevent page scrolling if the game panel is visible
      if (isPanelVisible()) e.preventDefault();
    }
    if (key === "arrowup" || key === "w") setDir(0, -1);
    else if (key === "arrowdown" || key === "s") setDir(0, 1);
    else if (key === "arrowleft" || key === "a") setDir(-1, 0);
    else if (key === "arrowright" || key === "d") setDir(1, 0);
    else if (key === " ") { // space toggles pause
      if (running) setRunning(false); else if (alive) setRunning(true);
    }
  });

  // touch swipe
  let touchStart = null;
  canvas.addEventListener("touchstart", (e) => {
    if (!running && alive) setRunning(true);
    touchStart = e.touches[0];
  }, { passive: true });

  canvas.addEventListener("touchmove", (e) => {
    if (!touchStart) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.clientX;
    const dy = t.clientY - touchStart.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 24) {
      if (Math.abs(dx) > Math.abs(dy)) setDir(Math.sign(dx), 0);
      else setDir(0, Math.sign(dy));
      touchStart = null;
    }
  }, { passive: true });

  // buttons
  btnStart?.addEventListener("click", () => {
    if (!alive) resetGame();
    setRunning(true);
    canvas.focus();
  });
  btnPause?.addEventListener("click", () => setRunning(!running));
  btnReset?.addEventListener("click", () => { resetGame(); setRunning(false); });

  // ——— pause when panel not visible ———
  const panel4 = document.getElementById("panel4");
  function isPanelVisible() {
    if (!panel4) return false;
    const rect = panel4.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    // visible if >60% of panel height in view
    const visible = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
    return (visible / Math.min(vh, rect.height)) > 0.6;
  }
  const visObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.target === panel4) {
        if (!e.isIntersecting && running) setRunning(false);
      }
    });
  }, { threshold: 0.6 });
  visObserver.observe(panel4);

  // ——— boot —— preload assets then enable UI —— 
  Promise.all([preload(SNAKE_SOURCES), preload(APPLE_SOURCES)])
    .then(([snakeImgs, appleImgs]) => {
      SNAKE_IMAGES = snakeImgs;
      APPLE_IMAGES = appleImgs;
      resetGame();               // ready frame
      // optional: auto-run when panel is on screen
      if (isPanelVisible()) setRunning(true);
      btnStart?.removeAttribute("disabled");
      btnPause?.removeAttribute("disabled");
      btnReset?.removeAttribute("disabled");
    })
    .catch((err) => {
      console.error(err);
      // If images fail, still allow a basic colored snake
      SNAKE_IMAGES = [];
      APPLE_IMAGES = [];
      resetGame();
    });
});
