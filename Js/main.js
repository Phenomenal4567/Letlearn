/**
 * LetLearn – Main JavaScript
 * Handles: search, scholarship loading, modals, Supabase auth, Google OAuth
 */

// ── CONFIG ──────────────────────────────────────────────────────────────────
const WORKER_URL = 'https://wandering-sea-42e1.adelakunabdulsalam001.workers.dev';

// Supabase config – replace with your actual project values
const SUPABASE_URL = 'https://nyijdoxtjuidgzdmmfsk.supabase.co';          // local dev
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55aWpkb3h0anVpZGd6ZG1tZnNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMjAwMjMsImV4cCI6MjA5MDU5NjAyM30.pV5H4w_MvwEUJ4wqoNTKe0by5xvEoFggL3n_bFQgET8';     // replace after: supabase start

// ── SUPABASE CLIENT (loaded from CDN in HTML) ─────────────────────────────
let supabase = null;
function initSupabase() {
  if (window.supabase && window.supabase.createClient) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    checkAuthState();
  }
}

async function checkAuthState() {
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) updateNavForUser(session.user);

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) updateNavForUser(session.user);
    else clearNavUser();
  });
}

function updateNavForUser(user) {
  const navRight = document.getElementById('nav-right');
  if (!navRight) return;
  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Account';
  const initial = name[0].toUpperCase();
  navRight.innerHTML = `
    <div class="nav-user" onclick="openModal('account')" title="${name}">
      <div class="nav-avatar">${initial}</div>
      <span>${name.split(' ')[0]}</span>
    </div>
    <button class="nav-cta" onclick="signOut()">Sign Out</button>
  `;
}

function clearNavUser() {
  const navRight = document.getElementById('nav-right');
  if (!navRight) return;
  navRight.innerHTML = `
    <button class="nav-cta" onclick="openModal('signup')"><span class="nav-cta-full">Join Free</span><span class="nav-cta-short">Join Free</span></button>
  `;
}

// ── AUTH FUNCTIONS ───────────────────────────────────────────────────────────
async function signUpWithEmail(name, email, password, state, role) {
  if (!supabase) return { error: { message: 'Auth service not ready' } };
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: {
      data: { full_name: name, state, role },
      emailRedirectTo: window.location.origin
    }
  });
  if (!error && data.user) {
    // Save to students table
    await supabase.from('students').insert([{
      id: data.user.id, full_name: name, email, state, role,
      created_at: new Date().toISOString()
    }]);
  }
  return { data, error };
}

async function signInWithEmail(email, password) {
  if (!supabase) return { error: { message: 'Auth service not ready' } };
  return await supabase.auth.signInWithPassword({ email, password });
}

async function signInWithGoogle() {
  if (!supabase) { showToast('⚠️ Auth service not available'); return; }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if (error) showToast('⚠️ Google sign-in failed: ' + error.message);
}

async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
  showToast('👋 Signed out successfully');
}

// ── SCHOLARSHIP SEARCH ───────────────────────────────────────────────────────
let currentSearchQuery = '';
let currentLevel = '';
let currentState = '';
let loadMoreOffset = 0;
let isLoading = false;

const ICONS = ['🎓','💡','🏛️','🌍','🏢','💼','⚡','🔬','🎯','🌟','🏆','📚'];
function getRandomIcon() { return ICONS[Math.floor(Math.random() * ICONS.length)]; }

function buildPrompt(query, level, state, offset) {
  const focus = query ? `focused on: "${query}"` : 'covering a variety of fields';
  const levelFilter = level ? `for ${level} students` : 'across all academic levels';
  const stateFilter = state ? `available in ${state} or nationwide` : 'nationwide or in any Nigerian state';
  const variety = offset > 0 ? `Show different scholarships from the previous batch. Start from entry ${offset + 1}.` : '';

  return `You are a Nigerian scholarship database. Generate exactly 6 realistic Nigerian scholarship opportunities ${focus}, ${levelFilter}, ${stateFilter}. ${variety}

Return ONLY a valid JSON array with no markdown, no explanation, no backticks. Each object must have:
- title (string): Scholarship name (real or realistic Nigerian scholarship)
- org (string): Organization name · Location (e.g. "MTN Nigeria · Nationwide")
- amount (string): Award amount in ₦ or $ or "Full Tuition" etc
- level (string): Target academic level (e.g. "Undergraduate", "Postgraduate", "SS3 / JAMB")
- deadline (string): Deadline month and day (e.g. "Jul 30, 2026")
- location (string): States or "Nationwide"
- status (string): one of "Open", "New", "Closing Soon"
- description (string): 1 short sentence about eligibility or focus (max 15 words)

Return only the JSON array. Example format:
[{"title":"...","org":"...","amount":"...","level":"...","deadline":"...","location":"...","status":"...","description":"..."}]`;
}

