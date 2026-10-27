// 효과음: 소리 파일 없이 Web Audio API로 직접 만들어 재생합니다.
window.SFX = (() => {
  "use strict";

  const KEY = "brawlquiz-muted";
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem(KEY) === "1"; } catch { /* 저장 불가 환경 */ }

  // 브라우저는 사용자가 화면을 누른 뒤에만 소리를 낼 수 있으므로 첫 재생 때 만듭니다.
  function audio() {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // 음 하나: 주파수(from→to), 시작 지연, 길이, 파형, 음량
  function tone({ from, to = from, delay = 0, dur = 0.12, type = "square", vol = 0.12 }) {
    const ac = audio();
    if (!ac || muted) return;
    const t = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // 여러 음을 차례로: opts.gap 간격, opts.delay 만큼 늦게 시작
  const notes = (list, { gap = 0.09, delay = 0, ...opts } = {}) =>
    list.forEach((f, i) => tone({ ...opts, from: f, delay: delay + i * gap }));

  const sounds = {
    click: () => tone({ from: 660, to: 880, dur: 0.06, vol: 0.08 }),
    start: () => notes([523, 659, 784, 1047], { gap: 0.08, dur: 0.12, type: "triangle", vol: 0.15 }),
    // 연속 정답일수록 음이 올라갑니다
    correct: (streak = 1) => {
      const up = Math.pow(2, Math.min(streak - 1, 6) / 12);
      notes([880 * up, 1319 * up], { gap: 0.08, dur: 0.16, type: "triangle", vol: 0.18 });
    },
    wrong: () => {
      tone({ from: 220, to: 110, dur: 0.35, type: "sawtooth", vol: 0.12 });
      tone({ from: 233, to: 116, dur: 0.35, type: "square", vol: 0.05 });
    },
    tick: () => tone({ from: 1200, dur: 0.04, type: "square", vol: 0.06 }),
    lifeLost: () => tone({ from: 160, to: 60, dur: 0.4, type: "sine", vol: 0.3 }),
    gameOver: () => notes([392, 330, 262, 196], { gap: 0.22, dur: 0.3, type: "sawtooth", vol: 0.1 }),
    fanfare: () => {
      notes([523, 659, 784], { gap: 0.12, dur: 0.14, type: "square", vol: 0.1 });
      tone({ from: 1047, delay: 0.36, dur: 0.5, type: "square", vol: 0.12 });
      tone({ from: 1319, delay: 0.36, dur: 0.5, type: "triangle", vol: 0.1 });
    },
    result: () => notes([523, 659, 784], { gap: 0.1, dur: 0.18, type: "triangle", vol: 0.14 }),
    newBest: () => notes([1568, 2093, 2637, 3136], { gap: 0.06, dur: 0.1, type: "triangle", vol: 0.08, delay: 0.9 }),
  };

  return {
    play(name, ...args) {
      try { sounds[name]?.(...args); } catch { /* 소리 실패는 게임에 영향 없음 */ }
    },
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem(KEY, muted ? "1" : "0"); } catch { /* 저장 불가 환경 */ }
      if (!muted) sounds.click();
      return muted;
    },
  };
})();
