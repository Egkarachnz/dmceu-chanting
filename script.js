/* ============================================================
   DMCEU · ตารางวัดนำสวดมนต์ SS15
   ============================================================ */

/* ────────────────────────────────────────────────────────────
   แหล่งข้อมูล Google Sheets
   วาง "ลิงก์ชีต" ตรงนี้ได้เลย — รับได้ทุกแบบ เช่น
     https://docs.google.com/spreadsheets/d/<ID>/edit#gid=0
     https://docs.google.com/spreadsheets/d/<ID>/edit?usp=sharing
     หรือใส่แค่ <ID> เฉย ๆ
   ถ้าลิงก์มี #gid=... ระบบจะดึงเฉพาะแท็บนั้นให้อัตโนมัติ

   เงื่อนไข: ชีตต้องแชร์เป็น "ทุกคนที่มีลิงก์ · ผู้อ่าน" และเรียงคอลัมน์เหมือนเดิม
   A=ลำดับที่  B=ชื่อวัด  C=ครั้งที่  D=วันที่  E=พระอาจารย์  F=หัวข้อ
   (เปลี่ยนจากในแอปได้ที่ "ตั้งค่าแหล่งข้อมูล" ท้ายหน้า โดยไม่ต้องแก้ไฟล์นี้)
   ──────────────────────────────────────────────────────────── */
const SHEET_LINK = 'https://docs.google.com/spreadsheets/d/1pcqRU-76PFxUGj99ZVV5VlA028OaJ6nj7j12mXgOOzQ/edit';

/* ────────────────────────────────────────────────────────────
   โหมดแอดมิน (ทีมงาน) — ซ่อนปุ่ม "ตั้งค่าแหล่งข้อมูล" จากผู้ใช้ทั่วไป
   เข้าโหมดแอดมินได้ 2 ทาง
     1) แตะโลโก้ท้ายหน้า 5 ครั้งติดกัน
     2) เปิดลิงก์เว็บต่อท้ายด้วย #admin
   แล้วใส่รหัสผ่านทีมงาน (จำไว้ 30 วันต่อเครื่อง)

   เปลี่ยนรหัส: รันคำสั่งนี้ใน Terminal แล้วเอาค่าที่ได้มาใส่ passcodeHash
     printf '%s' 'รหัสใหม่' | shasum -a 256
   (ต้องเปิดเว็บผ่าน https ถึงจะตรวจรหัสได้ — GitHub Pages ใช้ได้เลย)
   ──────────────────────────────────────────────────────────── */
const ADMIN_CONFIG = {
    passcodeHash: '288b096b801ffa082406f61e95e6e3bf64e73872351d3d6fff6375d95fdd0bb5',
    rememberDays: 30
};
const ADMIN_KEY = 'dmceu.ss15.admin';

const SOURCE_KEY = 'dmceu.ss15.source';
const CACHE_PREFIX = 'dmceu.ss15.rows.v2';

/** แปลงลิงก์/ไอดีชีต → { id, gid } หรือ { error } */
function parseSheetSource(input) {
    const raw = String(input || '').trim();
    if (!raw) return { error: 'empty' };
    if (raw.indexOf('/d/e/') > -1) return { error: 'published' };

    let id = null;
    const m = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (m) id = m[1];
    else if (/^[a-zA-Z0-9_-]{20,}$/.test(raw)) id = raw;
    if (!id) return { error: 'invalid' };

    const g = raw.match(/[#&?]gid=(\d+)/);
    return { id: id, gid: g ? g[1] : null };
}

/** แหล่งข้อมูลที่ใช้อยู่ (ค่าที่ตั้งในแอป > SHEET_LINK) */
function currentSource() {
    let saved = null;
    try { saved = localStorage.getItem(SOURCE_KEY); } catch (e) {}
    if (saved) {
        const parsed = parseSheetSource(saved);
        if (!parsed.error) return parsed;
    }
    const def = parseSheetSource(SHEET_LINK);
    return def.error ? { id: '', gid: null } : def;
}

function sheetUrl(src) {
    return 'https://docs.google.com/spreadsheets/d/' + src.id +
           '/gviz/tq?tqx=out:json;responseHandler:processSheetData' +
           (src.gid ? '&gid=' + src.gid : '');
}

/** แคชแยกตามชีต — เปลี่ยนชีตแล้วจะไม่เห็นข้อมูลเก่าค้าง */
function cacheKey() {
    const src = currentSource();
    return CACHE_PREFIX + ':' + src.id + (src.gid ? '.' + src.gid : '');
}

/* ────────────────────────────────────────────────────────────
   ตั้งค่าการถ่ายทอดสด — ปกติ "ไม่ต้องแก้ไฟล์นี้"
   แอดมินตั้งได้จากในแอปที่ "ตั้งค่า Live / Zoom" ท้ายหน้า

   ลำดับความสำคัญของค่า:
     1) ค่าที่บันทึกไว้ในเครื่องนี้ (แอดมินกด "บันทึกลงเครื่องนี้" — ใช้ทดลอง)
     2) ค่าจากแท็บชื่อ config ในชีตเดียวกัน  ← ค่านี้ทุกคนเห็นเหมือนกัน
     3) ค่าตั้งต้นข้างล่างนี้
   ──────────────────────────────────────────────────────────── */
const LIVE_DEFAULTS = {
    zoomUrl: 'https://us06web.zoom.us/j/3562258816?pwd=ChEDvYbI5bUlEQaJV0gVsHoXicJ5pm.1&omn=86163194865',
    timeZone: 'Europe/Berlin',   // 'local' = ใช้เวลาท้องถิ่นของเครื่องผู้ชม
    start: '19:00',
    end: '21:00',
    preMinutes: 30,
    days: null                   // null = เฉพาะวันที่มีคิวในตาราง, [0,6] = อา.+ส. เสมอ
};

const SEASON_LABEL = 'ซีซั่นที่ 16';

/* ────────────────────────────────────────────────────────────
   หน้า "กิจกรรม" — รูปโปสเตอร์ตารางกิจกรรม
   ลำดับแหล่งข้อมูล: 1) หลังบ้าน admin.html (Supabase ตาราง events)
                    2) ชีตแท็บ "กิจกรรม" (A=หัวข้อ B=ลิงก์รูป C=รายละเอียด D=ลิงก์เพิ่มเติม)
                    3) รายการตั้งต้นข้างล่างนี้
   ──────────────────────────────────────────────────────────── */
const EVENTS_SHEET_TAB = 'กิจกรรม';
const EVENTS_DEFAULT = [
    {
        title: 'กำหนดการกิจกรรมบ้านกัลยาณมิตร',
        image: 'assets/events/schedule-ss16.jpg',
        desc: 'สามัคคีธรรมสวดมนต์ทวีปยุโรป SS16 · ทุกครั้งเริ่ม 18:30 น. (เวลายุโรปกลาง)',
        link: ''
    }
];

/* ────────────────────────────────────────────────────────────
   ตัวนับคนเข้าชม / คนออนไลน์ (Supabase โปรเจกต์ dmceu-chanting)
   · key เป็น publishable key ใส่ในหน้าเว็บได้ตามปกติ
   · ตารางถูกล็อกไว้ เรียกได้เฉพาะฟังก์ชัน record_visit / heartbeat / leave_presence
   · ใส่ url เป็นค่าว่าง ('') ถ้าจะปิดตัวนับ
   ──────────────────────────────────────────────────────────── */
const STATS_CONFIG = {
    url: 'https://apjgwbwdzkxadbcutuxt.supabase.co',
    key: 'sb_publishable_2LvhHxTNRxdjKlQVNg-AkQ_10ZEiHTK',
    heartbeatSeconds: 30
};   // ข้อความนำหน้าช่วงวันที่บนป้ายหัวหน้าแรก

const LIVE_KEY = 'dmceu.ss15.live';
const LIVE_CONFIG = Object.assign({}, LIVE_DEFAULTS);  // ค่าที่ใช้งานจริง
let liveFromSheet = {};   // ค่าจากแท็บ config
let liveFromLocal = {};   // ค่าที่แอดมินบันทึกไว้ในเครื่องนี้

/** รวมค่าทั้ง 3 ชั้นเข้าเป็นค่าที่ใช้จริง */
function recomputeLive(skipRender) {
    Object.assign(LIVE_CONFIG, LIVE_DEFAULTS, liveFromSheet, liveFromLocal);
    if (!skipRender && typeof renderLive === 'function') renderLive();
}

/** ตรวจ/แปลงค่าที่รับมาจากชีตหรือฟอร์ม → ได้เฉพาะค่าที่ถูกต้อง */
function normalizeLiveValues(raw) {
    const out = {};
    const time = v => (/^\d{1,2}:\d{2}$/.test(String(v).trim())
        ? String(v).trim().replace(/^(\d):/, '0$1:') : null);

    if (raw.zoomUrl && /^https?:\/\//i.test(String(raw.zoomUrl).trim())) out.zoomUrl = String(raw.zoomUrl).trim();
    if (raw.start && time(raw.start)) out.start = time(raw.start);
    if (raw.end && time(raw.end)) out.end = time(raw.end);
    if (raw.timeZone) {
        const tz = String(raw.timeZone).trim();
        if (tz === 'local') out.timeZone = 'local';
        else { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); out.timeZone = tz; } catch (e) {} }
    }
    if (raw.preMinutes !== undefined && raw.preMinutes !== '' && raw.preMinutes !== null) {
        const n = parseInt(raw.preMinutes, 10);
        if (!isNaN(n) && n >= 0 && n <= 720) out.preMinutes = n;
    }
    if (raw.days !== undefined && raw.days !== null) {
        const v = String(raw.days).trim().toLowerCase();
        if (v === '' || v === 'auto') out.days = null;
        else {
            const map = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
            const days = v.split(/[,\s]+/).map(x => (x in map ? map[x] : parseInt(x, 10)))
                          .filter(n => !isNaN(n) && n >= 0 && n <= 6);
            if (days.length) out.days = days;
        }
    }
    return out;
}

/* ── อ่านค่าจากแท็บ config ในชีต (คีย์อยู่คอลัมน์ A, ค่าอยู่คอลัมน์ B) ──
   zoom_url | live_start | live_end | live_timezone | live_pre_min | live_days */
const CONFIG_FIELDS = {
    zoom_url: 'zoomUrl', live_start: 'start', live_end: 'end',
    live_timezone: 'timeZone', live_pre_min: 'preMinutes', live_days: 'days'
};

function loadConfigSheet() {
    const src = currentSource();
    if (!src.id) return;
    const el = document.createElement('script');
    el.src = 'https://docs.google.com/spreadsheets/d/' + src.id +
             '/gviz/tq?tqx=out:json;responseHandler:processConfigData' +
             '&sheet=config&headers=0' +            // headers=0 = อ่านแถวแรกเป็นข้อมูล ไม่ใช่หัวตาราง
             '&tq=' + encodeURIComponent('select A,B limit 50') + '&_=' + Date.now();
    el.async = true;
    el.onerror = () => el.remove();      // ไม่มีแท็บ config ก็ใช้ค่าตั้งต้นตามปกติ
    el.addEventListener('load', () => el.remove());
    document.head.appendChild(el);
}

function processConfigData(response) {
    if (!response || response.status === 'error' || !response.table) return;
    const raw = {};
    (response.table.rows || []).forEach(row => {
        if (!row || !row.c) return;
        const key = row.c[0] && row.c[0].v !== null && row.c[0].v !== undefined
            ? String(row.c[0].v).trim().toLowerCase() : '';
        const val = row.c[1] && row.c[1].v !== null && row.c[1].v !== undefined
            ? String(row.c[1].f || row.c[1].v).trim() : '';
        if (CONFIG_FIELDS[key]) raw[CONFIG_FIELDS[key]] = val;
    });
    liveFromSheet = normalizeLiveValues(raw);
    recomputeLive();
}
window.processConfigData = processConfigData;

/* ค่าที่แอดมินบันทึกไว้ในเครื่องนี้ */
(function loadLocalLive() {
    try {
        const saved = JSON.parse(localStorage.getItem(LIVE_KEY) || '{}');
        liveFromLocal = normalizeLiveValues(saved);
    } catch (e) { liveFromLocal = {}; }
    recomputeLive(true);
})();
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.prototype.slice.call(document.querySelectorAll(s));

const thaiMonths = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const thaiDays   = ["วันอาทิตย์","วันจันทร์","วันอังคาร","วันพุธ","วันพฤหัสบดี","วันศุกร์","วันเสาร์"];

const state = { q: '', status: 'all', timeline: 'all', view: 'cards', showPast: false };   // view: cards | table
try { if (localStorage.getItem('dmceu.ss15.view') === 'table') state.view = 'table'; } catch (e) {}
let allData = [];
let nextQueueNo = null;
let lastSync = null;
let loading = false;
let loadTimer = null;

/* ─── Utils ─── */
function esc(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

function icon(name, cls) {
    return `<svg class="ic ${cls || ''}"><use href="#i-${name}"/></svg>`;
}

function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2600);
}

