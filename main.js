/**
 * LetLearn – Main JavaScript
 * Scholarship search, tutor display, modals, auth UI
 */

// ── CONFIG ──────────────────────────────────────────────────────────────────
// In production these connect to your real Cloudflare Worker & Supabase
const WORKER_URL = 'https://wandering-sea-42e1.adelakunabdulsalam001.workers.dev';

// ── STATE ────────────────────────────────────────────────────────────────────
let searchOffset = 0;
let lastQuery = '';
let lastLevel = '';
let lastState = '';
let selectedTutor = null;
let isSearching = false;

// ── NAV SCROLL ───────────────────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  document.getElementById('nav')?.classList.toggle('scrolled', window.scrollY > 20);
});

// ── BURGER MENU ───────────────────────────────────────────────────────────────
document.getElementById('burger')?.addEventListener('click', () => {
  document.getElementById('mobileMenu')?.classList.toggle('open');
});

// ── SCHOLARSHIP DATA ─────────────────────────────────────────────────────────
// Demo scholarships for when Worker is unavailable (offline/demo mode)
const DEMO_SCHOLARSHIPS = [
  { title: 'MTN Foundation Scholarship', org: 'MTN Nigeria · Nationwide', amount: '₦300,000', level: 'Undergraduate', deadline: 'Aug 15, 2026', location: 'Nationwide', status: 'Open', description: 'For students in STEM fields with minimum 3.5 GPA.' },
  { title: 'NNPC/SNEPCo National University Scholarship', org: 'Shell Nigeria · Nationwide', amount: '₦500,000', level: 'Undergraduate', deadline: 'Jul 30, 2026', location: 'Nationwide', status: 'New', description: 'Engineering, Geology, and Sciences students in Nigerian universities.' },
  { title: 'CBN Undergraduate Scholarship', org: 'Central Bank of Nigeria · Nationwide', amount: '₦400,000', level: 'Undergraduate', deadline: 'Sep 01, 2026', location: 'Nationwide', status: 'Open', description: 'Economics, Accounting, and Finance students from any state.' },
  { title: 'Lagos State Government Scholarship', org: 'Lagos State Govt · Lagos', amount: '₦250,000', level: 'Undergraduate', deadline: 'Oct 10, 2026', location: 'Lagos', status: 'Open', description: 'Lagos indigenes studying in accredited Nigerian universities.' },
  { title: 'Dangote Foundation Scholarship', org: 'Dangote Foundation · Nationwide', amount: 'Full Tuition', level: 'Undergraduate', deadline: 'Jul 01, 2026', location: 'Nationwide', status: 'Closing Soon', description: 'Top-performing students across Nigeria with financial need.' },
  { title: 'TETFUND Academic Staff Training Award', org: 'TETFund · Nationwide', amount: '₦600,000', level: 'Postgraduate', deadline: 'Aug 20, 2026', location: 'Nationwide', status: 'Open', description: 'For academic staff pursuing MSc and PhD programmes.' },
  { title: 'Zenith Bank STEM Scholarship', org: 'Zenith Bank Plc · Nationwide', amount: '₦200,000', level: 'Undergraduate', deadline: 'Sep 15, 2026', location: 'Nationwide', status: 'New', description: 'Science and Technology students with excellent academic records.' },
  { title: 'Agbami Medical & Engineering Scholarship', org: 'Chevron Nigeria · Nationwide', amount: 'Full Tuition', level: 'Undergraduate', deadline: 'Jul 28, 2026', location: 'Nationwide', status: 'Open', description: 'Medicine, Engineering, and Pharmacy students in Nigerian universities.' },
  { title: 'JAMB/FGN Special Intervention Scholarship', org: 'Federal Government · Nationwide', amount: '₦180,000', level: 'SS3 / JAMB', deadline: 'Nov 01, 2026', location: 'Nationwide', status: 'Open', description: 'High-scoring JAMB candidates from low-income families.' },
  { title: 'Kano State University Scholarship', org: 'Kano State Govt · Kano', amount: '₦150,000', level: 'Undergraduate', deadline: 'Aug 30, 2026', location: 'Kano', status: 'Open', description: 'Kano indigenes attending public universities in Nigeria.' },
  { title: 'PTDF Overseas Scholarship', org: 'Petroleum Trust Dev Fund · Nationwide', amount: '$25,000', level: 'Postgraduate', deadline: 'Jun 30, 2026', location: 'Nationwide', status: 'Closing Soon', description: 'Oil & Gas and STEM students for postgraduate studies abroad.' },
  { title: 'Rivers State Tertiary Education Scholarship', org: 'Rivers State Govt · Rivers', amount: '₦220,000', level: 'Undergraduate', deadline: 'Sep 20, 2026', location: 'Rivers', status: 'Open', description: 'Rivers indigenes with strong academic performance.' },
];

