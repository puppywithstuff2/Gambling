// Gambling Simulator - slots + russian roulette + localStorage + win modal
(() => {
  const LS_BAL = 'gamb_sim_balance_v1';
  const LS_HISTORY = 'gamb_sim_history_v1';

  const symbols = ['🍒','🍋','🔔','🍉','⭐','💎','7️⃣'];
  const special = '🍒'; // special jackpot symbol

  // DOM
  const balanceEl = document.getElementById('balance');
  const betInput = document.getElementById('betInput');
  const spinBtn = document.getElementById('spinBtn');
  const messageEl = document.getElementById('message');
  const historyEl = document.getElementById('history');
  const reelEls = [document.getElementById('reel0'), document.getElementById('reel1'), document.getElementById('reel2')];
  const autoToggle = document.getElementById('autoToggle');
  const autoCountInput = document.getElementById('autoCount');
  const quickBtns = document.querySelectorAll('.quick');
  const maxBtn = document.getElementById('maxBet');

  const rrBtn = document.getElementById('rrBtn');
  const modal = document.getElementById('modal');
  const modalCancel = document.getElementById('modalCancel');
  const modalConfirm = document.getElementById('modalConfirm');

  const winModal = document.getElementById('winModal');
  const winKeepBtn = document.getElementById('winKeep');
  const winRestartBtn = document.getElementById('winRestart');

  const gameOver = document.getElementById('gameOver');
  const restartBtn = document.getElementById('restartBtn');

  // Game config
  const START_TOKENS = 100;
  const RR_COST = 1000;
  const RR_PAYOUT = 2500;
  const WIN_TARGET = 1000000;

  // State
  let balance = START_TOKENS;
  let spinning = false;
  let autoRemaining = 0;
  let history = [];
  let winShown = false; // whether the win modal has been shown (to avoid repeated popups)

  // Storage helpers
  function saveState() {
    localStorage.setItem(LS_BAL, String(balance));
    localStorage.setItem(LS_HISTORY, JSON.stringify(history.slice(0,100)));
  }
  function loadState() {
    const b = localStorage.getItem(LS_BAL);
    const h = localStorage.getItem(LS_HISTORY);
    if (b !== null) balance = Number(b);
    else balance = START_TOKENS;
    try {
      history = h ? JSON.parse(h) : [];
    } catch (e) { history = []; }
  }

  function updateBalance() {
    balanceEl.textContent = balance.toString();
    // update rr button state
    rrBtn.disabled = balance < RR_COST;
    // ensure bet input not greater than balance
    if (Number(betInput.value) > balance) betInput.value = Math.max(1, balance);
    saveState();
    checkWin();
  }

  function checkWin() {
    if (!winShown && balance >= WIN_TARGET) {
      // show win modal
      winShown = true;
      openWinModal();
    }
  }

  function renderHistory() {
    historyEl.innerHTML = '';
    for (const entry of history.slice().reverse()) {
      const li = document.createElement('li');
      li.className = `type-${entry.type}`;
      const left = document.createElement('span');
      left.textContent = `${entry.text}`;
      const right = document.createElement('span');
      right.className = entry.change > 0 ? 'win' : 'lose';
      right.textContent = (entry.change > 0 ? '+' : '') + entry.change;
      li.appendChild(left);
      li.appendChild(right);
      historyEl.appendChild(li);
    }
  }

  function addHistory(text, change, type='slot') {
    const entry = { text, change, type, ts: Date.now() };
    history.push(entry);
    // keep last 100
    history = history.slice(-100);
    renderHistory();
    saveState();
  }

  function randomSymbol() {
    return symbols[Math.floor(Math.random()*symbols.length)];
  }

  function getOutcome(finalSymbols, bet) {
    const [a,b,c] = finalSymbols;
    let multiplier = 0;
    if (a === b && b === c) {
      if (a === special) multiplier = 50; // jackpot
      else multiplier = 10; // triple
    } else if (a === b || b === c || a === c) {
      multiplier = 2; // pair
    } else {
      multiplier = 0;
    }
    const payout = Math.floor(bet * multiplier);
    return {multiplier,payout};
  }

  function setReelSymbol(reelIndex, symbol) {
    const reel = reelEls[reelIndex];
    reel.innerHTML = `<div class="symbol">${symbol}</div>`;
  }

  function animateReel(reelIndex, finalSymbol, duration=1000) {
    return new Promise(resolve => {
      const spinSpeed = 80;
      const interval = setInterval(() => {
        setReelSymbol(reelIndex, randomSymbol());
      }, spinSpeed);
      setTimeout(() => {
        clearInterval(interval);
        setReelSymbol(reelIndex, finalSymbol);
        resolve();
      }, duration + Math.floor(Math.random()*200));
    });
  }

  async function doSpin(bet) {
    if (spinning) return;
    if (bet <= 0) {
      messageEl.textContent = 'Bet must be > 0';
      return;
    }
    if (bet > balance) {
      messageEl.textContent = 'Not enough tokens';
      return;
    }

    spinning = true;
    spinBtn.disabled = true;
    messageEl.textContent = 'Spinning...';
    balance -= bet;
    updateBalance();

    const finalSymbols = [randomSymbol(), randomSymbol(), randomSymbol()];
    const durations = [900, 1400, 1900];
    await Promise.all([
      animateReel(0, finalSymbols[0], durations[0]),
      new Promise(r => setTimeout(r, 150)).then(()=> animateReel(1, finalSymbols[1], durations[1])),
      new Promise(r => setTimeout(r, 300)).then(()=> animateReel(2, finalSymbols[2], durations[2]))
    ]);

    const {multiplier,payout} = getOutcome(finalSymbols, bet);
    if (payout > 0) {
      balance += payout;
      reelEls.forEach(r => r.classList.add('win-flash'));
      setTimeout(()=> reelEls.forEach(r => r.classList.remove('win-flash')),700);
      messageEl.textContent = `You won ${payout} (${multiplier}×)!`;
    } else {
      messageEl.textContent = `You lost ${bet}. Try again.`;
    }
    updateBalance();
    addHistory(finalSymbols.join(' '), payout, 'slot');

    spinning = false;
    spinBtn.disabled = false;

    // handle autoplay
    if (autoToggle.checked) {
      autoRemaining = parseInt(autoCountInput.value) || 0;
      if (autoRemaining > 0) {
        autoRemaining--;
        if (balance >= bet && autoRemaining >= 0) {
          setTimeout(()=> doSpin(bet), 600);
        } else {
          autoToggle.checked = false;
          messageEl.textContent += ' Auto stopped.';
        }
      } else {
        autoToggle.checked = false;
        messageEl.textContent += ' Auto finished.';
      }
    }
  }

  // Roulette logic
  function openRRModal() {
    modal.classList.remove('hidden');
  }
  function closeRRModal() {
    modal.classList.add('hidden');
  }

  function playRoulette() {
    closeRRModal();
    if (balance < RR_COST) {
      messageEl.textContent = 'Not enough tokens to play Roulette.';
      return;
    }
    // charge cost
    balance -= RR_COST;
    updateBalance();
    messageEl.textContent = 'Russian Roulette...';
    // small delay to build suspense
    setTimeout(() => {
      const roll = Math.floor(Math.random()*6) + 1; // 1..6
      if (roll === 1) {
        // died
        balance = 0;
        updateBalance();
        addHistory('Roulette - DIED', -RR_COST, 'rr');
        // show game over
        showGameOver();
      } else {
        // survived and win payout
        balance += RR_PAYOUT;
        updateBalance();
        addHistory('Roulette - Survived', RR_PAYOUT - RR_COST, 'rr');
        messageEl.textContent = `You survived! Payout: ${RR_PAYOUT}`;
      }
    }, 900);
  }

  function openWinModal() {
    winModal.classList.remove('hidden');
    // show the user's current balance in the modal (optional)
  }
  function closeWinModal() {
    winModal.classList.add('hidden');
  }

  function showGameOver() {
    gameOver.classList.remove('hidden');
  }
  function hideGameOver() {
    gameOver.classList.add('hidden');
  }

  function restartAfterDeath() {
    balance = START_TOKENS;
    history = [];
    winShown = false;
    saveState();
    renderHistory();
    updateBalance();
    hideGameOver();
    closeWinModal();
    messageEl.textContent = 'You have been reset to 100 tokens. Good luck!';
  }

  function restartAfterWin() {
    // same reset behavior as death restart
    balance = START_TOKENS;
    history = [];
    winShown = false;
    saveState();
    renderHistory();
    updateBalance();
    closeWinModal();
    messageEl.textContent = 'Game restarted at 100 tokens. Good luck!';
  }

  // UI events
  spinBtn.addEventListener('click', () => {
    const bet = Math.max(1, Math.floor(Number(betInput.value) || 0));
    doSpin(bet);
  });

  quickBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      betInput.value = e.target.dataset.bet;
    });
  });

  maxBtn.addEventListener('click', () => {
    betInput.value = Math.max(1, balance);
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.code === 'Space') {
      ev.preventDefault();
      spinBtn.click();
    }
  });

  // Roulette events
  rrBtn.addEventListener('click', () => {
    openRRModal();
  });
  modalCancel.addEventListener('click', closeRRModal);
  modalConfirm.addEventListener('click', playRoulette);

  // Win modal events
  winKeepBtn.addEventListener('click', () => {
    // close modal and allow player to continue gambling
    closeWinModal();
    messageEl.textContent = `You reached ${WIN_TARGET.toLocaleString()} tokens — keep gambling!`;
    // don't show the win modal again in this session
    winShown = true;
  });
  winRestartBtn.addEventListener('click', restartAfterWin);

  restartBtn.addEventListener('click', restartAfterDeath);

  // Initialize
  function init() {
    loadState();
    // seed reels
    for (let i=0;i<3;i++) setReelSymbol(i, randomSymbol());
    renderHistory();
    updateBalance();
    // seed some history if empty
    if (history.length === 0) {
      addHistory('💎 💎 💎', 200, 'slot');
      addHistory('🍒 🍋 🍉', 0, 'slot');
    }
    // If player already has >= WIN_TARGET on load, show win modal once
    if (balance >= WIN_TARGET) {
      checkWin();
    }
  }

  init();

  // Expose for debugging
  window.__gamb = {
    get balance(){return balance},
    set balance(v){ balance = v; updateBalance(); },
    restartAfterDeath
  };

})();