function thaiDate(date) {
    if (!date) return '';
    return `${String(date.getDate()).padStart(2, '0')} ${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}`;
}

function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

function daysUntil(date) {
    if (!date) return null;
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    return Math.round((d - startOfToday()) / 86400000);
}

/* ─── Theme (light / dark / auto) ─── */
const themeOrder = ['light', 'dark', 'auto'];
const themeIcons = { light: 'sun', dark: 'moon', auto: 'auto' };
const themeNames = { light: 'โหมดสว่าง', dark: 'โหมดมืด', auto: 'ตามระบบ' };
const sysDark = window.matchMedia('(prefers-color-scheme: dark)');

function resolveTheme(pref) {
    return pref === 'auto' ? (sysDark.matches ? 'dark' : 'light') : pref;
}

function applyTheme(pref, announce) {
    const mode = resolveTheme(pref);
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.setAttribute('data-theme-pref', pref);
    localStorage.setItem('theme', pref);
    const use = $('#theme-icon').querySelector('use');
    if (use) use.setAttribute('href', '#i-' + themeIcons[pref]);
    const meta = $('#meta-theme-color');
    if (meta) meta.setAttribute('content', mode === 'dark' ? '#080b16' : '#141a33');
    if (announce) toast(themeNames[pref]);
}

$('#themeBtn').addEventListener('click', () => {
    const cur = localStorage.getItem('theme') || 'auto';
    applyTheme(themeOrder[(themeOrder.indexOf(cur) + 1) % themeOrder.length], true);
});
sysDark.addEventListener('change', () => {
    if ((localStorage.getItem('theme') || 'auto') === 'auto') applyTheme('auto');
});
applyTheme(localStorage.getItem('theme') || 'auto');

/* ─── Clock & locale flag ─── */
function updateClock() {
    const now = new Date();
    $('#live-time').textContent =
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    $('#live-date-hero').textContent = `${thaiDays[now.getDay()]}ที่ ${thaiDate(now)}`;
}
updateClock();
setInterval(updateClock, 20000);

(function initFlag() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tzMap = {
        'Asia/Bangkok':'🇹🇭','Europe/London':'🇬🇧','Europe/Paris':'🇫🇷','Europe/Berlin':'🇩🇪',
        'Europe/Rome':'🇮🇹','Europe/Zurich':'🇨🇭','Europe/Vienna':'🇦🇹','Europe/Amsterdam':'🇳🇱',
        'Europe/Brussels':'🇧🇪','Europe/Copenhagen':'🇩🇰','Europe/Stockholm':'🇸🇪','Europe/Oslo':'🇳🇴',
        'Europe/Helsinki':'🇫🇮','Europe/Madrid':'🇪🇸','Europe/Lisbon':'🇵🇹','Europe/Dublin':'🇮🇪',
        'Europe/Prague':'🇨🇿','Europe/Warsaw':'🇵🇱','Asia/Tokyo':'🇯🇵','America/New_York':'🇺🇸',
        'Australia/Sydney':'🇦🇺'
    };
    $('#user-flag').textContent = tzMap[tz] || '🌍';
    fetch('https://get.geojs.io/v1/ip/country.json')
        .then(r => r.json())
        .then(d => {
            if (!d.country) return;
            const cp = d.country.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0));
            $('#user-flag').textContent = String.fromCodePoint.apply(String, cp);
        })
        .catch(() => {});
})();

/* ─── Data loading (JSONP) ─── */
let silentLoad = false;   // โหลดเบื้องหลัง (ไม่หมุนไอคอน ไม่เปลี่ยนข้อความสถานะ)
let lastRowsSig = null;   // ลายเซ็นข้อมูลล่าสุด ไว้เช็คว่าชีตเปลี่ยนจริงไหม

function setLoading(on) {
    loading = on;
    if (!silentLoad) $('#refreshBtn').classList.toggle('spinning', on);
    if (!on) silentLoad = false;
}

function loadData(manual, silent) {
    if (loading) return;
    silentLoad = !!silent;
    setLoading(true);
    if (!silent) updateSyncNote(manual ? 'กำลังอัปเดต…' : '');

    const s = document.createElement('script');
    s.src = sheetUrl(currentSource()) + '&_=' + Date.now();
    s.async = true;
    s.onerror = () => handleScriptError();
    document.head.appendChild(s);
    s.addEventListener('load', () => s.remove());

    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => { if (loading) handleScriptError(); }, 15000);
}

function processSheetData(response) {
    clearTimeout(loadTimer);
    const wasSilent = silentLoad;
    setLoading(false);

    if (!response || response.status === 'error' || !response.table) {
        handleScriptError();
        return;
    }
    const rows = response.table.rows || [];
    const sig = String(response.sig || '') + ':' + rows.length;
    lastSync = new Date();

    // ข้อมูลเหมือนเดิม → ไม่ต้องวาดหน้าใหม่ให้กะพริบ
    if (sig === lastRowsSig && allData.length) { updateSyncNote(); return; }
    const isChange = lastRowsSig !== null && allData.length > 0;
    lastRowsSig = sig;

    try {
        localStorage.setItem(cacheKey(), JSON.stringify({ ts: Date.now(), rows: rows }));
    } catch (e) { /* quota — ignore */ }

    applyRows(rows);
    updateSyncNote();
    if (isChange && wasSilent) toast('ข้อมูลในตารางอัปเดตแล้ว');
}
window.processSheetData = processSheetData;

function handleScriptError() {
    clearTimeout(loadTimer);
    const wasSilent = silentLoad;
    setLoading(false);
    if (allData.length) {
        updateSyncNote('อัปเดตไม่สำเร็จ · แสดงข้อมูลที่บันทึกไว้', true);
        if (!wasSilent) toast('เชื่อมต่อไม่สำเร็จ · แสดงข้อมูลล่าสุดที่บันทึกไว้');   // โหลดเบื้องหลังพลาดไม่ต้องเด้งเตือน
        return;
    }
    $('#cards-container').innerHTML = `
        <div class="state">
            ${icon('offline')}
            <strong>เชื่อมต่อฐานข้อมูลไม่สำเร็จ</strong>
            <p>โปรดตรวจสอบอินเทอร์เน็ต หรือสิทธิ์การเข้าถึง Google Sheets แล้วลองใหม่อีกครั้ง</p>
            <button type="button" onclick="loadData(true)">ลองอีกครั้ง</button>
        </div>`;
    updateSyncNote('ออฟไลน์', true);
}
window.handleScriptError = handleScriptError;
window.loadData = loadData;

function loadCache() {
    try {
        const raw = localStorage.getItem(cacheKey());
        if (!raw) return false;
        const cached = JSON.parse(raw);
        if (!cached || !cached.rows || !cached.rows.length) return false;
        lastSync = new Date(cached.ts);
        applyRows(cached.rows);
        updateSyncNote();
        return true;
    } catch (e) { return false; }
}

function updateSyncNote(text, warn) {
    const el = $('#sync-note');
    el.classList.toggle('offline', !!warn);
    if (text) { el.innerHTML = `${icon(warn ? 'offline' : 'refresh')} ${esc(text)}`; return; }
    if (!navigator.onLine) { el.classList.add('offline'); el.innerHTML = `${icon('offline')} ออฟไลน์`; return; }
    if (!lastSync) { el.textContent = ''; return; }
    const t = `${String(lastSync.getHours()).padStart(2, '0')}:${String(lastSync.getMinutes()).padStart(2, '0')}`;
    el.innerHTML = `${icon('check')} อัปเดต ${t} น.`;
}

