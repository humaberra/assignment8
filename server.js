// server.js — Assignment 8: first back-end with Node.js and Express 5
// Author: Hüma Berra Kolukısa (230408056)

import express from 'express';

const app = express();

// A hosting platform can choose the port through an environment variable;
// 3000 is only the fallback for local development.
const PORT = process.env.PORT ?? 3000;

const OWNER_NAME = 'Hüma Berra Kolukısa';

app.get('/hello', (req, res) => {
  // res.send with a string defaults to text/html, so set plain text explicitly.
  res.type('text/plain').send(`Hello from ${OWNER_NAME}'s server`);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});