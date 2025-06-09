import { verifyAccessToken } from '../utils/jwt.js';
import User from '../models/user.js';

/**
 * Express middleware
 */
export default async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Authorization token missing' });
    }

    const payload = verifyAccessToken(token);
    const user = await User.findByPk(payload.sub);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Attach user to request object for later handlers
    req.user = user;
    next();
  } catch (err) {
    void err;
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
