const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : 'https://inkwell-blog.up.railway.app/api';
let token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');
let allPosts = [];

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateNavAuth();
  navigate('home');
  window.addEventListener('scroll', () => {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 10);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.avatar-menu')) closeAvatarMenu();
  });
});

// ── NAVIGATION ────────────────────────────────────────────────────────────────
function navigate(page, data = null) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(`page-${page}`);
  if (!el) return;
  el.classList.add('active');
  closeAvatarMenu();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (page === 'home') loadPosts();
  if (page === 'new-post') setupEditor(data);
  if (page === 'post-detail' && data) loadPostDetail(data);
  if (page === 'my-posts') loadMyPosts();
}

// ── AUTH UI ───────────────────────────────────────────────────────────────────
function updateNavAuth() {
  const authLinks = document.getElementById('nav-auth-links');
  const userLinks = document.getElementById('nav-user-links');
  if (token && currentUser) {
    authLinks.style.display = 'none';
    userLinks.style.display = 'flex';
    userLinks.style.alignItems = 'center';
    userLinks.style.gap = '8px';
    document.getElementById('nav-avatar').textContent = currentUser.username[0].toUpperCase();
    document.getElementById('dropdown-username').textContent = currentUser.username;
  } else {
    authLinks.style.display = 'flex';
    authLinks.style.alignItems = 'center';
    authLinks.style.gap = '8px';
    userLinks.style.display = 'none';
  }
}

function toggleAvatarMenu() {
  document.getElementById('avatar-dropdown').classList.toggle('open');
}
function closeAvatarMenu() {
  document.getElementById('avatar-dropdown').classList.remove('open');
}

function logout() {
  token = null; currentUser = null;
  localStorage.removeItem('token'); localStorage.removeItem('user');
  updateNavAuth();
  navigate('home');
  showToast('Logged out successfully', 'info');
}

// ── THEME ─────────────────────────────────────────────────────────────────────
function toggleTheme() {
  const isDark = document.body.classList.toggle('dark');
  document.getElementById('theme-icon').className = isDark ? 'fa fa-sun' : 'fa fa-moon';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}
if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark');
  document.getElementById('theme-icon').className = 'fa fa-sun';
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── AUTH HANDLERS ─────────────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  btn.textContent = 'Signing in...'; btn.disabled = true;
  try {
    const res = await fetch(`${API}/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: document.getElementById('login-email').value, password: document.getElementById('login-password').value })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    token = data.token; currentUser = data.user;
    localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(currentUser));
    updateNavAuth(); navigate('home');
    showToast(`Welcome back, ${currentUser.username}!`);
  } catch (err) { showToast(err.message, 'error'); }
  finally { btn.textContent = 'Sign In'; btn.disabled = false; }
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('reg-btn');
  btn.textContent = 'Creating...'; btn.disabled = true;
  try {
    const res = await fetch(`${API}/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: document.getElementById('reg-username').value, email: document.getElementById('reg-email').value, password: document.getElementById('reg-password').value })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    token = data.token; currentUser = data.user;
    localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(currentUser));
    updateNavAuth(); navigate('home');
    showToast(`Welcome to Inkwell, ${currentUser.username}!`);
  } catch (err) { showToast(err.message, 'error'); }
  finally { btn.textContent = 'Create Account'; btn.disabled = false; }
}

function togglePass(id, btn) {
  const input = document.getElementById(id);
  const isText = input.type === 'text';
  input.type = isText ? 'password' : 'text';
  btn.innerHTML = isText ? '<i class="fa fa-eye"></i>' : '<i class="fa fa-eye-slash"></i>';
}

// ── POSTS ─────────────────────────────────────────────────────────────────────
async function loadPosts() {
  try {
    const res = await fetch(`${API}/posts`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    allPosts = await res.json();
    renderPosts(allPosts);
    animateCounters(allPosts);
  } catch { showToast('Failed to load posts', 'error'); }
}

function animateCounters(posts) {
  const writers = new Set(posts.map(p => p.author_id)).size;
  countUp('stat-posts', posts.length);
  countUp('stat-writers', writers);
}

function countUp(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let current = 0;
  const step = Math.ceil(target / 40);
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(timer);
  }, 30);
}

