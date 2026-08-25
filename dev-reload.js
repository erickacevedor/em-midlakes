// Dev-only live reload -- index.php only emits this script on localhost / *.test.
// Polls dev-reload.php for a change token and refreshes the tab when it moves.
;(() => {
  const ENDPOINT = "dev-reload.php"
  const INTERVAL = 1000

  let known = null
  let failures = 0
  let timer = null

  async function check() {
    try {
      const res = await fetch(`${ENDPOINT}?t=${Date.now()}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { token } = await res.json()
      failures = 0

      if (known === null) {
        known = token
        console.info("[live-reload] watching for changes")
      } else if (token !== known) {
        console.info("[live-reload] change detected, reloading")
        stop()
        location.reload()
      }
    } catch (err) {
      // Server restarting or a PHP hiccup -- keep retrying, but never reload-loop.
      failures += 1
      if (failures === 5) console.warn("[live-reload] endpoint unreachable, still retrying", err)
    }
  }

  function start() {
    if (timer) return
    timer = setInterval(check, INTERVAL)
    check()
  }

  function stop() {
    clearInterval(timer)
    timer = null
  }

  // No point polling a tab nobody is looking at.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stop()
    } else {
      start()
    }
  })

  start()
})()
