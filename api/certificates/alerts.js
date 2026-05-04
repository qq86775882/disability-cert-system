const auth = require('../../lib/auth');
const pool = require('../../lib/db');

module.exports = async (req, res) => {
  const user = auth(req, res);
  if (!user) return;
  if (req.method !== 'GET') return res.status(405).json({ code: 405, message: 'Method Not Allowed' });

  try {
    const { rows: approaching } = await pool.query(
      "SELECT * FROM certificates WHERE CURRENT_DATE >= valid_to - INTERVAL '1 year' AND CURRENT_DATE < valid_to ORDER BY valid_to ASC LIMIT 20"
    );
    const { rows: expired } = await pool.query(
      'SELECT * FROM certificates WHERE CURRENT_DATE >= valid_to ORDER BY valid_to ASC LIMIT 20'
    );
    res.json({ code: 200, data: { approaching, expired }, message: 'ok' });
  } catch (err) { console.error(err); res.status(500).json({ code: 500, message: '服务器错误' }); }
};
