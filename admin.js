/* ============================================================
   DMCEU · หลังบ้านทีมงาน (admin.js)
   · ล็อกอินด้วยอีเมล/รหัสผ่านของ Supabase Auth
   · สิทธิ์แอดมินคุมที่ฐานข้อมูล (ตาราง admin_users + RLS) ไม่ใช่ที่หน้าเว็บ
   · รูปเก็บใน Storage bucket "events", ข้อมูลในตาราง "events"
   ============================================================ */

const SUPA = {
    url: 'https://apjgwbwdzkxadbcutuxt.supabase.co',
    key: 'sb_publishable_2LvhHxTNRxdjKlQVNg-AkQ_10ZEiHTK',
    bucket: 'events'
};
const IMG_MAX_SIDE = 2000;      // ย่อรูปให้ด้านยาวไม่เกินนี้ก่อนอัปโหลด
const IMG_QUALITY  = 0.86;

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = n => `<svg class="ic"><use href="#i-${n}"/></svg>`;

const db = window.supabase.createClient(SUPA.url, SUPA.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});

function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2800);
}
function showError(sel, msg) {
    const el = $(sel);
    el.hidden = !msg;
    el.querySelector('span').textContent = msg || '';
}
const publicUrl = path => `${SUPA.url}/storage/v1/object/public/${SUPA.bucket}/${path}`;
const fmtBytes = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';
const fmtDate = iso => new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });

/* ─── ธีม (ใช้ค่าเดียวกับแอปหลัก) ─── */
function applyTheme(pref) {
    const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const mode = pref === 'auto' ? (sysDark ? 'dark' : 'light') : pref;
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.setAttribute('data-theme-pref', pref);
    localStorage.setItem('theme', pref);
    $('#meta-theme-color').content = mode === 'dark' ? '#080b16' : '#141a33';
}
$('#themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === 'dark' ? 'light' : 'dark');
});
applyTheme(localStorage.getItem('theme') || 'auto');
window.addEventListener('scroll', () => $('#appbar').classList.toggle('scrolled', window.scrollY > 4), { passive: true });

/* ─── อัปเดตเองเมื่อกลับเข้าแอป ───
   แอปที่กด "เพิ่มไปยังหน้าจอโฮม" บน iPhone จะค้างหน้าเดิมไว้ในหน่วยความจำ
   เปิดกลับเข้ามาอีกทีก็ยังเป็นโค้ดเวอร์ชันเก่า จนกว่าจะลบไอคอนแล้วเพิ่มใหม่
   จึงเทียบเลขเวอร์ชันกับไฟล์บนเซิร์ฟเวอร์ให้เอง ถ้าไม่ตรงค่อยโหลดใหม่ */
const APP_V = (() => {
    const tag = document.querySelector('script[src*="admin.js"]');
    const m = tag && tag.getAttribute('src').match(/v=(\d+)/);
    return m ? m[1] : '';
})();
let lastVerCheck = 0;

async function newVersionOnServer() {
    const res = await fetch('admin.html', { cache: 'no-store' });
    const m = (await res.text()).match(/admin\.js\?v=(\d+)/);
    return m && m[1] !== APP_V ? m[1] : null;
}

document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || !APP_V) return;
    if (Date.now() - lastVerCheck < 60000) return;      // ไม่ถามถี่เกินไป
    lastVerCheck = Date.now();

    // ห้ามรีเฟรชทับงานที่ค้างอยู่ — ถ้าหน้าล็อกอินเปิดอยู่ มีโมดัลเปิดอยู่ กำลังพิมพ์
    // หรือมีช่องไหนมีข้อความที่กรอกไว้แล้ว ให้ข้ามไป (สลับไปแอปอื่นแล้วกลับมาก็ไม่ล้างฟอร์ม)
    if (!$('#authView').hidden) return;
    if (document.querySelector('dialog[open]')) return;
    const el = document.activeElement;
    if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    if ($$('input:not([type=file]):not([type=hidden]), textarea').some(f => f.value && f.offsetParent)) return;

    try {
        const v = await newVersionOnServer();
        if (!v) return;
        // รีเฟรชได้ครั้งเดียวต่อเวอร์ชัน กันวนซ้ำถ้า iOS ยังส่งหน้าเก่าจากแคชกลับมา
        let done = '';
        try { done = sessionStorage.getItem('dmceu.admin.reloadedFor') || ''; } catch (e) {}
        if (done === v) return;
        try { sessionStorage.setItem('dmceu.admin.reloadedFor', v); } catch (e) {}
        location.reload();
    } catch (e) { /* ออฟไลน์อยู่ ไว้ค่อยเช็กรอบหน้า */ }
});

/* ─── รีพอร์ตวัดที่ยังไม่มีข้อมูล (วาดเป็นรูป PNG) ───
   "ยังไม่มีข้อมูล" = คิวที่ช่องพระอาจารย์ หรือ หัวข้อเทศน์ ยังว่างในชีต
   วาดด้วย canvas เองเพื่อได้รูปเดียวกันทุกเครื่อง ไม่ต้องพึ่งไลบรารี */
const reportModal = $('#reportModal');
let reportUrl = null, reportFile = null;

function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

/* ไอคอนวาดด้วยเส้นเอง (ไม่ใช้อีโมจิ เพราะหน้าตาต่างกันไปตามเครื่อง) — กล่อง s×s ที่ตำแหน่ง x,y */
const RPT_ICON = {
    calendar(c, x, y, s, col) {
        c.save(); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = s * 0.075; c.lineCap = 'round';
        rrect(c, x + s * .1, y + s * .18, s * .8, s * .72, s * .14); c.stroke();
        c.beginPath(); c.moveTo(x + s * .1, y + s * .42); c.lineTo(x + s * .9, y + s * .42); c.stroke();
        c.beginPath(); c.moveTo(x + s * .32, y + s * .07); c.lineTo(x + s * .32, y + s * .29);
        c.moveTo(x + s * .68, y + s * .07); c.lineTo(x + s * .68, y + s * .29); c.stroke();
        [[.3, .58], [.5, .58], [.7, .58], [.3, .74], [.5, .74]].forEach(d => {
            c.beginPath(); c.arc(x + s * d[0], y + s * d[1], s * .042, 0, 7); c.fill();
        });
        c.restore();
    },
    temple(c, x, y, s, col) {
        c.save(); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = s * 0.075; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath(); c.moveTo(x + s * .5, y + s * .06); c.lineTo(x + s * .5, y + s * .2); c.stroke();      // ยอด
        c.beginPath(); c.moveTo(x + s * .5, y + s * .2); c.lineTo(x + s * .92, y + s * .5);
        c.lineTo(x + s * .08, y + s * .5); c.closePath(); c.fill();                                           // หลังคา
        c.beginPath(); c.moveTo(x + s * .22, y + s * .56); c.lineTo(x + s * .22, y + s * .82);
        c.moveTo(x + s * .5, y + s * .56); c.lineTo(x + s * .5, y + s * .82);
        c.moveTo(x + s * .78, y + s * .56); c.lineTo(x + s * .78, y + s * .82); c.stroke();                  // เสา
        c.fillRect(x + s * .08, y + s * .84, s * .84, s * .08);                                               // ฐาน
        c.restore();
    },
    check(c, x, y, s, col) {
        c.save(); c.strokeStyle = col; c.lineWidth = s * 0.08; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath(); c.arc(x + s / 2, y + s / 2, s * .4, 0, 7); c.stroke();
        c.beginPath(); c.moveTo(x + s * .3, y + s * .52); c.lineTo(x + s * .45, y + s * .66); c.lineTo(x + s * .71, y + s * .38); c.stroke();
        c.restore();
    },
    alert(c, x, y, s, col) {
        c.save(); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = s * 0.08; c.lineCap = 'round';
        c.beginPath(); c.arc(x + s / 2, y + s / 2, s * .4, 0, 7); c.stroke();
        c.beginPath(); c.moveTo(x + s / 2, y + s * .3); c.lineTo(x + s / 2, y + s * .56); c.stroke();
        c.beginPath(); c.arc(x + s / 2, y + s * .7, s * .05, 0, 7); c.fill();
        c.restore();
    }
};

