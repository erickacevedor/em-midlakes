// Minimal, redirect-free static file server for the Mid Lakes HVAC landing page.
const http = require("http")
const fs = require("fs")
const path = require("path")

const ROOT = path.join(__dirname, "public")
const PORT = process.env.PORT || 3000

const MIME = {
  ".html": "text/html; charset=utf-8",
  // The pages ship as .php (some hosts only accept index.php as a directory
  // index) but contain plain HTML, so serve them as HTML.
  ".php": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}

/* ===== Dev-only live reload =====
 * The PHP site gets this from dev-reload.php; that file is Apache/PHP-only and
 * never runs under this server, so the same behaviour is reimplemented here.
 *
 * Differences from the PHP version, both deliberate:
 *   - The client is injected into the HTML response at serve time rather than
 *     baked into the source, so public/index.html stays clean and nothing
 *     dev-related can leak into dist/ via build.sh.
 *   - A CSS edit swaps the stylesheet in place instead of reloading the page,
 *     so you keep your scroll position while iterating on the palette.
 *
 * Gated on the request host exactly like midlakes_is_dev(), so it stays inert
 * if this server is ever used to serve the live site (npm start).
 */
const RELOAD_PATH = "/__dev-reload"
const BOOT_ID = String(process.hrtime.bigint())
const WATCH_EXT = new Set([".html", ".php", ".css", ".js"])
const clients = new Set()

function isDev(req) {
  let host = String(req.headers.host || "").toLowerCase()
  if (host.startsWith("[")) {
    const end = host.indexOf("]")
    host = end === -1 ? host : host.slice(1, end)
  } else if (host.split(":").length === 2) {
    host = host.split(":")[0]
  }
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".test") ||
    host.endsWith(".local")
  )
}

function broadcast(event) {
  for (const res of clients) res.write(`event: ${event}\ndata: 1\n\n`)
}

let debounce = null
function startWatching() {
  let watcher
  try {
    watcher = fs.watch(ROOT, { recursive: true })
  } catch (err) {
    console.warn("[live-reload] cannot watch public/, live reload disabled:", err.message)
    return
  }
  watcher.on("error", (err) => console.warn("[live-reload] watcher error:", err.message))
  watcher.on("change", (_type, file) => {
    if (!file || !WATCH_EXT.has(path.extname(String(file)).toLowerCase())) return
    clearTimeout(debounce)
    debounce = setTimeout(() => {
      const cssOnly = path.extname(String(file)).toLowerCase() === ".css"
      broadcast(cssOnly ? "css" : "change")
    }, 120)
  })
}

const CLIENT = `
<script>
;(() => {
  const es = new EventSource(${JSON.stringify(RELOAD_PATH)})
  let boot = null

  es.addEventListener("hello", (e) => {
    // A different boot id means the server restarted while we were away.
    if (boot !== null && boot !== e.data) return location.reload()
    boot = e.data
    console.info("[live-reload] watching for changes")
  })

  es.addEventListener("change", () => {
    console.info("[live-reload] change detected, reloading")
    es.close()
    location.reload()
  })

  // CSS swaps in place so the page doesn't jump back to the top.
  es.addEventListener("css", () => {
    for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
      const url = new URL(link.href, location.href)
      if (url.origin !== location.origin) continue
      url.searchParams.set("__r", Date.now())
      link.href = url.pathname + url.search
    }
    console.info("[live-reload] stylesheet updated")
  })
})()
</script>
`

function injectClient(html) {
  const marker = "</body>"
  const i = html.lastIndexOf(marker)
  return i === -1 ? html + CLIENT : html.slice(0, i) + CLIENT + html.slice(i)
}

function sendHtml(res, data, dev) {
  const body = dev ? injectClient(data.toString("utf8")) : data
  res.writeHead(200, { "Content-Type": MIME[".html"], ...SECURITY_HEADERS })
  res.end(body)
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0])
  if (urlPath === "/" || urlPath === "") urlPath = "/index.php"
  // Directory URLs (/services/) serve that directory's index.html.
  else if (urlPath.endsWith("/")) urlPath += "index.php"

  const dev = isDev(req)

  // Live-reload event stream. Dev hosts only; 404 elsewhere, like dev-reload.php.
  if (urlPath === RELOAD_PATH) {
    if (!dev) {
      res.writeHead(404, { "Content-Type": "text/plain" })
      res.end("Not Found")
      return
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Connection: "keep-alive",
      ...SECURITY_HEADERS,
    })
    res.write(`retry: 1000\nevent: hello\ndata: ${BOOT_ID}\n\n`)
    clients.add(res)
    req.on("close", () => clients.delete(res))
    return
  }

  // Prevent path traversal
  const filePath = path.join(ROOT, path.normalize(urlPath))
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403)
    res.end("Forbidden")
    return
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // /services -> /services/index.html, before the catch-all below.
      if (!path.extname(filePath)) {
        const dirIndex = path.join(filePath, "index.php")
        if (dirIndex.startsWith(ROOT) && fs.existsSync(dirIndex)) {
          // Redirect to the trailing-slash form (as Apache's DirectorySlash
          // does) so the page's relative asset paths resolve from the
          // directory itself rather than its parent.
          res.writeHead(301, { Location: urlPath + "/" })
          res.end()
          return
        }
      }
      // SPA-ish fallback to index for unknown routes
      fs.readFile(path.join(ROOT, "index.php"), (err2, indexData) => {
        if (err2) {
          res.writeHead(404, { "Content-Type": "text/plain" })
          res.end("Not Found")
        } else {
          sendHtml(res, indexData, dev)
        }
      })
      return
    }
    const ext = path.extname(filePath).toLowerCase()
    if (ext === ".html" || ext === ".php") {
      sendHtml(res, data, dev)
      return
    }
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      // Never let the browser serve a stale stylesheet back to the live-reloader.
      ...(dev ? { "Cache-Control": "no-store" } : {}),
      ...SECURITY_HEADERS,
    })
    res.end(data)
  })
})

startWatching()

server.listen(PORT, () => {
  console.log(`Mid Lakes HVAC static server running at http://localhost:${PORT}`)
})
