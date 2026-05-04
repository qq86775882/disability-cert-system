const auth = require('../../lib/auth');
const pool = require('../../lib/db');
const { categoryNames, levelNames } = require('../../lib/constants');

module.exports = async (req, res) => {
  const user = auth(req, res);
  if (!user) return;
  if (req.method !== 'GET') return res.status(405).json({ code: 405, message: 'Method Not Allowed' });
  try {
    const { keyword } = req.query;
    let where = []; let params = []; let idx = 1;
    if (keyword) { where.push(`(c.name ILIKE $${idx} OR c.id_card ILIKE $${idx+1} OR c.cert_no ILIKE $${idx+2})`); params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); idx += 3; }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { rows } = await pool.query(`SELECT * FROM certificates c ${whereClause} ORDER BY c.valid_to ASC`, params);
    const header = '姓名,性别,身份证号,证号,残疾类别,残疾等级,电话,地址,有效期起,有效期止,换证,备注\n';
    const csv = header + rows.map(r => [
      r.name, r.gender, r.id_card, r.cert_no, categoryNames[r.disability_category] || '', levelNames[r.disability_level] || '',
      r.phone || '', r.address || '', r.valid_from || '', r.valid_to || '', r.is_reissue ? '是' : '否', r.remark || ''
    ].join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=certificates.csv');
    res.send('\uFEFF' + csv);
  } catch (err) { console.error(err); res.status(500).json({ code: 500, message: '服务器错误' }); }
};
