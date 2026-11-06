const jwt = require('jsonwebtoken');
module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.userId = Number(payload.sub);
    if (!Number.isSafeInteger(req.userId) || req.userId <= 0) throw Error('Invalid subject');
    next();
  } catch { res.status(401).json({ error: 'Invalid or expired token' }); }
};
