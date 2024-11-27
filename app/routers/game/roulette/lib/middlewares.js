const { User, BoardProtoType } = require('../../../../models');
const { requestLimiter, redis, redlock } = require('../../../../utils');
const _ = require('../../../../../globals/lib/helper');
const BoardManager = require('../../../../game/BoardManager');

const middleware = {};

middleware.isAuthenticated = async (req, res, next) => {
  try {
    const token = req.header('authorization');
    if (!token) return res.reply(messages.unauthorized());

    const decodedToken = _.decodeToken(token);
    if (!decodedToken) return res.reply(messages.unauthorized());

    const project = {
      sUserName: true,
      eStatus: true,
      sToken: true,
      nChips: true,
      sCurrentAvatar: true,
      _id: true
    };

    const user = await User.findOne({ _id: decodedToken._id }, project).lean();

    if (!user) return res.reply(messages.not_found('User'));
    if (user.sToken !== token) return res.reply(messages.unauthorized());
    if (user.eStatus === 'd') return res.reply(messages.custom.user_deleted);
    if (user.eStatus === 'n') return res.reply(messages.custom.user_blocked);

    req.user = user;
    next();
  } catch (error) {
    res.reply(messages.server_error(), error.toString());
  }
};

middleware.apiLimiter = (req, res, next) => {
  const params = {
    path: req.path,
    remoteAddress: req.sRemoteAddress || '127.0.0.1',
    maxRequestTime: 1000,
  };
  requestLimiter.setLimit(params, error => {
    if (error) return res.reply(messages.too_many_request());
    next();
  });
};


middleware.joinPrivateBoard = async (req, res, next) => {
  try {
    const body = _.pick(req.body, ['sPrivateCode']);
    const board = await redis.client.zPopMin(_.toString(body.sPrivateCode));
    // if (req.user.aLudoBoard.length) return res.reply(messages.custom.can_not_join_board);

    if (!board?.value) return res.reply(messages.custom.invalid_code);
    await redis.client.zAdd(_.toString(body.sPrivateCode), { score: board.score, value: _.toString(board.value) });
    req.board = await boardManager.getBoard(board.value);

    const { nChips } = req.user;
    if (nChips < req.board.nBoardFee) return res.reply(messages.custom.insufficient_chips);
    next();
  } catch (error) {
    log.red(error.toString());
    return res.reply(messages.server_error(), error.toString());
  }
};

middleware.createPrivateBoard = async (req, res, next) => {
  // if (req.user.aLudoBoard.length) return res.reply(messages.custom.can_not_join_board);
  const { nChips } = req.user;
  if (nChips < req.oProtoData.nBoardFee) return res.reply(messages.custom.insufficient_chips);

  req.board = await boardManager.createBoard(req.oProtoData, {
    eOpponent: 'user',
  });

  await redis.client.zAdd(req.board.sPrivateCode, {
    score: 1,
    value: _.toString(req.board._id),
  });
  next();
};

middleware.joiningProcess = async (req, res, next) => {
  try {
    req.oProtoData = {
      _id: 'default_roulette',
      sName: 'Roulette Table',
      nMaxPlayers: 8,
      nMinBet: 10,
      nMaxBet: 1000,
      nTimePerRound: 30,
      nMinChips: 100
    };

    if (req.user.nChips < req.oProtoData.nMinChips) {
      return res.reply({ 
        status: false, 
        message: 'Insufficient chips to join the game'
      });
    }

    req.board = await BoardManager.createRouletteBoard(req.oProtoData);

    if (!req.board || typeof req.board !== 'object') {
      return res.reply(messages.custom.invalid_board);
    }
    next();
   
  } catch (error) {
    console.log(`${_.now()} Roulette joining process failed. reason:`, error);
    return res.reply(messages.server_error(), error);
  }
};

middleware.joinBot = async (req, res, next) => {
  const body = _.pick(req.body, ['iUserId', 'iBoardId']);

  const board = await boardManager.getBoard(body.iBoardId);
  if (!board) return res.reply(messages.not_found('board'));
  if (board.eState !== 'waiting') return res.reply(messages.custom.board_started);

  const isAlreadyJoined = board.getParticipant(body.iUserId);
  if (isAlreadyJoined) return res.reply(messages.not_found('user'));
  const nParticipant = await redis.client.zScore(_.getProtoKey(board.iProtoId), _.toString(board._id));

  if (nParticipant >= board.nMaxPlayer) return res.reply(messages.success());

  const nTurn = await redis.client.zIncrBy(_.getProtoKey(board.iProtoId), 1, _.toString(board._id));

  const user = await User.findById(body.iUserId).lean();
  if (!user) return res.reply(messages.not_found('user'));

  req.board = board;
  req.user = { ...user, nTurn };
  next();
};

module.exports = middleware;
