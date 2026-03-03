import express from 'express';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

app.use(express.json({ limit: '1mb' }));

// -- Auth middleware -----------------------------------------------------------
function requireApiKey(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const authHeader = req.headers.authorization;
  const expectedKey = process.env.RAILWAY_API_KEY;

  if (!expectedKey) {
    console.warn('[auth] RAILWAY_API_KEY not set — skipping auth (dev mode)');
    next();
    return;
  }

  if (authHeader !== `Bearer ${expectedKey}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

// -- Health -------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// -- Run (placeholder — filled in Task 8) -------------------------------------
app.post('/run', requireApiKey, (_req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

// -- Start --------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[worker] Research worker listening on :${PORT}`);
});

export default app;