async function buildReportBlob() {
    try { await Promise.all([300, 400, 500, 600].map(w => document.fonts.load(`${w} 24px Kanit`, 'ก'))); } catch (e) {}
    const FONT = "Kanit, 'Sukhumvit Set', Thonburi, sans-serif";
    const today = startOfToday();
    const missing = sched.filter(isTodo).sort((a, b) => (a.date || 0) - (b.date || 0));
    const done = sched.length - missing.length;
    const pct = sched.length ? done / sched.length : 0;

    // จัดกลุ่มตามเดือน (เรียงตามวันที่อยู่แล้ว) · ไม่มีวันที่ไปรวมกลุ่มท้ายสุด
    const groups = [];
    missing.forEach(r => {
        const key = r.date ? `${r.date.getFullYear()}-${r.date.getMonth()}` : 'none';
        let gp = groups[groups.length - 1];
        if (!gp || gp.key !== key) {
            gp = { key, label: r.date ? `${thaiMonthsFull[r.date.getMonth()]} ${r.date.getFullYear() + 543}` : 'ยังไม่ระบุวันที่', rows: [] };
            groups.push(gp);
        }
        gp.rows.push(r);
    });
    const ACCENTS = ['#3b6ef6', '#7c3aed', '#0891b2', '#d97706', '#db2777', '#16a34a'];

    const W = 1080, PAD = 56, ROW = 78, GH = 92, GGAP = 30, HEAD = 360, FOOT = 120;
    const body = groups.reduce((h, gp) => h + GH + gp.rows.length * ROW + GGAP, 0) || 120;
    const H = HEAD + 84 + body + FOOT;
    const scale = 2;
    const cv = document.createElement('canvas');
    cv.width = W * scale; cv.height = H * scale;
    const c = cv.getContext('2d');
    c.scale(scale, scale);
    c.textBaseline = 'alphabetic';

    // พื้นหลัง + หัว
    c.fillStyle = '#f3f5fb'; c.fillRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 0, W, HEAD);
    g.addColorStop(0, '#141a33'); g.addColorStop(1, '#2a3765');
    c.fillStyle = g; c.fillRect(0, 0, W, HEAD - 40);
    RPT_ICON.temple(c, PAD, 52, 64, '#f5c451');
    c.fillStyle = '#ffffff'; c.font = `600 50px ${FONT}`;
    c.fillText('วัดที่ยังไม่มีข้อมูลในระบบ', PAD + 84, 100);
    c.fillStyle = 'rgba(255,255,255,.72)'; c.font = `400 28px ${FONT}`;
    c.fillText(`ตารางวัดนำสวดมนต์ ${SEASON_CODE} · บ้านกัลยาณมิตรทวีปยุโรป`, PAD, 156);
    RPT_ICON.calendar(c, PAD, 172, 30, 'rgba(255,255,255,.72)');
    c.fillText(`ข้อมูล ณ ${thaiDateFull(today)}`, PAD + 42, 198);

    // การ์ดสรุป 3 ใบ พร้อมไอคอน
    const cards = [
        ['วัดทั้งหมด', String(sched.length), '#3b6ef6', 'temple'],
        ['มีข้อมูลครบ', String(done), '#16a34a', 'check'],
        ['ยังไม่มีข้อมูล', String(missing.length), '#dc2626', 'alert']
    ];
    const cw = (W - PAD * 2 - 40) / 3;
    cards.forEach((k, i) => {
        const x = PAD + i * (cw + 20), y = 232;
        c.save(); c.shadowColor = 'rgba(20,26,51,.14)'; c.shadowBlur = 18; c.shadowOffsetY = 6;
        rrect(c, x, y, cw, 118, 22); c.fillStyle = '#ffffff'; c.fill(); c.restore();
        c.fillStyle = k[2]; c.font = `600 56px ${FONT}`; c.fillText(k[1], x + 26, y + 70);
        c.fillStyle = '#5b6483'; c.font = `400 24px ${FONT}`; c.fillText(k[0], x + 26, y + 102);
        RPT_ICON[k[3]](c, x + cw - 26 - 44, y + 22, 44, k[2]);
    });

    // แถบความคืบหน้า
    let y = HEAD + 6;
    c.fillStyle = '#161d38'; c.font = `500 28px ${FONT}`;
    c.fillText(`กรอกแล้ว ${Math.round(pct * 100)}%`, PAD, y + 20);
    rrect(c, PAD, y + 36, W - PAD * 2, 16, 8); c.fillStyle = '#dde2f0'; c.fill();
    if (pct > 0) { rrect(c, PAD, y + 36, Math.max(16, (W - PAD * 2) * pct), 16, 8); c.fillStyle = '#16a34a'; c.fill(); }
    y += 96;

    if (!missing.length) {
        RPT_ICON.check(c, W / 2 - 40, y + 10, 80, '#16a34a');
        c.fillStyle = '#16a34a'; c.font = `600 40px ${FONT}`; c.textAlign = 'center';
        c.fillText('กรอกครบทุกวัดแล้ว', W / 2, y + 140); c.textAlign = 'left';
    }

    // กลุ่มเดือน
    groups.forEach((gp, gi) => {
        const col = ACCENTS[gi % ACCENTS.length];
        // หัวเดือน
        rrect(c, PAD, y, W - PAD * 2, GH - 14, 22); c.fillStyle = col; c.fill();
        rrect(c, PAD + 16, y + 12, 52, 52, 14); c.fillStyle = 'rgba(255,255,255,.2)'; c.fill();
        RPT_ICON.calendar(c, PAD + 24, y + 20, 36, '#ffffff');
        c.fillStyle = '#ffffff'; c.font = `600 36px ${FONT}`;
        c.fillText(gp.label, PAD + 86, y + 52);
        const pill = `${gp.rows.length} วัด`;
        c.font = `500 25px ${FONT}`;
        const pw = c.measureText(pill).width + 40;
        rrect(c, W - PAD - 18 - pw, y + 16, pw, 44, 22); c.fillStyle = 'rgba(255,255,255,.24)'; c.fill();
        c.fillStyle = '#ffffff'; c.textAlign = 'center';
        c.fillText(pill, W - PAD - 18 - pw / 2, y + 46); c.textAlign = 'left';
        y += GH;

        gp.rows.forEach(r => {
            rrect(c, PAD, y, W - PAD * 2, ROW - 10, 18);
            c.fillStyle = '#ffffff'; c.fill();
            c.strokeStyle = '#e3e7f3'; c.lineWidth = 1.5; c.stroke();

            // ไอคอนวัดในวงกลมสีเดือน
            c.beginPath(); c.arc(PAD + 44, y + (ROW - 10) / 2, 26, 0, 7); c.fillStyle = col + '1f'; c.fill();
            RPT_ICON.temple(c, PAD + 44 - 16, y + (ROW - 10) / 2 - 16, 32, col);

            c.fillStyle = '#161d38'; c.font = `500 28px ${FONT}`;
            c.fillText((r.temple || '').replace(/​/g, ''), PAD + 88, y + 45);

            // ขวา: วัน-เดือน + ป้ายครั้งที่
            const late = r.date && r.date < today;
            const dayTxt = r.date ? `${thaiDays[r.date.getDay()].replace('วัน', '')} ${r.date.getDate()} ${thaiMonthsAbbr[r.date.getMonth()]}` : '–';
            c.textAlign = 'right';
            c.fillStyle = late ? '#dc2626' : '#5b6483'; c.font = `400 25px ${FONT}`;
            c.fillText(dayTxt + (late ? ' · เลยกำหนด' : ''), W - PAD - 24, y + 44);
            const dw = c.measureText(dayTxt + (late ? ' · เลยกำหนด' : '')).width;
            c.textAlign = 'left';
            const chip = `ครั้งที่ ${r.round}`;
            c.font = `500 22px ${FONT}`;
            const cwid = c.measureText(chip).width + 28;
            const cx = W - PAD - 24 - dw - 16 - cwid;
            rrect(c, cx, y + 14, cwid, 36, 18); c.fillStyle = col + '1a'; c.fill();
            c.fillStyle = col; c.textAlign = 'center'; c.fillText(chip, cx + cwid / 2, y + 40); c.textAlign = 'left';

            y += ROW;
        });
        y += GGAP;
    });

    // ท้ายรูป
    const fy = H - FOOT + 46;
    c.fillStyle = '#8a92ad'; c.font = `300 22px ${FONT}`; c.textAlign = 'center';
    c.fillText('ยังไม่มีข้อมูล = ช่องพระอาจารย์หรือหัวข้อเทศน์ในชีตยังว่าง', W / 2, fy);
    c.fillStyle = '#5b6483'; c.font = `500 25px ${FONT}`;
    c.fillText('ระบบฐานข้อมูล สวดมนต์ทวีปยุโรป ซีซั่นที่ 16', W / 2, fy + 40);
    c.textAlign = 'left';

    return new Promise(res => cv.toBlob(res, 'image/png'));
}

