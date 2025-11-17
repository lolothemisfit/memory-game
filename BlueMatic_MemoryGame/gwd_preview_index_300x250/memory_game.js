// --- CONFIG ---
const containerId = 'container';
const overlayId = 'overlay';
const messageId = 'message';
const replayBtnId = 'replayBtn';
const ctaBtnId = 'ctaBtn';
const timerDisplayId = 'time';
const attemptsDisplayId = 'attempts';

const startTime = 60;       // seconds
const maxAttempts = 16;     // max attempts
const totalPairs = 6;       // adjust per game

// --- STATE ---
let tilesContainer = null;
let tiles = [];
let flippedTiles = [];
let attempts = 0;
let pairsFound = 0;
let timer = startTime;
let timerInterval = null;
let gameStarted = false;
let muted = false;
let gameEnded = false;

// --- SOUNDS ---

function playSoundById(id) {
  if (muted) return;
  const audio = document.getElementById(id);
  if (!audio) return;
  
  // Reset to start
  audio.currentTime = 0;
  audio.play().catch(e => console.log('Audio play failed:', e));
}

// --- HELPERS ---
function $(id) { return document.getElementById(id); }

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// --- INIT ---
function init() {
  tilesContainer = $(containerId);
  if (!tilesContainer) return;

  tiles = Array.from(tilesContainer.children);
  tiles.forEach(t => {
    t.setAttribute('tabindex', '0');
    t.classList.remove('flipped', 'matched', 'wrong', 'shake');
    t.addEventListener('click', onTileClick);
  });

  // Buttons
  const replayBtn = $(replayBtnId);
  const ctaBtn = $(ctaBtnId);
  if (replayBtn) replayBtn.addEventListener('click', replayGame);
  if (ctaBtn) ctaBtn.addEventListener('click', onCtaClick);

  // Mute
  const muteBtn = $('muteBtn');
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      muted = !muted;
      muteBtn.textContent = muted ? '🔇' : '🔊';
    });
  }

  initKeyboardNavigation();

  resetState();
  initScoreboard();
}

// --- TILE CLICK ---
function onTileClick(e) {
  const tile = e.currentTarget || this;
  if (gameEnded || tile.classList.contains('flipped') || flippedTiles.length === 2) return;

  tile.classList.add('flipped');
  playSoundById('flipSound');
  flippedTiles.push(tile);

  if (!gameStarted) startTimer();

  if (flippedTiles.length === 2) {
    attempts++;
    updateCurrentScore();
    updateDisplays();
    setTimeout(() => {
        checkForMatch();
    }, 1000);

    if (attempts >= maxAttempts && pairsFound < totalPairs) {
      setTimeout(() => endGame(false, 'attempts'), 450);
    }
  }
}

// --- CHECK MATCH ---
function checkForMatch() {
  const [a,b] = flippedTiles;
  if (!a || !b) return;

  const valA = a.querySelector('.back')?.dataset.img || a.dataset.value;
  const valB = b.querySelector('.back')?.dataset.img || b.dataset.value;

  if (valA && valB && valA === valB) {
    pairsFound++;
    a.classList.add('matched');
    b.classList.add('matched');
    playSoundById('matchSound');

    setTimeout(() => {
      a.classList.remove('matched');
      b.classList.remove('matched');
    }, 700);
  } else {
    a.classList.add('wrong','shake');
    b.classList.add('wrong','shake');
    playSoundById('wrongSound');

    setTimeout(() => {
      a.classList.remove('flipped','wrong','shake');
      b.classList.remove('flipped','wrong','shake');
    }, 800);
  }

  flippedTiles = [];

  if (pairsFound === totalPairs) {
    setTimeout(() => endGame(true,'win'), 300);
  }
}

// --- TIMER ---
function startTimer() {
  if (gameStarted) return;
  gameStarted = true;

  timerInterval = setInterval(() => {
    timer--;
    updateDisplays();
    if (timer <= 0) {
      clearInterval(timerInterval);
      endGame(false,'time');
    }
  }, 1000);
}

// --- END GAME ---
function endGame(didWin, reason='win') {
  if (gameEnded) return;
  gameEnded = true;
  clearInterval(timerInterval);

  tiles.forEach(t => t.removeEventListener('click', onTileClick));

  const overlay = $(overlayId);
  const messageEl = $(messageId);
  if (overlay && messageEl) {
    overlay.style.display = 'flex';
    if (didWin) messageEl.textContent = "🎉 Congratulations — you matched all tiles!";
    else if (reason==='time') messageEl.textContent = "⏱ Time’s up! Try again!";
    else if (reason==='attempts') messageEl.textContent = "❌ Max attempts reached!";
  }

  updateBestScores();
  playSoundById(didWin ? 'winSound' : 'loseSound');
  updateCurrentScore();
}

