const screens = {
  setup: document.querySelector("#setup-screen"),
  pass: document.querySelector("#pass-screen"),
  input: document.querySelector("#input-screen"),
  result: document.querySelector("#result-screen"),
  gameOver: document.querySelector("#game-over-screen"),
};

const setupForm = document.querySelector("#setup-form");
const playerCount = document.querySelector("#player-count");
const playerCountLabel = document.querySelector("#player-count-label");
const playerNameList = document.querySelector("#player-name-list");
const decreasePlayers = document.querySelector("#decrease-players");
const increasePlayers = document.querySelector("#increase-players");

const roundLabel = document.querySelector("#round-label");
const inputRoundLabel = document.querySelector("#input-round-label");
const resultRoundLabel = document.querySelector("#result-round-label");
const handoffPlayer = document.querySelector("#handoff-player");
const handoffNote = document.querySelector("#handoff-note");
const readyButton = document.querySelector("#ready-button");
const choiceForm = document.querySelector("#choice-form");
const choicePlayer = document.querySelector("#choice-player");
const choiceNumber = document.querySelector("#choice-number");
const choiceRange = document.querySelector("#choice-range");
const inputProgress = document.querySelector("#input-progress");
const quickPicks = document.querySelector(".quick-picks");

const resultType = document.querySelector("#result-type");
const resultTitle = document.querySelector("#result-title");
const resultSummary = document.querySelector("#result-summary");
const resultStats = document.querySelector("#result-stats");
const choiceReveal = document.querySelector("#choice-reveal");
const eliminationList = document.querySelector("#elimination-list");
const nextRoundButton = document.querySelector("#next-round-button");
const backToSetup = document.querySelector("#back-to-setup");
const restartButton = document.querySelector("#restart-button");
const gameOverTitle = document.querySelector("#game-over-title");
const gameOverSummary = document.querySelector("#game-over-summary");

const scoreDialog = document.querySelector("#score-dialog");
const scoreList = document.querySelector("#score-list");
const showScoreboard = document.querySelector("#show-scoreboard");
const resultScoreboardButton = document.querySelector("#result-scoreboard-button");

const state = {
  players: [],
  round: 1,
  turnIndex: 0,
  inputs: new Map(),
  lastEliminated: [],
};

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.add("hidden"));
  screens[name].classList.remove("hidden");
}

function activePlayers() {
  return state.players.filter((player) => player.active);
}

function clampChoice(value) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) return 0;
  return Math.min(100, Math.max(0, number));
}

function renderPlayerNameInputs() {
  const count = Number(playerCount.value);
  playerCountLabel.value = String(count);
  playerNameList.innerHTML = "";

  for (let index = 0; index < count; index += 1) {
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 18;
    input.placeholder = `プレイヤー${index + 1}`;
    input.value = input.dataset.previousName || "";
    input.ariaLabel = `プレイヤー${index + 1}の名前`;
    playerNameList.append(input);
  }
}

function updatePlayerCount(delta) {
  const next = Math.min(10, Math.max(2, Number(playerCount.value) + delta));
  playerCount.value = String(next);
  renderPlayerNameInputs();
}

function startGame(event) {
  event.preventDefault();
  const names = [...playerNameList.querySelectorAll("input")].map((input, index) => {
    const trimmed = input.value.trim();
    return trimmed || `プレイヤー${index + 1}`;
  });

  state.players = names.map((name, index) => ({
    id: createPlayerId(index),
    name,
    score: 0,
    active: true,
  }));
  state.round = 1;
  beginRound();
}

function beginRound() {
  state.turnIndex = 0;
  state.inputs = new Map();
  state.lastEliminated = [];
  renderPassScreen();
}

function renderPassScreen() {
  const players = activePlayers();
  const current = players[state.turnIndex];

  roundLabel.textContent = `Round ${state.round}`;
  handoffPlayer.textContent = current.name;
  handoffNote.textContent = `${state.turnIndex + 1} / ${players.length} 人目。本人だけが画面を見てください。`;
  showScreen("pass");
}

