/* ============================================================
   DMCEU · Edge Function "sheet-write"

   หน้าเว็บหลังบ้าน  ──(Supabase JWT)──▶  ฟังก์ชันนี้  ──(secret)──▶  Apps Script  ──▶  Google Sheet

   ทำไมต้องมีตัวกลาง: admin.html เป็นไฟล์ static ที่ใครก็เปิดดู source ได้
   ถ้ายิงไป Apps Script ตรง ๆ ต้องฝัง URL + secret ไว้ในหน้าเว็บ = ใครก็เขียนทับชีตได้
   ฟังก์ชันนี้เก็บทั้งสองอย่างไว้ฝั่งเซิร์ฟเวอร์ และตรวจสิทธิ์ด้วย is_admin() ตัวเดียวกับทั้งระบบ
   ============================================================ */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' }
    });

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ ok: false, error: 'ต้องเป็น POST' }, 405);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // ── 1) ต้องล็อกอินและเป็นแอดมิน ──
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.toLowerCase().startsWith('bearer ')) {
        return json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' }, 401);
    }

    const asUser = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: userErr } = await asUser.auth.getUser();
    if (userErr || !userData?.user) {
        return json({ ok: false, error: 'หมดเวลาเข้าสู่ระบบ · กรุณาเข้าสู่ระบบใหม่' }, 401);
    }

    const { data: isAdmin, error: adminErr } = await asUser.rpc('is_admin');
    if (adminErr) return json({ ok: false, error: 'ตรวจสิทธิ์ไม่สำเร็จ: ' + adminErr.message }, 500);
    if (!isAdmin) return json({ ok: false, error: 'บัญชีนี้ไม่มีสิทธิ์แอดมิน' }, 403);

    // ── 2) อ่าน URL + secret ของ Apps Script (ตาราง private_config อ่านได้เฉพาะ service_role) ──
    const admin = createClient(url, serviceKey);
    const { data: cfgRows, error: cfgErr } = await admin
        .from('private_config').select('key,value')
        .in('key', ['apps_script_url', 'apps_script_secret']);
    if (cfgErr) return json({ ok: false, error: 'อ่านค่าตั้งไม่ได้: ' + cfgErr.message }, 500);

    const cfg: Record<string, string> = {};
    (cfgRows ?? []).forEach((r) => { cfg[r.key] = r.value; });
    if (!cfg.apps_script_url) {
        return json({ ok: false, error: 'ยังไม่ได้ตั้งค่า Apps Script (apps_script_url ว่างอยู่)' }, 503);
    }

    // ── 3) ส่งต่อไปยัง Apps Script ──
    let payload: Record<string, unknown>;
    try {
        payload = await req.json();
    } catch {
        return json({ ok: false, error: 'ข้อมูลที่ส่งมาไม่ใช่ JSON' }, 400);
    }
    delete payload.secret;   // กันไม่ให้ client ส่ง secret ของตัวเองมา

    let res: Response;
    try {
        res = await fetch(cfg.apps_script_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, secret: cfg.apps_script_secret }),
            redirect: 'follow'
        });
    } catch (e) {
        return json({ ok: false, error: 'ติดต่อ Google ไม่ได้: ' + String(e) }, 502);
    }

    const text = await res.text();
    let out: unknown;
    try {
        out = JSON.parse(text);
    } catch {
        // Apps Script ที่ deploy ผิด (เช่นสิทธิ์เข้าถึงไม่ใช่ "ทุกคน") จะคืนหน้า HTML ล็อกอินของ Google
        return json({
            ok: false,
            error: 'Apps Script ตอบกลับมาไม่ใช่ JSON · ตรวจว่า deploy แบบ "ดำเนินการในชื่อ ฉัน" และ "เข้าถึงโดย ทุกคน"',
            status: res.status
        }, 502);
    }

    const okBody = (out as { ok?: boolean })?.ok !== false;
    return json(out, okBody ? 200 : 400);
});
