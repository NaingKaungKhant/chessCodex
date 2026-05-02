const boardElement = document.querySelector("#board");
const difficultySelect = document.querySelector("#difficultySelect");
const sideSelect = document.querySelector("#sideSelect");
const newGameButton = document.querySelector("#newGameButton");
const flipButton = document.querySelector("#flipButton");
const hintButton = document.querySelector("#hintButton");
const whiteClock = document.querySelector("#whiteClock");
const blackClock = document.querySelector("#blackClock");
const whiteClockCard = document.querySelector("#whiteClockCard");
const blackClockCard = document.querySelector("#blackClockCard");
const whiteName = document.querySelector("#whiteName");
const blackName = document.querySelector("#blackName");
const statusText = document.querySelector("#statusText");
const notationList = document.querySelector("#notationList");
const moveCount = document.querySelector("#moveCount");
const evalText = document.querySelector("#evalText");
const evalFill = document.querySelector("#evalFill");
const bestMoveTitle = document.querySelector("#bestMoveTitle");
const bestMoveText = document.querySelector("#bestMoveText");

const game = new window.Chess();
const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const pieceGlyphs = {
  wp: "♙",
  wn: "♘",
  wb: "♗",
  wr: "♖",
  wq: "♕",
  wk: "♔",
  bp: "♟",
  bn: "♞",
  bb: "♝",
  br: "♜",
  bq: "♛",
  bk: "♚",
};

const pieceValues = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

const centerSquares = new Set(["d4", "e4", "d5", "e5"]);
const nearCenterSquares = new Set(["c3", "d3", "e3", "f3", "c4", "f4", "c5", "f5", "c6", "d6", "e6", "f6"]);

let selectedSquare = null;
let legalTargets = [];
let lastMove = null;
let playerColor = "w";
let boardFlipped = false;
let aiThinking = false;
let whiteTime = 300;
let blackTime = 300;
let timerId = null;
let clockExpired = false;

function isAiTurn() {
  return game.turn() !== playerColor && !game.isGameOver() && !clockExpired;
}

function isPlayerTurn() {
  return game.turn() === playerColor && !game.isGameOver() && !aiThinking && !clockExpired;
}

function squareName(rankIndex, fileIndex) {
  const rank = boardFlipped ? rankIndex + 1 : 8 - rankIndex;
  const file = boardFlipped ? files[7 - fileIndex] : files[fileIndex];
  return `${file}${rank}`;
}

function formatClock(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function currentPositionScore() {
  return evaluateBoard(game);
}

function updateClocks() {
  whiteClock.textContent = formatClock(whiteTime);
  blackClock.textContent = formatClock(blackTime);
  whiteClockCard.classList.toggle("active", game.turn() === "w" && !game.isGameOver());
  blackClockCard.classList.toggle("active", game.turn() === "b" && !game.isGameOver());
}

function startClock() {
  window.clearInterval(timerId);
  timerId = window.setInterval(() => {
    if (game.isGameOver() || clockExpired) {
      window.clearInterval(timerId);
      return;
    }

    if (game.turn() === "w") {
      whiteTime -= 1;
      if (whiteTime <= 0) endOnTime("Black wins on time.");
    } else {
      blackTime -= 1;
      if (blackTime <= 0) endOnTime("White wins on time.");
    }

    updateClocks();
  }, 1000);
}

function endOnTime(message) {
  clockExpired = true;
  window.clearInterval(timerId);
  statusText.textContent = message;
  aiThinking = false;
  renderBoard();
}

function renderBoard() {
  boardElement.innerHTML = "";
  const checkSquare = getCheckedKingSquare();

  for (let rankIndex = 0; rankIndex < 8; rankIndex += 1) {
    for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
      const square = squareName(rankIndex, fileIndex);
      const piece = game.get(square);
      const button = document.createElement("button");
      const isLight = (rankIndex + fileIndex) % 2 === 0;

      button.className = `square ${isLight ? "light" : "dark"}`;
      button.type = "button";
      button.dataset.square = square;
      button.setAttribute("aria-label", square);

      if (selectedSquare === square) button.classList.add("selected");
      if (legalTargets.some((move) => move.to === square)) {
        button.classList.add("legal");
        if (piece) button.classList.add("capture");
      }
      if (lastMove && (lastMove.from === square || lastMove.to === square)) button.classList.add("last-move");
      if (checkSquare === square) button.classList.add("in-check");

      if (piece) {
        const pieceElement = document.createElement("span");
        pieceElement.className = `piece ${piece.color === "w" ? "white" : "black"}`;
        pieceElement.textContent = pieceGlyphs[`${piece.color}${piece.type}`];
        button.append(pieceElement);
      }

      button.addEventListener("click", () => handleSquareClick(square));
      boardElement.append(button);
    }
  }
}

