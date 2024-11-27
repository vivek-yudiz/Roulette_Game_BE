const router = require('express').Router();
const controllers = require('./lib/controllers');
const middleware = require('./lib/middlewares');

router.post('/login/social', controllers.socialLogin);
router.post('/login', controllers.login);
router.post('/otp/resend', controllers.resendOtp);
router.post('/otp/verify', controllers.verifyOtp);
router.post('/autoLogin', controllers.autoLoginUsers);
router.post('/guestLogin', controllers.guestLogin);
router.post('/token/refresh', middleware.isAuthenticated, controllers.refreshToken);

module.exports = router;