$('#reportBtn').addEventListener('click', async () => {
    if (!sched.length) return toast('ยังไม่ได้โหลดตาราง · กดโหลดใหม่ก่อน');
    const btn = $('#reportBtn');
    btn.classList.add('busy');
    try {
        const blob = await buildReportBlob();
        if (reportUrl) URL.revokeObjectURL(reportUrl);
        reportUrl = URL.createObjectURL(blob);
        const name = `รีพอร์ตวัดที่ยังไม่มีข้อมูล-${ymd(startOfToday())}.png`;
        // เตรียมไฟล์ไว้ก่อน เพราะ iOS ให้เรียกแชร์ได้เฉพาะตอนแตะ (await ก่อนแชร์ = แชร์ไม่ขึ้น)
        reportFile = new File([blob], name, { type: 'image/png' });
        $('#reportImg').src = reportUrl;
        $('#reportSave').href = reportUrl;
        $('#reportSave').setAttribute('download', name);
        // มือถือ (แชร์ไฟล์ได้): เหลือปุ่มแผ่นแชร์ปุ่มเดียว เพราะมี "บันทึกรูปภาพ" ลงอัลบั้มในตัว
        // ส่วนดาวน์โหลดไฟล์บน iOS เปิดหน้าดูไฟล์ที่ไม่โชว์รูปและไม่ลงอัลบั้ม จึงซ่อนไว้
        // คอมพิวเตอร์: ไม่มีแผ่นแชร์ ใช้ปุ่มดาวน์โหลดเป็นปุ่มเดียว
        const canShare = !!(navigator.canShare && navigator.canShare({ files: [reportFile] }));
        $('#reportShare').hidden = !canShare;
        $('#reportSave').hidden = canShare;
        $('#reportHint').hidden = !canShare;
        reportModal.showModal();
    } catch (err) {
        toast('สร้างรูปไม่สำเร็จ: ' + ((err && err.message) || err));
    } finally {
        btn.classList.remove('busy');
    }
});
$('#reportClose').addEventListener('click', () => reportModal.close());
$('#reportShare').addEventListener('click', () => {
    if (!reportFile) return;
    navigator.share({ files: [reportFile] }).catch(() => {});
});

/* ─── ปุ่มลืมตาดูรหัสผ่าน (ใช้ร่วมกันทุกช่องรหัสผ่าน) ───
   บนมือถือพิมพ์รหัสยาว ๆ แล้วไม่เห็นว่าพิมพ์อะไรไป จึงให้กดดูได้ */
function resetEyes(scope) {
    $$(`${scope} .field-pw`).forEach(wrap => {
        const input = wrap.querySelector('input');
        const btn = wrap.querySelector('.field-eye');
        if (input) input.type = 'password';
        if (btn) { btn.classList.remove('on'); btn.setAttribute('aria-label', 'แสดงรหัสผ่าน'); }
    });
}
document.addEventListener('click', e => {
    const btn = e.target.closest && e.target.closest('.field-eye');
    if (!btn) return;
    e.preventDefault();
    const input = btn.parentElement.querySelector('input');
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.classList.toggle('on', show);
    btn.setAttribute('aria-label', show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
});

/* ─── Auth ─── */
let session = null;

async function refreshAuth() {
    const { data } = await db.auth.getSession();
    session = data.session || null;
    if (!session) return showAuth();

    const { data: ok, error } = await db.rpc('is_admin');
    if (error || !ok) {
        await db.auth.signOut();
        session = null;
        showAuth('อีเมลนี้ยังไม่ได้รับสิทธิ์แอดมิน · ติดต่อผู้ดูแลระบบ');
        return;
    }
    showApp();
}

function showAuth(msg) {
    $('#authView').hidden = false;
    $('#appView').hidden = true;
    $('#logoutBtn').hidden = true;
    $('#pwBtn').hidden = true;
    showError('#loginError', msg || '');
    $('#loginBtn').classList.remove('busy');
}

function showApp() {
    $('#authView').hidden = true;
    $('#appView').hidden = false;
    $('#logoutBtn').hidden = false;
    $('#logoutBtn').title = `ออกจากระบบ (${session.user.email})`;
    $('#pwBtn').hidden = false;
    let tab = 'schedule';
    try { tab = localStorage.getItem('dmceu.admin.tab') || 'schedule'; } catch (e) {}
    setTab(tab);
    loadEvents();
    // ค่าตั้ง/ประเทศ ต้องมาก่อนวาดข้อความ LINE จึงโหลดให้เสร็จแล้วค่อยดึงตาราง
    loadSettings()
        .catch(err => toast('โหลดค่าตั้งไม่สำเร็จ: ' + (err.message || err)))
        .finally(() => loadSchedule());
}

$('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#loginEmail').value.trim();
    const password = $('#loginPass').value;
    if (!email || !password) return;
    showError('#loginError', '');
    $('#loginBtn').classList.add('busy');
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
        const msg = /invalid login/i.test(error.message) ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
                  : /email not confirmed/i.test(error.message) ? 'อีเมลนี้ยังไม่ได้ยืนยัน'
                  : /rate limit|too many/i.test(error.message) ? 'ลองบ่อยเกินไป · รอสักครู่แล้วลองใหม่'
                  : 'เข้าสู่ระบบไม่สำเร็จ: ' + error.message;
        showError('#loginError', msg);
        $('#loginBtn').classList.remove('busy');
        return;
    }
    $('#loginPass').value = '';
    resetEyes('#authView');
    await refreshAuth();
    toast('เข้าสู่ระบบแล้ว');
});

$('#logoutBtn').addEventListener('click', async () => {
    await db.auth.signOut();
    session = null;
    events = [];
    sched = [];
    showAuth();
    toast('ออกจากระบบแล้ว');
});

/* ─── เปลี่ยนรหัสผ่าน ───
   ตั้งรหัสใหม่ได้เองในแอป ไม่ต้องพึ่งอีเมลรีเซ็ต (โปรเจกต์นี้ยังไม่ได้ตั้ง SMTP)
   ถ้าลืมรหัสจนเข้าไม่ได้เลย ให้ตั้งใหม่ที่ Supabase → SQL Editor ตาม docs/reset-password.md */
const pwModal = $('#pwModal');

$('#pwBtn').addEventListener('click', () => {
    $('#pwNew').value = '';
    $('#pwNew2').value = '';
    resetEyes('#pwModal');
    $('#pwWho').textContent = session ? `บัญชี ${session.user.email}` : '';
    showError('#pwError', '');
    pwModal.showModal();
    $('#pwNew').focus();
});
$('#pwClose').addEventListener('click', () => pwModal.close());
$('#pwCancel').addEventListener('click', () => pwModal.close());

$('#pwForm').addEventListener('submit', async e => {
    e.preventDefault();
    showError('#pwError', '');
    const pw = $('#pwNew').value;
    if (pw.length < 8) return showError('#pwError', 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร');
    if (pw !== $('#pwNew2').value) return showError('#pwError', 'รหัสผ่านสองช่องไม่ตรงกัน');

    const btn = $('#pwSave');
    btn.classList.add('busy');
    try {
        const { error } = await db.auth.updateUser({ password: pw });
        if (error) throw error;
        $('#pwNew').value = '';
        $('#pwNew2').value = '';
        pwModal.close();
        toast('เปลี่ยนรหัสผ่านแล้ว · ครั้งต่อไปใช้รหัสใหม่');
    } catch (err) {
        const m = String((err && err.message) || err);
        showError('#pwError',
            /same.*password|should be different/i.test(m) ? 'รหัสใหม่ต้องไม่ซ้ำกับรหัสเดิม'
          : /weak|pwned|password/i.test(m) && /short|weak|pwned/i.test(m) ? 'รหัสผ่านนี้ไม่ปลอดภัยพอ · ลองยาวขึ้นหรือผสมตัวเลข'
          : /session|jwt|expired/i.test(m) ? 'หมดเวลาเข้าสู่ระบบ · กรุณาเข้าสู่ระบบใหม่'
          : 'เปลี่ยนรหัสผ่านไม่สำเร็จ: ' + m);
    } finally {
        btn.classList.remove('busy');
    }
});

db.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' && !$('#authView').hidden) return;
    if (event === 'SIGNED_OUT') showAuth();
});

/* ─── รายการกิจกรรม ─── */
let events = [];
let loadingList = false;

async function loadEvents() {
    if (loadingList) return;
    loadingList = true;
    $('#adminSub').textContent = 'กำลังโหลด…';
    const { data, error } = await db.from('events')
        .select('id,title,description,link,images,image_path,width,height,sort,visible,created_at,updated_at')
        .order('sort', { ascending: true })
        .order('created_at', { ascending: false });
    loadingList = false;
    if (error) {
        $('#adminSub').textContent = 'โหลดไม่สำเร็จ';
        toast('โหลดรายการไม่สำเร็จ: ' + error.message);
        return;
    }
    events = data || [];
    renderList();
}

/** รูปทั้งหมดของโพสต์ (รองรับแถวเก่าที่มีแค่ image_path) */
function evImages(ev) {
    const list = Array.isArray(ev.images) ? ev.images.filter(im => im && im.path) : [];
    if (list.length) return list;
    return ev.image_path ? [{ path: ev.image_path, width: ev.width, height: ev.height }] : [];
}

