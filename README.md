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

Real output of my terminal when the page is opened and one button is clicked:

```
Server running at http://localhost:3000
2026-11-16T16:33:10.408Z GET /
2026-11-16T16:33:10.423Z GET /styles.css
2026-11-16T16:33:10.423Z GET /app.js
2026-11-16T16:33:24.404Z GET /api/courses
2026-11-16T16:42:20.117Z GET /api/courses
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
## 5. Reasoning questions

### 1. Route order

*Experiment:* I moved the whole 404 fallback block directly under `const app = express();`, above the logger, the counter, `express.static` and all routes. After that, every request got a 404: opening `http://localhost:3000/` showed "404 - Page not found" instead of the programme page, `curl /hello` returned a 404 HTML page instead of the plain-text greeting, and `curl /api/courses` returned `404` with `{"error":"Not found"}` instead of the course list. The terminal printed no log lines at all, because the logger was now below the fallback and the requests never reached it. This happens because Express runs middleware and routes in the order they are registered and stops at the first one that sends a response; `app.use` with no path matches every request, so placed first it answers everything and nothing below it ever runs. That is why the fallback must be registered last.

### 2. Middleware

*Experiment:* I deleted the `next();` line from `requestLogger`. The browser tab kept loading (the spinner never stopped) and the page never appeared. The server printed exactly one log line, `GET /`, and nothing else: because the HTML never arrived, the browser never asked for `styles.css` or `app.js`. With `curl --max-time 10 http://localhost:3000/hello` the request waited and then failed with `Operation timed out after 10004 milliseconds with 0 bytes received`. A middleware that neither sends a response nor calls `next()` leaves the request stuck: Express never moves on to the counter, `express.static` or the routes, so nobody ever answers, and the connection stays open until the client gives up.

### 3. Status codes

`201 Created` tells the client that the request did not only succeed but also created something new (here, a subscription), while `200 OK` only says "it worked". Using the precise code lets a client react without reading the body. A missing page must be `404` because the status code is the first thing clients, browsers, search engines and monitoring tools look at; if the server answered `200` with an error message in the body, a `fetch()` call would see `response.ok === true`, and a search engine would index the error page as a real page.

### 4. Configuration

The port is a setting of the environment, not of the code. A hosting platform decides which port the app must listen on and passes it through the `PORT` environment variable, and on my own computer another program might already use 3000 (`EADDRINUSE`). Reading `process.env.PORT ?? 3000` lets the same code run unchanged everywhere: it uses the given port when one exists and falls back to 3000 for local development.

### 5. Dependencies

`node_modules` can contain thousands of files and many megabytes, it depends on the operating system, and it can be rebuilt at any time from `package.json` and `package-lock.json`, so committing it would only make the repository huge. After cloning, a teammate must run `npm install` in the project folder (which installs the exact versions pinned in `package-lock.json`) and then `npm start` or `npm run dev`. This is also why `package-lock.json` *is* committed.

### 6. Same origin

If `index.html` were opened directly from disk, the page's address would be `file:///.../index.html`, so a relative URL like `/api/courses` would point to a file path on the disk instead of to the server, and the requests would fail. Even with a full URL (`http://localhost:3000/api/courses`), the page and the API would have different origins (`file://` or `null` vs. `http://localhost:3000`), and the browser would block the response. This restriction is called the **same-origin policy**; the mechanism a server uses to allow other origins is **CORS** (Cross-Origin Resource Sharing). Serving the page from the same Express server keeps everything on one origin.

---

## 6. Self-study notes

