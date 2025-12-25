/**
 * ========================================
 * เกม GOBBLET GOBBLERS TIC TAC TOE - ลอจิกเกม
 * ========================================
 * 
 * ระบบเกม: หมากฮอสต์ต้อนซ้อน (วางแบบ stack ได้)
 * โหมด: 1 คน vs บอท หรือ 2 คน vs 2 คน
 * ระดับบอท: ง่าย (สุ่ม) → ปานกลาง (หาชนะ/ป้องกัน) → ยาก → ยากสุด (Minimax)
 * 
 * โครงสร้าง: DOM → สถานะ → ตั้งกระดาน → จัดการ UI → ลอจิกเกม → ตรวจสอบ → 
 *           วาดรูป → เปลี่ยนตา → บอทเดิน → AI → เริ่มต้นเกม
 */

// ═══════════════════════════════════════════════════════════════════════════
// ส่วนที่ 1: DOM ELEMENTS & อ้างอิง UI
// ═══════════════════════════════════════════════════════════════════════════

const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const resetBtn = document.getElementById("reset");
const currentPlayerEl = document.getElementById("current-player");
const pieceBtns = document.querySelectorAll(".piece-btn");
const smallLeftEl = document.getElementById("small-left");
const mediumLeftEl = document.getElementById("medium-left");
const largeLeftEl = document.getElementById("large-left");
const modeSelect = document.getElementById("mode");
const difficultySelect = document.getElementById("difficulty");

function playerDisplay(p){ return p==="X"?"ผู้เล่นแดง":"ผู้เล่นฟ้า"; }


// ═══════════════════════════════════════════════════════════════════════════
// ส่วนที่ 2: ตัวแปรสถานะเกม
// ═══════════════════════════════════════════════════════════════════════════

let mode = "2p";                      // โหมดเริ่มต้น (2 ผู้เล่น)
let difficulty = "easy";              // ระดับบอทเริ่มต้น
let currentPlayer = "X";              // ผู้เล่นเริ่มต้น
let selectedSize = null;              // ขนาดหมากที่เลือกจากคลัง (small/medium/large)
let selectedFrom = null;              // ช่องที่เลือกเพื่อย้าย (index)

const params = new URLSearchParams(window.location.search);
if (params.get('mode')) mode = params.get('mode');
if (params.get('difficulty')) difficulty = params.get('difficulty');
if (params.get('player')) currentPlayer = (params.get('player') === 'P2' ? 'O' : 'X');

let board = Array(9).fill(null).map(() => []); // กระดาน 9 ช่อง แต่ละช่องเป็น stack
let piecesLeft = {                             // จำนวนหมากคงเหลือของแต่ละฝ่าย
  X: { small: 2, medium: 2, large: 2 },
  O: { small: 2, medium: 2, large: 2 }
};


// ═══════════════════════════════════════════════════════════════════════════
// ส่วนที่ 3: ตั้งกระดาน & วาดรูป
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ฟังก์ชัน createBoard:
 * - สร้าง DOM ของกระดาน 9 ช่องและผูก event ให้แต่ละช่อง
 * - ไม่มีพารามิเตอร์ และไม่คืนค่า
 */
function createBoard() {
  boardEl.innerHTML = "";
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement("div");
    cell.classList.add("cell");
    cell.dataset.index = i;
    cell.addEventListener("click", () => handleCellClick(i));
    boardEl.appendChild(cell);
  }
}

/**
 * ฟังก์ชัน renderBoard:
 * - วาด/อัปเดต UI ของกระดานจากตัวแปร board
 * - แสดงเฉพาะชั้นบนสุดของแต่ละช่อง (top of stack)
 */
function renderBoard() {
  document.querySelectorAll(".cell").forEach((cell, i) => {
    cell.innerHTML = "";
    const stack = board[i];
    if (stack.length) {
      const top = stack[stack.length - 1];
      const piece = document.createElement("div");
      piece.classList.add("piece", top.player, top.size);
      cell.appendChild(piece);
    }
  });
  clearSelectedFrom();
  if (selectedFrom !== null) highlightSelectedFrom(selectedFrom);
}

