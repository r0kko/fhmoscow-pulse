import { ADMIN_ROLES, REFEREE_ROLES } from '../utils/roles.js';

const ROLE_GROUPS = {
  ADMIN: ADMIN_ROLES,
  REFEREE: REFEREE_ROLES,
};

export default function authorize(...aliases) {
  const allowed = aliases.flatMap((a) => ROLE_GROUPS[a] || [a]);
  return async function (req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Не авторизовано' });
      }
      const roles = await req.user.getRoles({ where: { alias: allowed } });
      if (!roles || roles.length === 0) {
        return res.status(403).json({ error: 'Доступ запрещён' });
      }
      return next();
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  };
}