const ICONS = ['🎓','💡','🏛️','🌍','🏢','💼','⚡','🔬','🎯','🌟','🏆','📚'];
function randomIcon() { return ICONS[Math.floor(Math.random() * ICONS.length)]; }

function buildPrompt(query, level, state, offset) {
  const focus = query ? `focused on: "${query}"` : 'covering a variety of fields';
  const lv = level ? `for ${level} students` : 'across all academic levels';
  const st = state ? `available in ${state} or nationwide` : 'nationwide or in any Nigerian state';
  const variety = offset > 0 ? `Show different scholarships from previous results. Start from entry ${offset + 1}.` : '';
  return `Generate exactly 6 realistic Nigerian scholarship opportunities ${focus}, ${lv}, ${st}. ${variety}
Return ONLY a valid JSON array. Each object must have:
- title (string), org (string with location), amount (string in ₦ or $), level (string), deadline (string e.g. "Aug 15, 2026"), location (string), status (one of: "Open","New","Closing Soon"), description (max 12 words)
Return only the JSON array, no markdown.`;
}

async function fetchScholarships(query, level, state, offset) {
  // Call OpenRouter directly from browser
  try {
    const prompt = buildPrompt(query, level, state, offset);
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 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',
        'HTTP-Referer': 'https://letlearn-eight.vercel.app',
        'X-Title': 'LetLearn',
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.6-plus-preview:free',
        messages: [
          { role: 'system', content: 'You are a helpful Nigerian education assistant. Respond with a valid JSON array only. No markdown, no backticks, no explanation.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const rawText = data.choices?.[0]?.message?.content ?? '';
      const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) return JSON.parse(match[0]);
    }
  } catch(e) { /* fall through to demo data */ }

  // Fallback: filter demo scholarships
  await new Promise(r => setTimeout(r, 800));
  let pool = [...DEMO_SCHOLARSHIPS];
  if (query) pool = pool.filter(s => s.title.toLowerCase().includes(query.toLowerCase()) || s.description.toLowerCase().includes(query.toLowerCase()) || s.org.toLowerCase().includes(query.toLowerCase()));
  if (level) pool = pool.filter(s => s.level === level);
  if (state) pool = pool.filter(s => s.location === state || s.location === 'Nationwide');
  if (pool.length === 0) pool = DEMO_SCHOLARSHIPS;
  const page = pool.slice(offset, offset + 6);
  return page.length > 0 ? page : DEMO_SCHOLARSHIPS.slice(0, 6);
}

function showSkeletons() {
  const grid = document.getElementById('scholarshipGrid');
  if (!grid) return;
  grid.innerHTML = Array(6).fill(0).map(() => `
    <div class="skel-card">
      <div class="skel" style="height:12px;width:30%;"></div>
      <div class="skel" style="height:20px;width:80%;margin-top:10px;"></div>
      <div class="skel" style="height:14px;width:60%;"></div>
      <div class="skel" style="height:28px;width:45%;margin-top:12px;border-radius:50px;"></div>
      <div style="display:flex;gap:6px;margin-top:12px">
        <div class="skel" style="height:22px;width:30%;border-radius:50px;"></div>
        <div class="skel" style="height:22px;width:28%;border-radius:50px;"></div>
      </div>
      <div class="skel" style="height:40px;margin-top:16px;border-radius:50px;"></div>
    </div>
  `).join('');
  const err = document.getElementById('scholarshipError');
  if (err) err.style.display = 'none';
  const lm = document.getElementById('loadMoreWrap');
  if (lm) lm.style.display = 'none';
}

function statusClass(status) {
  if (!status) return 'open';
  const s = status.toLowerCase();
  if (s.includes('new')) return 'new';
  if (s.includes('closing')) return 'closing';
  return 'open';
}

function renderCard(s, append = false) {
  const grid = document.getElementById('scholarshipGrid');
  if (!grid) return;
  const card = document.createElement('div');
  card.className = 'scholar-card';
  card.innerHTML = `
    <div class="sc-top">
      <span class="sc-icon">${randomIcon()}</span>
      <span class="sc-status ${statusClass(s.status)}">${s.status || 'Open'}</span>
    </div>
    <div class="sc-title">${s.title}</div>
    <div class="sc-org">${s.org}</div>
    <div class="sc-amount">${s.amount}</div>
    <div class="sc-meta">
      <span class="sc-tag">📚 ${s.level}</span>
      <span class="sc-tag">📍 ${s.location}</span>
    </div>
    <div class="sc-desc">${s.description}</div>
    <div class="sc-footer">
      <div class="sc-deadline">Deadline: <strong>${s.deadline}</strong></div>
      <button class="btn-apply" onclick="openApply(${JSON.stringify(s).split('"').join("'")})">Quick Apply</button>
    </div>
  `;
  if (!append) grid.appendChild(card);
  else grid.appendChild(card);
}