function renderInputScreen() {
  const players = activePlayers();
  const current = players[state.turnIndex];

  inputRoundLabel.textContent = `Round ${state.round}`;
  inputProgress.textContent = `${state.turnIndex + 1} / ${players.length}`;
  choicePlayer.textContent = current.name;
  setChoiceValue(50);
  showScreen("input");
  choiceNumber.focus();
  choiceNumber.select();
}

function setChoiceValue(value) {
  const next = clampChoice(value);
  choiceNumber.value = String(next);
  choiceRange.value = String(next);
}

function submitChoice(event) {
  event.preventDefault();
  const players = activePlayers();
  const current = players[state.turnIndex];
  state.inputs.set(current.id, clampChoice(choiceNumber.value));

  state.turnIndex += 1;
  if (state.turnIndex >= players.length) {
    resolveRound();
    return;
  }

  renderPassScreen();
}

function resolveRound() {
  const players = activePlayers();
  const values = players.map((player) => ({
    player,
    value: state.inputs.get(player.id),
  }));

  const duplicateValues = findDuplicateValues(values);
  let result;

  if (duplicateValues.length > 0) {
    result = makeInvalidResult("数字かぶり", `同じ数字が出たため、このラウンドは無効です。かぶった数字: ${duplicateValues.join(", ")}`);
  } else {
    result = players.length === 2 ? resolveTwoPlayerException(values) : null;
    if (!result) result = resolveNormalRound(values);
  }

  applyResult(result, players);
  renderResult(result, values);
}

