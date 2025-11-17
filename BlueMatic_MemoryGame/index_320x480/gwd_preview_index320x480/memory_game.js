// --- CONFIG ---
const containerId = 'container';
const overlayId = 'overlay';
const messageId = 'message';
const replayBtnId = 'replayBtn';
const ctaBtnId = 'ctaBtn';
const timerDisplayId = 'time';
const attemptsDisplayId = 'attempts';

const startTime = 60;       // seconds
const maxAttempts = 10;     // max attempts
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

// --- HELPERS ---
function $(id){ return document.getElementById(id); }
function formatTime(seconds){
  const m = Math.floor(seconds/60);
  const s = seconds%60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function playSoundById(id){
  if(muted) return;
  const audio = $(id);
  if(!audio) return;
  audio.currentTime = 0;
  audio.play().catch(e=>console.log('Audio play failed:', e));
}

// --- INIT ---
function init(){
  tilesContainer = $(containerId);
  if(!tilesContainer) return;

  // Assign tiles to global variable
  tiles = Array.from(tilesContainer.children);

  // Reset tiles
  tiles.forEach(tile=>{
    tile.setAttribute('tabindex','0'); // make focusable
    tile.classList.remove('flipped','matched','wrong','shake');
    tile.addEventListener('click', onTileClick);
  });

  // Focus first tile after rendering
/*   requestAnimationFrame(()=>{ if(tiles.length) tiles[0].focus(); }); */

  // Initialize keyboard
/*   initKeyboardNavigation(); */

  // Buttons
  const replayBtn = $(replayBtnId);
  const ctaBtn = $(ctaBtnId);
  if(replayBtn) replayBtn.addEventListener('click', replayGame);
  if(ctaBtn) ctaBtn.addEventListener('click', onCtaClick);

  const muteBtn = $('muteBtn');
  if(muteBtn) muteBtn.addEventListener('click', ()=>{
    muted = !muted;
    muteBtn.textContent = muted ? '🔇' : '🔊';
  });

  resetState();
  initScoreboard();
}

// --- KEYBOARD NAVIGATION ---
/* function initKeyboardNavigation(){
  if(!tiles.length) return;

  // Determine number of columns dynamically from first row
  const firstRowTop = tiles[0].offsetTop;
  let cols = 0;
  for(let i=0;i<tiles.length;i++){
    if(tiles[i].offsetTop !== firstRowTop) break;
    cols++;
  }

  document.addEventListener('keydown', e=>{
    const current = document.activeElement;
    const index = tiles.indexOf(current);
    if(index === -1) return; // only act if a tile is focused

    switch(e.key){
      case 'ArrowRight':
        if(index+1<tiles.length) tiles[index+1].focus();
        e.preventDefault();
        break;
      case 'ArrowLeft':
        if(index-1>=0) tiles[index-1].focus();
        e.preventDefault();
        break;
      case 'ArrowDown':
        if(index+cols<tiles.length) tiles[index+cols].focus();
        e.preventDefault();
        break;
      case 'ArrowUp':
        if(index-cols>=0) tiles[index-cols].focus();
        e.preventDefault();
        break;
      case 'Enter':
      case ' ':
        if(!gameEnded) current.click();
        e.preventDefault();
        break;
    }
  });
} */

// --- TILE CLICK ---
function onTileClick(e){
  const tile = e.currentTarget||this;
  if(gameEnded || tile.classList.contains('flipped') || flippedTiles.length===2) return;

  tile.classList.add('flipped');
  playSoundById('flipSound');
  flippedTiles.push(tile);

  if(!gameStarted) startTimer();
/*   window.dispatchEvent(new CustomEvent('bm_game_start',{detail:{}})); */

  if(flippedTiles.length===2){
    attempts++;
    updateCurrentScore();
    updateDisplays();
    setTimeout(checkForMatch, 1000);

    if(attempts>=maxAttempts && pairsFound<totalPairs){
      setTimeout(()=>endGame(false,'attempts'),450);
    }
  }
}

// --- CHECK MATCH ---
function checkForMatch(){
  const [a,b] = flippedTiles;
  if(!a || !b) return;

  const valA = a.querySelector('.back')?.dataset.img || a.dataset.value;
  const valB = b.querySelector('.back')?.dataset.img || b.dataset.value;

  if(valA && valB && valA===valB){
    pairsFound++;
    window.dispatchEvent(new CustomEvent('bm_pair_match',{detail:{pairsFound,attempts}}));
    a.classList.add('matched');
    b.classList.add('matched');
    playSoundById('matchSound');
    setTimeout(()=>{a.classList.remove('matched'); b.classList.remove('matched');},700);
  } else {
    a.classList.add('wrong','shake');
    b.classList.add('wrong','shake');
    playSoundById('wrongSound');
    setTimeout(()=>{a.classList.remove('flipped','wrong','shake'); b.classList.remove('flipped','wrong','shake');},800);
  }

  flippedTiles = [];
  if(pairsFound===totalPairs) setTimeout(()=>endGame(true,'win'),300);
}

// --- TIMER ---
function startTimer(){
  if(gameStarted) return;
  gameStarted = true;
  timerInterval = setInterval(()=>{
    timer--;
    updateDisplays();
    if(timer<=0){
      clearInterval(timerInterval);
      endGame(false,'time');
    }
  },1000);
}

// --- END GAME ---
function endGame(didWin,reason='win'){
  if(gameEnded) return;
  gameEnded = true;
  clearInterval(timerInterval);

  tiles.forEach(t=>t.removeEventListener('click',onTileClick));

  const overlay = $(overlayId);
  const messageEl = $(messageId);
  if(overlay && messageEl){
    overlay.style.display='flex';
    if(didWin) messageEl.textContent="🎉 Congratulations — you matched all tiles!";
    else if(reason==='time') messageEl.textContent="⏱ Time’s up! Try again!";
    else if(reason==='attempts') messageEl.textContent="❌ Max attempts reached!";
  }

  updateBestScores();
  playSoundById(didWin?'winSound':'loseSound');
  updateCurrentScore();
  window.dispatchEvent(new CustomEvent('bm_game_end',{detail:{attempts,timer}}));
}

// --- RESET STATE ---
function resetState(){
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

// --- REPLAY ---
function replayGame(){
  const overlay = $(overlayId);
  if(overlay) overlay.style.display='none';

  tiles.forEach(t=>{
    t.classList.remove('flipped','matched','wrong','shake');
    t.addEventListener('click',onTileClick);
  });

  resetState();
}

// --- CTA ---
function onCtaClick(){
  window.dispatchEvent(new CustomEvent('bm_exit_click',{detail:{}}));
  const cta = $(ctaBtnId);
  if(cta && cta.dataset?.url) window.open(cta.dataset.url,'_blank');
}

// --- UPDATE DISPLAYS ---
function updateDisplays(){
  const tEl = $(timerDisplayId);
  const aEl = $(attemptsDisplayId);

  if(tEl){
    let minutes = Math.floor(timer/60);
    let seconds = timer%60;
    tEl.textContent = `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
    tEl.style.color = timer<=10?'red':'';
  }

  if(aEl) aEl.textContent = attempts;
}

// --- SCOREBOARD ---
function initScoreboard(){ updateCurrentScore(); displayBestScores(); }

// --- BOOT ---
document.addEventListener('DOMContentLoaded',()=>{
  localStorage.removeItem('bm_best');
  init();
});
window.bmReplayGame = replayGame;
