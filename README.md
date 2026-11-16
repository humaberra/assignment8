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


## 4. Testing evidence (`curl --include`)

All outputs below were produced on my computer with the server running (`npm run dev`), on 16/11/2026 19:20.
I ran them in Git Bash on Windows. (In Windows PowerShell the same commands need `curl.exe`, because there `curl` is an alias for `Invoke-WebRequest`.)

### 4.1 Successful JSON response — GET /api/courses

```
$ curl --include http://localhost:3000/api/courses
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 244
ETag: W/"f4-ZLsebvKPmdsArZJpRxhCXrGpHiU"
Date: Mon, 16 Nov 2026 16:20:42 GMT
Connection: keep-alive
Keep-Alive: timeout=5

[{"id":1,"title":"Foundations of HTML and CSS","credits":6},{"id":2,"title":"JavaScript in the Browser","credits":6},{"id":3,"title":"Building Interfaces with React","credits":5},{"id":4,"title":"Back-End Development with Node.js","credits":5}]
```

### 4.2 JSON with real process values — GET /api/status

```
$ curl --include http://localhost:3000/api/status
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 60
ETag: W/"3c-SLuN6PMLsFIHY0Hsqc6GuOfbsa8"
Date: Mon, 16 Nov 2026 16:20:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"status":"ok","nodeVersion":"v24.21.0","uptimeSeconds":657}
```

### 4.3 Plain text — GET /hello

```
$ curl --include http://localhost:3000/hello
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: text/plain; charset=utf-8
Content-Length: 41
ETag: W/"29-x1VdWqQBoN5mNqi4rZQbJ+tA74U"
Date: Mon, 16 Nov 2026 16:20:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5

Hello from Hüma Berra Kolukısa's server
```

### 4.4 Plain-text content type — GET /robots.txt

```
$ curl --include http://localhost:3000/robots.txt
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: text/plain; charset=utf-8
Content-Length: 97
ETag: W/"61-J4YKLMF/p98nq6p4QieozkxUbeA"
Date: Mon, 16 Nov 2026 16:20:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5

# robots.txt for the Web Craft Academy information server
User-agent: *
Disallow: /api/
Allow: /

```

### 4.5 The 201 response — POST /api/subscribe

```
$ curl --include --request POST http://localhost:3000/api/subscribe
HTTP/1.1 201 Created
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 19
ETag: W/"13-oWAPIqDXuocNexKhPYW9ayyk98c"
Date: Mon, 16 Nov 2026 16:20:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"subscribed":true}
```

### 4.6 The 403 response — GET /api/admin

```
$ curl --include http://localhost:3000/api/admin
HTTP/1.1 403 Forbidden
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 21
ETag: W/"15-TLNzmZqKxaTuFdX/dVWWPBu44/c"
Date: Mon, 16 Nov 2026 16:20:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"error":"Forbidden"}
```

### 4.7 The redirect — GET /old-page

```
$ curl --include http://localhost:3000/old-page
HTTP/1.1 301 Moved Permanently
X-Powered-By: Express
Location: /hello
Vary: Accept
Content-Type: text/plain; charset=utf-8
Content-Length: 40
Date: Mon, 16 Nov 2026 16:20:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5

Moved Permanently. Redirecting to /hello
```

### 4.8 404 on an /api path — GET /api/does-not-exist

```
$ curl --include http://localhost:3000/api/does-not-exist
HTTP/1.1 404 Not Found
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 21
ETag: W/"15-bm7tJgu8FHlq5QU+Y6gDxOGPfRc"
Date: Mon, 16 Nov 2026 16:20:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"error":"Not found"}
```

### 4.9 404 on a non-API path — GET /no-such-page

```
$ curl --include http://localhost:3000/no-such-page
HTTP/1.1 404 Not Found
X-Powered-By: Express
Content-Type: text/html; charset=utf-8
Content-Length: 103
ETag: W/"67-XrIsRXf/OmwIYrKf3k6UgXoi4eI"
Date: Mon, 16 Nov 2026 16:20:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5

<h1>404 - Page not found</h1><p>The page you asked for does not exist. <a href="/">Back to home</a></p>
```

### 4.10 Headers echo — GET /api/headers

```
$ curl --include http://localhost:3000/api/headers
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 42
ETag: W/"2a-zvEPwPyXSvSguAOkChXoS1+AhlQ"
Date: Mon, 16 Nov 2026 16:20:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"userAgent":"curl/8.21.0","accept":"*/*"}
```

### 4.11 Request counter — GET /api/stats

```
$ curl --include http://localhost:3000/api/stats
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 21
ETag: W/"15-zUZ9ORV/6zU92ZlP8Y2FjB65xqY"
Date: Mon, 16 Nov 2026 16:20:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"requestsServed":13}
```

### 4.12 Started from another folder, on another port

```
$ cd ..
$ PORT=4000 node assignment8/server.js
Server running at http://localhost:4000

$ curl --include http://localhost:4000/
HTTP/1.1 200 OK
X-Powered-By: Express
Accept-Ranges: bytes
Cache-Control: public, max-age=0
Last-Modified: Mon, 16 Nov 2026 10:52:56 GMT
ETag: W/"a8c-1a1e3fd13b3"
Content-Type: text/html; charset=utf-8
Content-Length: 2700
Date: Mon, 16 Nov 2026 16:20:46 GMT
Connection: keep-alive
Keep-Alive: timeout=5

<!DOCTYPE html>
<html lang="en">

... (rest of index.html)
```

---