function getCheckedKingSquare() {
  if (!game.inCheck()) return null;

  const board = game.board();
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank][file];
      if (piece?.type === "k" && piece.color === game.turn()) {
        return `${files[file]}${8 - rank}`;
      }
    }
  }

  return null;
}

function handleSquareClick(square) {
  if (!isPlayerTurn()) return;

  const clickedPiece = game.get(square);

  if (selectedSquare) {
    const move = legalTargets.find((candidate) => candidate.to === square);
    if (move) {
      makeMove({ from: selectedSquare, to: square, promotion: choosePromotion(move) });
      selectedSquare = null;
      legalTargets = [];
      afterMove();
      return;
    }
  }

  if (clickedPiece?.color === playerColor) {
    selectedSquare = square;
    legalTargets = game.moves({ square, verbose: true });
  } else {
    selectedSquare = null;
    legalTargets = [];
  }

  renderBoard();
}

function choosePromotion(move) {
  return move.flags.includes("p") ? "q" : undefined;
}

function makeMove(move) {
  const result = game.move(move);
  if (result) {
    lastMove = { from: result.from, to: result.to };
  }
  return result;
}

function afterMove() {
  renderAll();

  if (game.isGameOver()) {
    updateStatus();
    return;
  }

  if (isAiTurn()) {
    queueAiMove();
  }
}

function queueAiMove() {
  aiThinking = true;
  statusText.textContent = "AI is calculating...";
  renderBoard();

  window.setTimeout(() => {
    const move = chooseAiMove(Number(difficultySelect.value));
    if (move) makeMove(move);
    aiThinking = false;
    renderAll();
  }, 350);
}

function chooseAiMove(level) {
  const moves = game.moves({ verbose: true });
  if (!moves.length) return null;

  if (level === 1) {
    return pickBeginnerMove(moves);
  }

  const depth = level === 2 ? 2 : 3;
  let bestMove = moves[0];
  let bestScore = game.turn() === "w" ? -Infinity : Infinity;

  for (const move of moves) {
    game.move(move);
    const score = minimax(depth - 1, -Infinity, Infinity);
    game.undo();

    if (game.turn() === "w" ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

function pickBeginnerMove(moves) {
  const captures = moves.filter((move) => move.captured);
  const checks = moves.filter((move) => move.san.includes("+"));
  const pool = [...checks, ...captures, ...moves];
  return pool[Math.floor(Math.random() * Math.min(pool.length, Math.max(1, moves.length + 3)))];
}

function minimax(depth, alpha, beta) {
  if (depth === 0 || game.isGameOver()) return evaluateBoard(game);

  const moves = game.moves({ verbose: true });
  if (game.turn() === "w") {
    let maxScore = -Infinity;
    for (const move of moves) {
      game.move(move);
      maxScore = Math.max(maxScore, minimax(depth - 1, alpha, beta));
      game.undo();
      alpha = Math.max(alpha, maxScore);
      if (beta <= alpha) break;
    }
    return maxScore;
  }

  let minScore = Infinity;
  for (const move of moves) {
    game.move(move);
    minScore = Math.min(minScore, minimax(depth - 1, alpha, beta));
    game.undo();
    beta = Math.min(beta, minScore);
    if (beta <= alpha) break;
  }
  return minScore;
}

function evaluateBoard(position) {
  if (position.isCheckmate()) return position.turn() === "w" ? -999999 : 999999;
  if (position.isDraw()) return 0;

  let score = 0;
  const board = position.board();

  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank][file];
      if (!piece) continue;

      const square = `${files[file]}${8 - rank}`;
      const sign = piece.color === "w" ? 1 : -1;
      score += sign * pieceValues[piece.type];

      if (centerSquares.has(square)) score += sign * 18;
      if (nearCenterSquares.has(square)) score += sign * 8;
      if (piece.type === "p") score += sign * (piece.color === "w" ? 6 - rank : rank - 1) * 4;
    }
  }

  score += position.moves({ verbose: true }).length * (position.turn() === "w" ? 2 : -2);
  return score;
}

