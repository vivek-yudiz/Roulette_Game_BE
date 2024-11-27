const mongoose = require('mongoose');

const BoardProtoTypeSchema = new mongoose.Schema({
  sName: { type: String, default: 'Roulette Table' },
  nMaxPlayers: { type: Number, default: 8 },
  nMinBet: { type: Number, default: 10 },
  nMaxBet: { type: Number, default: 1000 },
  nTimePerRound: { type: Number, default: 30 },
  eGameType: { type: String, default: 'roulette' },
  nMinChips: { type: Number, default: 100 }, // Minimum chips required to join
  eStatus: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('BoardProtoType', BoardProtoTypeSchema); 