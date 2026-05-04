const auth = require('../../lib/auth');
const pool = require('../../lib/db');
const { categoryNames, levelNames } = require('../../lib/constants');

module.exports = async (req, res) => {
  const user = auth(req, res);
  if (!user) return;
  if (req.method !== 'GET') return res.status(405).json({ code: 405, message: 'Method Not Allowed' });

  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
    const { status, keyword, category, level } = req.query;
    const offset = (page - 1) * size;
    let where = []; let params = []; let idx = 1;

    if (category) { where.push(`c.disability_category = $${idx++}`); params.push(parseInt(category)); }
    if (level) { where.push(`c.disability_level = $${idx++}`); params.push(parseInt(level)); }
    if (keyword) { where.push(`(c.name ILIKE $${idx} OR c.id_card ILIKE $${idx+1} OR c.cert_no ILIKE $${idx+2} OR c.phone ILIKE $${idx+3})`); params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`); idx += 4; }
    if (status === 'normal') { where.push("CURRENT_DATE < c.valid_to - INTERVAL '1 year'"); }
    else if (status === 'approaching') { where.push("CURRENT_DATE >= c.valid_to - INTERVAL '1 year' AND CURRENT_DATE < c.valid_to"); }
    else if (status === 'expired') { where.push('CURRENT_DATE >= c.valid_to'); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [{ total }] = (await pool.query(`SELECT COUNT(*) AS total FROM certificates c ${whereClause}`, params)).rows;

    const { rows: list } = await pool.query(
      `SELECT c.*,
        CASE WHEN CURRENT_DATE >= c.valid_to THEN '到期' WHEN CURRENT_DATE >= c.valid_to - INTERVAL '1 year' THEN '临期' ELSE '正常' END AS cert_status,
        c.valid_to - CURRENT_DATE AS days_remaining
       FROM certificates c ${whereClause} ORDER BY c.valid_to ASC LIMIT $${idx} OFFSET $${idx+1}`,
      [...params, size, offset]
    );
    res.json({
      code: 200, data: {
        list: list.map(r => ({ ...r, disability_category_name: categoryNames[r.disability_category] || '', disability_level_name: levelNames[r.disability_level] || '' })),
        total, page, size
      }, message: 'ok'
    });
  } catch (err) { console.error(err); res.status(500).json({ code: 500, message: '服务器错误' }); }
};
