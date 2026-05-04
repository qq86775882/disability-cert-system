const auth = require('../../lib/auth');
const pool = require('../../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ code: 405, message: 'Method Not Allowed' });
  const user = auth(req, res);
  if (!user) return;
  try {
    const { rows } = await pool.query('SELECT id, username, real_name, role FROM users WHERE id = $1', [user.id]);
    if (rows.length === 0) return res.status(404).json({ code: 404, message: '用户不存在' });
    res.json({ code: 200, data: rows[0], message: 'ok' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
};
