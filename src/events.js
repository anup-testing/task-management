/**
 * Server-Sent Events, so an open dashboard reflects someone else's change
 * within a second without polling. One-way and reconnects on its own, which
 * is all this needs — no websocket library.
 */
const clients = new Set();

export function mountEvents(app, requireUser) {
  app.get("/api/stream", requireUser, (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"                 // nginx: don't buffer this one
    });
    res.write("retry: 3000\n\n");
    clients.add(res);
    const ping = setInterval(() => { try { res.write(": ping\n\n"); } catch { /* closed */ } }, 25_000);
    req.on("close", () => { clearInterval(ping); clients.delete(res); });
  });
}

/** Tell every open dashboard which collections moved. */
export function broadcast(collections, actorId) {
  const payload = JSON.stringify({ collections, actorId, at: new Date().toISOString() });
  for (const res of clients) {
    try { res.write(`event: change\ndata: ${payload}\n\n`); }
    catch { clients.delete(res); }
  }
}
export const clientCount = () => clients.size;
