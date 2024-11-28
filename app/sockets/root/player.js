const boardManager = require('../../game/BoardManager');
const { redis } = require('../../utils');
const PlayerListener = require('./listener');
const _ = require('../../../globals/lib/helper');

class Player {
  constructor(socket) {
    this.socket = socket;
    this.iUserId = socket.user.iUserId;
    this.setEventListeners();
  }

  setEventListeners() {
    this.socket.on('ping', this.ping.bind(this));
    this.socket.on('disconnect', this.disconnect.bind(this));
    this.socket.on('reqJoinBoard', this.joinBoard.bind(this));
    this.socket.on('error', error => log.red('socket error', error));
  }

  ping(body, callback) {
    callback(null, {});
  }

  async joinBoard({ iBoardId }, callback) {
    try {
      const board = await boardManager.getBoard(iBoardId);
      if (!board) {
        return callback({ message: 'Board not found' });
      }

      this.socket.join(iBoardId);

      const existingPlayer = board.participants.find(p => p.iUserId === this.iUserId);
      if (!existingPlayer) {
        return callback({ message: 'Player not found in this board' });
      }


      if (!this.socket.eventNames().includes(iBoardId)) {
        const playerListener = new PlayerListener(iBoardId, this.iUserId);
        this.socket.on(iBoardId, playerListener.onEvent.bind(playerListener));
      }

      this.socket.to(iBoardId).emit('playerReconnected', {
        userId: this.iUserId,
        socketId: this.socket.id
      });

      callback({ 
        board: board.getGameState(),
        user: existingPlayer
      });
    } catch (error) {
      console.error('Join board error:', error);
      callback({ error: error.message || 'Failed to join board' });
    }
  }

  logError(error, callback = () => {}) {
    console.error('Socket error:', error);
    if (typeof callback === 'function') {
      callback({ error: error.message || 'Internal server error' });
    }
  }

  async disconnect() {
    try {

      // const boards = await boardManager.findBoardsByPlayer(this.iUserId);
      
      // for (const board of boards) {
      //   // Update player status in board
      //   const player = board.participants.find(p => p.iUserId === this.iUserId);
      //   if (player) {
      //     player.isActive = false;
      //     player.disconnectedAt = Date.now();
      //     await boardManager.updateBoard(board._id, board);

      //     // Notify other players
      //     this.socket.to(board._id).emit('playerDisconnected', {
      //       userId: this.iUserId,
      //       timestamp: Date.now()
      //     });
      //   }
      // }
      console.log("::::::::::::::::::disconnect::::::::::::::::::");
      
    } catch (error) {
      console.error('Disconnect error:', error);
    }
    console.log('Root disconnected', this.iUserId, 'with', this.socket.id);
  }
}

module.exports = Player;
