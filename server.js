// server.js — Assignment 8: first back-end with Node.js and Express 5
// Author: Hüma Berra Kolukısa (230408056)

import express from 'express';

const app = express();

// A hosting platform can choose the port through an environment variable;
// 3000 is only the fallback for local development.
const PORT = process.env.PORT ?? 3000;

const OWNER_NAME = 'Hüma Berra Kolukısa';

const COURSES = [
  { id: 1, title: 'Foundations of HTML and CSS', credits: 6 },
  { id: 2, title: 'JavaScript in the Browser', credits: 6 },
  { id: 3, title: 'Building Interfaces with React', credits: 5 },
  { id: 4, title: 'Back-End Development with Node.js', credits: 5 },
];

const ROBOTS_TXT = [
  '# robots.txt for the Web Craft Academy information server',
  'User-agent: *',
  'Disallow: /api/',
  'Allow: /',
  '',
].join('\n');

// Our own counter (a variable we created), not a property added to req/res.
let requestsServed = 0;

// Request logger: one line per request with timestamp, method and URL.
function requestLogger(req, res, next) {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
}

// Request counter: counts every request that reaches the server
// (pages, static files, API calls and 404s).
function requestCounter(req, res, next) {
  requestsServed += 1;
  next();
}

app.use(requestLogger);
app.use(requestCounter);

app.get('/hello', (req, res) => {
  // res.send with a string defaults to text/html, so set plain text explicitly.
  res.type('text/plain').send(`Hello from ${OWNER_NAME}'s server`);
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(ROBOTS_TXT);
});

app.get('/old-page', (req, res) => {
  // 301 Moved Permanently: the old page has been replaced by /hello for good.
  res.redirect(301, '/hello');
});

app.get('/api/courses', (req, res) => {
  res.json(COURSES);
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    nodeVersion: process.version,
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

app.get('/api/headers', (req, res) => {
  res.json({
    userAgent: req.get('User-Agent') ?? null,
    accept: req.get('Accept') ?? null,
  });
});

app.post('/api/subscribe', (req, res) => {
  res.status(201).json({ subscribed: true });
});

app.get('/api/admin', (req, res) => {
  res.status(403).json({ error: 'Forbidden' });
});

app.get('/api/stats', (req, res) => {
  res.json({ requestsServed });
});

// 404 fallback — MUST stay last so it never hides a real route.
// Express 5: app.use() with no path instead of app.get('*', ...).
app.use((req, res) => {
  const isApiPath = req.path === '/api' || req.path.startsWith('/api/');

  if (isApiPath) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  res
    .status(404)
    .send('<h1>404 - Page not found</h1><p>The page you asked for does not exist. <a href="/">Back to home</a></p>');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});