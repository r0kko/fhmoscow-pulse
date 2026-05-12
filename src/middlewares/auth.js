import { verifyAccessToken } from '../utils/jwt.js';
import User from '../models/user.js';
import { UserStatus } from '../models/index.js';

/**
 * Express middleware
 */
export default async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'missing_token' });
    }

    const payload = verifyAccessToken(token);
    const user = await User.findByPk(payload.sub, {
      include: [{ model: UserStatus, attributes: ['alias'], required: false }],
    });

    if (!user) {
      return res.status(401).json({ error: 'user_not_found' });
    }
    if (typeof payload.ver !== 'number' || payload.ver !== user.token_version) {
      return res.status(401).json({ error: 'invalid_token' });
    }
    if (user.UserStatus?.alias === 'INACTIVE') {
      return res.status(403).json({ error: 'account_inactive' });
    }

    // Attach user to request object for later handlers
    req.user = user;
    next();
  } catch (err) {
    void err;
    return res.status(401).json({ error: 'invalid_token' });
  }
}
