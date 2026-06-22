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

// --- 初始化 GSAP 時間軸 ---
function buildTimeline() {
  const data = dataPresets[currentPreset];
  const totalDuration = 27.5; // 總影片長度擴展至 27.5 秒
  const circ = 753.98; // Donut 圓形周長 2 * Math.PI * 120
  const circPie = 376.99; // Pie 圓形周長 2 * Math.PI * 60

  // 靜態曲線 d 屬性定義 (與桑基圖結構一致以利平滑 morph)
  const wave1_A = "M 100,210 C 250,120 250,300 400,210 C 550,120 550,300 700,210";
  const wave1_B = "M 100,210 C 250,300 250,120 400,210 C 550,300 550,120 700,210";
  const wave2_A = "M 100,210 C 250,280 250,140 400,210 C 550,280 550,140 700,210";
  const wave2_B = "M 100,210 C 250,140 250,280 400,210 C 550,140 550,280 700,210";
  const wave3_A = "M 100,210 C 250,180 250,240 400,210 C 550,180 550,240 700,210";
  const wave3_B = "M 100,210 C 250,240 250,180 400,210 C 550,240 550,180 700,210";
  const wave3_flat = "M 100,210 C 250,210 250,210 400,210 C 550,210 550,210 700,210";

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
  
  // 重置標題與結論頁面的動畫內容
  gsap.set(".title-slide-content", { opacity: 1, y: 0 });
  gsap.set(".summary-headline", { opacity: 1, y: 0 });
  gsap.set(".summary-metric", { opacity: 1, y: 0 });

  // 重置 Donut 與 Pie 圖表線條，並設定 svgOrigin 避免離心偏移
  gsap.set(['#donut-seg-1', '#donut-seg-2', '#donut-seg-3', '#donut-seg-4'], { strokeDashoffset: circ, rotation: -90, svgOrigin: "400 210" });
  gsap.set(['#pie-seg-1', '#pie-seg-2', '#pie-seg-3', '#pie-seg-4'], { strokeDashoffset: circPie, rotation: -90, svgOrigin: "400 210" });

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
    gsap.set(circle, { opacity: 0, scale: 0, transformOrigin: "center" });
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
    circle.setAttribute('cx', 400);
    circle.setAttribute('cy', 210);
    circle.setAttribute('r', 5);
    circle.setAttribute('fill', '#ffffff');
    circle.setAttribute('stroke', 'var(--theme-primary)');
    circle.setAttribute('stroke-width', '2.5');
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
    duration: 1.2,
    ease: "power2.out"
  }, 6.1);

  const dots = linePointsGroup.querySelectorAll('.dot-node');
  dots.forEach((dot, index) => {
    const targetY = valToY(data.valuesB[index]);
    masterTimeline.set(dot, { attr: { cy: yMin }, opacity: 0, scale: 0 }, 5.5);
    masterTimeline.to(dot, {
      attr: { cy: targetY },
      opacity: 1,
      scale: 1,
      duration: 0.8,
      ease: "back.out(1.5)"
    }, 6.3 + index * 0.1);
  });

  // ==========================================
  // SCENE 5: 環狀圖 100% 跑滿與四色 (7.5s - 10.0s)
  // ==========================================
  masterTimeline.addLabel("scene-donut", 7.5);
  masterTimeline.to(stageChartSubtitle, { 
    textContent: "系統資源使用率分析 | 相位四：四色整體平均負載 100%", 
    duration: 0.2 
  }, 7.5);

  // 隱藏折線
  masterTimeline.to(linePath, { opacity: 0, duration: 0.4 }, 7.6);
  masterTimeline.to(dots, { opacity: 0, scale: 0, duration: 0.4 }, 7.6);
  masterTimeline.to('#x-axis-labels', { opacity: 0, duration: 0.3 }, 7.6);
  masterTimeline.to('.chart-grid', { opacity: 0.1, duration: 0.4 }, 7.6);

  // 顯示 Donut 並繪製四個分段 (總和 100% 跑滿)
  masterTimeline.to(donutGroup, { autoAlpha: 1, duration: 0.4 }, 7.8);

  // 4 段長度分配 (總長 753.98)
  const donutSegments = [
    { id: '#donut-seg-1', length: 263.89, rotation: -90 }, // 35%
    { id: '#donut-seg-2', length: 226.19, rotation: 36 },  // 30%
    { id: '#donut-seg-3', length: 150.80, rotation: 144 }, // 20%
    { id: '#donut-seg-4', length: 113.10, rotation: 216 }  // 15%
  ];

  donutSegments.forEach((seg, idx) => {
    masterTimeline.set(seg.id, { rotation: seg.rotation, svgOrigin: "400 210", strokeDashoffset: circ }, 7.5);
    masterTimeline.to(seg.id, {
      strokeDashoffset: circ - seg.length,
      duration: 0.7,
      ease: "power2.out"
    }, 8.0 + idx * 0.4);
  });

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

  // 隱藏環狀圖
  masterTimeline.to(donutGroup, { autoAlpha: 0, duration: 0.4 }, 10.0);
  
  // 顯示圓餅圖
  masterTimeline.to(pieGroup, { autoAlpha: 1, duration: 0.4 }, 10.2);

  // 繪製圓餅圖實心分段 (circPie = 376.99)
  const pieSegs = [
    { id: '#pie-seg-1', length: 150.8, rotation: -90 }, // 40%
    { id: '#pie-seg-2', length: 113.1, rotation: 54 },  // 30%
    { id: '#pie-seg-3', length: 75.4, rotation: 162 },  // 20%
    { id: '#pie-seg-4', length: 37.7, rotation: 234 }   // 10%
  ];

  pieSegs.forEach((seg, idx) => {
    masterTimeline.set(seg.id, { rotation: seg.rotation, svgOrigin: "400 210", strokeDashoffset: circPie }, 10.0);
    masterTimeline.to(seg.id, {
      strokeDashoffset: circPie - seg.length,
      duration: 0.6,
      ease: "power2.out"
    }, 10.3 + idx * 0.3);
  });

  // 標籤淡入
  masterTimeline.fromTo('#pie-labels',
    { opacity: 0, scale: 0.8 },
    { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.2)" },
    11.4
  );

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
  
  // 顯示雷達圖
  masterTimeline.to(radarGroup, { autoAlpha: 1, duration: 0.4 }, 14.7);

  // 雷達多邊形生長
  let radarData = { d0: 0, d1: 0, d2: 0, d3: 0, d4: 0 };
  const targetRadar = data.valuesB;
  const radarDots = radarDotsGroup.querySelectorAll('circle');

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

      radarDots[0].setAttribute('cx', 400);
      radarDots[0].setAttribute('cy', 210 - radarData.d0 * 140);
      radarDots[1].setAttribute('cx', 400 + radarData.d1 * 133);
      radarDots[1].setAttribute('cy', 210 - radarData.d1 * 43);
      radarDots[2].setAttribute('cx', 400 + radarData.d2 * 82);
      radarDots[2].setAttribute('cy', 210 + radarData.d2 * 113);
      radarDots[3].setAttribute('cx', 400 - radarData.d3 * 82);
      radarDots[3].setAttribute('cy', 210 + radarData.d3 * 113);
      radarDots[4].setAttribute('cx', 400 - radarData.d4 * 133);
      radarDots[4].setAttribute('cy', 210 - radarData.d4 * 43);
    }
  }, 14.8);

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
  masterTimeline.to(['#sankey-left-bar', '#sankey-right-bar'], { opacity: 0.8, duration: 0.4 }, 16.7);

  // 波動效果 (16.7s - 19.0s) 三條線同時作流暢波動，避免切換時第三條線突兀出現
  masterTimeline.to('#wave-path-1', { attr: { d: wave1_B }, duration: 0.55, yoyo: true, repeat: 3, ease: "sine.inOut" }, 16.7);
  masterTimeline.to('#wave-path-2', { attr: { d: wave2_B }, duration: 0.55, yoyo: true, repeat: 3, ease: "sine.inOut" }, 16.7);
  masterTimeline.to('#wave-path-3', { attr: { d: wave3_B }, duration: 0.55, yoyo: true, repeat: 3, ease: "sine.inOut" }, 16.7);

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
  masterTimeline.set(['#wave-path-1', '#wave-path-2', '#wave-path-3'], { strokeLinecap: "butt" }, 19.1);

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

  masterTimeline.to(slides.charts, { opacity: 0, duration: 0.4 }, 24.5);
  masterTimeline.set(slides.charts, { className: "stage-slide" }, 24.9);
  
  masterTimeline.set(slides.summary, { className: "stage-slide active", opacity: 0 }, 24.5);
  masterTimeline.to(slides.summary, { opacity: 1, duration: 0.4 }, 24.6);

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