function renderNotation() {
  const history = game.history();
  notationList.innerHTML = "";

  for (let index = 0; index < history.length; index += 2) {
    const item = document.createElement("li");
    item.innerHTML = `
      <span class="move-number">${index / 2 + 1}.</span>
      <span>${history[index] ?? ""}</span>
      <span>${history[index + 1] ?? ""}</span>
    `;
    notationList.append(item);
  }

  notationList.scrollTop = notationList.scrollHeight;
  moveCount.textContent = `${history.length} ${history.length === 1 ? "move" : "moves"}`;
}

function updateEvaluation() {
  const score = currentPositionScore();
  const clamped = Math.max(-900, Math.min(900, score));
  const whiteShare = Math.round(((clamped + 900) / 1800) * 100);

  evalFill.style.setProperty("--eval-share", `${whiteShare}%`);

  if (Math.abs(score) < 45) {
    evalText.textContent = "Even";
  } else {
    evalText.textContent = `${score > 0 ? "+" : "-"}${(Math.abs(score) / 100).toFixed(1)}`;
  }
}

function updateStatus() {
  if (whiteTime <= 0 || blackTime <= 0) return;

  if (game.isCheckmate()) {
    statusText.textContent = `${game.turn() === "w" ? "Black" : "White"} wins by checkmate.`;
  } else if (game.isDraw()) {
    statusText.textContent = "Drawn game.";
  } else if (game.inCheck()) {
    statusText.textContent = `${game.turn() === "w" ? "White" : "Black"} is in check.`;
  } else if (aiThinking) {
    statusText.textContent = "AI is calculating...";
  } else {
    statusText.textContent = `${game.turn() === "w" ? "White" : "Black"} to move.`;
  }
}

function updateInsight() {
  if (game.isGameOver() || clockExpired) {
    bestMoveTitle.textContent = "Game complete";
    bestMoveText.textContent = "Start a new game to run another AI difficulty match.";
    return;
  }

  const moves = game.moves({ verbose: true });
  if (!moves.length) return;

  const bestMove = chooseAiMove(Math.max(2, Number(difficultySelect.value)));
  const side = game.turn() === "w" ? "White" : "Black";
  bestMoveTitle.textContent = `${side} idea: ${bestMove.san}`;
  bestMoveText.textContent = explainMove(bestMove);
}

function explainMove(move) {
  if (move.san.includes("#")) return "Forces checkmate immediately.";
  if (move.san.includes("+")) return "Creates check and limits the opponent's reply choices.";
  if (move.captured) return `Wins material by capturing ${move.captured.toUpperCase()}.`;
  if (centerSquares.has(move.to)) return "Improves central control and keeps development flexible.";
  if (move.piece === "k" && move.san.includes("O-O")) return "Castles to improve king safety.";
  return "Improves piece activity according to the position evaluator.";
}

function renderAll() {
  renderBoard();
  renderNotation();
  updateClocks();
  updateEvaluation();
  updateStatus();
  updateNames();
  updateInsight();
}

function updateNames() {
  whiteName.textContent = playerColor === "w" ? "You" : "Kasparian AI";
  blackName.textContent = playerColor === "b" ? "You" : "Kasparian AI";
}

function startNewGame() {
  game.reset();
  selectedSquare = null;
  legalTargets = [];
  lastMove = null;
  aiThinking = false;
  clockExpired = false;
  whiteTime = 300;
  blackTime = 300;
  playerColor = sideSelect.value;
  boardFlipped = playerColor === "b";
  renderAll();
  startClock();

  if (isAiTurn()) queueAiMove();
}

function showHint() {
  if (!isPlayerTurn()) return;

  const move = chooseAiMove(Math.max(2, Number(difficultySelect.value)));
  if (!move) return;

  selectedSquare = move.from;
  legalTargets = game.moves({ square: move.from, verbose: true });
  bestMoveTitle.textContent = `Hint: ${move.san}`;
  bestMoveText.textContent = explainMove(move);
  renderBoard();
}

newGameButton.addEventListener("click", startNewGame);
sideSelect.addEventListener("change", startNewGame);
difficultySelect.addEventListener("change", () => {
  updateInsight();
  if (isAiTurn() && !aiThinking) queueAiMove();
});
flipButton.addEventListener("click", () => {
  boardFlipped = !boardFlipped;
  renderBoard();
});
hintButton.addEventListener("click", showHint);

startNewGame();