function renderList() {
    const shown = events.filter(e => e.visible).length;
    const photos = events.reduce((n, e) => n + evImages(e).length, 0);
    $('#adminSub').textContent = events.length
        ? `${events.length} โพสต์ · ${photos} รูป · แสดงบนเว็บ ${shown}` : 'ยังไม่มีโพสต์กิจกรรม';

    const list = $('#eventList');
    if (!events.length) {
        list.innerHTML = `<div class="admin-empty">${icon('image')}<span>ยังไม่มีโพสต์ · กดปุ่มด้านบนเพื่อเพิ่มโพสต์แรก</span></div>`;
        return;
    }
    list.innerHTML = events.map((ev, i) => {
        const imgs = evImages(ev);
        return `
        <article class="ev-row${ev.visible ? '' : ' hidden-row'}" data-id="${ev.id}">
            <div class="ev-thumb">
                <img src="${esc(publicUrl(imgs[0] && imgs[0].path))}" alt="" loading="lazy">
                ${imgs.length > 1 ? `<span class="ev-count">${imgs.length} รูป</span>` : ''}
                ${ev.visible ? '' : '<span class="ev-hidden-badge">ซ่อนอยู่</span>'}
            </div>
            <div class="ev-body">
                <h3 class="ev-title">${esc(ev.title) || '<span style="color:var(--text-mute)">(ไม่มีหัวข้อ)</span>'}</h3>
                ${ev.description ? `<p class="ev-desc">${esc(ev.description)}</p>` : ''}
                <div class="ev-meta">
                    <span>${imgs.length} รูป</span>
                    <span>อัปเดต ${fmtDate(ev.updated_at)}</span>
                    ${ev.link ? `<span>${icon('link')} มีลิงก์</span>` : ''}
                </div>
            </div>
            <div class="ev-actions">
                <button class="icon-btn" type="button" data-act="toggle" title="${ev.visible ? 'ซ่อนจากหน้าเว็บ' : 'แสดงบนหน้าเว็บ'}">${icon(ev.visible ? 'eye' : 'eye-off')}</button>
                <button class="icon-btn" type="button" data-act="edit" title="แก้ไข">${icon('edit')}</button>
                <button class="icon-btn" type="button" data-act="up" title="เลื่อนขึ้น" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
                <button class="icon-btn" type="button" data-act="down" title="เลื่อนลง" ${i === events.length - 1 ? 'disabled' : ''}>${icon('down')}</button>
                <span class="spacer"></span>
                <button class="icon-btn danger" type="button" data-act="delete" title="ลบ">${icon('trash')}</button>
            </div>
        </article>`;
    }).join('');
}

$('#eventList').addEventListener('click', async e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const row = btn.closest('.ev-row');
    const ev = events.find(x => x.id === row.dataset.id);
    if (!ev) return;
    const act = btn.dataset.act;
    if (act === 'edit') return openEditor(ev);
    if (act === 'delete') return confirmDelete(ev);
    btn.classList.add('busy');
    try {
        if (act === 'toggle') await setVisible(ev, !ev.visible);
        else if (act === 'up' || act === 'down') await move(ev, act === 'up' ? -1 : 1);
    } catch (err) {
        toast('ไม่สำเร็จ: ' + (err.message || err));
    }
    btn.classList.remove('busy');
});

async function setVisible(ev, visible) {
    const { error } = await db.from('events').update({ visible }).eq('id', ev.id);
    if (error) throw error;
    ev.visible = visible;
    renderList();
    toast(visible ? 'แสดงบนหน้าเว็บแล้ว' : 'ซ่อนจากหน้าเว็บแล้ว');
}

/** สลับลำดับกับรายการข้างเคียง แล้วเขียนค่า sort ใหม่ให้ทุกแถวที่เปลี่ยน */
async function move(ev, dir) {
    const i = events.indexOf(ev), j = i + dir;
    if (j < 0 || j >= events.length) return;
    [events[i], events[j]] = [events[j], events[i]];
    const updates = events
        .map((e, idx) => ({ e, sort: (idx + 1) * 10 }))
        .filter(({ e, sort }) => e.sort !== sort);
    const results = await Promise.all(updates.map(({ e, sort }) => db.from('events').update({ sort }).eq('id', e.id)));
    const failed = results.find(r => r.error);
    if (failed) { await loadEvents(); throw failed.error; }
    updates.forEach(({ e, sort }) => { e.sort = sort; });
    renderList();
}

/* ─── ยืนยันลบ ─── */
let pendingDelete = null;
function confirmDelete(ev) {
    pendingDelete = ev;
    const n = evImages(ev).length;
    $('#confirmText').textContent = `“${ev.title || 'โพสต์ไม่มีหัวข้อ'}” (${n} รูป) จะถูกลบออกจากหน้าเว็บทันที และกู้คืนไม่ได้`;
    $('#confirmModal').showModal();
}
$('#confirmNo').addEventListener('click', () => $('#confirmModal').close());
$('#confirmYes').addEventListener('click', async () => {
    const ev = pendingDelete;
    if (!ev) return;
    $('#confirmYes').classList.add('busy');
    try {
        const { error } = await db.from('events').delete().eq('id', ev.id);
        if (error) throw error;
        const paths = evImages(ev).map(im => im.path);
        if (paths.length) await db.storage.from(SUPA.bucket).remove(paths);   // ไฟล์ค้างไม่เป็นไร ถ้าลบไม่ได้
        events = events.filter(x => x.id !== ev.id);
        renderList();
        toast('ลบแล้ว');
        $('#confirmModal').close();
    } catch (err) {
        toast('ลบไม่สำเร็จ: ' + (err.message || err));
    }
    $('#confirmYes').classList.remove('busy');
    pendingDelete = null;
});

/* ─── ฟอร์มเพิ่ม/แก้ไขโพสต์ ─── */
const editModal = $('#editModal');
let editing = null;      // แถวที่กำลังแก้ (null = โพสต์ใหม่)
let shots = [];          // รูปในโพสต์ ตามลำดับที่จะแสดง
                         //   เดิม:  { kind:'old', path, width, height, url }
                         //   ใหม่:  { kind:'new', blob, width, height, ext, url }
let removedPaths = [];   // รูปเดิมที่ถูกเอาออก (ลบไฟล์ตอนบันทึกสำเร็จ)

function releaseShots() {
    shots.forEach(sh => { if (sh.kind === 'new' && sh.url) URL.revokeObjectURL(sh.url); });
    shots = [];
    removedPaths = [];
}

function openEditor(ev) {
    releaseShots();
    editing = ev || null;
    $('#editTitle').textContent = ev ? 'แก้ไขโพสต์กิจกรรม' : 'เพิ่มโพสต์กิจกรรม';
    $('#fTitle').value = ev ? ev.title : '';
    $('#fDesc').value = ev ? ev.description : '';
    $('#fLink').value = ev ? ev.link : '';
    $('#fVisible').checked = ev ? ev.visible : true;
    $('#fileInput').value = '';
    showError('#editError', '');
    $('#uploadProgress').hidden = true;
    $('#uploadFill').style.width = '0';
    if (ev) {
        shots = evImages(ev).map(im => ({
            kind: 'old', path: im.path, width: im.width, height: im.height, url: publicUrl(im.path)
        }));
    }
    renderShots();
    editModal.showModal();
    $('#editForm').scrollTop = 0;
}

function renderShots() {
    const box = $('#shots');
    $('#dropEmpty').hidden = shots.length > 0;
    box.hidden = shots.length === 0;
    $('#shotsHint').hidden = shots.length < 2;
    if (!shots.length) { box.innerHTML = ''; return; }

    box.innerHTML = shots.map((sh, i) => `
        <div class="shot" data-i="${i}">
            <img src="${esc(sh.url)}" alt="">
            ${i === 0 ? '<span class="shot-cover">ปก</span>' : ''}
            ${sh.kind === 'new' ? '<span class="shot-new">ใหม่</span>' : ''}
            <button class="shot-x" type="button" data-sact="remove" title="เอารูปนี้ออก">${icon('close')}</button>
            <div class="shot-move">
                <button type="button" data-sact="left" title="เลื่อนซ้าย" ${i === 0 ? 'disabled' : ''}>${icon('chev-left')}</button>
                <button type="button" data-sact="right" title="เลื่อนขวา" ${i === shots.length - 1 ? 'disabled' : ''}>${icon('chev-right')}</button>
            </div>
        </div>`).join('') +
        `<button class="shot-add" type="button" id="shotAdd" title="เพิ่มรูปอีก">${icon('plus')}<span>เพิ่มรูป</span></button>`;
}

$('#shots').addEventListener('click', e => {
    if (e.target.closest('#shotAdd')) { $('#fileInput').click(); return; }
    const btn = e.target.closest('[data-sact]');
    if (!btn) return;
    e.stopPropagation();
    const i = +btn.closest('.shot').dataset.i;
    const act = btn.dataset.sact;
    if (act === 'remove') {
        const [sh] = shots.splice(i, 1);
        if (sh.kind === 'new') URL.revokeObjectURL(sh.url);
        else removedPaths.push(sh.path);
    } else {
        const j = act === 'left' ? i - 1 : i + 1;
        if (j < 0 || j >= shots.length) return;
        [shots[i], shots[j]] = [shots[j], shots[i]];
    }
    renderShots();
});

$('#addBtn').addEventListener('click', () => openEditor(null));
$('#editClose').addEventListener('click', () => editModal.close());
$('#editCancel').addEventListener('click', () => editModal.close());
editModal.addEventListener('close', () => { releaseShots(); editing = null; });

