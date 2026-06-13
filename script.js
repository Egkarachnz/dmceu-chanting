// ─── Theme ───
function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('theme-icon').textContent = isDark ? '🌙' : '☀️';
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
}
(function() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    const btn = document.getElementById('theme-icon');
    if (btn) btn.textContent = saved === 'dark' ? '☀️' : '🌙';
})();

// ─── Clock & Date ───
const thaiMonths = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2,'0');
    const m = String(now.getMinutes()).padStart(2,'0');
    const s = String(now.getSeconds()).padStart(2,'0');
    document.getElementById('live-time').textContent = `${h}:${m}:${s}`;
    const d = String(now.getDate()).padStart(2,'0');
    const mo = thaiMonths[now.getMonth()];
    const y = now.getFullYear() + 543;
    document.getElementById('live-date-hero').textContent = `${d} ${mo} ${y}`;
}
setInterval(updateClock, 1000);
updateClock();

// ─── Flag ───
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const tzMap = {
    'Asia/Bangkok':'🇹🇭','Europe/London':'🇬🇧','Europe/Paris':'🇫🇷',
    'Europe/Berlin':'🇩🇪','Europe/Rome':'🇮🇹','Europe/Zurich':'🇨🇭',
    'Europe/Vienna':'🇦🇹','Europe/Amsterdam':'🇳🇱','Europe/Brussels':'🇧🇪',
    'Europe/Copenhagen':'🇩🇰','Europe/Stockholm':'🇸🇪','Europe/Oslo':'🇳🇴',
    'Europe/Helsinki':'🇫🇮','Europe/Madrid':'🇪🇸','Europe/Lisbon':'🇵🇹',
    'Europe/Dublin':'🇮🇪','Europe/Prague':'🇨🇿','Europe/Warsaw':'🇵🇱',
    'Asia/Tokyo':'🇯🇵','America/New_York':'🇺🇸','Australia/Sydney':'🇦🇺'
};
let flag = tzMap[tz] || '🌍';
document.getElementById('user-flag').textContent = flag;
fetch('https://get.geojs.io/v1/ip/country.json').then(r=>r.json()).then(data=>{
    if (data.country) {
        const cp = data.country.toUpperCase().split('').map(c=>127397+c.charCodeAt());
        flag = String.fromCodePoint(...cp);
        document.getElementById('user-flag').textContent = flag;
    }
}).catch(()=>{});

// ─── Scroll Top ───
window.addEventListener('scroll', () => {
    const btn = document.getElementById('scrollBtn');
    if (window.scrollY > 300) btn.classList.add('visible');
    else btn.classList.remove('visible');
});

// ─── Data ───
let allData = [];
let nextQueueNo = null;

function parseDateFromGs(cell) {
    if (!cell) return null;
    if (cell.v && typeof cell.v === 'string' && cell.v.startsWith('Date(')) {
        const m = cell.v.match(/Date\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) return new Date(parseInt(m[1]), parseInt(m[2]), parseInt(m[3]));
    }
    const str = cell.f || cell.v;
    if (typeof str === 'string') {
        const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค.","มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
        let dMatch = str.match(/\d{1,2}/);
        let yMatch = str.match(/(25\d{2}|20\d{2})/);
        let mIndex = -1;
        for (let i = 0; i < months.length; i++) {
            if (str.indexOf(months[i]) > -1) { mIndex = i % 12; break; }
        }
        if (dMatch && yMatch && mIndex > -1) {
            let day = parseInt(dMatch[0]);
            let year = parseInt(yMatch[0]);
            if (year > 2400) year -= 543;
            return new Date(year, mIndex, day);
        }
    }
    return null;
}

function getDayOfWeek(date) {
    if (!date) return null;
    return date.getDay(); // 0=Sun, 6=Sat
}

