// --- 數據集定義 ---
const dataPresets = {
  normal: {
    title: "系統資源使用率分析",
    // 順序：CPU, Memory, Storage, Network, GPU
    valuesA: [0.35, 0.45, 0.40, 0.25, 0.20], // Phase 1: Q1
    valuesB: [0.58, 0.68, 0.45, 0.42, 0.30], // Phase 2: Q2
    avgLoad: "100%", // 配合使用者要求跑滿 100%
    summary: {
      efficiency: "+35%",
      cost: "-20%",
      latency: "45ms"
    }
  },
  stress: {
    title: "高壓負載性能分析",
    valuesA: [0.60, 0.70, 0.50, 0.55, 0.45],
    valuesB: [0.92, 0.96, 0.72, 0.88, 0.82],
    avgLoad: "100%",
    summary: {
      efficiency: "+12%",
      cost: "+45%",
      latency: "185ms"
    }
  },
  optimized: {
    title: "最佳化綠能排程分析",
    valuesA: [0.45, 0.55, 0.45, 0.35, 0.30],
    valuesB: [0.22, 0.38, 0.42, 0.15, 0.12],
    avgLoad: "100%",
    summary: {
      efficiency: "+68%",
      cost: "-42%",
      latency: "28ms"
    }
  }
};

// --- 當前運作狀態 ---
let currentPreset = 'normal';
let customTitle = "企業雲端資源與架構分析";
let masterTimeline = null;
let isPlaying = false;
let playbackSpeed = 1;

// --- DOM 節點獲取 ---
const videoStage = document.getElementById('video-stage');
const playPauseBtn = document.getElementById('play-pause-btn');
const timelineScrubber = document.getElementById('timeline-scrubber');
const timeDisplay = document.getElementById('time-display');
const speedSelect = document.getElementById('speed-select');
const inputMainTitle = document.getElementById('input-main-title');
const fpsCounter = document.getElementById('fps-counter');

// 幻燈片頁面
const slides = {
  title: document.getElementById('slide-title'),
  charts: document.getElementById('slide-charts'),
  summary: document.getElementById('slide-summary')
};

// 影片標題 / 文字 DOM
const stageMainTitle = document.getElementById('stage-main-title');
const stageChartTitle = document.getElementById('stage-chart-title');
const stageChartSubtitle = document.getElementById('stage-chart-subtitle');

// SVG 圖表元件
const barRects = document.querySelectorAll('.bar-rect');
const linePath = document.getElementById('line-path');
const linePointsGroup = document.getElementById('line-points');
const donutGroup = document.getElementById('donut-chart-group');
const radarGroup = document.getElementById('radar-chart-group');
const radarPolygon = document.getElementById('radar-polygon');
const radarDotsGroup = document.getElementById('radar-dots');

// 新圖表群組 DOM
const pieGroup = document.getElementById('pie-chart-group');
const bubbleGroup = document.getElementById('bubble-chart-group');
const waveformGroup = document.getElementById('waveform-chart-group');
const flowchartGroup = document.getElementById('flowchart-chart-group');

// 結論頁面數據
const summaryVal1 = document.getElementById('metric-val-1');
const summaryVal2 = document.getElementById('metric-val-2');
const summaryVal3 = document.getElementById('metric-val-3');

// --- 背景發光隨滑鼠移動 ---
document.addEventListener('mousemove', (e) => {
  const light = document.querySelector('.cursor-light');
  if (light) {
    light.style.left = e.clientX + 'px';
    light.style.top = e.clientY + 'px';
  }
});

// --- 滑動時模擬 FPS 變量 ---
function updateFps() {
  const fps = 58.5 + Math.random() * 2.8;
  fpsCounter.textContent = fps.toFixed(1);
}
setInterval(updateFps, 400);

// --- 圖表坐標計算輔助 ---
// X 軸固定點: CPU(180), Memory(300), Storage(420), Network(540), GPU(660)
const xCoords = [180, 300, 420, 540, 660];
const yMin = 370; // 0% 時的 Y 軸坐標
const yMax = 50;  // 100% 時的 Y 軸坐標
const yHeightRange = yMin - yMax; // 320px 的可動範圍

function valToY(val) {
  return yMin - (val * yHeightRange);
}

const chartMix = [
  { donut: 35, pie: 40, color: 'var(--theme-primary)' },
  { donut: 30, pie: 30, color: 'var(--theme-secondary)' },
  { donut: 20, pie: 20, color: 'var(--theme-accent)' },
  { donut: 15, pie: 10, color: 'rgba(163, 112, 247, 0.9)' }
];

const donutRadius = 120;
const donutStrokeWidth = 26;
const donutOuterRadius = donutRadius + donutStrokeWidth / 2;
const donutInnerRadius = donutRadius - donutStrokeWidth / 2;
const pieOuterRadius = 124;
const pieInnerStartRadius = donutInnerRadius;
const pieOuterStartRadius = donutOuterRadius;
const pieInnerEndRadius = 4;
const pieGapDeg = 1.25;
const pieStartGapDeg = 3.6;
const pieSliceIds = ['#pie-slice-1', '#pie-slice-2', '#pie-slice-3', '#pie-slice-4'];
const pieLabelIds = ['#pie-label-1', '#pie-label-2', '#pie-label-3', '#pie-label-4'];

function polarToCartesian(radius, angleDeg) {
  const angleRad = (angleDeg - 90) * Math.PI / 180;
  return {
    x: Math.cos(angleRad) * radius,
    y: Math.sin(angleRad) * radius
  };
}

