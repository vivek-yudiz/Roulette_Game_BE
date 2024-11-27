const router = require('express').Router();

const authRoute = require('./auth');
const rouletteRoute = require('./roulette');

// const purchaseRoute = require('./purchases');

router.use('/auth', authRoute);
router.use('/roulette', rouletteRoute);


module.exports = router;
