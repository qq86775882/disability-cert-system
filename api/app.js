const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('@neondatabase/serverless');
const { parse: parseCSV } = require('csv-parse/sync');

// ── DB ──
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Auth ──
function auth(req, res) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) { res.status(401).json({ code: 401, message: '未授权' }); return null; }
  try { return jwt.verify(h.split(' ')[1], process.env.JWT_SECRET); }
  catch (e) { res.status(401).json({ code: 401, message: 'Token过期' }); return null; }
}

const CAT = { '视力残疾': 1, '听力残疾': 2, '言语残疾': 3, '肢体残疾': 4, '智力残疾': 5, '精神残疾': 6, '多重残疾': 7 };
const CAT_R = { 1: '视力残疾', 2: '听力残疾', 3: '言语残疾', 4: '肢体残疾', 5: '智力残疾', 6: '精神残疾', 7: '多重残疾' };
const LVL = { '一级': 1, '二级': 2, '三级': 3, '四级': 4 };
const LVL_R = { 1: '一级', 2: '二级', 3: '三级', 4: '四级' };

// ── Helpers ──
function pag(req) { return { p: Math.max(1, +req.query.page || 1), s: Math.min(100, Math.max(1, +req.query.size || 20)) }; }
function ok(data, msg) { return { code: 200, data, message: msg || 'ok' }; }

// ═══════════════════ ROUTES ═══════════════════

async function handleLogin(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ code: 405 });
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ code: 400, message: '必填项不能为空' });
  const { rows } = await pool.query('SELECT * FROM users WHERE username=$1 AND status=1', [username]);
  if (!rows.length || !await bcrypt.compare(password, rows[0].password))
    return res.status(401).json({ code: 401, message: '用户名或密码错误' });
  const u = rows[0];
  const token = jwt.sign({ id: u.id, username: u.username, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json(ok({ token, user: { id: u.id, username: u.username, real_name: u.real_name, role: u.role } }));
}

async function handleMe(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ code: 405 });
  const u = auth(req, res); if (!u) return;
  const { rows } = await pool.query('SELECT id,username,real_name,role FROM users WHERE id=$1', [u.id]);
  res.json(ok(rows[0]));
}

async function handleDashboard(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ code: 405 });
  const u = auth(req, res); if (!u) return;
  const [a,b,c] = await Promise.all([
    pool.query('SELECT COUNT(*) AS n FROM certificates'),
    pool.query("SELECT COUNT(*) AS n FROM issuances WHERE status='pending'"),
    pool.query("SELECT COUNT(*) AS n FROM issuances WHERE status='issued' AND DATE_TRUNC('month',issued_date)=DATE_TRUNC('month',NOW())")
  ]);
  const byCat = (await pool.query('SELECT disability_category AS c, COUNT(*) AS n FROM certificates GROUP BY c ORDER BY c')).rows;
  const byLvl = (await pool.query('SELECT disability_level AS l, COUNT(*) AS n FROM certificates GROUP BY l ORDER BY l')).rows;
  const exp = (await pool.query(
    `SELECT COUNT(*) FILTER (WHERE CURRENT_DATE < valid_to - INTERVAL '1 year') AS normal,
            COUNT(*) FILTER (WHERE CURRENT_DATE >= valid_to - INTERVAL '1 year' AND CURRENT_DATE < valid_to) AS approaching,
            COUNT(*) FILTER (WHERE CURRENT_DATE >= valid_to) AS expired FROM certificates`)).rows[0];
  const trend = (await pool.query(
    "SELECT TO_CHAR(issued_date,'YYYY-MM') AS m, COUNT(*) FILTER (WHERE is_reissue=0) AS issue, COUNT(*) FILTER (WHERE is_reissue=1) AS reissue FROM issuances WHERE issued_date >= NOW()-INTERVAL '12 months' AND status='issued' GROUP BY m ORDER BY m")).rows;
  const gender = (await pool.query('SELECT gender,COUNT(*) AS n FROM certificates GROUP BY gender')).rows;
  res.json(ok({
    total_certs: +a.rows[0].n, pending_count: +b.rows[0].n, this_month_issued: +c.rows[0].n,
    normal_count: +exp.normal, approaching_count: +exp.approaching, expired_count: +exp.expired,
    by_category: byCat.map(x => ({ ...x, category_name: CAT_R[x.c] })),
    by_level: byLvl.map(x => ({ ...x, level_name: LVL_R[x.l] })),
    by_gender: gender, monthly_trend: trend
  }));
}