function makeArcSlice(startDeg, endDeg, innerRadius, outerRadius, gapDeg = 0) {
  const start = startDeg + gapDeg;
  const end = endDeg - gapDeg;
  const outerStart = polarToCartesian(outerRadius, start);
  const outerEnd = polarToCartesian(outerRadius, end);
  const innerEnd = polarToCartesian(innerRadius, end);
  const innerStart = polarToCartesian(innerRadius, start);
  const largeArc = end - start > 180 ? 1 : 0;

  return [
    `M ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x.toFixed(3)} ${outerEnd.y.toFixed(3)}`,
    `L ${innerEnd.x.toFixed(3)} ${innerEnd.y.toFixed(3)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x.toFixed(3)} ${innerStart.y.toFixed(3)}`,
    'Z'
  ].join(' ');
}

function getSliceAngles(values) {
  let cursor = 0;
  return values.map((value) => {
    const start = cursor;
    const end = cursor + value * 3.6;
    cursor = end;
    return { start, end, mid: (start + end) / 2 };
  });
}

function getPieLabelPosition(midDeg, radius = 70) {
  return polarToCartesian(radius, midDeg);
}

// --- 初始化 GSAP 時間軸 ---
function buildTimeline() {
  const data = dataPresets[currentPreset];
  const totalDuration = 27.5; // 總影片長度擴展至 27.5 秒
  const circ = 753.98; // Donut 圓形周長 2 * Math.PI * 120
  const donutAngles = getSliceAngles(chartMix.map((seg) => seg.donut));
  const pieAngles = getSliceAngles(chartMix.map((seg) => seg.pie));

  // 靜態曲線 d 屬性定義 (與桑基圖結構一致以利平滑 morph)
  const wave1_A = "M 100,210 C 250,120 250,300 400,210 C 550,120 550,300 700,210";
  const wave1_B = "M 100,210 C 250,300 250,120 400,210 C 550,300 550,120 700,210";
  const wave2_A = "M 100,210 C 250,280 250,140 400,210 C 550,280 550,140 700,210";
  const wave2_B = "M 100,210 C 250,140 250,280 400,210 C 550,140 550,280 700,210";
  const wave3_A = "M 100,210 C 250,180 250,240 400,210 C 550,180 550,240 700,210";
  const wave3_B = "M 100,210 C 250,240 250,180 400,210 C 550,240 550,180 700,210";
  const wave3_flat = "M 100,210 C 250,210 250,210 400,210 C 550,210 550,210 700,210";
  const wave1Trend = [
    "M 100,230 C 165,190 210,155 280,176 C 350,197 390,138 455,126 C 525,113 555,185 615,166 C 652,154 678,135 700,122",
    "M 100,226 C 175,150 230,230 305,196 C 370,168 402,110 468,145 C 520,173 560,108 620,132 C 662,148 684,118 700,132",
    "M 100,222 C 158,252 232,176 306,142 C 385,105 423,196 492,175 C 552,157 590,96 642,118 C 672,130 690,150 700,140",
    "M 100,214 C 175,178 252,186 330,150 C 405,116 455,154 520,122 C 596,85 645,116 700,120"
  ];
  const wave2Trend = [
    "M 100,210 C 170,248 235,242 305,214 C 372,187 426,228 492,236 C 555,244 610,196 700,205",
    "M 100,218 C 178,255 235,190 310,206 C 384,222 420,258 490,223 C 558,188 612,224 700,190",
    "M 100,220 C 170,176 238,230 316,250 C 396,272 448,202 522,206 C 596,210 640,245 700,218",
    "M 100,216 C 174,238 238,212 318,224 C 398,237 458,201 530,210 C 610,220 660,191 700,202"
  ];
  const wave3Trend = [
    "M 100,210 C 180,204 238,214 315,206 C 392,198 450,216 528,208 C 606,200 650,210 700,206",
    "M 100,208 C 175,196 246,202 320,212 C 395,223 454,200 530,194 C 608,188 652,202 700,198",
    "M 100,211 C 184,222 252,205 322,198 C 394,191 456,214 528,220 C 603,226 656,208 700,212",
    "M 100,209 C 182,203 250,211 330,204 C 412,198 470,206 540,201 C 614,196 660,202 700,199"
  ];

  // 如果有舊的時間軸，先暫停並銷毀
  if (masterTimeline) {
    masterTimeline.kill();
  }

  // 1. 初始化 DOM 初始文字與狀態
  stageMainTitle.textContent = customTitle;
  stageChartTitle.textContent = customTitle;
  
  // 重置 SVG & HTML Elements 狀態，防止重建時間軸時屬性殘留
  gsap.set(barRects, { attr: { y: yMin, height: 0 }, opacity: 1 });
  gsap.set(linePath, { strokeDashoffset: 1000, opacity: 1 });
  gsap.set('#x-axis-labels', { opacity: 1 });
  gsap.set('.chart-grid', { opacity: 1 });
  
  // 重置投影片與新圖表群組透明度
  gsap.set([slides.title, slides.charts, slides.summary], { autoAlpha: 0 });
  gsap.set([donutGroup, pieGroup, bubbleGroup, radarGroup, waveformGroup, flowchartGroup], { autoAlpha: 0 });
  gsap.set([donutGroup, pieGroup], { clearProps: 'transform,scale,transformOrigin' });
  gsap.set(donutGroup, { attr: { transform: 'translate(400, 210)' } });
  gsap.set(pieGroup, { attr: { transform: 'translate(400, 210)' } });
  
  // 重置標題與結論頁面的動畫內容
  gsap.set(".title-slide-content", { opacity: 1, y: 0 });
  gsap.set(".summary-headline", { opacity: 1, y: 0 });
  gsap.set(".summary-metric", { opacity: 1, y: 0 });

  // 重置 Donut 與 Pie 圖表線條，清除 GSAP 內建旋轉快取，並重設 transform 屬性避免離心偏移
  gsap.set(['#donut-seg-1', '#donut-seg-2', '#donut-seg-3', '#donut-seg-4'], { strokeDashoffset: circ, clearProps: "transform,rotation,svgOrigin" });
  gsap.set(['#donut-seg-1', '#donut-seg-2', '#donut-seg-3', '#donut-seg-4'], { attr: { transform: "rotate(-90)" } });
  gsap.set('#donut-center-hud', { opacity: 0, scale: 0.88, transformOrigin: "center center" });
  pieSliceIds.forEach((id, index) => {
    const angle = donutAngles[index];
    const labelPoint = getPieLabelPosition(pieAngles[index].mid);
    gsap.set(id, {
      attr: { d: makeArcSlice(angle.start, angle.end, pieInnerStartRadius, pieOuterStartRadius, pieStartGapDeg) },
      opacity: 0,
      scale: 1,
      transformOrigin: 'center center'
    });
    gsap.set(pieLabelIds[index], {
      attr: { x: labelPoint.x.toFixed(1), y: labelPoint.y.toFixed(1) },
      opacity: 0,
      scale: 0.8,
      transformOrigin: 'center center'
    });
    document.querySelector(pieLabelIds[index]).textContent = `${chartMix[index].pie}%`;
  });
  gsap.set(['.pie-orbit', '.pie-inner-glow', '.pie-center-pin'], { opacity: 0, scale: 0.85, transformOrigin: 'center center' });

  // 重置流程圖元件
  gsap.set(['#flow-line-1', '#flow-line-2', '#flow-line-3'], { strokeDasharray: 80, strokeDashoffset: 80 });
  gsap.set(['#flow-dot-1', '#flow-dot-2', '#flow-dot-3'], { autoAlpha: 0, attr: { cx: (i) => [230, 370, 510][i] } });
  gsap.set(['#flow-node-1', '#flow-node-2', '#flow-node-3', '#flow-node-4'], { scale: 0, opacity: 0 });

  // 重置氣泡圖元件
  gsap.set(['#bubble-1', '#bubble-2', '#bubble-3', '#bubble-4', '#bubble-5'], { scale: 0, opacity: 0 });

  // 重置波形圖 / 桑基圖線條 d 屬性與粗細，以及錨定線
  gsap.set('#wave-path-1', { attr: { d: wave1_A }, strokeWidth: 3.5, opacity: 1, strokeLinecap: "round" });
  gsap.set('#wave-path-2', { attr: { d: wave2_A }, strokeWidth: 2.5, opacity: 0.7, strokeLinecap: "round" });
  gsap.set('#wave-path-3', { attr: { d: wave3_A }, strokeWidth: 1.5, opacity: 0.4, strokeLinecap: "round" });
  gsap.set(['#wave-path-1', '#wave-path-2', '#wave-path-3'], { strokeDasharray: 900, strokeDashoffset: 900 });
  gsap.set('#wave-sample-points circle', { opacity: 0, attr: { cx: 100, cy: 210, r: (i) => [5, 4, 3.5][i] } });
  gsap.set(['#sankey-left-bar', '#sankey-right-bar'], { opacity: 0 });

  // 預先建立折線圖的點
  linePointsGroup.innerHTML = '';
  xCoords.forEach((x, index) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', yMin);
    circle.setAttribute('r', 6);
    circle.setAttribute('class', 'dot-node');
    circle.setAttribute('fill', 'var(--theme-primary)');
    circle.setAttribute('stroke', '#ffffff');
    circle.setAttribute('stroke-width', '2');
    gsap.set(circle, { opacity: 0, scale: 1, attr: { r: 3 } });
    linePointsGroup.appendChild(circle);
  });

  // 預先建立雷達圖的點
  radarDotsGroup.innerHTML = '';
  const radarAxes = [
    { xRatio: 0, yRatio: -140 },
    { xRatio: 133, yRatio: -43 },
    { xRatio: 82, yRatio: 113 },
    { xRatio: -82, yRatio: 113 },
    { xRatio: -133, yRatio: -43 }
  ];
  radarAxes.forEach((axis) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', 0);
    circle.setAttribute('cy', 0);
    circle.setAttribute('r', 5);
    circle.setAttribute('fill', '#ffffff');
    circle.setAttribute('stroke', 'var(--theme-primary)');
    circle.setAttribute('stroke-width', '2.5');
    gsap.set(circle, { opacity: 0, attr: { r: 3 } });
    radarDotsGroup.appendChild(circle);
  });

  // 2. 建立主時間軸
  masterTimeline = gsap.timeline({
    paused: true,
    onUpdate: updatePlayerUI,
    onComplete: () => {
      isPlaying = false;
      document.body.classList.remove('playing');
      document.querySelector('.status-indicator').textContent = 'STANDBY';
      playPauseBtn.textContent = '▶';
    }
  });

  // ==========================================
  // SCENE 1: 標題封面 (0.0s - 2.0s)
  // ==========================================
  masterTimeline.addLabel("scene-title", 0);
  masterTimeline.set(slides.title, { autoAlpha: 1 }, 0);
  masterTimeline.set(slides.charts, { autoAlpha: 0 }, 0);
  masterTimeline.set(slides.summary, { autoAlpha: 0 }, 0);

  masterTimeline.fromTo(".title-slide-content", 
    { opacity: 0, y: 30 }, 
    { opacity: 1, y: 0, duration: 1.0, ease: "power2.out" }, 
    0.2
  );
  masterTimeline.to(slides.title, { autoAlpha: 0, duration: 0.4, ease: "power1.inOut" }, 1.8);

  // ==========================================
  // SCENE 2: 長條圖 Q1 (2.0s - 4.0s)
  // ==========================================
  masterTimeline.addLabel("scene-bar-a", 2.0);
  masterTimeline.to(slides.charts, { autoAlpha: 1, duration: 0.3 }, 2.0);
  masterTimeline.set(stageChartSubtitle, { textContent: "系統資源使用率分析 | 相位一：直方分佈 (Q1)" }, 2.0);

  // 長條圖 A 增長
  data.valuesA.forEach((val, index) => {
    const bar = barRects[index];
    const yVal = valToY(val);
    const heightVal = val * yHeightRange;

    masterTimeline.fromTo(bar, 
      { attr: { y: yMin, height: 0 } },
      { attr: { y: yVal, height: heightVal }, duration: 1.0, ease: "back.out(1.1)" }, 
      2.1 + index * 0.1
    );
  });
  // 保持靜態 0.5 秒 (動畫在3.1s完成，到3.6s剛好符合縮短等待的要求)

  // ==========================================
  // SCENE 3: 長條圖 Q2 變量 (4.0s - 5.5s)
  // ==========================================
  masterTimeline.addLabel("scene-bar-b", 4.0);
  masterTimeline.to(stageChartSubtitle, { 
    textContent: "系統資源使用率分析 | 相位二：變量動態轉換 (Q2)", 
    duration: 0.2 
  }, 4.0);

  // 長條圖變更至數據 B
  data.valuesB.forEach((val, index) => {
    const bar = barRects[index];
    const yVal = valToY(val);
    const heightVal = val * yHeightRange;

    masterTimeline.to(bar, 
      { attr: { y: yVal, height: heightVal }, duration: 1.0, ease: "power2.inOut" }, 
      4.2
    );
  });

  // ==========================================
  // SCENE 4: 折線圖轉換 (5.5s - 7.5s)
  // ==========================================
  masterTimeline.addLabel("scene-line", 5.5);
  masterTimeline.to(stageChartSubtitle, { 
    textContent: "系統資源使用率分析 | 相位三：折線走勢分析", 
    duration: 0.2 
  }, 5.5);

  // 長條圖收回
  masterTimeline.to(barRects, {
    attr: { height: 0, y: yMin },
    opacity: 0,
    duration: 0.6,
    ease: "power2.in",
    stagger: 0.05
  }, 5.7);

  // 繪製折線與端點
  const pathD = `M ${xCoords[0]},${valToY(data.valuesB[0])}` + xCoords.slice(1).map((x, i) => ` L ${x},${valToY(data.valuesB[i+1])}`).join('');
  masterTimeline.set(linePath, { attr: { d: pathD }, strokeDasharray: 1000, strokeDashoffset: 1000 }, 5.5);

  masterTimeline.to(linePath, {
    strokeDashoffset: 0,
    duration: 1.45,
    ease: "power2.inOut"
  }, 6.05);

  const dots = linePointsGroup.querySelectorAll('.dot-node');
  dots.forEach((dot, index) => {
    const targetY = valToY(data.valuesB[index]);
    masterTimeline.set(dot, {
      attr: { cx: xCoords[index], cy: targetY, r: 3 },
      opacity: 0,
      scale: 1,
      clearProps: "transform"
    }, 5.5);
    masterTimeline.to(dot, {
      attr: { r: 6 },
      opacity: 1,
      duration: 0.55,
      ease: "sine.out"
    }, 6.2 + index * 0.18);
  });

  // ==========================================
  // SCENE 5: 環狀圖 100% 跑滿與四色 (7.5s - 10.0s)
  // ==========================================
  masterTimeline.addLabel("scene-donut", 7.5);
  masterTimeline.to(stageChartSubtitle, { 
    textContent: "系統資源使用率分析 | 相位四：四色整體平均負載 100%", 
    duration: 0.2 
  }, 7.5);

  // 隱藏折線，保留一點重疊時間讓環狀圖接上，不會突然斷景
  masterTimeline.to(dots, {
    opacity: 0,
    attr: { r: 3 },
    duration: 0.45,
    ease: "sine.inOut",
    stagger: { each: 0.06, from: "end" }
  }, 7.35);
  masterTimeline.to(linePath, {
    strokeDashoffset: -1000,
    opacity: 0,
    duration: 0.75,
    ease: "power2.inOut"
  }, 7.4);
  masterTimeline.to('#x-axis-labels', { opacity: 0, duration: 0.45, ease: "sine.inOut" }, 7.45);
  masterTimeline.to('.chart-grid', { opacity: 0.1, duration: 0.6, ease: "sine.inOut" }, 7.45);

  // 顯示 Donut 並繪製四個分段 (總和 100% 跑滿)
  masterTimeline.to(donutGroup, { autoAlpha: 1, duration: 0.65, ease: "sine.inOut" }, 7.75);

  // 4 段長度分配 (總長 753.98)
  const donutSegments = chartMix.map((seg, index) => ({
    id: `#donut-seg-${index + 1}`,
    length: circ * (seg.donut / 100),
    rotation: donutAngles[index].start - 90
  }));

  donutSegments.forEach((seg, idx) => {
    masterTimeline.set(seg.id, { attr: { transform: `rotate(${seg.rotation})` }, strokeDashoffset: circ }, 7.5);
    masterTimeline.to(seg.id, {
      strokeDashoffset: circ - seg.length,
      duration: 0.7,
      ease: "power2.out"
    }, 8.0 + idx * 0.4);
  });
  masterTimeline.fromTo('#donut-center-glow',
    { opacity: 0, scale: 0.75 },
    { opacity: 1, scale: 1, duration: 0.8, ease: "power2.out", transformOrigin: "center center" },
    8.15
  );
  masterTimeline.to('#donut-center-hud', {
    opacity: 1,
    scale: 1,
    duration: 0.65,
    ease: "back.out(1.4)",
    transformOrigin: "center center"
  }, 8.15);

  // 中心數字跳動到 100%
  const donutValueText = document.getElementById('donut-label-value');
  let donutValObj = { val: 0 };
  masterTimeline.fromTo(donutValObj,
    { val: 0 },
    { 
      val: 100, 
      duration: 2.0, 
      ease: "power1.out",
      onUpdate: () => {
        donutValueText.textContent = `${Math.round(donutValObj.val)}%`;
      }
    },
    8.0
  );

  // ==========================================
  // SCENE 6: 圓餅圖轉換 (10.0s - 12.0s)
  // ==========================================
  masterTimeline.addLabel("scene-pie", 10.0);
  masterTimeline.to(stageChartSubtitle, { 
    textContent: "系統資源使用率分析 | 相位五：資源分配圓餅圖", 
    duration: 0.2 
  }, 10.0);

  // 將環形切片收孔並展開成實心圓餅圖
  masterTimeline.set(pieGroup, { autoAlpha: 1 }, 9.95);
  masterTimeline.to('.pie-orbit', {
    opacity: 1,
    scale: 1,
    duration: 0.45,
    ease: "power2.out"
  }, 10.28);
  masterTimeline.to('.pie-inner-glow', {
    opacity: 1,
    scale: 1,
    duration: 0.45,
    ease: "power2.out"
  }, 10.45);
  masterTimeline.to(donutGroup, {
    autoAlpha: 0,
    duration: 0.55,
    ease: "power2.inOut"
  }, 10.05);

  pieSliceIds.forEach((id, idx) => {
    const donutAngle = donutAngles[idx];
    const pieAngle = pieAngles[idx];
    const labelPoint = getPieLabelPosition(pieAngle.mid);
    masterTimeline.set(id, {
      attr: { d: makeArcSlice(donutAngle.start, donutAngle.end, pieInnerStartRadius, pieOuterStartRadius, pieStartGapDeg) },
      opacity: 0.42,
      scale: 1
    }, 9.95);
    masterTimeline.to(id, {
      opacity: 0.96,
      duration: 0.35,
      ease: "sine.inOut"
    }, 10.0 + idx * 0.03);
    masterTimeline.to(id, {
      attr: { d: makeArcSlice(pieAngle.start, pieAngle.end, pieInnerEndRadius, pieOuterRadius, pieGapDeg) },
      scale: 1,
      duration: 0.95,
      ease: "expo.inOut"
    }, 10.1 + idx * 0.06);
    masterTimeline.fromTo(pieLabelIds[idx],
      {
        opacity: 0,
        scale: 0.68,
        attr: { x: (labelPoint.x * 0.72).toFixed(1), y: (labelPoint.y * 0.72).toFixed(1) }
      },
      {
        opacity: 1,
        scale: 1,
        attr: { x: labelPoint.x.toFixed(1), y: labelPoint.y.toFixed(1) },
        duration: 0.45,
        ease: "back.out(1.6)"
      },
      10.95 + idx * 0.08
    );
  });
  masterTimeline.to('.pie-center-pin', {
    opacity: 1,
    scale: 1,
    duration: 0.4,
    ease: "back.out(1.7)"
  }, 10.85);

  // ==========================================
  // SCENE 7: 氣泡權重圖 (12.0s - 14.5s)
  // ==========================================
  masterTimeline.addLabel("scene-bubble", 12.0);
  masterTimeline.to(stageChartSubtitle, { 
    textContent: "系統資源使用率分析 | 相位六：指標權重氣泡分佈", 
    duration: 0.2 
  }, 12.0);

  // 隱藏圓餅圖
  masterTimeline.to(pieGroup, { autoAlpha: 0, duration: 0.4 }, 12.0);
  
  // 顯示氣泡圖
  masterTimeline.to(bubbleGroup, { autoAlpha: 1, duration: 0.4 }, 12.2);

  // 氣泡長出與浮動
  const bubbles = ['#bubble-1', '#bubble-2', '#bubble-3', '#bubble-4', '#bubble-5'];
  bubbles.forEach((bub, idx) => {
    masterTimeline.fromTo(bub,
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.8, ease: "elastic.out(1, 0.7)" },
      12.4 + idx * 0.15
    );
  });

  masterTimeline.fromTo('#bubble-chart-group g',
    { opacity: 0, y: 10 },
    { opacity: 1, y: 0, duration: 0.6 },
    13.0
  );

  // 浮動 wobble 特效
  masterTimeline.to(['#bubble-1', '#bubble-3'], {
    y: -8,
    duration: 1.0,
    yoyo: true,
    repeat: 1,
    ease: "sine.inOut"
  }, 12.6);
  masterTimeline.to(['#bubble-2', '#bubble-4', '#bubble-5'], {
    y: 8,
    duration: 1.0,
    yoyo: true,
    repeat: 1,
    ease: "sine.inOut"
  }, 12.6);

  // ==========================================
  // SCENE 8: 雷達圖轉換 (14.5s - 16.5s)
  // ==========================================
  masterTimeline.addLabel("scene-radar", 14.5);
  masterTimeline.to(stageChartSubtitle, { 
    textContent: "系統資源使用率分析 | 相位七：多維度指標分析", 
    duration: 0.2 
  }, 14.5);

  // 隱藏氣泡圖
  masterTimeline.to(bubbleGroup, { autoAlpha: 0, duration: 0.4 }, 14.5);
  masterTimeline.set(['#bubble-1', '#bubble-2', '#bubble-3', '#bubble-4', '#bubble-5'], {
    x: 0,
    y: 0,
    opacity: 0,
    scale: 0,
    clearProps: "transform"
  }, 14.9);
  
  // 顯示雷達圖
  masterTimeline.to(radarGroup, { autoAlpha: 1, duration: 0.4 }, 14.7);

  // 雷達多邊形生長
  let radarData = { d0: 0, d1: 0, d2: 0, d3: 0, d4: 0 };
  const targetRadar = data.valuesB;
  const radarDots = radarDotsGroup.querySelectorAll('circle');
  masterTimeline.set(radarDots, { opacity: 0, attr: { cx: 0, cy: 0, r: 3 }, clearProps: "transform" }, 14.5);

  masterTimeline.to(radarData, {
    d0: targetRadar[0],
    d1: targetRadar[1],
    d2: targetRadar[2],
    d3: targetRadar[3],
    d4: targetRadar[4],
    duration: 1.0,
    ease: "power2.out",
    onUpdate: () => {
      const p0 = `0,${-radarData.d0 * 140}`;
      const p1 = `${radarData.d1 * 133},${-radarData.d1 * 43}`;
      const p2 = `${radarData.d2 * 82},${radarData.d2 * 113}`;
      const p3 = `${-radarData.d3 * 82},${radarData.d3 * 113}`;
      const p4 = `${-radarData.d4 * 133},${-radarData.d4 * 43}`;
      radarPolygon.setAttribute('points', `${p0} ${p1} ${p2} ${p3} ${p4}`);

      radarDots[0].setAttribute('cx', 0);
      radarDots[0].setAttribute('cy', -radarData.d0 * 140);
      radarDots[1].setAttribute('cx', radarData.d1 * 133);
      radarDots[1].setAttribute('cy', -radarData.d1 * 43);
      radarDots[2].setAttribute('cx', radarData.d2 * 82);
      radarDots[2].setAttribute('cy', radarData.d2 * 113);
      radarDots[3].setAttribute('cx', -radarData.d3 * 82);
      radarDots[3].setAttribute('cy', radarData.d3 * 113);
      radarDots[4].setAttribute('cx', -radarData.d4 * 133);
      radarDots[4].setAttribute('cy', -radarData.d4 * 43);
    }
  }, 14.8);
  masterTimeline.to(radarDots, {
    opacity: 1,
    attr: { r: 5 },
    duration: 0.55,
    ease: "sine.out",
    stagger: 0.08
  }, 15.15);

  // ==========================================
  // SCENE 9: 波形折線圖 (16.5s - 19.0s)
  // ==========================================
  masterTimeline.addLabel("scene-waveform", 16.5);
  masterTimeline.to(stageChartSubtitle, { 
    textContent: "系統資源使用率分析 | 相位八：即時訊號波形圖", 
    duration: 0.2 
  }, 16.5);

  // 隱藏雷達圖
  masterTimeline.to(radarGroup, { autoAlpha: 0, duration: 0.4 }, 16.5);
  
  // 顯示波形/桑基圖容器
  masterTimeline.to(waveformGroup, { autoAlpha: 1, duration: 0.4 }, 16.7);

  // 顯示左右發光錨定柱，做為熱流圖的邊界節點
  masterTimeline.to(['#sankey-left-bar', '#sankey-right-bar'], { opacity: 0.45, duration: 0.5, ease: "sine.inOut" }, 16.7);

  // 先將訊號線畫入，再以多段趨勢路徑推進，形成向右流動的波形走勢。
  masterTimeline.set('#wave-path-1', { attr: { d: wave1Trend[0] }, strokeDasharray: 900, strokeDashoffset: 900, strokeWidth: 4, opacity: 0.95 }, 16.55);
  masterTimeline.set('#wave-path-2', { attr: { d: wave2Trend[0] }, strokeDasharray: 900, strokeDashoffset: 900, strokeWidth: 2.6, opacity: 0.56 }, 16.58);
  masterTimeline.set('#wave-path-3', { attr: { d: wave3Trend[0] }, strokeDasharray: 900, strokeDashoffset: 900, strokeWidth: 1.8, opacity: 0.38 }, 16.6);
  masterTimeline.to(['#wave-path-1', '#wave-path-2', '#wave-path-3'], {
    strokeDashoffset: 0,
    duration: 0.75,
    ease: "power2.out",
    stagger: 0.06
  }, 16.72);

  wave1Trend.slice(1).forEach((path, idx) => {
    masterTimeline.to('#wave-path-1', {
      attr: { d: path },
      duration: 0.56,
      ease: idx === 2 ? "power2.inOut" : "sine.inOut"
    }, 17.15 + idx * 0.5);
  });
  wave2Trend.slice(1).forEach((path, idx) => {
    masterTimeline.to('#wave-path-2', {
      attr: { d: path },
      duration: 0.62,
      ease: "sine.inOut"
    }, 17.02 + idx * 0.52);
  });
  wave3Trend.slice(1).forEach((path, idx) => {
    masterTimeline.to('#wave-path-3', {
      attr: { d: path },
      duration: 0.58,
      ease: "sine.inOut"
    }, 17.08 + idx * 0.5);
  });

  const sampleTracks = [
    { id: '#wave-sample-1', points: [[110,226], [300,196], [468,145], [642,118], [700,120]] },
    { id: '#wave-sample-2', points: [[112,218], [310,206], [490,223], [612,224], [700,202]] },
    { id: '#wave-sample-3', points: [[110,208], [320,212], [530,194], [650,202], [700,199]] }
  ];
  sampleTracks.forEach((track, trackIndex) => {
    const firstPoint = track.points[0];
    masterTimeline.set(track.id, { opacity: 0, attr: { cx: firstPoint[0], cy: firstPoint[1] } }, 16.65);
    masterTimeline.to(track.id, { opacity: trackIndex === 0 ? 1 : 0.65, duration: 0.25, ease: "sine.out" }, 16.85 + trackIndex * 0.08);
    track.points.slice(1).forEach((point, pointIndex) => {
      masterTimeline.to(track.id, {
        attr: { cx: point[0], cy: point[1] },
        duration: 0.42,
        ease: "power1.inOut"
      }, 17.05 + pointIndex * 0.42 + trackIndex * 0.08);
    });
    masterTimeline.to(track.id, { opacity: 0, duration: 0.3, ease: "sine.in" }, 18.8 + trackIndex * 0.04);
  });

  // ==========================================
  // SCENE 10: 桑基熱流圖 (19.0s - 21.5s) - 完美平滑 Morph，絕不斷線！
  // ==========================================
  masterTimeline.addLabel("scene-heatmap", 19.0);
  masterTimeline.to(stageChartSubtitle, { 
    textContent: "系統資源使用率分析 | 相位九：桑基資料熱流圖 (Sankey Flow)", 
    duration: 0.2 
  }, 19.0);

  // 定義桑基熱流圖的三條流動主幹線 (起點 X=100，終點 X=700，與波形位置一致，以防斷裂)
  const sankey1 = "M 100,120 C 250,120 250,210 400,210 C 550,210 550,120 700,120";
  const sankey2 = "M 100,210 C 250,210 250,210 400,210 C 550,210 550,300 700,300";
  const sankey3 = "M 100,300 C 250,300 250,210 400,210 C 550,210 550,180 700,180";

  // 在變形開始時，將線條端點改為平切 (butt)，以完美貼合垂直錨定柱
  masterTimeline.set(['#wave-path-1', '#wave-path-2', '#wave-path-3'], { strokeLinecap: "butt", strokeDasharray: "none", strokeDashoffset: 0 }, 19.1);

  // 波形路徑 1 變形成為 桑基上分流 (加粗為 24px)
  masterTimeline.to('#wave-path-1', {
    attr: { d: sankey1 },
    strokeWidth: 24,
    opacity: 0.8,
    duration: 1.2,
    ease: "power2.inOut"
  }, 19.1);

  // 波形路徑 2 變形成為 桑基中分流 (加粗為 36px)
  masterTimeline.to('#wave-path-2', {
    attr: { d: sankey2 },
    strokeWidth: 36,
    opacity: 0.8,
    duration: 1.2,
    ease: "power2.inOut"
  }, 19.1);

  // 波形路徑 3 變形成為 桑基下分流 (加粗為 16px)
  masterTimeline.to('#wave-path-3', {
    attr: { d: sankey3 },
    strokeWidth: 16,
    opacity: 0.85,
    duration: 1.2,
    ease: "power2.inOut"
  }, 19.1);

  // ==========================================
  // SCENE 11: 流程時間軸 (21.5s - 24.5s)
  // ==========================================
  masterTimeline.addLabel("scene-flow", 21.5);
  masterTimeline.to(stageChartSubtitle, { 
    textContent: "系統資源使用率分析 | 相位十：管線流程時間軸", 
    duration: 0.2 
  }, 21.5);

  // 在收回流程圖時，將線條端點重置回圓頭 (round)，並讓垂直發光錨定柱淡出
  masterTimeline.set(['#wave-path-1', '#wave-path-2', '#wave-path-3'], { strokeLinecap: "round" }, 21.5);
  masterTimeline.to(['#sankey-left-bar', '#sankey-right-bar'], { opacity: 0, duration: 0.5 }, 21.5);

  // 1. 將桑基流線平滑收合回中央水平線 (Y=210)，並縮小寬度淡出，與流程圖中軸線完美銜接
  masterTimeline.to(['#wave-path-1', '#wave-path-2', '#wave-path-3'], {
    attr: { d: wave3_flat },
    strokeWidth: 1.5,
    opacity: 0.1,
    duration: 0.8,
    ease: "power2.inOut"
  }, 21.5);
  
  // 隨後關閉波形/桑基容器
  masterTimeline.to(waveformGroup, { autoAlpha: 0, duration: 0.3 }, 22.2);
  
  // 顯示流程圖
  masterTimeline.to(flowchartGroup, { autoAlpha: 1, duration: 0.4 }, 21.6);

  // 流程節點與導引線序向揭露
  masterTimeline.to('#flow-node-1', { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.2)" }, 21.7);
  masterTimeline.to('#flow-line-1', { strokeDashoffset: 0, duration: 0.4, ease: "none" }, 22.1);
  masterTimeline.fromTo('#flow-dot-1', 
    { autoAlpha: 0, attr: { cx: 230 } },
    { autoAlpha: 1, attr: { cx: 310 }, duration: 0.4, ease: "none" },
    22.1
  );
  masterTimeline.to('#flow-dot-1', { autoAlpha: 0, duration: 0.1 }, 22.5);

  masterTimeline.to('#flow-node-2', { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.2)" }, 22.4);
  masterTimeline.to('#flow-line-2', { strokeDashoffset: 0, duration: 0.4, ease: "none" }, 22.8);
  masterTimeline.fromTo('#flow-dot-2', 
    { autoAlpha: 0, attr: { cx: 370 } },
    { autoAlpha: 1, attr: { cx: 450 }, duration: 0.4, ease: "none" },
    22.8
  );
  masterTimeline.to('#flow-dot-2', { autoAlpha: 0, duration: 0.1 }, 23.2);

  masterTimeline.to('#flow-node-3', { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.2)" }, 23.1);
  masterTimeline.to('#flow-line-3', { strokeDashoffset: 0, duration: 0.4, ease: "none" }, 23.5);
  masterTimeline.fromTo('#flow-dot-3', 
    { autoAlpha: 0, attr: { cx: 510 } },
    { autoAlpha: 1, attr: { cx: 590 }, duration: 0.4, ease: "none" },
    23.5
  );
  masterTimeline.to('#flow-dot-3', { autoAlpha: 0, duration: 0.1 }, 23.9);

  masterTimeline.to('#flow-node-4', { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.2)" }, 23.8);

  // ==========================================
  // SCENE 12: 結論報告 (24.5s - 27.5s)
  // ==========================================
  masterTimeline.addLabel("scene-summary", 24.5);

  masterTimeline.to(slides.charts, { autoAlpha: 0, duration: 0.4 }, 24.5);
  masterTimeline.set(slides.charts, { className: "stage-slide" }, 24.9);
  
  masterTimeline.set(slides.summary, { className: "stage-slide active" }, 24.5);
  masterTimeline.to(slides.summary, { autoAlpha: 1, duration: 0.4 }, 24.6);

  masterTimeline.fromTo(".summary-headline", 
    { opacity: 0, y: -20 },
    { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" },
    24.8
  );

  masterTimeline.fromTo(".summary-metric",
    { opacity: 0, y: 30 },
    { opacity: 1, y: 0, duration: 0.8, ease: "power2.out", stagger: 0.15 },
    25.0
  );

  let summaryObj = { val1: 0, val2: 0, val3: 0 };
  const targetVal1 = parseInt(data.summary.efficiency);
  const targetVal2 = parseInt(data.summary.cost);
  const targetVal3 = parseInt(data.summary.latency);

  masterTimeline.to(summaryObj, {
    val1: targetVal1,
    val2: targetVal2,
    val3: targetVal3,
    duration: 1.5,
    ease: "power2.out",
    onUpdate: () => {
      summaryVal1.textContent = `+${Math.round(summaryObj.val1)}%`;
      summaryVal2.textContent = `${Math.round(summaryObj.val2)}%`;
      summaryVal3.textContent = `${Math.round(summaryObj.val3)}ms`;
    }
  }, 25.2);
}

// --- 播放器 UI 同步函數 ---
function updatePlayerUI() {
  const progress = masterTimeline.progress();
  const time = masterTimeline.time();
  
  timelineScrubber.value = progress * 100;
  timeDisplay.textContent = `${time.toFixed(1)}s / 27.5s`;

  const mins = Math.floor(time / 60).toString().padStart(2, '0');
  const secs = Math.floor(time % 60).toString().padStart(2, '0');
  const ms = Math.floor((time % 1) * 100).toString().padStart(2, '0');
  document.getElementById('timecode-display').textContent = `00:${secs}.${ms}`;

  const jumpBtns = document.querySelectorAll('.jump-btn');
  let activeIndex = 0;
  
  const phaseTimes = [0, 2.2, 4.0, 5.5, 7.5, 10.0, 12.0, 14.5, 16.5, 19.0, 21.5, 24.5];
  phaseTimes.forEach((pt, idx) => {
    if (time >= pt) {
      activeIndex = idx;
    }
  });

  jumpBtns.forEach((btn, idx) => {
    if (idx === activeIndex) {
      btn.classList.add('is-active');
    } else {
      btn.classList.remove('is-active');
    }
  });
}

// --- 播放與暫停切換 ---
function togglePlay() {
  if (isPlaying) {
    masterTimeline.pause();
    playPauseBtn.textContent = '▶';
    document.body.classList.remove('playing');
    document.querySelector('.status-indicator').textContent = 'STANDBY';
  } else {
    if (masterTimeline.progress() >= 1) {
      masterTimeline.restart();
    } else {
      masterTimeline.play();
    }
    playPauseBtn.textContent = '⏸';
    document.body.classList.add('playing');
    document.querySelector('.status-indicator').textContent = 'RENDERING';
  }
  isPlaying = !isPlaying;
}

// --- 綁定事件監聽器 ---

playPauseBtn.addEventListener('click', togglePlay);

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    togglePlay();
  }
});

timelineScrubber.addEventListener('input', (e) => {
  const pct = e.target.value / 100;
  masterTimeline.progress(pct);
  if (isPlaying) {
    togglePlay();
  }
});

speedSelect.addEventListener('change', (e) => {
  playbackSpeed = parseFloat(e.target.value);
  masterTimeline.timeScale(playbackSpeed);
});

document.querySelectorAll('.jump-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    const targetTime = parseFloat(btn.getAttribute('data-time'));
    masterTimeline.time(targetTime);
    updatePlayerUI();
    if (isPlaying) {
      masterTimeline.play();
    }
  });
});

