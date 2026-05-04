const auth = require('../../lib/auth');
const pool = require('../../lib/db');

module.exports = async (req, res) => {
  const user = auth(req, res);
  if (!user) return;
  const { id } = req.query;
  if (!id) return res.status(400).json({ code: 400, message: '缺少ID' });
  if (req.method !== 'POST') return res.status(405).json({ code: 405, message: 'Method Not Allowed' });

  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');
    const { rows: [issuance] } = await conn.query('SELECT * FROM issuances WHERE id = $1 FOR UPDATE', [id]);
    if (!issuance) { await conn.query('ROLLBACK'); return res.status(404).json({ code: 404, message: '记录不存在' }); }
    if (issuance.status === 'issued') { await conn.query('ROLLBACK'); return res.status(400).json({ code: 400, message: '该记录已发证' }); }

    const { cert_no, valid_from, valid_to } = req.body;
    if (!cert_no || !valid_from || !valid_to) { await conn.query('ROLLBACK'); return res.status(400).json({ code: 400, message: '证号、有效期不能为空' }); }

    await conn.query(
      `UPDATE issuances SET status='issued', cert_no=$1, valid_from=$2, valid_to=$3, issued_date=CURRENT_DATE, operator_id=$4, updated_at=NOW() WHERE id=$5`,
      [cert_no, valid_from, valid_to, user.id, id]
    );
    await conn.query(
      `INSERT INTO certificates (issuance_id, name, gender, id_card, cert_no, disability_category, disability_level, phone, address, valid_from, valid_to, operator_id, is_reissue)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,0)`,
      [id, issuance.name, issuance.gender, issuance.id_card, cert_no, issuance.disability_category, issuance.disability_level, issuance.phone, issuance.address, valid_from, valid_to, user.id]
    );
    await conn.query('COMMIT');
    res.json({ code: 200, data: null, message: '发证成功' });
  } catch (err) {
    await conn.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  } finally { conn.release(); }
};