window.addEventListener('online',  () => { updateSyncNote(); loadData(); });
window.addEventListener('offline', () => updateSyncNote());

/* ─── Parsing ─── */
function parseDateFromGs(cell) {
    if (!cell) return null;
    if (cell.v && typeof cell.v === 'string' && cell.v.indexOf('Date(') === 0) {
        const m = cell.v.match(/Date\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) return new Date(+m[1], +m[2], +m[3]);
    }
    const str = cell.f || cell.v;
    if (typeof str === 'string') {
        const months = thaiMonths.concat(["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
            "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"]);
        const dMatch = str.match(/\d{1,2}/);
        const yMatch = str.match(/(25\d{2}|20\d{2})/);
        let mIndex = -1;
        for (let i = 0; i < months.length; i++) {
            if (str.indexOf(months[i]) > -1) { mIndex = i % 12; break; }
        }
        if (dMatch && yMatch && mIndex > -1) {
            let year = parseInt(yMatch[0], 10);
            if (year > 2400) year -= 543;
            return new Date(year, mIndex, parseInt(dMatch[0], 10));
        }
    }
    return null;
}

/** คิวนี้จบไปแล้วหรือยัง — ถ้าเป็นวันนี้ ถือว่าจบเมื่อเลยเวลาเลิกถ่ายทอด (LIVE_CONFIG.end) */
function sessionOver(date) {
    if (!date) return false;
    const z = nowInZone(LIVE_CONFIG.timeZone);
    const today = new Date(z.y, z.m - 1, z.d).getTime();
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    if (d.getTime() < today) return true;
    if (d.getTime() === today) return z.minutes >= toMinutes(LIVE_CONFIG.end);
    return false;
}

function getTimelineStatus(date, isNext) {
    if (!date) return { key: 'unknown', label: 'รอวันที่', note: 'ยังไม่ระบุวันที่' };
    const days = daysUntil(date);
    if (sessionOver(date)) return { key: 'past', label: 'ผ่านไปแล้ว', note: 'สวดมนต์ผ่านไปแล้ว' };
    if (isNext) return { key: 'next', label: days === 0 ? 'สวดมนต์วันนี้' : 'คิวถัดไป', note: relativeNote(days) };
    return { key: 'future', label: 'กำลังจะมาถึง', note: relativeNote(days) };
}

/** หาคิวถัดไปใหม่ (เรียกตอนโหลดข้อมูล และทุก 30 วิ เพื่อสลับคิวเมื่อของวันนี้จบ) */
function refreshTimeline(force) {
    let nextEvent = null;
    allData.forEach(it => {
        if (!it.parsedDate || sessionOver(it.parsedDate)) return;
        if (!nextEvent || it.parsedDate < nextEvent.parsedDate) nextEvent = it;
    });
    const newNo = nextEvent ? nextEvent.no : null;
    if (!force && newNo === nextQueueNo) return false;
    nextQueueNo = newNo;
    allData.forEach(it => { it.timelineStatus = getTimelineStatus(it.parsedDate, it.no === nextQueueNo); });
    renderNext(nextEvent);
    render();
    return true;
}

function relativeNote(days) {
    if (days === 0) return 'วันนี้';
    if (days === 1) return 'พรุ่งนี้';
    if (days < 7)   return `อีก ${days} วัน`;
    if (days < 30)  return `อีก ${Math.round(days / 7)} สัปดาห์`;
    return `อีก ${Math.round(days / 30)} เดือน`;
}

function applyRows(rows) {
    const getVal = c => (c && c.v !== null && c.v !== undefined && String(c.v).trim() !== '') ? String(c.v).trim() : '-';
    const getDate = c => c ? (c.f ? String(c.f).trim() : (c.v ? String(c.v).trim() : '-')) : '-';

    allData = [];
    let booked = 0, available = 0;

    rows.forEach(row => {
        if (!row || !row.c) return;
        const no = getVal(row.c[0]);
        if (no === '-' || isNaN(no)) return;

        const item = {
            no: no,
            temple: getVal(row.c[1]),
            time: getVal(row.c[2]),
            date: getDate(row.c[3]),
            monk: getVal(row.c[4]),
            topic: getVal(row.c[5]),
            parsedDate: parseDateFromGs(row.c[3])
        };
        item.available = (item.monk === '-' || item.topic === '-');
        item.dayOfWeek = item.parsedDate ? item.parsedDate.getDay() : null;
        allData.push(item);

        item.available ? available++ : booked++;
    });

    const dated = allData.filter(it => it.parsedDate).map(it => it.parsedDate.getTime());
    renderSeasonRange(dated.length ? new Date(Math.min.apply(null, dated)) : null,
                      dated.length ? new Date(Math.max.apply(null, dated)) : null);

    renderStats(booked, available);
    refreshTimeline(true);
    renderLive();

    if (rows.length && !allData.length) {
        toast('อ่านชีตได้ แต่ไม่พบแถวข้อมูล · ตรวจลำดับคอลัมน์ (A=ลำดับที่)');
    }
}

/* ─── ป้ายหัวหน้าแรก: ซีซั่น + ช่วงวันที่ของซีซั่น ─── */
function renderSeasonRange(from, to) {
    const el = $('#season-range');
    if (!el) return;
    if (!from || !to) { el.textContent = SEASON_LABEL; return; }

    const d = x => x.getDate();
    const mo = x => thaiMonths[x.getMonth()];
    const y = x => x.getFullYear() + 543;

    let range;
    if (y(from) !== y(to))                       // คนละปี: 12 ธ.ค. 2569 – 10 ม.ค. 2570
        range = `${d(from)} ${mo(from)} ${y(from)} – ${d(to)} ${mo(to)} ${y(to)}`;
    else if (from.getMonth() !== to.getMonth())  // คนละเดือน: 12 ก.ย. – 20 ธ.ค. 2569
        range = `${d(from)} ${mo(from)} – ${d(to)} ${mo(to)} ${y(to)}`;
    else if (d(from) !== d(to))                  // เดือนเดียวกัน: 12 – 20 ก.ย. 2569
        range = `${d(from)} – ${d(to)} ${mo(to)} ${y(to)}`;
    else                                         // วันเดียว
        range = `${d(to)} ${mo(to)} ${y(to)}`;

    el.textContent = `${SEASON_LABEL} · ${range}`;
}

/* ─── Hero stats ─── */
function renderStats(booked, available) {
    const total = booked + available;
    animateNum($('#stat-booked'), booked);
    animateNum($('#stat-available'), available);
    animateNum($('#stat-total'), total);

    const pct = total ? Math.round((booked / total) * 100) : 0;
    $('#progress-fill').style.width = pct + '%';
    $('#progress').setAttribute('aria-valuenow', String(pct));
    $('#progress-note').textContent = total
        ? `ลงข้อมูลแล้ว ${pct}% · เหลืออีก ${available} คิวที่รอลงข้อมูล`
        : 'ยังไม่มีข้อมูล';
}

function animateNum(el, target) {
    const from = parseInt(el.textContent, 10) || 0;
    if (from === target) { el.textContent = target; return; }
    const start = performance.now(), dur = 600;
    (function step(now) {
        const p = Math.min(1, (now - start) / dur);
        el.textContent = Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
    })(start);
}

/* ─── Next queue card ─── */
function renderNext(ev) {
    const card = $('#next-queue-banner');
    if (!ev) { card.classList.remove('visible'); return; }

    $('#nq-temple').textContent = ev.temple;
    $('#nq-date').textContent = ev.date !== '-' ? ev.date : 'ยังไม่ระบุวันที่';

    const monk = $('#nq-monk');
    monk.textContent = ev.monk === '-' ? 'รอลงชื่อพระอาจารย์' : ev.monk;
    monk.classList.toggle('pending', ev.monk === '-');

    const noEl = $('#nq-no-container');
    noEl.textContent = 'ลำดับที่ ' + ev.no;
    noEl.hidden = false;

    const days = daysUntil(ev.parsedDate);
    const isToday = days === 0;
    $('#nq-label').textContent = isToday ? 'คิวสวดมนต์วันนี้' : 'คิวสวดมนต์ถัดไป';
    $('#nq-countdown').textContent = days === null ? ''
        : (isToday ? `${LIVE_CONFIG.start}–${LIVE_CONFIG.end} น.` : relativeNote(days));
    card.classList.toggle('is-today', isToday);

    card.classList.add('visible');
}

/* ─── Filtering ─── */
function matchesTimeline(item) {
    const key = item.timelineStatus ? item.timelineStatus.key : 'unknown';
    if (state.timeline === 'all') return true;
    if (state.timeline === 'upcoming') return key === 'next' || key === 'future';
    return key === state.timeline;
}

function getFiltered() {
    const q = state.q.trim().toLowerCase();
    return allData.filter(item => {
        if (state.status === 'available' && !item.available) return false;
        if (state.status === 'booked' && item.available) return false;
        if (!matchesTimeline(item)) return false;
        if (!q) return true;
        return [item.temple, item.date, item.monk, item.topic, item.no]
            .some(v => String(v).toLowerCase().indexOf(q) > -1);
    });
}

function syncControls() {
    $$('.fchip').forEach(chip => {
        chip.classList.toggle('is-active', state[chip.dataset.filter] === chip.dataset.value);
    });
    $$('.vt-btn').forEach(b => b.classList.toggle('is-active', b.dataset.view === state.view));
    let nav = 'all';
    if (state.view === 'events') nav = 'events';
    else if (state.view === 'table') nav = 'table';
    else if (state.status === 'available') nav = 'available';
    else if (state.timeline === 'upcoming') nav = 'upcoming';
    $$('.bn-item').forEach(b => b.classList.toggle('is-active', b.dataset.nav === nav));
}

function setView(view) {
    state.view = (view === 'table' || view === 'events') ? view : 'cards';
    try { localStorage.setItem('dmceu.ss15.view', state.view === 'events' ? 'cards' : state.view); } catch (e) {}
    if (state.view === 'events' && eventsData === null) loadEvents();
    render();
}
window.setView = setView;

