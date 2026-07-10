(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const canvas = $("gameCanvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const finish = 1000;
  const lanes = [330, 480, 630];
  const names = { rabbit: "Ruby Rabbit", fox: "Freddie Fox", panda: "Poppy Panda", crocodile: "Charlie Croc" };
  const emoji = { rabbit: "🐰", fox: "🦊", panda: "🐼", crocodile: "🐊" };
  const colours = { rabbit: "#f7dce7", fox: "#f59a4a", panda: "#e8e8ee", crocodile: "#78c66a" };

  let selected = localStorage.getItem("animalDashAnimal") || "rabbit";
  let soundOn = localStorage.getItem("animalDashSound") !== "off";
  let hat = localStorage.getItem("animalDashPartyHat") === "yes";
  let game = null;
  let frame = 0;
  let audio = null;

  function bestKey() { return `animalDashBest_${selected}`; }
  function bestTime() { return Number(localStorage.getItem(bestKey())) || 0; }
  function ordinal(n) { return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`; }
  function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

  function show(screen) {
    [$("menuScreen"), $("gameScreen"), $("resultsScreen")].forEach((el) => el.classList.add("hidden"));
    screen.classList.remove("hidden");
  }

  function refreshMenu() {
    document.querySelectorAll(".animal-card").forEach((card) => {
      const chosen = card.dataset.animal === selected;
      card.classList.toggle("selected", chosen);
      card.setAttribute("aria-checked", String(chosen));
    });
    $("soundButton").textContent = soundOn ? "🔊" : "🔇";
  }

  function beep(freq, duration = 0.09, delay = 0) {
    if (!soundOn) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audio ||= new Audio();
    if (audio.state === "suspended") audio.resume();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const start = audio.currentTime + delay;
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.055, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(start);
    osc.stop(start + duration);
  }

  function message(text) {
    const bubble = $("messageBubble");
    bubble.textContent = text;
    bubble.classList.remove("hidden");
    clearTimeout(message.timer);
    message.timer = setTimeout(() => bubble.classList.add("hidden"), 800);
  }

  function makeCourse() {
    const fruits = ["🍓", "🍌", "🍊", "🍇", "🍏"];
    const items = [];
    for (let d = 80, i = 0; d < finish - 30; d += 48, i += 1) {
      const mud = i % 4 === 2;
      items.push({ d, lane: (i * 2 + Math.floor(i / 3)) % 3, kind: mud ? "mud" : "fruit", icon: fruits[i % fruits.length], used: false });
    }
    return items;
  }

  function newGame() {
    const others = Object.keys(names).filter((key) => key !== selected).sort(() => Math.random() - 0.5);
    return {
      phase: "countdown",
      start: 0,
      elapsed: 0,
      camera: 0,
      player: { lane: 1, target: 1, x: lanes[1], d: 0, jump: 0, vy: 0, speed: 34, boost: 0, slow: 0, fruit: 0 },
      opponents: others.map((type, i) => ({ type, lane: i, d: -8 - i * 7, speed: 32.4 + Math.random() * 3.2, finishTime: 0 })),
      items: makeCourse(),
      finished: false
    };
  }

  async function startRace() {
    cancelAnimationFrame(frame);
    game = newGame();
    show($("gameScreen"));
    updateHud();
    draw();
    const count = $("countdown");
    count.classList.remove("hidden");
    for (const text of ["3", "2", "1"]) {
      count.textContent = text;
      beep(430);
      await wait(620);
    }
    count.textContent = "GO!";
    beep(680, 0.12);
    beep(900, 0.15, 0.1);
    game.phase = "racing";
    game.start = performance.now();
    await wait(450);
    count.classList.add("hidden");
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.04);
      last = now;
      if (game && game.phase === "racing") update(dt);
      draw();
      if (game && !game.finished) frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
  }

  function update(dt) {
    const p = game.player;
    game.elapsed = (performance.now() - game.start) / 1000;
    p.boost = Math.max(0, p.boost - dt);
    p.slow = Math.max(0, p.slow - dt);
    p.x += (lanes[p.target] - p.x) * Math.min(1, dt * 11);

    if (p.jump > 0 || p.vy > 0) {
      p.jump += p.vy * dt;
      p.vy -= 1020 * dt;
      if (p.jump <= 0) { p.jump = 0; p.vy = 0; }
    }

    const speed = p.speed * (p.boost > 0 ? 1.34 : 1) * (p.slow > 0 ? 0.58 : 1);
    p.d += speed * dt;
    game.camera = Math.max(0, p.d - 90);

    game.opponents.forEach((o, i) => {
      if (o.d >= finish) return;
      const wobble = Math.sin(game.elapsed * 1.1 + i * 2.2) * 0.9;
      o.d += (o.speed + wobble) * dt;
      if (o.d >= finish && !o.finishTime) o.finishTime = game.elapsed;
    });

    game.items.forEach((item) => {
      if (item.used || item.lane !== p.target || Math.abs(item.d - p.d) > 10) return;
      if (item.kind === "fruit") {
        item.used = true;
        p.fruit += 1;
        p.boost = 1.2;
        beep(760);
        beep(980, 0.11, 0.06);
        message("Fruit boost! ⚡");
      } else if (p.jump < 18) {
        item.used = true;
        p.slow = 1.1;
        beep(130, 0.2);
        message("Splish splash! 💦");
      }
    });

    updateHud();
    if (p.d >= finish) finishRace();
  }

  function currentPlace() {
    return 1 + game.opponents.filter((o) => o.d > game.player.d).length;
  }

  function updateHud() {
    if (!game) return;
    $("placeValue").textContent = ordinal(currentPlace());
    $("fruitValue").textContent = game.player.fruit;
    $("progressFill").style.width = `${Math.min(100, game.player.d / finish * 100)}%`;
    $("bestTimeValue").textContent = bestTime() ? `${bestTime().toFixed(1)}s` : "—";
  }

  function finishRace() {
    if (game.finished) return;
    game.finished = true;
    game.phase = "finished";
    const time = game.elapsed;
    const place = currentPlace();
    const oldBest = bestTime();
    const newBest = !oldBest || time < oldBest;
    if (newBest) localStorage.setItem(bestKey(), String(time));
    if (!hat && (place === 1 || game.player.fruit >= 6)) {
      hat = true;
      localStorage.setItem("animalDashPartyHat", "yes");
    }
    [523, 659, 784, 1047].forEach((n, i) => beep(n, 0.28, i * 0.11));
    setTimeout(() => showResults(place, time, newBest), 450);
  }

  function showResults(place, time, newBest) {
    show($("resultsScreen"));
    $("resultHeading").textContent = place === 1 ? "You won the race!" : "Brilliant racing!";
    $("resultText").textContent = `${names[selected]} zoomed over the finish line${newBest ? " with a new best time!" : "!"}`;
    $("resultPlace").textContent = ordinal(place);
    $("resultTime").textContent = `${time.toFixed(1)}s`;
    $("resultFruit").textContent = game.player.fruit;
    $("resultAnimal").className = `result-animal ${selected}`;
    $("resultAnimal").innerHTML = "<span></span>";
    $("unlockMessage").textContent = hat ? "🎉 Party hat unlocked for your next race!" : "Collect six fruit or finish first to unlock a party hat.";
    $("unlockMessage").classList.remove("hidden");
    confetti();
  }

  function confetti() {
    const box = $("resultConfetti");
    box.innerHTML = "";
    for (let i = 0; i < 45; i += 1) {
      const bit = document.createElement("i");
      bit.style.left = `${Math.random() * 100}%`;
      bit.style.background = ["#6c63ff", "#ffd65a", "#ff83b1", "#50c878"][i % 4];
      bit.style.animationDelay = `${Math.random() * 0.7}s`;
      bit.style.setProperty("--drift", `${Math.random() * 160 - 80}px`);
      box.appendChild(bit);
    }
  }

  function move(dir) {
    if (game?.phase !== "racing") return;
    game.player.target = Math.max(0, Math.min(2, game.player.target + dir));
  }

  function jump() {
    if (game?.phase !== "racing" || game.player.jump > 1) return;
    game.player.vy = 490;
    beep(360, 0.14);
  }

  function sy(distance) { return 420 - (distance - game.camera) * 3.2; }

  function rounded(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#86dcff");
    sky.addColorStop(0.55, "#dff8ff");
    sky.addColorStop(0.56, "#8dd86f");
    sky.addColorStop(1, "#5cad55");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,.86)";
    for (let i = 0; i < 5; i += 1) {
      const x = 80 + i * 210 - ((game?.camera || 0) * 0.7 % 210);
      ctx.beginPath(); ctx.arc(x, 80 + (i % 2) * 28, 30, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 34, 83 + (i % 2) * 28, 22, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawRoad() {
    ctx.fillStyle = "#555b69";
    ctx.fillRect(245, 0, 470, H);
    ctx.strokeStyle = "rgba(255,255,255,.75)";
    ctx.lineWidth = 6;
    ctx.setLineDash([26, 25]);
    ctx.lineDashOffset = (game?.camera || 0) * 3.2;
    [402, 558].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); });
    ctx.setLineDash([]);
    ctx.strokeStyle = "#fff2a0";
    ctx.lineWidth = 7;
    [249, 711].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); });
  }

  function drawScenery() {
    for (let i = 0; i < 14; i += 1) {
      const d = i * 86;
      const y = sy(((d - (game?.camera || 0)) % 1200 + 1200) % 1200 + (game?.camera || 0));
      if (y < -80 || y > H + 80) continue;
      const x = i % 2 ? 790 + (i % 3) * 35 : 170 - (i % 3) * 35;
      ctx.fillStyle = "#805b3c"; ctx.fillRect(x - 8, y, 16, 44);
      ctx.fillStyle = i % 3 ? "#45ad55" : "#66c95e";
      ctx.beginPath(); ctx.arc(x, y - 12, 31, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawItems() {
    game.items.forEach((item) => {
      if (item.used) return;
      const y = sy(item.d);
      if (y < -60 || y > H + 60) return;
      const x = lanes[item.lane];
      if (item.kind === "fruit") {
        ctx.font = "40px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(item.icon, x, y + 12);
      } else {
        ctx.fillStyle = "#6b4939";
        ctx.beginPath(); ctx.ellipse(x, y + 8, 52, 20, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#9b7054";
        ctx.beginPath(); ctx.ellipse(x - 10, y + 3, 20, 6, 0, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  function drawFinish() {
    const y = sy(finish);
    if (y < -80 || y > H + 80) return;
    for (let row = 0; row < 2; row += 1) for (let col = 0; col < 20; col += 1) {
      ctx.fillStyle = (row + col) % 2 ? "#222" : "#fff";
      ctx.fillRect(245 + col * 24, y + row * 24, 24, 24);
    }
  }

  function drawRacer(x, y, type, player = false, jumpHeight = 0) {
    ctx.save();
    if (player) {
      ctx.fillStyle = "rgba(0,0,0,.2)";
      ctx.beginPath(); ctx.ellipse(x, y + jumpHeight + 34, 34, 10, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.translate(x, y);
    ctx.fillStyle = colours[type];
    rounded(-40, -42, 80, 84, 28); ctx.fill();
    ctx.font = type === "crocodile" ? "58px system-ui" : "64px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji[type], 0, 0);
    if (player) {
      ctx.fillStyle = "white";
      ctx.strokeStyle = "#6c63ff";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, -60, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#6c63ff"; ctx.font = "18px system-ui"; ctx.fillText("★", 0, -60);
      if (hat) { ctx.font = "35px system-ui"; ctx.fillText("🥳", 0, -53); }
    }
    ctx.restore();
  }

  function drawRacers() {
    const racers = game.opponents.map((o, i) => ({ x: lanes[o.lane] + (Math.abs(o.d - game.player.d) < 18 ? (i % 2 ? 30 : -30) : 0), y: sy(o.d), type: o.type, p: false }));
    racers.push({ x: game.player.x, y: 420 - game.player.jump, type: selected, p: true, jump: game.player.jump });
    racers.sort((a, b) => a.y - b.y).forEach((r) => { if (r.y > -90 && r.y < H + 90) drawRacer(r.x, r.y, r.type, r.p, r.jump || 0); });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawScenery();
    drawRoad();
    if (!game) return;
    drawFinish();
    drawItems();
    drawRacers();
  }

  document.querySelectorAll(".animal-card").forEach((card) => card.addEventListener("click", () => {
    selected = card.dataset.animal;
    localStorage.setItem("animalDashAnimal", selected);
    refreshMenu();
    beep(620);
  }));

  $("startButton").addEventListener("click", startRace);
  $("raceAgainButton").addEventListener("click", startRace);
  $("chooseAgainButton").addEventListener("click", () => { cancelAnimationFrame(frame); game = null; show($("menuScreen")); });
  $("leftButton").addEventListener("pointerdown", (e) => { e.preventDefault(); move(-1); });
  $("rightButton").addEventListener("pointerdown", (e) => { e.preventDefault(); move(1); });
  $("jumpButton").addEventListener("pointerdown", (e) => { e.preventDefault(); jump(); });
  $("soundButton").addEventListener("click", () => { soundOn = !soundOn; localStorage.setItem("animalDashSound", soundOn ? "on" : "off"); refreshMenu(); if (soundOn) beep(800); });

  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
    if (e.repeat) return;
    if (e.key === "ArrowLeft") move(-1);
    if (e.key === "ArrowRight") move(1);
    if (e.key === " ") jump();
  }, { passive: false });

  refreshMenu();
  game = newGame();
  game.camera = 30;
  draw();
  game = null;

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
})();
