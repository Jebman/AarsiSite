// script.js — anniversary site (fade-ins + floating flowers + NoFly + TOC + Snake)
// Assumes you have: .background overlay, panels with id + data-title, and (optionally) the snake panel markup

document.addEventListener("DOMContentLoaded", () => {
  // ===== Fade/slide sections into view =====
  const contents = document.querySelectorAll(".content");
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); });
    },
    { threshold: 0.2 }
  );
  contents.forEach((c) => io.observe(c));

  // ===== NoFly manager: avoid spawning flowers over chosen elements =====
  // Usage:
  //   const nfId = NoFly.add('#snakeCanvas', { whenVisible: true, padding: 32, threshold: 0.6 });
  //   float.style.left = NoFly.randomLeftPercent({ span: 90 }) + "%";
  const NoFly = (() => {
    const zones = new Map(); // id -> {el, padding, whenVisible, threshold, active, range, observer}
    let idCounter = 0;

    const vw = () => window.innerWidth || document.documentElement.clientWidth;
    const pxToPct = (px) => (px / vw()) * 100;

    function computeRangeForEl(el, padding) {
      const r = el.getBoundingClientRect();
      const minPx = Math.max(0, r.left - padding);
      const maxPx = Math.min(vw(), r.right + padding);
      return [pxToPct(minPx), pxToPct(maxPx)];
    }

    function add(selectorOrEl, opts = {}) {
      const el = typeof selectorOrEl === "string" ? document.querySelector(selectorOrEl) : selectorOrEl;
      if (!el) return null;

      const id = `nf_${++idCounter}`;
      const zone = {
        el,
        padding: opts.padding ?? 24,
        whenVisible: opts.whenVisible !== false,
        threshold: opts.threshold ?? 0.55,
        active: !opts.whenVisible,
        range: [0, 0],
        observer: null,
      };

      if (zone.whenVisible) {
        zone.observer = new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (e.target === el) {
                zone.active = e.isIntersecting;
                if (zone.active) zone.range = computeRangeForEl(el, zone.padding);
              }
            }
          },
          { threshold: zone.threshold }
        );
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
      zones.forEach((z) => z.observer?.disconnect());
      zones.clear();
    }

    function updateAll() {
      zones.forEach((z) => {
        if (!z.whenVisible || z.active) z.range = computeRangeForEl(z.el, z.padding);
      });
    }

    function combinedRanges() {
      const active = [];
      zones.forEach((z) => { if (z.active) active.push([...z.range]); });
      if (!active.length) return [];
      active.sort((a, b) => a[0] - b[0]);
      const merged = [active[0]];
      for (let i = 1; i < active.length; i++) {
        const last = merged[merged.length - 1];
        const cur = active[i];
        if (cur[0] <= last[1]) last[1] = Math.max(last[1], cur[1]);
        else merged.push(cur);
      }
      return merged;
    }

    function randomLeftPercent({ maxTries = 8, span = 90 } = {}) {
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
      // fallback: snap just outside the largest blocked band
      const [a, b] = ranges.reduce((m, r) => (r[1] - r[0] > m[1] - m[0] ? r : m), ranges[0]);
      const leftSide = Math.max(0, a - 1);
      const rightSide = Math.min(span, b + 1);
      return Math.random() < 0.5 ? leftSide : rightSide;
    }

    window.addEventListener("resize", updateAll);
    window.addEventListener("scroll", updateAll, { passive: true });

    // expose
    return { add, remove, clear, updateAll, randomLeftPercent };
  })();
  // also expose globally for console debugging if you want
  window.NoFly = NoFly;

  // ===== Floating flowers =====
  const background = document.querySelector(".background");
  if (background) {
    const floatImages = [
      "resources/peonies1.png",
      "resources/peonies2.png",
      "resources/peonies3.png",
      "resources/peonies4.png",
      "resources/peonies5.png",
      "resources/IMG_7360.PNG"
    ];

    const MAX_FLOATS = 28;
    function currentFloatCount() { return background.querySelectorAll(".float").length; }

    function spawnImage() {
      if (currentFloatCount() >= MAX_FLOATS) return;

      // wrappers: float (Y) -> sway (X) -> spin (rotate)
      const float = document.createElement("div");
      float.className = "float";
      const sway = document.createElement("div");
      sway.className = "sway";
      const spin = document.createElement("div");
      spin.className = "spin";
      const img = document.createElement("img");

      img.src = floatImages[Math.floor(Math.random() * floatImages.length)];
      const size = 60 + Math.random() * 90; // 60–150px
      img.style.width = size + "px";

      float.style.left = NoFly.randomLeftPercent({ span: 90 }) + "%";

      const floatDuration = 15 + Math.random() * 15; // 15–30s
      const swayDuration = 4 + Math.random() * 6; // 4–10s
      const spinDuration = 20 + Math.random() * 40; // 20–60s

      float.style.animation = `floatUp ${floatDuration}s linear forwards`;
      sway.style.animation = `sway ${swayDuration}s ease-in-out infinite alternate`;
      spin.style.animation = `spin ${spinDuration}s linear infinite`;

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

  // ===== Build Table of Contents (Panel 2) =====
  const toc = document.getElementById("toc");
  if (toc) {
    const panels = [...document.querySelectorAll("section.panel[id][data-title]")].filter(
      (p) => p.id !== "panel2"
    );

    toc.innerHTML = panels
      .map((p) => `<a href="#${p.id}" data-target="${p.id}">${p.dataset.title}</a>`)
      .join("");

    const links = [...toc.querySelectorAll("a")];
    const linkById = new Map(links.map((a) => [a.dataset.target, a]));
    const activeSetter = (id) => {
      links.forEach((a) => a.classList.toggle("active", a.dataset.target === id));
    };

    const obs = new IntersectionObserver(
      (entries) => {
        let bestId = null,
          bestRatio = 0;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          if (e.intersectionRatio > bestRatio) {
            bestRatio = e.intersectionRatio;
            bestId = e.target.id;
          }
        }
        if (bestId && linkById.has(bestId)) activeSetter(bestId);
      },
      { threshold: [0.4, 0.6, 0.8] }
    );

    panels.forEach((p) => obs.observe(p));
    if (panels[0]) activeSetter(panels[0].id);
  }

  // ===== PHOTO SNAKE GAME =====
  const canvas = document.getElementById("snakeCanvas");
  if (canvas) {
    // keep flowers away from the canvas while visible
    NoFly.add("#snakeCanvas", { whenVisible: true, padding: 32, threshold: 0.6 });

    const ctx = canvas.getContext("2d", { alpha: true });

    // Configure your assets here (replace these with your actual files)
    const SNAKE_SOURCES = [
      "resources/IMG_7353.PNG",
      "resources/IMG_7354.PNG",
      "resources/IMG_7355.PNG",
      "resources/IMG_7358.PNG",
      "resources/IMG_7400.PNG",
      "resources/IMG_7402.PNG"
    ];
    const APPLE_SOURCES = [
      "resources/IMG_7386.PNG",
      "resources/IMG_7398.PNG",
      "resources/IMG_7399.PNG",
      "resources/IMG_7401.PNG"
    ];

    function preload(urls) {
      return Promise.all(
        urls.map(
          (src) =>
            new Promise((res, rej) => {
              const img = new Image();
              img.onload = () => res(img);
              img.onerror = () => rej(new Error("Failed to load " + src));
              img.src = src;
            })
        )
      );
    }

    // Grid / sizing (chunkier for legibility)
    const DPR = window.devicePixelRatio || 1;
    let COLS = 8,
      ROWS = 8; // fewer cells = bigger images
    let CELL = 32; // computed in fitCanvas()
    let OFFSET_X = 0,
      OFFSET_Y = 0;

    function fitCanvas() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * DPR);
      canvas.height = Math.round(rect.height * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.imageSmoothingEnabled = true;

      CELL = Math.floor(Math.min(rect.width / COLS, rect.height / ROWS));
      const gridW = CELL * COLS;
      const gridH = CELL * ROWS;
      OFFSET_X = Math.floor((rect.width - gridW) / 2);
      OFFSET_Y = Math.floor((rect.height - gridH) / 2);
    }
    fitCanvas();
    window.addEventListener("resize", () => {
      fitCanvas();
      draw();
    });

    // Game state
    let snake = [];
    let dir = { x: 1, y: 0 };
    let nextDir = { x: 1, y: 0 };
    let apple = { x: 10, y: 10, img: null };
    let score = 0;
    let best = Number(localStorage.getItem("snake.best") || 0);
    let running = false;
    let alive = true;
    let tickTimer = null;
    const TICK_MS = 120;
    let pendingGrowth = 0;

    // UI
    const scoreEl = document.getElementById("snakeScore");
    const bestEl = document.getElementById("snakeBest");
    const btnStart = document.getElementById("snakeStart");
    const btnPause = document.getElementById("snakePause");
    const btnReset = document.getElementById("snakeReset");
    if (bestEl) bestEl.textContent = best;

    // Helpers
    const randInt = (n) => Math.floor(Math.random() * n);

    function inSnake(x, y, { ignoreTail = false } = {}) {
      const upto = snake.length - (ignoreTail ? 1 : 0);
      for (let i = 0; i < upto; i++) if (snake[i].x === x && snake[i].y === y) return true;
      return false;
    }

    let SNAKE_IMAGES = [];
    let APPLE_IMAGES = [];
    const randomSnakeImg = () =>
      (SNAKE_IMAGES.length ? SNAKE_IMAGES[randInt(SNAKE_IMAGES.length)] : null);
    const randomAppleImg = () =>
      (APPLE_IMAGES.length ? APPLE_IMAGES[randInt(APPLE_IMAGES.length)] : null);

    function randomSnakeImgExcept(excepts = []) {
      if (!SNAKE_IMAGES.length) return null;
      const pool = SNAKE_IMAGES.filter((img) => !excepts.includes(img));
      const src = pool.length ? pool : SNAKE_IMAGES;
      return src[randInt(src.length)];
    }

    function placeApple() {
      let x, y;
      do {
        x = randInt(COLS);
        y = randInt(ROWS);
      } while (inSnake(x, y));
      apple.x = x;
      apple.y = y;
      apple.img = randomAppleImg();
    }

    function resetGame() {
      score = 0;
      if (scoreEl) scoreEl.textContent = "0";
      alive = true;
      pendingGrowth = 0;
      dir = { x: 1, y: 0 };
      nextDir = { x: 1, y: 0 };

      const cx = Math.floor(COLS / 2), cy = Math.floor(ROWS / 2);

      // start with ONE segment (random image)
      snake = [
        { x: cx, y: cy, img: randomSnakeImg() }
      ];

      placeApple();
      draw();
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
      if (bestEl) bestEl.textContent = best;

      const rect = canvas.getBoundingClientRect();
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 28px Segoe UI, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Game Over", rect.width / 2, rect.height / 2 - 10);
      ctx.font = "16px Segoe UI, Arial, sans-serif";
      ctx.fillText("Press Reset or Start", rect.width / 2, rect.height / 2 + 20);
      ctx.restore();
    }

    function tick() {
      if (!alive) return;

      // update direction (avoid instant reversal)
      if (nextDir.x !== -dir.x || nextDir.y !== -dir.y) dir = { ...nextDir };

      const curHead = snake[0];
      const newX = (curHead.x + dir.x + COLS) % COLS;
      const newY = (curHead.y + dir.y + ROWS) % ROWS;

      const willGrow = newX === apple.x && newY === apple.y;

      // allow stepping into tail if it's moving away (i.e., not growing)
      if (inSnake(newX, newY, { ignoreTail: !willGrow })) {
        const crashImg = randomSnakeImgExcept([curHead?.img, snake[1]?.img]);
        snake.unshift({ x: newX, y: newY, img: crashImg });
        draw();
        return gameOver();
      }

      // NEW HEAD: fresh random image (avoid last 1–2 head images for variety)
      const newHeadImg = randomSnakeImgExcept([curHead?.img, snake[1]?.img]);
      snake.unshift({ x: newX, y: newY, img: newHeadImg });

      // eat?
      if (willGrow) {
        score++;
        if (scoreEl) scoreEl.textContent = score;
        pendingGrowth++;
        placeApple();
      }

      // tail step
      const tailPrev = snake.pop();

      // apply growth by re-adding a new segment with a fresh random image
      if (pendingGrowth > 0) {
        pendingGrowth--;
        const growImg = randomSnakeImgExcept([tailPrev?.img]);
        snake.push({ x: tailPrev.x, y: tailPrev.y, img: growImg });
      }

      draw();
    }

    function draw() {
      const rect = canvas.getBoundingClientRect();
      const W = rect.width,
        H = rect.height;

      // clear
      ctx.clearRect(0, 0, W, H);

      // subtle grid
      const gridW = COLS * CELL;
      const gridH = ROWS * CELL;
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = "#fff";
      for (let x = 0; x <= COLS; x++) {
        const px = OFFSET_X + x * CELL + 0.5;
        ctx.beginPath();
        ctx.moveTo(px, OFFSET_Y);
        ctx.lineTo(px, OFFSET_Y + gridH);
        ctx.stroke();
      }
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
        ctx.drawImage(
          apple.img,
          OFFSET_X + apple.x * CELL,
          OFFSET_Y + apple.y * CELL,
          CELL,
          CELL
        );
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

    // ===== input (keyboard only) =====
    window.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", " "].includes(key)) {
        // optional: prevent page scroll if game panel is visible
        // e.preventDefault();
      }
      if (key === "arrowup" || key === "w") nextDir = { x: 0, y: -1 };
      else if (key === "arrowdown" || key === "s") nextDir = { x: 0, y: 1 };
      else if (key === "arrowleft" || key === "a") nextDir = { x: -1, y: 0 };
      else if (key === "arrowright" || key === "d") nextDir = { x: 1, y: 0 };
      else if (key === " ") running ? setRunning(false) : alive && setRunning(true);
    });

    // pause when panel not visible
    const panel4 = document.getElementById("panel4");
    if (panel4) {
      const visObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.target === panel4 && !e.isIntersecting && running) setRunning(false);
          });
        },
        { threshold: 0.6 }
      );
      visObserver.observe(panel4);
    }

    // boot: preload assets
    Promise.all([preload(SNAKE_SOURCES), preload(APPLE_SOURCES)])
      .then(([snakeImgs, appleImgs]) => {
        SNAKE_IMAGES = snakeImgs;
        APPLE_IMAGES = appleImgs;
        resetGame();
        // auto-run if panel is visible at load (optional)
        // setRunning(true);
        btnStart?.removeAttribute("disabled");
        btnPause?.removeAttribute("disabled");
        btnReset?.removeAttribute("disabled");
      })
      .catch((err) => {
        console.error(err);
        SNAKE_IMAGES = [];
        APPLE_IMAGES = [];
        resetGame();
      });

    // buttons
    btnStart?.addEventListener("click", () => {
      if (!alive) resetGame();
      setRunning(true);
      canvas.focus();
    });
    btnPause?.addEventListener("click", () => setRunning(!running));
    btnReset?.addEventListener("click", () => {
      resetGame();
      setRunning(false);
    });
  }
});