function listHeading(count) {
    const q = state.q.trim();
    let icon_ = 'grid', title = 'รายการทั้งหมด';
    const parts = [];
    if (state.status === 'available')      { icon_ = 'alert'; title = 'คิวที่ยังว่าง'; }
    else if (state.status === 'booked')    { icon_ = 'check'; title = 'คิวที่ลงข้อมูลแล้ว'; }
    if (state.timeline === 'upcoming')     { if (state.status === 'all') { icon_ = 'clock'; title = 'คิวที่กำลังจะถึง'; } else parts.push('กำลังจะถึง'); }
    else if (state.timeline === 'past')    { if (state.status === 'all') { icon_ = 'check'; title = 'คิวที่ผ่านไปแล้ว'; } else parts.push('ผ่านไปแล้ว'); }
    else if (state.timeline === 'unknown') { if (state.status === 'all') { icon_ = 'calendar'; title = 'คิวที่รอวันที่'; } else parts.push('รอวันที่'); }
    if (q) { icon_ = 'search'; title = `ผลการค้นหา “${q}”`; }
    if (state.view === 'table') {
        parts.unshift(title === 'รายการทั้งหมด' ? 'ทั้งซีซั่น' : title);
        icon_ = 'table'; title = 'ภาพรวมแบบตาราง';
    }
    return { icon: icon_, title: title, sub: [`${count} คิว`].concat(parts).join(' · ') };
}

function render() {
    syncControls();
    const container = $('#cards-container');
    $('#controls').hidden = state.view === 'events';
    if (state.view === 'events') { renderEvents(container); return; }
    const data = getFiltered();
    $('#result-count').textContent = allData.length
        ? `แสดง ${data.length} จาก ${allData.length} คิว`
        : '';

    const head = listHeading(data.length);
    $('#listTitle').innerHTML = icon(head.icon) + esc(head.title);
    $('#listSub').textContent = head.sub;
    $('#listHead').hidden = !allData.length;

    if (!data.length) {
        container.innerHTML = `
            <div class="state">
                ${icon(state.q ? 'search' : 'calendar')}
                <strong>${state.q ? 'ไม่พบรายการที่ค้นหา' : 'ไม่มีคิวในหมวดนี้'}</strong>
                <p>${state.q ? 'ลองเปลี่ยนคำค้นหา หรือล้างตัวกรองเพื่อดูรายการทั้งหมด'
                             : 'ลองเลือกตัวกรองอื่น หรือดูรายการทั้งหมด'}</p>
                <button type="button" onclick="resetFilters()">ดูรายการทั้งหมด</button>
            </div>`;
        return;
    }

    if (state.view === 'table') { container.innerHTML = buildTable(data); return; }

    // มุมมองการ์ด: พับคิวที่ผ่านไปแล้วไว้ (เฉพาะตอนดู "ทุกช่วง" และไม่ได้ค้นหา)
    const collapsible = state.timeline === 'all' && !state.q.trim();
    const past = collapsible ? data.filter(it => it.timelineStatus && it.timelineStatus.key === 'past') : [];
    const current = collapsible ? data.filter(it => !(it.timelineStatus && it.timelineStatus.key === 'past')) : data;

    let html = '';
    if (past.length) {
        html += `<button class="past-toggle ${state.showPast ? 'is-open' : ''}" type="button" onclick="togglePast()"
                    aria-expanded="${state.showPast ? 'true' : 'false'}">
            ${icon('check')}
            <span class="past-toggle-text"><strong>ผ่านไปแล้ว ${past.length} คิว</strong>
                <small>${state.showPast ? 'แตะเพื่อซ่อน' : 'แตะเพื่อดูย้อนหลัง'}</small></span>
            <span class="past-toggle-arrow">${icon('arrow-up')}</span>
        </button>`;
        if (state.showPast) html += `<div class="past-block">${buildCardSections(past)}</div>`;
    }
    html += buildCardSections(current);
    if (!current.length && past.length && !state.showPast) {
        html += `<div class="state small">${icon('calendar')}<strong>ไม่มีคิวที่กำลังจะมาถึง</strong><p>คิวทั้งหมดผ่านไปแล้ว แตะด้านบนเพื่อดูย้อนหลัง</p></div>`;
    }
    container.innerHTML = html;
}

function togglePast() {
    state.showPast = !state.showPast;
    render();
}
window.togglePast = togglePast;

/** จัดกลุ่มการ์ดเป็นสุดสัปดาห์ (ส.+อา.) และรายการอื่น ๆ */
function buildCardSections(data) {
    const weekends = {};
    const others = [];
    data.forEach(item => {
        const dow = item.dayOfWeek;
        if (dow !== 6 && dow !== 0) { others.push(item); return; }
        const sat = new Date(item.parsedDate);
        if (dow === 0) sat.setDate(sat.getDate() - 1);
        const key = `${sat.getFullYear()}-${String(sat.getMonth() + 1).padStart(2, '0')}-${String(sat.getDate()).padStart(2, '0')}`;
        if (!weekends[key]) weekends[key] = { satDate: sat, sat: null, sun: null };
        if (dow === 6) weekends[key].sat = item; else weekends[key].sun = item;
    });

    let html = '';
    Object.keys(weekends).sort().forEach(key => {
        const g = weekends[key];
        const items = [g.sat, g.sun].filter(Boolean);
        if (!items.length) return;
        const sun = new Date(g.satDate); sun.setDate(sun.getDate() + 1);
        const range = g.satDate.getMonth() === sun.getMonth()
            ? `${g.satDate.getDate()}–${sun.getDate()} ${thaiMonths[sun.getMonth()]} ${sun.getFullYear() + 543}`
            : `${g.satDate.getDate()} ${thaiMonths[g.satDate.getMonth()]} – ${sun.getDate()} ${thaiMonths[sun.getMonth()]} ${sun.getFullYear() + 543}`;

        html += `<section class="week-section">
            <div class="week-header">
                <span class="week-label">${esc(range)}</span>
                <span class="week-line"></span>
                <span class="week-count">${items.length} คิว</span>
            </div>
            <div class="weekend-pair">
                ${g.sat ? buildCard(g.sat, 'sat', 'วันเสาร์') : ''}
                ${g.sun ? buildCard(g.sun, 'sun', 'วันอาทิตย์') : ''}
            </div>
        </section>`;
    });

    if (others.length) {
        others.sort((a, b) => (+a.no || 0) - (+b.no || 0));
        html += `<section class="week-section">
            <div class="week-header">
                <span class="week-label">รายการอื่น ๆ</span>
                <span class="week-line"></span>
                <span class="week-count">${others.length} คิว</span>
            </div>
            <div class="card-grid">
                ${others.map(it => buildCard(it, 'other', it.dayOfWeek !== null ? thaiDays[it.dayOfWeek] : '')).join('')}
            </div>
        </section>`;
    }
    return html;
}



/* ─── หน้ากิจกรรม ─── */
let eventsData = null;          // รายการที่ใช้แสดงจริง (null = ยังไม่ได้โหลด)
let eventsDb = null;            // จากหลังบ้าน (Supabase)
let eventsSheet = null;         // จากชีตแท็บ "กิจกรรม"

/** เลือกแหล่งที่ใช้แสดง: หลังบ้านก่อน ถ้าว่างค่อยใช้ชีต */
function applyEvents() {
    const next = (eventsDb && eventsDb.length) ? eventsDb : eventsSheet;
    const changed = JSON.stringify(next) !== JSON.stringify(eventsData);
    eventsData = next;
    if (changed && state.view === 'events') render();
}

function loadEvents() { loadEventsDb(); loadEventsSheet(); }

async function loadEventsDb() {
    if (!STATS_CONFIG.url) { if (eventsDb === null) { eventsDb = []; applyEvents(); } return; }
    try {
        const res = await fetch(`${STATS_CONFIG.url}/rest/v1/events?select=title,description,link,image_path` +
                                `&visible=eq.true&order=sort.asc,created_at.desc&limit=50`,
                                { headers: { apikey: STATS_CONFIG.key }, cache: 'no-store' });
        if (!res.ok) throw new Error('events ' + res.status);
        const rows = await res.json();
        eventsDb = rows.map(r => ({
            title: r.title || '',
            image: `${STATS_CONFIG.url}/storage/v1/object/public/events/${r.image_path}`,
            desc: r.description || '',
            link: r.link || ''
        }));
    } catch (e) {
        if (eventsDb === null) eventsDb = [];
    }
    applyEvents();
}

/** ลิงก์แชร์ Google Drive → ลิงก์รูปที่แสดงในหน้าเว็บได้ */
function imageUrl(raw) {
    const u = String(raw || '').trim();
    if (!u) return '';
    const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
    if (m) return `https://lh3.googleusercontent.com/d/${m[1]}`;
    return u;
}

function loadEventsSheet() {
    const src = currentSource();
    if (!src.id) return;
    const el = document.createElement('script');
    el.src = 'https://docs.google.com/spreadsheets/d/' + src.id +
             '/gviz/tq?tqx=out:json;responseHandler:processEventsData' +
             '&sheet=' + encodeURIComponent(EVENTS_SHEET_TAB) + '&headers=0' +
             '&tq=' + encodeURIComponent('select A,B,C,D limit 50') + '&_=' + Date.now();
    el.async = true;
    el.onerror = () => { el.remove(); if (eventsSheet === null) { eventsSheet = []; applyEvents(); } };
    el.addEventListener('load', () => el.remove());
    document.head.appendChild(el);
}

