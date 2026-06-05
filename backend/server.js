const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { getDb, query, run, get, save } = require('./database');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'blog_platform_secret_key_2024';
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── AUTH MIDDLEWARE ───────────────────────────────────────────────────────────
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
};

const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) { try { req.user = jwt.verify(token, JWT_SECRET); } catch {} }
  next();
};

// ── AUTH ──────────────────────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hash]);
    const user = get('SELECT id, username, email, created_at FROM users WHERE id = ?', [result.lastInsertRowid]);
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Username or email already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  const { password: _, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

app.get('/api/me', auth, (req, res) => {
  const user = get('SELECT id, username, email, created_at FROM users WHERE id = ?', [req.user.id]);
  res.json(user);
});

// ── POSTS ─────────────────────────────────────────────────────────────────────
app.get('/api/posts', optionalAuth, (req, res) => {
  const uid = req.user?.id || 0;
  const posts = query(`
    SELECT p.*, u.username as author_name,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as liked
    FROM posts p JOIN users u ON p.author_id = u.id
    ORDER BY p.created_at DESC
  `, [uid]);
  res.json(posts);
});

app.get('/api/posts/:id', optionalAuth, (req, res) => {
  const uid = req.user?.id || 0;
  const post = get(`
    SELECT p.*, u.username as author_name,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as liked
    FROM posts p JOIN users u ON p.author_id = u.id
    WHERE p.id = ?
  `, [uid, req.params.id]);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const comments = query(`
    SELECT c.*, u.username as author_name
    FROM comments c JOIN users u ON c.author_id = u.id
    WHERE c.post_id = ? ORDER BY c.created_at ASC
  `, [req.params.id]);
  res.json({ ...post, comments });
});

app.post('/api/posts', auth, (req, res) => {
  const { title, content, excerpt, cover_image } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
  const result = run(
    'INSERT INTO posts (title, content, excerpt, cover_image, author_id) VALUES (?, ?, ?, ?, ?)',
    [title, content, excerpt || content.replace(/<[^>]+>/g, '').substring(0, 150) + '...', cover_image || null, req.user.id]
  );
  const post = get('SELECT p.*, u.username as author_name FROM posts p JOIN users u ON p.author_id = u.id WHERE p.id = ?', [result.lastInsertRowid]);
  res.status(201).json(post);
});

app.put('/api/posts/:id', auth, (req, res) => {
  const post = get('SELECT * FROM posts WHERE id = ?', [req.params.id]);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.author_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  const { title, content, excerpt, cover_image } = req.body;
  run('UPDATE posts SET title=?, content=?, excerpt=?, cover_image=?, updated_at=datetime("now") WHERE id=?',
    [title || post.title, content || post.content, excerpt || post.excerpt, cover_image ?? post.cover_image, req.params.id]);
  const updated = get('SELECT p.*, u.username as author_name FROM posts p JOIN users u ON p.author_id = u.id WHERE p.id = ?', [req.params.id]);
  res.json(updated);
});

app.delete('/api/posts/:id', auth, (req, res) => {
  const post = get('SELECT * FROM posts WHERE id = ?', [req.params.id]);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.author_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  run('DELETE FROM comments WHERE post_id = ?', [req.params.id]);
  run('DELETE FROM likes WHERE post_id = ?', [req.params.id]);
  run('DELETE FROM posts WHERE id = ?', [req.params.id]);
  res.json({ message: 'Post deleted' });
});

// ── LIKES ─────────────────────────────────────────────────────────────────────
app.post('/api/posts/:id/like', auth, (req, res) => {
  const existing = get('SELECT * FROM likes WHERE post_id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (existing) {
    run('DELETE FROM likes WHERE post_id = ? AND user_id = ?', [req.params.id, req.user.id]);
  } else {
    run('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [req.params.id, req.user.id]);
  }
  const { like_count } = get('SELECT COUNT(*) as like_count FROM likes WHERE post_id = ?', [req.params.id]);
  res.json({ liked: !existing, like_count });
});

// ── COMMENTS ──────────────────────────────────────────────────────────────────
app.post('/api/posts/:id/comments', auth, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  const result = run('INSERT INTO comments (content, post_id, author_id) VALUES (?, ?, ?)', [content, req.params.id, req.user.id]);
  const comment = get('SELECT c.*, u.username as author_name FROM comments c JOIN users u ON c.author_id = u.id WHERE c.id = ?', [result.lastInsertRowid]);
  res.status(201).json(comment);
});

app.delete('/api/comments/:id', auth, (req, res) => {
  const comment = get('SELECT * FROM comments WHERE id = ?', [req.params.id]);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.author_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  run('DELETE FROM comments WHERE id = ?', [req.params.id]);
  res.json({ message: 'Comment deleted' });
});

// ── SERVE FRONTEND ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'frontend')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'frontend/index.html'));
  }
});

// ── START ─────────────────────────────────────────────────────────────────────
getDb().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
});