async function searchScholarships() {
  if (isSearching) return;
  isSearching = true;
  searchOffset = 0;
  lastQuery = document.getElementById('searchInput')?.value.trim() || '';
  lastLevel = document.getElementById('levelFilter')?.value || '';
  lastState = document.getElementById('stateFilter')?.value || '';

  showSkeletons();

  const results = await fetchScholarships(lastQuery, lastLevel, lastState, 0);
  const grid = document.getElementById('scholarshipGrid');
  if (!grid) { isSearching = false; return; }
  grid.innerHTML = '';

  if (!results || results.length === 0) {
    document.getElementById('scholarshipError').style.display = 'flex';
    isSearching = false;
    return;
  }

  results.forEach(s => renderCard(s));
  searchOffset = results.length;

  const lm = document.getElementById('loadMoreWrap');
  if (lm) lm.style.display = results.length >= 6 ? 'block' : 'none';
  isSearching = false;
}

async function loadMore() {
  if (isSearching) return;
  isSearching = true;
  const btn = document.getElementById('loadMoreBtn');
  if (btn) btn.textContent = 'Loading...';

  const results = await fetchScholarships(lastQuery, lastLevel, lastState, searchOffset);
  if (results && results.length > 0) {
    results.forEach(s => renderCard(s, true));
    searchOffset += results.length;
  }

  if (btn) btn.textContent = 'Load More Scholarships';
  isSearching = false;
}

// Search on Enter
document.getElementById('searchInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') searchScholarships();
});

// ── TUTORS ─────────────────────────────────────────────────────────────────
const TUTORS = [
  { name: 'Adaobi Gbolahan', initials: 'AG', state: 'Lagos', subjects: ['Mathematics','Physics','JAMB'], rate: 3500, rating: 4.9, reviews: 127, bio: 'BSc Mathematics (University of Lagos). 6 years tutoring experience. Specialises in JAMB prep and university-level calculus.' },
  { name: 'Emeka Okonkwo', initials: 'EO', state: 'Enugu', subjects: ['Chemistry','Biology','WAEC'], rate: 2800, rating: 4.8, reviews: 93, bio: 'BSc Biochemistry (UNN). WAEC specialist with 8 years experience. 90%+ of students achieve 5 credits.' },
  { name: 'Fatima Al-Hassan', initials: 'FA', state: 'Kano', subjects: ['English','Literature','JAMB'], rate: 2500, rating: 4.7, reviews: 84, bio: 'BA English (BUK). Expert in JAMB English and creative writing. Available online nationwide.' },
  { name: 'Chukwuma Nwachukwu', initials: 'CN', state: 'Abuja', subjects: ['Mathematics','Further Maths','Physics'], rate: 4000, rating: 5.0, reviews: 62, bio: 'MSc Applied Mathematics (ABU). Former secondary school teacher. Outstanding reviews from university students.' },
  { name: 'Yetunde Adebisi', initials: 'YA', state: 'Ogun', subjects: ['Biology','Chemistry','WAEC'], rate: 2800, rating: 4.6, reviews: 108, bio: 'BSc Microbiology (FUNAAB). Passionate science educator with proven WAEC results.' },
  { name: 'Usman Musa Danbatta', initials: 'UD', state: 'Kaduna', subjects: ['Physics','Mathematics','JAMB'], rate: 3000, rating: 4.8, reviews: 71, bio: 'BSc Physics (ABU). JAMB Physics specialist. Available for online and in-person sessions in Northern Nigeria.' },
  { name: 'Ngozi Eze', initials: 'NE', state: 'Imo', subjects: ['English','Government','History'], rate: 2200, rating: 4.7, reviews: 95, bio: 'BA Political Science (IMSU). Arts and humanities expert. Helps students excel in WAEC and JAMB arts subjects.' },
  { name: 'Babatunde Lawal', initials: 'BL', state: 'Lagos', subjects: ['Economics','Commerce','JAMB'], rate: 3200, rating: 4.9, reviews: 143, bio: 'MBA (LASU). Over 10 years teaching Economics at secondary and university level. Top-rated in Lagos.' },
];

let allTutors = [...TUTORS];