function processEventsData(response) {
    const list = [];
    if (response && response.status !== 'error' && response.table) {
        const cell = (row, i) => (row.c[i] && row.c[i].v !== null && row.c[i].v !== undefined) ? String(row.c[i].f || row.c[i].v).trim() : '';
        (response.table.rows || []).forEach(row => {
            if (!row || !row.c) return;
            const title = cell(row, 0), image = imageUrl(cell(row, 1)), desc = cell(row, 2), link = cell(row, 3);
            if (!/^https?:\/\//i.test(image) && !/^assets\//.test(image)) return;   // ไม่ใช่รูป (เช่นแท็บ "กิจกรรม" ยังไม่มี → Google ส่งแท็บแรกมาแทน)
            if (/^(หัวข้อ|ชื่อ|title)$/i.test(title)) return;                          // ข้ามแถวหัวตาราง
            list.push({ title, image, desc, link });
        });
    }
    eventsSheet = list;
    applyEvents();
}
window.processEventsData = processEventsData;

function renderEvents(container) {
    $('#result-count').textContent = '';
    const items = (eventsData && eventsData.length) ? eventsData : EVENTS_DEFAULT;
    $('#listTitle').innerHTML = icon('event') + 'ตารางกิจกรรม';
    $('#listSub').textContent = items.length ? `${items.length} รายการ · แตะรูปเพื่อขยาย` : '';
    $('#listHead').hidden = false;

    if (eventsData === null && !EVENTS_DEFAULT.length) {
        container.innerHTML = `<div class="state">${icon('refresh')}<strong>กำลังโหลดกิจกรรม…</strong></div>`;
        return;
    }
    if (!items.length) {
        container.innerHTML = `<div class="state">${icon('event')}
            <strong>ยังไม่มีตารางกิจกรรม</strong>
            <p>ทีมงานเพิ่มรูปได้ที่หน้าหลังบ้าน (admin.html) หรือชีตแท็บ “${esc(EVENTS_SHEET_TAB)}”</p></div>`;
        return;
    }
    prefetchEventFiles();
    container.innerHTML = `<div class="events-grid">${items.map((ev, i) => `
        <article class="event-card">
            <a class="event-img" href="${esc(ev.image)}" data-idx="${i}" onclick="return openImage(${i})">
                <img src="${esc(ev.image)}" alt="${esc(ev.title || 'ตารางกิจกรรม')}" loading="lazy"
                     onerror="this.closest('.event-card').classList.add('broken'); this.replaceWith(Object.assign(document.createElement('span'),{textContent:'โหลดรูปไม่ได้ · ตรวจสิทธิ์แชร์ของไฟล์'}))">
                <span class="event-zoom">${icon('expand')} ขยาย</span>
            </a>
            <div class="event-body">
                ${ev.title ? `<h3 class="event-title">${esc(ev.title)}</h3>` : ''}
                ${ev.desc ? `<p class="event-desc">${esc(ev.desc)}</p>` : ''}
                <div class="event-actions">
                    <button class="event-dl" type="button" onclick="downloadImage(${i}, this)">${icon('download')} ดาวน์โหลดรูป</button>
                    ${ev.link ? `<a class="event-link" href="${esc(ev.link)}" target="_blank" rel="noopener">${icon('link')} เปิดลิงก์เพิ่มเติม</a>` : ''}
                </div>
            </div>
        </article>`).join('')}</div>`;
}

/** ดาวน์โหลด/บันทึกรูป — มือถือใช้แผ่นแชร์ (มี "บันทึกรูปภาพ"), คอมดาวน์โหลดเป็นไฟล์ */
const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
function fileNameFor(ev) {
    const base = (ev.title || 'ตารางกิจกรรม').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60);
    const ext = (ev.image.match(/\.(png|jpe?g|webp|gif)(\?|$)/i) || [, 'jpg'])[1].toLowerCase();
    return `${base}.${ext === 'jpeg' ? 'jpg' : ext}`;
}
/* แคชไฟล์รูปไว้ล่วงหน้า — iOS อนุญาตให้เปิดแผ่นแชร์เฉพาะ "ตอนแตะ" ทันที
   ถ้ารอโหลดรูปก่อน (await) แล้วค่อยเรียกแชร์ ระบบจะเงียบไม่เปิดอะไรเลย */
const eventFiles = new Map();        // image url → File (พร้อมใช้)
const eventFileLoads = new Map();    // image url → Promise<File>
function loadEventFile(ev) {
    if (eventFiles.has(ev.image)) return Promise.resolve(eventFiles.get(ev.image));
    if (eventFileLoads.has(ev.image)) return eventFileLoads.get(ev.image);
    const p = fetch(ev.image, { mode: 'cors' })
        .then(res => { if (!res.ok) throw new Error('fetch ' + res.status); return res.blob(); })
        .then(blob => {
            const file = new File([blob], fileNameFor(ev), { type: blob.type || 'image/jpeg' });
            eventFiles.set(ev.image, file);
            return file;
        })
        .catch(e => { eventFileLoads.delete(ev.image); throw e; });
    eventFileLoads.set(ev.image, p);
    return p;
}
function prefetchEventFiles() {
    if (!isTouch || !navigator.canShare) return;
    const items = (eventsData && eventsData.length) ? eventsData : EVENTS_DEFAULT;
    items.slice(0, 6).forEach(ev => loadEventFile(ev).catch(() => {}));
}
const canShareFile = file => !!(navigator.canShare && file && navigator.canShare({ files: [file] }));

/** เปิดแผ่นแชร์พร้อมไฟล์รูป — ต้องเรียกภายในเหตุการณ์แตะ (ห้ามมี await ก่อนหน้า) */
async function shareFile(file, title) {
    try { await navigator.share({ files: [file], title }); return true; }
    catch (e) {
        if (e && e.name === 'AbortError') return true;        // ผู้ใช้ปิดแผ่นแชร์เอง
        return false;                                          // NotAllowedError ฯลฯ
    }
}

async function downloadImage(i, btn) {
    const items = (eventsData && eventsData.length) ? eventsData : EVENTS_DEFAULT;
    const ev = items[i];
    if (!ev) return;
    const title = ev.title || 'ตารางกิจกรรม';

    // มือถือ + รูปพร้อมแล้ว → เปิดแผ่นแชร์ทันที (มี "บันทึกรูปภาพ")
    const ready = eventFiles.get(ev.image);
    if (isTouch && canShareFile(ready)) { await shareFile(ready, title); return; }

    if (btn) btn.classList.add('busy');
    try {
        const file = await loadEventFile(ev);
        if (isTouch && canShareFile(file)) {
            if (!(await shareFile(file, title))) toast('รูปพร้อมแล้ว · แตะปุ่มอีกครั้ง');
        } else {
            const url = URL.createObjectURL(file);
            const a = document.createElement('a');
            a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 4000);
            toast('กำลังดาวน์โหลดรูป…');
        }
    } catch (e) {
        // ดึงไฟล์ข้ามเว็บไม่ได้ (เช่นรูปจาก Drive) → เปิดรูปในแท็บใหม่ให้บันทึกเอง
        window.open(ev.image, '_blank', 'noopener');
        toast('เปิดรูปแล้ว · กดค้างที่รูปเพื่อบันทึก');
    } finally {
        if (btn) btn.classList.remove('busy');
    }
}
window.downloadImage = downloadImage;


const imgModal = $('#imgModal');
let imgModalIndex = 0;
$('#imgDownload').addEventListener('click', () => downloadImage(imgModalIndex, $('#imgDownload')));
function openImage(i) {
    imgModalIndex = i;
    const items = (eventsData && eventsData.length) ? eventsData : EVENTS_DEFAULT;
    const ev = items[i];
    if (!ev) return true;
    $('#imgFull').src = ev.image;
    $('#imgFull').alt = ev.title || 'ตารางกิจกรรม';
    $('#imgTitle').textContent = ev.title || 'ตารางกิจกรรม';
    $('#imgOpen').href = ev.image;
    if (typeof imgModal.showModal === 'function') { imgModal.showModal(); $('#imgBody').scrollTop = 0; return false; }
    return true;   // เบราว์เซอร์เก่า: เปิดรูปในแท็บใหม่แทน
}
window.openImage = openImage;
$('#imgClose').addEventListener('click', () => imgModal.close());
imgModal.addEventListener('click', e => { if (e.target === imgModal || e.target === $('#imgBody')) imgModal.close(); });
imgModal.addEventListener('close', () => { $('#imgFull').src = ''; });

/* ─── มุมมองตาราง (ภาพรวมเหมือนชีต) ─── */
const thaiDaysShort = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const thaiMonthsFull = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                        'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

function buildTable(data) {
    const rows = data.slice().sort((a, b) => {
        const ta = a.parsedDate ? a.parsedDate.getTime() : Infinity;
        const tb = b.parsedDate ? b.parsedDate.getTime() : Infinity;
        return ta !== tb ? ta - tb : (+a.no || 0) - (+b.no || 0);
    });

    let html = `<div class="table-wrap"><table class="sheet">
        <thead><tr>
            <th class="c-no">#</th>
            <th class="c-date">วันที่</th>
            <th class="c-temple">วัดที่นำสวดมนต์</th>
            <th class="c-round">ครั้งที่</th>
            <th class="c-monk">พระอาจารย์เทศน์สอน</th>
            <th class="c-topic">หัวข้อเทศน์สอน</th>
        </tr></thead><tbody>`;

    let lastMonth = null;
    rows.forEach(item => {
        const d = item.parsedDate;
        const monthKey = d ? `${d.getFullYear()}-${d.getMonth()}` : 'none';
        if (monthKey !== lastMonth) {
            const label = d ? `${thaiMonthsFull[d.getMonth()]} ${d.getFullYear() + 543}` : 'ยังไม่ระบุวันที่';
            html += `<tr class="month-row"><td colspan="6">${esc(label)}</td></tr>`;
            lastMonth = monthKey;
        }
        const t = item.timelineStatus || getTimelineStatus(d, false);
        const dateShort = d ? `${thaiDaysShort[d.getDay()]} ${d.getDate()} ${thaiMonths[d.getMonth()]}` : (item.date !== '-' ? item.date : '–');
        const dow = d ? d.getDay() : null;
        const cls = ['row', 't-' + t.key, dow === 6 ? 'd-sat' : (dow === 0 ? 'd-sun' : ''), item.available ? 'is-open' : ''].join(' ');
        html += `<tr class="${cls}">
            <td class="c-no"><span class="no-pill">${esc(item.no)}</span></td>
            <td class="c-date" title="${esc(item.date)}"><span class="date-main">${esc(dateShort)}</span><span class="date-note">${esc(t.key === 'next' ? t.label : t.note)}</span></td>
            <td class="c-temple"><span class="status-dot ${item.available ? 'empty' : 'filled'}"></span>${esc(item.temple)}</td>
            <td class="c-round"><span class="cell-label">ครั้งที่</span>${esc(item.time)}</td>
            <td class="c-monk">${icon('user')}${item.monk === '-' ? '<span class="pending">รอลงชื่อพระอาจารย์</span>' : esc(item.monk)}</td>
            <td class="c-topic">${icon('book')}${item.topic === '-' ? '<span class="pending">รอหัวข้อเทศน์</span>' : esc(item.topic)}</td>
        </tr>`;
    });

    return html + '</tbody></table></div>';
}

