let socket;
let selectedChip = null;
let currentBets = {};
let totalBet = 0;
let balance = 1000;
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NzQ2YTNhNmQ1OGVjNjZlZTBjOTk4OTUiLCJpYXQiOjE3MzI2ODI2OTl9.9AiuHpL7zzjMHNrAJXLs_8_Qi7QjtNAv_VEEVreX6wQ';
const API_URL = 'http://localhost:3030';
let ctx;
let startAngle = 0;
const numbers = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const arc = Math.PI / (numbers.length / 2);
let spinTimeout = null;
let spinTime = 0;
let spinTimeTotal = 0;
let currentBoardId = null;

// Configure axios defaults
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    authorization: AUTH_TOKEN,
  },
});

// Add this helper function at the top of the file
function getSpinButton() {
  return document.getElementById('spin');
}

// Add this function at the top of the file, after the initial variables
function addGameStyles() {
  // Check if styles are already added
  if (document.getElementById('roulette-game-styles')) {
    return;
  }

  const gameStyles = `
        #game-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            font-family: Arial, sans-serif;
        }

        .player-info {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 20px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 5px;
        }

        .chips-container {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }

        .chip {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #ffd700;
            cursor: pointer;
            transition: transform 0.2s;
        }

        .chip:hover {
            transform: scale(1.1);
        }

        .chip.selected {
            border: 3px solid #2ecc71;
        }

        .roulette-table {
            margin: 20px 0;
            padding: 20px;
            background: #006400;
            border-radius: 10px;
        }

        .numbers-grid {
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            gap: 2px;
            margin-bottom: 10px;
        }

        .betting-options {
            display: flex;
            gap: 10px;
            margin-top: 10px;
        }

        .option {
            padding: 10px 20px;
            background: #34495e;
            color: white;
            cursor: pointer;
            border-radius: 5px;
            text-align: center;
        }

        .option:hover {
            background: #2c3e50;
        }

        #winning-number-display {
            margin-top: 20px;
            text-align: center;
            font-size: 24px;
            font-weight: bold;
        }
    `;

  const styleElement = document.createElement('style');
  styleElement.id = 'roulette-game-styles';
  styleElement.textContent = gameStyles;
  document.head.appendChild(styleElement);
}

// Initialize the game
function init() {
  try {
    console.log('Initializing game...');

    // Verify DOM elements exist
    const requiredElements = {
      spin: document.getElementById('spin'),
      'winning-number': document.getElementById('winning-number'),
      'winners-container': document.getElementById('winners-container'),
    };

    // Log missing elements
    Object.entries(requiredElements).forEach(([name, element]) => {
      if (!element) {
        console.error(`Required element "${name}" not found in DOM`);
      }
    });

    // Add styles first
    addGameStyles();

    // Create roulette wheel
    rouletteWheel = new RouletteWheel();
    rouletteWheel.init();

    // Initialize other components
    createNumbersGrid();
    setupBettingEvents();
    initializeSocket();

    // Initialize spin button with checks
    const spinBtn = document.getElementById('spin');
    if (spinBtn) {
      console.log('Initializing spin button');
      spinBtn.disabled = true;
      spinBtn.addEventListener('click', startSpin);
    } else {
      throw new Error('Spin button not found during initialization');
    }

    console.log('Game initialized successfully');
  } catch (error) {
    console.error('Initialization error:', error);
    alert('Failed to initialize game: ' + error.message);
  }
}

