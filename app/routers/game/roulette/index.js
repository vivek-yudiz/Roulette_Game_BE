const router = require('express').Router();
const controller = require('./lib/controllers');
const middleware = require('./lib/middlewares');

router.post('/join', 
  middleware.isAuthenticated,
  middleware.joiningProcess,
  controller.joinTable
);

module.exports = router;