function buildCard(item, dayClass, dayLabel) {
    const t = item.timelineStatus || getTimelineStatus(item.parsedDate, false);
    const monk = item.monk === '-'
        ? '<span class="info-text pending">รอลงชื่อพระอาจารย์</span>'
        : `<span class="info-text">${esc(item.monk)}</span>`;
    const topic = item.topic === '-'
        ? '<span class="info-text pending">รอหัวข้อเทศน์</span>'
        : `<span class="info-text">${esc(item.topic)}</span>`;

    return `<article class="temple-card ${dayClass} timeline-${t.key}">
        <div class="accent-stripe"></div>
        <div class="card-top">
            <span class="card-no-badge">${esc(item.no)}</span>
            ${dayLabel ? `<span class="day-badge">${esc(dayLabel)}</span>` : ''}
            <span class="timeline-badge ${t.key}" title="${esc(t.note)}"><i></i>${esc(t.label)}</span>
        </div>
        <div class="card-body">
            <h3 class="temple-name">
                <span class="status-dot ${item.available ? 'empty' : 'filled'}" title="${item.available ? 'ยังว่าง' : 'ลงข้อมูลแล้ว'}"></span>
                ${esc(item.temple)}
            </h3>
            <div class="info-row">${icon('calendar')}
                <span class="info-text"><strong>${esc(item.date !== '-' ? item.date : 'ยังไม่ระบุวันที่')}</strong>${t.note ? ` · ${esc(t.note)}` : ''}</span>
            </div>
            <div class="info-row">${icon('user')}${monk}</div>
            <div class="info-row">${icon('book')}${topic}</div>
        </div>
        <div class="card-footer">
            <span class="round-label">ครั้งที่</span>
            <span class="round-num">${esc(item.time)}</span>
        </div>
    </article>`;
}

function resetFilters() {
    state.q = ''; state.status = 'all'; state.timeline = 'all';
    $('#searchInput').value = '';
    $('#searchClear').hidden = true;
    render();
}
window.resetFilters = resetFilters;


/* ─── สถานะถ่ายทอดสด ───────────────────────────────────────
   หน้าเว็บนิ่งอ่านสถานะห้อง Zoom โดยตรงไม่ได้ (ต้องมี Zoom API + เซิร์ฟเวอร์)
   จึงคำนวณจาก "วันที่มีคิวในตาราง" + ช่วงเวลาใน LIVE_CONFIG แทน       */

function toMinutes(hhmm) {
    const m = String(hhmm).match(/^(\d{1,2}):(\d{2})$/);
    return m ? (+m[1]) * 60 + (+m[2]) : 0;
}

/** เวลาปัจจุบันในโซนเวลาอ้างอิง → { y, m, d, dow, minutes } */
function nowInZone(tz) {
    let parts;
    if (!tz || tz === 'local') {
        const n = new Date();
        return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate(), dow: n.getDay(),
                 minutes: n.getHours() * 60 + n.getMinutes() };
    }
    try {
        parts = new Intl.DateTimeFormat('en-US', {
            timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false
        }).formatToParts(new Date());
    } catch (e) {
        const n = new Date();
        return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate(), dow: n.getDay(),
                 minutes: n.getHours() * 60 + n.getMinutes() };
    }
    const get = t => (parts.find(p => p.type === t) || {}).value;
    const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const hour = parseInt(get('hour'), 10) % 24;
    return {
        y: +get('year'), m: +get('month'), d: +get('day'),
        dow: dowMap[get('weekday')],
        minutes: hour * 60 + parseInt(get('minute'), 10)
    };
}

function sameCalendarDay(date, z) {
    return !!date && date.getFullYear() === z.y && (date.getMonth() + 1) === z.m && date.getDate() === z.d;
}

function getLiveState() {
    const z = nowInZone(LIVE_CONFIG.timeZone);
    const startMin = toMinutes(LIVE_CONFIG.start);
    const endMin = toMinutes(LIVE_CONFIG.end);

    const todaySession = allData.find(it => sameCalendarDay(it.parsedDate, z)) || null;
    const forcedDay = Array.isArray(LIVE_CONFIG.days) && LIVE_CONFIG.days.indexOf(z.dow) > -1;
    const hasToday = !!todaySession || forcedDay;

    // คิวถัดไปที่ยังมาไม่ถึง (ใช้บอกว่าครั้งหน้าเมื่อไหร่)
    let upcoming = null;
    allData.forEach(it => {
        if (!it.parsedDate || daysUntil(it.parsedDate) < 0) return;
        if (sameCalendarDay(it.parsedDate, z) && z.minutes >= endMin) return; // ของวันนี้จบไปแล้ว
        if (!upcoming || it.parsedDate < upcoming.parsedDate) upcoming = it;
    });

    const timeRange = `${LIVE_CONFIG.start}–${LIVE_CONFIG.end} น.`;

    if (hasToday && z.minutes >= startMin && z.minutes < endMin) {
        return { key: 'live', session: todaySession,
                 title: 'กำลังถ่ายทอดสด', sub: todaySession ? todaySession.temple : `ถึง ${LIVE_CONFIG.end} น.`,
                 cta: 'เข้าร่วม' };
    }
    if (hasToday && z.minutes >= startMin - LIVE_CONFIG.preMinutes && z.minutes < startMin) {
        return { key: 'soon', session: todaySession,
                 title: `ถ่ายทอด ${LIVE_CONFIG.start} น.`,
                 sub: todaySession ? todaySession.temple : timeRange, cta: 'เข้าห้อง' };
    }
    if (hasToday && z.minutes < startMin) {
        return { key: 'today', session: todaySession,
                 title: 'วันนี้มีสวดมนต์', sub: `ถ่ายทอด ${timeRange}`, cta: 'เข้าห้อง' };
    }
    if (upcoming && upcoming.parsedDate) {
        const days = daysUntil(upcoming.parsedDate);
        const when = days === 0 ? 'วันนี้' : (days === 1 ? 'พรุ่งนี้' : `${thaiDays[upcoming.parsedDate.getDay()]}ที่ ${thaiDate(upcoming.parsedDate)}`);
        return { key: 'off', session: upcoming,
                 title: 'ดู Live ผ่าน Zoom', sub: `ถ่ายทอดครั้งถัดไป ${when} · ${LIVE_CONFIG.start} น.`,
                 cta: 'เข้าห้อง' };
    }
    return { key: 'off', session: null,
             title: 'ดู Live ผ่าน Zoom', sub: 'ยังไม่มีกำหนดถ่ายทอดครั้งถัดไป', cta: 'เข้าห้อง' };
}

let liveKey = null;
function renderLive() {
    const st = getLiveState();
    const bar = $('#liveBar');

    bar.href = LIVE_CONFIG.zoomUrl;
    bar.className = 'live-bar is-' + (st.key === 'today' ? 'off' : st.key);
    $('#liveCta').textContent = st.cta;
    $('#liveSub').textContent = st.sub;
    $('#liveTitle').innerHTML = (st.key === 'live'
            ? '<span class="live-pill"><i></i> LIVE</span>'
            : (st.key === 'soon' ? '<span class="live-pill"><i></i> ใกล้เริ่ม</span>' : ''))
        + esc(st.title);

    if (liveKey === 'off' && st.key === 'live') toast('เริ่มถ่ายทอดสดแล้ว · แตะแถบด้านล่างเพื่อเข้าร่วม');
    liveKey = st.key;
    measureDock();
}

/* ความสูงของ dock → กันไม่ให้ทับปุ่มเลื่อนขึ้น / toast / ท้ายหน้า */
function measureDock() {
    const h = $('#dock').getBoundingClientRect().height;
    document.documentElement.style.setProperty('--dock-h', Math.round(h) + 'px');
}
if ('ResizeObserver' in window) new ResizeObserver(measureDock).observe($('#dock'));
window.addEventListener('resize', measureDock);

renderLive();
setInterval(() => { if (allData.length) refreshTimeline(); renderLive(); }, 30000);

/* ─── Control wiring ─── */
let searchTimer = null;
$('#searchInput').addEventListener('input', e => {
    state.q = e.target.value;
    $('#searchClear').hidden = !state.q;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(render, 140);
});
$('#searchClear').addEventListener('click', () => {
    state.q = '';
    $('#searchInput').value = '';
    $('#searchClear').hidden = true;
    $('#searchInput').focus();
    render();
});
$('#searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });

$$('.fchip').forEach(chip => {
    chip.addEventListener('click', () => {
        state[chip.dataset.filter] = chip.dataset.value;
        render();
        scrollToList();
    });
});

$$('.vt-btn').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));

$$('.bn-item').forEach(btn => {
    btn.addEventListener('click', () => {
        const nav = btn.dataset.nav;
        if (nav === 'events') {
            setView('events');
            if (eventsData === null) loadEvents();
            scrollToList(true);
            return;
        }
        if (nav === 'table') { setView('table'); scrollToList(true); return; }
        state.view = 'cards';
        try { localStorage.setItem('dmceu.ss15.view', 'cards'); } catch (e) {}
        if (nav === 'all')            { state.status = 'all'; state.timeline = 'all'; }
        else if (nav === 'upcoming')  { state.status = 'all'; state.timeline = 'upcoming'; }
        else if (nav === 'available') { state.status = 'available'; state.timeline = 'all'; }
        render();
        scrollToList(true);
    });
});

function scrollToList(force) {
    const controls = $('#controls').hidden ? $('#listHead') : $('#controls');   // หน้ากิจกรรมไม่มีตัวกรอง
    const y = controls.getBoundingClientRect().top + window.scrollY - stickyOffset() - ($('#controls').hidden ? 12 : -2);
    // กดแท็บ → กระโดดไปทันที: การเลื่อนแบบอนิเมชันทำให้แถบ sticky บน iOS สั่นระหว่างเลื่อน
    if (force) { window.scrollTo({ top: y, behavior: 'instant' }); return; }
    if (window.scrollY > y) window.scrollTo({ top: y, behavior: 'smooth' });
}
function stickyOffset() {
    return $('#appbar').getBoundingClientRect().height;
}
function measureSticky() {
    const h = stickyOffset() + $('#controls').getBoundingClientRect().height;
    document.documentElement.style.setProperty('--sticky-top', Math.round(h) + 'px');
}
if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(measureSticky);
    ro.observe($('#controls')); ro.observe($('#appbar'));
}
window.addEventListener('resize', measureSticky);
measureSticky();

