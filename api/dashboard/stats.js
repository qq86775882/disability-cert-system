const auth = require('../../lib/auth');
const pool = require('../../lib/db');
const { categoryNames, levelNames } = require('../../lib/constants');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ code: 405, message: 'Method Not Allowed' });
  const user = auth(req, res);
  if (!user) return;
  try {
    const [{ total_certs }] = (await pool.query('SELECT COUNT(*) AS total_certs FROM certificates')).rows;
    const [{ pending_count }] = (await pool.query("SELECT COUNT(*) AS pending_count FROM issuances WHERE status = 'pending'")).rows;
    const [{ this_month_issued }] = (await pool.query(
      "SELECT COUNT(*) AS this_month_issued FROM issuances WHERE status='issued' AND EXTRACT(MONTH FROM issued_date)=EXTRACT(MONTH FROM NOW()) AND EXTRACT(YEAR FROM issued_date)=EXTRACT(YEAR FROM NOW())"
    )).rows;
    const { rows: by_category } = await pool.query(
      'SELECT disability_category AS category, COUNT(*) AS count FROM certificates GROUP BY disability_category ORDER BY disability_category'
    );
    const { rows: by_level } = await pool.query(
      'SELECT disability_level AS level, COUNT(*) AS count FROM certificates GROUP BY disability_level ORDER BY disability_level'
    );
    const [{ normal_count }] = (await pool.query(
      "SELECT COUNT(*) AS normal_count FROM certificates WHERE CURRENT_DATE < valid_to - INTERVAL '1 year'"
    )).rows;
    const [{ approaching_count }] = (await pool.query(
      "SELECT COUNT(*) AS approaching_count FROM certificates WHERE CURRENT_DATE >= valid_to - INTERVAL '1 year' AND CURRENT_DATE < valid_to"
    )).rows;
    const [{ expired_count }] = (await pool.query(
      'SELECT COUNT(*) AS expired_count FROM certificates WHERE CURRENT_DATE >= valid_to'
    )).rows;
    const { rows: monthly_trend } = await pool.query(
      "SELECT TO_CHAR(issued_date, 'YYYY-MM') AS month, COUNT(*) FILTER (WHERE is_reissue=0) AS issue, COUNT(*) FILTER (WHERE is_reissue=1) AS reissue FROM issuances WHERE issued_date >= NOW() - INTERVAL '12 months' AND status='issued' GROUP BY month ORDER BY month"
    );
    const { rows: by_gender } = await pool.query(
      'SELECT gender, COUNT(*) AS count FROM certificates GROUP BY gender'
    );
    res.json({
      code: 200, data: {
        total_certs, pending_count, this_month_issued, normal_count, approaching_count, expired_count,
        by_category: by_category.map(c => ({ ...c, category_name: categoryNames[c.category] || '' })),
        by_level: by_level.map(l => ({ ...l, level_name: levelNames[l.level] || '' })),
        by_gender, monthly_trend
      }, message: 'ok'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
};