// --- UPDATE CURRENT GAME SCORE ---
function updateCurrentScore() {
  const scoreAttempts = $('score_attempts');
  const scoreTime = $('score_time');
  const scorePairs = $('score_pairs');

  if (scoreAttempts) scoreAttempts.textContent = attempts;
  if (scoreTime) scoreTime.textContent = formatTime(startTime - timer);
  if (scorePairs) scorePairs.textContent = pairsFound;
}

// --- DISPLAY BEST SCORES ---
function displayBestScores() {
  const best = JSON.parse(localStorage.getItem('bm_best') || '{}');
  const bestAttemptsEl = $('best_attempts');
  const bestTimeEl = $('best_time');
  const bestPairsEl = $('best_pairs');

  if (bestAttemptsEl) bestAttemptsEl.textContent = (best.attempts ?? '--') + ' ⭐';
  if (bestTimeEl) bestTimeEl.textContent = (best.time != null ? formatTime(best.time) : '--') + ' ⭐';
  if (bestPairsEl) bestPairsEl.textContent = (best.pairs ?? '--') + ' ⭐';
}

// --- UPDATE BEST SCORES (called at END GAME) ---
function updateBestScores() {
  if (attempts <= 0 || pairsFound <= 0) return; // ignore empty game

  const best = JSON.parse(localStorage.getItem('bm_best') || '{}');
  const currentTime = startTime - timer;

  const firstGame = best.attempts == null && best.time == null && best.pairs == null;

  if (firstGame) {
    best.attempts = attempts;
    best.time = currentTime;
    best.pairs = pairsFound;
  } else {
    if (best.attempts == null || attempts < best.attempts) best.attempts = attempts;
    if (best.time == null || currentTime < best.time) best.time = currentTime;
    if (best.pairs == null || pairsFound > best.pairs) best.pairs = pairsFound;
  }

  localStorage.setItem('bm_best', JSON.stringify(best));
  displayBestScores();
}


// --- SCOREBOARD INIT ---
function initScoreboard() {
  updateCurrentScore(); // current game = 0
  displayBestScores();  // best from localStorage or '--'
}

// --- REPLAY ---
function replayGame() {
  const overlay = $(overlayId);
  if (overlay) overlay.style.display = 'none';

  tiles.forEach(t => {
    t.classList.remove('flipped','matched','wrong','shake');
    t.addEventListener('click', onTileClick);
  });

  resetState();
}

// --- CTA BUTTON ---
function onCtaClick() {
  window.dispatchEvent(new CustomEvent('bm_exit_click',{detail:{}}));
  const cta = $(ctaBtnId);
  if (cta && cta.dataset?.url) window.open(cta.dataset.url,'_blank');
}

// --- UPDATE DISPLAYS ---
function updateDisplays() {
  const tEl = $(timerDisplayId);
  const aEl = $(attemptsDisplayId);

  if (tEl) {
    let minutes = Math.floor(timer/60);
    let seconds = timer%60;
    tEl.textContent = `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
    tEl.style.color = timer <= 10 ? 'red' : '';
  }

  if (aEl) aEl.textContent = attempts;
}

// --- RESET STATE ---
function resetState() {
  flippedTiles = [];
  attempts = 0;
  pairsFound = 0;
  timer = startTime;
  clearInterval(timerInterval);
  timerInterval = null;
  gameStarted = false;
  gameEnded = false;
  updateDisplays();
}

// --- KEYBOARD NAVIGATION ---
function initKeyboardNavigation() {
  const cols = Math.round(Math.sqrt(tiles.length)) || 3;
  document.addEventListener('keydown', e => {
    const current = document.activeElement;
    const index = tiles.indexOf(current);
    if (index === -1) return;

    switch(e.key){
      case 'ArrowRight': if(index<tiles.length-1) tiles[index+1].focus(); e.preventDefault(); break;
      case 'ArrowLeft': if(index>0) tiles[index-1].focus(); e.preventDefault(); break;
      case 'ArrowDown': if(index+cols<tiles.length) tiles[index+cols].focus(); e.preventDefault(); break;
      case 'ArrowUp': if(index-cols>=0) tiles[index-cols].focus(); e.preventDefault(); break;
      case 'Enter':
      case ' ':
        if(!gameEnded) current.click(); e.preventDefault(); break;
    }
  });
}

// --- BOOT ---
document.addEventListener('DOMContentLoaded', () => {
  // Clear best scores if this is a fresh load
  localStorage.removeItem('bm_best');

  // Initialize the game
  init();
});
window.bmReplayGame = replayGame;
