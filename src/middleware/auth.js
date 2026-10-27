function autenticado(req, res, next) {
  if (!req.session.usuario) return res.status(401).json({ ok: false, mensaje: 'Debe iniciar sesión.' });
  next();
}
function permitir(...roles) {
  return (req, res, next) => {
    if (!req.session.usuario) return res.status(401).json({ ok: false, mensaje: 'Debe iniciar sesión.' });
    if (!roles.includes(req.session.usuario.rol)) return res.status(403).json({ ok: false, mensaje: 'No tiene permiso para realizar esta operación.' });
    next();
  };
}
module.exports = { autenticado, permitir };