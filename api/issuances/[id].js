const auth = require('../../lib/auth');
const pool = require('../../lib/db');
const { categoryNames, levelNames } = require('../../lib/constants');

module.exports = async (req, res) => {
  const user = auth(req, res);
  if (!user) return;
  const { id } = req.query;
  if (!id) return res.status(400).json({ code: 400, message: '缺少ID' });

  if (req.method === 'GET') {
    try {
      const { rows } = await pool.query(
        `SELECT i.*, u.real_name AS operator_name FROM issuances i LEFT JOIN users u ON i.operator_id = u.id WHERE i.id = $1`, [id]
      );
      if (rows.length === 0) return res.status(404).json({ code: 404, message: '记录不存在' });
      const r = rows[0];
      res.json({ code: 200, data: { ...r, disability_category_name: categoryNames[r.disability_category], disability_level_name: levelNames[r.disability_level] }, message: 'ok' });
    } catch (err) { console.error(err); res.status(500).json({ code: 500, message: '服务器错误' }); }
  }

  else if (req.method === 'PUT') {
    try {
      const { name, gender, id_card, birth_date, disability_category, disability_level, phone, address, guardian, guardian_phone, remark } = req.body;
      await pool.query(
        `UPDATE issuances SET name=$1, gender=$2, id_card=$3, birth_date=$4, disability_category=$5, disability_level=$6, phone=$7, address=$8, guardian=$9, guardian_phone=$10, remark=$11, updated_at=NOW() WHERE id=$12`,
        [name, gender, id_card, birth_date || null, disability_category, disability_level, phone || null, address || null, guardian || null, guardian_phone || null, remark || null, id]
      );
      res.json({ code: 200, data: null, message: '更新成功' });
    } catch (err) { console.error(err); res.status(500).json({ code: 500, message: '服务器错误' }); }
  }

  else return res.status(405).json({ code: 405, message: 'Method Not Allowed' });
};
