const auth = require('../../lib/auth');
const pool = require('../../lib/db');
const { parse: parseCSV } = require('csv-parse/sync');

module.exports = async (req, res) => {
  const user = auth(req, res);
  if (!user) return;
  if (req.method !== 'POST') return res.status(405).json({ code: 405, message: 'Method Not Allowed' });

  try {
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    let csvData = body;
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart')) {
      return res.status(400).json({ code: 400, message: '请使用JSON格式发送CSV数据（{data: "csv内容"}）' });
    }
    if (req.body && req.body.data) csvData = req.body.data;

    const records = parseCSV(csvData, { columns: true, skip_empty_lines: true });
    let count = 0;
    for (const r of records) {
      const catMap = { '视力残疾': 1, '听力残疾': 2, '言语残疾': 3, '肢体残疾': 4, '智力残疾': 5, '精神残疾': 6, '多重残疾': 7 };
      const lvlMap = { '一级': 1, '二级': 2, '三级': 3, '四级': 4 };
      await pool.query(
        `INSERT INTO issuances (name, gender, id_card, birth_date, disability_category, disability_level, phone, address, guardian, guardian_phone, operator_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [r['姓名'] || r.name, r['性别'] || r.gender, r['身份证号'] || r.id_card, (r['出生日期'] || r.birth_date) || null,
         catMap[r['残疾类别'] || r.disability_category] || 4, lvlMap[r['残疾等级'] || r.disability_level] || 4,
         r['电话'] || r.phone || null, r['地址'] || r.address || null, r['监护人'] || r.guardian || null, r['监护人电话'] || r.guardian_phone || null, user.id]
      );
      count++;
    }
    res.json({ code: 200, data: { count }, message: `成功导入${count}条记录` });
  } catch (err) { console.error(err); res.status(500).json({ code: 500, message: '导入失败：' + err.message }); }
};