function findDuplicateValues(values) {
  const counts = new Map();
  values.forEach(({ value }) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort((a, b) => a - b);
}

function resolveTwoPlayerException(values) {
  const hasZero = values.some(({ value }) => value === 0);
  const hasHundred = values.some(({ value }) => value === 100);
  if (!hasZero || !hasHundred) return null;

  const winner = values.find(({ value }) => value === 100).player;
  return {
    kind: "special",
    title: `${winner.name} の勝ち`,
    summary: "2人戦の例外ルールです。0と100が出たため、100を選んだ人が勝者です。",
    winners: [winner],
    penalty: -1,
    target: null,
    average: null,
    nearPin: false,
  };
}

function resolveNormalRound(values) {
  const average = values.reduce((sum, item) => sum + item.value, 0) / values.length;
  const target = average * 0.8;
  const distances = values.map((item) => ({
    ...item,
    distance: Math.abs(item.value - target),
  }));
  const minDistance = Math.min(...distances.map((item) => item.distance));
  const closest = distances.filter((item) => Math.abs(item.distance - minDistance) < Number.EPSILON);

  if (closest.length > 1) {
    const names = closest.map(({ player }) => player.name).join("、");
    return makeInvalidResult("同距離", `${names} が同じ近さだったため、このラウンドは無効です。`, average, target);
  }

  const winner = closest[0].player;
  const winnerValue = closest[0].value;
  const nearMin = Math.ceil(target - 1);
  const nearMax = Math.floor(target + 1);
  const nearPin = winnerValue >= nearMin && winnerValue <= nearMax;
  const penalty = nearPin ? -2 : -1;

  return {
    kind: nearPin ? "near" : "normal",
    title: `${winner.name} の勝ち`,
    summary: nearPin
      ? `ニアピンです。${winner.name} 以外は-2点。`
      : `${winner.name} 以外は-1点。`,
    winners: [winner],
    penalty,
    target,
    average,
    nearPin,
  };
}

function makeInvalidResult(reason, summary, average = null, target = null) {
  return {
    kind: "invalid",
    title: "ラウンド無効",
    reason,
    summary: `${summary} 全員-1点。`,
    winners: [],
    penalty: -1,
    target,
    average,
    nearPin: false,
  };
}

function applyResult(result, players) {
  players.forEach((player) => {
    if (!result.winners.some((winner) => winner.id === player.id)) {
      player.score += result.penalty;
    }
  });

  state.lastEliminated = players.filter((player) => player.score <= -10);
  state.lastEliminated.forEach((player) => {
    player.active = false;
  });
}

function renderResult(result, values) {
  resultRoundLabel.textContent = `Round ${state.round}`;
  resultType.textContent = result.kind === "near" ? "Near Pin" : result.kind === "special" ? "Special Rule" : "Result";
  resultTitle.textContent = result.title;
  resultSummary.textContent = result.summary;
  renderStats(result);
  renderChoices(result, values);
  renderEliminations();

  const remaining = activePlayers();
  nextRoundButton.textContent = remaining.length <= 1 ? "最終結果を見る" : "次のラウンドへ";
  showScreen("result");
}

function renderStats(result) {
  const stats = [];
  if (result.average !== null) stats.push(["平均", formatNumber(result.average)]);
  if (result.target !== null) stats.push(["目標値", formatNumber(result.target)]);
  stats.push(["ペナルティ", result.penalty === -2 ? "敗者 -2" : "敗者 -1"]);

  resultStats.innerHTML = stats
    .map(([label, value]) => `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
}

function renderChoices(result, values) {
  choiceReveal.innerHTML = "";
  values
    .slice()
    .sort((a, b) => b.value - a.value)
    .forEach(({ player, value }) => {
      const row = document.createElement("div");
      const isWinner = result.winners.some((winner) => winner.id === player.id);
      row.className = `choice-row${isWinner ? " winner" : ""}`;
      row.innerHTML = `<strong>${escapeHtml(player.name)}</strong><span class="choice-value">${value}</span>`;
      choiceReveal.append(row);
    });
}

function renderEliminations() {
  eliminationList.innerHTML = "";
  if (state.lastEliminated.length === 0) return;

  const notice = document.createElement("div");
  notice.className = "notice";
  notice.textContent = `${state.lastEliminated.map((player) => player.name).join("、")} が脱落しました。`;
  eliminationList.append(notice);
}

function finishOrContinue() {
  const remaining = activePlayers();
  if (remaining.length <= 1) {
    renderGameOver(remaining);
    return;
  }

  state.round += 1;
  beginRound();
}

function renderGameOver(remaining) {
  if (remaining.length === 1) {
    gameOverTitle.textContent = `${remaining[0].name} の優勝`;
    gameOverSummary.textContent = `最終スコア: ${remaining[0].score}点`;
  } else {
    gameOverTitle.textContent = "勝者なし";
    gameOverSummary.textContent = "全員が同時に脱落しました。";
  }
  showScreen("gameOver");
}

function renderScoreboard() {
  const ordered = state.players
    .slice()
    .sort((a, b) => Number(b.active) - Number(a.active) || b.score - a.score);

  scoreList.innerHTML = "";
  ordered.forEach((player) => {
    const row = document.createElement("div");
    row.className = "score-row";
    row.innerHTML = `
      <strong>${escapeHtml(player.name)}${player.active ? "" : " <span class=\"eliminated\">脱落</span>"}</strong>
      <span class="score-value">${player.score}</span>
    `;
    scoreList.append(row);
  });

  scoreDialog.showModal();
}

function resetToSetup() {
  renderPlayerNameInputs();
  showScreen("setup");
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function createPlayerId(index) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[char]));
}

playerCount.addEventListener("input", renderPlayerNameInputs);
decreasePlayers.addEventListener("click", () => updatePlayerCount(-1));
increasePlayers.addEventListener("click", () => updatePlayerCount(1));
setupForm.addEventListener("submit", startGame);
readyButton.addEventListener("click", renderInputScreen);
choiceNumber.addEventListener("input", () => setChoiceValue(choiceNumber.value));
choiceRange.addEventListener("input", () => setChoiceValue(choiceRange.value));
choiceForm.addEventListener("submit", submitChoice);
quickPicks.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-pick]");
  if (!button) return;
  setChoiceValue(button.dataset.pick);
});
nextRoundButton.addEventListener("click", finishOrContinue);
backToSetup.addEventListener("click", resetToSetup);
restartButton.addEventListener("click", resetToSetup);
showScoreboard.addEventListener("click", renderScoreboard);
resultScoreboardButton.addEventListener("click", renderScoreboard);

renderPlayerNameInputs();
