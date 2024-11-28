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
          console.log("::::::::::::::::::here::::::::::::::::::");
          
          const result = await this.handleStartSpin(callback);
          console.log(":::::::::🚀 ~ file: listener.js:21 ~ PlayerListener ~ onEvent ~ result:", result)
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

  async handlePlaceBet(data, callback) {
    try {
      const board = await boardManager.getBoard(this.boardId);
      if (!board) {
        return callback({ error: 'Board not found' });
      }

      // Add bet logic here...

      // Update user info in response
      const participant = board.participants.find(p => p.iUserId === this.userId);
      
      callback({
        success: true,
        board: board.getGameState(),
        user: {
          sUserName: participant.sUserName,
          nChips: participant.nChips
        }
      });

    } catch (error) {
      console.error('Place bet error:', error);
      callback({ error: error.message });
    }
  }

  async handleStartSpin(callback = () => {}) {
    try {
      const board = await boardManager.getBoard(this.boardId);
      if (!board) {
        return callback({ error: 'Board not found' });
      }

      console.log("🚀 Board data before spin:", JSON.stringify(board, null, 2));

      // Emit betting closed event
      global.io.to(this.boardId).emit('bettingClosed', {
        totalBets: board.totalBets
      });

      // Generate winning number
      const winningNumber = Math.floor(Math.random() * 37); // 0-36
      const winningColor = this.getNumberColor(winningNumber);
      
      console.log("🚀 Winning number:", winningNumber, "Color:", winningColor);

      // Calculate winners
      const winners = board.calculateWinnings(winningNumber);
      console.log("🚀 Winners:", winners);

      // Update balances
      const balanceUpdates = [];
      
      // Process winners
      Object.entries(winners).forEach(([userId, winAmount]) => {
        const participant = board.participants.find(p => p.iUserId === userId);
        if (participant) {
          participant.nChips += winAmount;
          balanceUpdates.push({
            updateOne: {
              filter: { _id: userId },
              update: { $inc: { nChips: winAmount } }
            }
          });
        }
      });

      // Process losers
      const losers = board.participants.filter(p => !winners[p.iUserId]);
      losers.forEach(loser => {
        const userBets = board.bets[loser.iUserId] || [];
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

      // Update database
      if (balanceUpdates.length > 0) {
        await User.bulkWrite(balanceUpdates);
      }

      // Emit spin result to all players
      global.io.to(this.boardId).emit('spinResult', {
        number: winningNumber,
        color: winningColor,
        winners: Object.entries(winners).map(([userId, amount]) => ({
          userId,
          winAmount: amount,
          newBalance: board.participants.find(p => p.iUserId === userId)?.nChips || 0
        })),
        nextRoundIn: 10
      });

      // Reset board for next round
      board.bets = {};
      board.totalBets = 0;
      board.currentRound++;
      board.status = 'waiting';
      board.roundStartTime = Date.now() + 10000;

      // Save updated board
      await boardManager.updateBoard(this.boardId, board);

      callback({ success: true });

    } catch (error) {
      console.error('Spin error:', error);
      callback({ error: error.message });
    }
  }

  getNumberColor(number) {
    if (number === 0) return 'green';
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return redNumbers.includes(number) ? 'red' : 'black';
  }
}

module.exports = PlayerListener;
