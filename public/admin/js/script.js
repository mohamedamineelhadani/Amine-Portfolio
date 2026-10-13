const $ = (s) => document.querySelector(s);
const el = (t, c, txt) => {
  const e = document.createElement(t);
  if (c) e.className = c;
  if (txt != null) e.textContent = txt;
  return e;
};
const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
const api = async (url, opt = {}) => {
  const r = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...opt,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j.error || "Request failed");
    e.status = r.status;
    throw e;
  }
  return j;
};
let items = [],
  sel = null,
  tab = "all",
  st = {};
const hue = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const initials = (n) =>
  n
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";
const ago = (d) => {
  const s = (Date.now() - new Date(d)) / 1e3;
  if (s < 60) return "now";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  if (s < 604800) return Math.floor(s / 86400) + "d";
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};
const avatar = (n) => {
  const a = el("div", "av", initials(n));
  a.style.background = `linear-gradient(135deg,hsl(${hue(n)} 70% 52%),hsl(${(hue(n) + 40) % 360} 70% 42%))`;
  return a;
};
function toast(t) {
  const e = $("#toast");
  e.textContent = t;
  e.classList.add("on");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => e.classList.remove("on"), 2200);
}
function show(ok) {
  $("#login").hidden = ok;
  $("#app").hidden = !ok;
  if (ok) load();
}

$("#loginForm").onsubmit = async (e) => {
  e.preventDefault();
  $("#err").textContent = "";
  try {
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        email: $("#email").value,
        password: $("#pw").value,
      }),
    });
    $("#pw").value = "";
    show(true);
  } catch (x) {
    $("#err").textContent = x.message;
  }
};
$("#out").onclick = async () => {
  await api("/api/admin/logout", { method: "POST" });
  show(false);
};
let t;
$("#q").oninput = () => {
  clearTimeout(t);
  t = setTimeout(load, 250);
};
document.querySelectorAll(".tabs button").forEach(
  (b) =>
    (b.onclick = () => {
      tab = b.dataset.t;
      document
        .querySelectorAll(".tabs button")
        .forEach((x) => x.setAttribute("aria-selected", x === b));
      load();
    }),
);

async function load() {
  try {
    const r = await api(
      "/api/admin/messages?q=" +
        encodeURIComponent($("#q").value) +
        (tab === "unread" ? "&status=unread" : ""),
    );
    items = r.items;
    st = r;
    draw();
  } catch (x) {
    x.status === 401 ? show(false) : toast(x.message);
  }
}
function draw() {
  $("#sTotal").textContent = st.total;
  $("#sUnread").textContent = st.unread;
  $("#sWeek").textContent = st.week;
  $("#sToday").textContent = st.today;
  const box = $("#list");
  box.replaceChildren();
  if (!items.length) {
    const e = el("div", "empty");
    e.innerHTML = ICON;
    e.append(
      el(
        "p",
        null,
        tab === "unread" ? "You are all caught up." : "No messages yet.",
      ),
    );
    box.append(e);
  }
  items.forEach((m) => {
    const b = el(
      "button",
      "row" + (m.read ? "" : " unread") + (m._id === sel ? " active" : ""),
    );
    b.type = "button";
    const meta = el("div", "meta"),
      l1 = el("div", "l1");
    l1.append(el("strong", null, m.name), el("time", null, ago(m.createdAt)));
    meta.append(l1, el("p", null, m.message.replace(/\s+/g, " ")));
    b.append(avatar(m.name), meta);
    b.onclick = () => pick(m._id);
    box.append(b);
  });
  detail();
}
async function pick(id) {
  sel = id;
  $("#inbox").classList.add("open");
  const m = items.find((x) => x._id === id);
  if (m && !m.read) {
    m.read = true;
    st.unread = Math.max(0, st.unread - 1);
    api("/api/admin/messages/" + id, {
      method: "PATCH",
      body: JSON.stringify({ read: true }),
    }).catch(() => {});
  }
  draw();
}
function detail() {
  const d = $("#detail");
  d.replaceChildren();
  const m = items.find((x) => x._id === sel);
  if (!m) {
    const e = el("div", "empty");
    e.innerHTML = ICON;
    e.append(el("p", null, "Select a message to read it."));
    d.append(e);
    return;
  }
  const back = el("button", "btn back", "Back to inbox");
  back.onclick = () => {
    $("#inbox").classList.remove("open");
  };
  const h = el("div", "dh"),
    who = el("div");
  const a = el("a", null, m.email);
  a.href = "mailto:" + m.email;
  who.append(
    el("h2", null, m.name),
    a,
    el(
      "div",
      "when",
      new Date(m.createdAt).toLocaleString(undefined, {
        dateStyle: "full",
        timeStyle: "short",
      }),
    ),
  );
  h.append(avatar(m.name), who);
  const acts = el("div", "acts");
  const reply = el("a", "btn p", "Reply by email");
  reply.href =
    "mailto:" + m.email + "?subject=" + encodeURIComponent("Re: your message");
  reply.style.textDecoration = "none";
  const copy = el("button", "btn", "Copy email");
  copy.onclick = () =>
    navigator.clipboard.writeText(m.email).then(() => toast("Email copied"));
  const unread = el("button", "btn", "Mark unread");
  unread.onclick = async () => {
    await api("/api/admin/messages/" + m._id, {
      method: "PATCH",
      body: JSON.stringify({ read: false }),
    });
    sel = null;
    $("#inbox").classList.remove("open");
    toast("Marked as unread");
    load();
  };
  const del = el("button", "btn bad", "Delete");
  del.onclick = async () => {
    if (!del.classList.contains("arm")) {
      del.classList.add("arm");
      del.textContent = "Click again to confirm";
      setTimeout(() => {
        del.classList.remove("arm");
        del.textContent = "Delete";
      }, 3000);
      return;
    }
    await api("/api/admin/messages/" + m._id, { method: "DELETE" });
    sel = null;
    $("#inbox").classList.remove("open");
    toast("Message deleted");
    load();
  };
  acts.append(reply, copy, unread, del);
  d.append(back, h, el("div", "body", m.message), acts);
}
api("/api/admin/me")
  .then(() => show(true))
  .catch(() => show(false));
