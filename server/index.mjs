import { ROOT } from './env.mjs';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { buildRouter } from './routes.mjs';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', buildRouter());
  app.use('/api', (_req, res) => {
    res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Not found' });
  });

  const dist = path.join(ROOT, 'dist');
  app.use(express.static(dist));
  app.get('*', (req, res, next) => {
    if (path.extname(req.path)) return next();
    const index = path.join(dist, 'index.html');
    if (!fs.existsSync(index)) return res.status(404).send('Web build missing. Run npm run build:web.');
    res.sendFile(index);
  });
  return app;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);
if (isMain) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, '0.0.0.0', () => console.log(`JUNI server listening on :${port}`));
}
