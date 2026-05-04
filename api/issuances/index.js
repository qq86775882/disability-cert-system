const auth = require('../../lib/auth');
const pool = require('../../lib/db');
const { categoryNames, levelNames } = require('../../lib/constants');

module.exports = async (req, res) => {
  const user = auth(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
      const { status, keyword, category, level } = req.query;
      const offset = (page - 1) * size;
      let where = []; let params = []; let idx = 1;

      if (status && status !== 'all') { where.push(`i.status = $${idx++}`); params.push(status); }
      if (category) { where.push(`i.disability_category = $${idx++}`); params.push(parseInt(category)); }
      if (level) { where.push(`i.disability_level = $${idx++}`); params.push(parseInt(level)); }
      if (keyword) { where.push(`(i.name ILIKE $${idx} OR i.id_card ILIKE $${idx+1} OR i.cert_no ILIKE $${idx+2} OR i.phone ILIKE $${idx+3})`); params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`); idx += 4; }

      const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
      const [{ total }] = (await pool.query(`SELECT COUNT(*) AS total FROM issuances i ${whereClause}`, params)).rows;
      const { rows: list } = await pool.query(
        `SELECT i.*, u.real_name AS operator_name FROM issuances i LEFT JOIN users u ON i.operator_id = u.id ${whereClause} ORDER BY i.created_at DESC LIMIT $${idx} OFFSET $${idx+1}`,
        [...params, size, offset]
      );
      res.json({
        code: 200, data: {
          list: list.map(r => ({ ...r, disability_category_name: categoryNames[r.disability_category] || '', disability_level_name: levelNames[r.disability_level] || '' })),
          total, page, size
        }, message: 'ok'
      });
    } catch (err) { console.error(err); res.status(500).json({ code: 500, message: '服务器错误' }); }
  }

  else if (req.method === 'POST') {
    try {
      const { name, gender, id_card, birth_date, disability_category, disability_level, phone, address, guardian, guardian_phone, remark } = req.body;
      if (!name || !gender || !id_card || !disability_category || !disability_level) {
        return res.status(400).json({ code: 400, message: '必填字段不能为空' });
      }
      const { rows } = await pool.query(
        `INSERT INTO issuances (name, gender, id_card, birth_date, disability_category, disability_level, phone, address, guardian, guardian_phone, operator_id, remark)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [name, gender, id_card, birth_date || null, disability_category, disability_level, phone || null, address || null, guardian || null, guardian_phone || null, user.id, remark || null]
      );
      res.json({ code: 200, data: rows[0], message: '创建成功' });
    } catch (err) { console.error(err); res.status(500).json({ code: 500, message: '服务器错误' }); }
  }

  else return res.status(405).json({ code: 405, message: 'Method Not Allowed' });
};
