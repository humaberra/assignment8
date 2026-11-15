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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});