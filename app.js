const state = {
  pointer: { x: 0.5, y: 0.5, px: 0, py: 0 },
  motion: false,
  tilt: 0,
  fps: 60
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const renderScale = Math.min(window.devicePixelRatio || 1, 1.35);

function fitCanvas(canvas, scale = renderScale) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width * scale));
  const height = Math.max(1, Math.floor(rect.height * scale));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height, scale };
}

function createVisibilityTracker(element, rootMargin = "180px") {
  const tracker = { visible: true };
  if (!("IntersectionObserver" in window) || !element) return tracker;
  const observer = new IntersectionObserver(([entry]) => {
    tracker.visible = entry.isIntersecting;
  }, { rootMargin });
  observer.observe(element);
  return tracker;
}

function setupPointer() {
  const glow = document.querySelector(".cursor-light");
  window.addEventListener("pointermove", (event) => {
    state.pointer.px = event.clientX;
    state.pointer.py = event.clientY;
    state.pointer.x = event.clientX / window.innerWidth;
    state.pointer.y = event.clientY / window.innerHeight;
    glow.style.left = `${event.clientX}px`;
    glow.style.top = `${event.clientY}px`;
  }, { passive: true });
}

function setupHeroParticles() {
  const canvas = document.querySelector("#starfield");
  const ctx = canvas.getContext("2d");
  const visibility = createVisibilityTracker(document.querySelector(".hero"));
  const particles = Array.from({ length: 128 }, (_, i) => ({
    x: Math.random(),
    y: Math.random(),
    z: Math.random() * 0.8 + 0.2,
    speed: 0.0015 + Math.random() * 0.003,
    hue: i % 3
  }));
  const nodesEl = document.querySelector("#nodes");
  nodesEl.textContent = String(particles.length);

  function draw() {
    if (!visibility.visible || document.hidden) {
      requestAnimationFrame(draw);
      return;
    }
    const { width, height } = fitCanvas(canvas);
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";
    const cx = width * (0.45 + (state.pointer.x - 0.5) * 0.08);
    const cy = height * (0.5 + (state.pointer.y - 0.5) * 0.08);
    for (const p of particles) {
      p.y -= p.speed * (state.motion ? 2.1 : 1);
      p.x += Math.sin((p.y + p.z) * 10) * 0.0008;
      if (p.y < -0.08) {
        p.y = 1.08;
        p.x = Math.random();
      }
      const depth = 1 / p.z;
      const x = lerp(p.x * width, cx, 0.08 * depth);
      const y = lerp(p.y * height, cy, 0.03 * depth);
      const size = (1.2 + 2.8 * depth) * (state.motion ? 1.18 : 1);
      const color = p.hue === 0 ? "56, 232, 255" : p.hue === 1 ? "255, 111, 125" : "255, 209, 102";
      ctx.fillStyle = `rgba(${color}, ${0.35 + 0.35 * p.z})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(${color}, 0.15)`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - (state.pointer.x - 0.5) * 90 * depth, y - 42 * depth);
      ctx.stroke();
    }
    requestAnimationFrame(draw);
  }
  draw();
}