| Topic | What I found | How I used it |
| --- | --- | --- |
| Node version and running time | The global `process` object has `process.version` (a string such as `"v24.11.1"`) and `process.uptime()`, which returns how many seconds the process has been running, as a decimal number. (Node docs: [process.version](https://nodejs.org/api/process.html#processversion), [process.uptime()](https://nodejs.org/api/process.html#processuptime)) | `/api/status` returns `nodeVersion: process.version` and `uptimeSeconds: Math.floor(process.uptime())`, so the values are real and change on every call. |
| Plain-text content type | `res.send()` with a string sets `Content-Type: text/html` by default. `res.type('text/plain')` sets the content type (it is short for setting the `Content-Type` header, like `res.set('Content-Type', 'text/plain')`), and `res.send` then adds `charset=utf-8`. (Express docs: [res.type](https://expressjs.com/en/5x/api.html#res.type), [res.send](https://expressjs.com/en/5x/api.html#res.send)) | Used for `/robots.txt` and `/hello`, so both answer with `text/plain; charset=utf-8` instead of `text/html`. |
| Showing JSON neatly | `JSON.stringify(value, replacer, space)`: the third argument is the indentation. `JSON.stringify(data, null, 2)` produces multi-line JSON indented by 2 spaces. (MDN: [JSON.stringify](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)) | `app.js` parses JSON responses and shows them in a `<pre>` element with 2-space indentation. |
| Choosing the content type in the browser | `response.headers.get('Content-Type')` reads a response header in `fetch`. (MDN: [Headers.get](https://developer.mozilla.org/en-US/docs/Web/API/Headers/get)) | `app.js` calls `response.json()` only when the type is JSON, otherwise `response.text()`, so text and HTML responses (`/hello`, the HTML 404) do not crash the page. |
| Redirect status | `res.redirect(status, path)` accepts an optional status code first; the default is 302. (Express docs: [res.redirect](https://expressjs.com/en/5x/api.html#res.redirect)) | `/old-page` uses `res.redirect(301, '/hello')`. |
| Reading request headers | `req.get(name)` reads a request header, case-insensitively, and returns `undefined` if it is missing. | `/api/headers` uses `req.get('User-Agent') ?? null` so a missing header appears as `null` in the JSON instead of disappearing. |
| Startup errors in Express 5 | In Express 5 the `app.listen` callback receives an `error` argument when the server cannot start (for example `EADDRINUSE`). (Express docs: [app.listen](https://expressjs.com/en/5x/api.html#app.listen)) | The callback checks `error` first, prints a clear message and calls `process.exit(1)`; otherwise it prints the address. |
| Redirects in `fetch` | `fetch` follows redirects automatically; `response.redirected` is `true` and `response.url` is the final URL. (MDN: [Response.redirected](https://developer.mozilla.org/en-US/docs/Web/API/Response/redirected)) | The **GET /old-page** button shows the final `200` answer from `/hello` and a "Redirected to: /hello" line. The real `301` is visible in curl (section 4.7) and in the DevTools Network tab. |

---

## 7. Challenges I faced

- **A misleading start message (Express 5).** I accidentally started a second copy of the server while the first one was still running. It printed `Server running at http://localhost:3000` and then exited, although the port was already in use. I found out that in Express 5 the `app.listen` callback is also called when starting fails, with the error as its argument. I changed the callback to check `error` first, print `Could not start the server on port 3000: listen EADDRINUSE ...` and exit with code 1, so the message is now honest.
- **ReferenceErrors while doing the route-order experiment.** When I moved the 404 block, my paste replaced a selected line, so `const PORT` disappeared and the server crashed with `ReferenceError: PORT is not defined`. Reading the first line of the error showed exactly what was missing. I restored the file with `git checkout -- server.js` and repeated the experiment carefully.
- **Pasting into Git Bash.** Commands pasted into the VS Code Git Bash terminal sometimes arrived with extra characters (`[200~git ...` or a `~` at the end of a URL). That caused `command not found` and once a 404 for `/api/courses~`, which first looked like a bug in my server. I learned to check the line before pressing Enter.
- **A typo in a file name.** I first created `public/app.jss` instead of `app.js`, so the buttons did nothing because the browser got a 404 for `/app.js`. The request log in the terminal (`GET /app.js`) helped me find it.
- **Multi-line status text.** The status area showed method, status and content type on one line, because a `<p>` element collapses line breaks. Adding `white-space: pre-line;` to `.status` in `styles.css` fixed it.
- **Plain text vs. HTML.** I had to remember that `res.send` with a string sends `text/html` by default; `curl --include` showed the real `Content-Type`, and `res.type('text/plain')` fixed it for `/hello` and `/robots.txt`.
