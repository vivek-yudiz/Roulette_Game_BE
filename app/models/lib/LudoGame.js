const mongoose = require('mongoose');

const LudoGame = new mongoose.Schema(
  {
    iProtoId: mongoose.Schema.Types.ObjectId,
    iGameId: mongoose.Schema.Types.ObjectId,
    iWinnerId: mongoose.Schema.Types.ObjectId,
    nBoardFee: { type: Number, default: 0 },
    nMaxPlayer: { type: Number, enum: [2, 3, 4] },
    aParticipant: [
      {
        _id: false,
        // nKills: Number,
        // nDeath: Number,
        // nRank: Number,
        // nScore: Number,
        // eState: String,
        // nSeat: Number,
        // iUserId: mongoose.Schema.Types.ObjectId, // id of user can be string or number
        // nTurnMissed: ,

        iUserId: mongoose.Schema.Types.ObjectId,
        nSeat: Number,
        aPawn: [Array],
        eUserType: String,
        sUserName: String,
        nChips: Number,
        nColor: Number,
        eState: String,
        nRank: Number,
        nWinningAmount: Number,
        nScore: Number,
        nKills: Number,
        nDeath: Number,
      },
    ],
    eState: String,
    bFreezed: {
      type: Boolean,
      default: false,
    },
    eBoardType: {
      type: String,
      enum: ['private', 'cash'],
      default: 'cash',
    },
    bIsTie: {
      type: Boolean,
      default: false,
    },
    eStatus: {
      type: String,
      enum: ['y', 'd'],
      default: 'y',
    },
    eGameType: {
      type: String,
      enum: ['classic', 'rush', 'oneToken', 'twoToken', 'threeToken', 'quick'],
      default: 'classic',
    },
    aWinningAmount: [Number],
    eOpponent: {
      type: String,
      enum: ['bot', 'user', 'any'],
      default: 'any',
    },
    nAmountIn: {
      type: Number,
      default: 0,
    },
    nAmountOut: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: { createdAt: 'dCreatedDate', updatedAt: 'dUpdatedDate' } }
);
LudoGame.index({ iProtoId: 1 });

module.exports = mongoose.model('ludo_game', LudoGame);
