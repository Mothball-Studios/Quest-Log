/**
 * Quest Log — unified whole-view overlay shell (0.6.51, shell-only first pass).
 *
 * ONE overlay element that sits on top of the main Quest Log UI and hosts several
 * "states" (panels). A state is just an existing panel element plus show/hide hooks;
 * the shell does NOT render or alter panel content — it only mounts the panel element
 * into its stage, shows exactly one state at a time, and closes cleanly.
 *
 * DOM:  host > .ql-shell[.open][data-ql-state] > .ql-shell-stage > <panel elements>
 * (the stage is position:absolute; inset:0, so absolutely-positioned panels lay out
 *  exactly as they did when they were direct children of the Quest Log container).
 *
 * API (createOverlayShell(hostEl, opts) → shell):
 *   registerState(id, { label, el, show(ctx), hide(ctx) }) → shell
 *       el   : panel element (moved into the stage; left as-is otherwise)
 *       show : called on enter (make the panel visible / (re)render its content)
 *       hide : called on leave (hide the panel again)
 *   has(id) / states()            registered ids
 *   open(id)  → boolean           show state `id` (switches if already open). false if unknown.
 *   switchTo(id)                  alias of open(id)
 *   close()   → boolean           hide current state + shell. false if already closed.
 *   isOpen() / current()          open flag / current state id (null when closed)
 *   destroy()                     close, remove key listener + observer, detach shell
 *   el, stage                     DOM nodes
 * opts: { onOpen(id, prevId), onClose(prevId), canEscClose() → bool (return false to ignore Esc, e.g. a popup is on top) }
 *
 * Close paths: shell.close(), Esc key (while open), or the hosted panel hiding itself
 * (its own Back button / tab navigation sets style.display = "none" → shell closes too).
 */
"use strict";

function createOverlayShell(hostEl, opts) {
  const options = opts || {};
  const doc = hostEl.ownerDocument || document;
  const el = doc.createElement("div");
  el.className = "ql-shell";
  const stage = doc.createElement("div");
  stage.className = "ql-shell-stage";
  el.appendChild(stage);
  hostEl.appendChild(el);

  const registry = new Map();
  let currentId = null;
  let open = false;
  let observer = null;

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  // Panel hid itself (its own Back button etc.) → close the shell without fighting it.
  function watchPanel(id, panelEl) {
    stopObserver();
    if (!panelEl || typeof MutationObserver === "undefined") return;
    observer = new MutationObserver(() => {
      if (open && currentId === id && panelEl.style.display === "none") shell.close();
    });
    observer.observe(panelEl, { attributes: true, attributeFilter: ["style"] });
  }

  function onKeyDown(e) {
    if (open && e.key === "Escape") {
      if (typeof options.canEscClose === "function" && !options.canEscClose()) return;
      e.stopPropagation();
      shell.close();
    }
  }

  function leave() {
    stopObserver();
    const st = registry.get(currentId);
    if (st && typeof st.hide === "function") st.hide({ shell });
  }

  const shell = {
    el,
    stage,
    registerState(id, def) {
      const d = def || {};
      registry.set(id, { id, label: d.label || id, el: d.el || null, show: d.show, hide: d.hide });
      if (d.el && d.el.parentNode !== stage) stage.appendChild(d.el);
      return shell;
    },
    has(id) {
      return registry.has(id);
    },
    states() {
      return Array.from(registry.keys());
    },
    open(id) {
      const st = registry.get(id);
      if (!st) return false;
      const prev = open ? currentId : null;
      if (open && currentId !== id) leave();
      currentId = id;
      el.setAttribute("data-ql-state", id);
      el.classList.add("open");
      if (!open) doc.addEventListener("keydown", onKeyDown, true);
      open = true;
      if (typeof st.show === "function") st.show({ shell });
      watchPanel(id, st.el);
      if (typeof options.onOpen === "function") options.onOpen(id, prev);
      return true;
    },
    switchTo(id) {
      return shell.open(id);
    },
    close() {
      if (!open) return false;
      const prev = currentId;
      leave();
      open = false;
      currentId = null;
      el.classList.remove("open");
      el.removeAttribute("data-ql-state");
      doc.removeEventListener("keydown", onKeyDown, true);
      if (typeof options.onClose === "function") options.onClose(prev);
      return true;
    },
    isOpen() {
      return open;
    },
    current() {
      return open ? currentId : null;
    },
    destroy() {
      if (open) shell.close();
      stopObserver();
      doc.removeEventListener("keydown", onKeyDown, true);
      registry.clear();
      if (el.parentNode) el.parentNode.removeChild(el);
    },
  };
  return shell;
}

module.exports = { createOverlayShell };