function renderTutors(list) {
  const grid = document.getElementById('tutorGrid');
  if (!grid) return;
  grid.innerHTML = list.map(t => `
    <div class="tutor-card">
      <div class="tutor-card-header">
        <div class="tutor-avatar-lg">${t.initials}</div>
        <div style="flex:1">
          <div class="tutor-name">${t.name}</div>
          <div class="tutor-state">📍 ${t.state}</div>
        </div>
        <div class="tutor-verified">✓ Verified</div>
      </div>
      <div class="tutor-subjects">
        ${t.subjects.map(s => `<span class="tutor-subject">${s}</span>`).join('')}
      </div>
      <div class="tutor-rating">
        <span class="stars">${'★'.repeat(Math.round(t.rating))}${'☆'.repeat(5-Math.round(t.rating))}</span>
        <span class="rating-text">${t.rating} (${t.reviews} reviews)</span>
      </div>
      <div class="tutor-bio">${t.bio}</div>
      <div class="tutor-footer">
        <div class="tutor-rate">₦${t.rate.toLocaleString()}<span>/hr</span></div>
        <button class="btn-book" onclick="openBook('${t.name}','${t.subjects[0]}')">Book Session</button>
      </div>
    </div>
  `).join('');
}

function filterTutors(subject, btn) {
  document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (subject === 'all') {
    renderTutors(TUTORS);
  } else {
    renderTutors(TUTORS.filter(t => t.subjects.includes(subject)));
  }
}

// ── MODALS ──────────────────────────────────────────────────────────────────
function openBook(name, subject) {
  selectedTutor = { name, subject };
  document.getElementById('bookSubtitle').textContent = `with ${name} — ${subject}`;
  document.getElementById('bookModal').classList.add('open');
}
function closeBook() { document.getElementById('bookModal').classList.remove('open'); }
function closeBookModal(e) { if (e.target === document.getElementById('bookModal')) closeBook(); }

function submitBooking() {
  const name = document.getElementById('bookName')?.value.trim();
  const phone = document.getElementById('bookPhone')?.value.trim();
  const date = document.getElementById('bookDate')?.value;
  if (!name || !phone || !date) { showToast('⚠️ Please fill all fields', true); return; }
  closeBook();
  showToast(`🎉 Booking confirmed with ${selectedTutor?.name || 'your tutor'}!`);
  // In production: POST to Supabase bookings table
}

function openApply(sData) {
  // sData arrives as stringified with single quotes
  let s;
  try {
    s = typeof sData === 'string' ? JSON.parse(sData.replace(/'/g, '"')) : sData;
  } catch(e) { s = { title: 'Scholarship', org: '', amount: '', deadline: '', description: '' }; }

  document.getElementById('applyModalContent').innerHTML = `
    <h2 class="modal-title">${s.title}</h2>
    <p class="modal-sub">${s.org}</p>
    <div style="background:var(--gray-soft);border-radius:12px;padding:1.2rem;margin-bottom:1.5rem">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;margin-bottom:0.8rem">
        <div><div style="font-size:0.72rem;color:var(--gray);font-weight:600;margin-bottom:2px">AMOUNT</div><div style="font-weight:800;font-family:'Syne',sans-serif;color:var(--blue-deep)">${s.amount}</div></div>
        <div><div style="font-size:0.72rem;color:var(--gray);font-weight:600;margin-bottom:2px">DEADLINE</div><div style="font-weight:700;color:var(--gold-dark)">${s.deadline}</div></div>
      </div>
      <div style="font-size:0.83rem;color:var(--gray);line-height:1.6">${s.description}</div>
    </div>
    <div class="form-group"><label>Your Full Name</label><input type="text" class="form-input" placeholder="e.g. Amaka Okafor" id="applyName"/></div>
    <div class="form-group"><label>Email Address</label><input type="email" class="form-input" placeholder="e.g. amaka@email.com" id="applyEmail"/></div>
    <div class="form-group"><label>Academic Level</label><select class="form-input" id="applyLevel"><option>Undergraduate</option><option>Postgraduate</option><option>SS3 / JAMB</option></select></div>
    <button class="btn-primary full" onclick="submitApply('${s.title}')">Submit Application Interest</button>
    <p style="text-align:center;font-size:0.75rem;color:var(--gray-light);margin-top:0.8rem">We'll send you the official link and requirements.</p>
  `;
  document.getElementById('applyModal').classList.add('open');
}

function closeApply() { document.getElementById('applyModal').classList.remove('open'); }
function closeApplyModal(e) { if (e.target === document.getElementById('applyModal')) closeApply(); }

function submitApply(title) {
  const name = document.getElementById('applyName')?.value.trim();
  const email = document.getElementById('applyEmail')?.value.trim();
  if (!name || !email) { showToast('⚠️ Please fill your name and email', true); return; }
  closeApply();
  showToast(`📚 Interest registered for "${title}"!`);
}

// ── TOAST ──────────────────────────────────────────────────────────────────
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = isError ? 'toast error show' : 'toast show';
  setTimeout(() => t.classList.remove('show'), 4000);
}

// ── INIT ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Load initial scholarships
  searchScholarships();
  // Load tutors
  renderTutors(TUTORS);
});