async function handleIssuances(req, res) {
  const u = auth(req, res); if (!u) return;
  if (req.method === 'GET') {
    const { p, s } = pag(req); const off = (p - 1) * s;
    let w = []; let v = []; let i = 1;
    if (req.query.status && req.query.status !== 'all') { w.push(`i.status=$${i++}`); v.push(req.query.status); }
    if (req.query.category) { w.push(`i.disability_category=$${i++}`); v.push(+req.query.category); }
    if (req.query.level) { w.push(`i.disability_level=$${i++}`); v.push(+req.query.level); }
    if (req.query.keyword) { w.push(`(i.name ILIKE $${i} OR i.id_card ILIKE $${i+1} OR i.cert_no ILIKE $${i+2})`); v.push(`%${req.query.keyword}%`, `%${req.query.keyword}%`, `%${req.query.keyword}%`); i += 3; }
    const wh = w.length ? 'WHERE ' + w.join(' AND ') : '';
    const [{ total }] = (await pool.query(`SELECT COUNT(*) AS total FROM issuances i ${wh}`, v)).rows;
    const { rows } = await pool.query(
      `SELECT i.*,u.real_name AS operator_name FROM issuances i LEFT JOIN users u ON i.operator_id=u.id ${wh} ORDER BY i.created_at DESC LIMIT $${i} OFFSET $${i+1}`,
      [...v, s, off]
    );
    res.json(ok({ list: rows.map(r => ({ ...r, disability_category_name: CAT_R[r.disability_category], disability_level_name: LVL_R[r.disability_level] })), total: +total, page: p, size: s }));
  } else if (req.method === 'POST') {
    const { name, gender, id_card, birth_date, disability_category, disability_level, phone, address, guardian, guardian_phone, remark } = req.body;
    if (!name || !gender || !id_card || !disability_category || !disability_level) return res.status(400).json({ code: 400, message: '必填字段不能为空' });
    const { rows } = await pool.query(
      `INSERT INTO issuances (name,gender,id_card,birth_date,disability_category,disability_level,phone,address,guardian,guardian_phone,operator_id,remark) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [name, gender, id_card, birth_date||null, disability_category, disability_level, phone||null, address||null, guardian||null, guardian_phone||null, u.id, remark||null]
    );
    res.json(ok(rows[0], '创建成功'));
  } else res.status(405).json({ code: 405 });
}

async function handleIssuanceDetail(req, res, id) {
  const u = auth(req, res); if (!u) return;
  if (req.method === 'GET') {
    const { rows } = await pool.query('SELECT i.*,u.real_name AS operator_name FROM issuances i LEFT JOIN users u ON i.operator_id=u.id WHERE i.id=$1', [id]);
    if (!rows.length) return res.status(404).json({ code: 404, message: '不存在' });
    res.json(ok({ ...rows[0], disability_category_name: CAT_R[rows[0].disability_category], disability_level_name: LVL_R[rows[0].disability_level] }));
  } else if (req.method === 'PUT') {
    const { name, gender, id_card, birth_date, disability_category, disability_level, phone, address, guardian, guardian_phone, remark } = req.body;
    await pool.query('UPDATE issuances SET name=$1,gender=$2,id_card=$3,birth_date=$4,disability_category=$5,disability_level=$6,phone=$7,address=$8,guardian=$9,guardian_phone=$10,remark=$11,updated_at=NOW() WHERE id=$12',
      [name, gender, id_card, birth_date||null, disability_category, disability_level, phone||null, address||null, guardian||null, guardian_phone||null, remark||null, id]);
    res.json(ok(null, '更新成功'));
  } else res.status(405).json({ code: 405 });
}

async function handleIssue(req, res, id) {
  const u = auth(req, res); if (!u) return;
  if (req.method !== 'POST') return res.status(405).json({ code: 405 });
  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');
    const { rows: [iss] } = await conn.query('SELECT * FROM issuances WHERE id=$1 FOR UPDATE', [id]);
    if (!iss) { await conn.query('ROLLBACK'); return res.status(404).json({ code: 404 }); }
    if (iss.status === 'issued') { await conn.query('ROLLBACK'); return res.status(400).json({ code: 400, message: '已发证' }); }
    const { cert_no, valid_from, valid_to } = req.body;
    if (!cert_no || !valid_from || !valid_to) { await conn.query('ROLLBACK'); return res.status(400).json({ code: 400, message: '证号和有效期必填' }); }
    await conn.query("UPDATE issuances SET status='issued',cert_no=$1,valid_from=$2,valid_to=$3,issued_date=CURRENT_DATE,operator_id=$4,updated_at=NOW() WHERE id=$5", [cert_no, valid_from, valid_to, u.id, id]);
    await conn.query('INSERT INTO certificates (issuance_id,name,gender,id_card,cert_no,disability_category,disability_level,phone,address,valid_from,valid_to,operator_id,is_reissue) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,0)',
      [id, iss.name, iss.gender, iss.id_card, cert_no, iss.disability_category, iss.disability_level, iss.phone, iss.address, valid_from, valid_to, u.id]);
    await conn.query('COMMIT');
    res.json(ok(null, '发证成功'));
  } catch (e) { await conn.query('ROLLBACK'); res.status(500).json({ code: 500, message: e.message }); }
  finally { conn.release(); }
}

async function handleReissue(req, res, id) {
  const u = auth(req, res); if (!u) return;
  if (req.method !== 'POST') return res.status(405).json({ code: 405 });
  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');
    const { rows: [old] } = await conn.query('SELECT * FROM issuances WHERE id=$1 FOR UPDATE', [id]);
    if (!old) { await conn.query('ROLLBACK'); return res.status(404).json({ code: 404 }); }
    if (old.status !== 'issued') { await conn.query('ROLLBACK'); return res.status(400).json({ code: 400, message: '未发证' }); }
    const { cert_no, valid_from, valid_to, remark } = req.body;
    if (!cert_no || !valid_from || !valid_to) { await conn.query('ROLLBACK'); return res.status(400).json({ code: 400, message: '证号和有效期必填' }); }
    const { rows: [nw] } = await conn.query(
      "INSERT INTO issuances (name,gender,id_card,birth_date,disability_category,disability_level,phone,address,guardian,guardian_phone,status,cert_no,valid_from,valid_to,issued_date,is_reissue,prev_cert_id,operator_id,remark) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'issued',$11,$12,$13,CURRENT_DATE,1,$14,$15,$16) RETURNING *",
      [old.name, old.gender, old.id_card, old.birth_date, old.disability_category, old.disability_level, old.phone, old.address, old.guardian, old.guardian_phone, cert_no, valid_from, valid_to, id, u.id, remark||'换证']
    );
    await conn.query('INSERT INTO certificates (issuance_id,name,gender,id_card,cert_no,disability_category,disability_level,phone,address,valid_from,valid_to,operator_id,is_reissue) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,1)',
      [nw.id, old.name, old.gender, old.id_card, cert_no, old.disability_category, old.disability_level, old.phone, old.address, valid_from, valid_to, u.id]);
    await conn.query('COMMIT');
    res.json(ok(null, '换证成功'));
  } catch (e) { await conn.query('ROLLBACK'); res.status(500).json({ code: 500, message: e.message }); }
  finally { conn.release(); }
}

async function handleIssuanceExport(req, res) {
  const u = auth(req, res); if (!u) return;
  if (req.method !== 'GET') return res.status(405).json({ code: 405 });
  let w = []; let v = [];
  if (req.query.status && req.query.status !== 'all') { w.push('status=$1'); v.push(req.query.status); }
  if (req.query.keyword) { w.push('(name ILIKE $2 OR id_card ILIKE $3)'); v.push(`%${req.query.keyword}%`, `%${req.query.keyword}%`); }
  const wh = w.length ? 'WHERE ' + w.join(' AND ') : '';
  const { rows } = await pool.query(`SELECT * FROM issuances ${wh} ORDER BY created_at DESC`, v);
  const csv = '姓名,性别,身份证号,出生日期,残疾类别,残疾等级,电话,地址,监护人,监护人电话,状态,证号,发证日期,有效期起,有效期止,备注\n' +
    rows.map(r => [r.name, r.gender, r.id_card, r.birth_date||'', CAT_R[r.disability_category], LVL_R[r.disability_level], r.phone||'', r.address||'', r.guardian||'', r.guardian_phone||'', r.status, r.cert_no||'', r.issued_date||'', r.valid_from||'', r.valid_to||'', r.remark||''].join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=issuances.csv');
  res.send('\uFEFF' + csv);
}

async function handleIssuanceImport(req, res) {
  const u = auth(req, res); if (!u) return;
  if (req.method !== 'POST') return res.status(405).json({ code: 405 });
  const csvData = (req.body && req.body.data) ? req.body.data : req.body;
  if (!csvData) return res.status(400).json({ code: 400, message: '请提供CSV数据' });
  const recs = parseCSV(csvData, { columns: true, skip_empty_lines: true });
  let cnt = 0;
  for (const r of recs) {
    await pool.query(
      'INSERT INTO issuances (name,gender,id_card,birth_date,disability_category,disability_level,phone,address,guardian,guardian_phone,operator_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [r['姓名']||r.name, r['性别']||r.gender, r['身份证号']||r.id_card, (r['出生日期']||r.birth_date)||null, CAT[r['残疾类别']]||4, LVL[r['残疾等级']]||4, r['电话']||r.phone||null, r['地址']||r.address||null, r['监护人']||r.guardian||null, r['监护人电话']||r.guardian_phone||null, u.id]
    );
    cnt++;
  }
  res.json(ok({ count: cnt }, `成功导入${cnt}条`));
}

async function handleCertificates(req, res) {
  const u = auth(req, res); if (!u) return;
  if (req.method !== 'GET') return res.status(405).json({ code: 405 });
  const { p, s } = pag(req); const off = (p - 1) * s;
  let w = []; let v = []; let i = 1;
  if (req.query.category) { w.push(`c.disability_category=$${i++}`); v.push(+req.query.category); }
  if (req.query.level) { w.push(`c.disability_level=$${i++}`); v.push(+req.query.level); }
  if (req.query.keyword) { w.push(`(c.name ILIKE $${i} OR c.id_card ILIKE $${i+1} OR c.cert_no ILIKE $${i+2})`); v.push(`%${req.query.keyword}%`, `%${req.query.keyword}%`, `%${req.query.keyword}%`); i += 3; }
  if (req.query.status === 'normal') w.push("CURRENT_DATE < c.valid_to - INTERVAL '1 year'");
  else if (req.query.status === 'approaching') w.push("CURRENT_DATE >= c.valid_to - INTERVAL '1 year' AND CURRENT_DATE < c.valid_to");
  else if (req.query.status === 'expired') w.push('CURRENT_DATE >= c.valid_to');
  const wh = w.length ? 'WHERE ' + w.join(' AND ') : '';
  const [{ total }] = (await pool.query(`SELECT COUNT(*) AS total FROM certificates c ${wh}`, v)).rows;
  const { rows } = await pool.query(
    `SELECT c.*, CASE WHEN CURRENT_DATE>=c.valid_to THEN '到期' WHEN CURRENT_DATE>=c.valid_to-INTERVAL '1 year' THEN '临期' ELSE '正常' END AS cert_status, c.valid_to-CURRENT_DATE AS days_remaining FROM certificates c ${wh} ORDER BY c.valid_to ASC LIMIT $${i} OFFSET $${i+1}`,
    [...v, s, off]
  );
  res.json(ok({ list: rows.map(r => ({ ...r, disability_category_name: CAT_R[r.disability_category], disability_level_name: LVL_R[r.disability_level] })), total: +total, page: p, size: s }));
}

async function handleCertificateDetail(req, res, id) {
  const u = auth(req, res); if (!u) return;
  if (req.method === 'GET') {
    const { rows } = await pool.query(
      `SELECT c.*, CASE WHEN CURRENT_DATE>=c.valid_to THEN '到期' WHEN CURRENT_DATE>=c.valid_to-INTERVAL '1 year' THEN '临期' ELSE '正常' END AS cert_status, c.valid_to-CURRENT_DATE AS days_remaining FROM certificates c WHERE c.id=$1`, [id]);
    if (!rows.length) return res.status(404).json({ code: 404, message: '不存在' });
    res.json(ok({ ...rows[0], disability_category_name: CAT_R[rows[0].disability_category], disability_level_name: LVL_R[rows[0].disability_level] }));
  } else if (req.method === 'PUT') {
    const { phone, address, valid_from, valid_to, remark } = req.body;
    await pool.query('UPDATE certificates SET phone=$1,address=$2,valid_from=$3,valid_to=$4,remark=$5,updated_at=NOW() WHERE id=$6',
      [phone||null, address||null, valid_from, valid_to, remark||null, id]);
    res.json(ok(null, '更新成功'));
  } else res.status(405).json({ code: 405 });
}

async function handleAlerts(req, res) {
  const u = auth(req, res); if (!u) return;
  if (req.method !== 'GET') return res.status(405).json({ code: 405 });
  const [{ approaching }] = (await pool.query("SELECT json_agg(t) AS approaching FROM (SELECT * FROM certificates WHERE CURRENT_DATE>=valid_to-INTERVAL '1 year' AND CURRENT_DATE<valid_to ORDER BY valid_to ASC LIMIT 20) t")).rows;
  const [{ expired }] = (await pool.query("SELECT json_agg(t) AS expired FROM (SELECT * FROM certificates WHERE CURRENT_DATE>=valid_to ORDER BY valid_to ASC LIMIT 20) t")).rows;
  res.json(ok({ approaching: approaching || [], expired: expired || [] }));
}

async function handleCertExport(req, res) {
  const u = auth(req, res); if (!u) return;
  if (req.method !== 'GET') return res.status(405).json({ code: 405 });
  let w = []; let v = [];
  if (req.query.keyword) { w.push('(name ILIKE $1 OR id_card ILIKE $2 OR cert_no ILIKE $3)'); v.push(`%${req.query.keyword}%`, `%${req.query.keyword}%`, `%${req.query.keyword}%`); }
  const wh = w.length ? 'WHERE ' + w.join(' AND ') : '';
  const { rows } = await pool.query(`SELECT * FROM certificates ${wh} ORDER BY valid_to ASC`, v);
  const csv = '姓名,性别,身份证号,证号,残疾类别,残疾等级,电话,地址,有效期起,有效期止,换证,备注\n' +
    rows.map(r => [r.name, r.gender, r.id_card, r.cert_no, CAT_R[r.disability_category], LVL_R[r.disability_level], r.phone||'', r.address||'', r.valid_from||'', r.valid_to||'', r.is_reissue?'是':'否', r.remark||''].join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=certificates.csv');
  res.send('\uFEFF' + csv);
}

async function handleCertImport(req, res) {
  const u = auth(req, res); if (!u) return;
  if (req.method !== 'POST') return res.status(405).json({ code: 405 });
  const csvData = (req.body && req.body.data) ? req.body.data : req.body;
  if (!csvData) return res.status(400).json({ code: 400, message: '请提供CSV数据' });
  const recs = parseCSV(csvData, { columns: true, skip_empty_lines: true });
  let cnt = 0;
  for (const r of recs) {
    await pool.query(
      'INSERT INTO certificates (issuance_id,name,gender,id_card,cert_no,disability_category,disability_level,phone,address,valid_from,valid_to,operator_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      [0, r['姓名']||r.name, r['性别']||r.gender, r['身份证号']||r.id_card, r['证号']||r.cert_no, CAT[r['残疾类别']]||4, LVL[r['残疾等级']]||4, r['电话']||r.phone||null, r['地址']||r.address||null, r['有效期起']||r.valid_from, r['有效期止']||r.valid_to, u.id]
    );
    cnt++;
  }
  res.json(ok({ count: cnt }, `成功导入${cnt}条`));
}

// ═══════════════════ ROUTER ═══════════════════

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  try {
    res.json = (data) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
    res.send = (data) => { res.setHeader('Content-Type', res.getHeaders()['content-type'] || 'text/html'); res.end(data); };

    // AUTH
    if (path === '/api/auth/login') return handleLogin(req, res);
    if (path === '/api/auth/me') return handleMe(req, res);

    // DASHBOARD
    if (path === '/api/dashboard/stats') return handleDashboard(req, res);

    // ISSUANCES
    if (path === '/api/issuances') return handleIssuances(req, res);
    if (path === '/api/issuances/export') return handleIssuanceExport(req, res);
    if (path === '/api/issuances/import') return handleIssuanceImport(req, res);
    let m = path.match(/^\/api\/issuances\/(\d+)$/);
    if (m) return handleIssuanceDetail(req, res, m[1]);
    m = path.match(/^\/api\/issuances\/(\d+)\/issue$/);
    if (m) return handleIssue(req, res, m[1]);
    m = path.match(/^\/api\/issuances\/(\d+)\/reissue$/);
    if (m) return handleReissue(req, res, m[1]);

    // CERTIFICATES
    if (path === '/api/certificates') return handleCertificates(req, res);
    if (path === '/api/certificates/alerts') return handleAlerts(req, res);
    if (path === '/api/certificates/export') return handleCertExport(req, res);
    if (path === '/api/certificates/import') return handleCertImport(req, res);
    m = path.match(/^\/api\/certificates\/(\d+)$/);
    if (m) return handleCertificateDetail(req, res, m[1]);

    res.status(404).json({ code: 404, message: 'Not Found' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '服务器错误: ' + e.message });
  }
};