function showSkeletons() {
  const grid = document.getElementById('scholarships-grid');
  if (!grid) return;
  grid.innerHTML = Array(6).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-line short" style="height:10px;width:30%;margin-bottom:14px;"></div>
      <div class="skeleton-line tall medium"></div>
      <div class="skeleton-line short"></div>
      <div class="skeleton-line full" style="height:20px;margin:14px 0;"></div>
      <div style="display:flex;gap:8px;margin-bottom:14px;">
        <div class="skeleton-line" style="width:33%;margin-bottom:0;"></div>
        <div class="skeleton-line" style="width:33%;margin-bottom:0;"></div>
        <div class="skeleton-line" style="width:28%;margin-bottom:0;"></div>
      </div>
      <div class="skeleton-line full" style="height:36px;border-radius:10px;"></div>
    </div>
  `).join('');
  const errEl = document.getElementById('scholarships-error');
  if (errEl) errEl.style.display = 'none';
  const lmw = document.getElementById('load-more-wrap');
  if (lmw) lmw.style.display = 'none';
}

function renderScholarshipCard(s) {
  const statusClass = s.status === 'New' ? 'badge-new' : s.status === 'Closing Soon' ? 'badge-closing' : 'badge-open';
  const icon = getRandomIcon();
  return `
    <div class="opportunity-card" style="animation:fadeUp 0.4s ease both;">
      <div class="ai-badge">✨ AI Generated</div>
      <div class="opp-header">
        <div class="opp-icon">${icon}</div>
        <span class="opp-badge ${statusClass}">${s.status}</span>
      </div>
      <div class="opp-title">${s.title}</div>
      <div class="opp-org">${s.org}</div>
      <div class="opp-amount">${s.amount}</div>
      ${s.description ? `<div style="font-size:0.8rem;color:var(--gray-text);margin-bottom:0.8rem;line-height:1.5;">${s.description}</div>` : ''}
      <div class="opp-details">
        <span class="opp-detail">🎓 ${s.level}</span>
        <span class="opp-detail">📅 ${s.deadline}</span>
        <span class="opp-detail">📍 ${s.location}</span>
      </div>
      <button class="apply-btn" onclick="openModal('apply')">Apply Now →</button>
    </div>`;
}

async function loadScholarships(append = false) {
  if (isLoading) return;
  isLoading = true;

  const grid = document.getElementById('scholarships-grid');
  const errorEl = document.getElementById('scholarships-error');
  const loadMoreWrap = document.getElementById('load-more-wrap');

  if (!append) {
    showSkeletons();
    loadMoreOffset = 0;
  } else {
    const btn = document.getElementById('load-more-btn');
    if (btn) { btn.textContent = '⏳ Loading...'; btn.disabled = true; }
  }

  try {
    const prompt = buildPrompt(currentSearchQuery, currentLevel, currentState, loadMoreOffset);

    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) throw new Error('API error ' + response.status);

    const data = await response.json();
    const scholarships = data.scholarships;

    if (!Array.isArray(scholarships)) throw new Error('Invalid response format');

    if (!append) {
      if (grid) grid.innerHTML = scholarships.map(renderScholarshipCard).join('');
    } else {
      if (grid) grid.insertAdjacentHTML('beforeend', scholarships.map(renderScholarshipCard).join(''));
    }

    loadMoreOffset += 6;
    if (loadMoreWrap) loadMoreWrap.style.display = 'block';
    const btn = document.getElementById('load-more-btn');
    if (btn) { btn.textContent = 'Load More Scholarships ↓'; btn.disabled = false; }
    if (errorEl) errorEl.style.display = 'none';

  } catch (err) {
    console.error('Scholarship load error:', err);
    if (!append) {
      if (grid) grid.innerHTML = '';
      if (errorEl) errorEl.style.display = 'block';
    } else {
      const btn = document.getElementById('load-more-btn');
      if (btn) { btn.textContent = 'Load More Scholarships ↓'; btn.disabled = false; }
      showToast('⚠️ Could not load more. Try again.');
    }
  }

  isLoading = false;
}

function loadMoreScholarships() { loadScholarships(true); }

// ── TUTOR LOADING ─────────────────────────────────────────────────────────────
const TUTOR_AVATARS = ['👩🏾‍🏫','👨🏽‍💻','👩🏿‍🔬','👨🏾‍🎓','👩🏽‍💼','👨🏿‍🏫','👩🏻‍🏫','👨🏾‍🔬','👩🏽‍💻','👨🏻‍🎓'];
const TUTOR_AVATAR_BKGS = ['#EFF6FF','#F0FDF4','#FFF7ED','#FDF4FF','#ECFDF5','#EFF6FF','#FFFBEB','#F0FDF4','#F5F3FF','#FEF2F2'];
let tutorOffset = 0;
let tutorLoading = false;

function buildTutorPrompt(query, level, state, offset) {
  const focus = query ? `specializing in "${query}"` : 'across various subjects';
  const levelFilter = level ? `teaching ${level} students` : 'for all academic levels';
  const stateFilter = state ? `based in or serving ${state}` : 'across Nigeria';
  const variety = offset > 0 ? `Show different tutors from the previous batch. Start from entry ${offset + 1}.` : '';

  return `You are a Nigerian tutor database. Generate exactly 6 realistic verified Nigerian tutors ${focus}, ${levelFilter}, ${stateFilter}. ${variety}

Return ONLY a valid JSON array with no markdown, no explanation, no backticks. Each object must have:
- name (string): Full Nigerian name
- subject (string): Subject(s) they teach e.g. "Mathematics & Further Maths"
- bio (string): 1-2 sentence background (max 20 words)
- rating (number): Between 4.5 and 5.0 (one decimal)
- reviews (number): Between 40 and 250
- price (string): Hourly rate in ₦ e.g. "₦3,500/hr"
- tags (array of 3 strings): Exam/level tags e.g. ["WAEC","JAMB","100L"]
- state (string): Nigerian state or "Online Nationwide"

Return only the JSON array. Example format:
[{"name":"...","subject":"...","bio":"...","rating":4.8,"reviews":95,"price":"₦3,500/hr","tags":["WAEC","JAMB"],"state":"Lagos"}]`;
}

function renderTutorCard(t, index) {
  const avatar = TUTOR_AVATARS[index % TUTOR_AVATARS.length];
  const bg = TUTOR_AVATAR_BKGS[index % TUTOR_AVATAR_BKGS.length];
  const stars = Math.round(t.rating);
  const starsHtml = Array(5).fill(0).map((_, i) =>
    `<span class="${i < stars ? 'star-filled' : 'star-empty'}">★</span>`
  ).join('');
  const tagsHtml = (t.tags || []).map(tag => `<span class="tutor-tag">${tag}</span>`).join('');
  return `
    <div class="tutor-card" style="animation:fadeUp 0.4s ease both;">
      <div class="tutor-header">
        <div class="tutor-avatar" style="background:${bg};">${avatar}</div>
        <div class="tutor-header-info">
          <div class="tutor-name-row">
            <div class="tutor-name">${t.name}</div>
            <span class="verified-badge">✓ Verified</span>
          </div>
          <div class="tutor-subject">${t.subject}</div>
        </div>
      </div>
      <div class="tutor-stars">
        <div class="stars-display">${starsHtml}</div>
        <span class="rating-avg">${t.rating}</span>
        <span class="rating-count">(${t.reviews} reviews)</span>
      </div>
      <div class="tutor-bio">${t.bio}</div>
      <div class="tutor-meta">
        <span class="tutor-rating">📍 ${t.state || 'Nationwide'}</span>
        <span class="tutor-price">${t.price}</span>
      </div>
      <div class="tutor-tags">${tagsHtml}</div>
      <button class="book-btn" onclick="openModal('book')">Book Session</button>
    </div>`;
}

async function loadTutors(append = false) {
  if (tutorLoading) return;
  tutorLoading = true;

  const grid = document.getElementById('tutors-grid');
  const loadingEl = document.getElementById('tutors-loading');
  const errorEl = document.getElementById('tutors-error');
  const loadMoreWrap = document.getElementById('load-more-tutors-wrap');

  if (!append) {
    if (grid) grid.innerHTML = '';
    if (loadingEl) loadingEl.style.display = 'block';
    if (errorEl) errorEl.style.display = 'none';
    if (loadMoreWrap) loadMoreWrap.style.display = 'none';
    tutorOffset = 0;
  } else {
    const btn = document.getElementById('load-more-tutors-btn');
    if (btn) { btn.textContent = '⏳ Loading...'; btn.disabled = true; }
  }

  try {
    const query = document.getElementById('searchInput')?.value.trim() || '';
    const level = document.getElementById('filterLevel')?.value || '';
    const state = document.getElementById('filterState')?.value || '';
    const prompt = buildTutorPrompt(query, level, state, tutorOffset);

    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) throw new Error('API error ' + response.status);

    const data = await response.json();
    // Worker may return as scholarships key or tutors key or direct array
    let tutors = data.tutors || data.scholarships || data;
    if (!Array.isArray(tutors)) {
      // Try parsing content if it's a raw string
      if (data.content) {
        try { tutors = JSON.parse(data.content.replace(/```json|```/g,'')); }
        catch(e) { throw new Error('Invalid response format'); }
      } else throw new Error('Invalid response format');
    }

    if (loadingEl) loadingEl.style.display = 'none';

    if (!append) {
      if (grid) grid.innerHTML = tutors.map((t, i) => renderTutorCard(t, i)).join('');
    } else {
      if (grid) grid.insertAdjacentHTML('beforeend', tutors.map((t, i) => renderTutorCard(t, tutorOffset + i)).join(''));
    }

    tutorOffset += 6;
    if (loadMoreWrap) loadMoreWrap.style.display = 'block';
    const btn = document.getElementById('load-more-tutors-btn');
    if (btn) { btn.textContent = 'Load More Tutors ↓'; btn.disabled = false; }
    if (errorEl) errorEl.style.display = 'none';

  } catch (err) {
    console.error('Tutor load error:', err);
    if (loadingEl) loadingEl.style.display = 'none';
    if (!append) {
      if (errorEl) errorEl.style.display = 'block';
    } else {
      showToast('⚠️ Could not load more tutors. Try again.');
      const btn = document.getElementById('load-more-tutors-btn');
      if (btn) { btn.textContent = 'Load More Tutors ↓'; btn.disabled = false; }
    }
    // Fallback: show static tutors if API fails
    if (!append && grid && grid.children.length === 0) renderFallbackTutors();
  }
  tutorLoading = false;
}

function loadMoreTutors() { loadTutors(true); }

function renderFallbackTutors() {
  const fallback = [
    {name:'Adaeze Chukwu',subject:'Mathematics & Further Maths',bio:'University of Lagos graduate. Helped 200+ students ace WAEC and JAMB maths.',rating:4.9,reviews:147,price:'₦3,500/hr',tags:['WAEC','JAMB','A-Level'],state:'Lagos'},
    {name:'Emeka Okonkwo',subject:'Physics & Computer Science',bio:'MSc Physics, OAU. Specializes in JAMB prep and university-level physics.',rating:4.8,reviews:93,price:'₦4,000/hr',tags:['JAMB','NECO','100L'],state:'Abuja'},
    {name:'Fatima Bello',subject:'Chemistry & Biology',bio:'Medical student at UNILAG. Passionate about making sciences easy for students.',rating:4.9,reviews:201,price:'₦3,000/hr',tags:['WAEC','Med Prep','JAMB'],state:'Lagos'},
    {name:'Tunde Adeyemi',subject:'English Language & Literature',bio:'English graduate, UI. Expert in comprehension, essay writing, and oral English.',rating:4.7,reviews:78,price:'₦2,500/hr',tags:['WAEC','IELTS','Essay'],state:'Online Nationwide'},
    {name:'Ngozi Eze',subject:'Economics & Commerce',bio:'BSc Economics, UNILAG. Helps SS1-SS3 and 100L students master economics.',rating:4.8,reviews:112,price:'₦3,200/hr',tags:['WAEC','POST-UTME','100L'],state:'Lagos'},
    {name:'Ibrahim Musa',subject:'Mathematics & Statistics',bio:'Statistics lecturer, ABU Zaria. Specializes in 200-400 level statistics.',rating:5.0,reviews:56,price:'₦5,000/hr',tags:['University','Statistics','Data'],state:'Zaria'},
  ];
  const grid = document.getElementById('tutors-grid');
  if (grid) grid.innerHTML = fallback.map((t,i) => renderTutorCard(t,i)).join('');
  const wrap = document.getElementById('load-more-tutors-wrap');
  if (wrap) wrap.style.display = 'block';
}

// Debounced search
let searchDebounce;
function handleSearch() {
  clearTimeout(searchDebounce);

  const activeTab = document.querySelector('.tab-btn.active');
  const isScholarshipsTab = !activeTab || activeTab.textContent.includes('Scholarship');

  if (isScholarshipsTab) {
    searchDebounce = setTimeout(() => {
      currentSearchQuery = document.getElementById('searchInput')?.value.trim() || '';
      currentLevel = document.getElementById('filterLevel')?.value || '';
      currentState = document.getElementById('filterState')?.value || '';
      loadMoreOffset = 0;
      loadScholarships();
    }, 700);
  } else {
    const query = (document.getElementById('searchInput')?.value || '').toLowerCase();
    // Filter visible tutor cards client-side first
    document.querySelectorAll('.tutor-card').forEach(card => {
      const text = card.innerText.toLowerCase();
      card.style.display = (!query || text.includes(query)) ? '' : 'none';
    });
    // Debounce API reload
    searchDebounce = setTimeout(() => {
      tutorOffset = 0;
      loadTutors();
    }, 800);
  }
}

function applyFilters() {
  currentSearchQuery = document.getElementById('searchInput')?.value.trim() || '';
  currentLevel = document.getElementById('filterLevel')?.value || '';
  currentState = document.getElementById('filterState')?.value || '';
  loadMoreOffset = 0;
  tutorOffset = 0;

  const activeTab = document.querySelector('.tab-btn.active');
  if (activeTab && activeTab.textContent.includes('Tutor')) {
    loadTutors();
  } else {
    loadScholarships();
  }
}

// ── TABS ─────────────────────────────────────────────────────────────────────
function switchTab(tab, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.add('active');
  if (btn) btn.classList.add('active');
  // Load tutors on first visit to tutors tab
  if (tab === 'tutors') {
    const grid = document.getElementById('tutors-grid');
    if (grid && grid.children.length === 0) loadTutors();
  }
}

// ── MOBILE MENU ──────────────────────────────────────────────────────────────
function toggleMobileMenu() {
  document.getElementById('mobile-menu')?.classList.toggle('open');
}

// ── MODAL SYSTEM ─────────────────────────────────────────────────────────────
function openModal(type) {
  const overlay = document.getElementById('modal');
  const content = document.getElementById('modal-content');
  if (!overlay || !content) return;

  content.classList.remove('tracker-modal');
  let html = '<button class="modal-close" onclick="closeModal()">✕</button>';

  if (type === 'signup') {
    html += `
      <h3>Join LetLearn Free 🎓</h3>
      <p>Create your account and start exploring scholarships and tutors today.</p>
      <button class="google-btn" onclick="signInWithGoogle()">
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google"/>
        Continue with Google
      </button>
      <div class="or-divider">or</div>
      <div class="form-group"><label>Full Name</label><input id="su-name" type="text" placeholder="e.g. Chisom Okafor"/></div>
      <div class="form-group"><label>Email Address</label><input id="su-email" type="email" placeholder="yourname@email.com"/></div>
      <div class="form-group"><label>Password</label><input id="su-password" type="password" placeholder="Min 8 characters"/></div>
      <div class="form-group"><label>State</label><select id="su-state">
        <option value="">Select your state</option>
        <option>Abia</option><option>Adamawa</option><option>Akwa Ibom</option><option>Anambra</option>
        <option>Bauchi</option><option>Bayelsa</option><option>Benue</option><option>Borno</option>
        <option>Cross River</option><option>Delta</option><option>Ebonyi</option><option>Edo</option>
        <option>Ekiti</option><option>Enugu</option><option>FCT (Abuja)</option><option>Gombe</option>
        <option>Imo</option><option>Jigawa</option><option>Kaduna</option><option>Kano</option>
        <option>Katsina</option><option>Kebbi</option><option>Kogi</option><option>Kwara</option>
        <option>Lagos</option><option>Nasarawa</option><option>Niger</option><option>Ogun</option>
        <option>Ondo</option><option>Osun</option><option>Oyo</option><option>Plateau</option>
        <option>Rivers</option><option>Sokoto</option><option>Taraba</option><option>Yobe</option><option>Zamfara</option>
      </select></div>
      <div class="form-group"><label>I am a...</label><select id="su-role">
        <option>Student (Secondary)</option><option>Student (University)</option>
        <option>Graduate</option><option>Tutor</option>
      </select></div>
      <button class="modal-submit" onclick="handleSignUp()">Create Free Account 🚀</button>
      <p style="text-align:center;margin-top:1rem;">Already have an account? <a href="#" style="color:var(--blue-mid);font-weight:700;" onclick="openModal('login')">Sign in</a></p>`;

  } else if (type === 'login') {
    html += `
      <h3>Welcome Back 👋</h3>
      <p>Sign in to your LetLearn account.</p>
      <button class="google-btn" onclick="signInWithGoogle()">
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google"/>
        Continue with Google
      </button>
      <div class="or-divider">or</div>
      <div class="form-group"><label>Email Address</label><input id="li-email" type="email" placeholder="yourname@email.com"/></div>
      <div class="form-group"><label>Password</label><input id="li-password" type="password" placeholder="Your password"/></div>
      <button class="modal-submit" onclick="handleLogin()">Sign In →</button>
      <p style="text-align:center;margin-top:1rem;">New here? <a href="#" style="color:var(--blue-mid);font-weight:700;" onclick="openModal('signup')">Create free account</a></p>`;

  } else if (type === 'apply') {
    html += `
      <h3>Apply for Scholarship 📋</h3>
      <p>Fill in your details and we'll redirect you to the official application page.</p>
      <div class="form-group"><label>Full Name</label><input type="text" placeholder="Your full name"/></div>
      <div class="form-group"><label>Email Address</label><input type="email" placeholder="yourname@email.com"/></div>
      <div class="form-group"><label>Current Level</label><select><option>SS1/SS2/SS3</option><option>100 Level</option><option>200 Level</option><option>300 Level</option><option>400 Level</option><option>Postgraduate</option></select></div>
      <div class="form-group"><label>Course of Study</label><input type="text" placeholder="e.g. Computer Science"/></div>
      <button class="modal-submit" onclick="showToast('✅ Application submitted! Check your email.')">Submit Application</button>`;

  } else if (type === 'book') {
    html += `
      <h3>Book a Tutor Session 📅</h3>
      <p>Schedule a session and get confirmation within minutes.</p>
      <div class="form-group"><label>Your Name</label><input type="text" placeholder="Your full name"/></div>
      <div class="form-group"><label>Phone Number</label><input type="tel" placeholder="e.g. 0801 234 5678"/></div>
      <div class="form-group"><label>Subject</label><input type="text" placeholder="e.g. Mathematics"/></div>
      <div class="form-group"><label>Preferred Date</label><input type="date"/></div>
      <div class="form-group"><label>Session Type</label><select><option>Online (Google Meet)</option><option>In-person (Lagos)</option><option>In-person (Abuja)</option></select></div>
      <button class="modal-submit" onclick="showToast('📅 Session booked! The tutor will contact you shortly.')">Confirm Booking</button>`;

  } else if (type === 'contact') {
    html += `
      <h3>Contact LetLearn 📬</h3>
      <p>We're here to help! Reach out via any channel below.</p>
      <a class="contact-link" href="tel:09042427548">
        <div class="contact-item"><div class="contact-icon">📞</div><div><div class="contact-label">Call Us</div><div class="contact-value">09042427548</div></div></div>
      </a>
      <a class="contact-link" href="mailto:adelakunabdulsalam@gmail.com">
        <div class="contact-item"><div class="contact-icon">✉️</div><div><div class="contact-label">Email Us</div><div class="contact-value">adelakunabdulsalam@gmail.com</div></div></div>
      </a>
      <div class="contact-item"><div class="contact-icon">🕐</div><div><div class="contact-label">Response Time</div><div class="contact-value">Within 24 hours</div></div></div>
      <button class="wa-btn" onclick="window.open('https://wa.me/2349042427548?text=Hello%20LetLearn%20Team','_blank')">💬 Chat on WhatsApp</button>`;

  } else if (type === 'terms') {
    html += `<h3>Terms & Conditions 📄</h3><div class="legal-date">Last updated: April 2026 · LetLearn Team</div>
      <div class="legal-body">
        <div class="legal-section"><h4>1. Acceptance of Terms</h4><p>By accessing or using LetLearn, you agree to be bound by these Terms. If you do not agree, please do not use the platform.</p></div>
        <div class="legal-section"><h4>2. Eligibility</h4><p>LetLearn is intended for students and educators in Nigeria. You must be at least 13 years old to create an account.</p></div>
        <div class="legal-section"><h4>3. User Accounts</h4><p>You are responsible for maintaining the confidentiality of your account credentials and all activity under your account.</p></div>
        <div class="legal-section"><h4>4. Scholarship Listings</h4><p>Scholarship information is provided for informational purposes only. Verify all details directly with the awarding body.</p></div>
        <div class="legal-section"><h4>5. Tutor Services</h4><p>Tutors are independent contractors, not employees of LetLearn. All session agreements are between the student and tutor.</p></div>
        <div class="legal-section"><h4>6. Payments</h4><p>Tutor session fees are agreed between students and tutors. LetLearn may charge a platform service fee on bookings.</p></div>
        <div class="legal-section"><h4>7. Prohibited Conduct</h4><p>Users must not post false information, harass others, share copyrighted materials without permission, or compromise platform security.</p></div>
        <div class="legal-section"><h4>8. Contact</h4><p>For questions, contact adelakunabdulsalam@gmail.com or call 09042427548.</p></div>
      </div>
      <button class="modal-submit" onclick="closeModal()">I Understand & Accept ✓</button>`;

  } else if (type === 'privacy') {
    html += `<h3>Privacy Policy 🔒</h3><div class="legal-date">Last updated: April 2026 · LetLearn Team</div>
      <div class="legal-body">
        <div class="legal-section"><h4>1. Information We Collect</h4><p>We collect your name, email, state of residence, and academic level when you register, plus usage data to improve our platform.</p></div>
        <div class="legal-section"><h4>2. How We Use Your Information</h4><p>To personalise scholarship and tutor recommendations, send deadline alerts, and improve our services. We do not sell your data.</p></div>
        <div class="legal-section"><h4>3. Data Security</h4><p>We use HTTPS, secure password storage, and regular security audits. No internet transmission is 100% secure.</p></div>
        <div class="legal-section"><h4>4. Your Rights</h4><p>You have the right to access, correct, or delete your data. Contact adelakunabdulsalam@gmail.com to exercise your rights.</p></div>
        <div class="legal-section"><h4>5. Contact Us</h4><p>Privacy concerns: adelakunabdulsalam@gmail.com | WhatsApp: 09042427548</p></div>
      </div>
      <button class="modal-submit" onclick="closeModal()">Got It ✓</button>`;

  } else if (type === 'matching') {
    content.classList.add('tracker-modal');
    html += `<h3>🔔 Automated Matching</h3>
      <p>Set your preferences and we'll notify you when a matching scholarship drops.</p>
      <div class="notif-pref"><div><div class="notif-label">📧 Email Alerts</div><div class="notif-sub">Get notified by email for new matches</div></div><div class="toggle-switch on" onclick="this.classList.toggle('on')"></div></div>
      <div class="notif-pref"><div><div class="notif-label">💬 WhatsApp Alerts</div><div class="notif-sub">Instant WhatsApp notifications</div></div><div class="toggle-switch on" onclick="this.classList.toggle('on')"></div></div>
      <div class="notif-pref"><div><div class="notif-label">⏰ Deadline Reminders</div><div class="notif-sub">7-day and 1-day deadline warnings</div></div><div class="toggle-switch on" onclick="this.classList.toggle('on')"></div></div>
      <div class="notif-pref"><div><div class="notif-label">🆕 New Listings Only</div><div class="notif-sub">Only alert for newly posted scholarships</div></div><div class="toggle-switch" onclick="this.classList.toggle('on')"></div></div>
      <div class="form-group" style="margin-top:1rem;"><label>WhatsApp Number</label><input type="tel" placeholder="e.g. 0801 234 5678"/></div>
      <button class="modal-submit" onclick="showToast('✅ Alert preferences saved!')">Save Preferences</button>`;

  } else if (type === 'tracker') {
    content.classList.add('tracker-modal');
    html += `<h3>📋 My Application Tracker</h3>
      <div class="tracker-tabs">
        <button class="tracker-tab active" onclick="switchTrackerTab('saved',this)">Saved (3)</button>
        <button class="tracker-tab" onclick="switchTrackerTab('applied',this)">Applied (2)</button>
        <button class="tracker-tab" onclick="switchTrackerTab('deadline',this)">Deadlines</button>
      </div>
      <div id="tracker-saved">
        <div class="tracker-item"><div class="tracker-item-icon">🏢</div><div class="tracker-item-info"><div class="tracker-item-title">MTN Foundation Scholarship</div><div class="tracker-item-sub">Deadline: Jul 30, 2026 · ₦500,000</div></div><span class="tracker-status status-saved">Saved</span></div>
        <div class="tracker-item"><div class="tracker-item-icon">🌍</div><div class="tracker-item-info"><div class="tracker-item-title">Dangote Education Trust Fund</div><div class="tracker-item-sub">Deadline: Aug 15, 2026 · Full Tuition</div></div><span class="tracker-status status-saved">Saved</span></div>
        <div class="tracker-item"><div class="tracker-item-icon">🏛️</div><div class="tracker-item-info"><div class="tracker-item-title">NNPC/SNEPCo National Merit Award</div><div class="tracker-item-sub">Deadline: Sep 1, 2026 · ₦350,000</div></div><span class="tracker-status status-deadline">Closing Soon</span></div>
      </div>
      <div id="tracker-applied" style="display:none;">
        <div class="tracker-item"><div class="tracker-item-icon">🎓</div><div class="tracker-item-info"><div class="tracker-item-title">Total Energies Scholarship</div><div class="tracker-item-sub">Applied May 3, 2026 · Awaiting result</div></div><span class="tracker-status status-applied">Applied ✓</span></div>
        <div class="tracker-item"><div class="tracker-item-icon">💡</div><div class="tracker-item-info"><div class="tracker-item-title">AGBAMI Medical Excellence Award</div><div class="tracker-item-sub">Applied Apr 20, 2026 · Under review</div></div><span class="tracker-status status-applied">Applied ✓</span></div>
      </div>
      <div id="tracker-deadline" style="display:none;">
        <div class="tracker-item"><div class="tracker-item-icon">⏰</div><div class="tracker-item-info"><div class="tracker-item-title">NNPC/SNEPCo National Merit Award</div><div class="tracker-item-sub">⚠️ Closes in 12 days</div></div><span class="tracker-status status-deadline">12 days</span></div>
        <div class="tracker-item"><div class="tracker-item-icon">📅</div><div class="tracker-item-info"><div class="tracker-item-title">MTN Foundation Scholarship</div><div class="tracker-item-sub">Closes in 30 days</div></div><span class="tracker-status status-saved">30 days</span></div>
      </div>
      <button class="modal-submit" style="margin-top:1rem;" onclick="showToast('📋 Dashboard saved! Sign up to access it anytime.')">Save My Dashboard</button>`;

  } else if (type === 'smartmatch') {
    content.classList.add('tracker-modal');
    html += `<h3>🎯 Smart Match Setup</h3>
      <p>Tell us about yourself and we'll push the best scholarships directly to you.</p>
      <div class="form-group"><label>State of Origin</label><select><option value="">Select your state</option><option>Lagos</option><option>Abuja (FCT)</option><option>Rivers</option><option>Ogun</option><option>Kano</option><option>Anambra</option><option>Delta</option><option>Oyo</option><option>Edo</option><option>Other</option></select></div>
      <div class="form-group"><label>Academic Level</label><select><option>SS1/SS2/SS3</option><option>100 Level</option><option>200 Level</option><option>300 Level</option><option>400 Level</option><option>Postgraduate</option></select></div>
      <div class="form-group"><label>Course of Study</label><input type="text" placeholder="e.g. Computer Science, Medicine, Law"/></div>
      <div class="form-group"><label>Current CGPA (optional)</label><select><option value="">Prefer not to say</option><option>4.5–5.0 (First Class)</option><option>3.5–4.4 (2:1)</option><option>2.5–3.4 (2:2)</option><option>Below 2.5</option></select></div>
      <div class="form-group"><label>Preferred Notification</label><select><option>Email only</option><option>WhatsApp only</option><option>Email + WhatsApp</option></select></div>
      <button class="modal-submit" onclick="showToast('🎯 Smart matching activated! You will receive your first matches within 24 hours.')">Activate Smart Matching</button>`;

  } else if (type === 'essay') {
    content.classList.add('tracker-modal');
    html += `<h3>✍️ AI Essay Assistant</h3>
      <p>Get a structured outline for your scholarship essay.</p>
      <div class="form-group"><label>Essay topic or prompt</label><input type="text" id="essayPrompt" placeholder="e.g. Describe how you will use this scholarship to serve your community"/></div>
      <div class="form-group"><label>Your course & career goal (brief)</label><input type="text" id="essayGoal" placeholder="e.g. Engineering student, want to build infrastructure in Nigeria"/></div>
      <button class="feature-btn purple" style="width:100%;justify-content:center;padding:0.75rem;" onclick="generateEssayOutline()">✨ Generate My Essay Outline</button>
      <div class="essay-ai-output" id="essayOutput">
        <div class="essay-ai-label">🤖 AI-Generated Outline (for guidance only)</div>
        <div class="essay-ai-text" id="essayOutputText"></div>
      </div>
      <div class="essay-warning" style="margin-top:1rem;">
        <div class="essay-warning-icon">💡</div>
        <div class="essay-warning-text"><strong>Important:</strong> Use this outline as a structure only. Rewrite each section in your own voice — scholarship boards now use AI detectors.</div>
      </div>`;

  } else if (type === 'account') {
    html += `
      <h3>My Account 👤</h3>
      <p>Manage your LetLearn profile and preferences.</p>
      <div style="background:var(--gray-soft);border-radius:14px;padding:1.2rem;margin-bottom:1rem;text-align:center;">
        <div style="width:60px;height:60px;border-radius:50%;background:var(--blue-mid);color:white;display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:800;margin:0 auto 0.6rem;">A</div>
        <div style="font-weight:800;font-size:1rem;color:var(--blue-deep);">My Profile</div>
        <div style="font-size:0.82rem;color:var(--gray-text);">LetLearn Member</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:0.5rem;margin-bottom:1rem;">
        <button class="modal-submit" style="background:var(--gray-soft);color:var(--blue-deep);border:1.5px solid var(--gray-border);" onclick="openModal('tracker')">📋 My Application Tracker</button>
        <button class="modal-submit" style="background:var(--gray-soft);color:var(--blue-deep);border:1.5px solid var(--gray-border);" onclick="openModal('matching')">🔔 My Alert Preferences</button>
        <button class="modal-submit" style="background:var(--gray-soft);color:var(--blue-deep);border:1.5px solid var(--gray-border);" onclick="openModal('smartmatch')">🎯 Smart Match Settings</button>
      </div>
      <button class="modal-submit" style="background:#FEF2F2;color:#DC2626;border:1.5px solid #FECACA;" onclick="signOut();closeModal();">Sign Out</button>`;
  }

  content.innerHTML = html;
  overlay.classList.add('open');
}

function closeModal() {
  document.getElementById('modal')?.classList.remove('open');
}

// ── SIGNUP / LOGIN HANDLERS ───────────────────────────────────────────────────
async function handleSignUp() {
  const name = document.getElementById('su-name')?.value.trim();
  const email = document.getElementById('su-email')?.value.trim();
  const password = document.getElementById('su-password')?.value;
  const state = document.getElementById('su-state')?.value;
  const role = document.getElementById('su-role')?.value;

  if (!name || !email || !password) { showToast('⚠️ Please fill in all required fields'); return; }
  if (password.length < 8) { showToast('⚠️ Password must be at least 8 characters'); return; }

  const submitBtn = document.querySelector('.modal-submit');
  if (submitBtn) { submitBtn.textContent = '⏳ Creating account...'; submitBtn.disabled = true; }

  const { data, error } = await signUpWithEmail(name, email, password, state, role);

  if (error) {
    showToast('⚠️ ' + error.message);
    if (submitBtn) { submitBtn.textContent = 'Create Free Account 🚀'; submitBtn.disabled = false; }
  } else {
    closeModal();
    showToast('🎉 Welcome to LetLearn! Check your email to verify.');
  }
}

async function handleLogin() {
  const email = document.getElementById('li-email')?.value.trim();
  const password = document.getElementById('li-password')?.value;
  if (!email || !password) { showToast('⚠️ Please enter email and password'); return; }

  const submitBtn = document.querySelector('.modal-submit');
  if (submitBtn) { submitBtn.textContent = '⏳ Signing in...'; submitBtn.disabled = true; }

  const { error } = await signInWithEmail(email, password);

  if (error) {
    showToast('⚠️ ' + error.message);
    if (submitBtn) { submitBtn.textContent = 'Sign In →'; submitBtn.disabled = false; }
  } else {
    closeModal();
    showToast('✅ Signed in successfully!');
  }
}

// ── CTA EMAIL ────────────────────────────────────────────────────────────────
function handleCTASubmit() {
  const email = document.getElementById('ctaEmail')?.value;
  if (email) showToast('🎉 You\'re on the list! Welcome to LetLearn.');
  else showToast('⚠️ Please enter a valid email.');
}

// ── TRACKER TABS ─────────────────────────────────────────────────────────────
function switchTrackerTab(tab, btn) {
  ['saved','applied','deadline'].forEach(t => {
    const el = document.getElementById('tracker-' + t);
    if (el) el.style.display = 'none';
  });
  document.querySelectorAll('.tracker-tab').forEach(b => b.classList.remove('active'));
  const target = document.getElementById('tracker-' + tab);
  if (target) target.style.display = 'block';
  if (btn) btn.classList.add('active');
}

// ── AI ESSAY OUTLINE ─────────────────────────────────────────────────────────
async function generateEssayOutline() {
  const prompt = document.getElementById('essayPrompt')?.value;
  const goal = document.getElementById('essayGoal')?.value;
  if (!prompt) { showToast('⚠️ Please enter your essay prompt first'); return; }

  const btn = document.querySelector('.feature-btn.purple');
  if (btn) { btn.textContent = '⏳ Generating outline...'; btn.disabled = true; }

  const outline = `
<strong>Essay Outline for: "${prompt}"</strong><br/><br/>
<strong>1. Opening Hook (1–2 sentences)</strong><br/>
Start with a brief personal story or bold statement that captures why this scholarship matters to you.<br/><br/>
<strong>2. Your Background (2–3 sentences)</strong><br/>
Introduce yourself — your name, course, level, and where you're from. Connect it to the scholarship's goals.<br/><br/>
<strong>3. The Problem You See (2–3 sentences)</strong><br/>
Describe a real challenge you've witnessed in your community or field that your career goal addresses.<br/><br/>
<strong>4. How This Scholarship Helps (3–4 sentences)</strong><br/>
Explain concretely what you will do with the funds. Tie it to your goal: <em>${goal || 'your stated career goal'}</em>.<br/><br/>
<strong>5. Your Impact Promise (2–3 sentences)</strong><br/>
End with what you commit to giving back — to your community, Nigeria, or your field.<br/><br/>
<strong>6. Closing Line</strong><br/>
One confident sentence summarising why you are the right candidate.
  `;

  const output = document.getElementById('essayOutput');
  const outputText = document.getElementById('essayOutputText');
  if (output && outputText) { outputText.innerHTML = outline; output.classList.add('show'); }
  if (btn) { btn.textContent = '✨ Regenerate Outline'; btn.disabled = false; }
  showToast('✅ Essay outline ready! Remember to rewrite in your own words.');
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

// ── SMART MATCH NOTIFICATION ──────────────────────────────────────────────────
function initMatchNotification() {
  setTimeout(() => {
    const notif = document.getElementById('matchNotif');
    if (notif) { notif.classList.add('show'); setTimeout(() => notif.classList.remove('show'), 7000); }
  }, 5000);
}

// ── INIT ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Close modal on overlay click
  document.getElementById('modal')?.addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });

  // Init Supabase
  initSupabase();

  // Load scholarships
  loadScholarships();

  // Smart match notification
  initMatchNotification();
});