/**
 * ฟังก์ชัน highlightSelectedFrom:
 * - ไฮไลต์ (เพิ่มคลาส) ช่องที่ถูกเลือกเพื่อแสดงว่าเป็นจุดต้นทางของการย้าย
 * - รับพารามิเตอร์ i = index ของช่อง
 */
function highlightSelectedFrom(i) {
  clearSelectedFrom();
  document.querySelectorAll(".cell")[i].classList.add("selected-from");
}

/**
 * ฟังก์ชัน clearSelectedFrom:
 * - ลบการไฮไลต์จากทุกช่อง (reset visual selection)
 */
function clearSelectedFrom() {
  document.querySelectorAll(".cell").forEach(c => c.classList.remove("selected-from"));
}


// ═══════════════════════════════════════════════════════════════════════════
// ส่วนที่ 4: สถานะ UI & เลือกหมาก
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ฟังก์ชัน cancelSelectAll:
 * - ยกเลิกการเลือกทั้งขนาดหมากและช่องที่จะย้าย
 * - รีเซ็ตสถานะ UI ที่เกี่ยวข้อง
 */
function cancelSelectAll() {
  selectedSize = null;
  selectedFrom = null;
  pieceBtns.forEach(b => b.classList.remove("selected"));
  clearSelectedFrom();
  statusEl.textContent = `ตาของ${playerDisplay(currentPlayer)}`;
}

/**
 * Listener สำหรับปุ่มเลือกหมากจากคลัง:
 * - เมื่อคลิกจะเลือก/ยกเลิกขนาดหมากที่ต้องการวาง
 * - อัปเดต status ให้ผู้ใช้ทราบ
 */
pieceBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    if (selectedSize === btn.dataset.size) return cancelSelectAll();
    pieceBtns.forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedSize = btn.dataset.size;
    selectedFrom = null;
    clearSelectedFrom();
    statusEl.textContent = `เลือกช่องที่จะวางหมากขนาด ${selectedSize}`;
  });
});

modeSelect && modeSelect.addEventListener("change", e => mode = e.target.value);
difficultySelect && difficultySelect.addEventListener("change", e => difficulty = e.target.value);


// ═══════════════════════════════════════════════════════════════════════════
// ส่วนที่ 5: ฟังก์ชันอัปเดต UI
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ฟังก์ชัน updatePieceCounts:
 * - อัปเดตตัวเลขบน UI แสดงจำนวนหมากที่เหลือของผู้เล่นปัจจุบัน
 */
function updatePieceCounts() {
  smallLeftEl.textContent = piecesLeft[currentPlayer].small;
  mediumLeftEl.textContent = piecesLeft[currentPlayer].medium;
  largeLeftEl.textContent = piecesLeft[currentPlayer].large;
}

/**
 * ฟังก์ชัน updateGameInfo:
 * - อัปเดตแถบข้อมูลเกม (โหมด, ระดับบอท, ใครเริ่ม)
 * - ตรวจว่ามี element หรือไม่ก่อนใช้งาน
 */
function updateGameInfo(){
  const infoEl = document.getElementById('game-info');
  if (!infoEl) return;
  const modeText = mode === '1p' ? 'เล่นกับบอท' : 'เล่น 2 คน';
  const diffText = mode === '1p' ? ` | ระดับ: ${difficulty}` : '';
  infoEl.textContent = `โหมด: ${modeText}${diffText} | เริ่ม: ${currentPlayer}`;
}


// ═══════════════════════════════════════════════════════════════════════════
// ส่วนที่ 6: ตรวจสอบท่า & กฎ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ฟังก์ชัน canPlace(index, player, size, isMove = false):
 * - ตรวจว่าหมากขนาด size ของ player สามารถวาง/ย้ายไปที่ index ได้หรือไม่
 * - กฎ: ต้องใหญ่กว่าชั้นบนสุดของช่อง (sizeOrder) และถ้าวางใหม่ต้องมีเหลือใน piecesLeft
 * - คืนค่า boolean
 */
function canPlace(index, player, size, isMove = false) {
  const sizeOrder = ["small", "medium", "large"];
  const newVal = sizeOrder.indexOf(size);
  const stack = board[index];
  const top = stack[stack.length - 1];
  const topVal = top ? sizeOrder.indexOf(top.size) : -1;
  if (newVal <= topVal) return false;
  if (!isMove && piecesLeft[player][size] <= 0) return false;
  return true;
}

