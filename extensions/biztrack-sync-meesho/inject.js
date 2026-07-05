// BizTrack Sync — page-context network hook.
// Runs inside the Meesho supplier panel page itself so it can see the JSON
// responses the panel receives. Forwards them to the content script via
// window.postMessage. Captures only — never modifies any request.

(function () {
  "use strict";

  const MAX_BODY = 4 * 1024 * 1024; // ignore anything over 4 MB

  function forward(url, bodyText) {
    if (!bodyText || bodyText.length > MAX_BODY) return;
    const t = bodyText.trim();
    if (!(t.startsWith("{") || t.startsWith("["))) return; // JSON only
    try {
      window.postMessage(
        { source: "biztrack-sync", url: String(url), body: t },
        window.location.origin
      );
    } catch {
      /* ignore */
    }
  }

  // ── fetch hook ──
  const origFetch = window.fetch;
  window.fetch = function (...args) {
    const p = origFetch.apply(this, args);
    p.then((res) => {
      try {
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("json")) return;
        const clone = res.clone();
        clone
          .text()
          .then((text) => forward(res.url, text))
          .catch(() => {});
      } catch {
        /* ignore */
      }
    }).catch(() => {});
    return p;
  };

  // ── XHR hook ──
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__biztrackUrl = url;
    return origOpen.call(this, method, url, ...rest);
  };
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", function () {
      try {
        const ct = this.getResponseHeader("content-type") || "";
        if (!ct.includes("json")) return;
        if (this.responseType && this.responseType !== "text") return;
        forward(this.__biztrackUrl || "", this.responseText || "");
      } catch {
        /* ignore */
      }
    });
    return origSend.apply(this, args);
  };
})();