inputMainTitle.addEventListener('input', (e) => {
  customTitle = e.target.value || "未命名數據影片";
  const currentProgress = masterTimeline.progress();
  buildTimeline();
  masterTimeline.progress(currentProgress);
});

document.querySelectorAll('.color-preset-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.color-preset-btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');

    const themeName = btn.getAttribute('data-theme');
    document.body.className = `theme-${themeName}`;
    if (isPlaying) {
      document.body.classList.add('playing');
    }
  });
});

document.querySelectorAll('.preset-data-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.preset-data-btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');

    currentPreset = btn.getAttribute('data-preset');
    customTitle = dataPresets[currentPreset].title;
    inputMainTitle.value = customTitle;

    const currentProgress = masterTimeline.progress();
    buildTimeline();
    masterTimeline.progress(currentProgress);
  });
});

document.querySelectorAll('.timeline-ticks span').forEach((tickSpan, index) => {
  tickSpan.addEventListener('click', () => {
    const times = [0, 2.2, 4.0, 5.5, 7.5, 10.0, 12.0, 14.5, 16.5, 19.0, 21.5, 24.5];
    masterTimeline.time(times[index]);
    updatePlayerUI();
  });
});

window.addEventListener('DOMContentLoaded', () => {
  buildTimeline();
  masterTimeline.progress(0);
});