function processSheetData(response) {
    const container = document.getElementById('cards-container');
    if (response.status === 'error') {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">❌</div>เกิดข้อผิดพลาดในการดึงข้อมูล</div>';
        return;
    }

    const rows = response.table.rows;
    allData = [];
    let bookedCount = 0, availableCount = 0;

    const today = new Date(); today.setHours(0,0,0,0);
    let nextEvent = null, minFuture = new Date(8640000000000000);

    rows.forEach(row => {
        if (!row || !row.c) return;
        const getVal = c => (c && c.v !== null && c.v !== undefined && String(c.v).trim() !== '') ? String(c.v).trim() : '-';
        const getDate = c => c ? (c.f ? String(c.f).trim() : (c.v ? String(c.v).trim() : '-')) : '-';
        const noVal = getVal(row.c[0]);
        if (noVal === '-' || isNaN(noVal)) return;
        const item = {
            no: noVal,
            temple: getVal(row.c[1]),
            time: getVal(row.c[2]),
            date: getDate(row.c[3]),
            monk: getVal(row.c[4]),
            topic: getVal(row.c[5]),
            parsedDate: parseDateFromGs(row.c[3])
        };
        item.dayOfWeek = getDayOfWeek(item.parsedDate);
        allData.push(item);

        const avail = (item.monk === '-' || item.topic === '-');
        if (avail) availableCount++; else bookedCount++;

        if (item.parsedDate && item.parsedDate >= today && item.parsedDate < minFuture) {
            minFuture = item.parsedDate;
            nextEvent = item;
        }
    });

    document.getElementById('stat-booked').textContent = bookedCount;
    document.getElementById('stat-available').textContent = availableCount;

    nextQueueNo = nextEvent ? nextEvent.no : null;
    allData.forEach(item => {
        item.timelineStatus = getTimelineStatus(item.parsedDate, item.no === nextQueueNo);
    });

    if (nextEvent) {
        document.getElementById('nq-no-container').textContent = '(ลำดับที่ ' + nextEvent.no + ')';
        document.getElementById('nq-temple').textContent = nextEvent.temple;
        document.getElementById('nq-date').textContent = nextEvent.date;
        const monkEl = document.getElementById('nq-monk');
        if (nextEvent.monk === '-') {
            monkEl.textContent = 'รอลงชื่อพระอาจารย์';
            monkEl.classList.add('pending');
        } else {
            monkEl.textContent = nextEvent.monk;
            monkEl.classList.remove('pending');
        }
        document.getElementById('next-queue-banner').classList.add('visible');
    }

    renderCards(allData);
}