function setupShader() {
  const canvas = document.querySelector("#shader-canvas");
  const speed = document.querySelector("#shader-speed");
  const visibility = createVisibilityTracker(canvas);
  const gl = canvas.getContext("webgl", { antialias: true });
  if (!gl) return;

  const vert = `
    attribute vec2 position;
    void main() { gl_Position = vec4(position, 0.0, 1.0); }
  `;
  const frag = `
    precision highp float;
    uniform vec2 u_res;
    uniform vec2 u_mouse;
    uniform float u_time;
    uniform float u_speed;

    float wave(vec2 p, float t) {
      return sin(p.x * 7.0 + t) + sin(p.y * 9.0 - t * 0.7) + sin((p.x + p.y) * 5.0 + t * 1.3);
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
      vec2 mouse = (u_mouse - 0.5) * vec2(1.6, -1.2);
      float t = u_time * u_speed;
      float d = length(uv - mouse);
      float r = sin(18.0 * d - t * 4.0);
      float f = wave(uv * 1.35 + r * 0.04, t);
      vec3 a = vec3(0.04, 0.12, 0.20);
      vec3 b = vec3(0.06, 0.92, 1.0);
      vec3 c = vec3(1.0, 0.30, 0.42);
      vec3 g = vec3(1.0, 0.78, 0.24);
      float glow = smoothstep(0.55, 0.0, d) * 0.75;
      vec3 col = mix(a, b, smoothstep(-2.2, 2.2, f));
      col = mix(col, c, smoothstep(0.0, 1.0, sin(f + t) * 0.5 + 0.5) * 0.35);
      col += g * pow(max(0.0, r), 8.0) * 0.35 + b * glow;
      col *= 1.0 - length(uv) * 0.55;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vert));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(program);
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniforms = {
    res: gl.getUniformLocation(program, "u_res"),
    mouse: gl.getUniformLocation(program, "u_mouse"),
    time: gl.getUniformLocation(program, "u_time"),
    speed: gl.getUniformLocation(program, "u_speed")
  };

  function draw(time) {
    if (!visibility.visible || document.hidden) {
      requestAnimationFrame(draw);
      return;
    }
    const { width, height } = fitCanvas(canvas);
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uniforms.res, width, height);
    gl.uniform2f(uniforms.mouse, state.pointer.x, state.pointer.y);
    gl.uniform1f(uniforms.time, time * 0.001);
    gl.uniform1f(uniforms.speed, Number(speed.value));
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

function setupAudio() {
  const canvas = document.querySelector("#audio-canvas");
  const ctx = canvas.getContext("2d");
  const visibility = createVisibilityTracker(canvas);
  const toggle = document.querySelector("#audio-toggle");
  const randomTone = document.querySelector("#random-tone");
  let audioCtx;
  let analyser;
  let gain;
  let oscillators = [];
  let active = false;
  let hue = 190;
  const bins = new Uint8Array(96);

  function createSynth() {
    audioCtx = audioCtx || new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    gain = audioCtx.createGain();
    gain.gain.value = 0.055;
    oscillators = [110, 165, 220].map((freq, index) => {
      const osc = audioCtx.createOscillator();
      osc.type = index === 0 ? "sine" : index === 1 ? "triangle" : "sawtooth";
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start();
      return osc;
    });
    gain.connect(analyser);
    analyser.connect(audioCtx.destination);
  }

  toggle.addEventListener("click", async () => {
    if (!audioCtx) createSynth();
    active = !active;
    gain.gain.setTargetAtTime(active ? 0.055 : 0.0001, audioCtx.currentTime, 0.04);
    toggle.textContent = active ? "Ⅱ" : "▶";
    if (audioCtx.state === "suspended") await audioCtx.resume();
  });

  randomTone.addEventListener("click", () => {
    if (!audioCtx) createSynth();
    hue = Math.floor(150 + Math.random() * 160);
    const base = 82 + Math.random() * 120;
    oscillators.forEach((osc, index) => {
      osc.frequency.setTargetAtTime(base * (index + 1.2), audioCtx.currentTime, 0.08);
      osc.type = ["sine", "triangle", "sawtooth", "square"][Math.floor(Math.random() * 4)];
    });
  });

  function draw(time) {
    if (!visibility.visible || document.hidden) {
      requestAnimationFrame(draw);
      return;
    }
    const { width, height } = fitCanvas(canvas);
    ctx.clearRect(0, 0, width, height);
    if (analyser) analyser.getByteFrequencyData(bins);
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.19;
    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < bins.length; i++) {
      const value = analyser ? bins[i] / 255 : (Math.sin(time * 0.002 + i) + 1) * 0.25;
      const angle = (i / bins.length) * Math.PI * 2;
      const length = radius * (0.28 + value * 1.55);
      ctx.strokeStyle = `hsla(${hue + i * 1.6}, 95%, ${58 + value * 20}%, ${0.35 + value * 0.65})`;
      ctx.lineWidth = 2 + value * 6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      ctx.lineTo(Math.cos(angle) * (radius + length), Math.sin(angle) * (radius + length));
      ctx.stroke();
    }
    const pulse = analyser ? bins.reduce((a, b) => a + b, 0) / bins.length / 255 : 0.25;
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * (1.8 + pulse));
    grad.addColorStop(0, `hsla(${hue}, 95%, 70%, 0.7)`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius * (1.8 + pulse), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

function setupPhysics() {
  const canvas = document.querySelector("#physics-canvas");
  const ctx = canvas.getContext("2d");
  const visibility = createVisibilityTracker(canvas);
  const reset = document.querySelector("#reset-physics");
  let nodes = [];
  let dragging = null;

  function seed() {
    nodes = Array.from({ length: 18 }, (_, i) => ({
      x: 0.2 + Math.random() * 0.6,
      y: 0.18 + Math.random() * 0.64,
      vx: (Math.random() - 0.5) * 0.006,
      vy: (Math.random() - 0.5) * 0.006,
      r: 8 + (i % 4) * 2,
      c: i % 3
    }));
  }
  seed();
  reset.addEventListener("click", seed);

  canvas.addEventListener("pointerdown", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    dragging = nodes.find((n) => Math.hypot(n.x - x, n.y - y) < 0.07);
    if (dragging) canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    dragging.x = clamp((event.clientX - rect.left) / rect.width, 0.04, 0.96);
    dragging.y = clamp((event.clientY - rect.top) / rect.height, 0.06, 0.94);
    dragging.vx = 0;
    dragging.vy = 0;
  });

  window.addEventListener("pointerup", () => {
    dragging = null;
  });

  function draw() {
    if (!visibility.visible || document.hidden) {
      requestAnimationFrame(draw);
      return;
    }
    const { width, height } = fitCanvas(canvas);
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 0.38) {
          const force = (0.18 - dist) * 0.0007;
          a.vx -= dx * force;
          a.vy -= dy * force;
          b.vx += dx * force;
          b.vy += dy * force;
          ctx.strokeStyle = `rgba(56, 232, 255, ${0.27 - dist * 0.42})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x * width, a.y * height);
          ctx.lineTo(b.x * width, b.y * height);
          ctx.stroke();
        }
      }
    }
    for (const n of nodes) {
      if (n !== dragging) {
        n.vx += (0.5 - n.x) * 0.00008 + (state.pointer.x - 0.5) * 0.00004;
        n.vy += (0.5 - n.y) * 0.00008 + (state.pointer.y - 0.5) * 0.00004;
        n.x += n.vx;
        n.y += n.vy;
        n.vx *= 0.985;
        n.vy *= 0.985;
      }
      if (n.x < 0.04 || n.x > 0.96) n.vx *= -0.8;
      if (n.y < 0.06 || n.y > 0.94) n.vy *= -0.8;
      n.x = clamp(n.x, 0.04, 0.96);
      n.y = clamp(n.y, 0.06, 0.94);
      const color = n.c === 0 ? "56, 232, 255" : n.c === 1 ? "255, 111, 125" : "255, 209, 102";
      ctx.fillStyle = `rgba(${color}, 0.92)`;
      ctx.shadowColor = `rgba(${color}, 0.8)`;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(n.x * width, n.y * height, n.r * renderScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    requestAnimationFrame(draw);
  }
  draw();
}

