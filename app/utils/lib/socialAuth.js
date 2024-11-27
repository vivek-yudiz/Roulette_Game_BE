const services = {};

services.googleLogin = async ({ idToken }) => {
  const options = {
    method: 'GET',
    hostname: `oauth2.googleapis.com`,
    path: `/tokeninfo?id_token=${idToken}`,
    headers: { 'Content-Type': 'application/json' },
    isSecure: true,
    rejectUnauthorized: false,
  };
  try {
    const response = await _.request({}, options);

    const userData = {
      sEmail: response.email,
      sGoogleId: response.sub,
    };
    return userData;
  } catch (error) {
    log.error('Error:', error);
  }
};

module.exports = services;
