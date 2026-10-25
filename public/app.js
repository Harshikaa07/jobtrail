const $ = (s) => document.querySelector(s);
const STATUSES = ['Applied', 'Interview', 'Offer', 'Rejected'];
const FIELDS = ['company', 'role', 'status', 'link', 'applied_on', 'notes'];
let token = localStorage.getItem('token'), apps = [], editId = null, isLogin = true, dragId = null;

// Escape text before putting it into HTML so nobody can inject scripts
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// One helper for every request to our backend: sends JSON + the login token
async function api(url, method = 'GET', body) {
  const res = await fetch('/api' + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
    body: body && JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) logout();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function show() {
  $('#auth').hidden = !!token;
  $('#app').hidden = !token;
  if (token) load().catch(() => {});
}
async function load() { apps = await api('/applications'); render(); }
function logout() { localStorage.removeItem('token'); token = null; show(); }

// ---------- login / register ----------
$('#toggle').onclick = (e) => {
  e.preventDefault();
  isLogin = !isLogin;
  $('#name').hidden = isLogin;
  $('#authBtn').textContent = isLogin ? 'Log in' : 'Create account';
  e.target.textContent = isLogin ? 'New here? Create an account' : 'Have an account? Log in';
};
$('#authForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const d = await api(isLogin ? '/login' : '/register', 'POST',
      { name: $('#name').value, email: $('#email').value, password: $('#password').value });
    token = d.token;
    localStorage.setItem('token', token);
    $('#authErr').textContent = '';
    $('#authForm').reset();
    show();
  } catch (err) { $('#authErr').textContent = err.message; }
};

// ---------- drawing the board ----------
const card = (a) => `
  <article class="card" draggable="true" data-id="${a.id}">
    <h3>${esc(a.company)}</h3><p>${esc(a.role)}</p>
    ${a.applied_on ? `<small>Applied ${esc(a.applied_on)}</small>` : ''}
    ${a.notes ? `<small>${esc(a.notes)}</small>` : ''}
    <div class="acts">
      ${a.link ? `<a href="${esc(a.link)}" target="_blank" rel="noopener">Open posting</a>` : ''}
      <button data-edit="${a.id}">Edit</button><button data-del="${a.id}">Delete</button>
    </div>
  </article>`;

function render() {
  const q = $('#search').value.toLowerCase();
  const list = apps.filter((a) => (a.company + ' ' + a.role).toLowerCase().includes(q));
  const count = (s) => apps.filter((a) => a.status === s).length;
  // The pipeline bar: each stage's width is proportional to how many applications it holds
  $('#bar').innerHTML = STATUSES.map((s) => `<span style="flex:${count(s)};background:var(--${s})" title="${s}"></span>`).join('');
  $('#legend').innerHTML = `<span><b>${apps.length}</b>total</span>` +
    STATUSES.map((s) => `<span><b>${count(s)}</b>${s}</span>`).join('');
  $('#board').innerHTML = STATUSES.map((s) => {
    const items = list.filter((a) => a.status === s);
    return `<section class="col" data-s="${s}"><h2>${s}<em>${items.length}</em></h2>
      ${items.map(card).join('') || '<p class="empty">Drop an application here</p>'}</section>`;
  }).join('');
}

// ---------- edit, delete, drag and drop (event delegation on the board) ----------
$('#board').addEventListener('click', async (e) => {
  const { edit, del } = e.target.dataset;
  if (edit) openDialog(apps.find((a) => a.id == edit));
  if (del && confirm('Delete this application?')) {
    await api('/applications/' + del, 'DELETE');
    apps = apps.filter((a) => a.id != del);
    render();
  }
});
$('#board').addEventListener('dragstart', (e) => { dragId = e.target.dataset.id; });
$('#board').addEventListener('dragover', (e) => { if (e.target.closest('.col')) e.preventDefault(); });
$('#board').addEventListener('drop', async (e) => {
  const col = e.target.closest('.col');
  const a = apps.find((x) => x.id == dragId);
  if (!col || !a || a.status === col.dataset.s) return;
  const old = a.status;
  a.status = col.dataset.s;
  render(); // update the screen right away, then save
  try { await api('/applications/' + a.id, 'PUT', a); } catch { a.status = old; render(); }
});

// ---------- add / edit dialog ----------
function openDialog(a) {
  editId = a ? a.id : null;
  $('#dlgTitle').textContent = a ? 'Edit application' : 'New application';
  FIELDS.forEach((f) => {
    $('#f_' + f).value = a ? (a[f] ?? '') : f === 'status' ? 'Applied' : f === 'applied_on' ? new Date().toISOString().slice(0, 10) : '';
  });
  $('#dlg').showModal();
}
$('#addBtn').onclick = () => openDialog();
$('#cancel').onclick = () => $('#dlg').close();
$('#appForm').onsubmit = async (e) => {
  e.preventDefault();
  const body = {};
  FIELDS.forEach((f) => (body[f] = $('#f_' + f).value));
  try {
    if (editId) { const u = await api('/applications/' + editId, 'PUT', body); apps = apps.map((a) => (a.id == editId ? u : a)); }
    else apps.unshift(await api('/applications', 'POST', body));
    $('#dlg').close();
    render();
  } catch (err) { alert(err.message); }
};

$('#search').oninput = render;
$('#logout').onclick = logout;
show();
