// The service worker the catalogue's `SWUpdater` card registers, and nothing else.
//
// **This is a published site, so this worker is deliberately inert.** It installs no `fetch`
// handler, so it never intercepts a request; it opens no cache, so it stores nothing; and it never
// calls `clients.claim()`, so it controls only a page that navigates into its own scope after it
// activates. Its scope is `sw-demo/`, one directory below the catalogue, so the catalogue itself is
// never controlled by it — and nothing registers it on page load: a visitor has to press the card's
// button.
//
// The one thing it does is the worker's half of `SWUpdater`'s contract: a waiting worker that is
// told to skip waiting takes over. It answers that message and no other, which is what makes the
// browser check a real test of the message rather than of the button.
self.addEventListener("message", (event) => {
  if (event.data && event.data.action === "skipWaiting") self.skipWaiting()
})
