const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('@neondatabase/serverless');
const { parse: parseCSV } = require('csv-parse/sync');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const CAT = { '视力残疾':1,'听力残疾':2,'言语残疾':3,'肢体残疾':4,'智力残疾':5,'精神残疾':6,'多重残疾':7, 1:'视力残疾',2:'听力残疾',3:'言语残疾',4:'肢体残疾',5:'智力残疾',6:'精神残疾',7:'多重残疾' };
const LVL = { '一级':1,'二级':2,'三级':3,'四级':4, 1:'一级',2:'二级',3:'三级',4:'四级' };

function auth(req,res) {
  const h = req.headers.authorization;
  if(!h||!h.startsWith('Bearer ')) { res.status(401).json({code:401,message:'未授权'}); return null; }
  try { return jwt.verify(h.split(' ')[1], process.env.JWT_SECRET); }
  catch(e) { res.status(401).json({code:401,message:'Token过期'}); return null; }
}

function ok(d,m) { return {code:200, data:d, message:m||'ok'}; }
function pag(q) { return { p:Math.max(1,+q.page||1), s:Math.min(100,Math.max(1,+q.size||20)) }; }

// ═══════════ AUTH ═══════════
async function login(req,res) {
  if(req.method!=='POST') return res.status(405).json({code:405});
  const {username,password}=req.body;
  if(!username||!password) return res.status(400).json({code:400,message:'必填项不能为空'});
  const {rows}=await pool.query('SELECT * FROM users WHERE username=$1 AND status=1',[username]);
  if(!rows.length||!await bcrypt.compare(password,rows[0].password))
    return res.status(401).json({code:401,message:'用户名或密码错误'});
  const u=rows[0];
  const token=jwt.sign({id:u.id,username:u.username,role:u.role},process.env.JWT_SECRET,{expiresIn:'7d'});
  res.json(ok({token,user:{id:u.id,username:u.username,real_name:u.real_name,role:u.role}}));
}
async function me(req,res) {
  const u=auth(req,res); if(!u) return;
  const {rows}=await pool.query('SELECT id,username,real_name,role FROM users WHERE id=$1',[u.id]);
  res.json(ok(rows[0]));
}

// ═══════════ DASHBOARD ═══════════
async function dashboard(req,res) {
  const u=auth(req,res); if(!u) return;
  const [t,a,b,c] = await Promise.all([
    pool.query('SELECT COUNT(*) n FROM certificates'),
    pool.query("SELECT COUNT(*) n FROM certificates WHERE CURRENT_DATE >= valid_to - INTERVAL '90 days' AND CURRENT_DATE < valid_to"),
    pool.query('SELECT COUNT(*) n FROM certificates WHERE CURRENT_DATE >= valid_to'),
    pool.query("SELECT COUNT(*) n FROM issuances WHERE status='pending'"),
  ]);
  const byCat = (await pool.query('SELECT disability_category c,COUNT(*) n FROM certificates GROUP BY c ORDER BY c')).rows;
  const byVil = (await pool.query('SELECT village_code c,village_name n,COUNT(*) x FROM certificates WHERE village_code!=\'\' GROUP BY village_code,village_name ORDER BY x DESC LIMIT 10')).rows;
  res.json(ok({
    total: +t.rows[0].n, expiring: +a.rows[0].n, expired: +b.rows[0].n, pending_issuance: +c.rows[0].n,
    by_category: byCat.map(r=>({category:r.c,category_name:CAT[r.c],count:+r.n})),
    by_village: byVil.map(r=>({code:r.c,name:r.n,count:+r.x})),
  }));
}

// ═══════════ VILLAGES ═══════════
async function getVillages(req,res) {
  const u=auth(req,res); if(!u) return;
  const {rows}=await pool.query('SELECT code,name FROM villages ORDER BY code');
  res.json(ok(rows));
}

