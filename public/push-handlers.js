self.addEventListener("push", (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }
  const title = payload.title || "Wine Words"
  const path = typeof payload.path === "string" && payload.path.startsWith("/")
    ? payload.path
    : "/notifications"
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || "You have a new Wine Words notification.",
    icon: "/wine-words-icon-192.png",
    badge: "/wine-words-icon-192.png",
    data: { path },
  }))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const path = event.notification.data && event.notification.data.path
    ? event.notification.data.path
    : "/notifications"
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin)
    if (existing) {
      existing.navigate(path)
      return existing.focus()
    }
    return self.clients.openWindow(path)
  }))
})