const auth = require('../../lib/auth');
const pool = require('../../lib/db');
const { parse: parseCSV } = require('csv-parse/sync');

module.exports = async (req, res) => {
  const user = auth(req, res);
  if (!user) return;
  if (req.method !== 'POST') return res.status(405).json({ code: 405, message: 'Method Not Allowed' });

  try {
    let csvData = req.body && req.body.data ? req.body.data : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    const records = parseCSV(csvData, { columns: true, skip_empty_lines: true });
    let count = 0;
    const catMap = { '视力残疾': 1, '听力残疾': 2, '言语残疾': 3, '肢体残疾': 4, '智力残疾': 5, '精神残疾': 6, '多重残疾': 7 };
    const lvlMap = { '一级': 1, '二级': 2, '三级': 3, '四级': 4 };
    for (const r of records) {
      await pool.query(
        `INSERT INTO certificates (issuance_id, name, gender, id_card, cert_no, disability_category, disability_level, phone, address, valid_from, valid_to, operator_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [0, r['姓名'] || r.name, r['性别'] || r.gender, r['身份证号'] || r.id_card, r['证号'] || r.cert_no,
         catMap[r['残疾类别'] || r.disability_category] || 4, lvlMap[r['残疾等级'] || r.disability_level] || 4,
         r['电话'] || r.phone || null, r['地址'] || r.address || null,
         r['有效期起'] || r.valid_from, r['有效期止'] || r.valid_to, user.id]
      );
      count++;
    }
    res.json({ code: 200, data: { count }, message: `成功导入${count}条记录` });
  } catch (err) { console.error(err); res.status(500).json({ code: 500, message: '导入失败：' + err.message }); }
};
