const { redis } = require('../../utils');
const boardManager = require('../../game/BoardManager');
const RouletteBoard = require('../../game/BoardManager/roulette/Board');
const { User } = require('../../models/index');

class PlayerListener {
  constructor(boardId, userId) {
    this.boardId = boardId;
    this.userId = userId;
    this.spinTimeout = null;
  }

  async onEvent(data, callback = () => {}) {
    try {
      switch (data.event) {
        case 'placeBet':
          await this.handlePlaceBet(data.data, callback);
          break;
        case 'startSpin':
          await this.handleStartSpin(callback);
          break;
        default:
          if (typeof callback === 'function') {
            callback({ error: 'Invalid event' });
          }
      }
    } catch (error) {
      console.error('Event handling error:', error);
      if (typeof callback === 'function') {
        callback({ error: error.message });
      }
    }
  }

  async handlePlaceBet(data, callback = () => {}) {
    try {
      const board = await boardManager.getBoard(this.boardId);

      if (!board) {
        if (typeof callback === 'function') {
          return callback({ error: 'Board not found' });
        }
        return;
      }

      // Handle multiple bets
      const results = [];
      let totalAmount = 0;

      // Calculate total amount first
      totalAmount = data.bets.reduce((sum, bet) => sum + bet.amount, 0);

      // Check if user has enough chips for all bets
      const participant = board.participants.find(p => p.iUserId === this.userId);
      if (!participant || participant.nChips < totalAmount) {
        throw new Error('Insufficient chips for all bets');
      }

      // Place all bets
      for (const betData of data.bets) {
        const bet = await board.addBet(
          this.userId, 
          betData.betType, 
          betData.betDetails, 
          betData.amount
        );
        results.push(bet);

        // Emit individual bet placed events
        global.io.to(this.boardId).emit('betPlaced', {
          userId: this.userId,
          betType: betData.betType,
          betDetails: betData.betDetails,
          amount: betData.amount,
          timestamp: Date.now()
        });
      }
      
      // Update board in Redis after adding all bets
      const serializedBoard = board.serialize();
      await redis.client.json.set(`roulette:${this.boardId}:boards`, '$', serializedBoard);

      if (typeof callback === 'function') {
        callback({ 
          success: true,
          bets: results,
          totalAmount: totalAmount,
          boardState: board.getGameState()
        });
      }

      console.log("Current bets after placing:", board.bets);

    } catch (error) {
      console.error('Place bet error:', error);
      if (typeof callback === 'function') {
        callback({ error: error.message });
      }
    }
  }

  async handleStartSpin(callback = () => {}) {
    try {
      const board = await boardManager.getBoard(this.boardId);
      if (!board) {
        if (typeof callback === 'function') {
          return callback({ error: 'Board not found' });
        }
        return;
      }

      console.log("🚀 Board data before spin:", JSON.stringify(board, null, 2));

      global.io.to(this.boardId).emit('bettingClosed', {
        totalBets: board.totalBets
      });

      setTimeout(async () => {
        const freshBoard = await boardManager.getBoard(this.boardId);
        const winningNumber = 8; 
        console.log("🚀 Winning number set to:", winningNumber);
        console.log("🚀 Current board bets:", JSON.stringify(freshBoard.bets, null, 2));

        const winningColor = this.getNumberColor(winningNumber);
        const winners = freshBoard.calculateWinnings(winningNumber);

        console.log("🚀 ~ file: listener.js:96 ~ PlayerListener ~ setTimeout ~ winners:", winners);

        // Update winners' balances both in board and database
        const balanceUpdates = [];
        Object.entries(winners).forEach(([userId, winAmount]) => {
          const participant = freshBoard.participants.find(p => p.iUserId === userId);
          if (participant) {
            participant.nChips += winAmount;
            // Add to balance updates array
            balanceUpdates.push({
              updateOne: {
                filter: { _id: userId },
                update: { $inc: { nChips: winAmount } }
              }
            });
          }
        });

        // Update losers' balances in database (those who didn't win)
        const losers = freshBoard.participants.filter(p => !winners[p.iUserId]);
        losers.forEach(loser => {
          const userBets = freshBoard.bets[loser.iUserId] || [];
          const totalLoss = userBets.reduce((sum, bet) => sum + bet.amount, 0);
          if (totalLoss > 0) {
            balanceUpdates.push({
              updateOne: {
                filter: { _id: loser.iUserId },
                update: { $inc: { nChips: -totalLoss } }
              }
            });
          }
        });


        if (balanceUpdates.length > 0) {
          await User.bulkWrite(balanceUpdates);
        }

        const serializedBoard = freshBoard.serialize();
        await redis.client.json.set(`roulette:${this.boardId}:boards`, '$', serializedBoard);

        global.io.to(this.boardId).emit('spinResult', {
          number: winningNumber,
          color: winningColor,
          winners: Object.entries(winners).map(([userId, amount]) => ({
            userId,
            winAmount: amount,
            newBalance: freshBoard.participants.find(p => p.iUserId === userId)?.nChips || 0
          })),
          nextRoundIn: 10
        });

        freshBoard.bets = {};
        freshBoard.totalBets = 0;
        freshBoard.currentRound++;
        freshBoard.status = 'waiting';
        freshBoard.roundStartTime = Date.now() + 10000;

        const resetBoardData = freshBoard.serialize();
        await redis.client.json.set(`roulette:${this.boardId}:boards`, '$', resetBoardData);

        this.spinTimeout = null;

        if (typeof callback === 'function') {
          callback({ success: true });
        }
      }, 10000);

    } catch (error) {
      console.error('Spin error:', error);
      if (typeof callback === 'function') {
        callback({ error: error.message });
      }
    }
  }

  getNumberColor(number) {
    if (number === 0) return 'green';
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return redNumbers.includes(number) ? 'red' : 'black';
  }
}

module.exports = PlayerListener;
