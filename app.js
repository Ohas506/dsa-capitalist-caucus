/* Newsletter sign-up: talks to the tiny Node backend in server.js.
   Falls back gracefully if the API is unreachable (e.g. page opened
   directly from disk without the server running). */
(function () {
  "use strict";

  var form = document.getElementById("newsletter-form");
  var emailEl = document.getElementById("email");
  var nameEl = document.getElementById("name");
  var msg = document.getElementById("form-msg");
  var btn = document.getElementById("submit-btn");
  var countEl = document.getElementById("subs-count");

  var API_BASE = ""; // same origin as the server

  function setMsg(text, kind) {
    msg.textContent = text;
    msg.className = "form-msg" + (kind ? " " + kind : "");
  }

  function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  function refreshCount() {
    if (!countEl) return;
    fetch(API_BASE + "/api/count")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && typeof d.count === "number") {
          countEl.textContent =
            d.count + (d.count === 1 ? " subscriber" : " subscribers") + " and counting.";
        }
      })
      .catch(function () { /* server not running; stay quiet */ });
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = (emailEl.value || "").trim();
      var name = (nameEl.value || "").trim();

      if (!validEmail(email)) {
        setMsg("Please enter a valid email address.", "err");
        emailEl.focus();
        return;
      }

      btn.disabled = true;
      setMsg("Subscribing…", "");

      fetch(API_BASE + "/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, name: name })
      })
        .then(function (r) {
          return r.json().then(function (data) { return { ok: r.ok, data: data }; });
        })
        .then(function (res) {
          if (res.ok) {
            setMsg(
              res.data.already
                ? "You're already on the list — thank you."
                : "Subscribed. Welcome to the caucus.",
              "ok"
            );
            form.reset();
            refreshCount();
          } else {
            setMsg(res.data && res.data.error ? res.data.error : "Something went wrong.", "err");
          }
        })
        .catch(function () {
          setMsg(
            "Could not reach the sign-up server. Start it with \"node server.js\" and try again.",
            "err"
          );
        })
        .finally(function () {
          btn.disabled = false;
        });
    });
  }

  refreshCount();
})();