// ═══════════ CERTIFICATES (残疾人证管理) ═══════════
async function listCertificates(req,res) {
  const u=auth(req,res); if(!u) return;
  const {p,s}=pag(req.query); const off=(p-1)*s;
  let w=[],v=[],i=1;
  if(req.query.category){w.push(`disability_category=$${i++}`);v.push(+req.query.category);}
  if(req.query.level){w.push(`disability_level=$${i++}`);v.push(+req.query.level);}
  if(req.query.status){w.push(`status=$${i++}`);v.push(req.query.status);}
  if(req.query.village_code){w.push(`village_code=$${i++}`);v.push(req.query.village_code);}
  if(req.query.keyword){w.push(`(name ILIKE $${i} OR id_card ILIKE $${i+1} OR cert_no ILIKE $${i+2})`);v.push(`%${req.query.keyword}%`,`%${req.query.keyword}%`,`%${req.query.keyword}%`);i+=3;}
  const wh=w.length?'WHERE '+w.join(' AND '):'';
  const [{total}]= (await pool.query(`SELECT COUNT(*) total FROM certificates ${wh}`,v)).rows;
  const {rows}=await pool.query(
    `SELECT *, CASE WHEN CURRENT_DATE>=valid_to THEN 'expired' WHEN CURRENT_DATE>=valid_to-INTERVAL'90 days' THEN 'expiring' ELSE status END display_status, valid_to-CURRENT_DATE days_left FROM certificates ${wh} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i+1}`,
    [...v,s,off]
  );
  res.json(ok({list:rows.map(r=>({...r,category_name:CAT[r.disability_category],level_name:LVL[r.disability_level]})),total:+total,page:p,size:s}));
}

async function getCertificate(req,res,id) {
  const u=auth(req,res); if(!u) return;
  const {rows}=await pool.query('SELECT * FROM certificates WHERE id=$1',[id]);
  if(!rows.length) return res.status(404).json({code:404,message:'不存在'});
  const r=rows[0];
  res.json(ok({...r,category_name:CAT[r.disability_category],level_name:LVL[r.disability_level],days_left:r.valid_to?Math.ceil((new Date(r.valid_to)-new Date())/(86400000)):null}));
}

async function updateCertificate(req,res,id) {
  const u=auth(req,res); if(!u) return;
  const d=req.body;
  await pool.query(
    `UPDATE certificates SET name=$1,gender=$2,id_card=$3,birth_date=$4,phone=$5,address=$6,village_code=$7,village_name=$8,guardian=$9,guardian_phone=$10,disability_category=$11,disability_level=$12,valid_from=$13,valid_to=$14,remark=$15,updated_at=NOW() WHERE id=$16`,
    [d.name,d.gender,d.id_card,d.birth_date||null,d.phone||'',d.address||'',d.village_code||'',d.village_name||'',d.guardian||'',d.guardian_phone||'',d.disability_category,d.disability_level,d.valid_from,d.valid_to,d.remark||'',id]);
  res.json(ok(null,'更新成功'));
}

async function lookupByIdCard(req,res) {
  const u=auth(req,res); if(!u) return;
  const id_card=req.query.id_card;
  if(!id_card) return res.status(400).json({code:400,message:'请提供身份证号'});
  const {rows}=await pool.query('SELECT * FROM certificates WHERE id_card=$1 ORDER BY created_at DESC LIMIT 1',[id_card]);
  if(!rows.length) return res.json(ok(null,'未找到此人'));
  const r=rows[0];
  res.json(ok({...r,category_name:CAT[r.disability_category],level_name:LVL[r.disability_level]}));
}

async function exportCertificates(req,res) {
  const u=auth(req,res); if(!u) return;
  let w=[],v=[],i=1;
  if(req.query.village_code){w.push(`village_code=$${i++}`);v.push(req.query.village_code);}
  if(req.query.status){w.push(`status=$${i++}`);v.push(req.query.status);}
  const wh=w.length?'WHERE '+w.join(' AND '):'';
  const {rows}=await pool.query(`SELECT * FROM certificates ${wh} ORDER BY village_code,created_at DESC`,v);
  const csv='证号,姓名,性别,身份证号,出生日期,电话,地址,村委会编码,村委会,监护人,监护人电话,残疾类别,残疾等级,状态,有效期起,有效期止,备注\n'+
    rows.map(r=>[r.cert_no,r.name,r.gender,r.id_card,r.birth_date||'',r.phone,r.address,r.village_code,r.village_name,r.guardian,r.guardian_phone,CAT[r.disability_category],LVL[r.disability_level],r.status,r.valid_from||'',r.valid_to||'',r.remark].join(',')).join('\n');
  res.setHeader('Content-Type','text/csv;charset=utf-8');
  res.setHeader('Content-Disposition',`attachment;filename=certificates_${new Date().toISOString().slice(0,10)}.csv`);
  res.end('\uFEFF'+csv);
}