const drop = $('#drop');
drop.addEventListener('click', e => { if (!e.target.closest('.shot')) $('#fileInput').click(); });
drop.addEventListener('keydown', e => {
    if (e.target !== drop) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#fileInput').click(); }
});
$('#fileInput').addEventListener('change', () => {
    const files = Array.from($('#fileInput').files || []);
    $('#fileInput').value = '';
    if (files.length) handleFiles(files);
});
['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => {
    const files = Array.from(e.dataTransfer.files || []).filter(f => /^image\//.test(f.type));
    if (files.length) handleFiles(files);
});
document.addEventListener('paste', e => {
    if (!editModal.open) return;
    const files = Array.from(e.clipboardData.items || [])
        .filter(i => i.type.startsWith('image/')).map(i => i.getAsFile()).filter(Boolean);
    if (files.length) handleFiles(files);
});

const MAX_SHOTS = 20;
async function handleFiles(files) {
    showError('#editError', '');
    const room = MAX_SHOTS - shots.length;
    if (room <= 0) return showError('#editError', `ใส่ได้สูงสุด ${MAX_SHOTS} รูปต่อโพสต์`);
    const take = files.slice(0, room);
    if (files.length > room) toast(`ใส่ได้อีก ${room} รูปในโพสต์นี้`);

    const firstName = take[0] && take[0].name;
    let failed = 0;
    for (const file of take) {
        if (!/^image\//.test(file.type) && !/\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)) { failed++; continue; }
        try {
            const out = await shrinkImage(file);
            shots.push({ kind: 'new', blob: out.blob, width: out.width, height: out.height, ext: out.ext, url: URL.createObjectURL(out.blob) });
            renderShots();
        } catch (err) { failed++; }
    }
    if (failed) showError('#editError', `เปิดรูปไม่ได้ ${failed} ไฟล์ · ถ้าเป็น HEIC ลองส่งออกเป็น JPG ก่อน`);

    // เติมหัวข้อจากชื่อไฟล์ให้ ถ้าชื่อไฟล์ดูมีความหมาย (ไม่ใช่ IMG_1234 / Screenshot)
    const base = (firstName || '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
    if (!$('#fTitle').value && !editing && base && !/^(img|dsc|pxl|image|photo|screenshot|scan)\b|^\d+$/i.test(base)) {
        $('#fTitle').value = base;
    }
}

/** ย่อรูปในเครื่องด้วย canvas → JPEG (หรือคง PNG ถ้าไฟล์เล็กอยู่แล้ว) */
function shrinkImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            const w0 = img.naturalWidth, h0 = img.naturalHeight;
            if (!w0 || !h0) return reject(new Error('decode'));
            const keepPng = file.type === 'image/png' && file.size < 1.5 * 1048576 && Math.max(w0, h0) <= IMG_MAX_SIDE;
            if (keepPng) return resolve({ blob: file, width: w0, height: h0, ext: 'png' });

            const scale = Math.min(1, IMG_MAX_SIDE / Math.max(w0, h0));
            const isJpeg = /jpe?g$/i.test(file.type);
            const w = Math.round(w0 * scale), h = Math.round(h0 * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob(blob => {
                if (!blob) return reject(new Error('encode'));
                // JPEG ที่ไม่ได้ย่อและบีบแล้วไม่เล็กลง → ใช้ไฟล์เดิมเลย
                if (isJpeg && scale === 1 && blob.size >= file.size) return resolve({ blob: file, width: w0, height: h0, ext: 'jpg' });
                resolve({ blob, width: w, height: h, ext: 'jpg' });
            }, 'image/jpeg', IMG_QUALITY);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
        img.src = url;
    });
}

/** อัปโหลดขึ้น Storage แบบมีแถบความคืบหน้า (XHR เพราะ supabase-js ไม่รายงาน progress) */
function uploadBlob(path, blob, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${SUPA.url}/storage/v1/object/${SUPA.bucket}/${path}`);
        xhr.setRequestHeader('apikey', SUPA.key);
        xhr.setRequestHeader('Authorization', 'Bearer ' + session.access_token);
        xhr.setRequestHeader('Content-Type', blob.type || 'image/jpeg');
        xhr.setRequestHeader('cache-control', 'public, max-age=31536000');
        xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) return resolve();
            let msg = 'HTTP ' + xhr.status;
            try { msg = JSON.parse(xhr.responseText).message || msg; } catch (_) {}
            reject(new Error(msg));
        };
        xhr.onerror = () => reject(new Error('เครือข่ายขัดข้อง'));
        xhr.send(blob);
    });
}

$('#editForm').addEventListener('submit', async e => {
    e.preventDefault();
    showError('#editError', '');
    if (!shots.length) return showError('#editError', 'กรุณาเลือกรูปอย่างน้อย 1 รูป');

    const payload = {
        title: $('#fTitle').value.trim(),
        description: $('#fDesc').value.trim(),
        link: $('#fLink').value.trim(),
        visible: $('#fVisible').checked
    };
    if (payload.link && !/^https?:\/\//i.test(payload.link)) payload.link = 'https://' + payload.link;

    const saveBtn = $('#editSave');
    saveBtn.classList.add('busy');
    const prog = $('#uploadProgress'), fill = $('#uploadFill'), text = $('#uploadText');
    const uploaded = [];   // path ของรูปที่เพิ่งอัปขึ้นไป (ลบทิ้งถ้าบันทึกพลาด)

    try {
        // ต่ออายุ token ก่อน เผื่อเปิดหน้าค้างไว้นาน
        const { data: sess } = await db.auth.getSession();
        if (!sess.session) throw new Error('หมดเวลาเข้าสู่ระบบ · กรุณาเข้าสู่ระบบใหม่');
        session = sess.session;

        const pending = shots.filter(sh => sh.kind === 'new');
        if (pending.length) {
            prog.hidden = false;
            fill.style.width = '0';
            let done = 0;
            for (const sh of pending) {
                text.textContent = pending.length > 1
                    ? `กำลังอัปโหลดรูป ${done + 1}/${pending.length}…` : 'กำลังอัปโหลดรูป…';
                const path = `posters/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${sh.ext}`;
                await uploadBlob(path, sh.blob, frac => {
                    fill.style.width = Math.round(((done + frac) / pending.length) * 100) + '%';
                });
                sh.path = path;
                uploaded.push(path);
                done++;
                fill.style.width = Math.round((done / pending.length) * 100) + '%';
            }
            text.textContent = 'กำลังบันทึกข้อมูล…';
        }

        payload.images = shots.map(sh => ({ path: sh.path, width: sh.width, height: sh.height }));

        if (editing) {
            const { data, error } = await db.from('events').update(payload).eq('id', editing.id).select().single();
            if (error) throw error;
            Object.assign(editing, data);
            if (removedPaths.length) db.storage.from(SUPA.bucket).remove(removedPaths);
            toast('บันทึกการแก้ไขแล้ว');
        } else {
            const minSort = events.length ? Math.min(...events.map(x => x.sort)) : 10;
            payload.sort = minSort - 10;   // โพสต์ใหม่ขึ้นบนสุด
            const { data, error } = await db.from('events').insert(payload).select().single();
            if (error) throw error;
            events.unshift(data);
            toast(`เพิ่มโพสต์แล้ว (${payload.images.length} รูป) · จะขึ้นหน้าเว็บภายในไม่กี่วินาที`);
        }
        renderList();
        editModal.close();
    } catch (err) {
        if (uploaded.length) db.storage.from(SUPA.bucket).remove(uploaded).catch(() => {});
        shots.forEach(sh => { if (sh.kind === 'new') delete sh.path; });
        showError('#editError', (err && err.message) || 'บันทึกไม่สำเร็จ');
    } finally {
        saveBtn.classList.remove('busy');
        prog.hidden = true;
    }
});

/* ─── Boot ─── */
refreshAuth();


/* ============================================================
   ส่วนที่ 2 · ตารางสวดมนต์ (อ่านจาก Google Sheets / เขียนผ่าน Edge Function)
   ============================================================ */

const SHEET_ID  = '1pcqRU-76PFxUGj99ZVV5VlA028OaJ6nj7j12mXgOOzQ';
const SHEET_TAB = 'ตารางสวดมนต์ซีซั่นที่ 16';
const SEASON_CODE = 'SS16';
const WRITE_FN  = `${SUPA.url}/functions/v1/sheet-write`;

/* ── ตัวช่วยวันที่ (คัดจาก script.js ให้ admin.js ใช้ได้เอง) ── */
const thaiMonthsFull = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                        'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const thaiMonthsAbbr = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const thaiDays = ['วันอาทิตย์','วันจันทร์','วันอังคาร','วันพุธ','วันพฤหัสบดี','วันศุกร์','วันเสาร์'];

/** เซลล์วันที่จาก gviz → Date */
function parseGsDate(cell) {
    if (!cell) return null;
    if (typeof cell.v === 'string' && cell.v.indexOf('Date(') === 0) {
        const m = cell.v.match(/Date\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) return new Date(+m[1], +m[2], +m[3]);
    }
    return null;
}
const ymd = d => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
/** → "วันอาทิตย์ที่ 18 ตุลาคม พ.ศ.2569" */
const thaiDateFull = d => d
    ? `${thaiDays[d.getDay()]}ที่ ${d.getDate()} ${thaiMonthsFull[d.getMonth()]} พ.ศ.${d.getFullYear() + 543}`
    : '';
const thaiDateShort = d => d ? `${d.getDate()} ${thaiMonthsAbbr[d.getMonth()]}` : '–';

/** "เวลาผนัง" ในโซนหนึ่ง + วันที่ → instant จริง (วนสองรอบเพื่อชดเชยช่วงเปลี่ยนเวลาฤดูร้อน) */
function zonedToUtc(y, mo, d, hh, mm, tz) {
    const target = Date.UTC(y, mo, d, hh, mm);
    const offsetAt = ts => {
        const p = new Intl.DateTimeFormat('en-US', {
            timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        }).formatToParts(new Date(ts));
        const g = t => +(p.find(x => x.type === t) || {}).value;
        return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second')) - ts;
    };
    let ts = target - offsetAt(target);
    ts = target - offsetAt(ts);
    return new Date(ts);
}
/** instant → "17.30" ในโซนที่ต้องการ */
function timeInZone(instant, tz) {
    return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
        .format(instant).replace(':', '.');
}

/* ── โหลดตารางจากชีต (gviz JSONP แบบเดียวกับหน้าเว็บหลัก) ── */
let sched = [];            // [{ no, temple, round, date, monk, topic, join }]
let flashRound = null;     // ครั้งที่เพิ่งบันทึก — ให้แถวกะพริบรอบเดียว
let schedFilter = 'todo';
let schedLoading = false;

function loadSchedule() {
    if (schedLoading) return;
    schedLoading = true;
    $('#schedSub').textContent = 'กำลังโหลดจากชีต…';
    const el = document.createElement('script');
    el.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json;responseHandler:processSchedule` +
             `&sheet=${encodeURIComponent(SHEET_TAB)}` +
             `&tq=${encodeURIComponent('select A,B,C,D,E,F,G')}&_=${Date.now()}`;
    el.async = true;
    el.onerror = () => { el.remove(); schedLoading = false; $('#schedSub').textContent = 'โหลดชีตไม่สำเร็จ'; };
    el.addEventListener('load', () => el.remove());
    document.head.appendChild(el);
}

