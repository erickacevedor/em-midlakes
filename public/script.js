// Mobile nav toggle
const toggle = document.getElementById("nav-toggle")
const nav = document.getElementById("main-nav")

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open")
    toggle.setAttribute("aria-expanded", String(open))
  })
  // Close menu when a link is clicked (mobile)
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open")
      toggle.setAttribute("aria-expanded", "false")
    })
  })
}

// FAQ: keep it an accordion (only one open at a time)
const faqItems = document.querySelectorAll(".faq-item")
faqItems.forEach((item) => {
  item.addEventListener("toggle", () => {
    if (item.open) {
      faqItems.forEach((other) => {
        if (other !== item) other.open = false
      })
    }
  })
})

// Quote form: basic client-side handling
const form = document.getElementById("quote-form")
const success = document.getElementById("form-success")
if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault()
    if (!form.checkValidity()) {
      form.reportValidity()
      return
    }
    form.reset()
    if (success) {
      success.hidden = false
      setTimeout(() => {
        success.hidden = true
      }, 6000)
    }
  })
}

// Reveal-on-scroll animation
const revealTargets = document.querySelectorAll(
  ".about-copy, .stats, .gallery, .promise, .section-title, .service-card, .comfort-card, .why-card, .faq-list-wrap, .faq-media, .contact-copy, .quote-form",
)
revealTargets.forEach((el) => el.classList.add("reveal"))

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

if ("IntersectionObserver" in window && !prefersReducedMotion) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in")
          observer.unobserve(entry.target)
        }
      })
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  )
  revealTargets.forEach((el) => observer.observe(el))

  // Safety net: never leave content hidden if the observer misfires
  window.setTimeout(() => {
    revealTargets.forEach((el) => el.classList.add("in"))
  }, 2500)
} else {
  revealTargets.forEach((el) => el.classList.add("in"))
}

// Current year in footer
const yearEl = document.getElementById("year")
if (yearEl) yearEl.textContent = new Date().getFullYear()
