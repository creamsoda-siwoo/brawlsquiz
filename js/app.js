(() => {
  "use strict";

  const DATA = window.BRAWL_DATA;
  const QUESTIONS_PER_GAME = 10;

  // 난이도별 규칙
  const DIFFICULTIES = {
    normal: {
      label: "보통", desc: "보기 4개 · 15초",
      time: 15, choices: 4, zoom: 2.8, itemNames: true, blur: false, closeStats: false,
      scoreRate: 1, penalty: 0,
    },
    hard: {
      label: "어려움", desc: "보기 6개 · 10초 · 비슷한 브롤러끼리 · 오답 -50점",
      time: 10, choices: 6, zoom: 4.5, itemNames: false, blur: true, closeStats: true,
      scoreRate: 1.5, penalty: 50,
    },
    hell: {
      label: "지옥 🔥", desc: "보기 8개 · 6초 · 흑백·좌우반전 · 목숨 3개 · 오답 -150점",
      time: 6, choices: 8, zoom: 7, itemNames: false, blur: true, closeStats: true,
      heavy: true, mirror: true, grayMaps: true, lives: 3,
      scoreRate: 2.5, penalty: 150,
    },
  };

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

  // 이름·희귀도·역할군·모드는 모두 게임 공식 한국어 표기 (js/data.js)
  const rarityName = (r) => DATA.rarities[r].name;
  const className = (c) => DATA.classes[c];
  const modeName = (m) => DATA.modes[m].name;

  let difficulty = "hard";
  const D = () => DIFFICULTIES[difficulty];
  const optionCount = () => D().choices - 1; // 정답을 뺀 오답 개수

  // 난이도에 따라 문제 이미지를 가리는 효과 (흐림·흑백·좌우 반전)
  const obscure = ({ blur = true } = {}) => [
    blur && D().blur && "blurred",
    blur && D().heavy && "heavy",
    D().mirror && Math.random() < 0.5 && "mirrored",
  ].filter(Boolean).join(" ");
  const unveil = (stage) => stage.querySelectorAll(".blurred, .mirrored, .grayscale")
    .forEach((el) => el.classList.remove("blurred", "heavy", "mirrored", "grayscale"));

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
  const withDesc = brawlers.filter((b) => b.desc);
  const withPin = brawlers.filter((b) => b.pin);
  const withHyper = brawlers.filter((b) => b.hypercharge);
  const withSkills = brawlers.filter((b) => b.attack && b.super);
  const withSkins = brawlers.filter((b) => b.skins.length);
  const rarities = Object.keys(DATA.rarities);
  const classes = Object.keys(DATA.classes);
  const mapModes = Object.keys(DATA.modes);

  // 오답 브롤러 고르기
  // 보통: 절반은 같은 역할군, 어려움: 역할군·희귀도가 같은 비슷한 브롤러부터
  function brawlerDistractors(answer, n = optionCount()) {
    const others = brawlers.filter((b) => b.id !== answer.id);
    if (difficulty === "normal") {
      const sameClass = sample(others, 2, (b) => b.class !== answer.class);
      return [...sameClass, ...sample(others, n - sameClass.length, (b) => sameClass.includes(b))];
    }
    const similarity = (b) => (b.class === answer.class ? 2 : 0) + (b.rarity === answer.rarity ? 1 : 0);
    return shuffle(others)
      .sort((a, b) => similarity(b) - similarity(a))
      .slice(0, n);
  }

  // 정답 하나 + 오답 여러 개를 섞은 보기 목록
  const withOptions = (answer, pool) => shuffle([answer, ...sample(pool, optionCount(), (x) => x === answer)]);

  const nameChoices = (answer) =>
    shuffle([answer, ...brawlerDistractors(answer)]).map((b) => ({
      label: b.name, correct: b.id === answer.id,
    }));

  const portraitChoices = (answer) =>
    shuffle([answer, ...brawlerDistractors(answer)]).map((b) => ({
      label: b.name, img: b.icon, correct: b.id === answer.id,
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
        stage: brawlerImg(figure(b), obscure()),
        images: [figure(b)],
        choices: nameChoices(b),
        answerText: b.name,
        reviewImg: b.icon,
        reveal: unveil,
      };
    },

    silhouette() {
      const b = pick(brawlers);
      return {
        question: "그림자 속 브롤러는 누구?",
        stage: brawlerImg(figure(b), `silhouette ${obscure({ blur: false })}`),
        images: [figure(b)],
        choices: nameChoices(b),
        answerText: b.name,
        reviewImg: b.icon,
        reveal: (stage) => { stage.querySelector("img").classList.remove("silhouette"); unveil(stage); },
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
        answerText: b.name,
        reviewImg: b.icon,
        setup: (stage) => {
          const img = stage.querySelector("img");
          img.style.transformOrigin = `${x}% ${y}%`;
          img.style.setProperty("--zoom", D().zoom);
        },
        reveal: (stage) => stage.querySelector("img").classList.remove("zoomed"),
      };
    },

    gadget() {
      const b = pick(withGadgets);
      const g = pick(b.gadgets);
      return {
        question: "이 가젯을 가진 브롤러는?",
        stage: itemCard("gadget", g),
        images: [g.img],
        choices: portraitChoices(b),
        answerText: `${b.name} · ${g.name}`,
        reviewImg: g.img,
        grid: true,
      };
    },

    starPower() {
      const b = pick(withStarPowers);
      const s = pick(b.starPowers);
      return {
        question: "이 스타 파워를 가진 브롤러는?",
        stage: itemCard("star", s),
        images: [s.img],
        choices: portraitChoices(b),
        answerText: `${b.name} · ${s.name}`,
        reviewImg: s.img,
        grid: true,
      };
    },

    rarity() {
      const b = pick(brawlers);
      const options = withOptions(b.rarity, rarities);
      return {
        question: `${b.name}의 희귀도는?`,
        stage: brawlerImg(figure(b)),
        images: [figure(b)],
        choices: options.map((r) => ({ label: rarityName(r), color: DATA.rarities[r].color, correct: r === b.rarity })),
        answerText: `${b.name} · ${rarityName(b.rarity)}`,
        reviewImg: b.icon,
      };
    },

    role() {
      const b = pick(brawlers);
      const options = withOptions(b.class, classes);
      return {
        question: `${b.name}의 역할군은?`,
        stage: brawlerImg(figure(b)),
        images: [figure(b)],
        choices: options.map((c) => ({ label: className(c), correct: c === b.class })),
        answerText: `${b.name} · ${className(b.class)}`,
        reviewImg: b.icon,
      };
    },

    map() {
      const m = pick(DATA.maps);
      const options = withOptions(m.mode, mapModes);
      return {
        question: "이 맵의 게임 모드는?",
        stage: `<div class="map-box"><img class="${D().grayMaps ? "grayscale" : ""}" src="${esc(m.img)}" alt=""></div>`,
        images: [m.img],
        choices: options.map((k) => ({ label: modeName(k), img: DATA.modes[k].img, color: DATA.modes[k].color, correct: k === m.mode })),
        answerText: `${m.name} · ${modeName(m.mode)}`,
        reviewImg: DATA.modes[m.mode].img,
        reveal: unveil,
      };
    },

    mapName() {
      const m = pick(DATA.maps);
      // 같은 모드의 다른 맵 이름을 오답으로 사용
      const names = [...new Set(DATA.maps.filter((x) => x.mode === m.mode).map((x) => x.name))].filter((n) => n !== m.name);
      const options = withOptions(m.name, names);
      return {
        question: "이 맵의 이름은?",
        stage: `<div class="map-box"><img src="${esc(m.img)}" alt=""><span class="map-mode"><img src="${esc(DATA.modes[m.mode].img)}" alt="">${esc(modeName(m.mode))}</span></div>`,
        images: [m.img],
        choices: options.map((n) => ({ label: n, correct: n === m.name })),
        answerText: m.name,
        reviewImg: DATA.modes[m.mode].img,
      };
    },

    description() {
      const b = pick(withDesc);
      return {
        question: "이 설명은 어떤 브롤러일까?",
        stage: `<blockquote class="desc-card">${esc(b.desc)}</blockquote>`,
        images: [],
        choices: portraitChoices(b),
        answerText: b.name,
        reviewImg: b.icon,
        grid: true,
      };
    },

    pin() {
      const b = pick(withPin);
      return {
        question: "이 핀의 주인은?",
        stage: `<img class="pin-img ${obscure()}" src="${esc(b.pin)}" alt="">`,
        images: [b.pin],
        choices: nameChoices(b),
        answerText: b.name,
        reviewImg: b.pin,
        reveal: unveil,
      };
    },

    hypercharge() {
      const b = pick(withHyper);
      return {
        question: "이 하이퍼차지를 쓰는 브롤러는?",
        stage: textCard("hyper", "⚡ 하이퍼차지", b.hypercharge),
        images: [],
        choices: portraitChoices(b),
        answerText: `${b.name} · ${b.hypercharge}`,
        reviewImg: b.icon,
        grid: true,
      };
    },

    skill() {
      const b = pick(withSkills);
      const isSuper = Math.random() < 0.5;
      const name = isSuper ? b.super : b.attack;
      return {
        question: isSuper ? "이 궁극기를 쓰는 브롤러는?" : "이 기본 공격을 쓰는 브롤러는?",
        stage: textCard(isSuper ? "super" : "attack", isSuper ? "💥 궁극기" : "🔫 기본 공격", name),
        images: [],
        choices: portraitChoices(b),
        answerText: `${b.name} · ${name}`,
        reviewImg: b.icon,
        grid: true,
      };
    },

    skin() {
      const b = pick(withSkins);
      const skin = pick(b.skins);
      return {
        question: "이 스킨은 어떤 브롤러의 것?",
        stage: textCard("skin", "👕 스킨", skin),
        images: [],
        choices: portraitChoices(b),
        answerText: skin.replaceAll("○○○", b.name),
        reviewImg: b.icon,
        grid: true,
      };
    },

    gear() {
      const g = pick(DATA.gears);
      const options = withOptions(g, DATA.gears);
      return {
        question: "이 기어의 이름은?",
        stage: `<div class="item-card"><img src="${esc(g.img)}" alt=""></div>`,
        images: [g.img],
        choices: options.map((x) => ({ label: x.name, correct: x === g })),
        answerText: g.name,
        reviewImg: g.img,
      };
    },

    hp() {
      return compareQuestion("hp", "체력이 더 높은 브롤러는?", "체력");
    },

    speed() {
      return compareQuestion("speed", "이동 속도가 더 빠른 브롤러는?", "속도");
    },
  };

  // 가젯·스타 파워 카드: 어려움에서는 이름을 숨겼다가 정답 공개 때 보여줌
  function itemCard(kind, item) {
    const name = D().itemNames ? `<span>${esc(item.name)}</span>` : `<span class="hidden-name">???</span>`;
    return `<div class="item-card ${kind}"><img src="${esc(item.img)}" alt="">${name}</div>`;
  }

  function textCard(kind, badge, text) {
    return `<div class="text-card ${kind}"><span class="badge">${esc(badge)}</span><strong>${esc(text)}</strong></div>`;
  }

  // 두 브롤러의 능력치(값이 다른 쌍)를 비교하는 문제
  // 어려움: 값 차이가 가장 작은 쌍 중에서 골라 헷갈리게 함
  function compareQuestion(stat, question, label) {
    const a = pick(brawlers.filter((x) => x[stat]));
    const rivals = brawlers.filter((x) => x[stat] && x[stat] !== a[stat]);
    const b = D().closeStats
      ? pick(rivals.sort((x, y) => Math.abs(x[stat] - a[stat]) - Math.abs(y[stat] - a[stat])).slice(0, difficulty === "hell" ? 1 : 3))
      : pick(rivals);
    const win = a[stat] > b[stat] ? a : b;
    const pair = shuffle([a, b]);
    return {
      question,
      stage: `<div class="versus">${pair.map((x) => brawlerImg(figure(x))).join('<span class="vs">VS</span>')}</div>`,
      images: pair.map(figure),
      choices: pair.map((x) => ({ label: x.name, img: x.icon, correct: x === win })),
      answerText: pair.map((x) => `${x.name} ${label} ${x[stat].toLocaleString()}`).join(" vs "),
      reviewImg: win.icon,
      grid: true,
    };
  }

  const MODES = [
    { id: "mix", title: "랜덤 믹스", desc: "모든 유형이 섞여 나와요", thumb: () => pick(brawlers).icon, featured: true },
    { group: "브롤러", id: "portrait", title: "브롤러 맞히기", desc: "얼굴을 보고 이름을 맞혀요", thumb: () => pick(brawlers).icon },
    { id: "silhouette", title: "실루엣 퀴즈", desc: "그림자만 보고 맞혀요", thumb: () => figure(pick(brawlers)), thumbClass: "silhouette" },
    { id: "zoom", title: "줌 퀴즈", desc: "확대된 일부만 보고 맞혀요", thumb: () => pick(brawlers).img, thumbClass: "thumb-zoom" },
    { id: "pin", title: "핀 퀴즈", desc: "핀 표정을 보고 맞혀요", thumb: () => pick(withPin).pin },
    { id: "description", title: "설명 퀴즈", desc: "게임 속 소개글을 보고 맞혀요", thumb: () => pick(brawlers).icon },
    { group: "능력·아이템", id: "gadget", title: "가젯 퀴즈", desc: "가젯의 주인을 찾아요", thumb: () => pick(pick(withGadgets).gadgets).img },
    { id: "starPower", title: "스타 파워 퀴즈", desc: "스타 파워의 주인을 찾아요", thumb: () => pick(pick(withStarPowers).starPowers).img },
    { id: "hypercharge", title: "하이퍼차지 퀴즈", desc: "하이퍼차지 이름으로 맞혀요", thumb: () => pick(brawlers).icon },
    { id: "skill", title: "스킬 퀴즈", desc: "기본 공격·궁극기 이름으로 맞혀요", thumb: () => pick(brawlers).icon },
    { id: "gear", title: "기어 퀴즈", desc: "기어 아이콘을 보고 이름을 맞혀요", thumb: () => pick(DATA.gears).img },
    { id: "skin", title: "스킨 퀴즈", desc: "스킨 이름으로 주인을 찾아요", thumb: () => pick(brawlers).icon },
    { group: "정보·능력치", id: "rarity", title: "희귀도 퀴즈", desc: "브롤러의 희귀도는?", thumb: () => pick(brawlers).icon },
    { id: "role", title: "역할군 퀴즈", desc: "탱커? 저격수? 어쌔신?", thumb: () => pick(brawlers).icon },
    { id: "hp", title: "체력 비교", desc: "누구 체력이 더 높을까?", thumb: () => pick(brawlers).icon },
    { id: "speed", title: "속도 비교", desc: "누가 더 빠를까?", thumb: () => pick(brawlers).icon },
    { group: "맵", id: "map", title: "맵 모드 퀴즈", desc: "맵을 보고 모드를 맞혀요", thumb: () => DATA.modes[pick(mapModes)].img },
    { id: "mapName", title: "맵 이름 퀴즈", desc: "맵을 보고 이름을 맞혀요", thumb: () => DATA.modes[pick(mapModes)].img },
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
  // 최고 점수는 난이도별로 따로 저장 (보통은 예전 기록과 같은 키)
  const bestKey = (mode) => (difficulty === "normal" ? mode : `${mode}:${difficulty}`);

  function renderDifficulty() {
    $("difficulty").innerHTML = Object.entries(DIFFICULTIES).map(([id, d]) => `
      <button role="radio" aria-checked="${id === difficulty}" class="${id === difficulty ? "active" : ""}" data-difficulty="${id}">${d.label}</button>`).join("");
    $("difficulty-desc").textContent = D().desc;
  }

  function renderHome() {
    const saved = store.get("brawlquiz-difficulty");
    if (DIFFICULTIES[saved]) difficulty = saved;
    renderDifficulty();
    const allBests = store.get("brawlquiz-best") || {};
    const bests = Object.fromEntries(MODES.map((m) => [m.id, allBests[bestKey(m.id)]]));
    $("best-score").textContent = Math.max(0, ...Object.values(bests).filter(Boolean));
    $("logo-brawler").src = figure(pick(brawlers));
    $("mode-list").innerHTML = MODES.map((m) => `
      ${m.group ? `<h3 class="mode-group">${m.group}</h3>` : ""}
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
    game = { mode: modeId, difficulty, lives: D().lives, over: false, index: 0, score: 0, correct: 0, streak: 0, history: [], current: null, next: makeQuestion(modeId) };
    $("q-total").textContent = QUESTIONS_PER_GAME;
    renderLives();
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
    choices.className = "choices" + (q.grid ? " grid" : "") + (q.choices.length > 4 ? " many" : "") + (q.choices.length > 6 ? " lots" : "");
    choices.innerHTML = q.choices.map((c, i) => `
      <button class="choice" data-i="${i}" ${c.color ? `style="--accent:${esc(c.color)}"` : ""} disabled>
        <span class="key">${i + 1}</span>
        ${c.img ? `<img src="${esc(c.img)}" alt="">` : ""}
        <span class="label">${esc(c.label)}</span>
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
      const limit = D().time;
      const left = Math.max(0, limit - (performance.now() - start) / 1000);
      game.timeLeft = left;
      bar.style.width = `${(left / limit) * 100}%`;
      bar.className = left < limit / 3 ? "danger" : left < limit * 0.6 ? "warn" : "";
      if (left <= 0) answer(-1);
    }, 50);
    game.timeLeft = D().time;
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
    $("stage").querySelectorAll(".hidden-name").forEach((el) => {
      el.textContent = q.answerText.split(" · ")[1] || "";
      el.classList.remove("hidden-name");
    });

    const fb = $("feedback");
    if (correct) {
      game.streak++;
      game.correct++;
      const base = 100 + Math.round((game.timeLeft / D().time) * 150) + Math.min(game.streak - 1, 5) * 20;
      const gained = Math.round(base * D().scoreRate);
      game.score += gained;
      fb.textContent = `정답! +${gained}`;
      fb.className = "feedback good";
      bumpScore();
    } else {
      game.streak = 0;
      const lost = Math.min(game.score, D().penalty);
      game.score -= lost;
      if (lost) bumpScore();
      const penaltyText = lost ? ` (-${lost})` : "";
      fb.textContent = (i < 0 ? `시간 초과!${penaltyText} 정답: ` : `아쉬워요!${penaltyText} 정답: `) + q.answerText;
      if (game.lives) {
        game.lives--;
        game.over = game.lives === 0;
        renderLives();
      }
      fb.className = "feedback bad";
    }
    $("streak").textContent = game.streak >= 2 ? `🔥 ${game.streak}연속 정답!` : "";
    game.history.push({ question: q.question, answer: q.answerText, img: q.reviewImg, correct });

    const last = game.over || game.index + 1 >= QUESTIONS_PER_GAME;
    $("next").textContent = game.over ? "게임 오버 💀" : last ? "결과 보기 🏆" : "다음 ▶";
    $("next").classList.remove("hidden");
    $("next").focus({ preventScroll: true });
  }

  // 지옥 난이도의 남은 목숨 표시
  function renderLives() {
    const max = D().lives;
    $("lives").innerHTML = max
      ? Array.from({ length: max }, (_, i) => `<span class="${i < game.lives ? "" : "lost"}">❤️</span>`).join("")
      : "";
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
    if (game.over || game.index >= QUESTIONS_PER_GAME) showResult();
    else nextQuestion();
  }

  function showResult() {
    const { score, correct, mode, history } = game;
    const ratio = correct / QUESTIONS_PER_GAME;
    const title = game.over ? "지옥에서 탈락… 💀" : ratio === 1 ? "전설의 브롤러! 🌟" : ratio >= 0.7 ? "브롤 마스터!" : ratio >= 0.4 ? "괜찮은 실력이에요!" : "초보 브롤러…";
    $("result-title").textContent = title;
    $("result-brawler").src = figure(pick(brawlers));
    $("final-score").textContent = score;
    const progress = game.over ? `${history.length}번째 문제에서 목숨 소진 · ` : "";
    $("result-sub").textContent = `${progress}${QUESTIONS_PER_GAME}문제 중 ${correct}문제 정답 · ${MODES.find((m) => m.id === mode).title} · ${D().label}`;

    const bests = store.get("brawlquiz-best") || {};
    const isBest = score > (bests[bestKey(mode)] || 0);
    if (isBest) {
      bests[bestKey(mode)] = score;
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
  $("difficulty").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-difficulty]");
    if (!btn) return;
    store.set("brawlquiz-difficulty", btn.dataset.difficulty);
    renderHome();
  });
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
    if (/^[1-8]$/.test(e.key) && !game.answered) {
      const btn = $("choices").querySelector(`button[data-i="${Number(e.key) - 1}"]`);
      if (btn && !btn.disabled) answer(Number(e.key) - 1);
    } else if ((e.key === "Enter" || e.key === " ") && game.answered && document.activeElement !== $("next")) {
      e.preventDefault();
      advance();
    }
  });

  renderHome();
})();