function processSchedule(response) {
    schedLoading = false;
    if (!response || response.status === 'error' || !response.table) {
        $('#schedSub').textContent = 'โหลดชีตไม่สำเร็จ';
        return;
    }
    const txt = (row, i) => {
        const c = row.c[i];
        if (!c || c.v === null || c.v === undefined) return '';
        return String(c.f !== undefined && c.f !== null ? c.f : c.v).trim();
    };
    sched = [];
    (response.table.rows || []).forEach(row => {
        if (!row || !row.c) return;
        const no = txt(row, 0);
        if (!no || isNaN(no)) return;                       // ข้ามแถวคั่นและหมายเหตุท้ายตาราง
        sched.push({
            no, temple: txt(row, 1), round: txt(row, 2),
            date: parseGsDate(row.c[3]), dateText: txt(row, 3),
            monk: txt(row, 4), topic: txt(row, 5), join: txt(row, 6)
        });
    });
    renderSchedule();
    fillRoundPicker();
    renderLineMessage();
}
window.processSchedule = processSchedule;

const isTodo = r => !r.monk || !r.topic;
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

function schedRows() {
    const today = startOfToday();
    if (schedFilter === 'all') return sched;
    if (schedFilter === 'upcoming') return sched.filter(r => r.date && r.date >= today);
    return sched.filter(r => isTodo(r) && (!r.date || r.date >= today));   // ยังไม่ได้กรอก + ยังมาไม่ถึง
}

function renderSchedule() {
    const todo = sched.filter(r => isTodo(r) && (!r.date || r.date >= startOfToday())).length;
    $('#schedSub').textContent = sched.length
        ? `${sched.length} คิว · ยังไม่ได้กรอก ${todo}` : 'ไม่พบข้อมูลในชีต';

    const rows = schedRows();
    const list = $('#schedList');
    if (!rows.length) {
        list.innerHTML = `<div class="admin-empty">${icon('check')}<span>${
            schedFilter === 'todo' ? 'กรอกครบทุกคิวแล้ว 🎉' : 'ไม่มีรายการในตัวกรองนี้'}</span></div>`;
        return;
    }
    list.innerHTML = rows.map(r => `
        <article class="sc-row${isTodo(r) ? ' todo' : ''}${r.round === flashRound ? ' just-saved' : ''}" data-round="${esc(r.round)}">
            <div class="sc-date">
                <strong>${esc(thaiDateShort(r.date))}</strong>
                <span>${r.date ? esc(thaiDays[r.date.getDay()].replace('วัน', '')) : ''}</span>
            </div>
            <div class="sc-body">
                <div class="sc-top">
                    <span class="sc-round">ครั้งที่ ${esc(r.round)}</span>
                    ${isTodo(r) ? '<span class="sc-badge">ยังไม่ได้กรอก</span>' : ''}
                </div>
                <h3 class="sc-temple">${esc(r.temple) || '—'}</h3>
                <p class="sc-detail">${r.monk ? esc(r.monk) : '<em>ยังไม่มีพระอาจารย์</em>'}</p>
                <p class="sc-detail">${r.topic ? esc(r.topic) : '<em>ยังไม่มีหัวข้อเทศน์</em>'}</p>
            </div>
            <button class="icon-btn sc-edit" type="button" title="แก้ไข">${icon('edit')}</button>
        </article>`).join('');
    flashRound = null;
}

$('#schedList').addEventListener('click', e => {
    const row = e.target.closest('.sc-row');
    if (!row) return;
    const r = sched.find(x => x.round === row.dataset.round);
    if (r) openRow(r);
});
$('#schedReload').addEventListener('click', () => loadSchedule());
$('#schedFilter').addEventListener('click', e => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    schedFilter = b.dataset.f;
    $$('#schedFilter button').forEach(x => x.classList.toggle('on', x === b));
    renderSchedule();
});

/* ── โมดัลแก้แถว → บันทึกลงชีต ── */
const rowModal = $('#rowModal');
let editingRow = null;

function openRow(r) {
    editingRow = r;
    $('#rowTitle').textContent = `ครั้งที่ ${r.round} · ${thaiDateShort(r.date)}`;
    $('#rNo').value = r.no;
    $('#rRound').value = r.round;
    $('#rTemple').value = r.temple;
    $('#rDate').value = ymd(r.date);
    $('#rMonk').value = r.monk;
    $('#rTopic').value = r.topic;
    $('#rJoin').value = r.join;
    $('#rCountry').value = temples[r.temple] || '';
    $('#countryList').innerHTML = [...new Set(Object.values(temples))].filter(Boolean)
        .map(c => `<option value="${esc(c)}">`).join('');
    showError('#rowError', '');
    $('#rowAutoNote').hidden = true;
    rowModal.showModal();
    $('#rowForm').scrollTop = 0;
}
$('#rowClose').addEventListener('click', () => rowModal.close());
$('#rowCancel').addEventListener('click', () => rowModal.close());
rowModal.addEventListener('close', () => { editingRow = null; });

/* ── วางข้อความโพสต์ → เติมชื่อพระ/หัวข้อให้อัตโนมัติ ──
   รับข้อความที่คัดลอกมาทั้งก้อน เช่น
     วัดพุทธไฮล์บรอนน์ / วันเสาร์ที่ 24 ตุลาคม 2569 /
     พระผู้เทศน์สอน : … / หัวข้อเทศน์ : “…”
   หาแถวในตารางจาก ครั้งที่ → ชื่อวัด → วันที่ แล้วเติมเฉพาะ "พระอาจารย์" กับ "หัวข้อเทศน์"
   ไม่บันทึกเอง — เปิดหน้าแก้ไขให้ตรวจก่อน เพราะการบันทึกเขียนลงชีตจริง */
const INVISIBLE = /[​-‏‪-‮⁠﻿]/g;
const tidy = t => String(t || '').replace(INVISIBLE, '').replace(/[   ]/g, ' ').replace(/[ \t]+/g, ' ').trim();
const norm = t => tidy(t).replace(/\s+/g, '');

