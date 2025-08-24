import { isStaffOnly } from '../utils/roles.js';

// Deny access for users who have only the SPORT_SCHOOL_STAFF role
export default async function denyStaffOnly(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Не авторизовано' });
    }
    const roles = await req.user.getRoles({ attributes: ['alias'] });
    if (isStaffOnly(roles)) {
      return res
        .status(403)
        .json({ error: 'Доступ ограничен для сотрудников СШ' });
    }
    return next();
  } catch (err) {
    void err;
    // Fallback to deny on unexpected errors
    return res.status(500).json({ error: 'Server error' });
  }
}
