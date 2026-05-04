const jwt = require('jsonwebtoken');

function authMiddleware(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ code: 401, data: null, message: '未授权，请登录' });
    return null;
  }
  try {
    return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
  } catch (err) {
    res.status(401).json({ code: 401, data: null, message: 'Token已过期，请重新登录' });
    return null;
  }
}

module.exports = authMiddleware;
