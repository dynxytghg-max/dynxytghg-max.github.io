/*
 * Webseite 2.0: gemeinsame Helfer für „Mein Bereich“ (konto/) und Spieler-Profile (spieler/).
 * Anmeldung wie auf der Startseite (Sitzung in localStorage, über den Launcher bestätigt).
 */
window.RC = (() => {
  // Lokal (ohne build.py) gegen den Testserver
  const SERVER = String(window.RC_SERVER).startsWith("__") ? "http://127.0.0.1:8798" : window.RC_SERVER;
  const KEY = "bambubay.web.session";

  const session = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "null");
    } catch {
      return null;
    }
  };
  const dropSession = () => {
    try {
      localStorage.removeItem(KEY);
    } catch {}
  };

  async function call(path, body) {
    const res = await fetch(SERVER + path, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(body || {}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || "HTTP " + res.status), { status: res.status });
    return data;
  }

  /** RustGram-Bild als Blob holen (POST mit Token) */
  async function postImage(token, id) {
    const res = await fetch(SERVER + "/v1/web/post-image", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ token, id }) });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return URL.createObjectURL(await res.blob());
  }

  /** Pfad vom Server (z. B. /v1/capes/image?id=…) zu voller Adresse */
  const abs = (u) => (u && u.startsWith("/") ? SERVER + u : u);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const head = (uuidOrName, size = 64) => "https://mc-heads.net/avatar/" + encodeURIComponent(uuidOrName) + "/" + size;
  const skinUrl = (uuid) => "https://mc-heads.net/skin/" + encodeURIComponent(uuid);

  function ago(ms) {
    if (!ms) return "";
    const s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 90) return "gerade eben";
    if (s < 3600) return `vor ${Math.round(s / 60)} Min.`;
    if (s < 86400) return `vor ${Math.round(s / 3600)} Std.`;
    const d = Math.round(s / 86400);
    return d === 1 ? "gestern" : d < 30 ? `vor ${d} Tagen` : new Date(ms).toLocaleDateString("de-DE");
  }
  function hours(sec) {
    const h = (sec || 0) / 3600;
    return h >= 10 ? Math.round(h) + " Std." : h >= 1 ? h.toFixed(1).replace(".", ",") + " Std." : Math.round((sec || 0) / 60) + " Min.";
  }
  function km(blocks) {
    const k = (blocks || 0) / 1000;
    return k >= 10 ? Math.round(k) + " km" : k.toFixed(1).replace(".", ",") + " km";
  }

  /** Zahl hochzählen (sieht lebendig aus) */
  function countUp(el, to, suffix = "") {
    const start = performance.now();
    const dur = 900;
    const step = (now) => {
      const k = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString("de-DE") + suffix;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  let toastTimer = 0;
  function toast(text, error = false) {
    let el = document.getElementById("rc-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "rc-toast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.toggle("err", !!error);
    requestAnimationFrame(() => el.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3600);
  }

  /** Vorderseite eines Capes (Minecraft-Format 64x32 oder größer) auf ein Canvas */
  function capeFront(url) {
    const c = document.createElement("canvas");
    c.width = 10;
    c.height = 16;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const k = img.width / 64;
      c.width = Math.round(10 * k);
      c.height = Math.round(16 * k);
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, Math.round(1 * k), Math.round(1 * k), c.width, c.height, 0, 0, c.width, c.height);
    };
    img.src = abs(url);
    return c;
  }

  /** 3D-Figur mit Skin (und Cape), dreht sich langsam, lässt sich mit der Maus drehen */
  function figure(container, uuid, capeUrl) {
    if (!window.skinview3d) return null;
    const w = container.clientWidth || 300, h = container.clientHeight || 340;
    const v = new skinview3d.SkinViewer({ width: w, height: h, skin: skinUrl(uuid) });
    container.appendChild(v.canvas);
    v.fov = 40;
    v.zoom = 0.82;
    v.camera.position.y += 2;
    v.autoRotate = true;
    v.autoRotateSpeed = 0.6;
    v.animation = new skinview3d.IdleAnimation();
    v.nameTag = null;
    if (capeUrl) v.loadCape(abs(capeUrl)).catch(() => {});
    // Kurz winken zur Begrüßung
    setTimeout(() => {
      try {
        const wave = new skinview3d.WaveAnimation();
        v.animation = wave;
        setTimeout(() => (v.animation = new skinview3d.IdleAnimation()), 2200);
      } catch {}
    }, 700);
    new ResizeObserver(() => v.setSize(container.clientWidth, container.clientHeight)).observe(container);
    return v;
  }

  /** Reiter mit gleitendem Balken */
  function tabs(nav, onChange) {
    const bar = document.createElement("span");
    bar.className = "bar";
    nav.appendChild(bar);
    const buttons = [...nav.querySelectorAll("button[data-tab]")];
    const select = (name, push = true) => {
      const b = buttons.find((x) => x.dataset.tab === name) || buttons[0];
      buttons.forEach((x) => x.classList.toggle("on", x === b));
      bar.style.left = b.offsetLeft + "px";
      bar.style.width = b.offsetWidth + "px";
      if (push) history.replaceState(null, "", "#" + b.dataset.tab);
      onChange(b.dataset.tab);
    };
    buttons.forEach((b) => (b.onclick = () => select(b.dataset.tab)));
    window.addEventListener("resize", () => {
      const on = buttons.find((x) => x.classList.contains("on"));
      if (on) {
        bar.style.left = on.offsetLeft + "px";
        bar.style.width = on.offsetWidth + "px";
      }
    });
    return select;
  }

  return { SERVER, abs, session, dropSession, call, postImage, esc, head, skinUrl, ago, hours, km, countUp, toast, capeFront, figure, tabs };
})();
