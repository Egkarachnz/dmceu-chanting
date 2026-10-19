/* ============================================================
   DMCEU · ตัวเขียนข้อมูลลง Google Sheets (Google Apps Script)

   วิธีติดตั้ง (ทำครั้งเดียว)
   1. เปิดชีต SS16 → เมนู "ส่วนขยาย" → "Apps Script"
   2. ลบโค้ดเดิมในไฟล์ Code.gs ทิ้ง แล้ววางไฟล์นี้ลงไปทั้งหมด
      จากนั้นแทนที่ค่า SECRET ข้างล่างด้วยรหัสลับที่ส่งให้ในแชท
      (ไฟล์ในโปรเจกต์นี้เก็บเป็นค่าตัวอย่างไว้ เพราะ repo เป็นสาธารณะ)
   3. กด "ทำให้ใช้งานได้" (Deploy) → "การทำให้ใช้งานได้ใหม่" → ประเภท "เว็บแอป"
        · ดำเนินการในชื่อ : ฉัน
        · ผู้ที่มีสิทธิ์เข้าถึง : ทุกคน
   4. กดอนุญาตสิทธิ์ (ครั้งแรกจะมีหน้าเตือน → ขั้นสูง → ไปที่โปรเจกต์)
   5. คัดลอก URL ที่ลงท้ายด้วย /exec ส่งกลับมา

   หมายเหตุความปลอดภัย
   · URL นี้ไม่เคยอยู่ในหน้าเว็บ — เก็บไว้ฝั่งเซิร์ฟเวอร์ (Supabase Edge Function) เท่านั้น
   · ทุกคำขอต้องมี SECRET ที่ตรงกัน ไม่ตรง = ปฏิเสธ
   · เขียนได้เฉพาะแท็บที่ระบุใน TAB และเฉพาะคอลัมน์ B, D, E, F, G
   ============================================================ */

const SECRET = 'ใส่รหัสลับที่ได้รับตรงนี้';   // ← ดูขั้นตอนที่ 2 ด้านบน (ห้ามใส่ลงใน repo)
const TAB    = 'ตารางสวดมนต์ซีซั่นที่ 16';

const COL_NO     = 1;   // A ลำดับ
const COL_TEMPLE = 2;   // B วัดที่นำสวดมนต์
const COL_ROUND  = 3;   // C ครั้งที่   ← ใช้เป็นกุญแจหาแถว
const COL_DATE   = 4;   // D วันที่
const COL_MONK   = 5;   // E ชื่อ-ฉายา พระอาจารย์
const COL_TOPIC  = 6;   // F หัวข้อเทศน์
const COL_JOIN   = 7;   // G ยอดผู้ร่วมซูม

function doPost(e) {
    try {
        if (!e || !e.postData || !e.postData.contents) return out({ ok: false, error: 'ไม่มีข้อมูลที่ส่งมา' });
        const b = JSON.parse(e.postData.contents);

        if (b.secret !== SECRET) return out({ ok: false, error: 'unauthorized' });

        const sh = SpreadsheetApp.getActive().getSheetByName(TAB);
        if (!sh) return out({ ok: false, error: 'ไม่พบแท็บ "' + TAB + '"' });

        if (b.action === 'ping') return out({ ok: true, tab: TAB, rows: sh.getLastRow() });
        if (b.action && b.action !== 'update') return out({ ok: false, error: 'ไม่รู้จักคำสั่ง ' + b.action });

        const row = findRowByRound(sh, b.round);
        if (row < 0) return out({ ok: false, error: 'ไม่พบครั้งที่ ' + b.round + ' ในชีต' });

        // กันเขียนผิดแถว: ถ้าส่ง "ลำดับ" มาด้วย ต้องตรงกับแถวที่เจอ
        if (b.no !== undefined && b.no !== null && String(b.no).trim() !== '') {
            const noInSheet = String(sh.getRange(row, COL_NO).getValue()).trim();
            if (noInSheet !== String(b.no).trim()) {
                return out({ ok: false, error: 'ลำดับไม่ตรงกับครั้งที่ (ในชีตเป็น ' + noInSheet + ') — ข้อมูลอาจถูกแก้ไปแล้ว ลองโหลดใหม่' });
            }
        }

        // เขียนเฉพาะช่องที่ส่งมา (ไม่ส่ง = ไม่แตะ, ส่งค่าว่าง = ล้างช่องนั้น)
        const put = (col, val) => {
            if (val === undefined || val === null) return;
            sh.getRange(row, col).setValue(val);
        };
        put(COL_TEMPLE, b.temple);
        put(COL_MONK,   b.monk);
        put(COL_TOPIC,  b.topic);
        put(COL_JOIN,   b.attendance === '' ? '' : b.attendance);

        // วันที่: เขียนเป็น Date จริงเพื่อให้รูปแบบ "วันเสาร์ที่ 24 ตุลาคม" ของคอลัมน์ยังอยู่
        // ใช้เที่ยงวันกันวันเลื่อนจาก timezone ของสคริปต์
        if (b.date) {
            const m = String(b.date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!m) return out({ ok: false, error: 'รูปแบบวันที่ต้องเป็น YYYY-MM-DD' });
            sh.getRange(row, COL_DATE).setValue(new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0));
        }

        SpreadsheetApp.flush();
        return out({ ok: true, row: row, round: String(b.round) });
    } catch (err) {
        return out({ ok: false, error: String(err) });
    }
}

/** หาแถวจาก "ครั้งที่" (คอลัมน์ C) — คืน -1 ถ้าไม่เจอ */
function findRowByRound(sh, round) {
    const want = String(round).trim();
    if (!want) return -1;
    const last = sh.getLastRow();
    if (last < 1) return -1;
    const col = sh.getRange(1, COL_ROUND, last, 1).getValues();
    for (let i = 0; i < col.length; i++) {
        const v = col[i][0];
        if (v !== '' && v !== null && String(v).trim() === want) return i + 1;
    }
    return -1;
}

function out(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj))
        .setMimeType(ContentService.MimeType.JSON);
}

/** เปิด URL ด้วยเบราว์เซอร์ตรง ๆ จะเห็นข้อความนี้ (ยืนยันว่า deploy แล้ว) */
function doGet() {
    return out({ ok: true, service: 'dmceu-sheet-write', tab: TAB });
}
