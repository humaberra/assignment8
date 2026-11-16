# Assignment 8 — Web Craft Academy Information Server

**Student:** Hüma Berra Kolukısa
**Student number:** 230408056
**Course:** Web Programming — Fall 2026

A small Node.js + Express 5 server for a made-up study programme ("Web Craft Academy"). It serves a web page, offers text and JSON routes with deliberate status codes, logs every request and counts how many requests it has served since it started.

---

## 1. How to install and run

Requirements: Node.js (current LTS, at least 20.11 because the code uses `import.meta.dirname`) and npm.

```bash
git clone <repository-url>
cd assignment8
npm install          # rebuilds node_modules from package.json + package-lock.json
npm start            # runs: node server.js
```

Open <http://localhost:3000> in the browser.

During development:

```bash
npm run dev          # runs: node --watch server.js (restarts on every file change)
```

Running on another port:

```bash
# macOS / Linux / Git Bash
PORT=4000 npm start

# Windows PowerShell
$env:PORT=4000; npm start
```

---

## 2. File organization

```
assignment8/
 ├─ public/            Files served as-is by express.static
 │   ├─ index.html     Page that explains the programme + one button per route
 │   ├─ styles.css     External styles for the page
 │   └─ app.js         Browser code: fetch() calls, shows status + body
 ├─ server.js          Express app: data, middleware, routes, 404 fallback, listen
 ├─ package.json       "type": "module", scripts (start, dev), dependencies
 ├─ package-lock.json  Exact installed versions (committed)
 ├─ .gitignore         Keeps node_modules/ and .env out of Git
 └─ README.md          This file
```

### Order of things inside `server.js`

1. Create the app, read `PORT`, build the absolute path to `public/`
2. Hard-coded data (`COURSES`, robots.txt text, the request counter)
3. Middleware: request logger → request counter → `express.static`
4. Text routes: `/hello`, `/robots.txt`, `/old-page`
5. API routes: `/api/courses`, `/api/status`, `/api/headers`, `/api/subscribe`, `/api/admin`, `/api/stats`
6. 404 fallback (`app.use` with no path) — always last
7. `app.listen` — the callback checks for a startup error first (Express 5 passes errors such as `EADDRINUSE` to it) and only then prints the full address

### Routes

| Method and path | Status | Content-Type | Body |
| --- | --- | --- | --- |
| `GET /` | 200 | `text/html` | `public/index.html` (served by `express.static`) |
| `GET /hello` | 200 | `text/plain` | `Hello from Hüma Berra Kolukısa's server` |
| `GET /robots.txt` | 200 | `text/plain` | robots rules |
| `GET /old-page` | 301 | — | redirect, `Location: /hello` |
| `GET /api/courses` | 200 | `application/json` | array of 4 courses `{ id, title, credits }` |
| `GET /api/status` | 200 | `application/json` | `{ status, nodeVersion, uptimeSeconds }` |
| `GET /api/headers` | 200 | `application/json` | `{ userAgent, accept }` |
| `POST /api/subscribe` | 201 | `application/json` | `{ "subscribed": true }` |
| `GET /api/admin` | 403 | `application/json` | `{ "error": "Forbidden" }` |
| `GET /api/stats` | 200 | `application/json` | `{ "requestsServed": <number> }` |
| anything else under `/api` | 404 | `application/json` | `{ "error": "Not found" }` |
| anything else | 404 | `text/html` | short "Page not found" message |

### Status code choices

- **301 for `/old-page`**: the name says the page is *old*, it has been replaced by `/hello` for good, so "Moved Permanently" describes the situation better than the default 302 ("Found", temporary). Trade-off: browsers cache a 301, so if I later wanted `/old-page` to point somewhere else, visitors who already saw the 301 would keep going to `/hello` until their cache is cleared. A 302 would be the safer choice if the move might change again.
- **201 for `/api/subscribe`**: a subscription is a new resource being created.
- **403 for `/api/admin`**: the route exists, but the client is not allowed to access it.
- **404 for unknown paths**: the resource does not exist. API paths get JSON so a `fetch()` client can always parse the error the same way it parses other API answers; normal pages get a short HTML message for humans.
- The 404 check uses `req.path === '/api' || req.path.startsWith('/api/')` instead of only `startsWith('/api')`, so that a page such as `/apiary` is not treated as an API path.

---

## 3. Middleware

Both middleware functions are defined in `server.js` and registered with `app.use` **before** `express.static` and before every route. Both call `next()`.

```js
function requestLogger(req, res, next) {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
}

function requestCounter(req, res, next) {
  requestsServed += 1;
  next();
}
```

Example of what the terminal prints when the page is opened and one button is clicked:

```
Server running at http://localhost:3000
2026-11-15T14:20:01.512Z GET /
2026-11-15T14:20:01.540Z GET /styles.css
2026-11-15T14:20:01.541Z GET /app.js
2026-11-15T14:20:01.610Z GET /favicon.ico
2026-11-15T14:20:05.002Z GET /api/courses
```

### Which requests are counted, and why

The counter counts **every request that reaches the server**: the page (`/`), static files (`/styles.css`, `/app.js`), API calls, redirects, and 404s (including the `/favicon.ico` request the browser sends on its own, which gets a 404 because there is no favicon).

Reason: the route is called `requestsServed`, and every one of these requests *is* served — the server sends a response to each of them, even if that response is a 404. Counting only the "successful" API calls would hide real traffic (for example, a broken link that keeps producing 404s). Because the counter runs before the routes, the request to `/api/stats` itself is also included in the number it returns. So opening the page once and clicking **GET /api/stats** shows `5` (`/`, `/styles.css`, `/app.js`, `/favicon.ico`, `/api/stats`). The browser may also make extra requests on its own, or answer a reload with a `304 Not Modified` from its cache, so the exact number can vary a little.

The counter is a plain `let` variable that I created in `server.js`. I do not attach anything to the `req` or `res` objects (which I did not create), and the counter resets to 0 every time the server restarts, because there is no persistence.

### Why they are placed where they are

- **Logger first**: it should see every request before anything else can answer it. If it came after `express.static`, requests for `index.html`, `styles.css` and `app.js` would be answered by the static middleware and never logged.
- **Counter second, still before `express.static`**: for the same reason. If it were after `express.static`, static files would not be counted, and if it were after the routes, only 404s would be counted.
- **`express.static` before the routes**: so `GET /` returns `public/index.html`. There is no file in `public/` named like an API route, so it never hides a route.
- **404 fallback last**: Express runs middleware and routes in the order they were registered and stops at the first one that sends a response. A catch-all placed earlier would answer before the real routes get a chance.

---