function getTimelineStatus(date, isNext) {
    if (!date) return { key: 'unknown', label: 'รอวันที่', icon: '•', note: 'ยังไม่ระบุวันที่' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(date);
    eventDate.setHours(0, 0, 0, 0);
    if (eventDate < today) return { key: 'past', label: 'ผ่านไปแล้ว', icon: '✓', note: 'สวดมนต์ผ่านไปแล้ว' };
    if (isNext) return { key: 'next', label: 'คิวถัดไป', icon: '●', note: 'คิวที่กำลังจะมาถึงก่อนสุด' };
    return { key: 'future', label: 'กำลังจะมาถึง', icon: '→', note: 'ยังไม่ถึงกำหนดสวดมนต์' };
}

function renderCards(data) {
    const container = document.getElementById('cards-container');
    document.getElementById('result-count').textContent = `พบ ${data.length} รายการ`;

    if (data.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div>ไม่พบข้อมูลที่ค้นหา</div>';
        return;
    }

    // Group by weekend pairs: group by year+week+weekend (Sat=6, Sun=0)
    // We pair Saturday and Sunday that are in the same weekend
    // Strategy: group items by their date's week (Mon-Sun), then within each group show Sat & Sun together

    // First, separate into weekends
    const weekendGroups = {}; // key: ISO week string
    const others = [];

    data.forEach(item => {
        if (!item.parsedDate) {
            others.push(item);
            return;
        }
        const dow = item.parsedDate.getDay();
        if (dow === 6 || dow === 0) {
            // Get the Saturday of this weekend
            const sat = new Date(item.parsedDate);
            if (dow === 0) sat.setDate(sat.getDate() - 1); // go back to Saturday
            const key = sat.toISOString().slice(0, 10);
            if (!weekendGroups[key]) weekendGroups[key] = { sat: null, sun: null, satDate: sat };
            if (dow === 6) weekendGroups[key].sat = item;
            else weekendGroups[key].sun = item;
        } else {
            others.push(item);
        }
    });

    let html = '';

    // Sort weekends by date
    const sortedKeys = Object.keys(weekendGroups).sort();
    sortedKeys.forEach(key => {
        const group = weekendGroups[key];
        const items = [group.sat, group.sun].filter(Boolean);
        if (items.length === 0) return;

        // Week label
        const satLabel = group.satDate;
        const d = String(satLabel.getDate()).padStart(2,'0');
        const mo = thaiMonths[satLabel.getMonth()];
        const y = satLabel.getFullYear() + 543;
        html += `<div class="week-section">`;
        html += `<div class="week-header">
            <span class="week-label">สัปดาห์ ${d} ${mo} ${y}</span>
            <div class="week-line"></div>
            <span class="week-count">${items.length} คิว</span>
        </div>`;
        html += `<div class="weekend-pair">`;
        if (group.sat) html += buildCard(group.sat, 'sat', 'วันเสาร์');
        if (group.sun) html += buildCard(group.sun, 'sun', 'วันอาทิตย์');
        html += '</div></div>';
    });

    // Remaining (non-weekend or no date)
    if (others.length > 0) {
        html += `<div class="week-section">`;
        html += `<div class="week-header">
            <span class="week-label">รายการอื่น ๆ</span>
            <div class="week-line"></div>
            <span class="week-count">${others.length} คิว</span>
        </div>`;
        html += `<div class="card-grid">`;
        others.forEach(item => { html += buildCard(item, 'other', ''); });
        html += '</div></div>';
    }

    container.innerHTML = html;
}

function buildCard(item, dayClass, dayLabel) {
    const avail = (item.monk === '-' || item.topic === '-');
    const timeline = item.timelineStatus || getTimelineStatus(item.parsedDate, false);
    const templeClass = avail ? 'temple-name available' : 'temple-name';
    const monkText = item.monk === '-' ? '<span class="info-text pending">รอลงชื่อพระอาจารย์</span>' : `<span class="info-text">${item.monk}</span>`;
    const topicText = item.topic === '-' ? '<span class="info-text pending">รอหัวข้อเทศน์</span>' : `<span class="info-text">${item.topic}</span>`;

    return `<div class="temple-card ${dayClass} timeline-${timeline.key}">
        <div class="accent-stripe"></div>
        <div class="card-top">
            <div class="card-no-badge">${item.no}</div>
            ${dayLabel ? `<div class="day-badge">${dayLabel}</div>` : ''}
            <div class="timeline-badge ${timeline.key}" title="${timeline.note}"><span>${timeline.icon}</span>${timeline.label}</div>
            <div class="status-dot ${avail ? 'empty' : 'filled'}" title="${avail ? 'ยังว่าง' : 'ลงข้อมูลแล้ว'}"></div>
        </div>
        <div class="card-body">
            <div class="${templeClass}">${item.temple}</div>
            <div class="info-row">
                <span class="info-icon">📅</span>
                <span class="info-text">${item.date !== '-' ? item.date : 'ยังไม่ระบุวันที่'}</span>
            </div>
            <div class="info-row timeline-row">
                <span class="info-icon">${timeline.icon}</span>
                <span class="info-text timeline-text">${timeline.note}</span>
            </div>
            <div class="info-row">
                <span class="info-icon">👤</span>
                ${monkText}
            </div>
            <div class="info-row">
                <span class="info-icon">📖</span>
                ${topicText}
            </div>
        </div>
        <div class="card-footer">
            <span class="round-label">ครั้งที่</span>
            <span class="round-num">${item.time}</span>
        </div>
    </div>`;
}

function filterData() {
    const q = document.getElementById('searchInput').value.toLowerCase();
    const status = document.getElementById('statusFilter').value;
    const timelineFilter = document.getElementById('timelineFilter').value;
    const filtered = allData.filter(item => {
        const match = [item.temple, item.date, item.monk, item.topic].some(v => String(v).toLowerCase().includes(q));
        const avail = (item.monk === '-' || item.topic === '-');
        if (status === 'available' && !avail) return false;
        if (status === 'booked' && avail) return false;
        if (timelineFilter !== 'all' && item.timelineStatus?.key !== timelineFilter) return false;
        return match;
    });
    renderCards(filtered);
}

document.getElementById('searchInput').addEventListener('input', filterData);
document.getElementById('statusFilter').addEventListener('change', filterData);
document.getElementById('timelineFilter').addEventListener('change', filterData);

const themeBtn = document.getElementById('themeBtn');
if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

const scrollBtn = document.getElementById('scrollBtn');
if (scrollBtn) {
    scrollBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}


function handleScriptError() {
    document.getElementById('cards-container').innerHTML =
        '<div class="empty-state"><div class="empty-icon">⚠️</div>การเชื่อมต่อล้มเหลว · โปรดตรวจสอบสิทธิ์การเข้าถึง Google Sheets</div>';
}

// Anti-copy (minimal)
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
    if (e.key === 'F12') { e.preventDefault(); return false; }
    if (e.ctrlKey && e.shiftKey && 'IJC'.includes(e.key.toUpperCase())) { e.preventDefault(); return false; }
});