function setupDataCanvas() {
  const canvas = document.querySelector("#data-canvas");
  const ctx = canvas.getContext("2d");
  const visibility = createVisibilityTracker(canvas);
  const values = Array.from({ length: 80 }, () => Math.random());

  function draw(time) {
    if (!visibility.visible || document.hidden) {
      requestAnimationFrame(draw);
      return;
    }
    const { width, height } = fitCanvas(canvas);
    values.shift();
    values.push(clamp(values.at(-1) + (Math.random() - 0.48) * 0.16, 0.08, 0.96));
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const y = (i / 7) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "#38e8ff");
    gradient.addColorStop(0.48, "#ffd166");
    gradient.addColorStop(1, "#ff6f7d");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 4 * renderScale;
    ctx.beginPath();
    values.forEach((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - value * height * 0.82 - height * 0.09 + Math.sin(time * 0.002 + index) * 7;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    values.forEach((value, index) => {
      if (index % 9 !== 0) return;
      const x = (index / (values.length - 1)) * width;
      const y = height - value * height * 0.82 - height * 0.09;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(x, y, 3.2 * renderScale, 0, Math.PI * 2);
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

function setupMathCurves() {
  const mainCanvas = document.querySelector("#curve-main");
  if (!mainCanvas) return;
  const mainCtx = mainCanvas.getContext("2d");
  const curveName = document.querySelector("#curve-name");
  const curveFormula = document.querySelector("#curve-formula");
  const speedInput = document.querySelector("#curve-speed");
  const particleInput = document.querySelector("#curve-particles");
  const trailInput = document.querySelector("#curve-trail");
  const controlsPanel = document.querySelector(".curve-controls");
  const specificControls = document.querySelector("#curve-specific-controls");
  const paramGrid = document.querySelector("#curve-param-grid");
  const paramReset = document.querySelector("#curve-params-reset");
  const cards = [...document.querySelectorAll(".curve-card")];
  const cardsContainer = document.querySelector(".curve-cards");
  const prevButton = document.querySelector("#curve-prev");
  const nextButton = document.querySelector("#curve-next");
  const pageStatus = document.querySelector("#curve-page-status");
  const visibility = createVisibilityTracker(document.querySelector("#curves"), "40px");
  let activeKey = "rose";
  let currentPage = 0;
  let lastMiniDraw = 0;

  const curves = {
    rose: {
      name: "Rose Orbit",
      formula: "r = a cos(kθ)",
      colorA: [56, 232, 255],
      colorB: [255, 209, 102],
      point(t, pulse) {
        const a = 0.44 + pulse * 0.08;
        const k = 5;
        const r = a * Math.cos(k * t);
        return [Math.cos(t) * r, Math.sin(t) * r];
      }
    },
    lissajous: {
      name: "Lissajous Drift",
      formula: "x = A sin(3t + π/2), y = A sin(4t)",
      colorA: [109, 255, 180],
      colorB: [56, 232, 255],
      point(t, pulse) {
        const a = 0.56 + pulse * 0.08;
        return [Math.sin(3 * t + Math.PI / 2) * a, Math.sin(4 * t) * a * 0.86];
      }
    },
    hypotrochoid: {
      name: "Hypotrochoid",
      formula: "x = (R-r)cos t + d cos((R-r)t/r)",
      colorA: [255, 111, 125],
      colorB: [56, 232, 255],
      point(t, pulse) {
        const R = 0.58;
        const r = 0.19;
        const d = 0.34 + pulse * 0.08;
        return [
          (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t),
          (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t)
        ];
      }
    },
    cardioid: {
      name: "Cardioid Pulse",
      formula: "r = a(1 - cos θ)",
      colorA: [255, 209, 102],
      colorB: [255, 111, 125],
      point(t, pulse) {
        const r = (0.22 + pulse * 0.04) * (1 - Math.cos(t));
        return [Math.cos(t) * r, Math.sin(t) * r];
      }
    },
    cassini: {
      name: "Cassini Oval",
      formula: "r² = a² cos(2θ) ± √(b⁴ - a⁴ sin²(2θ))",
      colorA: [255, 111, 125],
      colorB: [109, 255, 180],
      point(t, pulse) {
        const r = 0.42 + 0.18 * Math.cos(2 * t) + pulse * 0.05 * Math.sin(6 * t);
        return [Math.cos(t) * r, Math.sin(t) * r * 0.72];
      }
    },
    fourier: {
      name: "Fourier Ribbon",
      formula: "Σ sin(nt)/n + cos((n+1)t)/n",
      colorA: [56, 232, 255],
      colorB: [255, 111, 125],
      point(t, pulse) {
        let x = 0;
        let y = 0;
        for (let n = 1; n <= 5; n++) {
          x += Math.sin(n * t) / n;
          y += Math.cos((n + 1) * t + pulse) / n;
        }
        return [x * 0.26, y * 0.26];
      }
    },
    thinking7: {
      name: "Original Thinking",
      formula: "x = R cos(t) - a cos(7t), y = R sin(t) - a sin(7t)",
      colorA: [109, 255, 180],
      colorB: [255, 111, 125],
      point(t, pulse) {
        const detail = 0.15 + pulse * 0.035;
        return [0.42 * Math.cos(t) - detail * Math.cos(7 * t), 0.42 * Math.sin(t) - detail * Math.sin(7 * t)];
      }
    },
    thinking5: {
      name: "Thinking Five",
      formula: "x = R cos(t) - a cos(5t), y = R sin(t) - a sin(5t)",
      colorA: [56, 232, 255],
      colorB: [109, 255, 180],
      point(t, pulse) {
        const detail = 0.17 + pulse * 0.03;
        return [0.4 * Math.cos(t) - detail * Math.cos(5 * t), 0.4 * Math.sin(t) - detail * Math.sin(5 * t)];
      }
    },
    thinking9: {
      name: "Thinking Nine",
      formula: "x = R cos(t) - a cos(9t), y = R sin(t) - a sin(9t)",
      colorA: [255, 209, 102],
      colorB: [56, 232, 255],
      point(t, pulse) {
        const detail = 0.13 + pulse * 0.035;
        return [0.43 * Math.cos(t) - detail * Math.cos(9 * t), 0.43 * Math.sin(t) - detail * Math.sin(9 * t)];
      }
    },
    roseCurve: {
      name: "Rose Curve",
      formula: "r = a sin(7t)",
      colorA: [255, 111, 125],
      colorB: [255, 209, 102],
      point(t, pulse) {
        const r = (0.48 + pulse * 0.05) * Math.sin(7 * t);
        return [r * Math.cos(t), r * Math.sin(t)];
      }
    },
    rose2: {
      name: "Rose Two",
      formula: "r = a cos(2t)",
      colorA: [109, 255, 180],
      colorB: [56, 232, 255],
      point(t, pulse) {
        const r = (0.5 + pulse * 0.045) * Math.cos(2 * t);
        return [r * Math.cos(t), r * Math.sin(t)];
      }
    },
    rose3: {
      name: "Rose Three",
      formula: "r = a cos(3t)",
      colorA: [56, 232, 255],
      colorB: [255, 111, 125],
      point(t, pulse) {
        const r = (0.5 + pulse * 0.045) * Math.cos(3 * t);
        return [r * Math.cos(t), r * Math.sin(t)];
      }
    },
    rose4: {
      name: "Rose Four",
      formula: "r = a cos(4t)",
      colorA: [255, 209, 102],
      colorB: [109, 255, 180],
      point(t, pulse) {
        const r = (0.48 + pulse * 0.05) * Math.cos(4 * t);
        return [r * Math.cos(t), r * Math.sin(t)];
      }
    },
    lemniscate: {
      name: "Lemniscate Bloom",
      formula: "x = a cos(t)/(1 + sin²t), y = a sin(t)cos(t)/(1 + sin²t)",
      colorA: [255, 111, 125],
      colorB: [56, 232, 255],
      point(t, pulse) {
        const denominator = 1 + Math.sin(t) ** 2;
        const a = 0.62 + pulse * 0.05;
        return [a * Math.cos(t) / denominator, a * Math.sin(t) * Math.cos(t) / denominator];
      }
    },
    spiral3: {
      name: "Three-Petal Spiral",
      formula: "r = a + b cos(3t)",
      colorA: [109, 255, 180],
      colorB: [255, 209, 102],
      point(t, pulse) {
        const r = 0.3 + (0.2 + pulse * 0.035) * Math.cos(3 * t);
        return [r * Math.cos(t), r * Math.sin(t)];
      }
    },
    spiral4: {
      name: "Four-Petal Spiral",
      formula: "r = a + b cos(4t)",
      colorA: [56, 232, 255],
      colorB: [255, 209, 102],
      point(t, pulse) {
        const r = 0.3 + (0.2 + pulse * 0.035) * Math.cos(4 * t);
        return [r * Math.cos(t), r * Math.sin(t)];
      }
    },
    spiral5: {
      name: "Five-Petal Spiral",
      formula: "r = a + b cos(5t)",
      colorA: [255, 111, 125],
      colorB: [109, 255, 180],
      point(t, pulse) {
        const r = 0.3 + (0.2 + pulse * 0.035) * Math.cos(5 * t);
        return [r * Math.cos(t), r * Math.sin(t)];
      }
    },
    spiral6: {
      name: "Six-Petal Spiral",
      formula: "r = a + b cos(6t)",
      colorA: [255, 209, 102],
      colorB: [255, 111, 125],
      point(t, pulse) {
        const r = 0.3 + (0.2 + pulse * 0.035) * Math.cos(6 * t);
        return [r * Math.cos(t), r * Math.sin(t)];
      }
    },
    butterfly: {
      name: "Butterfly Phase",
      formula: "x = sin(t)B(t), y = cos(t)B(t)",
      colorA: [109, 255, 180],
      colorB: [255, 111, 125],
      point(t, pulse) {
        const angle = t * 4;
        const wing = Math.exp(Math.cos(angle)) - 2 * Math.cos(4 * angle) - Math.sin(angle / 12) ** 5;
        const scale = 0.115 + pulse * 0.006;
        return [Math.sin(angle) * wing * scale, Math.cos(angle) * wing * scale];
      }
    },
    cardioidHeart: {
      name: "Cardioid Heart",
      formula: "x = a sin³(t), y = b cos(t) - c cos(2t) - d cos(3t)",
      colorA: [255, 111, 125],
      colorB: [255, 209, 102],
      point(t, pulse) {
        const breathe = 0.9 + pulse * 0.1;
        return [0.5 * Math.sin(t) ** 3 * breathe, (0.38 * Math.cos(t) - 0.15 * Math.cos(2 * t) - 0.07 * Math.cos(3 * t)) * breathe];
      }
    },
    heartWave: {
      name: "Heart Wave",
      colorA: [255, 255, 255],
      colorB: [132, 140, 152],
      rotate: false,
      pathWeight: 1.35,
      params: {
        stroke: 6,
        b: 12,
        root: 2.2,
        waveAmp: 0.9,
        scaleX: 14,
        scaleY: 14
      },
      controls: [
        { key: "stroke", label: "Stroke", min: 1.5, max: 6, step: 0.1 },
        { key: "b", label: "b", min: 2, max: 12, step: 0.1 },
        { key: "root", label: "Root span", min: 2.2, max: 4.2, step: 0.05 },
        { key: "waveAmp", label: "Wave amp", min: 0.3, max: 1.6, step: 0.05 },
        { key: "scaleX", label: "X scale", min: 14, max: 30, step: 0.1 },
        { key: "scaleY", label: "Y scale", min: 14, max: 34, step: 0.1 }
      ],
      formula(params) {
        return `f(x) = |x|^(2/3) + ${params.waveAmp.toFixed(2)}√(${params.root.toFixed(2)} - x²) sin(${params.b.toFixed(1)}πx)`;
      },
      point(t, pulse) {
        const progress = t / (Math.PI * 2);
        const xLimit = Math.sqrt(this.params.root);
        const x = -xLimit + progress * xLimit * 2;
        const safeRoot = Math.max(0, this.params.root - x * x);
        const wave = this.params.waveAmp * Math.sqrt(safeRoot) * Math.sin(this.params.b * Math.PI * x);
        const y = Math.pow(Math.abs(x), 2 / 3) + wave;
        const screenX = 50 + x * this.params.scaleX;
        const screenY = 18 + (1.75 - y) * (this.params.scaleY + pulse * 1.5);
        return [(screenX - 50) / 50, (screenY - 50) / 50];
      }
    },
    spiralSearch: {
      name: "Spiral Search",
      formula: "θ(t) = 4t, r(t) = 8 + (1 - cos t)(8.5 + 2.4s)",
      colorA: [255, 255, 255],
      colorB: [154, 164, 178],
      rotate: false,
      point(t, pulse) {
        const angle = t * 4;
        const radius = (8 + (1 - Math.cos(t)) * (8.5 + pulse * 2.4)) / 50;
        return [Math.cos(angle) * radius, Math.sin(angle) * radius];
      }
    },
    epitrochoid: {
      name: "Epitrochoid Star",
      formula: "x = (R+r)cos(t) - d cos((R+r)t/r)",
      colorA: [109, 255, 180],
      colorB: [56, 232, 255],
      point(t, pulse) {
        const R = 0.28;
        const r = 0.09;
        const d = 0.2 + pulse * 0.035;
        return [(R + r) * Math.cos(t) - d * Math.cos(((R + r) / r) * t), (R + r) * Math.sin(t) - d * Math.sin(((R + r) / r) * t)];
      }
    },
    deltoid: {
      name: "Deltoid Trace",
      formula: "x = 2a cos(t) + a cos(2t), y = 2a sin(t) - a sin(2t)",
      colorA: [255, 111, 125],
      colorB: [109, 255, 180],
      point(t, pulse) {
        const a = 0.18 + pulse * 0.015;
        return [2 * a * Math.cos(t) + a * Math.cos(2 * t), 2 * a * Math.sin(t) - a * Math.sin(2 * t)];
      }
    }
  };

  const curvePages = [
    ["rose", "lissajous", "hypotrochoid", "cardioid", "cassini", "fourier"],
    ["thinking7", "thinking5", "thinking9", "roseCurve", "rose2", "rose3"],
    ["rose4", "lemniscate", "spiral3", "spiral4", "spiral5", "spiral6"],
    ["butterfly", "cardioidHeart", "heartWave", "spiralSearch", "epitrochoid", "deltoid"]
  ];

  Object.values(curves).forEach((curve) => {
    if (curve.params) curve.defaultParams = { ...curve.params };
  });

  function mixColor(a, b, t, alpha = 1) {
    const r = Math.round(lerp(a[0], b[0], t));
    const g = Math.round(lerp(a[1], b[1], t));
    const blue = Math.round(lerp(a[2], b[2], t));
    return `rgba(${r}, ${g}, ${blue}, ${alpha})`;
  }

  function drawCurve(canvas, ctx, curve, now, options = {}) {
    const { width, height, scale: canvasScale } = fitCanvas(canvas, options.pixelScale ?? Math.min(renderScale, 0.65));
    const size = Math.min(width, height);
    const cx = width / 2;
    const cy = height / 2;
    const scale = size * (options.scale ?? 0.58);
    const speed = Number(speedInput.value);
    const particleCount = options.particles ?? Number(particleInput.value);
    const trailLength = options.trail ?? Number(trailInput.value);
    const time = now * 0.001 * speed + (options.offset ?? 0);
    const progress = (time * 0.135) % 1;
    const pulse = (Math.sin(time * 1.4) + 1) / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(cx, cy);
    const shouldRotate = options.rotate ?? curve.rotate ?? true;
    ctx.rotate(shouldRotate ? time * 0.16 : 0);

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.42);
    gradient.addColorStop(0, mixColor(curve.colorA, curve.colorB, 0.35, 0.22));
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    const steps = options.steps ?? 220;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const [x, y] = curve.point(t, pulse);
      const px = x * scale;
      const py = y * scale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = mixColor(curve.colorA, curve.colorB, 0.4, options.pathAlpha ?? 0.22);
    const stroke = options.stroke ?? curve.params?.stroke;
    const particleScale = stroke ? clamp(stroke / 3.9, 0.6, 1.55) : 1;
    ctx.lineWidth = stroke
      ? stroke * canvasScale * (curve.pathWeight ?? 1)
      : Math.max(1, size * (options.lineWidth ?? 0.006));
    ctx.stroke();

    for (let i = particleCount - 1; i >= 0; i--) {
      const tail = i / Math.max(1, particleCount - 1);
      const t = ((progress - tail * trailLength + 1) % 1) * Math.PI * 2;
      const [x, y] = curve.point(t, pulse);
      const fade = Math.pow(1 - tail, 0.9);
      ctx.fillStyle = mixColor(curve.colorA, curve.colorB, tail, 0.08 + fade * 0.86);
      ctx.beginPath();
      ctx.arc(x * scale, y * scale, size * (0.004 + fade * 0.014) * particleScale, 0, Math.PI * 2);
      ctx.fill();
    }

    if (options.glow !== false) {
      const headT = progress * Math.PI * 2;
      const [headX, headY] = curve.point(headT, pulse);
      const glowRadius = size * 0.09 * particleScale;
      const glow = ctx.createRadialGradient(
        headX * scale,
        headY * scale,
        0,
        headX * scale,
        headY * scale,
        glowRadius
      );
      glow.addColorStop(0, mixColor(curve.colorA, curve.colorB, 0.08, 0.72));
      glow.addColorStop(0.35, mixColor(curve.colorA, curve.colorB, 0.24, 0.26));
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(headX * scale, headY * scale, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();
  }

  const miniInstances = cards.map((card, index) => ({
    card,
    key: card.dataset.curve,
    canvas: card.querySelector("canvas"),
    ctx: card.querySelector("canvas").getContext("2d"),
    offset: index * 1.7,
    drawn: false
  }));

  function getFormula(curve) {
    return typeof curve.formula === "function" ? curve.formula(curve.params) : curve.formula;
  }

  function formatParamValue(value, step) {
    return Number(value).toFixed(Number(step) < 1 ? 2 : 0);
  }

  function renderSpecificControls(curve) {
    const hasControls = Boolean(curve.controls?.length);
    specificControls.hidden = !hasControls;
    controlsPanel.classList.toggle("has-specific-controls", hasControls);
    paramGrid.replaceChildren();
    if (!hasControls) return;

    curve.controls.forEach((control) => {
      const wrapper = document.createElement("div");
      const head = document.createElement("div");
      const label = document.createElement("label");
      const output = document.createElement("output");
      const input = document.createElement("input");
      const inputId = `curve-param-${control.key}`;

      wrapper.className = "curve-param";
      head.className = "curve-param-head";
      label.htmlFor = inputId;
      label.textContent = control.label;
      output.setAttribute("for", inputId);
      output.value = formatParamValue(curve.params[control.key], control.step);
      input.id = inputId;
      input.type = "range";
      input.min = String(control.min);
      input.max = String(control.max);
      input.step = String(control.step);
      input.value = String(curve.params[control.key]);

      input.addEventListener("input", () => {
        curve.params[control.key] = Number(input.value);
        output.value = formatParamValue(input.value, control.step);
        if (curves[activeKey] === curve) curveFormula.textContent = getFormula(curve);
      });

      head.append(label, output);
      wrapper.append(head, input);
      paramGrid.append(wrapper);
    });
  }

  function renderCurvePage(pageIndex) {
    currentPage = (pageIndex + curvePages.length) % curvePages.length;
    const pageKeys = curvePages[currentPage];

    miniInstances.forEach((item, index) => {
      const key = pageKeys[index];
      item.key = key;
      item.drawn = false;
      item.card.dataset.curve = key;
      item.card.setAttribute("aria-label", curves[key].name);
      item.card.querySelector("span").textContent = curves[key].name;
      item.ctx.clearRect(0, 0, item.canvas.width, item.canvas.height);
    });

    pageStatus.textContent = `${String(currentPage + 1).padStart(2, "0")} / ${String(curvePages.length).padStart(2, "0")}`;
    cardsContainer.classList.remove("is-page-changing");
    void cardsContainer.offsetWidth;
    cardsContainer.classList.add("is-page-changing");
    window.setTimeout(() => cardsContainer.classList.remove("is-page-changing"), 450);
    selectCurve(pageKeys[0]);
  }

  function selectCurve(key) {
    activeKey = key;
    const curve = curves[key];
    curveName.textContent = curve.name;
    curveFormula.textContent = getFormula(curve);
    renderSpecificControls(curve);
    cards.forEach((card) => card.classList.toggle("is-active", card.dataset.curve === key));
  }

  cards.forEach((card) => {
    card.addEventListener("click", () => selectCurve(card.dataset.curve));
  });

  prevButton.addEventListener("click", () => renderCurvePage(currentPage - 1));
  nextButton.addEventListener("click", () => renderCurvePage(currentPage + 1));
  paramReset.addEventListener("click", () => {
    const curve = curves[activeKey];
    if (!curve.defaultParams) return;
    curve.params = { ...curve.defaultParams };
    curveFormula.textContent = getFormula(curve);
    renderSpecificControls(curve);
  });

  function draw(now) {
    if (visibility.visible && !document.hidden) {
      drawCurve(mainCanvas, mainCtx, curves[activeKey], now, { scale: 0.52, lineWidth: 0.0048 });
      if (now - lastMiniDraw >= 1000 / 20) {
        lastMiniDraw = now;
        miniInstances.forEach((item) => {
          if (item.drawn && item.key !== activeKey) return;
          drawCurve(item.canvas, item.ctx, curves[item.key], now, {
            particles: 18,
            scale: 0.54,
            lineWidth: 0.008,
            pathAlpha: item.key === activeKey ? 0.34 : 0.18,
            offset: item.offset,
            trail: 0.3,
            steps: 120,
            pixelScale: 1,
            glow: item.key === activeKey
          });
          item.drawn = true;
        });
      }
    }
    requestAnimationFrame(draw);
  }

  const requestedCurve = new URLSearchParams(window.location.search).get("curve");
  const requestedPage = requestedCurve
    ? curvePages.findIndex((page) => page.includes(requestedCurve))
    : -1;
  renderCurvePage(requestedPage >= 0 ? requestedPage : 0);
  if (requestedCurve && curves[requestedCurve]) selectCurve(requestedCurve);
  requestAnimationFrame(draw);
}

function setupBrowserApis() {
  const output = document.querySelector("#api-output");
  document.querySelector("#copy-report").addEventListener("click", async () => {
    const text = `Web 能力展覽館狀態：FPS ${Math.round(state.fps)}、tilt ${Math.round(state.tilt)}°、motion ${state.motion ? "on" : "off"}`;
    try {
      await navigator.clipboard.writeText(text);
      output.value = "已複製：" + text;
    } catch {
      output.value = "瀏覽器未開放剪貼簿權限，但狀態已生成。";
    }
  });

  document.querySelector("#speak-title").addEventListener("click", () => {
    if (!("speechSynthesis" in window)) {
      output.value = "這個瀏覽器不支援語音合成。";
      return;
    }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("Web 能力展覽館。把瀏覽器變成一座會呼吸的科技展館。");
    utterance.lang = "zh-TW";
    speechSynthesis.speak(utterance);
    output.value = "已呼叫 Web Speech API。";
  });

  document.querySelector("#fullscreen").addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
      output.value = document.fullscreenElement ? "沉浸模式已啟動。" : "已離開全螢幕。";
    } catch {
      output.value = "瀏覽器拒絕全螢幕請求。";
    }
  });

  document.querySelector("#toggle-motion").addEventListener("click", (event) => {
    state.motion = !state.motion;
    document.body.classList.toggle("motion-rich", state.motion);
    event.currentTarget.textContent = state.motion ? "關閉動態模式" : "啟動動態模式";
  });
}

function setupScrollReactor() {
  const reactor = document.querySelector(".reactor");
  const stage = document.querySelector(".orbital-stage");
  const viewport = document.querySelector(".reactor-viewport");
  const canvas3d = document.querySelector("#reactor-3d-canvas");
  const ctx3d = canvas3d?.getContext("2d");
  const timelineItems = [...document.querySelectorAll(".timeline-item")];
  const visibility = createVisibilityTracker(reactor);
  let reactorProgress = 0;
  const dragState = {
    active: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
    rotateX: 0,
    rotateY: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    velocityX: 0,
    velocityY: 0,
    inertiaFrame: 0
  };

  function syncDragRotation() {
    reactor.style.setProperty("--reactor-drag-x", `${dragState.rotateX.toFixed(2)}deg`);
    reactor.style.setProperty("--reactor-drag-y", `${dragState.rotateY.toFixed(2)}deg`);
  }

  function rotatePoint(point, rx, ry, rz) {
    let { x, y, z } = point;
    const cosX = Math.cos(rx);
    const sinX = Math.sin(rx);
    const y1 = y * cosX - z * sinX;
    const z1 = y * sinX + z * cosX;
    y = y1;
    z = z1;

    const cosY = Math.cos(ry);
    const sinY = Math.sin(ry);
    const x1 = x * cosY + z * sinY;
    const z2 = -x * sinY + z * cosY;
    x = x1;
    z = z2;

    const cosZ = Math.cos(rz);
    const sinZ = Math.sin(rz);
    return {
      x: x * cosZ - y * sinZ,
      y: x * sinZ + y * cosZ,
      z
    };
  }

  function projectPoint(point, width, height) {
    const camera = 8;
    const perspective = camera / (camera - point.z);
    const scale = Math.min(width, height) * 0.19;
    return {
      x: width / 2 + point.x * scale * perspective,
      y: height / 2 + point.y * scale * perspective,
      z: point.z,
      perspective
    };
  }

  function ringPoint(t, radius, tiltX, tiltY, offsetZ) {
    const local = { x: Math.cos(t) * radius, y: Math.sin(t) * radius, z: 0 };
    const tilted = rotatePoint(local, tiltX, tiltY, 0);
    return { x: tilted.x, y: tilted.y, z: tilted.z + offsetZ };
  }

  function drawReactor3d(now) {
    if (!ctx3d) return;
    if (!visibility.visible || document.hidden) {
      requestAnimationFrame(drawReactor3d);
      return;
    }
    const { width, height } = fitCanvas(canvas3d);
    ctx3d.clearRect(0, 0, width, height);
    ctx3d.save();
    ctx3d.globalCompositeOperation = "lighter";

    const time = now * 0.001;
    const rx = (46 - reactorProgress * 20 + dragState.rotateY) * Math.PI / 180;
    const ry = (dragState.rotateX + Math.sin(time * 0.32) * 5) * Math.PI / 180;
    const rz = (-10 + reactorProgress * 54 + Math.sin(time * 0.22) * 4) * Math.PI / 180;
    const objects = [];
    const rings = [
      { radius: 2.05, tiltX: 1.22, tiltY: 0.18, z: 0.62, color: [56, 232, 255], phase: 0.1 },
      { radius: 2.65, tiltX: 0.72, tiltY: 0.92, z: -0.48, color: [255, 111, 125], phase: 1.9 },
      { radius: 3.08, tiltX: 1.38, tiltY: -0.34, z: 1.05, color: [255, 209, 102], phase: 3.1 },
      { radius: 2.28, tiltX: 0.42, tiltY: -1.05, z: -0.9, color: [109, 255, 180], phase: 4.3 }
    ];

    rings.forEach((ring, ringIndex) => {
      const points = [];
      const steps = 132;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps * Math.PI * 2 + time * (0.08 + ringIndex * 0.025) + reactorProgress * 1.6;
        const point = rotatePoint(ringPoint(t, ring.radius, ring.tiltX, ring.tiltY, ring.z), rx, ry, rz);
        points.push(projectPoint(point, width, height));
      }
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        objects.push({
          z: (a.z + b.z) / 2,
          draw() {
            const depth = clamp(((a.z + b.z) / 2 + 3.6) / 7.2, 0, 1);
            ctx3d.strokeStyle = `rgba(${ring.color[0]}, ${ring.color[1]}, ${ring.color[2]}, ${0.08 + depth * 0.38})`;
            ctx3d.lineWidth = (0.9 + depth * 2.2) * renderScale;
            ctx3d.beginPath();
            ctx3d.moveTo(a.x, a.y);
            ctx3d.lineTo(b.x, b.y);
            ctx3d.stroke();
          }
        });
      }

      for (let i = 0; i < 3; i++) {
        const t = time * (0.65 + ringIndex * 0.08) + ring.phase + i * Math.PI * 2 / 3;
        const point = rotatePoint(ringPoint(t, ring.radius, ring.tiltX, ring.tiltY, ring.z), rx, ry, rz);
        const projected = projectPoint(point, width, height);
        objects.push({
          z: projected.z + 0.05,
          draw() {
            const depth = clamp((projected.z + 3.4) / 6.8, 0, 1);
            ctx3d.fillStyle = `rgba(${ring.color[0]}, ${ring.color[1]}, ${ring.color[2]}, ${0.35 + depth * 0.65})`;
            ctx3d.shadowColor = `rgba(${ring.color[0]}, ${ring.color[1]}, ${ring.color[2]}, 0.9)`;
            ctx3d.shadowBlur = 22 * depth;
            ctx3d.beginPath();
            ctx3d.arc(projected.x, projected.y, (3.4 + depth * 7.5) * renderScale, 0, Math.PI * 2);
            ctx3d.fill();
            ctx3d.shadowBlur = 0;
          }
        });
      }
    });

    const vertices = [
      { x: 0, y: -0.86, z: 0.72 },
      { x: 0.92, y: -0.16, z: 0.28 },
      { x: 0.44, y: 0.68, z: -0.54 },
      { x: -0.54, y: 0.66, z: -0.28 },
      { x: -0.94, y: -0.14, z: 0.2 },
      { x: 0, y: 0.08, z: 1.2 },
      { x: 0, y: 0.2, z: -1.15 }
    ].map((point) => rotatePoint(point, rx + 0.18, ry + time * 0.34, rz - 0.12));
    const faces = [
      [5, 0, 1, [56, 232, 255]],
      [5, 1, 2, [88, 128, 255]],
      [5, 2, 3, [255, 111, 125]],
      [5, 3, 4, [255, 209, 102]],
      [5, 4, 0, [109, 255, 180]],
      [6, 1, 0, [28, 92, 150]],
      [6, 2, 1, [98, 78, 210]],
      [6, 3, 2, [130, 58, 92]],
      [6, 4, 3, [74, 92, 82]],
      [6, 0, 4, [46, 126, 170]]
    ];
    faces.forEach(([aIndex, bIndex, cIndex, color]) => {
      const face = [vertices[aIndex], vertices[bIndex], vertices[cIndex]];
      const projected = face.map((point) => projectPoint(point, width, height));
      const z = face.reduce((sum, point) => sum + point.z, 0) / 3;
      objects.push({
        z,
        draw() {
          const depth = clamp((z + 2.2) / 4.4, 0, 1);
          ctx3d.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${0.42 + depth * 0.3})`;
          ctx3d.strokeStyle = `rgba(255, 255, 255, ${0.08 + depth * 0.24})`;
          ctx3d.lineWidth = 1 * renderScale;
          ctx3d.beginPath();
          ctx3d.moveTo(projected[0].x, projected[0].y);
          ctx3d.lineTo(projected[1].x, projected[1].y);
          ctx3d.lineTo(projected[2].x, projected[2].y);
          ctx3d.closePath();
          ctx3d.fill();
          ctx3d.stroke();
        }
      });
    });

    objects.sort((a, b) => a.z - b.z);
    objects.forEach((object) => object.draw());

    const glow = ctx3d.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.min(width, height) * 0.38);
    glow.addColorStop(0, "rgba(56, 232, 255, 0.14)");
    glow.addColorStop(1, "rgba(56, 232, 255, 0)");
    ctx3d.globalCompositeOperation = "screen";
    ctx3d.fillStyle = glow;
    ctx3d.fillRect(0, 0, width, height);
    ctx3d.restore();

    requestAnimationFrame(drawReactor3d);
  }

  function update() {
    const rect = reactor.getBoundingClientRect();
    const travel = Math.max(1, rect.height - window.innerHeight);
    const progress = clamp(-rect.top / travel, 0, 1);
    reactorProgress = progress;
    reactor.style.setProperty("--reactor-progress", progress.toFixed(3));
    stage.style.transform = `translateY(${Math.sin(progress * Math.PI) * -18}px)`;
    timelineItems.forEach((item, index) => {
      const itemRect = item.getBoundingClientRect();
      const center = itemRect.top + itemRect.height / 2;
      const viewportCenter = window.innerHeight * 0.5;
      const activeBand = window.innerHeight * 0.13;
      const inViewport = itemRect.bottom > 0 && itemRect.top < window.innerHeight;
      const entering = inViewport && center > viewportCenter + activeBand;
      const active = inViewport && Math.abs(center - viewportCenter) <= activeBand;
      const exiting = inViewport && center < viewportCenter - activeBand;
      item.classList.toggle("is-entering", entering);
      item.classList.toggle("is-active", active);
      item.classList.toggle("is-exiting", exiting);
    });
  }

  viewport.addEventListener("pointerdown", (event) => {
    if (dragState.inertiaFrame) {
      cancelAnimationFrame(dragState.inertiaFrame);
      dragState.inertiaFrame = 0;
    }
    dragState.active = true;
    dragState.startX = event.clientX;
    dragState.startY = event.clientY;
    dragState.baseX = dragState.rotateX;
    dragState.baseY = dragState.rotateY;
    dragState.lastX = event.clientX;
    dragState.lastY = event.clientY;
    dragState.lastTime = performance.now();
    dragState.velocityX = 0;
    dragState.velocityY = 0;
    viewport.classList.add("is-dragging");
    viewport.setPointerCapture(event.pointerId);
  });

  viewport.addEventListener("pointermove", (event) => {
    if (!dragState.active) return;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    const now = performance.now();
    const elapsed = Math.max(16, now - dragState.lastTime);
    dragState.velocityX = (event.clientX - dragState.lastX) / elapsed;
    dragState.velocityY = (event.clientY - dragState.lastY) / elapsed;
    dragState.lastX = event.clientX;
    dragState.lastY = event.clientY;
    dragState.lastTime = now;
    dragState.rotateX = clamp(dragState.baseX + dx * 0.24, -42, 42);
    dragState.rotateY = clamp(dragState.baseY - dy * 0.2, -34, 34);
    syncDragRotation();
  });

  function glide() {
    dragState.velocityX *= 0.92;
    dragState.velocityY *= 0.92;
    dragState.rotateX = clamp(dragState.rotateX + dragState.velocityX * 7.2, -44, 44);
    dragState.rotateY = clamp(dragState.rotateY - dragState.velocityY * 6.0, -36, 36);
    syncDragRotation();

    if (Math.abs(dragState.velocityX) > 0.01 || Math.abs(dragState.velocityY) > 0.01) {
      dragState.inertiaFrame = requestAnimationFrame(glide);
    } else {
      dragState.inertiaFrame = 0;
    }
  }

  function endDrag(event) {
    if (!dragState.active) return;
    dragState.active = false;
    viewport.classList.remove("is-dragging");
    if (event?.pointerId !== undefined && viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
    dragState.inertiaFrame = requestAnimationFrame(glide);
  }

  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
  viewport.addEventListener("lostpointercapture", endDrag);

  syncDragRotation();
  if (ctx3d) requestAnimationFrame(drawReactor3d);
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
}

function setupDeviceTilt() {
  const tiltEl = document.querySelector("#tilt");
  window.addEventListener("deviceorientation", (event) => {
    state.tilt = event.gamma || 0;
    tiltEl.textContent = `${Math.round(state.tilt)}°`;
  });
  window.addEventListener("pointermove", () => {
    state.tilt = (state.pointer.x - 0.5) * 34;
    tiltEl.textContent = `${Math.round(state.tilt)}°`;
  }, { passive: true });
}

function setupFps() {
  const fpsEl = document.querySelector("#fps");
  let last = performance.now();
  let smooth = 60;
  function tick(now) {
    const fps = 1000 / Math.max(1, now - last);
    last = now;
    smooth = lerp(smooth, fps, 0.06);
    state.fps = smooth;
    fpsEl.textContent = String(Math.round(smooth));
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

setupPointer();
setupHeroParticles();
setupShader();
setupAudio();
setupPhysics();
setupDataCanvas();
setupMathCurves();
setupBrowserApis();
setupScrollReactor();
setupDeviceTilt();
setupFps();
