require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('path');
const { inicializarUsuariosDemo } = require('./data/memoria');
const authRoutes = require('./routes/auth');
const beneficiariosRoutes = require('./routes/beneficiarios');
const programasRoutes = require('./routes/programas');

const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(session({
  name: 'sid', secret: process.env.SESSION_SECRET || 'solo-desarrollo-cambie-este-secreto',
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 }
}));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api/auth', authRoutes);
app.use('/api/beneficiarios', beneficiariosRoutes);
app.use('/api/programas', programasRoutes);
app.get('/api/health', (_req, res) => res.json({ ok: true, mensaje: 'API disponible. Sprint 1 sin base de datos.' }));
app.use('/api/*', (_req, res) => res.status(404).json({ ok: false, mensaje: 'Recurso no encontrado.' }));
app.use((error, _req, res, _next) => { console.error(error); res.status(500).json({ ok: false, mensaje: 'Error interno del servidor.' }); });
const port = Number(process.env.PORT || 3000);
inicializarUsuariosDemo().then(() => app.listen(port, () => console.log(`Portal disponible en http://localhost:${port}`))).catch(err => { console.error('No se pudieron crear las cuentas de prueba.', err); process.exit(1); });
