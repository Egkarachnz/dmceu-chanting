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
    showError('#loginError', msg || '');
    $('#loginBtn').classList.remove('busy');
}

function showApp() {
    $('#authView').hidden = true;
    $('#appView').hidden = false;
    $('#logoutBtn').hidden = false;
    $('#logoutBtn').title = `ออกจากระบบ (${session.user.email})`;
    loadEvents();
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
    await refreshAuth();
    toast('เข้าสู่ระบบแล้ว');
});

$('#logoutBtn').addEventListener('click', async () => {
    await db.auth.signOut();
    session = null;
    events = [];
    showAuth();
    toast('ออกจากระบบแล้ว');
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
        .select('id,title,description,link,image_path,width,height,sort,visible,created_at,updated_at')
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

function renderList() {
    const shown = events.filter(e => e.visible).length;
    $('#adminSub').textContent = events.length
        ? `${events.length} รายการ · แสดงบนเว็บ ${shown}` : 'ยังไม่มีรูปกิจกรรม';

    const list = $('#eventList');
    if (!events.length) {
        list.innerHTML = `<div class="admin-empty">${icon('image')}<span>ยังไม่มีรูป · กดปุ่มด้านบนเพื่อเพิ่มรูปแรก</span></div>`;
        return;
    }
    list.innerHTML = events.map((ev, i) => `
        <article class="ev-row${ev.visible ? '' : ' hidden-row'}" data-id="${ev.id}">
            <div class="ev-thumb">
                <img src="${esc(publicUrl(ev.image_path))}" alt="" loading="lazy">
                ${ev.visible ? '' : '<span class="ev-hidden-badge">ซ่อนอยู่</span>'}
            </div>
            <div class="ev-body">
                <h3 class="ev-title">${esc(ev.title) || '<span style="color:var(--text-mute)">(ไม่มีหัวข้อ)</span>'}</h3>
                ${ev.description ? `<p class="ev-desc">${esc(ev.description)}</p>` : ''}
                <div class="ev-meta">
                    ${ev.width ? `<span>${ev.width}×${ev.height}</span>` : ''}
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
        </article>`).join('');
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
    $('#confirmText').textContent = `“${ev.title || 'รูปไม่มีหัวข้อ'}” จะถูกลบออกจากหน้าเว็บทันที และกู้คืนไม่ได้`;
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
        await db.storage.from(SUPA.bucket).remove([ev.image_path]);   // ไฟล์ค้างไม่เป็นไร ถ้าลบไม่ได้
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

/* ─── ฟอร์มเพิ่ม/แก้ไข ─── */
const editModal = $('#editModal');
let editing = null;          // แถวที่กำลังแก้ (null = เพิ่มใหม่)
let picked = null;           // { blob, width, height, previewUrl } รูปที่เลือกและย่อแล้ว

function openEditor(ev) {
    editing = ev || null;
    picked = null;
    $('#editTitle').textContent = ev ? 'แก้ไขรูปตารางกิจกรรม' : 'เพิ่มรูปตารางกิจกรรม';
    $('#fTitle').value = ev ? ev.title : '';
    $('#fDesc').value = ev ? ev.description : '';
    $('#fLink').value = ev ? ev.link : '';
    $('#fVisible').checked = ev ? ev.visible : true;
    $('#fileInput').value = '';
    showError('#editError', '');
    $('#uploadProgress').hidden = true;
    $('#uploadFill').style.width = '0';
    if (ev) {
        showPreview(publicUrl(ev.image_path), ev.width && ev.height ? `${ev.width}×${ev.height}` : 'รูปปัจจุบัน');
    } else {
        $('#dropEmpty').hidden = false;
        $('#dropPreview').hidden = true;
    }
    editModal.showModal();
    $('#editForm').scrollTop = 0;
}
function showPreview(url, meta) {
    $('#previewImg').src = url;
    $('#previewMeta').textContent = meta;
    $('#dropEmpty').hidden = true;
    $('#dropPreview').hidden = false;
}

$('#addBtn').addEventListener('click', () => openEditor(null));
$('#editClose').addEventListener('click', () => editModal.close());
$('#editCancel').addEventListener('click', () => editModal.close());
editModal.addEventListener('close', () => {
    if (picked && picked.previewUrl) URL.revokeObjectURL(picked.previewUrl);
    picked = null; editing = null;
});

const drop = $('#drop');
drop.addEventListener('click', () => $('#fileInput').click());
drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#fileInput').click(); } });
$('#fileInput').addEventListener('change', () => { const f = $('#fileInput').files[0]; if (f) handleFile(f); });
['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => { const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handleFile(f); });
document.addEventListener('paste', e => {
    if (!editModal.open) return;
    const item = Array.from(e.clipboardData.items || []).find(i => i.type.startsWith('image/'));
    if (item) handleFile(item.getAsFile());
});

async function handleFile(file) {
    showError('#editError', '');
    if (!/^image\//.test(file.type) && !/\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)) {
        return showError('#editError', 'ไฟล์นี้ไม่ใช่รูปภาพ');
    }
    $('#previewMeta').textContent = 'กำลังเตรียมรูป…';
    try {
        const out = await shrinkImage(file);
        if (picked && picked.previewUrl) URL.revokeObjectURL(picked.previewUrl);
        picked = out;
        picked.previewUrl = URL.createObjectURL(out.blob);
        showPreview(picked.previewUrl, `${out.width}×${out.height} · ${fmtBytes(out.blob.size)}`);
        // เติมหัวข้อจากชื่อไฟล์ให้ ถ้าชื่อไฟล์ดูมีความหมาย (ไม่ใช่ IMG_1234 / Screenshot)
        const base = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
        if (!$('#fTitle').value && !editing && base && !/^(img|dsc|pxl|image|photo|screenshot|scan)\b|^\d+$/i.test(base)) {
            $('#fTitle').value = base;
        }
    } catch (err) {
        showError('#editError', 'เปิดรูปไม่ได้ · ถ้าเป็น HEIC ลองส่งออกเป็น JPG ก่อน');
        picked = null;
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
    if (!editing && !picked) return showError('#editError', 'กรุณาเลือกรูปก่อน');

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

    try {
        // ต่ออายุ token ก่อน เผื่อเปิดหน้าค้างไว้นาน
        const { data: s } = await db.auth.getSession();
        if (!s.session) throw new Error('หมดเวลาเข้าสู่ระบบ · กรุณาเข้าสู่ระบบใหม่');
        session = s.session;

        let oldPath = null;
        if (picked) {
            prog.hidden = false; fill.style.width = '0'; text.textContent = 'กำลังอัปโหลดรูป…';
            const path = `posters/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${picked.ext}`;
            await uploadBlob(path, picked.blob, p => { fill.style.width = Math.round(p * 100) + '%'; });
            fill.style.width = '100%'; text.textContent = 'กำลังบันทึกข้อมูล…';
            if (editing) oldPath = editing.image_path;
            Object.assign(payload, { image_path: path, width: picked.width, height: picked.height });
        }

        if (editing) {
            const { data, error } = await db.from('events').update(payload).eq('id', editing.id).select().single();
            if (error) throw error;
            Object.assign(editing, data);
            if (oldPath) db.storage.from(SUPA.bucket).remove([oldPath]);
            toast('บันทึกการแก้ไขแล้ว');
        } else {
            const minSort = events.length ? Math.min(...events.map(x => x.sort)) : 10;
            payload.sort = minSort - 10;   // ให้รูปใหม่ขึ้นบนสุด
            const { data, error } = await db.from('events').insert(payload).select().single();
            if (error) throw error;
            events.unshift(data);
            toast('เพิ่มรูปแล้ว · จะขึ้นหน้าเว็บภายในไม่กี่วินาที');
        }
        renderList();
        editModal.close();
    } catch (err) {
        showError('#editError', (err && err.message) || 'บันทึกไม่สำเร็จ');
    } finally {
        saveBtn.classList.remove('busy');
        prog.hidden = true;
    }
});

/* ─── Boot ─── */
refreshAuth();