function renderPosts(posts) {
  const grid = document.getElementById('posts-grid');
  if (!posts.length) {
    grid.innerHTML = `<div class="empty-state"><i class="fa fa-newspaper"></i><p>No posts yet. Be the first to write!</p></div>`;
    return;
  }
  grid.innerHTML = posts.map(p => postCardHTML(p)).join('');
}

// ── COVER GENERATOR ──────────────────────────────────────────────────────────
const COVER_PALETTES = [
  { bg: ['#0f0c29','#302b63','#24243e'], accent: '#a78bfa', text: '#fff' },
  { bg: ['#1a1a2e','#16213e','#0f3460'], accent: '#e94560', text: '#fff' },
  { bg: ['#0d1117','#161b22','#21262d'], accent: '#58a6ff', text: '#fff' },
  { bg: ['#2d1b69','#11998e','#38ef7d'], accent: '#38ef7d', text: '#fff' },
  { bg: ['#fc4a1a','#f7b733','#fc4a1a'], accent: '#fff', text: '#fff' },
  { bg: ['#1f1c2c','#928dab','#1f1c2c'], accent: '#f8c8d4', text: '#fff' },
  { bg: ['#0f2027','#203a43','#2c5364'], accent: '#00d2ff', text: '#fff' },
  { bg: ['#16222a','#3a6073','#16222a'], accent: '#f7971e', text: '#fff' },
  { bg: ['#200122','#6f0000','#200122'], accent: '#ff6b6b', text: '#fff' },
  { bg: ['#0a3d62','#1e3799','#0a3d62'], accent: '#ffd32a', text: '#fff' },
];

const COVER_PATTERNS = [
  // Diagonal lines
  (id, p) => `<defs><linearGradient id="g${id}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${p.bg[0]}"/><stop offset="50%" stop-color="${p.bg[1]}"/><stop offset="100%" stop-color="${p.bg[2]}"/></linearGradient></defs><rect width="400" height="220" fill="url(#g${id})"/>${Array.from({length:12},(_,i)=>`<line x1="${i*40-20}" y1="0" x2="${i*40+200}" y2="220" stroke="${p.accent}" stroke-width="1" opacity="0.15"/>`).join('')}<circle cx="320" cy="40" r="80" fill="${p.accent}" opacity="0.08"/><circle cx="60" cy="180" r="60" fill="${p.accent}" opacity="0.1"/>`,
  // Geometric circles
  (id, p) => `<defs><linearGradient id="g${id}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${p.bg[0]}"/><stop offset="100%" stop-color="${p.bg[2]}"/></linearGradient></defs><rect width="400" height="220" fill="url(#g${id})"/><circle cx="200" cy="110" r="140" fill="none" stroke="${p.accent}" stroke-width="1" opacity="0.2"/><circle cx="200" cy="110" r="100" fill="none" stroke="${p.accent}" stroke-width="1" opacity="0.2"/><circle cx="200" cy="110" r="60" fill="none" stroke="${p.accent}" stroke-width="1" opacity="0.25"/><circle cx="350" cy="20" r="50" fill="${p.accent}" opacity="0.12"/><circle cx="50" cy="200" r="40" fill="${p.accent}" opacity="0.1"/>`,
  // Grid dots
  (id, p) => `<defs><linearGradient id="g${id}" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="${p.bg[0]}"/><stop offset="100%" stop-color="${p.bg[1]}"/></linearGradient></defs><rect width="400" height="220" fill="url(#g${id})"/>${Array.from({length:10},(_,x)=>Array.from({length:6},(_,y)=>`<circle cx="${x*44+22}" cy="${y*40+20}" r="2" fill="${p.accent}" opacity="0.3"/>`).join('')).join('')}<rect x="280" y="60" width="80" height="80" fill="none" stroke="${p.accent}" stroke-width="2" opacity="0.2" transform="rotate(20,320,100)"/>`,
  // Wave lines
  (id, p) => `<defs><linearGradient id="g${id}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${p.bg[0]}"/><stop offset="100%" stop-color="${p.bg[2]}"/></linearGradient></defs><rect width="400" height="220" fill="url(#g${id})"/>${Array.from({length:8},(_,i)=>`<path d="M0,${30+i*25} Q100,${10+i*25} 200,${30+i*25} T400,${30+i*25}" fill="none" stroke="${p.accent}" stroke-width="1.5" opacity="0.15"/>`).join('')}<polygon points="340,10 390,80 290,80" fill="${p.accent}" opacity="0.1"/>`,
  // Abstract blobs
  (id, p) => `<defs><radialGradient id="g${id}" cx="40%" cy="40%"><stop offset="0%" stop-color="${p.bg[1]}"/><stop offset="100%" stop-color="${p.bg[0]}"/></radialGradient></defs><rect width="400" height="220" fill="url(#g${id})"/><ellipse cx="300" cy="80" rx="120" ry="90" fill="${p.accent}" opacity="0.1"/><ellipse cx="100" cy="160" rx="100" ry="70" fill="${p.accent}" opacity="0.12"/><ellipse cx="200" cy="110" rx="60" ry="40" fill="${p.accent}" opacity="0.08"/>${Array.from({length:6},(_,i)=>`<circle cx="${60+i*56}" cy="${110+Math.sin(i)*30}" r="3" fill="${p.accent}" opacity="0.5"/>`).join('')}`,
];

