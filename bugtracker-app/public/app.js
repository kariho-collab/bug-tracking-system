/* Bug Tracker — interface behaviour. Vanilla JS, no dependencies.
   Every enhancement degrades gracefully: with scripts off, the pages still work. */
(function () {
  "use strict";

  var doc = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- Toasts ---------- */
  var ICONS = {
    success: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    info: '<svg viewBox="0 0 24 24"><path d="M12 11v6M12 7.5v.01"/></svg>',
    warn: '<svg viewBox="0 0 24 24"><path d="M12 7v6M12 17v.01"/></svg>'
  };
  var MESSAGES = {
    welcome: ["success", "Signed in", "You are in. Pick up where you left off."],
    created: ["success", "Bug reported", "It is open and ready to be picked up."],
    status: ["success", "Status updated", "The change is saved in the activity log."],
    assigned: ["success", "Assignment saved", "The assignee has been updated."],
    commented: ["success", "Comment added", "Your note is in the activity log."],
    user_added: ["success", "User added", "They can sign in right away."],
    user_exists: ["warn", "Email already in use", "Use a different email address for this user."],
    role_updated: ["success", "Role updated", "The new permissions apply on their next page load."],
    user_removed: ["success", "User removed", "That account no longer has access."]
  };

  function toast(kind, title, text) {
    var region = $("#toasts");
    if (!region) return;
    var t = document.createElement("div");
    t.className = "toast t-" + (kind === "success" ? "ok" : kind);
    t.setAttribute("role", "status");
    var icon = document.createElement("div");
    icon.className = "toast-icon";
    icon.innerHTML = ICONS[kind] || ICONS.info;
    var body = document.createElement("div");
    var strong = document.createElement("strong");
    strong.textContent = title;
    var span = document.createElement("span");
    span.textContent = text;
    body.appendChild(strong);
    body.appendChild(span);
    var close = document.createElement("button");
    close.type = "button";
    close.className = "toast-close";
    close.setAttribute("aria-label", "Dismiss notification");
    close.innerHTML = "&times;";
    t.appendChild(icon);
    t.appendChild(body);
    t.appendChild(close);
    region.appendChild(t);

    var timer;
    function dismiss() {
      clearTimeout(timer);
      t.classList.remove("is-in");
      t.classList.add("is-out");
      setTimeout(function () { t.remove(); }, reduceMotion ? 0 : 420);
    }
    function arm() { timer = setTimeout(dismiss, 5200); }
    close.addEventListener("click", dismiss);
    t.addEventListener("pointerenter", function () { clearTimeout(timer); });
    t.addEventListener("pointerleave", arm);
    requestAnimationFrame(function () { requestAnimationFrame(function () { t.classList.add("is-in"); }); });
    arm();
  }
  window.btToast = toast;

  (function fromUrl() {
    var params = new URLSearchParams(location.search);
    var key = params.get("toast");
    if (!key || !MESSAGES[key]) return;
    doc.setAttribute("data-toast", key);
    var m = MESSAGES[key];
    setTimeout(function () { toast(m[0], m[1], m[2]); }, 380);
    params.delete("toast");
    var qs = params.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
  })();

  /* ---------- Count-up metrics and in-view reveals ---------- */
  function fmt(value, decimals) { return value.toFixed(decimals); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function prime(el) {
    var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var target = parseFloat(el.getAttribute("data-count"));
    var suffix = el.getAttribute("data-suffix") || "";
    el._count = { decimals: decimals, target: target, suffix: suffix };
    el.textContent = reduceMotion ? fmt(target, decimals) + suffix : fmt(0, decimals) + suffix;
    el.classList.add("is-ready");
  }
  function run(el) {
    var c = el._count;
    if (!c || reduceMotion) return;
    var start = performance.now();
    var duration = 1100;
    (function frame(now) {
      var p = Math.min(1, (now - start) / duration);
      el.textContent = fmt(c.target * easeOut(p), c.decimals) + c.suffix;
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = fmt(c.target, c.decimals) + c.suffix;
    })(start);
  }

  var counters = $$("[data-count]");
  counters.forEach(prime);
  var revealTargets = $$("[data-inview]").concat(counters);
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        if (entry.target.hasAttribute("data-count")) run(entry.target);
        else entry.target.classList.add("in-view");
      });
    }, { threshold: 0.2 });
    revealTargets.forEach(function (el) { io.observe(el); });
  } else {
    revealTargets.forEach(function (el) {
      if (el.hasAttribute("data-count")) run(el);
      else el.classList.add("in-view");
    });
  }

  /* ---------- Card spotlight that follows the pointer ---------- */
  if (!reduceMotion && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    var raf = 0, last = null;
    document.addEventListener("pointermove", function (e) {
      var card = e.target.closest ? e.target.closest(".card") : null;
      if (!card) return;
      last = { card: card, x: e.clientX, y: e.clientY };
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        var r = last.card.getBoundingClientRect();
        last.card.style.setProperty("--mx", last.x - r.left + "px");
        last.card.style.setProperty("--my", last.y - r.top + "px");
      });
    }, { passive: true });
  }

  /* ---------- Sidebar: collapse, mobile drawer, sliding indicator ---------- */
  var nav = $(".nav");
  var indicator = $(".nav-indicator");
  var links = nav ? $$(".nav-link", nav) : [];
  var activeLink = nav ? $(".nav-link.active", nav) : null;

  function place(el) {
    if (!indicator) return;
    if (!el) { indicator.style.opacity = "0"; return; }
    indicator.style.opacity = "1";
    indicator.style.height = el.offsetHeight + "px";
    indicator.style.transform = "translateY(" + el.offsetTop + "px)";
  }
  if (nav && indicator) {
    place(activeLink);
    requestAnimationFrame(function () { requestAnimationFrame(function () { doc.classList.add("nav-ready"); }); });
    links.forEach(function (a) {
      a.addEventListener("pointerenter", function () { place(a); });
      a.addEventListener("focus", function () { place(a); });
    });
    nav.addEventListener("pointerleave", function () { place(activeLink); });
    nav.addEventListener("focusout", function () { place(activeLink); });
    window.addEventListener("resize", function () { place(activeLink); });
  }

  var collapseBtn = $("#collapseBtn");
  function syncTitles() {
    var collapsed = doc.classList.contains("nav-collapsed");
    links.forEach(function (a) {
      var label = $(".nav-label", a);
      if (collapsed && label) a.setAttribute("title", label.textContent.trim());
      else a.removeAttribute("title");
    });
    if (collapseBtn) {
      collapseBtn.setAttribute("aria-expanded", String(!collapsed));
      collapseBtn.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
    }
  }
  syncTitles();
  if (collapseBtn) {
    collapseBtn.addEventListener("click", function () {
      doc.classList.toggle("nav-collapsed");
      try { localStorage.setItem("bt.nav", doc.classList.contains("nav-collapsed") ? "collapsed" : "expanded"); } catch (e) {}
      syncTitles();
    });
  }

  var menuBtn = $("#menuBtn");
  var scrim = $("#scrim");
  function setDrawer(open) {
    doc.classList.toggle("nav-open", open);
    if (menuBtn) menuBtn.setAttribute("aria-expanded", String(open));
    if (open && links[0]) setTimeout(function () { links[0].focus(); }, 60);
    if (!open && menuBtn && document.activeElement && document.activeElement.closest(".sidebar")) menuBtn.focus();
  }
  if (menuBtn) menuBtn.addEventListener("click", function () { setDrawer(!doc.classList.contains("nav-open")); });
  if (scrim) scrim.addEventListener("click", function () { setDrawer(false); });
  links.forEach(function (a) { a.addEventListener("click", function () { setDrawer(false); }); });
  window.addEventListener("resize", function () { if (window.innerWidth > 860) doc.classList.remove("nav-open"); });

  /* ---------- Account menu ---------- */
  var chip = $("#userChip");
  var menu = $("#userMenu");
  function setMenu(open) {
    if (!chip || !menu) return;
    menu.classList.toggle("is-open", open);
    chip.setAttribute("aria-expanded", String(open));
  }
  if (chip && menu) {
    chip.addEventListener("click", function (e) { e.stopPropagation(); setMenu(!menu.classList.contains("is-open")); });
    document.addEventListener("click", function (e) { if (!menu.contains(e.target)) setMenu(false); });
  }

  /* ---------- Expandable panels ---------- */
  $$("[data-collapsible]").forEach(function (panel) {
    var head = $(".collapsible-head", panel);
    var inner = $(".collapsible-inner", panel);
    if (!head || !inner) return;
    function sync() {
      var open = panel.classList.contains("is-open");
      head.setAttribute("aria-expanded", String(open));
      if (open) inner.removeAttribute("inert"); else inner.setAttribute("inert", "");
    }
    head.addEventListener("click", function () { panel.classList.toggle("is-open"); sync(); });
    sync();
  });

  /* ---------- Tooltips for charts ---------- */
  var tip = document.createElement("div");
  tip.className = "tip";
  tip.setAttribute("role", "tooltip");
  document.body.appendChild(tip);
  function showTip(target, x, y) {
    tip.textContent = "";
    var title = target.getAttribute("data-tip-title");
    if (title) { var b = document.createElement("b"); b.textContent = title; tip.appendChild(b); tip.appendChild(document.createElement("br")); }
    tip.appendChild(document.createTextNode(target.getAttribute("data-tip") || ""));
    tip.classList.add("is-on");
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = Math.min(Math.max(8, x - w / 2), window.innerWidth - w - 8);
    var top = y - h - 14;
    if (top < 8) top = y + 18;
    tip.style.transform = "translate3d(" + left + "px," + top + "px,0)";
  }
  function hideTip() { tip.classList.remove("is-on"); }
  document.addEventListener("pointermove", function (e) {
    var t = e.target.closest ? e.target.closest("[data-tip]") : null;
    if (t) showTip(t, e.clientX, e.clientY); else hideTip();
  }, { passive: true });
  document.addEventListener("focusin", function (e) {
    var t = e.target.closest ? e.target.closest("[data-tip]") : null;
    if (!t) return;
    var r = t.getBoundingClientRect();
    showTip(t, r.left + r.width / 2, r.top);
  });
  document.addEventListener("focusout", hideTip);
  window.addEventListener("scroll", hideTip, { passive: true });

  /* ---------- Whole-row navigation in tables ---------- */
  document.addEventListener("click", function (e) {
    var row = e.target.closest ? e.target.closest("tr[data-href]") : null;
    if (!row || e.target.closest("a, button, select, input, textarea, form")) return;
    if (window.getSelection && String(window.getSelection())) return;
    location.href = row.getAttribute("data-href");
  });

  /* ---------- Confirmation modal ---------- */
  var dlg = $("#confirmDialog");
  var pending = null;
  function openConfirm(form, submitter) {
    pending = { form: form, submitter: submitter };
    $("#confirmTitle").textContent = form.getAttribute("data-confirm-title") || "Are you sure?";
    $("#confirmText").textContent = form.getAttribute("data-confirm") || "";
    $("#confirmOk").textContent = form.getAttribute("data-confirm-label") || "Confirm";
    dlg.showModal();
    requestAnimationFrame(function () { requestAnimationFrame(function () { dlg.classList.add("is-in"); }); });
    $("#confirmCancel").focus();
  }
  function closeConfirm(then) {
    dlg.classList.remove("is-in");
    setTimeout(function () { if (dlg.open) dlg.close(); if (then) then(); }, reduceMotion ? 0 : 280);
  }
  if (dlg && typeof dlg.showModal === "function") {
    $("#confirmCancel").addEventListener("click", function () { pending = null; closeConfirm(); });
    $("#confirmOk").addEventListener("click", function () {
      var p = pending; pending = null;
      closeConfirm(function () {
        if (!p) return;
        p.form.setAttribute("data-confirmed", "1");
        if (p.form.requestSubmit) p.form.requestSubmit(p.submitter || undefined); else p.form.submit();
      });
    });
    dlg.addEventListener("cancel", function (e) { e.preventDefault(); pending = null; closeConfirm(); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) { pending = null; closeConfirm(); } });
  }

  /* ---------- Form submissions: confirmation, loading state ---------- */
  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.hasAttribute("data-confirm") && form.getAttribute("data-confirmed") !== "1" && dlg && typeof dlg.showModal === "function") {
      e.preventDefault();
      openConfirm(form, e.submitter);
      return;
    }
    if (form.getAttribute("data-submitting") === "1") { e.preventDefault(); return; }
    form.setAttribute("data-submitting", "1");
    var btn = e.submitter || $("button[type=submit], button:not([type])", form);
    if (btn) { btn.classList.add("is-loading"); btn.setAttribute("aria-busy", "true"); }
  });
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    $$("form[data-submitting]").forEach(function (f) { f.removeAttribute("data-submitting"); f.removeAttribute("data-confirmed"); });
    $$(".btn.is-loading").forEach(function (b) { b.classList.remove("is-loading"); b.removeAttribute("aria-busy"); });
  });

  /* ---------- Escape closes menus and the drawer ---------- */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (menu && menu.classList.contains("is-open")) { setMenu(false); if (chip) chip.focus(); }
    if (doc.classList.contains("nav-open")) setDrawer(false);
  });
})();
