/* ============================================================
   SOUL GARDEN — FIRST-VISIT COMPANION-LED TOUR  (ADDITIVE)
   ------------------------------------------------------------
   A self-contained, first-time-only spotlight tour led by the
   user's companion. It does NOT modify any existing app code or
   markup: it builds its own DOM, and it *wraps* (never edits) the
   global functions enterApp() and renderProfile().

   Remove the <link href="tour.css"> and <script src="tour.js">
   lines from index.html and the app behaves exactly as before.

   Persistence: profiles.tour_completed (Supabase) with a
   localStorage fallback keyed per user. Set on finish AND skip.
============================================================ */
(function () {
  "use strict";

  /* ---------- small helpers (read app globals defensively) ---------- */

  // The app's top-level `const sb`, `const state`, `const COMPANIONS`
  // and `function ensureAudio` live in the shared global lexical scope,
  // so a later classic script can read them. Everything is guarded.
  function appSb()    { try { return sb; }    catch (e) { return null; } }
  function appState() { try { return state; } catch (e) { return null; } }
  function reduceMotion() {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (e) { return false; }
  }

  function companion() {
    try {
      var id = (appState() && appState().user && appState().user.companion) || "fox";
      var list = (typeof COMPANIONS !== "undefined" && COMPANIONS) || [];
      var c = list.filter(function (x) { return x.id === id; })[0];
      return c || { emo: "🦊", name: "Fox" };
    } catch (e) { return { emo: "🦊", name: "Fox" }; }
  }

  async function currentUid() {
    var s = appSb();
    if (!s) return null;
    try {
      var r = await s.auth.getUser();
      return (r && r.data && r.data.user && r.data.user.id) || null;
    } catch (e) { return null; }
  }

  /* ---------- a soft chime, reusing the app's existing audio ----------
     Respects the app's mute state: ensureAudio() rebuilds masterGain
     with gain 0 when muted, and we also bail early when muted. We do
     not create a new audio system. */
  function chime() {
    try {
      if (typeof muted !== "undefined" && muted) return;      // sound is off
      if (typeof ensureAudio === "function") ensureAudio();    // app's own setup
      if (typeof audioCtx === "undefined" || !audioCtx) return;
      var t = audioCtx.currentTime;
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(620, t);
      o.frequency.exponentialRampToValueAtTime(940, t + 0.12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.10, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g);
      // Route through masterGain so volume + mute always apply.
      g.connect((typeof masterGain !== "undefined" && masterGain) ? masterGain : audioCtx.destination);
      o.start(t);
      o.stop(t + 0.52);
    } catch (e) { /* never let the chime break the tour */ }
  }

  /* ---------- the flow ----------
     step.target : CSS selector for a real element (null => centered card)
     step.line   : the companion's short line
     step.title  : optional heading (centered cards only)
     step.cta    : optional button label override */
  function buildSteps() {
    var c = companion();
    return [
      { centered: true,
        title: "Welcome to your garden.",
        line: "I'm " + c.name + ". Let me show you around — it'll only take a moment.",
        cta: "Begin" },

      { target: "#screen-home .greeting",
        line: "This is where I greet you each day. Showing up — that's the whole practice." },

      { target: "#screen-home .affirm-card",
        line: "A kind word and a little wisdom each morning. Small intentions, quietly, change everything." },

      { target: "#home-garden-mount",
        line: "Your garden grows as you do. Tap a glowing zone to peek inside — your progress, alive." },

      { target: '#bottom-nav .nav-item[data-screen="habits"]',
        line: "Here you tend your habits. Gentle and steady beats big and rare." },

      { target: '#bottom-nav .nav-item[data-screen="insights"]',
        line: "Over time, I'll show you the patterns — proof of how far you've grown." },

      { target: '#screen-home .topbar .icon-btn[onclick*="openDrawer"]',
        line: "Pick a sound to grow by — stream, birds, rain, wind or leaves. Let your garden breathe with you." },

      { target: '#bottom-nav .nav-item[data-screen="profile"]',
        line: "And this little space is yours to shape. Make it feel like home." },

      { centered: true,
        title: "Your garden is ready.",
        line: "Let's grow, together.",
        cta: "Enter my garden 🌿" }
    ];
  }

  /* ---------- DOM (built once, lazily) ---------- */
  var root, backdrop, spot, card, avEl, titleEl, lineEl, dotsEl, nextBtn, skipBtn, arrowEl;

  function ensureDom() {
    if (root) return;
    root = document.createElement("div");
    root.id = "sgtour-root";
    root.setAttribute("aria-hidden", "true");

    backdrop = document.createElement("div");
    backdrop.className = "sgtour-backdrop";

    spot = document.createElement("div");
    spot.className = "sgtour-spot";

    card = document.createElement("div");
    card.className = "sgtour-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", "sgtour-line");

    arrowEl = document.createElement("div");
    arrowEl.className = "sgtour-arrow";

    avEl = document.createElement("div");
    avEl.className = "sgtour-av";
    avEl.setAttribute("aria-hidden", "true");

    var bodyEl = document.createElement("div");
    bodyEl.className = "sgtour-body";

    titleEl = document.createElement("p");
    titleEl.className = "sgtour-title";
    titleEl.style.display = "none";

    lineEl = document.createElement("p");
    lineEl.className = "sgtour-line";
    lineEl.id = "sgtour-line";

    dotsEl = document.createElement("div");
    dotsEl.className = "sgtour-dots";

    var actions = document.createElement("div");
    actions.className = "sgtour-actions";

    skipBtn = document.createElement("button");
    skipBtn.type = "button";
    skipBtn.className = "sgtour-skip";
    skipBtn.textContent = "Skip for now";
    skipBtn.addEventListener("click", function () { endTour(true); });

    nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "sgtour-next";
    nextBtn.textContent = "Next";
    nextBtn.addEventListener("click", function () { goNext(); });

    actions.appendChild(skipBtn);
    actions.appendChild(nextBtn);

    bodyEl.appendChild(titleEl);
    bodyEl.appendChild(lineEl);
    bodyEl.appendChild(dotsEl);
    bodyEl.appendChild(actions);

    card.appendChild(arrowEl);
    card.appendChild(avEl);
    card.appendChild(bodyEl);

    root.appendChild(backdrop);
    root.appendChild(spot);
    root.appendChild(card);
    document.body.appendChild(root);

    // keyboard handling (focus trap + shortcuts)
    root.addEventListener("keydown", onKey);
    // re-place on resize/scroll while active
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
  }

  /* ---------- state ---------- */
  var steps = [], idx = 0, active = false, uid = null;
  var spotStepIndexes = []; // indexes of spotlight steps, for the dots

  /* ---------- show / hide ---------- */
  function startTour(theUid) {
    ensureDom();
    uid = theUid || uid;
    steps = buildSteps();
    spotStepIndexes = steps.map(function (s, i) { return s.centered ? -1 : i; })
                           .filter(function (i) { return i >= 0; });
    idx = 0;
    active = true;
    root.classList.add("show");
    root.setAttribute("aria-hidden", "false");
    avEl.textContent = companion().emo;
    document.documentElement.style.overflow = "hidden"; // prevent body scroll under overlay
    render();
  }

  function hide() {
    active = false;
    if (!root) return;
    root.classList.remove("show", "centered", "spot");
    root.setAttribute("aria-hidden", "true");
    document.documentElement.style.overflow = "";
  }

  /* advance, auto-skipping any spotlight step whose target is missing */
  function goNext() {
    if (idx >= steps.length - 1) { endTour(false); return; }
    idx++;
    render();
  }

  function render() {
    var step = steps[idx];

    // resolve target (centered steps have none)
    var el = null;
    if (!step.centered && step.target) {
      el = document.querySelector(step.target);
      // graceful degrade: skip steps whose target is absent / not visible
      if (!el || !isVisible(el)) {
        if (idx >= steps.length - 1) { endTour(false); return; }
        idx++;
        return render();
      }
    }

    // content
    titleEl.style.display = step.title ? "block" : "none";
    if (step.title) titleEl.textContent = step.title;
    lineEl.textContent = step.line;
    nextBtn.textContent = step.cta || "Next";
    // final step has no skip (finishing and skipping are equivalent anyway)
    skipBtn.style.display = (idx === steps.length - 1) ? "none" : "";

    // dots (only meaningful for spotlight steps)
    renderDots();

    // mode
    if (step.centered) {
      root.classList.add("centered");
      root.classList.remove("spot");
      spot.style.opacity = "0";
      // centered card is positioned purely by CSS
    } else {
      root.classList.remove("centered");
      root.classList.add("spot");
      placeSpotlight(el);
    }

    // chime + focus
    chime();
    // move focus into the dialog for keyboard users
    setTimeout(function () { try { nextBtn.focus(); } catch (e) {} }, 60);
  }

  function renderDots() {
    var n = spotStepIndexes.length;
    var pos = spotStepIndexes.indexOf(idx); // -1 on centered steps
    var html = "";
    for (var i = 0; i < n; i++) {
      html += '<span class="sgtour-dot' + (i === pos ? " on" : "") + '"></span>';
    }
    dotsEl.innerHTML = html;
    dotsEl.style.visibility = (pos === -1) ? "hidden" : "visible";
  }

  function isVisible(el) {
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var cs = window.getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden";
  }

  /* position the spotlight hole + the card near the target */
  function placeSpotlight(el) {
    if (!el) return;
    // bring target into view first (helps long Home screen on small phones)
    try { el.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" }); } catch (e) {}
    // measure after the scroll settles
    setTimeout(function () { positionFor(el); }, reduceMotion() ? 0 : 260);
  }

  function positionFor(el) {
    var r = el.getBoundingClientRect();
    var pad = 8;
    var top = Math.max(6, r.top - pad);
    var left = Math.max(6, r.left - pad);
    var w = Math.min(window.innerWidth - 12, r.width + pad * 2);
    var h = r.height + pad * 2;
    spot.style.top = top + "px";
    spot.style.left = left + "px";
    spot.style.width = w + "px";
    spot.style.height = h + "px";

    // place the card above or below the target depending on room
    var margin = 14;
    var cardH = card.offsetHeight || 150;
    var cardW = Math.min(340, window.innerWidth - 32);
    var spaceBelow = window.innerHeight - r.bottom;
    var below = spaceBelow > (cardH + margin + 20);

    var cTop = below ? (r.bottom + margin) : (r.top - cardH - margin);
    cTop = Math.max(10, Math.min(cTop, window.innerHeight - cardH - 10));

    // horizontally centre on target, clamped to viewport
    var cLeft = r.left + r.width / 2 - cardW / 2;
    cLeft = Math.max(16, Math.min(cLeft, window.innerWidth - cardW - 16));

    card.style.top = cTop + "px";
    card.style.left = cLeft + "px";
    card.classList.toggle("below", below);
    card.classList.toggle("above", !below);

    // arrow points at the target
    var arrowX = (r.left + r.width / 2) - cLeft - 7;
    arrowX = Math.max(16, Math.min(arrowX, cardW - 28));
    arrowEl.style.left = arrowX + "px";
  }

  function reposition() {
    if (!active) return;
    var step = steps[idx];
    if (!step || step.centered || !step.target) return;
    var el = document.querySelector(step.target);
    if (el && isVisible(el)) positionFor(el);
  }

  /* ---------- finish / skip => persist flag (both paths) ---------- */
  async function endTour(skipped) {
    hide();
    var theUid = uid || (await currentUid());
    if (theUid) {
      try { localStorage.setItem("sgtour_done_" + theUid, "1"); } catch (e) {}
      var s = appSb();
      if (s) {
        try { await s.from("profiles").update({ tour_completed: true }).eq("id", theUid); }
        catch (e) { /* localStorage fallback already set */ }
      }
    }
  }

  /* ---------- keyboard: trap focus + shortcuts ---------- */
  function onKey(e) {
    if (!active) return;
    if (e.key === "Escape") { e.preventDefault(); endTour(true); return; }
    if (e.key === "Enter" || e.key === "ArrowRight") {
      if (document.activeElement !== skipBtn) { e.preventDefault(); goNext(); }
      return;
    }
    if (e.key === "Tab") {
      // simple two-button focus trap
      var focusables = [skipBtn, nextBtn].filter(function (b) { return b.style.display !== "none"; });
      var first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  /* ---------- first-visit decision ---------- */
  var checkedThisSession = false;
  async function maybeStartTour() {
    if (active || checkedThisSession) return;
    var theUid = await currentUid();
    if (!theUid) return;
    checkedThisSession = true;
    // localStorage fast-path
    try { if (localStorage.getItem("sgtour_done_" + theUid) === "1") return; } catch (e) {}
    // Supabase source of truth
    var done = false;
    var s = appSb();
    if (s) {
      try {
        var res = await s.from("profiles").select("tour_completed").eq("id", theUid).maybeSingle();
        if (res && res.data && res.data.tour_completed === true) done = true;
      } catch (e) { /* column missing or offline -> rely on localStorage */ }
    }
    if (done) { try { localStorage.setItem("sgtour_done_" + theUid, "1"); } catch (e) {} return; }
    // let Home finish painting, then begin
    setTimeout(function () { startTour(theUid); }, 450);
  }

  /* ---------- replay (resets the flag, relaunches) ---------- */
  async function replayTour() {
    var theUid = await currentUid();
    if (!theUid) return;
    try { localStorage.removeItem("sgtour_done_" + theUid); } catch (e) {}
    var s = appSb();
    if (s) { try { await s.from("profiles").update({ tour_completed: false }).eq("id", theUid); } catch (e) {} }
    checkedThisSession = true; // don't let auto-trigger double up
    if (typeof nav === "function") { try { nav("home"); } catch (e) {} }
    setTimeout(function () { startTour(theUid); }, 500);
  }

  function injectReplayButton() {
    var body = document.getElementById("profile-body");
    if (!body || body.querySelector("#sgtour-replay")) return;
    var btn = document.createElement("button");
    btn.id = "sgtour-replay";
    btn.type = "button";
    btn.className = "btn secondary sgtour-replay-btn"; // reuses the app's button style
    btn.textContent = "🌱 Replay welcome tour";
    btn.addEventListener("click", replayTour);
    var foot = body.querySelector(".foot-note");
    if (foot) body.insertBefore(btn, foot); else body.appendChild(btn);
  }

  /* ---------- wire into the app by WRAPPING globals (never editing) ---------- */
  function install() {
    // 1) start the tour after the user lands in the app
    if (typeof window.enterApp === "function") {
      var _enterApp = window.enterApp;
      window.enterApp = function () {
        var out = _enterApp.apply(this, arguments);
        try { maybeStartTour(); } catch (e) {}
        return out;
      };
    }
    // 2) add the replay entry every time Profile renders
    if (typeof window.renderProfile === "function") {
      var _renderProfile = window.renderProfile;
      window.renderProfile = function () {
        var out = _renderProfile.apply(this, arguments);
        try { injectReplayButton(); } catch (e) {}
        return out;
      };
    }
    // expose for manual/debug use
    window.SoulTour = { start: function () { currentUid().then(startTour); }, replay: replayTour, _maybe: maybeStartTour };
  }

  // This script is included right before </body>, after the app's inline
  // script has defined its globals, so they're available synchronously.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();