function certificateTemplate(req,res) {
  res.setHeader('Content-Type','text/csv;charset=utf-8');
  res.setHeader('Content-Disposition','attachment;filename=certificate_template.csv');
  res.end('\uFEFF姓名,性别(男/女),身份证号,出生日期(YYYY-MM-DD),电话,地址,村委会编码,村委会,监护人,监护人电话,残疾类别(视力/听力/言语/肢体/智力/精神/多重),残疾等级(一级/二级/三级/四级),有效期起(YYYY-MM-DD),有效期止(YYYY-MM-DD),备注\n张三,男,110101199001011234,1990-01-01,13800001111,XX省XX市XX镇,VC001,阳光村委会,,,肢体残疾,三级,2025-01-01,2027-12-31,示例数据');
}

async function importCertificates(req,res) {
  const u=auth(req,res); if(!u) return;
  const csvData=(req.body&&req.body.data)?req.body.data:req.body;
  if(!csvData) return res.status(400).json({code:400,message:'请提供CSV数据'});
  const recs=parseCSV(csvData,{columns:true,skip_empty_lines:true});
  let cnt=0,errs=[];
  for(let i=0;i<recs.length;i++){
    const r=recs[i];
    try{
      const catVal=CAT[r['残疾类别']]||CAT[r['残疾类别(视力/听力/言语/肢体/智力/精神/多重)']]||4;
      const lvlVal=LVL[r['残疾等级']]||LVL[r['残疾等级(一级/二级/三级/四级)']]||4;
      const {rows:[c]}=await pool.query(
        `INSERT INTO certificates (name,gender,id_card,birth_date,phone,address,village_code,village_name,guardian,guardian_phone,disability_category,disability_level,status,valid_from,valid_to,operator_id,remark)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'normal',$13,$14,$15,$16) RETURNING id`,
        [r['姓名'],(r['性别(男/女)']||r['性别']),r['身份证号'],(r['出生日期(YYYY-MM-DD)']||r['出生日期'])||null,r['电话']||'',r['地址']||'',r['村委会编码']||'',r['村委会']||'',r['监护人']||'',r['监护人电话']||'',catVal,lvlVal,(r['有效期起(YYYY-MM-DD)']||r['有效期起'])||null,(r['有效期止(YYYY-MM-DD)']||r['有效期止'])||null,u.id,r['备注']||'']);
      const cid=c.id;
      await pool.query("UPDATE certificates SET cert_no=$1 WHERE id=$2",['ZJ'+String(cid+2025000000).slice(-10),cid]);
      cnt++;
      // 同步到 village 表
      if(r['村委会编码'] && r['村委会']){
        await pool.query('INSERT INTO villages (code,name) VALUES ($1,$2) ON CONFLICT (code) DO NOTHING',[r['村委会编码'],r['村委会']]);
      }
    }catch(e){ errs.push(`第${i+1}行: ${e.message}`); }
  }
  res.json(ok({count:cnt,errors:errs},`成功导入${cnt}条`+(errs.length?`，${errs.length}条失败`:'')));
}

// ═══════════ ISSUANCES (发证管理) ═══════════
async function listIssuances(req,res) {
  const u=auth(req,res); if(!u) return;
  const {p,s}=pag(req.query); const off=(p-1)*s;
  let w=[],v=[],i=1;
  if(req.query.status){w.push(`status=$${i++}`);v.push(req.query.status);}
  if(req.query.type){w.push(`type=$${i++}`);v.push(req.query.type);}
  if(req.query.village_code){w.push(`village_code=$${i++}`);v.push(req.query.village_code);}
  if(req.query.keyword){w.push(`(name ILIKE $${i} OR id_card ILIKE $${i+1} OR cert_no ILIKE $${i+2})`);v.push(`%${req.query.keyword}%`,`%${req.query.keyword}%`,`%${req.query.keyword}%`);i+=3;}
  const wh=w.length?'WHERE '+w.join(' AND '):'';
  const [{total}]= (await pool.query(`SELECT COUNT(*) total FROM issuances ${wh}`,v)).rows;
  const {rows}=await pool.query(
    `SELECT * FROM issuances ${wh} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i+1}`,
    [...v,s,off]
  );
  res.json(ok({list:rows.map(r=>({...r,category_name:CAT[r.disability_category],level_name:LVL[r.disability_level]})),total:+total,page:p,size:s}));
}

