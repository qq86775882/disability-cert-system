const auth = require('../../lib/auth');
const pool = require('../../lib/db');
const { categoryNames, levelNames } = require('../../lib/constants');

module.exports = async (req, res) => {
  const user = auth(req, res);
  if (!user) return;
  if (req.method !== 'GET') return res.status(405).json({ code: 405, message: 'Method Not Allowed' });
  try {
    const { status, keyword } = req.query;
    let where = []; let params = []; let idx = 1;
    if (status && status !== 'all') { where.push(`i.status = $${idx++}`); params.push(status); }
    if (keyword) { where.push(`(i.name ILIKE $${idx} OR i.id_card ILIKE $${idx+1})`); params.push(`%${keyword}%`, `%${keyword}%`); idx += 2; }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { rows } = await pool.query(`SELECT * FROM issuances i ${whereClause} ORDER BY i.created_at DESC`, params);
    const header = '姓名,性别,身份证号,出生日期,残疾类别,残疾等级,电话,地址,监护人,监护人电话,状态,证号,发证日期,有效期起,有效期止,备注\n';
    const csv = header + rows.map(r => [
      r.name, r.gender, r.id_card, r.birth_date || '', categoryNames[r.disability_category] || '', levelNames[r.disability_level] || '',
      r.phone || '', r.address || '', r.guardian || '', r.guardian_phone || '', r.status, r.cert_no || '', r.issued_date || '', r.valid_from || '', r.valid_to || '', r.remark || ''
    ].join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=issuances.csv');
    res.send('\uFEFF' + csv);
  } catch (err) { console.error(err); res.status(500).json({ code: 500, message: '服务器错误' }); }
};