// First join the game via REST API
function joinGame() {
  return api
    .post('/api/v1/roulette/join')
    .then(response => {
      console.log('Join game response:', response.data);
      if (response.data.data?.board?._id) {
        currentBoardId = response.data.data.board._id;
        console.log('Board ID:', currentBoardId);
      }
      return response.data;
    })
    .catch(error => {
      console.error('Join game error:', error);
      if (error.code === 'ERR_NETWORK') {
        alert('Server is not running. Please start the server and try again.');
      } else {
        alert(`Failed to join game: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    });
}

// Connect to socket
function initializeSocket() {
  console.log('Initializing socket connection...');

  joinGame()
    .then(joinData => {
      console.log('Join game successful:', joinData);

      // Socket options ને વધુ robust બનાવો
      const socketOptions = {
        auth: {
          authorization: AUTH_TOKEN,
        },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
      };

      // Socket connection
      socket = io(API_URL, socketOptions);

      // Connection handlers
      socket.on('connect', () => {
        console.log('Socket connected successfully');

        // Join board room
        if (joinData.data?.board?.boardId) {
          socket.emit(
            'reqJoinBoard',
            {
              iBoardId: joinData.data.board.boardId,
            },
            response => {
              if (response.error) {
                console.error('Join board error:', response.error);
                alert('Failed to join board: ' + response.error);
                return;
              }
              console.log('Joined board successfully:', response);
              currentBoardId = joinData.data.board.boardId;
              updateUserDisplay(response.user);
            }
          );
        }
      });

      // Error handlers
      socket.on('connect_error', error => {
        console.error('Socket connection error:', error);
        alert('Connection error. Please check your internet connection.');
      });

      socket.on('connect_timeout', () => {
        console.error('Socket connection timeout');
        alert('Connection timeout. Please try again.');
      });

      socket.on('error', error => {
        console.error('Socket error:', error);
        alert('An error occurred: ' + error.message);
      });

      // Game event handlers
      setupGameEventListeners();
    })
    .catch(error => {
      console.error('Failed to initialize game:', error);
      alert('Failed to join game. Please try again.');
    });
}

// Game event listeners ને update કરો
function setupGameEventListeners() {
  // Clean up existing listeners if any
  socket.off('bettingClosed');
  socket.off('spinResult');
  socket.off('playerJoined');
  socket.off('playerLeft');

  socket.on('bettingClosed', data => {
    console.log('Betting closed event received:', data);
    const spinBtn = document.getElementById('spin');
    console.log('Spin button found:', spinBtn);

    if (spinBtn) {
      spinBtn.disabled = true;
      console.log('Spin button disabled');
    } else {
      console.warn('Spin button not found when betting closed');
    }
  });

  let isSpinning = false; // Add flag to prevent multiple spins

  socket.on('spinResult', result => {
    // Prevent multiple spin results
    if (isSpinning) {
      console.log('Spin already in progress, ignoring duplicate event');
      return;
    }

    isSpinning = true;
    console.log('Spin result event received:', result);

    // Spin the wheel
    if (rouletteWheel) {
      console.log('Starting wheel spin animation');
      rouletteWheel.spin(result.number);
    } else {
      console.warn('Roulette wheel not initialized');
    }

    // Update UI
    updateUIAfterSpin(result);

    // Reset spinning flag after animation completes
    setTimeout(() => {
      isSpinning = false;
    }, (result.nextRoundIn || 10) * 1000);
  });

  socket.on('playerJoined', data => {
    console.log('Player joined:', data);
    updateParticipants(data.participants);
  });

  socket.on('playerLeft', data => {
    console.log('Player left:', data);
    updateParticipants(data.participants);
  });
}

// Update updateUIAfterSpin with better error handling
function updateUIAfterSpin(result) {
  console.log('Updating UI after spin:', result);

  try {
    // Update winning number display
    const winningNumberElement = document.getElementById('winning-number');
    if (winningNumberElement) {
      winningNumberElement.textContent = `${result.number} (${result.color})`;
      winningNumberElement.className = `winner-number ${result.color}`;
      console.log('Updated winning number display');
    } else {
      console.warn('Winning number element not found');
    }

    // Update winners display
    if (result.winners && result.winners.length > 0) {
      const winnersContainer = document.getElementById('winners-container');
      if (winnersContainer) {
        winnersContainer.innerHTML = '<h3>Winners</h3>';
        result.winners.forEach(winner => {
          const winnerElement = document.createElement('div');
          winnerElement.className = 'winner-item';
          winnerElement.innerHTML = `
                        <span class="winner-name">${winner.userId}</span>
                        <span class="win-amount">+${winner.winAmount}</span>
                    `;
          winnersContainer.appendChild(winnerElement);
        });
        console.log('Updated winners display');
      }
    }

    // Reset game state after delay
    setTimeout(() => {
      try {
        console.log('Resetting game state');

        // First clear bets without touching spin button
        currentBets = {};
        totalBet = 0;

        const totalBetElement = document.getElementById('total-bet');
        if (totalBetElement) {
          totalBetElement.textContent = '0';
        }

        // Then handle spin button separately
        const spinBtn = document.getElementById('spin');
        if (spinBtn) {
          spinBtn.disabled = false;
          console.log('Spin button enabled for next round');
        }
      } catch (error) {
        console.warn('Error in reset timeout:', error);
      }
    }, (result.nextRoundIn || 10) * 1000);
  } catch (error) {
    console.error('Error updating UI after spin:', error);
  }
}

function placeBet(betType, betDetails) {
  if (!socket?.connected) {
    console.error('Socket not connected');
    alert('Connection lost. Please refresh the page.');
    return;
  }

  if (!selectedChip) {
    alert('Please select a chip first');
    return;
  }

  if (!currentBoardId) {
    console.error('No board ID available');
    alert('Game not initialized properly');
    return;
  }

  const betData = {
    event: 'placeBet',
    data: {
      bets: [
        {
          betType,
          betDetails,
          amount: selectedChip,
        },
      ],
    },
  };

  console.log('Placing bet:', betData);

  socket.emit(currentBoardId, betData, response => {
    console.log('Bet response:', response);

    if (response.error) {
      console.error('Bet error:', response.error);
      alert(response.error);
      return;
    }

    updateBetDisplay(betData.data.bets[0]);
    updateGameState(response.board);

    // Enable spin button after successful bet
    const spinBtn = getSpinButton();
    if (spinBtn) {
      spinBtn.disabled = false;
    }
  });
}

// Spin function ને update કરો
function startSpin() {
  if (!socket?.connected) {
    console.error('Socket not connected');
    alert('Connection lost. Please refresh the page.');
    return;
  }

  if (!currentBoardId) {
    console.error('No board ID available');
    alert('Game not initialized properly');
    return;
  }

  console.log('Starting spin...');

  const spinBtn = getSpinButton();
  if (spinBtn) {
    spinBtn.disabled = true;
  }

  // Emit startSpin event to server
  socket.emit(currentBoardId, {
    event: 'startSpin',
  });
}

// Roulette wheel configuration
const WHEEL_RADIUS = 200;
const CENTER_X = 250;
const CENTER_Y = 250;
const NUMBERS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

function createWheel() {
  const wheelContainer = document.querySelector('.wheel-container');
  wheelContainer.innerHTML = `
        <div class="wheel">
            <div class="wheel-inner">
                ${NUMBERS.map((number, index) => {
                  const angle = (index * 360) / NUMBERS.length;
                  const color = number === 0 ? 'green' : isRed(number) ? 'red' : 'black';
                  return `
                        <div class="number ${color}" 
                             style="transform: rotate(${angle}deg) translateY(-${WHEEL_RADIUS}px)">
                            ${number}
                        </div>`;
                }).join('')}
            </div>
            <div class="ball"></div>
        </div>
        <div class="winner">Winner: <span id="winning-number"></span></div>
    `;
}

function spinWheel(winningNumber) {
  const wheel = document.querySelector('.wheel-inner');
  const ball = document.querySelector('.ball');

  // Find the winning number's position
  const winningIndex = NUMBERS.indexOf(winningNumber);
  const baseRotations = 8; // Number of full rotations
  const finalAngle = 360 * baseRotations + winningIndex * (360 / NUMBERS.length);

  // Reset wheel and ball
  wheel.style.transform = 'rotate(0deg)';
  ball.style.transform = 'rotate(0deg)';

  // Force reflow
  wheel.offsetHeight;

  // Add spinning animations
  wheel.style.transition = 'transform 8s cubic-bezier(0.32, 0.64, 0.45, 1)';
  wheel.style.transform = `rotate(${finalAngle}deg)`;

  ball.style.display = 'block';
  ball.style.transition = 'transform 8s cubic-bezier(0.32, 0.64, 0.45, 1)';
  ball.style.transform = `rotate(${-finalAngle * 2}deg)`;

  // Update winner after animation
  setTimeout(() => {
    document.getElementById('winning-number').textContent = winningNumber;
    document.querySelector('.winner').classList.add('show');
  }, 8000);
}

function createNumbersGrid() {
  console.log('Creating numbers grid');
  const numbersContainer = document.querySelector('.numbers');
  if (!numbersContainer) {
    console.error('Numbers container not found');
    return;
  }

  // Clear existing numbers
  numbersContainer.innerHTML = '';

  // Create number cells
  for (let i = 1; i <= 36; i++) {
    const numberCell = document.createElement('div');
    numberCell.className = `number ${isRed(i) ? 'red' : 'black'}`;
    numberCell.textContent = i;
    // Add data-number attribute
    numberCell.setAttribute('data-number', i);

    numberCell.addEventListener('click', () => {
      console.log(`Number ${i} clicked`);
      if (!selectedChip) {
        alert('Please select a chip first');
        return;
      }
      placeSingleBet(i);
    });

    numbersContainer.appendChild(numberCell);
  }

  // Add zero with data-number attribute
  const zeroCell = document.querySelector('.zero');
  if (zeroCell) {
    zeroCell.setAttribute('data-number', '0');
    zeroCell.addEventListener('click', () => {
      console.log('Zero clicked');
      if (!selectedChip) {
        alert('Please select a chip first');
        return;
      }
      placeSingleBet(0);
    });
  }
}

function setupEventListeners() {
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      selectedChip = parseInt(chip.dataset.value);
    });
  });

  document.querySelectorAll('.number, .zero').forEach(number => {
    number.addEventListener('click', () => placeBet('STRAIGHT', { number: parseInt(number.dataset.number) }));
  });

  document.querySelectorAll('.bet-btn').forEach(btn => {
    btn.addEventListener('click', () => placeBet(btn.dataset.type, {}));
  });

  document.getElementById('spin-btn').addEventListener('click', startSpin);
  document.getElementById('clear-btn').addEventListener('click', clearBets);
}

// Update bet display
function updateBetDisplay(bet) {
  balance -= bet.amount;
  totalBet += bet.amount;
  document.getElementById('balance').textContent = balance;
  document.getElementById('total-bet').textContent = totalBet;
  document.getElementById('spin-btn').disabled = false;
}

// Start the spin
function startSpin() {
  socket.emit(currentBoardId, {
    event: 'startSpin',
  });
  // document.getElementById('spin-btn').disabled = true;
}

// Show the result
function showResult(number, color) {
  // Animate wheel and show winning number
}

// Update balances after spin
function updateBalances(winners) {
  // Update player balances based on winners
}

// Clear all bets
function clearBets() {
  console.log('Clearing all bets');

  // Clear bet amounts from numbers
  document.querySelectorAll('.number, .zero').forEach(element => {
    element.removeAttribute('data-bet-amount');
    const betDisplay = element.querySelector('.bet-amount');
    if (betDisplay) {
      betDisplay.remove();
    }
    element.classList.remove('has-bet');
  });

  // Reset totals
  totalBet = 0;
  document.getElementById('total-bet').textContent = '0';
  document.getElementById('spin').disabled = true;
}

// Helper function to determine if a number is red
function isRed(number) {
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return redNumbers.includes(number);
}

// Initialize the game when the page loads
window.addEventListener('load', init);

// Update user display
function updateUserDisplay(user) {
  if (user) {
    console.log('Updating user display:', user);
    document.getElementById('username').textContent = user.sUserName || 'Player';
    updateBalance(user.nChips);
  }
}

// Update balance display
function updateBalance(newBalance) {
  balance = newBalance;
  document.getElementById('user-balance').textContent = balance.toLocaleString();
  console.log('Balance updated to:', balance);
}

// Update game state
function updateGameState(boardState) {
  if (boardState.participants) {
    const currentUser = boardState.participants.find(p => p.iUserId === '6746a3a6d58ec66ee0c99895');
    if (currentUser) {
      updateUserDisplay({
        sUserName: currentUser.sUserName,
        nChips: currentUser.nChips,
      });
    }
  }

  if (boardState.currentBets) {
    Object.entries(boardState.currentBets).forEach(([type, bets]) => {
      bets.forEach(bet => updateBetDisplay(bet));
    });
  }
}

// Add these new functions for betting with logs

function placeSingleBet(number) {
  console.log('Placing single bet on number:', number);

  if (!selectedChip) {
    console.log('No chip selected');
    alert('Please select a chip first');
    return;
  }

  if (selectedChip > balance) {
    console.log('Insufficient balance');
    alert('Insufficient balance');
    return;
  }

  const bet = {
    betType: 'STRAIGHT',
    betDetails: { number: parseInt(number) },
    amount: selectedChip,
  };

  // Find the number element
  const numberElement = number === 0 ? document.querySelector('.zero') : document.querySelector(`.number[data-number="${number}"]`);

  if (numberElement) {
    // Get existing bet amount or start at 0
    const existingAmount = parseInt(numberElement.getAttribute('data-bet-amount') || '0');
    const newAmount = existingAmount + selectedChip;

    // Update data attribute
    numberElement.setAttribute('data-bet-amount', newAmount);

    // Add or update bet amount display
    let betDisplay = numberElement.querySelector('.bet-amount');
    if (!betDisplay) {
      betDisplay = document.createElement('div');
      betDisplay.className = 'bet-amount';
      numberElement.appendChild(betDisplay);
    }
    betDisplay.textContent = newAmount;

    // Add betting indicator class
    numberElement.classList.add('has-bet');
  }

  // Update total bet and balance
  totalBet += selectedChip;
  balance -= selectedChip;

  document.getElementById('total-bet').textContent = totalBet;
  document.getElementById('user-balance').textContent = balance;

  // Enable spin button
  document.getElementById('spin').disabled = false;
}

function placeColorBet(color) {
  console.log('Attempting to place color bet:', color);

  if (!selectedChip) {
    console.log('No chip selected');
    alert('Please select a chip first');
    return;
  }

  console.log('Selected chip value:', selectedChip);

  const bet = {
    betType: color, // 'RED' or 'BLACK'
    betDetails: {},
    amount: selectedChip,
  };

  console.log('Created color bet object:', bet);
  sendBet(bet);
}

function placeEvenOddBet(type) {
  console.log('Attempting to place even/odd bet:', type);

  if (!selectedChip) {
    console.log('No chip selected');
    alert('Please select a chip first');
    return;
  }

  console.log('Selected chip value:', selectedChip);

  const bet = {
    betType: type, // 'EVEN' or 'ODD'
    betDetails: {},
    amount: selectedChip,
  };

  console.log('Created even/odd bet object:', bet);
  sendBet(bet);
}

function placeRangeBet(type) {
  console.log('Attempting to place range bet:', type);

  if (!selectedChip) {
    console.log('No chip selected');
    alert('Please select a chip first');
    return;
  }

  console.log('Selected chip value:', selectedChip);

  const bet = {
    betType: type, // 'LOW' (1-18) or 'HIGH' (19-36)
    betDetails: {},
    amount: selectedChip,
  };

  console.log('Created range bet object:', bet);
  sendBet(bet);
}

function sendBet(bet) {
  console.log('Attempting to send bet:', bet);
  console.log('Current balance:', balance);

  if (selectedChip > balance) {
    console.log('Insufficient balance for bet');
    alert('Insufficient balance');
    return;
  }

  console.log('Emitting socket event for bet placement');
  socket.emit(
    currentBoardId,
    {
      event: 'placeBet',
      data: { bets: [bet] },
    },
    response => {
      console.log('Received bet response:', response);

      if (response.error) {
        console.error('Bet error:', response.error);
        alert(response.error);
      } else {
        console.log('Bet placed successfully');
        updateBetDisplay(bet);
        document.getElementById('spin-btn').disabled = false;
      }
    }
  );
}

function setupBettingEvents() {
  console.log('Setting up betting events');

  // Chip selection
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      console.log('Chip clicked:', chip.dataset.value);
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      selectedChip = parseInt(chip.dataset.value);
      console.log('Selected chip value:', selectedChip);
    });
  });

  // Add spin button event listener
  const spinButton = document.getElementById('spin');
  if (spinButton) {
    spinButton.addEventListener('click', () => {
      console.log('Spin button clicked');
      // handleStartSpin();
      startSpin();
      spinButton.disabled = true; // Disable button during spin
    });
  } else {
    console.error('Spin button not found');
  }

  // Clear bets button
  document.getElementById('clear-btn')?.addEventListener('click', () => {
    console.log('Clear button clicked');
    clearBets();
  });
}

function updateBetDisplay(bet) {
  console.log('Updating bet display:', bet);

  const betsList = document.getElementById('bets-list');
  const betElement = document.createElement('div');
  betElement.className = 'bet-item';

  let betDescription = '';
  switch (bet.betType) {
    case 'STRAIGHT':
      betDescription = `Number ${bet.betDetails.number}`;
      break;
    default:
      betDescription = bet.betType;
  }

  betElement.innerHTML = `
        <span class="bet-type">${betDescription}</span>
        <span class="bet-amount">${bet.amount}</span>
    `;
  betsList.appendChild(betElement);

  // Update total bet
  totalBet += bet.amount;
  document.getElementById('total-bet').textContent = totalBet;

  // Update balance
  balance -= bet.amount;
  document.getElementById('user-balance').textContent = balance;

  console.log('Bet display updated. Total bet:', totalBet, 'Balance:', balance);
}

function clearBets() {
  console.log('Clearing all bets');
  const betsList = document.getElementById('bets-list');
  betsList.innerHTML = '';
  totalBet = 0;
  document.getElementById('total-bet').textContent = '0';
  document.getElementById('spin-btn').disabled = true;
  console.log('All bets cleared');
}

// Add the styles to the document
const styles = `
.wheel-container {
    position: relative;
    width: 400px;
    height: 400px;
    margin: 20px auto;
}

.wheel {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: #2c3e50;
    position: relative;
    overflow: hidden;
    border: 10px solid #34495e;
}

.wheel-inner {
    width: 100%;
    height: 100%;
    transition: transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
}

.wheel-numbers {
    position: absolute;
    width: 100%;
    height: 100%;
    transform-origin: center;
}

.wheel-numbers .number {
    position: absolute;
    width: 30px;
    height: 80px;
    left: 50%;
    transform-origin: bottom;
    text-align: center;
    padding-top: 10px;
    color: white;
    font-weight: bold;
}

.ball {
    width: 15px;
    height: 15px;
    background: white;
    border-radius: 50%;
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    transition: transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
}

.result {
    text-align: center;
    font-size: 24px;
    margin-top: 20px;
    font-weight: bold;
}

.result.red { color: #e74c3c; }
.result.black { color: #2c3e50; }
.result.green { color: #27ae60; }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

// Add color helper functions
function byte2Hex(n) {
  const nybHexString = '0123456789ABCDEF';
  return String(nybHexString.substr((n >> 4) & 0x0f, 1)) + nybHexString.substr(n & 0x0f, 1);
}

function RGB2Color(r, g, b) {
  return '#' + byte2Hex(r) + byte2Hex(g) + byte2Hex(b);
}

function getColor(item, maxitem) {
  const phase = 0;
  const center = 128;
  const width = 127;
  const frequency = (Math.PI * 2) / maxitem;

  const red = Math.sin(frequency * item + 2 + phase) * width + center;
  const green = Math.sin(frequency * item + 0 + phase) * width + center;
  const blue = Math.sin(frequency * item + 4 + phase) * width + center;

  return RGB2Color(red, green, blue);
}

function drawRouletteWheel() {
  const canvas = document.getElementById('canvas');
  if (canvas.getContext) {
    const outsideRadius = 200;
    const textRadius = 160;
    const insideRadius = 125;

    ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 500, 500);

    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.font = 'bold 12px Helvetica, Arial';

    for (let i = 0; i < numbers.length; i++) {
      const angle = startAngle + i * arc;
      ctx.fillStyle = isRed(numbers[i]) ? '#e74c3c' : numbers[i] === 0 ? '#27ae60' : '#2c3e50';

      ctx.beginPath();
      ctx.arc(250, 250, outsideRadius, angle, angle + arc, false);
      ctx.arc(250, 250, insideRadius, angle + arc, angle, true);
      ctx.stroke();
      ctx.fill();

      ctx.save();
      ctx.fillStyle = 'white';
      ctx.translate(250 + Math.cos(angle + arc / 2) * textRadius, 250 + Math.sin(angle + arc / 2) * textRadius);
      ctx.rotate(angle + arc / 2 + Math.PI / 2);
      const text = numbers[i].toString();
      ctx.fillText(text, -ctx.measureText(text).width / 2, 0);
      ctx.restore();
    }

    // Draw Arrow
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.moveTo(250 - 4, 250 - (outsideRadius + 5));
    ctx.lineTo(250 + 4, 250 - (outsideRadius + 5));
    ctx.lineTo(250 + 4, 250 - (outsideRadius - 5));
    ctx.lineTo(250 + 9, 250 - (outsideRadius - 5));
    ctx.lineTo(250 + 0, 250 - (outsideRadius - 13));
    ctx.lineTo(250 - 9, 250 - (outsideRadius - 5));
    ctx.lineTo(250 - 4, 250 - (outsideRadius - 5));
    ctx.lineTo(250 - 4, 250 - (outsideRadius + 5));
    ctx.fill();
  }
}

async function handleStartSpin() {
  try {
    console.log('Starting spin...');
    socket.on(currentBoardId, data => {});
    // const winningNumber = Math.floor(Math.random() * 37); // 0-36
    rouletteWheel.spin(winningNumber);
  } catch (error) {
    console.error('Spin error:', error);
  }
}

class RouletteWheel {
  constructor() {
    // Match backend number configuration
    this.numbers = {
      red: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
      black: [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35],
      zero: [0],
    };

    // Standard European Roulette wheel sequence
    this.wheelNumbers = [
      0, // Green
      32,
      15,
      19,
      4,
      21,
      2,
      25,
      17,
      34,
      6,
      27,
      13,
      36,
      11,
      30,
      8,
      23,
      10,
      5,
      24,
      16,
      33,
      1,
      20,
      14,
      31,
      9,
      22,
      18,
      29,
      7,
      28,
      12,
      35,
      3,
      26,
    ];

    this.canvas = document.createElement('canvas');
    this.canvas.width = 500;
    this.canvas.height = 500;
    this.ctx = this.canvas.getContext('2d');
    this.centerX = this.canvas.width / 2;
    this.centerY = this.canvas.height / 2;
    this.radius = 180;
    this.rotation = 0;
    this.isSpinning = false;
    this.currentAngle = 0;
    this.ballAngle = 0;
    this.ballRadius = this.radius - 15;
    this.animationId = null;
    this.lastWinningNumber = null;

    // Calculate segment angle
    this.segmentAngle = (Math.PI * 2) / this.wheelNumbers.length;

    // Create number positions mapping with corrected angles
    this.numberPositions = {};
    this.wheelNumbers.forEach((number, index) => {
      // Calculate angle where the ball should stop for this number
      // Subtract from 2π because we're going clockwise
      // Add π/2 to align with top of wheel (start at 0)
      const angle = Math.PI * 2 - index * this.segmentAngle + Math.PI / 2;

      this.numberPositions[number] = {
        index: index,
        angle: angle,
        // Normalize angle to be between 0 and 2π
        finalAngle: angle % (Math.PI * 2),
      };
    });

    console.log('Number positions mapping:', this.numberPositions);

    this.numberAngles = {}; // Will store angles while drawing wheel
  }

  init() {
    const wheelContainer = document.querySelector('.wheel-container');
    if (!wheelContainer) {
      console.error('Wheel container not found');
      return;
    }

    // Clear existing content
    wheelContainer.innerHTML = '';

    // Append canvas and winner display
    wheelContainer.appendChild(this.canvas);

    // Initial draw
    this.draw();

    console.log('Roulette wheel initialized');
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw fixed wheel
    this.drawWheel();

    // Draw spinning ball
    if (this.isSpinning || this.lastWinningNumber !== null) {
      const ballX = this.centerX + Math.cos(this.ballAngle) * this.ballRadius;
      const ballY = this.centerY + Math.sin(this.ballAngle) * this.ballRadius;
      this.drawBall(ballX, ballY);
    }
  }

  drawWheel() {
    // Draw wheel segments
    const segmentAngle = (Math.PI * 2) / this.wheelNumbers.length;

    for (let i = 0; i < this.wheelNumbers.length; i++) {
      const startAngle = i * segmentAngle + this.rotation;
      const endAngle = startAngle + segmentAngle;
      const centerAngle = startAngle + segmentAngle / 2;

      // Store the center angle for each number as we draw it
      const number = this.wheelNumbers[i];
      this.numberAngles[number] = {
        start: startAngle,
        center: centerAngle,
        end: endAngle,
      };

      // Draw segment
      this.ctx.beginPath();
      this.ctx.moveTo(this.centerX, this.centerY);
      this.ctx.arc(this.centerX, this.centerY, this.radius, startAngle, endAngle);
      this.ctx.closePath();

      // Set segment color based on number
      this.ctx.fillStyle = this.getNumberColor(number) === 'green' ? '#27ae60' : this.getNumberColor(number) === 'red' ? '#e74c3c' : '#2c3e50';

      this.ctx.fill();
      this.ctx.stroke();

      // Draw number with correct orientation
      this.ctx.save();
      this.ctx.translate(this.centerX, this.centerY);
      this.ctx.rotate(centerAngle);
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 16px Arial';

      const textRadius = this.radius - 35;
      this.ctx.translate(textRadius, 0);
      this.ctx.rotate(Math.PI / 2);
      this.ctx.fillText(number.toString(), 0, 0);
      this.ctx.restore();
    }
  }

  showWinner(number) {
    // Get winner display elements from DOM instead of class properties
    const winnerNumber = document.querySelector('.winner-number');
    const winnerDisplay = document.querySelector('.winner-display');

    if (winnerNumber && winnerDisplay) {
      // Update winner number
      winnerNumber.textContent = number;
      winnerNumber.className = `winner-number ${this.getNumberColor(number)}`;

      // Show winner display
      winnerDisplay.classList.add('show');

      // Add animation class
      setTimeout(() => {
        winnerDisplay.classList.add('animate');
      }, 100);
    }

    showResultPopup({
      number: number,
      color: this.getNumberColor(number),
      winners: [],
    });

    console.log('Showing winner:', number);
  }

  getNumberColor(number) {
    if (number === 0) return 'green';
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return redNumbers.includes(number) ? 'red' : 'black';
  }

  spin(winningNumber) {
    if (this.isSpinning) return;

    this.isSpinning = true;
    this.lastWinningNumber = winningNumber;

    // Get the winning number's angle data
    const winAngle = this.numberAngles[winningNumber];
    if (!winAngle) {
      console.error('Invalid winning number:', winningNumber);
      return;
    }

    // Constants for animation
    const SPIN_DURATION = 8000; // 8 seconds
    const ROTATIONS = 8; // Number of full rotations

    // Start from current position or top
    let startAngle = this.ballAngle || 0;

    // Calculate final target angle using the actual drawn angle
    // Add extra rotations and the winning angle
    const targetAngle = Math.PI * 2 * ROTATIONS + winAngle.center;
    const totalDistance = targetAngle - startAngle;

    let startTime = null;

    // Custom easing function for more realistic ball movement
    const easeOutQuart = t => 1 - Math.pow(1 - t, 4);

    const animate = timestamp => {
      if (!startTime) startTime = timestamp;

      const progress = Math.min((timestamp - startTime) / SPIN_DURATION, 1);

      if (progress < 1) {
        // Calculate current position based on progress
        const easedProgress = easeOutQuart(progress);
        this.ballAngle = startAngle + totalDistance * easedProgress;

        this.draw();
        this.animationId = requestAnimationFrame(animate);
      } else {
        // Animation complete
        this.ballAngle = winAngle.center;
        this.isSpinning = false;
        this.draw();
        this.showWinner(winningNumber);
      }
    };

    this.animationId = requestAnimationFrame(animate);
  }

  // Helper function to find current number based on angle
  getCurrentNumber(angle) {
    // Normalize angle between 0 and 2π
    const normalizedAngle = angle < 0 ? angle + Math.PI * 2 : angle;

    // Find the number whose angle range contains the current angle
    return Object.entries(this.numberAngles).find(([number, angles]) => {
      return normalizedAngle >= angles.start && normalizedAngle <= angles.end;
    })?.[0];
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.isSpinning = false;
    }
  }

  drawBall(x, y) {
    this.ctx.save();

    // Make ball slightly larger
    const ballSize = 10;

    // Add shadow
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    this.ctx.shadowBlur = 5;
    this.ctx.shadowOffsetX = 2;
    this.ctx.shadowOffsetY = 2;

    // Draw main ball
    this.ctx.beginPath();
    this.ctx.arc(x, y, ballSize, 0, Math.PI * 2);
    this.ctx.fillStyle = 'white';
    this.ctx.fill();

    // Add highlight
    const gradient = this.ctx.createRadialGradient(x - 3, y - 3, 1, x, y, ballSize);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    this.ctx.fillStyle = gradient;
    this.ctx.fill();

    this.ctx.restore();
  }
}

// Update showResultPopup function
function showResultPopup(result) {
  console.log('Showing result popup:', result);
  console.log('Current bets:', currentBets); // Log current bets for debugging

  // Remove existing popup if any
  const existingPopup = document.getElementById('result-popup');
  if (existingPopup) {
    existingPopup.remove();
  }

  const { number, color } = result;
  console.log('Winning number:', number, 'Color:', color);

  // Check if user has won based on their bets
  let userWin = false;
  let winAmount = 0;

  // Get all elements with bets and strictly check winning conditions
  const bettedElements = document.querySelectorAll('[data-bet-amount]');
  bettedElements.forEach(element => {
    const betNumber = parseInt(element.getAttribute('data-number'));
    console.log('Checking bet on number:', betNumber);

    // Strict equality check for numbers
    if (betNumber === number) {
      const betAmount = parseInt(element.getAttribute('data-bet-amount'));
      console.log('Winning bet found! Amount:', betAmount);
      userWin = true;
      winAmount += betAmount * 35; // 35:1 payout for direct number
    }
  });

  // Check outside bets only if number is not 0
  if (number !== 0) {
    // Color bets
    const redButton = document.querySelector('[data-type="RED"]');
    const blackButton = document.querySelector('[data-type="BLACK"]');

    if (color.toUpperCase() === 'RED' && redButton && redButton.classList.contains('selected-bet')) {
      userWin = true;
      winAmount += selectedChip * 2;
    }
    if (color.toUpperCase() === 'BLACK' && blackButton && blackButton.classList.contains('selected-bet')) {
      userWin = true;
      winAmount += selectedChip * 2;
    }

    // Even/Odd bets
    const evenButton = document.querySelector('[data-type="EVEN"]');
    const oddButton = document.querySelector('[data-type="ODD"]');

    if (number % 2 === 0 && evenButton && evenButton.classList.contains('selected-bet')) {
      userWin = true;
      winAmount += selectedChip * 2;
    }
    if (number % 2 === 1 && oddButton && oddButton.classList.contains('selected-bet')) {
      userWin = true;
      winAmount += selectedChip * 2;
    }

    // Range bets
    const lowButton = document.querySelector('[data-type="LOW"]');
    const highButton = document.querySelector('[data-type="HIGH"]');

    if (number >= 1 && number <= 18 && lowButton && lowButton.classList.contains('selected-bet')) {
      userWin = true;
      winAmount += selectedChip * 2;
    }
    if (number >= 19 && number <= 36 && highButton && highButton.classList.contains('selected-bet')) {
      userWin = true;
      winAmount += selectedChip * 2;
    }
  }

  console.log('Win status:', userWin, 'Win amount:', winAmount);

  // Create popup element
  const popup = document.createElement('div');
  popup.id = 'result-popup';
  popup.className = `result-popup ${userWin ? 'win' : 'loss'}`;

  // Set popup content
  popup.innerHTML = `
        <div class="popup-content animate">
            <h2 class="animate-text">${userWin ? '🎉 You Won! 🎉' : '😔 You Lost!'}</h2>
            <div class="result-number ${color.toLowerCase()} animate-spin">${number}</div>
            ${userWin ? `<div class="win-amount animate-bounce">+${winAmount} chips</div>` : '<div class="loss-message animate-fade">Better luck next time!</div>'}
            <div class="result-color animate-text">${color.toUpperCase()}</div>
            <button class="close-popup animate-button">OK</button>
        </div>
    `;

  // Add popup to document
  document.body.appendChild(popup);

  // Force reflow to trigger animations
  popup.offsetHeight;

  // Add show class to trigger animations
  popup.classList.add('show');

  // Add close button functionality
  popup.querySelector('.close-popup').addEventListener('click', () => {
    popup.classList.add('fade-out');
    setTimeout(() => popup.remove(), 500);
  });

  // Auto close after 5 seconds
  setTimeout(() => {
    if (popup && document.body.contains(popup)) {
      popup.classList.add('fade-out');
      setTimeout(() => popup.remove(), 500);
    }
  }, 5000);

  // Update balance if won
  if (userWin && winAmount > 0) {
    balance += winAmount;
    document.getElementById('user-balance').textContent = balance;
  }
}

// Add this function to track selected outside bets
function placeBet(betType, betDetails) {
  if (!selectedChip) {
    alert('Please select a chip first');
    return;
  }

  if (selectedChip > balance) {
    alert('Insufficient balance');
    return;
  }

  const bet = {
    betType,
    betDetails,
    amount: selectedChip,
  };

  // Mark the bet button as selected
  if (betType !== 'STRAIGHT') {
    const betButton = document.querySelector(`[data-type="${betType}"]`);
    if (betButton) {
      betButton.classList.add('selected-bet');
    }
  }

  sendBet(bet);
}

// Update clear bets function
function clearBets() {
  console.log('Clearing all bets');

  // Clear number bets
  document.querySelectorAll('.number, .zero').forEach(element => {
    element.removeAttribute('data-bet-amount');
    const betDisplay = element.querySelector('.bet-amount');
    if (betDisplay) {
      betDisplay.remove();
    }
    element.classList.remove('has-bet');
  });

  // Clear outside bets
  document.querySelectorAll('.bet-btn').forEach(button => {
    button.classList.remove('selected-bet');
  });

  // Reset totals
  totalBet = 0;
  document.getElementById('total-bet').textContent = '0';
  document.getElementById('spin').disabled = true;

  console.log('All bets cleared');
}
