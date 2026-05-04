const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ code: 405, message: 'Method Not Allowed' });
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1 AND status = 1', [username]);
    if (rows.length === 0) return res.status(401).json({ code: 401, message: '用户名或密码错误' });
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ code: 401, message: '用户名或密码错误' });
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    res.json({ code: 200, data: { token, user: { id: user.id, username: user.username, real_name: user.real_name, role: user.role } }, message: 'ok' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
};
