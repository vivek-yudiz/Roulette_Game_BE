const { mongodb, redis } = require('../../utils');
const RouletteBoard = require('./roulette/Board');

class BoardManager {
  constructor() {
  }

  async createRouletteBoard(protoData) {
    const boardId = mongodb.mongify().toString();
    
    const boardConfig = {
      _id: boardId,
      maxPlayers: protoData.nMaxPlayers || 8,
      minBet: protoData.nMinBet || 10,
      maxBet: protoData.nMaxBet || 1000,
      timePerRound: protoData.nTimePerRound || 30,
      participants: [],
      createdAt: Date.now(),
      roundStartTime: Date.now() + 5000,
      tableNumber: Math.floor(Math.random() * 1000) + 1,
      protoId: protoData._id,
      currentRound: 0,
      status: 'waiting',
      lastNumber: null,
      history: [],
      totalBets: 0
    };

    const board = new RouletteBoard(boardConfig);
    
    await redis.client.json.set(`roulette:${boardId}:boards`, '$', board.serialize());
    
    return board;
  }

  async getBoard(boardId) {
    try {
      const boardData = await redis.client.json.get(`roulette:${boardId}:boards`);
      if (!boardData) {
        console.log('Board not found');
        return null;
      }

      console.log("Retrieved board data:", JSON.stringify(boardData, null, 2));

      const board = new RouletteBoard(boardData);
      
      console.log("Bets after board creation:", JSON.stringify(board.bets, null, 2));
      
      return board;
    } catch (error) {
      console.error('Error getting board:', error);
      return null;
    }
  }

  async addParticipant(boardId, userData) {
    const board = await this.getBoard(boardId);
    
    if (!board) {
      throw new Error('Board not found');
    }

    if (board.participants.find(p => p.iUserId === userData.iUserId)) {
      throw new Error('Player already in board');
    }

    const participant = {
      ...userData,
      joinedAt: Date.now(),
      totalBets: 0,
      currentBets: [],
      isActive: true
    };

    board.participants.push(participant);
    await redis.client.json.set(`roulette:${boardId}:boards`, '$.participants', board.participants);
    
    return board;
  }

  async updateBoard(boardId, board) {
    try {
      const serializedBoard = board.serialize();
      console.log("Saving board data:", JSON.stringify(serializedBoard, null, 2));
      await redis.client.json.set(`roulette:${boardId}:boards`, '$', serializedBoard);
      return board;
    } catch (error) {
      console.error('Error updating board:', error);
      throw error;
    }
  }
}

module.exports = new BoardManager();
