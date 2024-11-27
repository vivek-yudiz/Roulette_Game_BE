const boardManager = require('../../../../game/BoardManager');

const controller = {};

controller.joinTable = async (req, res) => {
  try {
    const userData = {
      iUserId: req.user._id,
      sUserName: req.user.sUserName,
      nChips: req.user.nChips,
      sAvatar: req.user.sCurrentAvatar,
      eStatus: req.user.eStatus,
      nPosition: req.user.nPosition
    };

    const board = await boardManager.addParticipant(req.board._id, userData);
    console.log("🚀 ~ file: controllers.js:18 ~ controller.joinTable= ~ board:", board)

    return res.reply(messages.success(), {
      board: req.board.getGameState(),
      user: userData
    });

  } catch (error) {
    console.log('Join table error:', error);
    return res.reply(messages.server_error());
  }
};

module.exports = controller;