async function createIssuance(req,res) {
  const u=auth(req,res); if(!u) return;
  if(req.method!=='POST') return res.status(405).json({code:405});
  const d=req.body;
  if(!d.name||!d.id_card||!d.disability_category||!d.disability_level)
    return res.status(400).json({code:400,message:'姓名、身份证号、残疾类别、残疾等级为必填项'});
  const {rows}=await pool.query(
    `INSERT INTO issuances (name,gender,id_card,birth_date,phone,address,village_code,village_name,guardian,guardian_phone,disability_category,disability_level,type,status,operator_id,remark)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',$14,$15) RETURNING *`,
    [d.name,d.gender,d.id_card,d.birth_date||null,d.phone||'',d.address||'',d.village_code||'',d.village_name||'',d.guardian||'',d.guardian_phone||'',d.disability_category,d.disability_level,d.type||'new',u.id,d.remark||'']
  );
  const r=rows[0];
  await pool.query("UPDATE issuances SET timeline=$1 WHERE id=$2",
    [JSON.stringify([{time:new Date().toISOString().slice(0,10),action:'提交申请',operator:u.username}]),r.id]);
  // 同步到 village 表
  if(d.village_code && d.village_name){
    await pool.query('INSERT INTO villages (code,name) VALUES ($1,$2) ON CONFLICT (code) DO NOTHING',[d.village_code,d.village_name]);
  }
  res.json(ok(r,'创建成功，待审核'));
}

async function getIssuance(req,res,id) {
  const u=auth(req,res); if(!u) return;
  const {rows}=await pool.query('SELECT * FROM issuances WHERE id=$1',[id]);
  if(!rows.length) return res.status(404).json({code:404,message:'不存在'});
  res.json(ok({...rows[0],category_name:CAT[rows[0].disability_category],level_name:LVL[rows[0].disability_level]}));
}

async function approveIssuance(req,res,id) {
  const u=auth(req,res); if(!u) return;
  await pool.query(
    "UPDATE issuances SET status='approved',reviewer_id=$1,updated_at=NOW(),timeline=timeline||$2::jsonb WHERE id=$3",
    [u.id,JSON.stringify([{time:new Date().toISOString().slice(0,10),action:'审核通过',operator:u.username}]),id]);
  res.json(ok(null,'审核通过'));
}

async function rejectIssuance(req,res,id) {
  const u=auth(req,res); if(!u) return;
  const reason=req.body.reason||'';
  await pool.query(
    "UPDATE issuances SET status='rejected',reviewer_id=$1,reject_reason=$2,updated_at=NOW(),timeline=timeline||$3::jsonb WHERE id=$4",
    [u.id,reason,JSON.stringify([{time:new Date().toISOString().slice(0,10),action:'审核驳回',operator:u.username,reason}]),id]);
  res.json(ok(null,'已驳回'));
}

