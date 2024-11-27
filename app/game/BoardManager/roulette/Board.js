const { redis } = require("../../../utils");

class RouletteBoard {
  constructor(config) {
    this._id = config._id;
    this.maxPlayers = config.maxPlayers;
    this.minBet = config.minBet;
    this.maxBet = config.maxBet;
    this.timePerRound = config.timePerRound;
    this.participants = config.participants || [];
    this.currentRound = config.currentRound || 0;
    this.status = config.status || 'waiting';
    this.lastNumber = config.lastNumber || null;
    this.createdAt = config.createdAt;
    this.roundStartTime = config.roundStartTime;
    this.tableNumber = config.tableNumber;
    this.history = config.history || [];
    this.totalBets = config.totalBets || 0;
    this.protoId = config.protoId;
    this.bets = config.bets || {};

    this.betTypes = {
      STRAIGHT: { type: 'straight', payout: 35 },
      SPLIT: { type: 'split', payout: 17 },
      STREET: { type: 'street', payout: 11 },
      CORNER: { type: 'corner', payout: 8 },
      LINE: { type: 'line', payout: 5 },
      RED: { type: 'red', payout: 1 },
      BLACK: { type: 'black', payout: 1 },
      EVEN: { type: 'even', payout: 1 },
      ODD: { type: 'odd', payout: 1 },
      LOW: { type: 'low', payout: 1 },
      HIGH: { type: 'high', payout: 1 },
      DOZEN_FIRST: { type: 'dozen', payout: 2 },
      DOZEN_SECOND: { type: 'dozen', payout: 2 },
      DOZEN_THIRD: { type: 'dozen', payout: 2 },
      COLUMN_FIRST: { type: 'column', payout: 2 },
      COLUMN_SECOND: { type: 'column', payout: 2 },
      COLUMN_THIRD: { type: 'column', payout: 2 }
    };
    this.numbers = {
      red: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
      black: [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35],
      zero: [0]
    };
  }

  async addBet(userId, betType, betDetails, amount) {
    if (amount < this.minBet || amount > this.maxBet) {
      throw new Error(`Bet amount must be between ${this.minBet} and ${this.maxBet}`);
    }

    const participant = this.participants.find(p => p.iUserId === userId);
    if (!participant) {
      throw new Error('Player not found in this board');
    }

    if (participant.nChips < amount) {
      throw new Error('Insufficient chips');
    }

    this.validateBet(betType, betDetails);

    if (!this.bets[userId]) {
      this.bets[userId] = [];
    }

    const bet = {
      betType,
      betDetails,
      amount,
      timestamp: Date.now(),
      payout: this.betTypes[betType].payout
    };

    this.bets[userId].push(bet);

    participant.nChips -= amount;
    participant.totalBets += amount;
    this.totalBets += amount;

    console.log(`Bet placed: ${JSON.stringify(bet)}`);
    console.log(`Current bets: ${JSON.stringify(this.bets)}`);

    await redis.client.json.set(`roulette:${this._id}:boards`, '$.bets', this.bets);

    return bet;
  }

  validateBet(betType, betDetails) {
    if (!this.betTypes[betType]) {
      throw new Error('Invalid bet type');
    }

    switch(betType) {
      case 'STRAIGHT':
        if (!Number.isInteger(betDetails.number) || betDetails.number < 0 || betDetails.number > 36) {
          throw new Error('Invalid number for straight bet');
        }
        break;

      case 'SPLIT':
        if (!Array.isArray(betDetails.numbers) || betDetails.numbers.length !== 2) {
          throw new Error('Split bet must have exactly 2 numbers');
        }
        break;

      case 'STREET':
        if (!Array.isArray(betDetails.numbers) || betDetails.numbers.length !== 3) {
          throw new Error('Street bet must have exactly 3 numbers');
        }
        break;

      case 'CORNER':
        if (!Array.isArray(betDetails.numbers) || betDetails.numbers.length !== 4) {
          throw new Error('Corner bet must have exactly 4 numbers');
        }
        break;

      case 'LINE':
        if (!Array.isArray(betDetails.numbers) || betDetails.numbers.length !== 6) {
          throw new Error('Line bet must have exactly 6 numbers');
        }
        break;
    }
  }