function manualRefresh() {
    if (loading) return;
    loadData(true);
    toast('กำลังอัปเดตข้อมูล…');
}
$('#refreshBtn').addEventListener('click', manualRefresh);
$('#sync-note').addEventListener('click', manualRefresh);



/* ─── โหมดแอดมิน ───────────────────────────────────────────
   หมายเหตุ: นี่คือการ "ซ่อนจากผู้ใช้ทั่วไป" ไม่ใช่ระบบความปลอดภัยจริง
   เพราะเป็นเว็บนิ่ง คนที่เปิดซอร์สดูยังเห็นโครงสร้างได้
   แต่การเปลี่ยนแหล่งข้อมูลมีผลเฉพาะเครื่องของคนนั้น ไม่กระทบผู้ชมคนอื่น */

function isAdmin() {
    try {
        const until = parseInt(localStorage.getItem(ADMIN_KEY) || '0', 10);
        return until > Date.now();
    } catch (e) { return false; }
}

function syncAdminUI() {
    $('#adminTools').hidden = !isAdmin();
}

async function sha256Hex(text) {
    if (!window.crypto || !crypto.subtle) return null;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.prototype.map.call(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

const adminModal = $('#adminModal');

function openAdminModal() {
    if (isAdmin()) { openSourceModal(); return; }
    $('#adminInput').value = '';
    $('#adminError').hidden = true;
    if (typeof adminModal.showModal === 'function') adminModal.showModal();
    else adminModal.setAttribute('open', '');
    setTimeout(() => $('#adminInput').focus(), 200);
}

function closeAdminModal() {
    if (typeof adminModal.close === 'function') adminModal.close();
    else adminModal.removeAttribute('open');
}

function adminFail(msg) {
    const el = $('#adminError');
    el.innerHTML = icon('alert') + ' ' + esc(msg);
    el.hidden = false;
}

async function submitAdmin() {
    const code = $('#adminInput').value.trim();
    if (!code) { adminFail('กรุณาใส่รหัสผ่าน'); return; }
    const hash = await sha256Hex(code);
    if (!hash) { adminFail('ต้องเปิดเว็บผ่าน https จึงจะตรวจรหัสได้'); return; }
    if (hash !== ADMIN_CONFIG.passcodeHash) { adminFail('รหัสผ่านไม่ถูกต้อง'); return; }

    try {
        localStorage.setItem(ADMIN_KEY, String(Date.now() + ADMIN_CONFIG.rememberDays * 864e5));
    } catch (e) {}
    closeAdminModal();
    syncAdminUI();
    toast('เข้าสู่โหมดแอดมินแล้ว');
    setTimeout(openSourceModal, 350);
}

$('#adminSubmit').addEventListener('click', submitAdmin);
$('#adminClose').addEventListener('click', closeAdminModal);
$('#adminInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); submitAdmin(); }
});
adminModal.addEventListener('click', e => { if (e.target === adminModal) closeAdminModal(); });

$('#adminLogout').addEventListener('click', () => {
    try { localStorage.removeItem(ADMIN_KEY); } catch (e) {}
    syncAdminUI();
    toast('ออกจากโหมดแอดมินแล้ว');
});

/* ทางเข้า 1: แตะโลโก้ท้ายหน้า 5 ครั้งติดกัน */
let knocks = 0, knockTimer = null;
$('#adminKnock').addEventListener('click', () => {
    if (isAdmin()) return;
    knocks++;
    clearTimeout(knockTimer);
    knockTimer = setTimeout(() => { knocks = 0; }, 2500);
    if (knocks >= 5) { knocks = 0; openAdminModal(); }
});

/* ทางเข้า 2: ต่อท้าย URL ด้วย #admin · ต่อท้าย #events / #table เปิดมาที่หน้านั้นเลย */
function checkAdminHash() {
    const h = location.hash.toLowerCase();
    if (h === '#events' || h === '#table') {
        history.replaceState(null, '', location.pathname + location.search);
        setView(h.slice(1));
        syncControls();
        scrollToList(true);
        return;
    }
    if (h !== '#admin') return;
    history.replaceState(null, '', location.pathname + location.search);
    openAdminModal();
}
window.addEventListener('hashchange', checkAdminHash);

syncAdminUI();
checkAdminHash();


/* ─── แอดมิน: ตั้งค่า Live / Zoom ─── */
const liveModal = $('#liveModal');
const dayPresets = { 'auto': null, 'sat,sun': [6, 0], 'sun': [0], 'sat': [6], '0,1,2,3,4,5,6': [0,1,2,3,4,5,6] };

function daysToPreset(days) {
    if (!days || !days.length) return 'auto';
    const key = Object.keys(dayPresets).find(k => {
        const v = dayPresets[k];
        return v && v.length === days.length && v.every(d => days.indexOf(d) > -1);
    });
    return key || 'auto';
}

function describeLive() {
    const srcLabel = Object.keys(liveFromLocal).length ? 'เครื่องนี้ (ทดลอง)'
        : (Object.keys(liveFromSheet).length ? 'แท็บ config ในชีต' : 'ค่าตั้งต้นในโค้ด');
    const tz = LIVE_CONFIG.timeZone === 'local' ? 'เวลาท้องถิ่นผู้ชม' : LIVE_CONFIG.timeZone;
    $('#lsCurrent').textContent = `ใช้อยู่: ${LIVE_CONFIG.start}–${LIVE_CONFIG.end} (${tz}) · ที่มาของค่า: ${srcLabel}`;
}

function openLiveModal() {
    if (!isAdmin()) { openAdminModal(); return; }
    $('#lsZoom').value = LIVE_CONFIG.zoomUrl || '';
    $('#lsStart').value = LIVE_CONFIG.start || '';
    $('#lsEnd').value = LIVE_CONFIG.end || '';
    $('#lsTz').value = LIVE_CONFIG.timeZone || 'Europe/Berlin';
    $('#lsPre').value = LIVE_CONFIG.preMinutes;
    $('#lsDays').value = daysToPreset(LIVE_CONFIG.days);
    $('#lsError').hidden = true;
    describeLive();
    if (typeof liveModal.showModal === 'function') liveModal.showModal();
    else liveModal.setAttribute('open', '');
}

function closeLiveModal() {
    if (typeof liveModal.close === 'function') liveModal.close();
    else liveModal.removeAttribute('open');
}

/** อ่านค่าจากฟอร์ม → { values } หรือ { error } */
function readLiveForm() {
    const raw = {
        zoomUrl: $('#lsZoom').value,
        start: $('#lsStart').value,
        end: $('#lsEnd').value,
        timeZone: $('#lsTz').value,
        preMinutes: $('#lsPre').value,
        days: $('#lsDays').value
    };
    const values = normalizeLiveValues(raw);
    if (!values.zoomUrl) return { error: 'ลิงก์ Zoom ไม่ถูกต้อง (ต้องขึ้นต้นด้วย https://)' };
    if (!values.start || !values.end) return { error: 'กรุณาใส่เวลาเริ่มและเวลาเลิกให้ครบ' };
    if (toMinutes(values.end) <= toMinutes(values.start)) return { error: 'เวลาเลิกต้องมากกว่าเวลาเริ่ม' };
    if (raw.days === 'auto') values.days = null;
    return { values: values };
}

function liveFormError(msg) {
    const el = $('#lsError');
    if (!msg) { el.hidden = true; return; }
    el.innerHTML = icon('alert') + ' ' + esc(msg);
    el.hidden = false;
}

$('#liveBtn').addEventListener('click', openLiveModal);
$('#liveClose').addEventListener('click', closeLiveModal);
liveModal.addEventListener('click', e => { if (e.target === liveModal) closeLiveModal(); });

$('#lsSave').addEventListener('click', () => {
    if (!isAdmin()) return;
    const res = readLiveForm();
    if (res.error) { liveFormError(res.error); return; }
    liveFromLocal = res.values;
    try { localStorage.setItem(LIVE_KEY, JSON.stringify(res.values)); } catch (e) {}
    recomputeLive();
    describeLive();
    liveFormError(null);
    closeLiveModal();
    toast('บันทึกค่า Live ลงเครื่องนี้แล้ว');
});

$('#lsReset').addEventListener('click', () => {
    if (!isAdmin()) return;
    liveFromLocal = {};
    try { localStorage.removeItem(LIVE_KEY); } catch (e) {}
    recomputeLive();
    openLiveModal();
    toast('ล้างค่าในเครื่องนี้แล้ว · กลับไปใช้ค่าจากชีต');
});

/** คัดลอกเป็นตาราง 2 คอลัมน์ พร้อมวางลงแท็บ config ที่ช่อง A1 */
$('#lsCopy').addEventListener('click', async () => {
    if (!isAdmin()) return;
    const res = readLiveForm();
    if (res.error) { liveFormError(res.error); return; }
    liveFormError(null);
    const v = res.values;
    const rows = [
        ['zoom_url', v.zoomUrl],
        ['live_start', v.start],
        ['live_end', v.end],
        ['live_timezone', v.timeZone],
        ['live_pre_min', String(v.preMinutes !== undefined ? v.preMinutes : LIVE_DEFAULTS.preMinutes)],
        ['live_days', v.days && v.days.length ? v.days.join(',') : 'auto']
    ];
    const tsv = rows.map(r => r.join('\t')).join('\n');
    try {
        await navigator.clipboard.writeText(tsv);
        toast('คัดลอกแล้ว · วางที่ช่อง A1 ของแท็บ config');
    } catch (e) {
        $('#lsZoom').blur();
        window.prompt('คัดลอกข้อความนี้ไปวางที่ช่อง A1 ของแท็บ config', tsv);
    }
});

/* ─── ตั้งค่าแหล่งข้อมูล (วางลิงก์ Google Sheets ได้จากในแอป) ─── */
const sourceModal = $('#sourceModal');

function describeSource() {
    const src = currentSource();
    let saved = null;
    try { saved = localStorage.getItem(SOURCE_KEY); } catch (e) {}
    $('#sourceCurrent').textContent = 'กำลังใช้: ' + (src.id || '—')
        + (src.gid ? ' · แท็บ gid=' + src.gid : '')
        + (saved ? ' (ตั้งค่าเอง)' : ' (ค่าเริ่มต้น)');
}

function showSourceError(key) {
    const el = $('#sourceError');
    const messages = {
        empty:     'กรุณาวางลิงก์ Google Sheets',
        invalid:   'ลิงก์ไม่ถูกต้อง — ต้องเป็นลิงก์ที่มี /spreadsheets/d/… หรือใส่ไอดีชีตก็ได้',
        published: 'ลิงก์นี้เป็นแบบ “เผยแพร่ไปยังเว็บ” (/d/e/…) ซึ่งใช้ไม่ได้ — ให้กด แชร์ ในชีตแล้วคัดลอกลิงก์ปกติมาแทน'
    };
    if (!key) { el.hidden = true; return; }
    el.innerHTML = icon('alert') + ' ' + esc(messages[key] || messages.invalid);
    el.hidden = false;
}

function openSourceModal() {
    if (!isAdmin()) { openAdminModal(); return; }
    let saved = '';
    try { saved = localStorage.getItem(SOURCE_KEY) || ''; } catch (e) {}
    $('#sourceInput').value = saved;
    showSourceError(null);
    describeSource();
    if (typeof sourceModal.showModal === 'function') sourceModal.showModal();
    else sourceModal.setAttribute('open', '');
}

function closeSourceModal() {
    if (typeof sourceModal.close === 'function') sourceModal.close();
    else sourceModal.removeAttribute('open');
}

function applySource(value) {
    if (!isAdmin()) return;
    const parsed = parseSheetSource(value);
    if (parsed.error) { showSourceError(parsed.error); return; }
    try { localStorage.setItem(SOURCE_KEY, value.trim()); } catch (e) {}
    closeSourceModal();
    switchSource('เปลี่ยนแหล่งข้อมูลแล้ว · กำลังโหลด…');
}

function switchSource(message) {
    allData = [];
    lastSync = null;
    lastRowsSig = null;
    $('#next-queue-banner').classList.remove('visible');
    $('#cards-container').innerHTML =
        '<div class="state">' + icon('refresh') + '<strong>กำลังโหลดข้อมูล…</strong></div>';
    toast(message);
    if (!loadCache()) renderStats(0, 0);
    eventsData = eventsSheet = null;
    loadData(true);
    loadConfigSheet();
    loadEvents();
}

$('#sourceBtn').addEventListener('click', openSourceModal);
$('#sourceClose').addEventListener('click', closeSourceModal);
$('#sourceSave').addEventListener('click', () => applySource($('#sourceInput').value));
$('#sourceInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); applySource(e.target.value); }
});
$('#sourceInput').addEventListener('input', () => showSourceError(null));
$('#sourceReset').addEventListener('click', () => {
    try { localStorage.removeItem(SOURCE_KEY); } catch (e) {}
    closeSourceModal();
    switchSource('กลับไปใช้ชีตเริ่มต้นแล้ว');
});
sourceModal.addEventListener('click', e => { if (e.target === sourceModal) closeSourceModal(); });