async function issueCertificate(req,res,id) {
  const u=auth(req,res); if(!u) return;
  const conn=await pool.connect();
  try{
    await conn.query('BEGIN');
    const {rows:[iss]}=await conn.query('SELECT * FROM issuances WHERE id=$1 FOR UPDATE',[id]);
    if(!iss){await conn.query('ROLLBACK');return res.status(404).json({code:404});}
    if(iss.status!=='approved'){await conn.query('ROLLBACK');return res.status(400).json({code:400,message:'需审核通过后才能发证'});}
    const {cert_no,valid_from,valid_to}=req.body;
    if(!cert_no||!valid_from||!valid_to){await conn.query('ROLLBACK');return res.status(400).json({code:400,message:'证号和有效期必填'});}

    if(iss.type==='new'){
      const {rows:[nc]}=await conn.query(
        `INSERT INTO certificates (cert_no,name,gender,id_card,birth_date,phone,address,village_code,village_name,guardian,guardian_phone,disability_category,disability_level,status,valid_from,valid_to,operator_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'normal',$14,$15,$16) RETURNING id`,
        [cert_no,iss.name,iss.gender,iss.id_card,iss.birth_date,iss.phone,iss.address,iss.village_code,iss.village_name,iss.guardian,iss.guardian_phone,iss.disability_category,iss.disability_level,valid_from,valid_to,u.id]);
      await conn.query("UPDATE issuances SET cert_id=$1,cert_no=$2,status='issued',valid_from=$3,valid_to=$4,timeline=timeline||$5::jsonb WHERE id=$6",
        [nc.id,cert_no,valid_from,valid_to,JSON.stringify([{time:new Date().toISOString().slice(0,10),action:'发证',operator:u.username}]),id]);
    }else{
      const {rows:[old]}=await conn.query('SELECT * FROM certificates WHERE id_card=$1 ORDER BY created_at DESC LIMIT 1',[iss.id_card]);
      if(old){
        await conn.query("UPDATE certificates SET status='renewed',updated_at=NOW() WHERE id=$1",[old.id]);
        const {rows:[nc]}=await conn.query(
          `INSERT INTO certificates (cert_no,name,gender,id_card,birth_date,phone,address,village_code,village_name,guardian,guardian_phone,disability_category,disability_level,status,valid_from,valid_to,prev_version,version,operator_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'normal',$14,$15,$16,$17,$18) RETURNING id`,
          [cert_no,iss.name,iss.gender,iss.id_card,iss.birth_date,iss.phone,iss.address,iss.village_code,iss.village_name,iss.guardian,iss.guardian_phone,old.disability_category,old.disability_level,valid_from,valid_to,old.id,(old.version||1)+1,u.id]);
        await conn.query("UPDATE issuances SET cert_id=$1,cert_no=$2,status='issued',valid_from=$3,valid_to=$4,timeline=timeline||$5::jsonb WHERE id=$6",
          [nc.id,cert_no,valid_from,valid_to,JSON.stringify([{time:new Date().toISOString().slice(0,10),action:'换证',operator:u.username}]),id]);
      }
    }
    await conn.query('COMMIT');
    res.json(ok(null,'发证成功'));
  }catch(e){await conn.query('ROLLBACK');res.status(500).json({code:500,message:e.message});}
  finally{conn.release();}
}

async function exportIssuances(req,res) {
  const u=auth(req,res); if(!u) return;
  let w=[],v=[],i=1;
  if(req.query.village_code){w.push(`village_code=$${i++}`);v.push(req.query.village_code);}
  if(req.query.status){w.push(`status=$${i++}`);v.push(req.query.status);}
  const wh=w.length?'WHERE '+w.join(' AND '):'';
  const {rows}=await pool.query(`SELECT * FROM issuances ${wh} ORDER BY village_code,created_at DESC`,v);
  const csv='姓名,性别,身份证号,出生日期,电话,地址,村委会编码,村委会,监护人,监护人电话,残疾类别,残疾等级,类型,状态,证号,有效期起,有效期止,备注\n'+
    rows.map(r=>[r.name,r.gender,r.id_card,r.birth_date||'',r.phone,r.address,r.village_code,r.village_name,r.guardian,r.guardian_phone,CAT[r.disability_category],LVL[r.disability_level],r.type==='new'?'新办':r.type==='renew'?'换证':'补办',r.status==='pending'?'待审核':r.status==='approved'?'已审核':r.status==='rejected'?'已驳回':'已发证',r.cert_no||'',r.valid_from||'',r.valid_to||'',r.remark].join(',')).join('\n');
  res.setHeader('Content-Type','text/csv;charset=utf-8');
  res.setHeader('Content-Disposition',`attachment;filename=issuances_${new Date().toISOString().slice(0,10)}.csv`);
  res.end('\uFEFF'+csv);
}

function issuanceTemplate(req,res) {
  res.setHeader('Content-Type','text/csv;charset=utf-8');
  res.setHeader('Content-Disposition','attachment;filename=issuance_template.csv');
  res.end('\uFEFF姓名,性别(男/女),身份证号,出生日期(YYYY-MM-DD),电话,地址,村委会编码,村委会,监护人,监护人电话,残疾类别(视力/听力/言语/肢体/智力/精神/多重),残疾等级(一级/二级/三级/四级),类型(新办/换证/补办),备注\n张三,男,110101199001011234,1990-01-01,13800001111,XX省XX市XX镇,VC001,阳光村委会,,,肢体残疾,三级,新办,示例数据');
}