  calculateWinnings(winningNumber) {
    console.log("🚀 Calculating winnings for number:", winningNumber);
    console.log("🚀 Current bets structure:", JSON.stringify(this.bets, null, 2));
    const results = {};

    for (const [userId, userBets] of Object.entries(this.bets)) {
        console.log(`🚀 Checking bets for user ${userId}:`, JSON.stringify(userBets, null, 2));
        let totalWin = 0;
    
        userBets.forEach(bet => {
            console.log(`🚀 Checking individual bet:`, JSON.stringify(bet, null, 2));
            console.log(`🚀 Bet number:`, bet.betDetails.number);
            console.log(`🚀 Winning number:`, winningNumber);
            console.log(`🚀 Are they equal?:`, bet.betDetails.number === winningNumber);
            
            if (this.isBetWinner(bet, winningNumber)) {
                const winAmount = bet.amount * (bet.payout + 1);
                console.log(`🚀 Winner! Amount: ${winAmount}`);
                totalWin += winAmount;
            }
        });

        if (totalWin > 0) {
            results[userId] = totalWin;
        }
    }

    console.log("🚀 Final results:", JSON.stringify(results, null, 2));
    return results;
  }

  isBetWinner(bet, winningNumber) {
    console.log(`🚀 isBetWinner - Checking bet type: ${bet.betType}`);
    console.log(`🚀 isBetWinner - Bet details:`, JSON.stringify(bet.betDetails));
    console.log(`🚀 isBetWinner - Winning number:`, winningNumber);

    switch(bet.betType) {
        case 'STRAIGHT':
            const isWinner = parseInt(bet.betDetails.number) === parseInt(winningNumber);
            console.log(`🚀 STRAIGHT bet comparison: ${bet.betDetails.number} === ${winningNumber} = ${isWinner}`);
            return isWinner;
        
        case 'RED':
            return this.numbers.red.includes(winningNumber);
        
        case 'BLACK':
            return this.numbers.black.includes(winningNumber);
        
        case 'EVEN':
            return winningNumber !== 0 && winningNumber % 2 === 0;
        
        case 'ODD':
            return winningNumber % 2 === 1;
        
        case 'LOW':
            return winningNumber >= 1 && winningNumber <= 18;
        
        case 'HIGH':
            return winningNumber >= 19 && winningNumber <= 36;
        
        case 'DOZEN_FIRST':
            return winningNumber >= 1 && winningNumber <= 12;
        
        case 'DOZEN_SECOND':
            return winningNumber >= 13 && winningNumber <= 24;
        
        case 'DOZEN_THIRD':
            return winningNumber >= 25 && winningNumber <= 36;
        
        default:
            return false;
    }
  }

  getGameState() {
    return {
      boardId: this._id,
      tableNumber: this.tableNumber,
      status: this.status,
      currentRound: this.currentRound,
      timeLeft: this.getRoundTimeLeft(),
      totalBets: this.totalBets,
      lastNumber: this.lastNumber,
      playerCount: this.participants.length,
      maxPlayers: this.maxPlayers,
      history: this.history.slice(-10),
      betTypes: this.betTypes,
      minBet: this.minBet,
      maxBet: this.maxBet,
      participants: this.participants.map(p => ({
        iUserId: p.iUserId,
        sUserName: p.sUserName,
        nChips: p.nChips,
        sAvatar: p.sAvatar,
        nPosition: p.nPosition,
        totalBets: p.totalBets,
        isActive: p.isActive
      }))
    };
  }

  getRoundTimeLeft() {
    const now = Date.now();
    const timeLeft = this.roundStartTime + (this.timePerRound * 1000) - now;
    return Math.max(0, Math.floor(timeLeft / 1000));
  }

  getParticipant(userId) {
    return this.participants.find(p => p.iUserId === userId);
  }

  serialize() {
    return {
      _id: this._id,
      maxPlayers: this.maxPlayers,
      minBet: this.minBet,
      maxBet: this.maxBet,
      timePerRound: this.timePerRound,
      participants: this.participants,
      currentRound: this.currentRound,
      status: this.status,
      bets: this.bets,
      lastNumber: this.lastNumber,
      createdAt: this.createdAt,
      roundStartTime: this.roundStartTime,
      tableNumber: this.tableNumber,
      history: this.history,
      totalBets: this.totalBets,
      protoId: this.protoId
    };
  }
}

module.exports = RouletteBoard; 