/* ─── Scroll behaviours ─── */
const appbar = $('#appbar'), controlsEl = $('#controls'), scrollBtn = $('#scrollBtn');
let ticking = false;
window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
        const y = window.scrollY;
        appbar.classList.toggle('scrolled', y > 8);
        scrollBtn.classList.toggle('visible', y > 420);
        controlsEl.classList.toggle('stuck', controlsEl.getBoundingClientRect().top <= stickyOffset() + 1);
        ticking = false;
    });
}, { passive: true });

scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* ─── PWA: service worker + อัปเดตแอปอัตโนมัติ ───
   · ตรวจหาเวอร์ชันใหม่ตอนเปิด, ทุก 30 นาที และทุกครั้งที่กลับเข้าแอป
   · พอเวอร์ชันใหม่ติดตั้งเสร็จ → รีโหลดหน้าให้เอง (รอถ้ากำลังพิมพ์/เปิดหน้าต่างตั้งค่าอยู่)
   · หลังรีโหลดขึ้น toast บอกว่าอัปเดตแล้ว */
const UPDATED_FLAG = 'dmceu.ss15.justUpdated';
let swReg = null;
let updatePending = false;

function userIsBusy() {
    const a = document.activeElement;
    const typing = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT');
    const modalOpen = $$('dialog[open]').length > 0;
    return typing || modalOpen;
}

function applyUpdateNow() {
    if (!updatePending) return;
    if (userIsBusy()) { setTimeout(applyUpdateNow, 15000); return; }   // รอจนว่างค่อยรีโหลด
    updatePending = false;
    try { sessionStorage.setItem(UPDATED_FLAG, '1'); } catch (e) {}
    location.reload();
}

if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    const hadController = !!navigator.serviceWorker.controller;   // ครั้งแรกที่ติดตั้งไม่ต้องรีโหลด

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController) return;
        updatePending = true;
        applyUpdateNow();
    });

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(reg => {
            swReg = reg;
            reg.update().catch(() => {});
            setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
        }).catch(() => {});
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && swReg) swReg.update().catch(() => {});
    });

    try {
        if (sessionStorage.getItem(UPDATED_FLAG)) {
            sessionStorage.removeItem(UPDATED_FLAG);
            setTimeout(() => toast('อัปเดตแอปเป็นเวอร์ชันล่าสุดแล้ว'), 900);
        }
    } catch (e) {}
}

const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
let deferredPrompt = null;

function showInstallBar() {
    if (isStandalone || localStorage.getItem('installDismissed') === '1') return;
    $('#installBar').hidden = false;
}

window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBar();
});

if (isIOS && !isStandalone) setTimeout(showInstallBar, 2500);

$('#installBtn').addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const res = await deferredPrompt.userChoice;
        deferredPrompt = null;
        $('#installBar').hidden = true;
        if (res.outcome === 'accepted') toast('ติดตั้งแอปเรียบร้อย');
    } else {
        toast('กดปุ่มแชร์ แล้วเลือก "เพิ่มไปยังหน้าจอโฮม"');
    }
});
$('#installClose').addEventListener('click', () => {
    $('#installBar').hidden = true;
    localStorage.setItem('installDismissed', '1');
});
window.addEventListener('appinstalled', () => { $('#installBar').hidden = true; });

/* ─── Refresh when returning to the app ─── */
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (allData.length) refreshTimeline();
    renderLive();
    if (!lastSync || Date.now() - lastSync.getTime() > 20 * 1000) loadData(false, true);
    if (!lastSync || Date.now() - lastSync.getTime() > 5 * 60 * 1000) loadConfigSheet();
});


/* ─── ตัวนับคนเข้าชม / ออนไลน์ ─── */
const CLIENT_KEY = 'dmceu.ss15.client';

function clientId() {
    try {
        let id = localStorage.getItem(CLIENT_KEY);
        if (!id) {
            id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
               : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                     const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
            localStorage.setItem(CLIENT_KEY, id);
        }
        return id;
    } catch (e) { return null; }
}

async function statsRpc(fn, body) {
    const res = await fetch(`${STATS_CONFIG.url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: { apikey: STATS_CONFIG.key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
    });
    if (!res.ok) throw new Error('stats ' + res.status);
    return res.json();
}

function renderStatsCounts(data) {
    if (!data) return;
    $('#stat-visits').textContent = Number(data.total || 0).toLocaleString('th-TH');
    $('#stat-online').textContent = Number(data.online || 0).toLocaleString('th-TH');
    $('#siteStats').hidden = false;
}

let statsTimer = null;
function statsTick(first) {
    if (!STATS_CONFIG.url || document.visibilityState !== 'visible') return;
    statsRpc(first ? 'record_visit' : 'heartbeat', { p_client: clientId() })
        .then(renderStatsCounts)
        .catch(() => { if (first) $('#siteStats').hidden = true; });
}

function statsStart() {
    if (!STATS_CONFIG.url) return;
    clearInterval(statsTimer);
    statsTick(true);
    statsTimer = setInterval(() => statsTick(false), STATS_CONFIG.heartbeatSeconds * 1000);
}

function statsLeave() {
    if (!STATS_CONFIG.url) return;
    clearInterval(statsTimer);
    const id = clientId();
    if (!id) return;
    // ใช้ fetch keepalive แทน sendBeacon: sendBeacon ส่งแบบมี credentials ทำให้ติด CORS ของ Supabase
    try {
        fetch(`${STATS_CONFIG.url}/rest/v1/rpc/leave_presence`, {
            method: 'POST', keepalive: true, credentials: 'omit',
            headers: { apikey: STATS_CONFIG.key, 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_client: id })
        }).catch(() => {});
    } catch (e) {}
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') statsStart();
    else statsLeave();
});
window.addEventListener('pagehide', statsLeave);

/* ─── อัปเดตอัตโนมัติขณะเปิดหน้าอยู่ ───
   · ตารางคิว: เช็คชีตทุก 30 วินาที แบบเงียบ วาดหน้าใหม่เฉพาะตอนข้อมูลเปลี่ยนจริง
   · แท็บ config (เวลา Live ฯลฯ) และชีตกิจกรรม: ทุก 5 นาที */
const AUTO_REFRESH_MS = 30 * 1000;
const CONFIG_REFRESH_MS = 5 * 60 * 1000;
setInterval(() => {
    if (document.visibilityState !== 'visible' || !navigator.onLine || loading) return;
    loadData(false, true);
    loadEventsDb();     // รูปกิจกรรมจากหลังบ้าน — เบา เช็คพร้อมกันทุก 30 วิ
}, AUTO_REFRESH_MS);
setInterval(() => {
    if (document.visibilityState !== 'visible' || !navigator.onLine) return;
    loadConfigSheet();
    loadEventsSheet();
}, CONFIG_REFRESH_MS);

/* ─── Boot ─── */
loadCache();
loadData();
loadConfigSheet();
loadEvents();
statsStart();

/* ─── Light content guard (kept from the original build) ─── */
document.addEventListener('contextmenu', e => {
    if (e.target.closest('input, a')) return;
    e.preventDefault();
});
document.addEventListener('keydown', e => {
    if (e.key === 'F12') { e.preventDefault(); return; }
    if (e.ctrlKey && e.shiftKey && 'IJC'.indexOf(String(e.key).toUpperCase()) > -1) e.preventDefault();
});
