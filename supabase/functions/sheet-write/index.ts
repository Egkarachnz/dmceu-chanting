/* ============================================================
   DMCEU · Edge Function "sheet-write"

   หน้าเว็บหลังบ้าน  ──(Supabase JWT)──▶  ฟังก์ชันนี้  ──(secret)──▶  Apps Script  ──▶  Google Sheet

   ทำไมต้องมีตัวกลาง: admin.html เป็นไฟล์ static ที่ใครก็เปิดดู source ได้
   ถ้ายิงไป Apps Script ตรง ๆ ต้องฝัง URL + secret ไว้ในหน้าเว็บ = ใครก็เขียนทับชีตได้
   ฟังก์ชันนี้เก็บทั้งสองอย่างไว้ฝั่งเซิร์ฟเวอร์ และตรวจสิทธิ์ด้วย is_admin() ตัวเดียวกับทั้งระบบ

   หมายเหตุประสิทธิภาพ: เลี่ยง supabase-js ทั้งก้อน ใช้ fetch ตรงไปที่ PostgREST
   เพราะเวอร์ชันก่อนค้างค้างจนไม่ตอบกลับ (ไม่มีแม้แต่บรรทัด log ของ response)
   ทุกการเรียกออกนอกมี timeout เสมอ จะได้ตอบ error ที่อ่านรู้เรื่องแทนที่จะแขวนไว้
   ============================================================ */

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

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** อีเมลจาก JWT (อ่านในเครื่อง ไม่เรียกเครือข่าย) — ใช้แค่ทำข้อความ error ให้อ่านรู้เรื่อง */
function emailFromJwt(token: string): string {
    try {
        const p = token.split('.')[1];
        const pad = p.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(pad + '='.repeat((4 - pad.length % 4) % 4)));
        return payload.email || '';
    } catch {
        return '';
    }
}

Deno.serve(async (req) => {
    const t0 = Date.now();
    const lap = (step: string) => console.log(`[${Date.now() - t0}ms] ${step}`);

    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ ok: false, error: 'ต้องเป็น POST' }, 405);

    try {
        const auth = req.headers.get('Authorization') ?? '';
        if (!auth.toLowerCase().startsWith('bearer ')) {
            return json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' }, 401);
        }
        const token = auth.slice(7).trim();

        let payload: Record<string, unknown>;
        try {
            payload = await req.json();
        } catch {
            return json({ ok: false, error: 'ข้อมูลที่ส่งมาไม่ใช่ JSON' }, 400);
        }
        delete payload.secret;   // กันไม่ให้ client ส่ง secret ของตัวเองมา

        // ── 1) ตรวจสิทธิ์ + อ่านค่าตั้ง พร้อมกัน (ลดเวลารอจาก 3 รอบเหลือ 1 รอบ) ──
        lap('เริ่มตรวจสิทธิ์');
        const [adminRes, cfgRes] = await Promise.all([
            fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
                method: 'POST',
                headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: '{}',
                signal: AbortSignal.timeout(10000)
            }),
            fetch(`${SUPABASE_URL}/rest/v1/private_config?select=key,value&key=in.(apps_script_url,apps_script_secret)`, {
                headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
                signal: AbortSignal.timeout(10000)
            })
        ]);
        lap(`ตรวจสิทธิ์เสร็จ (is_admin ${adminRes.status}, config ${cfgRes.status})`);

        if (adminRes.status === 401) {
            return json({ ok: false, error: 'หมดเวลาเข้าสู่ระบบ · กรุณาเข้าสู่ระบบใหม่' }, 401);
        }
        if (!adminRes.ok) {
            return json({ ok: false, error: `ตรวจสิทธิ์ไม่สำเร็จ (HTTP ${adminRes.status})` }, 500);
        }
        if (await adminRes.json() !== true) {
            const who = emailFromJwt(token);
            return json({ ok: false, error: `บัญชีนี้ไม่มีสิทธิ์แอดมิน${who ? ` (${who})` : ''}` }, 403);
        }
        if (!cfgRes.ok) {
            return json({ ok: false, error: `อ่านค่าตั้งไม่ได้ (HTTP ${cfgRes.status})` }, 500);
        }

        const cfg: Record<string, string> = {};
        for (const r of await cfgRes.json() as { key: string; value: string }[]) cfg[r.key] = r.value;
        if (!cfg.apps_script_url) {
            return json({ ok: false, error: 'ยังไม่ได้ตั้งค่า Apps Script (apps_script_url ว่างอยู่)' }, 503);
        }

        // ── 2) ส่งต่อไปยัง Apps Script ──
        // Apps Script ตอบ 302 ไปที่ script.googleusercontent.com เสมอ
        // จัดการ redirect เองเพื่อคุม timeout ได้ทีละขั้น และรู้ว่าค้างขั้นไหน
        const body = JSON.stringify({ ...payload, secret: cfg.apps_script_secret });

        lap('ยิงไป Apps Script');
        let res: Response;
        try {
            res = await fetch(cfg.apps_script_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                redirect: 'manual',
                signal: AbortSignal.timeout(20000)
            });
        } catch (e) {
            lap('Apps Script ล้มเหลว');
            return json({ ok: false, error: 'ติดต่อ Google ไม่ได้ (หมดเวลา) · ลองใหม่อีกครั้ง', detail: String(e) }, 504);
        }
        lap(`Apps Script ตอบ ${res.status}`);

        if (res.status >= 300 && res.status < 400) {
            const loc = res.headers.get('location');
            if (!loc) return json({ ok: false, error: 'Google ตอบ redirect แต่ไม่มีปลายทาง' }, 502);
            try {
                res = await fetch(loc, { signal: AbortSignal.timeout(20000) });
            } catch (e) {
                lap('ตาม redirect ไม่สำเร็จ');
                return json({ ok: false, error: 'ติดต่อ Google ไม่ได้ (หมดเวลาตอนรับผล) · ลองใหม่อีกครั้ง', detail: String(e) }, 504);
            }
            lap(`รับผลจาก redirect ${res.status}`);
        }

        const text = await res.text();
        lap(`อ่านผลเสร็จ (${text.length} ตัวอักษร)`);

        let out: unknown;
        try {
            out = JSON.parse(text);
        } catch {
            // Apps Script ที่ deploy ผิด หรือโค้ดมี error จะคืนหน้า HTML ของ Google
            const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
            return json({
                ok: false,
                error: 'Apps Script ตอบกลับมาไม่ใช่ JSON · ตรวจว่า deploy เวอร์ชันล่าสุดแล้ว และตั้งเป็น "ทุกคน"',
                detail: plain
            }, 502);
        }

        return json(out, (out as { ok?: boolean })?.ok === false ? 400 : 200);
    } catch (e) {
        // กันไม่ให้ค้างแบบไม่ตอบอะไรเลย — ต้องมี response ที่มี CORS เสมอ
        console.error('unhandled', e);
        return json({ ok: false, error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์', detail: String(e) }, 500);
    }
});