function generateCoverSVG(postId, title) {
  const pi = Math.abs(postId) % COVER_PALETTES.length;
  const pti = Math.abs(postId * 3 + title.length) % COVER_PATTERNS.length;
  const palette = COVER_PALETTES[pi];
  const patternFn = COVER_PATTERNS[pti];
  const uid = `c${postId}`;
  const words = title.split(' ');
  const line1 = words.slice(0, Math.ceil(words.length / 2)).join(' ');
  const line2 = words.slice(Math.ceil(words.length / 2)).join(' ');
  const svgContent = patternFn(uid, palette);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="220" viewBox="0 0 400 220">
    ${svgContent}
    <rect x="0" y="130" width="400" height="90" fill="url(#g${uid})" opacity="0.5"/>
    <text x="24" y="162" font-family="Georgia,serif" font-size="17" font-weight="bold" fill="${palette.text}" opacity="0.95" letter-spacing="0.5">${line1.length > 22 ? line1.substring(0,22)+'…' : line1}</text>
    ${line2 ? `<text x="24" y="186" font-family="Georgia,serif" font-size="17" font-weight="bold" fill="${palette.text}" opacity="0.95" letter-spacing="0.5">${line2.length > 22 ? line2.substring(0,22)+'…' : line2}</text>` : ''}
    <rect x="24" y="200" width="40" height="3" fill="${palette.accent}" rx="2"/>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function postCardHTML(p) {
  const coverSrc = p.cover_image || generateCoverSVG(p.id, p.title);
  const cover = `<div class="post-card-cover"><img src="${coverSrc}" alt="cover" onerror="this.src='${generateCoverSVG(p.id, p.title)}'"/></div>`;
  return `
    <div class="post-card" onclick="navigate('post-detail', ${p.id})">
      ${cover}
      <div class="post-card-body">
        <div class="post-card-meta">
          <div class="post-author-avatar">${p.author_name[0].toUpperCase()}</div>
          <span class="post-author-name">${p.author_name}</span>
          <span class="post-date">${formatDate(p.created_at)}</span>
        </div>
        <div class="post-card-title">${p.title}</div>
        <div class="post-card-excerpt">${p.excerpt || ''}</div>
        <div class="post-card-footer">
          <span class="post-stat ${p.liked ? 'liked' : ''}"><i class="fa fa-heart"></i> ${p.like_count}</span>
          <span class="post-stat"><i class="fa fa-comment"></i> ${p.comment_count}</span>
        </div>
      </div>
    </div>`;
}

function filterPosts() {
  const q = document.getElementById('search-input').value.toLowerCase();
  renderPosts(allPosts.filter(p => p.title.toLowerCase().includes(q) || p.author_name.toLowerCase().includes(q)));
}

// ── POST DETAIL ───────────────────────────────────────────────────────────────
async function loadPostDetail(id) {
  const container = document.getElementById('post-detail-content');
  container.innerHTML = '<div class="post-detail"><div class="skeleton-card" style="height:400px;border-radius:16px;margin-bottom:24px"></div></div>';
  try {
    const res = await fetch(`${API}/posts/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const post = await res.json();
    if (!res.ok) throw new Error(post.error);
    renderPostDetail(post);
  } catch (err) { showToast(err.message, 'error'); navigate('home'); }
}

function renderPostDetail(post) {
  const isAuthor = currentUser && currentUser.id === post.author_id;
  const coverSrc = post.cover_image || generateCoverSVG(post.id, post.title);
  const cover = `<div class="post-detail-cover"><img src="${coverSrc}" alt="cover" onerror="this.src='${generateCoverSVG(post.id, post.title)}'"/></div>`;

  const authorActions = isAuthor ? `
    <button class="btn btn-sm btn-outline" onclick="editPost(${JSON.stringify(post).replace(/"/g, '&quot;')})"><i class="fa fa-edit"></i> Edit</button>
    <button class="btn btn-sm btn-danger" onclick="deletePost(${post.id})"><i class="fa fa-trash"></i> Delete</button>` : '';

  const commentForm = token ? `
    <form class="comment-form" onsubmit="submitComment(event, ${post.id})">
      <textarea class="comment-input" id="comment-input-${post.id}" placeholder="Share your thoughts..." required></textarea>
      <button type="submit" class="btn btn-primary btn-sm">Post Comment</button>
    </form>` : `<p style="color:var(--text3);margin-bottom:24px">
      <a href="#" onclick="navigate('login')" style="color:var(--primary);font-weight:600">Sign in</a> to leave a comment.
    </p>`;

  const commentsHTML = post.comments.length
    ? post.comments.map(c => commentCardHTML(c)).join('')
    : '<p style="color:var(--text3)">No comments yet. Start the conversation!</p>';

  document.getElementById('post-detail-content').innerHTML = `
    <div class="post-detail">
      ${cover}
      <h1 class="post-detail-title">${post.title}</h1>
      <div class="post-detail-meta">
        <div class="post-detail-author">
          <div class="avatar">${post.author_name[0].toUpperCase()}</div>
          <div class="post-detail-author-info">
            <span class="post-detail-author-name">${post.author_name}</span>
            <span class="post-detail-date">${formatDate(post.created_at)}</span>
          </div>
        </div>
        <div class="post-detail-actions">${authorActions}</div>
      </div>
      <div class="post-detail-body">${post.content}</div>
      <button class="like-btn ${post.liked ? 'liked' : ''}" id="like-btn-${post.id}" onclick="toggleLike(${post.id})">
        <i class="fa${post.liked ? 's' : 'r'} fa-heart"></i>
        <span id="like-count-${post.id}">${post.like_count}</span> Likes
      </button>
      <div class="comments-section">
        <h3><i class="fa fa-comments"></i> Comments (${post.comments.length})</h3>
        ${commentForm}
        <div class="comment-list" id="comment-list-${post.id}">${commentsHTML}</div>
      </div>
    </div>`;
}

function commentCardHTML(c) {
  const canDelete = currentUser && currentUser.id === c.author_id;
  return `
    <div class="comment-card" id="comment-${c.id}">
      <div class="comment-header">
        <div class="comment-author-avatar">${c.author_name[0].toUpperCase()}</div>
        <span class="comment-author-name">${c.author_name}</span>
        <span class="comment-date">${formatDate(c.created_at)}</span>
        ${canDelete ? `<button class="comment-delete" onclick="deleteComment(${c.id})"><i class="fa fa-times"></i></button>` : ''}
      </div>
      <div class="comment-body">${c.content}</div>
    </div>`;
}

async function toggleLike(postId) {
  if (!token) { navigate('login'); return; }
  try {
    const res = await fetch(`${API}/posts/${postId}/like`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const btn = document.getElementById(`like-btn-${postId}`);
    const count = document.getElementById(`like-count-${postId}`);
    btn.className = `like-btn ${data.liked ? 'liked' : ''}`;
    btn.querySelector('i').className = `fa${data.liked ? 's' : 'r'} fa-heart`;
    count.textContent = data.like_count;
  } catch { showToast('Failed to update like', 'error'); }
}

async function submitComment(e, postId) {
  e.preventDefault();
  const input = document.getElementById(`comment-input-${postId}`);
  const content = input.value.trim();
  if (!content) return;
  try {
    const res = await fetch(`${API}/posts/${postId}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content })
    });
    const comment = await res.json();
    if (!res.ok) throw new Error(comment.error);
    const list = document.getElementById(`comment-list-${postId}`);
    if (list.querySelector('p')) list.innerHTML = '';
    list.insertAdjacentHTML('beforeend', commentCardHTML(comment));
    input.value = '';
    showToast('Comment posted!');
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteComment(id) {
  if (!confirm('Delete this comment?')) return;
  try {
    const res = await fetch(`${API}/comments/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed');
    document.getElementById(`comment-${id}`)?.remove();
    showToast('Comment deleted');
  } catch { showToast('Failed to delete comment', 'error'); }
}

// ── POST EDITOR ───────────────────────────────────────────────────────────────
function setupEditor(postData = null) {
  if (!token) { navigate('login'); return; }
  document.getElementById('edit-post-id').value = postData?.id || '';
  document.getElementById('post-title').value = postData?.title || '';
  document.getElementById('post-cover').value = postData?.cover_image || '';
  document.getElementById('post-content').innerHTML = postData?.content || '';
  document.getElementById('editor-title').textContent = postData ? 'Edit Post' : 'New Post';
  document.getElementById('post-submit-btn').textContent = postData ? 'Update Post' : 'Publish Post';
}

function editPost(post) {
  navigate('new-post', post);
}

async function handlePostSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('edit-post-id').value;
  const title = document.getElementById('post-title').value.trim();
  const content = document.getElementById('post-content').innerHTML.trim();
  const cover_image = document.getElementById('post-cover').value.trim();
  if (!title || !content) return showToast('Title and content are required', 'error');

  const btn = document.getElementById('post-submit-btn');
  btn.disabled = true; btn.textContent = 'Saving...';

  try {
    const url = id ? `${API}/posts/${id}` : `${API}/posts`;
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title, content, cover_image: cover_image || null })
    });
    const post = await res.json();
    if (!res.ok) throw new Error(post.error);
    showToast(id ? 'Post updated!' : 'Post published!');
    navigate('post-detail', post.id);
  } catch (err) { showToast(err.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = id ? 'Update Post' : 'Publish Post'; }
}

async function deletePost(id) {
  if (!confirm('Delete this post permanently?')) return;
  try {
    const res = await fetch(`${API}/posts/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed');
    showToast('Post deleted');
    navigate('home');
  } catch { showToast('Failed to delete post', 'error'); }
}

// ── MY POSTS ──────────────────────────────────────────────────────────────────
async function loadMyPosts() {
  if (!token) { navigate('login'); return; }
  try {
    const res = await fetch(`${API}/posts`, { headers: { Authorization: `Bearer ${token}` } });
    const posts = await res.json();
    const mine = posts.filter(p => p.author_id === currentUser.id);
    const grid = document.getElementById('my-posts-list');
    grid.innerHTML = mine.length ? mine.map(p => postCardHTML(p)).join('') :
      `<div class="empty-state"><i class="fa fa-pen-nib"></i><p>You haven't written any posts yet.</p></div>`;
  } catch { showToast('Failed to load posts', 'error'); }
}

// ── EDITOR TOOLBAR ────────────────────────────────────────────────────────────
function fmt(cmd) { document.execCommand(cmd, false, null); document.getElementById('post-content').focus(); }
function insertHeading() { document.execCommand('formatBlock', false, 'h2'); document.getElementById('post-content').focus(); }
function insertQuote() { document.execCommand('formatBlock', false, 'blockquote'); document.getElementById('post-content').focus(); }

// ── UTILS ─────────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