/** ตัดเครื่องหมายคำพูดที่ครอบทั้งหัวข้อ (ไม่ตัดเครื่องหมายคำพูดที่อยู่ข้างในประโยค) */
function stripOuterQuotes(t) {
    t = tidy(t);
    const OPEN = /^[“”"‘’'「『«]+/, CLOSE = /[“”"‘’'」』»]+$/;
    if (OPEN.test(t) && CLOSE.test(t)) t = t.replace(OPEN, '').replace(CLOSE, '');
    return t.trim();
}

function parseSermonPost(text) {
    const raw = String(text || '').replace(/\r/g, '');
    const lines = raw.split('\n').map(tidy);
    const out = { monk: '', topic: '', round: '', date: null, lines };

    const MONK = /^(?:พระผู้เทศน์สอน|พระผู้เทศน์|พระอาจารย์ผู้เทศน์|พระอาจารย์|ผู้เทศน์สอน|ผู้เทศน์|เทศน์โดย)\s*[:：]\s*(.*)$/;
    const TOPIC = /^(?:หัวข้อเทศน์|หัวข้อธรรม|หัวข้อ|เรื่อง)\s*[:：]\s*(.*)$/;
    const ANY_LABEL = /^[^\s:：]{2,24}\s*[:：]/;

    for (let i = 0; i < lines.length; i++) {
        const L = lines[i];
        let m;
        if (!out.monk && (m = L.match(MONK))) {
            out.monk = tidy(m[1]);
        } else if (!out.topic && (m = L.match(TOPIC))) {
            let t = m[1];
            // หัวข้อยาวที่ขึ้นบรรทัดใหม่กลางเครื่องหมายคำพูด: ต่อบรรทัดถัดไปจนกว่าจะปิดคำพูด
            if (/^[“"‘'「『«]/.test(t) && !/[”"’'」』»]$/.test(t)) {
                for (let j = i + 1; j < lines.length && !ANY_LABEL.test(lines[j]) && lines[j]; j++) {
                    t += ' ' + lines[j];
                    if (/[”"’'」』»]$/.test(lines[j])) break;
                }
            }
            out.topic = stripOuterQuotes(t);
        }
    }
    out.monk = tidy(out.monk);

    const r = raw.match(/ครั้งที่\s*(\d{3})/);
    if (r) out.round = r[1];

    const monthRe = thaiMonthsFull.join('|');
    const d = raw.match(new RegExp(`(\\d{1,2})\\s*(${monthRe})\\s*(?:พ\\.?\\s*ศ\\.?\\s*)?(\\d{4})?`));
    if (d) {
        let y = d[3] ? +d[3] : null;
        if (y && y > 2400) y -= 543;
        out.date = { day: +d[1], month: thaiMonthsFull.indexOf(d[2]), year: y };
    }
    return out;
}

/** หาแถวในตารางจากข้อความที่วาง → { row, how, dateMismatch } หรือ null */
function findRowForPost(p) {
    const sameDate = r => r.date && p.date && r.date.getDate() === p.date.day && r.date.getMonth() === p.date.month
        && (!p.date.year || r.date.getFullYear() === p.date.year);

    let row = null, how = '';
    if (p.round) { row = sched.find(r => r.round === p.round); if (row) how = 'ครั้งที่'; }

    if (!row) {
        const hay = norm(p.lines.join(' '));
        const hits = sched.filter(r => norm(r.temple) && hay.includes(norm(r.temple)))
            .sort((a, b) => norm(b.temple).length - norm(a.temple).length);
        if (hits.length) { row = hits.find(sameDate) || hits[0]; how = 'ชื่อวัด'; }
    }
    if (!row && p.date) {
        const byDate = sched.filter(sameDate);
        if (byDate.length === 1) { row = byDate[0]; how = 'วันที่'; }
    }
    if (!row) return null;
    return { row, how, dateMismatch: !!(p.date && !sameDate(row)) };
}

const pasteModal = $('#pasteModal');
$('#pasteBtn').addEventListener('click', () => {
    if (!sched.length) return toast('ยังไม่ได้โหลดตาราง · กดโหลดใหม่ก่อน');
    $('#pasteText').value = '';
    showError('#pasteError', '');
    pasteModal.showModal();
    setTimeout(() => $('#pasteText').focus(), 150);
});
$('#pasteClose').addEventListener('click', () => pasteModal.close());
$('#pasteCancel').addEventListener('click', () => pasteModal.close());

$('#pasteForm').addEventListener('submit', e => {
    e.preventDefault();
    showError('#pasteError', '');
    const text = $('#pasteText').value;
    if (!tidy(text)) return showError('#pasteError', 'ยังไม่ได้วางข้อความ');

    const p = parseSermonPost(text);
    if (!p.monk && !p.topic) {
        return showError('#pasteError', 'ไม่พบ "พระผู้เทศน์สอน :" หรือ "หัวข้อเทศน์ :" ในข้อความ · ตรวจว่าวางครบทั้งก้อนแล้ว');
    }
    const hit = findRowForPost(p);
    if (!hit) {
        return showError('#pasteError', 'หาแถวในตารางไม่เจอ · ในข้อความต้องมีชื่อวัด วันที่ หรือครั้งที่อย่างใดอย่างหนึ่งที่ตรงกับชีต');
    }

    pasteModal.close();
    openRow(hit.row);
    const filled = [];
    if (p.monk)  { $('#rMonk').value = p.monk;   filled.push('ชื่อพระอาจารย์'); }
    if (p.topic) { $('#rTopic').value = p.topic; filled.push('หัวข้อเทศน์'); }

    const note = $('#rowAutoNote');
    let msg = `เติม${filled.join(' และ ')}จากข้อความที่วางแล้ว (จับคู่ด้วย${hit.how}) · ตรวจให้ถูกต้องแล้วกดบันทึกลงชีต`;
    note.classList.toggle('warn', hit.dateMismatch || !p.monk || !p.topic);
    if (hit.dateMismatch) msg += ' · ⚠ วันที่ในข้อความไม่ตรงกับชีต ตรวจแถวให้แน่ใจ';
    if (!p.monk)  msg += ' · ไม่พบชื่อพระ';
    if (!p.topic) msg += ' · ไม่พบหัวข้อ';
    note.querySelector('span').textContent = msg;
    note.hidden = false;
});


/** เรียก Edge Function (ตรวจสิทธิ์แล้วส่งต่อไป Apps Script → ชีต)
    เขียนผ่าน Google ใช้เวลาประมาณ 3-5 วินาทีเป็นปกติ จึงให้เวลาถึง 45 วินาที
    และแปลง error ของเบราว์เซอร์ ("Load failed" / "Failed to fetch") เป็นข้อความที่อ่านรู้เรื่อง */
async function sheetWrite(payload) {
    const { data: s } = await db.auth.getSession();
    if (!s.session) throw new Error('หมดเวลาเข้าสู่ระบบ · กรุณาเข้าสู่ระบบใหม่');
    session = s.session;

    let res;
    try {
        res = await fetch(WRITE_FN, {
            method: 'POST',
            headers: {
                apikey: SUPA.key,
                Authorization: 'Bearer ' + session.access_token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(45000)
        });
    } catch (e) {
        if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
            throw new Error('เซิร์ฟเวอร์ไม่ตอบกลับใน 45 วินาที · ลองใหม่อีกครั้ง (ข้อมูลอาจยังไม่ถูกบันทึก)');
        }
        throw new Error('ติดต่อเซิร์ฟเวอร์ไม่ได้ · ตรวจสัญญาณอินเทอร์เน็ตแล้วลองใหม่');
    }

    let out = {};
    try { out = await res.json(); } catch (e) { throw new Error('เซิร์ฟเวอร์ตอบกลับผิดรูปแบบ (HTTP ' + res.status + ')'); }
    if (!res.ok || out.ok === false) throw new Error(out.error || 'บันทึกไม่สำเร็จ (HTTP ' + res.status + ')');
    return out;
}

$('#rowForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!editingRow) return;
    showError('#rowError', '');
    const btn = $('#rowSave');
    const label = btn.innerHTML;
    btn.classList.add('saving');
    btn.innerHTML = icon('refresh') + ' กำลังบันทึกลงชีต…';
    $('#saveBar').hidden = false;
    const r = editingRow;
    const country = $('#rCountry').value.trim();
    const temple = $('#rTemple').value.trim();
    try {
        await sheetWrite({
            action: 'update',
            no: r.no,
            round: r.round,
            temple,
            date: $('#rDate').value || undefined,
            monk: $('#rMonk').value.trim(),
            topic: $('#rTopic').value.trim(),
            attendance: $('#rJoin').value.trim()
        });
        if (temple && country !== (temples[temple] || '')) await saveTemple(temple, country);

        // บันทึกสำเร็จ: ปุ่มเปลี่ยนเป็นติ๊กถูกแป๊บหนึ่งก่อนปิด จะได้รู้ว่าเข้าจริง
        $('#saveBar').hidden = true;
        btn.classList.remove('saving');
        btn.classList.add('saved');
        btn.innerHTML = icon('check') + ' บันทึกแล้ว';
        await new Promise(res => setTimeout(res, 750));

        flashRound = r.round;                 // ให้แถวนั้นกะพริบตอนวาดใหม่
        rowModal.close();
        toast('บันทึกลงชีตแล้ว');
        loadSchedule();                       // โหลดซ้ำเพื่อยืนยันว่าเข้าจริง
    } catch (err) {
        showError('#rowError', err.message || 'บันทึกไม่สำเร็จ');
    } finally {
        $('#saveBar').hidden = true;
        btn.classList.remove('saving', 'saved');
        btn.innerHTML = label;
    }
});

/* ============================================================
   ส่วนที่ 3 · ข้อความ LINE
   ============================================================ */

const DEFAULT_TPL = [
    'โครงการบ้านกัลยาณมิตร {{season}}',
    'สามัคคีธรรมพุทธศาสนิกชน',
    'ในทวีปยุโรป🔹ครั้งที่ {{round}}',
    '{{date_full}}',
    '',
    '“{{topic}}“',
    '❖ โดย {{monk}}',
    '{{temple}} {{country}}',
    '🕰️➖➖➖➖➖➖➖',
    'เวลา {{time_eu}} น.🇪🇺',
    'เวลา {{time_gb}} น.🇬🇧',
    'เวลา {{time_th}} น.🇹🇭',
    '🎥➖➖➖➖➖➖➖',
    'Meeting id: {{meeting_id}}',
    'Passcode : {{passcode}}',
    'หรือคลิกที่ลิ้งค์🌐📱',
    '{{zoom_link}}'
].join('\n');

const DEFAULT_MSG = {
    template: DEFAULT_TPL,
    start: '18:30',
    end: '20:45',
    baseZone: 'Europe/Berlin',
    zones: [['time_gb', 'Europe/London'], ['time_th', 'Asia/Bangkok']],
    meetingId: '',
    passcode: '',
    zoomLink: ''
};

let msgCfg = Object.assign({}, DEFAULT_MSG);
let temples = {};          // { ชื่อวัด: ประเทศ }

async function loadSettings() {
    const [{ data: st }, { data: tp }] = await Promise.all([
        db.from('app_settings').select('value').eq('key', 'line_message').maybeSingle(),
        db.from('temples').select('name,country')
    ]);
    msgCfg = Object.assign({}, DEFAULT_MSG, (st && st.value) || {});
    temples = {};
    (tp || []).forEach(t => { temples[t.name] = t.country; });
}

async function saveSettings() {
    const { error } = await db.from('app_settings')
        .upsert({ key: 'line_message', value: msgCfg }, { onConflict: 'key' });
    if (error) throw error;
}

async function saveTemple(name, country) {
    const { error } = await db.from('temples').upsert({ name, country }, { onConflict: 'name' });
    if (error) throw error;
    temples[name] = country;
}

/** ครั้งถัดไปที่ยังมาไม่ถึง (ไว้เลือกให้อัตโนมัติ) */
function defaultRound() {
    const today = startOfToday();
    const next = sched.filter(r => r.date && r.date >= today).sort((a, b) => a.date - b.date)[0];
    return next ? next.round : (sched[sched.length - 1] || {}).round;
}

function fillRoundPicker() {
    const sel = $('#lineRound');
    const keep = sel.value;
    sel.innerHTML = sched.map(r =>
        `<option value="${esc(r.round)}">ครั้งที่ ${esc(r.round)} · ${esc(thaiDateShort(r.date))} · ${esc(r.temple)}</option>`
    ).join('');
    sel.value = (keep && sched.some(r => r.round === keep)) ? keep : (defaultRound() || '');
}

/** ดึง Meeting ID จากลิงก์ zoom แบบ /j/<id> แล้วคั่นเป็น 3-3-4 */
function meetingIdFrom(url) {
    const m = String(url || '').match(/\/j\/(\d{9,12})/);
    if (!m) return '';
    const d = m[1];
    return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
         : d.length === 11 ? `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}` : d;
}

function buildMessage(r) {
    if (!r) return { text: '', missing: ['ยังไม่ได้เลือกครั้งที่'] };

    const missing = [];
    if (!r.monk)  missing.push('ชื่อพระอาจารย์');
    if (!r.topic) missing.push('หัวข้อเทศน์');
    if (!r.date)  missing.push('วันที่');
    const country = temples[r.temple] || '';
    if (!country) missing.push(`ประเทศของ “${r.temple}”`);

    // เวลาของ "วันนั้น" — ช่วงเปลี่ยนเวลาฤดูร้อน/ฤดูหนาวจะเลื่อนให้เอง
    let times = { time_eu: '', time_gb: '', time_th: '' };
    if (r.date) {
        const [sh, sm] = msgCfg.start.split(':').map(Number);
        const [eh, em] = msgCfg.end.split(':').map(Number);
        const y = r.date.getFullYear(), mo = r.date.getMonth(), d = r.date.getDate();
        const s = zonedToUtc(y, mo, d, sh, sm, msgCfg.baseZone);
        const e = zonedToUtc(y, mo, d, eh, em, msgCfg.baseZone);
        const span = tz => `${timeInZone(s, tz)}-${timeInZone(e, tz)}`;
        times.time_eu = span(msgCfg.baseZone);
        (msgCfg.zones || []).forEach(([key, tz]) => { times[key] = span(tz); });
    }

    const vals = Object.assign({
        season: SEASON_CODE,
        round: r.round,
        date_full: thaiDateFull(r.date),
        temple: r.temple,
        country,
        monk: r.monk,
        topic: r.topic,
        meeting_id: msgCfg.meetingId || meetingIdFrom(msgCfg.zoomLink),
        passcode: msgCfg.passcode,
        zoom_link: msgCfg.zoomLink
    }, times);

    if (!vals.meeting_id) missing.push('Meeting ID');
    if (!vals.passcode)   missing.push('Passcode');
    if (!vals.zoom_link)  missing.push('ลิงก์ Zoom');

    const text = msgCfg.template.replace(/\{\{(\w+)\}\}/g, (m, k) =>
        (vals[k] !== undefined && vals[k] !== null) ? String(vals[k]) : m);
    return { text, missing };
}

function renderLineMessage() {
    const r = sched.find(x => x.round === $('#lineRound').value);
    const { text, missing } = buildMessage(r);
    $('#lineOut').textContent = text;
    $('#lineSub').textContent = r ? `ครั้งที่ ${r.round} · ${esc(r.temple)}` : 'ยังไม่มีข้อมูลในชีต';

    const warn = $('#lineWarn');
    warn.hidden = !missing.length;
    if (missing.length) warn.querySelector('span').textContent = 'ยังขาด: ' + missing.join(' · ');
    $('#lineCopy').disabled = !text;
}

$('#lineRound').addEventListener('change', renderLineMessage);

$('#lineCopy').addEventListener('click', async () => {
    const text = $('#lineOut').textContent;
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        toast('คัดลอกข้อความแล้ว · ไปวางในไลน์ได้เลย');
    } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); toast('คัดลอกข้อความแล้ว'); }
        catch (e2) { toast('คัดลอกไม่ได้ · กดค้างที่ข้อความเพื่อคัดลอกเอง'); }
        ta.remove();
    }
});