async function importIssuances(req,res) {
  const u=auth(req,res); if(!u) return;
  const csvData=(req.body&&req.body.data)?req.body.data:req.body;
  if(!csvData) return res.status(400).json({code:400,message:'请提供CSV数据'});
  const recs=parseCSV(csvData,{columns:true,skip_empty_lines:true});
  let cnt=0,errs=[];
  for(let i=0;i<recs.length;i++){
    const r=recs[i];
    try{
      const typeMap={新办:'new',换证:'renew',补办:'reissue'};
      await pool.query(
        `INSERT INTO issuances (name,gender,id_card,birth_date,phone,address,village_code,village_name,guardian,guardian_phone,disability_category,disability_level,type,status,operator_id,remark)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',$14,$15)`,
        [r['姓名'],r['性别(男/女)']||r['性别'],r['身份证号'],(r['出生日期(YYYY-MM-DD)']||r['出生日期'])||null,r['电话']||'',r['地址']||'',r['村委会编码']||'',r['村委会']||'',r['监护人']||'',r['监护人电话']||'',
         CAT[r['残疾类别(视力/听力/言语/肢体/智力/精神/多重)']]||CAT[r['残疾类别']]||4, LVL[r['残疾等级(一级/二级/三级/四级)']]||LVL[r['残疾等级']]||4,
         typeMap[r['类型(新办/换证/补办)']]||typeMap[r['类型']]||'new', u.id, r['备注']||'']
      );
      if(r['村委会编码'] && r['村委会']){
        await pool.query('INSERT INTO villages (code,name) VALUES ($1,$2) ON CONFLICT (code) DO NOTHING',[r['村委会编码'],r['村委会']]);
      }
      cnt++;
    }catch(e){errs.push(`第${i+1}行: ${e.message}`);}
  }
  res.json(ok({count:cnt,errors:errs},`成功导入${cnt}条`+(errs.length?`，${errs.length}条失败`:'')));
}

// ═══════════ ROUTER ═══════════
module.exports = async (req,res) => {
  const url=new URL(req.url,'http://localhost'); const p=url.pathname;
  try{
    // AUTH
    if(p==='/api/auth/login') return login(req,res);
    if(p==='/api/auth/me') return me(req,res);
    // DASHBOARD
    if(p==='/api/dashboard/stats') return dashboard(req,res);
    // VILLAGES
    if(p==='/api/villages') return getVillages(req,res);
    // CERTIFICATES
    if(p==='/api/certificates' && req.method==='GET') return listCertificates(req,res);
    if(p==='/api/certificates/lookup') return lookupByIdCard(req,res);
    if(p==='/api/certificates/export') return exportCertificates(req,res);
    if(p==='/api/certificates/template') return certificateTemplate(req,res);
    if(p==='/api/certificates/import') return importCertificates(req,res);
    let m=p.match(/^\/api\/certificates\/(\d+)$/);
    if(m && req.method==='GET') return getCertificate(req,res,m[1]);
    if(m && req.method==='PUT') return updateCertificate(req,res,m[1]);
    // ISSUANCES
    if(p==='/api/issuances' && req.method==='GET') return listIssuances(req,res);
    if(p==='/api/issuances' && req.method==='POST') return createIssuance(req,res);
    if(p==='/api/issuances/export') return exportIssuances(req,res);
    if(p==='/api/issuances/template') return issuanceTemplate(req,res);
    if(p==='/api/issuances/import') return importIssuances(req,res);
    m=p.match(/^\/api\/issuances\/(\d+)$/);
    if(m && req.method==='GET') return getIssuance(req,res,m[1]);
    m=p.match(/^\/api\/issuances\/(\d+)\/approve$/);
    if(m) return approveIssuance(req,res,m[1]);
    m=p.match(/^\/api\/issuances\/(\d+)\/reject$/);
    if(m) return rejectIssuance(req,res,m[1]);
    m=p.match(/^\/api\/issuances\/(\d+)\/issue$/);
    if(m) return issueCertificate(req,res,m[1]);
    // 404
    res.status(404).json({code:404,message:'Not Found'});
  }catch(e){
    console.error(e);
    res.status(500).json({code:500,message:'服务器错误: '+e.message});
  }
};
