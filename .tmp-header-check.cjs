const { chromium } = require("@playwright/test")

const VIEWPORTS = [
  { w: 390, h: 844, name: "phone-390" },
  { w: 560, h: 900, name: "phone-560" },
  { w: 768, h: 1024, name: "tablet-768" },
  { w: 1024, h: 800, name: "desktop-1024" },
]

;(async () => {
  const browser = await chromium.launch()
  for (const { w, h, name } of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } })
    const page = await ctx.newPage()
    try {
      await page.goto("http://localhost:5173/", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      })
    } catch (e) {
      console.log(name, "goto warning:", e.message)
    }
    await page.waitForTimeout(2500)

    const info = await page.evaluate(() => {
      const header = document.querySelector("header.site-header")
      if (!header) return { missing: true }
      const cs = getComputedStyle(header)
      const sub = document.querySelector(".site-header__subtitle")
      const img = document.querySelector(".site-logo img")
      const actions = document.querySelector(".site-header__actions")
      const nav = document.querySelector("header.site-header nav")
      const cta = document.querySelector(".site-header__cta")
      const exit = document.querySelector(".test-access-exit")
      const rect = (el) =>
        el
          ? {
              x: Math.round(el.getBoundingClientRect().x),
              w: Math.round(el.getBoundingClientRect().width),
              h: Math.round(el.getBoundingClientRect().height),
            }
          : null
      return {
        innerWidth: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        bodyWidth: Math.round(document.body.getBoundingClientRect().width),
        headerParent: header.parentElement
          ? header.parentElement.className || header.parentElement.tagName
          : "none",
        headerParentWidth: header.parentElement
          ? Math.round(header.parentElement.getBoundingClientRect().width)
          : 0,
        headerHeight: Math.round(header.getBoundingClientRect().height),
        headerWidth: Math.round(header.getBoundingClientRect().width),
        flexDirection: cs.flexDirection,
        flexWrap: cs.flexWrap,
        padding: cs.padding,
        subtitleDisplay: sub ? getComputedStyle(sub).display : "(no element)",
        logoHeight: img ? getComputedStyle(img).height : "(no element)",
        logoBox: rect(document.querySelector(".site-logo")),
        actionsDirection: actions
          ? getComputedStyle(actions).flexDirection
          : "(no element)",
        actionsBox: rect(actions),
        exitTestMode: exit
          ? { ...rect(exit), display: getComputedStyle(exit).display }
          : null,
        ctaBox: rect(cta),
        navDisplay: nav ? getComputedStyle(nav).display : "(no element)",
        bottomNavPresent: !!document.querySelector(".mobile-bottom-nav"),
      }
    })
    console.log("\n=== " + name + " (" + w + "x" + h + ") ===")
    console.log(JSON.stringify(info, null, 2))
    await page.screenshot({ path: "/tmp/ww-" + name + ".png" })
    await ctx.close()
  }
  await browser.close()
})()
