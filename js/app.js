(() => {
  "use strict";

  const DATA = window.BRAWL_DATA;
  const KO = window.KO;
  const QUESTIONS_PER_GAME = 10;
  const TIME_LIMIT = 15; // 초

  const $ = (id) => document.getElementById(id);

  // ---------- 유틸 ----------
  const rand = (n) => Math.floor(Math.random() * n);
  const pick = (arr) => arr[rand(arr.length)];
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const sample = (arr, n, exclude = () => false) => shuffle(arr.filter((x) => !exclude(x))).slice(0, n);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const koName = (b) => KO.brawlers[b.name] || b.name;
  const subName = (b) => (KO.brawlers[b.name] && KO.brawlers[b.name] !== b.name ? b.name : "");
  const koRarity = (r) => KO.rarity[r] || r;
  const koClass = (c) => KO.class[c] || c;
  const koMode = (m) => KO.modes[m] || m;

  const store = {
    get(key) {
      try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 저장 불가 환경 */ }
    },
  };

  const brawlers = DATA.brawlers;
  const withGadgets = brawlers.filter((b) => b.gadgets.length);
  const withStarPowers = brawlers.filter((b) => b.starPowers.length);
  const rarityOrder = ["Common", "Rare", "Super Rare", "Epic", "Mythic", "Legendary", "Ultra Legendary"];
  const rarityColors = Object.fromEntries(brawlers.map((b) => [b.rarity, b.rarityColor]));
  const classes = [...new Set(brawlers.map((b) => b.class))];
  const mapModes = Object.keys(DATA.modes);

  // 이름 보기: 절반은 같은 역할군에서 골라 난이도를 올립니다.
  function brawlerDistractors(answer, n = 3) {
    const sameClass = sample(brawlers, 2, (b) => b.id === answer.id || b.class !== answer.class);
    const rest = sample(brawlers, n - sameClass.length, (b) => b.id === answer.id || sameClass.includes(b));
    return [...sameClass, ...rest];
  }

  const nameChoices = (answer) =>
    shuffle([answer, ...brawlerDistractors(answer)]).map((b) => ({
      label: koName(b), sub: subName(b), correct: b.id === answer.id,
    }));

  const portraitChoices = (answer) =>
    shuffle([answer, ...brawlerDistractors(answer)]).map((b) => ({
      label: koName(b), img: b.icon, correct: b.id === answer.id,
    }));

  // 배경이 투명한 3D 모델 > 일러스트 > 정사각형 초상화 순으로 사용
  const figure = (b) => b.model || b.art || b.img;
  const brawlerImg = (src, cls = "") => `<img class="brawler-img ${cls}" src="${esc(src)}" alt="">`;

  // ---------- 문제 생성기 ----------
  const GENERATORS = {
    portrait() {
      const b = pick(brawlers);
      return {
        question: "이 브롤러의 이름은?",
        stage: brawlerImg(figure(b)),
        images: [figure(b)],
        choices: nameChoices(b),
        answerText: koName(b),
        reviewImg: b.icon,
      };
    },

    silhouette() {
      const b = pick(brawlers);
      return {
        question: "그림자 속 브롤러는 누구?",
        stage: brawlerImg(figure(b), "silhouette"),
        images: [figure(b)],
        choices: nameChoices(b),
        answerText: koName(b),
        reviewImg: b.icon,
        reveal: (stage) => stage.querySelector("img").classList.remove("silhouette"),
      };
    },

    zoom() {
      const b = pick(brawlers);
      const x = 20 + rand(61);
      const y = 20 + rand(61);
      return {
        question: "확대된 이 브롤러는 누구?",
        stage: `<div class="zoom-box">${brawlerImg(b.img, "zoomed")}</div>`,
        images: [b.img],
        choices: nameChoices(b),
        answerText: koName(b),
        reviewImg: b.icon,
        setup: (stage) => { stage.querySelector("img").style.transformOrigin = `${x}% ${y}%`; },
        reveal: (stage) => stage.querySelector("img").classList.remove("zoomed"),
      };
    },

    gadget() {
      const b = pick(withGadgets);
      const g = pick(b.gadgets);
      return {
        question: "이 가젯을 가진 브롤러는?",
        stage: `<div class="item-card gadget"><img src="${esc(g.img)}" alt=""><span>${esc(g.name)}</span></div>`,
        images: [g.img],
        choices: portraitChoices(b),
        answerText: `${koName(b)} · ${g.name}`,
        reviewImg: g.img,
        grid: true,
      };
    },

    starPower() {
      const b = pick(withStarPowers);
      const s = pick(b.starPowers);
      return {
        question: "이 스타 파워를 가진 브롤러는?",
        stage: `<div class="item-card star"><img src="${esc(s.img)}" alt=""><span>${esc(s.name)}</span></div>`,
        images: [s.img],
        choices: portraitChoices(b),
        answerText: `${koName(b)} · ${s.name}`,
        reviewImg: s.img,
        grid: true,
      };
    },

    rarity() {
      const b = pick(brawlers);
      const options = shuffle([b.rarity, ...sample(rarityOrder, 3, (r) => r === b.rarity)]);
      return {
        question: `${koName(b)}의 희귀도는?`,
        stage: brawlerImg(figure(b)),
        images: [figure(b)],
        choices: options.map((r) => ({ label: koRarity(r), color: rarityColors[r], correct: r === b.rarity })),
        answerText: `${koName(b)} · ${koRarity(b.rarity)}`,
        reviewImg: b.icon,
      };
    },

    role() {
      const b = pick(brawlers);
      const options = shuffle([b.class, ...sample(classes, 3, (c) => c === b.class)]);
      return {
        question: `${koName(b)}의 역할군은?`,
        stage: brawlerImg(figure(b)),
        images: [figure(b)],
        choices: options.map((c) => ({ label: koClass(c), correct: c === b.class })),
        answerText: `${koName(b)} · ${koClass(b.class)}`,
        reviewImg: b.icon,
      };
    },

    map() {
      const m = pick(DATA.maps);
      const options = shuffle([m.mode, ...sample(mapModes, 3, (k) => k === m.mode)]);
      return {
        question: "이 맵의 게임 모드는?",
        stage: `<div class="map-box"><img src="${esc(m.img)}" alt=""></div>`,
        images: [m.img],
        choices: options.map((k) => ({ label: koMode(k), img: DATA.modes[k].img, color: DATA.modes[k].color, correct: k === m.mode })),
        answerText: `${m.name} · ${koMode(m.mode)}`,
        reviewImg: DATA.modes[m.mode].img,
      };
    },
  };

  const MODES = [
    { id: "portrait", title: "브롤러 맞히기", desc: "얼굴을 보고 이름을 맞혀요", thumb: () => pick(brawlers).icon },
    { id: "silhouette", title: "실루엣 퀴즈", desc: "그림자만 보고 맞혀요", thumb: () => figure(pick(brawlers)), thumbClass: "silhouette" },
    { id: "zoom", title: "줌 퀴즈", desc: "확대된 일부만 보고 맞혀요", thumb: () => pick(brawlers).img, thumbClass: "thumb-zoom" },
    { id: "gadget", title: "가젯 퀴즈", desc: "가젯의 주인을 찾아요", thumb: () => pick(pick(withGadgets).gadgets).img },
    { id: "starPower", title: "스타 파워 퀴즈", desc: "스타 파워의 주인을 찾아요", thumb: () => pick(pick(withStarPowers).starPowers).img },
    { id: "rarity", title: "희귀도 퀴즈", desc: "브롤러의 희귀도는?", thumb: () => pick(brawlers).icon },
    { id: "role", title: "역할군 퀴즈", desc: "탱커? 저격수? 암살자?", thumb: () => pick(brawlers).icon },
    { id: "map", title: "맵 퀴즈", desc: "맵을 보고 모드를 맞혀요", thumb: () => DATA.modes[pick(mapModes)].img },
    { id: "mix", title: "랜덤 믹스", desc: "모든 유형이 섞여 나와요", thumb: () => pick(brawlers).icon, featured: true },
  ];

  // ---------- 상태 ----------
  let game = null;
  let timerId = null;

  function preload(urls) {
    return Promise.all(urls.map((src) => new Promise((resolve) => {
      const img = new Image();
      img.onload = img.onerror = resolve;
      img.src = src;
    })));
  }

  function makeQuestion(modeId) {
    const types = Object.keys(GENERATORS);
    const type = modeId === "mix" ? pick(types) : modeId;
    const q = GENERATORS[type]();
    q.preloaded = preload([...q.images, ...q.choices.filter((c) => c.img).map((c) => c.img)]);
    return q;
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
    window.scrollTo(0, 0);
  }

  // ---------- 홈 ----------
  function renderHome() {
    const bests = store.get("brawlquiz-best") || {};
    $("best-score").textContent = Math.max(0, ...Object.values(bests));
    $("logo-brawler").src = figure(pick(brawlers));
    $("mode-list").innerHTML = MODES.map((m) => `
      <button class="mode-card${m.featured ? " featured" : ""}" data-mode="${m.id}">
        <span class="mode-thumb"><img class="${m.thumbClass || ""}" src="${esc(m.thumb())}" alt=""></span>
        <span class="mode-text">
          <strong>${m.title}</strong>
          <small>${m.desc}</small>
          ${bests[m.id] ? `<em>최고 ${bests[m.id]}점</em>` : ""}
        </span>
      </button>`).join("");
    showScreen("home");
  }

  // ---------- 게임 ----------
  function startGame(modeId) {
    game = { mode: modeId, index: 0, score: 0, correct: 0, streak: 0, history: [], current: null, next: makeQuestion(modeId) };
    $("q-total").textContent = QUESTIONS_PER_GAME;
    $("score").textContent = "0";
    showScreen("quiz");
    nextQuestion();
  }

  async function nextQuestion() {
    const q = game.next;
    game.current = q;
    game.answered = false;
    game.next = game.index + 1 < QUESTIONS_PER_GAME ? makeQuestion(game.mode) : null;

    $("q-num").textContent = game.index + 1;
    $("question").textContent = q.question;
    $("feedback").textContent = "";
    $("feedback").className = "feedback";
    $("next").classList.add("hidden");
    $("streak").textContent = game.streak >= 2 ? `🔥 ${game.streak}연속 정답!` : "";

    const stage = $("stage");
    stage.innerHTML = q.stage;
    stage.classList.add("loading");
    q.setup?.(stage);

    const choices = $("choices");
    choices.className = "choices" + (q.grid ? " grid" : "");
    choices.innerHTML = q.choices.map((c, i) => `
      <button class="choice" data-i="${i}" ${c.color ? `style="--accent:${esc(c.color)}"` : ""} disabled>
        <span class="key">${i + 1}</span>
        ${c.img ? `<img src="${esc(c.img)}" alt="">` : ""}
        <span class="label">${esc(c.label)}${c.sub ? `<small>${esc(c.sub)}</small>` : ""}</span>
      </button>`).join("");

    // 이미지가 준비된 뒤 타이머 시작 (최대 4초 대기)
    await Promise.race([q.preloaded, new Promise((r) => setTimeout(r, 4000))]);
    if (game?.current !== q) return;
    stage.classList.remove("loading");
    choices.querySelectorAll("button").forEach((b) => (b.disabled = false));
    startTimer();
  }

  function startTimer() {
    const bar = $("timer-bar");
    const start = performance.now();
    clearInterval(timerId);
    bar.style.width = "100%";
    bar.className = "";
    timerId = setInterval(() => {
      const left = Math.max(0, TIME_LIMIT - (performance.now() - start) / 1000);
      game.timeLeft = left;
      bar.style.width = `${(left / TIME_LIMIT) * 100}%`;
      bar.className = left < 5 ? "danger" : left < 9 ? "warn" : "";
      if (left <= 0) answer(-1);
    }, 50);
    game.timeLeft = TIME_LIMIT;
  }

  function answer(i) {
    if (!game || game.answered) return;
    game.answered = true;
    clearInterval(timerId);
    const q = game.current;
    const correct = i >= 0 && q.choices[i].correct;
    const buttons = $("choices").querySelectorAll("button");
    buttons.forEach((b, j) => {
      b.disabled = true;
      if (q.choices[j].correct) b.classList.add("correct");
      else if (j === i) b.classList.add("wrong");
    });
    q.reveal?.($("stage"));

    const fb = $("feedback");
    if (correct) {
      game.streak++;
      game.correct++;
      const gained = 100 + Math.round(game.timeLeft * 10) + Math.min(game.streak - 1, 5) * 20;
      game.score += gained;
      fb.textContent = `정답! +${gained}`;
      fb.className = "feedback good";
      bumpScore();
    } else {
      game.streak = 0;
      fb.textContent = i < 0 ? `시간 초과! 정답: ${q.answerText}` : `아쉬워요! 정답: ${q.answerText}`;
      fb.className = "feedback bad";
    }
    $("streak").textContent = game.streak >= 2 ? `🔥 ${game.streak}연속 정답!` : "";
    game.history.push({ question: q.question, answer: q.answerText, img: q.reviewImg, correct });

    const last = game.index + 1 >= QUESTIONS_PER_GAME;
    $("next").textContent = last ? "결과 보기 🏆" : "다음 ▶";
    $("next").classList.remove("hidden");
    $("next").focus({ preventScroll: true });
  }

  function bumpScore() {
    const el = $("score");
    el.textContent = game.score;
    el.parentElement.classList.remove("bump");
    void el.parentElement.offsetWidth;
    el.parentElement.classList.add("bump");
  }

  function advance() {
    if (!game?.answered) return;
    game.index++;
    if (game.index >= QUESTIONS_PER_GAME) showResult();
    else nextQuestion();
  }

  function showResult() {
    const { score, correct, mode, history } = game;
    const ratio = correct / QUESTIONS_PER_GAME;
    const title = ratio === 1 ? "전설의 브롤러! 🌟" : ratio >= 0.7 ? "브롤 마스터!" : ratio >= 0.4 ? "괜찮은 실력이에요!" : "초보 브롤러…";
    $("result-title").textContent = title;
    $("result-brawler").src = figure(pick(brawlers));
    $("final-score").textContent = score;
    $("result-sub").textContent = `${QUESTIONS_PER_GAME}문제 중 ${correct}문제 정답 · ${MODES.find((m) => m.id === mode).title}`;

    const bests = store.get("brawlquiz-best") || {};
    const isBest = score > (bests[mode] || 0);
    if (isBest) {
      bests[mode] = score;
      store.set("brawlquiz-best", bests);
    }
    $("new-best").classList.toggle("hidden", !isBest || score === 0);

    $("review").innerHTML = history.map((h, i) => `
      <li class="${h.correct ? "ok" : "ng"}">
        <img src="${esc(h.img)}" alt="">
        <div><small>${i + 1}. ${esc(h.question)}</small><strong>${esc(h.answer)}</strong></div>
        <span>${h.correct ? "⭕" : "❌"}</span>
      </li>`).join("");
    showScreen("result");
  }

  function quit() {
    clearInterval(timerId);
    game = null;
    renderHome();
  }

  // ---------- 이벤트 ----------
  $("mode-list").addEventListener("click", (e) => {
    const card = e.target.closest("[data-mode]");
    if (card) startGame(card.dataset.mode);
  });
  $("choices").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-i]");
    if (btn && !btn.disabled) answer(Number(btn.dataset.i));
  });
  $("next").addEventListener("click", advance);
  $("quit").addEventListener("click", quit);
  $("retry").addEventListener("click", () => startGame(game.mode));
  $("home-btn").addEventListener("click", quit);
  document.addEventListener("keydown", (e) => {
    if (!$("quiz").classList.contains("active") || !game) return;
    if (/^[1-4]$/.test(e.key) && !game.answered) {
      const btn = $("choices").querySelector(`button[data-i="${Number(e.key) - 1}"]`);
      if (btn && !btn.disabled) answer(Number(e.key) - 1);
    } else if ((e.key === "Enter" || e.key === " ") && game.answered && document.activeElement !== $("next")) {
      e.preventDefault();
      advance();
    }
  });

  renderHome();
})();