/**
 * ฟังก์ชัน checkWinner:
 * - ตรวจว่าใครชนะหรือยังโดยดูเฉพาะหมากบนสุดของแต่ละช่อง
 * - คืนค่า true ถ้ามีการเรียง 3 ช่องของผู้เล่นเดียวกัน
 */
function checkWinner() {
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (let [a,b,c] of wins) {
    const A = board[a][board[a].length - 1];
    const B = board[b][board[b].length - 1];
    const C = board[c][board[c].length - 1];
    if (A && B && C && A.player === B.player && B.player === C.player) return true;
  }
  return false;
}


// ═══════════════════════════════════════════════════════════════════════════
// ส่วนที่ 7: ลอจิกเกมหลัก - จัดการคลิกช่อง
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ฟังก์ชัน handleCellClick(index):
 * - จัดการกรณีผู้ใช้คลิกช่องบนกระดาน
 * - ทำหน้าที่ทั้ง: เลือกเพื่อย้าย, ย้ายหมาก, วางหมากจากคลัง และอัปเดตสถานะเกม
 */
function handleCellClick(index) {
  if (selectedFrom === index) return cancelSelectAll();
  
  const top = board[index][board[index].length - 1];
  
  // ถ้าผู้เล่นแตะหมากของตนเอง -> เตรียมย้าย
  if (top && top.player === currentPlayer) {
    selectedFrom = index;
    selectedSize = null;
    pieceBtns.forEach(b => b.classList.remove("selected"));
    highlightSelectedFrom(index);
    statusEl.textContent = `เลือกจุดปลายทาง`;
    return;
  }
  
  // ถ้ากำลังย้ายหมากจาก selectedFrom -> ตรวจกฎแล้วย้าย
  if (selectedFrom !== null) {
    const movingPiece = board[selectedFrom][board[selectedFrom].length - 1];
    if (!movingPiece) return;
    if (!canPlace(index, currentPlayer, movingPiece.size, true)) return;
    
    board[selectedFrom].pop();
    board[index].push(movingPiece);
    clearSelectedFrom();
    selectedFrom = null;
    renderBoard();
    
    if (checkWinner()) return endGame(`${playerDisplay(currentPlayer)} ชนะ!`);
    switchTurn();
    if (mode === "1p" && currentPlayer === "O") setTimeout(botMove, 600);
    return;
  }
  
  // ถ้าวางหมากจากคลัง (selectedSize) -> วางถ้ากฎอนุญาต
  if (selectedSize) {
    if (!canPlace(index, currentPlayer, selectedSize, false)) return;
    board[index].push({ player: currentPlayer, size: selectedSize });
    piecesLeft[currentPlayer][selectedSize]--;
    renderBoard();
    
    if (checkWinner()) return endGame(`${playerDisplay(currentPlayer)} ชนะ!`);
    switchTurn();
    if (mode === "1p" && currentPlayer === "O") setTimeout(botMove, 600);
    return;
  }
  
  // ถ้าไม่มีการเลือกอะไร -> แจ้งวิธีการเล่น
  statusEl.textContent = `เลือกขนาดหมาก หรือแตะหมากของคุณเพื่อย้าย`;
}


// ═══════════════════════════════════════════════════════════════════════════
// ส่วนที่ 8: เปลี่ยนตา & จัดการสถานะเกม
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ฟังก์ชัน switchTurn:
 * - สลับ currentPlayer เป็น X <-> O
 * - รีเซ็ตสถานะเลือกและอัปเดตจำนวนหมากบน UI
 */
function switchTurn() {
  currentPlayer = currentPlayer === "X" ? "O" : "X";
  currentPlayerEl.textContent = playerDisplay(currentPlayer);
  cancelSelectAll();
  updatePieceCounts();
}

/**
 * ฟังก์ชัน showWinPopup(text):
 * - สร้าง modal แจ้งผลผู้ชนะและให้ปุ่ม Restart / Home
 * - จัดการ event ของปุ่มภายใน modal
 */