$('#lineShare').addEventListener('click', () => {
    const text = $('#lineOut').textContent;
    if (text && navigator.share) navigator.share({ text }).catch(() => {});
});
if (navigator.share) $('#lineShare').hidden = false;

/* ── โมดัลต้นแบบ ── */
const tplModal = $('#tplModal');
function openTpl() {
    $('#tStart').value = msgCfg.start;
    $('#tEnd').value = msgCfg.end;
    $('#tMeeting').value = msgCfg.meetingId;
    $('#tPass').value = msgCfg.passcode;
    $('#tLink').value = msgCfg.zoomLink;
    $('#tBody').value = msgCfg.template;
    showError('#tplError', '');
    tplModal.showModal();
}
$('#tplBtn').addEventListener('click', openTpl);
$('#tplClose').addEventListener('click', () => tplModal.close());
$('#tplReset').addEventListener('click', () => {
    $('#tBody').value = DEFAULT_TPL;
    $('#tStart').value = DEFAULT_MSG.start;
    $('#tEnd').value = DEFAULT_MSG.end;
});

$('#tplForm').addEventListener('submit', async e => {
    e.preventDefault();
    showError('#tplError', '');
    const time = v => /^\d{2}:\d{2}$/.test(v);
    if (!time($('#tStart').value) || !time($('#tEnd').value)) {
        return showError('#tplError', 'กรุณากรอกเวลาเริ่มและเวลาเลิกให้ครบ');
    }
    const btn = $('#tplSave');
    btn.classList.add('busy');
    const before = Object.assign({}, msgCfg);
    try {
        msgCfg = Object.assign({}, msgCfg, {
            start: $('#tStart').value,
            end: $('#tEnd').value,
            meetingId: $('#tMeeting').value.trim(),
            passcode: $('#tPass').value.trim(),
            zoomLink: $('#tLink').value.trim(),
            template: $('#tBody').value
        });
        await saveSettings();
        renderLineMessage();
        tplModal.close();
        toast('บันทึกต้นแบบแล้ว');
    } catch (err) {
        msgCfg = before;
        showError('#tplError', (err && err.message) || 'บันทึกไม่สำเร็จ');
    } finally {
        btn.classList.remove('busy');
    }
});

/* ── แท็บ ── */
const PANES = { schedule: '#paneSchedule', events: '#paneEvents', line: '#paneLine' };
function setTab(name) {
    if (!PANES[name]) name = 'schedule';
    Object.entries(PANES).forEach(([k, sel]) => { $(sel).hidden = k !== name; });
    $$('.tab-btn').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    try { localStorage.setItem('dmceu.admin.tab', name); } catch (e) {}
    if (name === 'line') renderLineMessage();
    window.scrollTo(0, 0);
}
$$('.tab-btn').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
