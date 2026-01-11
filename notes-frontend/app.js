// === Konfiguration ===
// Setze hier deine Backend-URL (auf VPS später z.B. https://api.deinedomain.tld)
const API_BASE = "http://localhost:8080/api";

const state = {
  token: localStorage.getItem("token") || null,
  user: JSON.parse(localStorage.getItem("user") || "null"),
  notes: [],
  activeNoteId: null
};

const el = (id) => document.getElementById(id);

const authView = el("authView");
const appView = el("appView");
const authMsg = el("authMsg");
const appMsg = el("appMsg");
const userEmail = el("userEmail");
const logoutBtn = el("logoutBtn");

const notesList = el("notesList");
const newNoteBtn = el("newNoteBtn");

const noteForm = el("noteForm");
const noteTitle = el("noteTitle");
const noteContent = el("noteContent");
const deleteBtn = el("deleteBtn");
const noteMeta = el("noteMeta");

function setMessage(target, msg) {
  target.textContent = msg || "";
}

function setAuth(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
  render();
}

function clearAuth() {
  state.token = null;
  state.user = null;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  state.notes = [];
  state.activeNoteId = null;
  render();
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// ===== Auth =====
el("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setMessage(authMsg, "");
  const form = new FormData(e.target);
  const payload = { email: form.get("email"), password: form.get("password") };

  try {
    const data = await api("/auth/register", { method: "POST", body: JSON.stringify(payload) });
    setAuth(data.token, data.user);
    await loadNotes();
  } catch (err) {
    setMessage(authMsg, err.message);
  }
});

el("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setMessage(authMsg, "");
  const form = new FormData(e.target);
  const payload = { email: form.get("email"), password: form.get("password") };

  try {
    const data = await api("/auth/login", { method: "POST", body: JSON.stringify(payload) });
    setAuth(data.token, data.user);
    await loadNotes();
  } catch (err) {
    setMessage(authMsg, err.message);
  }
});

logoutBtn.addEventListener("click", clearAuth);

// ===== Notes =====
async function loadNotes() {
  setMessage(appMsg, "");
  const data = await api("/notes");
  state.notes = data.notes;
  if (!state.activeNoteId && state.notes.length) state.activeNoteId = state.notes[0].id;
  renderNotes();
  renderEditor();
}

function renderNotes() {
  notesList.innerHTML = "";
  for (const n of state.notes) {
    const div = document.createElement("div");
    div.className = "noteItem" + (n.id === state.activeNoteId ? " active" : "");
    div.innerHTML = `
      <div class="t">${escapeHtml(n.title || "(ohne Titel)")}</div>
      <div class="s">${escapeHtml((n.content || "").slice(0, 80))}</div>
    `;
    div.addEventListener("click", () => {
      state.activeNoteId = n.id;
      renderNotes();
      renderEditor();
    });
    notesList.appendChild(div);
  }
}

function renderEditor() {
  const note = state.notes.find(n => n.id === state.activeNoteId) || null;
  deleteBtn.disabled = !note;

  noteTitle.value = note?.title ?? "";
  noteContent.value = note?.content ?? "";

  if (note) {
    noteMeta.textContent = `Zuletzt geändert: ${new Date(note.updated_at).toLocaleString()}`;
  } else {
    noteMeta.textContent = "";
  }
}

newNoteBtn.addEventListener("click", async () => {
  setMessage(appMsg, "");
  try {
    const data = await api("/notes", { method: "POST", body: JSON.stringify({ title: "", content: "" }) });
    state.notes.unshift(data.note);
    state.activeNoteId = data.note.id;
    renderNotes();
    renderEditor();
  } catch (err) {
    setMessage(appMsg, err.message);
  }
});

noteForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMessage(appMsg, "");

  const note = state.notes.find(n => n.id === state.activeNoteId);
  if (!note) return;

  try {
    const payload = { title: noteTitle.value, content: noteContent.value };
    const data = await api(`/notes/${note.id}`, { method: "PATCH", body: JSON.stringify(payload) });

    // Update in state
    const idx = state.notes.findIndex(n => n.id === note.id);
    state.notes[idx] = data.note;

    // Sort by updated_at desc (optional)
    state.notes.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    renderNotes();
    renderEditor();
    setMessage(appMsg, "Gespeichert.");
  } catch (err) {
    setMessage(appMsg, err.message);
  }
});

deleteBtn.addEventListener("click", async () => {
  setMessage(appMsg, "");
  const note = state.notes.find(n => n.id === state.activeNoteId);
  if (!note) return;

  if (!confirm("Notiz wirklich löschen?")) return;

  try {
    await api(`/notes/${note.id}`, { method: "DELETE" });
    state.notes = state.notes.filter(n => n.id !== note.id);
    state.activeNoteId = state.notes[0]?.id ?? null;
    renderNotes();
    renderEditor();
    setMessage(appMsg, "Gelöscht.");
  } catch (err) {
    setMessage(appMsg, err.message);
  }
});

// ===== UI =====
function render() {
  const loggedIn = !!state.token && !!state.user;
  authView.classList.toggle("hidden", loggedIn);
  appView.classList.toggle("hidden", !loggedIn);
  logoutBtn.classList.toggle("hidden", !loggedIn);
  userEmail.textContent = loggedIn ? state.user.email : "";

  if (loggedIn) loadNotes().catch(err => setMessage(appMsg, err.message));
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

render();
