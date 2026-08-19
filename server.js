// Minimal, redirect-free static file server for the Mid Lakes HVAC landing page.
const http = require("http")
const fs = require("fs")
const path = require("path")

const ROOT = path.join(__dirname, "public")
const PORT = process.env.PORT || 3000

const MIME = {
  ".html": "text/html; charset=utf-8",
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

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0])
  if (urlPath === "/" || urlPath === "") urlPath = "/index.html"

  // Prevent path traversal
  const filePath = path.join(ROOT, path.normalize(urlPath))
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403)
    res.end("Forbidden")
    return
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA-ish fallback to index for unknown routes
      fs.readFile(path.join(ROOT, "index.html"), (err2, indexData) => {
        if (err2) {
          res.writeHead(404, { "Content-Type": "text/plain" })
          res.end("Not Found")
        } else {
          res.writeHead(200, { "Content-Type": MIME[".html"], ...SECURITY_HEADERS })
          res.end(indexData)
        }
      })
      return
    }
    const ext = path.extname(filePath).toLowerCase()
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      ...SECURITY_HEADERS,
    })
    res.end(data)
  })
})

server.listen(PORT, () => {
  console.log(`Mid Lakes HVAC static server running at http://localhost:${PORT}`)
})
