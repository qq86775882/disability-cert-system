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
    const { rows: [old] } = await conn.query('SELECT * FROM issuances WHERE id = $1 FOR UPDATE', [id]);
    if (!old) { await conn.query('ROLLBACK'); return res.status(404).json({ code: 404, message: '记录不存在' }); }
    if (old.status !== 'issued') { await conn.query('ROLLBACK'); return res.status(400).json({ code: 400, message: '该记录未发证，不能换证' }); }

    const { cert_no, valid_from, valid_to, remark } = req.body;
    if (!cert_no || !valid_from || !valid_to) { await conn.query('ROLLBACK'); return res.status(400).json({ code: 400, message: '证号、有效期不能为空' }); }

    const { rows: [newIssuance] } = await conn.query(
      `INSERT INTO issuances (name, gender, id_card, birth_date, disability_category, disability_level, phone, address, guardian, guardian_phone, status, cert_no, valid_from, valid_to, issued_date, is_reissue, prev_cert_id, operator_id, remark)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'issued',$11,$12,$13,CURRENT_DATE,1,$14,$15,$16) RETURNING *`,
      [old.name, old.gender, old.id_card, old.birth_date, old.disability_category, old.disability_level, old.phone, old.address, old.guardian, old.guardian_phone, cert_no, valid_from, valid_to, id, user.id, remark || '换证']
    );
    await conn.query(
      `INSERT INTO certificates (issuance_id, name, gender, id_card, cert_no, disability_category, disability_level, phone, address, valid_from, valid_to, operator_id, is_reissue)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,1)`,
      [newIssuance.id, old.name, old.gender, old.id_card, cert_no, old.disability_category, old.disability_level, old.phone, old.address, valid_from, valid_to, user.id]
    );
    await conn.query('COMMIT');
    res.json({ code: 200, data: null, message: '换证成功' });
  } catch (err) {
    await conn.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  } finally { conn.release(); }
};