function showWinPopup(text) {
  const overlay = document.createElement("div");
  overlay.id = "win-overlay";
  overlay.innerHTML = `
    <div class="win-modal">
      <div class="win-text">${text}</div>
      <div class="win-actions">
        <button id="win-restart">🔄 เริ่มใหม่</button>
        <button id="win-home">🏠 กลับหน้าหลัก</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  
  document.getElementById('win-restart')?.addEventListener('click', () => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 300);
    resetBtn?.click();
  });
  
  document.getElementById('win-home')?.addEventListener('click', () => {
    window.location.href = 'งาน.html';
  });
}

/**
 * ฟังก์ชัน endGame(msg):
 * - จบเกมโดยแสดงข้อความและปิดการคลิกกระดาน
 */
function endGame(msg) {
  statusEl.textContent = `🎉 ${msg}`;
  showWinPopup(msg);
  document.querySelectorAll(".cell").forEach(c => c.style.pointerEvents = "none");
}


// ═══════════════════════════════════════════════════════════════════════════
// ส่วนที่ 9: AI บอท - สร้างท่า & ทำท่า
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ฟังก์ชัน generateAllMoves(player):
 * - สร้างรายการท่าที่เป็นไปได้ทั้งหมดสำหรับ player
 * - ท่ามี 2 แบบ: {type: "place", index, size} หรือ {type: "move", from, to, size}
 * - คืนค่าเป็นอาเรย์ของท่า
 */
function setBoardDisabled(disabled) {
  document.querySelectorAll(".cell").forEach(c => {
    c.style.pointerEvents = disabled ? "none" : "auto";
  });
}
// ═══════════════════════════════════════════════════════════════════════════
// UI Overlay: แสดง/ซ่อนหน้าจอบอทกำลังคิด (Super hard)
// ═══════════════════════════════════════════════════════════════════════════
function showBotThinking() {
  if (document.getElementById("bot-thinking-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "bot-thinking-overlay";
  overlay.innerHTML = `
    <div class="bot-thinking-text">
      🤖 บอท <br>
      กำลังประมวลผล...
    </div>
  `;
  document.body.appendChild(overlay);
}

function hideBotThinking() {
  const overlay = document.getElementById("bot-thinking-overlay");
  if (overlay) overlay.remove();
}

function isBadMoveForBot(move, bot) {
  const human = bot === "O" ? "X" : "O";

  applyMove(move, bot);
  const oppWinningMove = findWinningMoveGeneric(human);
  undoMoveGeneric(move, bot);

  return !!oppWinningMove; // true = เดินแล้วโดนสวนชนะ
}

function hardBotMove(bot) {
  const moves = generateAllMoves(bot);
  //ชนะทันที
  const win = findWinningMoveGeneric(bot);
  if (win) return win;
  //กันแพ้
  const block = findBlockingMoveGeneric(bot);
  if (block) return block;
  //ตัดท่าที่เดินแล้วแพ้ทันที
  const safeMoves = moves.filter(m => !isBadMoveForBot(m, bot));
  const candidateMoves = safeMoves.length ? safeMoves : moves;
  //ให้คะแนนตำแหน่ง
  const priority = [4, 0, 2, 6, 8]; // กลาง > มุม
  candidateMoves.sort((a, b) => {
    const aIdx = a.index ?? a.to;
    const bIdx = b.index ?? b.to;
    return priority.indexOf(aIdx) - priority.indexOf(bIdx);
  });
  //เลือกจากท่าที่ดีที่สุด (สุ่มนิดหน่อย)
  return candidateMoves[Math.floor(Math.random() * Math.min(2, candidateMoves.length))];
}

function generateAllMoves(player) {
  const sizeOrder = ["small","medium","large"];
  const moves = [];
  
  for (let s of sizeOrder) {
    if (piecesLeft[player][s] > 0) {
      for (let i = 0; i < 9; i++)
        if (canPlace(i, player, s)) moves.push({ type:"place", index:i, size:s });
    }
  }
  
  for (let from = 0; from < 9; from++) {
    const stack = board[from];
    if (!stack.length) continue;
    const top = stack[stack.length - 1];
    if (top.player !== player) continue;
    for (let to = 0; to < 9; to++)
      if (to !== from && canPlace(to, player, top.size, true))
        moves.push({ type:"move", from, to, size: top.size });
  }
  
  return moves;
}

/**
 * ฟังก์ชัน applyMove(m, player):
 * - นำท่า m มาใช้จริงบนตัวแปร board และลด/เพิ่ม piecesLeft ตามที่จำเป็น
 * - ไม่คืนค่า แต่เรียก renderBoard() เพื่ออัปเดต UI
 */
function applyMove(m, player) {
  if (m.type === "place") {
    board[m.index].push({ player, size: m.size });
    piecesLeft[player][m.size]--;
  } else {
    const mv = board[m.from].pop();
    board[m.to].push(mv);
  }
  renderBoard();
}

/**
 * ฟังก์ชัน undoMoveGeneric(m, player):
 * - ย้อนการเดิน (inverse ของ applyMove) ใช้สำหรับการค้นหา (minimax)
 */
function undoMoveGeneric(m, player) {
  if (m.type === "place") {
    board[m.index].pop();
    piecesLeft[player][m.size]++;
  } else {
    const mv = board[m.to].pop();
    board[m.from].push(mv);
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// ส่วนที่ 10: AI บอท - กลยุทธ์ & ตรวจชนะ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ฟังก์ชัน detectWinnerPlayer:
 * - ตรวจว่าฝ่ายใดชนะ (คืน 'X' หรือ 'O') หรือคืน null ถ้าไม่มี
 * - ใช้ใน minimax เพื่อประเมินสถานะบอร์ด
 */
function detectWinnerPlayer() {
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (let [a,b,c] of wins) {
    const A = board[a][board[a].length - 1];
    const B = board[b][board[b].length - 1];
    const C = board[c][board[c].length - 1];
    if (A && B && C && A.player === B.player && B.player === C.player) return A.player;
  }
  return null;
}

/**
 * ฟังก์ชัน findWinningMoveGeneric(player):
 * - ลองทุกท่าที่เป็นไปได้ ถ้าเจอท่าที่ทำให้ชนะทันทีจะคืนท่านั้น
 * - คืนค่าเป็นท่าหรือ null
 */
function findWinningMoveGeneric(player) {
  const moves = generateAllMoves(player);
  for (let m of moves) {
    applyMove(m, player);
    const win = checkWinner();
    undoMoveGeneric(m, player);
    if (win) return m;
  }
  return null;
}

/**
 * ฟังก์ชัน findBlockingMoveGeneric(bot):
 * - ตรวจว่าคู่ต่อสู้มีท่าที่จะชนะในตาถัดไปหรือไม่ (โดยเรียก findWinningMoveGeneric)
 * - ถ้ามี จะลองหาโต้ตอบที่ป้องกัน (คืนท่าที่บล็อกได้) หรือ null ถ้าไม่มี
 */
function findBlockingMoveGeneric(bot) {
  const opponent = bot === "O" ? "X" : "O";
  const oppWin = findWinningMoveGeneric(opponent);
  if (!oppWin) return null;
  
  const moves = generateAllMoves(bot);
  for (let m of moves) {
    applyMove(m, bot);
    const stillWin = findWinningMoveGeneric(opponent);
    undoMoveGeneric(m, bot);
    if (!stillWin) return m;
  }
  return null;
}


// ═══════════════════════════════════════════════════════════════════════════
// ส่วนที่ 11: AI บอท - ขั้นตอน Minimax
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ฟังก์ชัน minimax(...):
 * - อิมพลีเมนต์ minimax แบบมี alpha-beta pruning
 * - พารามิเตอร์:
 *   depth: ความลึกปัจจุบัน
 *   isMax: true ถ้าตรั้งนี้คือฝั่ง bot ที่กำลังเลือก (maximizer)
 *   bot, human: ตัวอักษรผู้เล่น
 *   alpha, beta: ค่าตัดกิ่ง
 *   limit: ขีดจำกัดความลึก
 * - คืนค่าสกอร์เชิงตัวเลข (สูง = ดีสำหรับ bot)
 */
function minimax(depth, isMax, bot, human, alpha, beta, limit) {
  const winner = detectWinnerPlayer();
  if (winner === bot) return 100 - depth;
  if (winner === human) return -100 + depth;
  if (depth >= limit) return 0;
  
  const player = isMax ? bot : human;
  const moves = generateAllMoves(player);
  if (!moves.length) return 0;
  
  let bestScore = isMax ? -Infinity : Infinity;
  
  for (let m of moves) {
    applyMove(m, player);
    const score = minimax(depth+1, !isMax, bot, human, alpha, beta, limit);
    undoMoveGeneric(m, player);
    
    if (isMax) {
      bestScore = Math.max(bestScore, score);
      alpha = Math.max(alpha, score);
    } else {
      bestScore = Math.min(bestScore, score);
      beta = Math.min(beta, score);
    }
    
    if (beta <= alpha) break;
  }
  return bestScore;
}

/**
 * ฟังก์ชัน minimaxBestMove(bot):
 * - ลองทุกท่าของ bot แล้วใช้ minimax เพื่อเลือกท่าที่ให้สกอร์ดีที่สุด
 * - คืนค่าท่าที่ดีที่สุด (หรือ null ถ้าไม่มี)
 */
function minimaxBestMove(bot) {
  const opponent = bot === "O" ? "X" : "O";
  let bestScore = -Infinity, bestMove = null;
  const moves = generateAllMoves(bot);
  const depthLimit = 6;
  
  for (let m of moves) {
    applyMove(m, bot);
    let score = minimax(1, false, bot, opponent, -Infinity, Infinity, depthLimit);
    undoMoveGeneric(m, bot);
    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
  }
  return bestMove;
}


// ═══════════════════════════════════════════════════════════════════════════
// ส่วนที่ 12: AI บอท - ลอจิกตัดสินใจหลัก
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ฟังก์ชัน botMove:
 * - ตัดสินใจเลือกท่าของบอทตามความยาก (difficulty)
 * - ระดับ easy: random
 * - medium/hard: พยายามหา winning move หรือ blocking move ก่อน แล้ว random
 * - default (สุด): ใช้ minimaxBestMove
 * - หลัง applyMove จะตรวจชนะและสลับตา
 */
function botMove() {
  const bot = "O";
  const moves = generateAllMoves(bot);
  if (!moves.length) return endGame("เสมอ!");

  if (difficulty === "super" || difficulty === "hardest" || difficulty === "hard") {
    showBotThinking();
  }

  setBoardDisabled(true);

  setTimeout(() => {

    const move =
      difficulty === "easy"
        ? moves[Math.floor(Math.random() * moves.length)]
      : difficulty === "medium"
        ? findWinningMoveGeneric(bot) || findBlockingMoveGeneric(bot) || moves[Math.floor(Math.random() * moves.length)]
      : difficulty === "hard"
        ? hardBotMove(bot)
      : minimaxBestMove(bot) || moves[Math.floor(Math.random() * moves.length)];

    applyMove(move, bot);

    hideBotThinking();
    setBoardDisabled(false);

    if (checkWinner()) return endGame(`🤖 บอท (${difficulty}) ชนะ!`);
    switchTurn();

  }, 50);
}



// ═══════════════════════════════════════════════════════════════════════════
// ส่วนที่ 13: ปุ่มรีเซ็ต & เริ่มต้นเกม
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Listener ของ resetBtn:
 * - รีเซ็ตสถานะเกมทั้งหมดให้กลับเป็นค่าเริ่มต้น และวาดกระดานใหม่
 */
resetBtn.addEventListener("click", () => {
  currentPlayer = "X";
  cancelSelectAll();
  board = Array(9).fill(null).map(() => []);
  piecesLeft = { X:{small:2,medium:2,large:2}, O:{small:2,medium:2,large:2} };
  createBoard();
  renderBoard();
  currentPlayerEl.textContent = playerDisplay("X");
  updatePieceCounts();
  statusEl.textContent = "ผู้เล่นแดง เริ่มก่อน";
});

// Initialize game on page load
createBoard();
renderBoard();
updatePieceCounts();
currentPlayerEl.textContent = playerDisplay(currentPlayer);
statusEl.textContent = `ตาของ${playerDisplay(currentPlayer)}`;
updateGameInfo();
