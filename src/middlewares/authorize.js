export default function authorize(roleAlias) {
  return async function (req, res, next) {
    const roles = await req.user.getRoles({ where: { alias: roleAlias } });
    if (!roles || roles.length === 0) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
