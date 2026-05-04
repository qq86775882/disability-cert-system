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
        `SELECT c.*, CASE WHEN CURRENT_DATE >= c.valid_to THEN '到期' WHEN CURRENT_DATE >= c.valid_to - INTERVAL '1 year' THEN '临期' ELSE '正常' END AS cert_status, c.valid_to - CURRENT_DATE AS days_remaining FROM certificates c WHERE c.id = $1`, [id]
      );
      if (rows.length === 0) return res.status(404).json({ code: 404, message: '记录不存在' });
      const r = rows[0];
      res.json({ code: 200, data: { ...r, disability_category_name: categoryNames[r.disability_category], disability_level_name: levelNames[r.disability_level] }, message: 'ok' });
    } catch (err) { console.error(err); res.status(500).json({ code: 500, message: '服务器错误' }); }
  }

  else if (req.method === 'PUT') {
    try {
      const { phone, address, valid_from, valid_to, remark } = req.body;
      await pool.query(
        'UPDATE certificates SET phone=$1, address=$2, valid_from=$3, valid_to=$4, remark=$5, updated_at=NOW() WHERE id=$6',
        [phone || null, address || null, valid_from, valid_to, remark || null, id]
      );
      res.json({ code: 200, data: null, message: '更新成功' });
    } catch (err) { console.error(err); res.status(500).json({ code: 500, message: '服务器错误' }); }
  }

  else return res.status(405).json({ code: 405, message: 'Method Not Allowed' });
};
