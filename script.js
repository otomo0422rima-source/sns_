const LEVELS = [
  { id:'3', name:'英検3級', desc:'中学卒業レベル', icon:'📗', color:'#10B981', bg:'rgba(16,185,129,0.15)', border:'rgba(16,185,129,0.3)' },
  { id:'p2', name:'英検準2級', desc:'高校中級レベル', icon:'📘', color:'#3B82F6', bg:'rgba(59,130,246,0.15)', border:'rgba(59,130,246,0.3)' },
  { id:'2', name:'英検2級', desc:'高校卒業レベル', icon:'📙', color:'#F59E0B', bg:'rgba(245,158,11,0.15)', border:'rgba(245,158,11,0.3)', highlight:true },
  { id:'p1', name:'英検準1級', desc:'大学中級レベル', icon:'📕', color:'#EF4444', bg:'rgba(239,68,68,0.15)', border:'rgba(239,68,68,0.3)' },
  { id:'1', name:'英検1級', desc:'大学上級・プロレベル', icon:'👑', color:'#A78BFA', bg:'rgba(167,139,250,0.15)', border:'rgba(167,139,250,0.3)' },
];

// ── Google Analytics イベント送信用の安全なラッパー ──
// gtag未定義（広告ブロッカー・GA未設定時など）でもエラーにならないようガードする
function trackEvent(name, params = {}) {
  if (typeof gtag === 'function') {
    gtag('event', name, params);
  }
}

// ── 問題データはPython製ジェネレータ(data.js)から動的に組み立てる ──
// VOCAB_POOL / GRAMMAR_TEMPLATES / IDIOM_POOL は data.js で定義されている

const GRAMMAR_RATIO = { '3': 0.45, 'p2': 0.4, '2': 0.4, 'p1': 0.3, '1': 0.3 };
const VOCAB_PHRASINGS = [
  '"{w}" の意味は？',
  '次の英語に合う日本語を選べ：{w}',
  'What does "{w}" mean?',
  '"{w}" に最も近い意味は？',
];

function pickN(arr, n) {
  const picked = [];
  let source = shuffle([...arr]);
  let i = 0;
  while (picked.length < n && arr.length > 0) {
    if (i >= source.length) { source = shuffle([...arr]); i = 0; }
    picked.push(source[i++]);
  }
  return picked;
}

function buildGrammarQuestions(levelId, n) {
  if (n <= 0) return [];
  const templates = GRAMMAR_TEMPLATES[levelId] || [];
  const all = [];
  templates.forEach(t => t.variants.forEach(v => all.push({ t, v })));
  return pickN(all, n).map(({ t, v }) => {
    const options = shuffle([t.ans, ...t.distractors]);
    const ansIdx = options.indexOf(t.ans);
    return { type: '文法', q: v.text, choices: options, ans: ansIdx, explain: t.explain, jp: v.jp };
  });
}

function buildVocabQuestions(levelId, n) {
  if (n <= 0) return [];
  const pool = VOCAB_POOL[levelId] || [];
  return pickN(pool, n).map(item => {
    const phrasing = VOCAB_PHRASINGS[Math.floor(Math.random() * VOCAB_PHRASINGS.length)];
    const qText = phrasing.replace('{w}', item.w);
    const others = pool.filter(p => p.jp !== item.jp);
    const distractors = shuffle([...others]).slice(0, 3).map(p => p.jp);
    const options = shuffle([item.jp, ...distractors]);
    const ansIdx = options.indexOf(item.jp);
    return { type: '単語', q: qText, choices: options, ans: ansIdx, explain: `"${item.w}" は「${item.jp}」という意味です。` };
  });
}

function buildIdiomQuestions(levelId, n) {
  const pool = IDIOM_POOL[levelId] || [];
  if (n <= 0 || pool.length === 0) return [];
  return pickN(pool, n).map(item => ({
    type: '熟語', q: item.q, choices: [...item.choices], ans: item.ans, explain: item.explain,
  }));
}

function buildQuestionSet(levelId, count) {
  const grammarRatio = GRAMMAR_RATIO[levelId] ?? 0.4;
  const grammarCount = Math.min(count, Math.round(count * grammarRatio));
  const idiomPool = IDIOM_POOL[levelId] || [];
  let idiomCount = 0;
  if (idiomPool.length > 0) {
    idiomCount = Math.min(count - grammarCount, Math.max(1, Math.round((count - grammarCount) * 0.2)));
  }
  const vocabCount = count - grammarCount - idiomCount;

  const qs = [
    ...buildGrammarQuestions(levelId, grammarCount),
    ...buildVocabQuestions(levelId, vocabCount),
    ...buildIdiomQuestions(levelId, idiomCount),
  ];
  return shuffle(qs);
}

let currentLevel = null;
let questions = [];
let currentIdx = 0;
let score = 0;
let answered = false;
let startTime = null;
let pendingLevelId = null;
let lastCount = 10;

const COUNT_OPTIONS = [
  { n: 5, desc: 'サクッと1分で診断' },
  { n: 10, desc: 'バランス良く2分で診断', recommend: true },
  { n: 20, desc: '全問でしっかり本格診断' },
];

function buildLevelGrid() {
  const grid = document.getElementById('levelGrid');
  grid.innerHTML = '';
  LEVELS.forEach(lv => {
    const div = document.createElement('div');
    div.className = 'level-btn' + (lv.highlight ? ' highlight' : '');
    div.style.cssText = lv.highlight ? `border-color: ${lv.border}; background: ${lv.bg};` : '';
    div.innerHTML = `
      <div class="level-left">
        <div class="level-icon" style="background:${lv.bg}">${lv.icon}</div>
        <div>
          <div class="level-name">${lv.name}</div>
        </div>
      </div>
      <div class="level-arrow"></div>`;
    div.onclick = () => openCountSelect(lv.id);
    grid.appendChild(div);
  });
}

function openCountSelect(levelId) {
  pendingLevelId = levelId;
  const lv = LEVELS.find(l => l.id === levelId);
  document.getElementById('countSelectLevelName').textContent = lv.name;
  buildCountGrid();
  showScreen('countSelect');
  trackEvent('select_level', { level_id: levelId, level_name: lv.name });
}

function buildCountGrid() {
  const grid = document.getElementById('countGrid');
  grid.innerHTML = '';
  COUNT_OPTIONS.forEach(opt => {
    const div = document.createElement('div');
    div.className = 'count-btn' + (opt.recommend ? ' recommend' : '');
    div.innerHTML = `
      <div class="count-left">
        <div class="count-num-row">
          <span class="count-num">${opt.n}問</span>
          ${opt.recommend ? '<span class="count-badge">おすすめ</span>' : ''}
        </div>
        <div class="count-desc">${opt.desc}</div>
      </div>
      <div class="count-arrow"></div>`;
    div.onclick = () => startQuiz(pendingLevelId, opt.n);
    grid.appendChild(div);
  });
}

function startQuiz(levelId, count = 10) {
  currentLevel = LEVELS.find(l => l.id === levelId);
  questions = buildQuestionSet(levelId, count);
  lastCount = count;
  currentIdx = 0; score = 0; answered = false;
  startTime = Date.now();
  showScreen('quiz');
  renderQuestion();
  trackEvent('start_quiz', { level_id: levelId, level_name: currentLevel.name, question_count: count });
}

function renderQuestion() {
  const q = questions[currentIdx];
  const total = questions.length;
  answered = false;

  document.getElementById('progressLabel').textContent = `${currentIdx+1} / ${total}`;
  document.getElementById('remainingBadge').textContent = `あと${total - currentIdx - 1}問`;
  document.getElementById('progressFill').style.width = `${((currentIdx+1)/total)*100}%`;

  const tag = document.getElementById('levelTag');
  tag.textContent = currentLevel.name;
  tag.style.cssText = `background:${currentLevel.bg}; border:1px solid ${currentLevel.border}; color:${currentLevel.color}; border-radius:20px; padding:4px 12px; font-size:11px; font-weight:600;`;

  document.getElementById('questionType').textContent = q.type + '問題';
  document.getElementById('questionText').textContent = q.q;

  const jpRow = document.getElementById('jpHintRow');
  const jpBtn = document.getElementById('jpHintBtn');
  const jpText = document.getElementById('jpHintText');
  if (q.jp) {
    jpRow.classList.remove('hidden');
    document.getElementById('jpHintBtnLabel').textContent = '🇯🇵 訳を見る';
    jpBtn.classList.remove('open');
    jpText.textContent = q.jp;
    jpText.classList.remove('show');
  } else {
    jpRow.classList.add('hidden');
  }

  const choicesEl = document.getElementById('choices');
  const letters = ['A','B','C','D'];
  choicesEl.innerHTML = '';
  q.choices.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML = `<div class="choice-label">${letters[i]}</div><div class="choice-text">${c}</div>`;
    btn.onclick = () => selectAnswer(i, btn);
    choicesEl.appendChild(btn);
  });

  const panel = document.getElementById('feedbackPanel');
  panel.classList.remove('show','correct','wrong');
}

function toggleJpHint() {
  const jpBtn = document.getElementById('jpHintBtn');
  const jpText = document.getElementById('jpHintText');
  const isOpen = jpText.classList.toggle('show');
  jpBtn.classList.toggle('open', isOpen);
  document.getElementById('jpHintBtnLabel').textContent = isOpen ? '🇯🇵 訳を隠す' : '🇯🇵 訳を見る';
}

function selectAnswer(idx, btn) {
  if (answered) return;
  answered = true;
  const q = questions[currentIdx];
  const all = document.querySelectorAll('.choice-btn');
  all.forEach(b => b.classList.add('locked'));

  const panel = document.getElementById('feedbackPanel');

  if (idx === q.ans) {
    score++;
    btn.classList.add('correct');
    all.forEach((b, i) => { if (i !== idx) b.classList.add('dim'); });
    panel.classList.add('correct');
    document.getElementById('feedbackEmoji').textContent = randomCorrectEmoji();
    document.getElementById('feedbackTitle').textContent = '正解！ Great Job!';
    document.getElementById('feedbackExplain').textContent = q.explain;
    launchConfetti();
  } else {
    btn.classList.add('wrong');
    all[q.ans].classList.add('correct');
    all.forEach((b, i) => { if (i !== idx && i !== q.ans) b.classList.add('dim'); });
    panel.classList.add('wrong');
    document.getElementById('feedbackEmoji').textContent = '💡';
    document.getElementById('feedbackTitle').textContent = '惜しい！ここで覚えよう';
    document.getElementById('feedbackExplain').textContent = q.explain;
  }

  const nextBtn = document.getElementById('nextBtn');
  if (currentIdx + 1 >= questions.length) {
    nextBtn.textContent = '結果を見る 🎉';
    nextBtn.className = 'next-btn end';
  } else {
    nextBtn.innerHTML = '次の問題へ &rarr;';
    nextBtn.className = 'next-btn go';
  }

  setTimeout(() => panel.classList.add('show'), 50);
}

function nextQuestion() {
  currentIdx++;
  if (currentIdx >= questions.length) { showResult(); return; }
  document.getElementById('feedbackPanel').classList.remove('show','correct','wrong');
  setTimeout(renderQuestion, 350);
}

// おすすめ広告データ（スコア帯ごとに設定。ここを自分のアフィリエイトリンクに差し替える）
const AD_RECOMMENDATIONS = [
  {
    min: 90,
    text: 'その実力なら次の級も十分狙えます。ワンランク上の対策で合格をより確実に。',
    linkText: '上位級対策コースを見る',
    url: 'https://example.com/affiliate/advanced' // ←アフィリエイトリンクに変更
  },
  {
    min: 70,
    text: 'あと一歩で上級レベル！苦手分野を集中的に潰せる講座がおすすめです。',
    linkText: 'おすすめ講座をチェック',
    url: 'https://example.com/affiliate/upper-intermediate'
  },
  {
    min: 50,
    text: '基礎は身についています。単語・文法を体系的に固める教材で一気に伸ばしましょう。',
    linkText: '基礎固め教材を見る',
    url: 'https://example.com/affiliate/intermediate'
  },
  {
    min: 0,
    text: '今からでも大丈夫。初心者向けにやさしく解説してくれる講座から始めてみませんか？',
    linkText: '初心者向け講座を見る',
    url: 'https://example.com/affiliate/beginner'
  }
];

function renderAdRecommendation(pct) {
  // A8ネット審査待ちのため広告表示を一時停止中。DOM上に要素がないため何もしない。
  const el = document.getElementById('adText');
  if (!el) return;
  const ad = AD_RECOMMENDATIONS.find(a => pct >= a.min);
  el.textContent = ad.text;
  document.getElementById('adLinkText').textContent = ad.linkText;
  const btn = document.getElementById('adLinkBtn');
  btn.href = ad.url;
}

function showResult() {
  showScreen('result');
  const total = questions.length;
  const pct = Math.round((score / total) * 100);
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  document.getElementById('bkCorrect').textContent = score;
  document.getElementById('bkWrong').textContent = total - score;
  document.getElementById('bkTime').textContent = mins > 0 ? `${mins}:${String(secs).padStart(2,'0')}` : `${secs}s`;

  const ring = document.getElementById('ringFill');
  const circumference = 326.7;
  const diag = getDiagnosis(pct);

  document.getElementById('ringPct').textContent = pct + '%';
  document.getElementById('ringPct').className = 'ring-pct ' + diag.scoreClass;
  document.getElementById('ringOf').textContent = `${score}/${total}`;

  const levelTag = document.getElementById('resultLevelTag');
  levelTag.textContent = currentLevel.name;
  levelTag.style.cssText = `background:${currentLevel.bg}; border:1px solid ${currentLevel.border}; color:${currentLevel.color};`;

  document.getElementById('resultCrown').textContent = diag.crown;
  document.getElementById('diagLevel').textContent = diag.title;
  document.getElementById('diagDesc').textContent = diag.desc;

  renderAdRecommendation(pct);

  trackEvent('quiz_complete', {
    level_id: currentLevel.id,
    level_name: currentLevel.name,
    question_count: total,
    score: score,
    score_percent: pct,
    elapsed_seconds: elapsed,
  });

  setTimeout(() => {
    ring.style.strokeDashoffset = circumference - (circumference * pct / 100);
    ring.style.stroke = diag.color;
    animateRingNum(0, pct);
  }, 300);

  if (pct >= 80) launchConfetti(40);
}

function getDiagnosis(pct) {
  if (pct >= 90) return { title:'エキスパート 🏆', desc:'完璧に近いスコアです！この調子で次のレベルに挑戦してみましょう。あなたの英語力は本物です。', crown:'🏆', color:'#34D399', scoreClass:'s-great' };
  if (pct >= 70) return { title:'上級者 ⭐', desc:'かなり高い理解度です！苦手な問題を復習してさらにレベルアップしましょう。', crown:'⭐', color:'#A78BFA', scoreClass:'s-good' };
  if (pct >= 50) return { title:'中級者 📈', desc:'基礎はできています。間違えた問題の解説をしっかり読んで、弱点を克服しましょう。', crown:'📈', color:'#F59E0B', scoreClass:'s-ok' };
  return { title:'これから伸びる！ 💪', desc:'諦めないことが大切。毎日少しずつ続けることで必ず伸びます。1問ずつ丁寧に学習しましょう。', crown:'💪', color:'#F87171', scoreClass:'s-low' };
}

function animateRingNum(from, to) {
  let val = from;
  const step = () => {
    val = Math.min(val + 2, to);
    document.getElementById('ringPct').textContent = val + '%';
    if (val < to) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function shareX() {
  const pct = Math.round((score / questions.length) * 100);
  const text = `英検${currentLevel.name}診断テスト結果\n正解率: ${pct}%（${score}/${questions.length}問）\n\n#英検 #英語学習 #英検${currentLevel.name.replace('英検','')} #eiken`;
  copyToClipboard(text);
}

function shareIG() {
  const pct = Math.round((score / questions.length) * 100);
  const diag = getDiagnosis(pct);
  const text = `${diag.crown} 英語力診断やってみた！\n\n📊 ${currentLevel.name}テスト結果\n✅ 正解率 ${pct}%\n📝 ${score}/${questions.length}問正解\n🎯 診断：${diag.title}\n\n#英検 #英語学習 #英語 #勉強垢 #英語勉強 #英検合格`;
  copyToClipboard(text);
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
  } else {
    const el = document.createElement('textarea');
    el.value = text; document.body.appendChild(el);
    el.select(); document.execCommand('copy');
    document.body.removeChild(el);
  }
  const toast = document.getElementById('copyToast');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function retryQuiz() {
  trackEvent('retry_quiz', { level_id: currentLevel.id, level_name: currentLevel.name });
  startQuiz(currentLevel.id, lastCount);
}
function goHome() { showScreen('home'); }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
  updateScrollHint(id);
}

function updateScrollHint(activeId) {
  const hint = document.getElementById('scrollHint');
  if (!hint) return;
  if (activeId === 'home') {
    hint.style.display = 'flex';
    hint.classList.remove('hide');
  } else {
    hint.style.display = 'none';
  }
}

window.addEventListener('scroll', () => {
  const hint = document.getElementById('scrollHint');
  if (!hint) return;
  const home = document.getElementById('home');
  if (!home.classList.contains('active')) return;
  if (window.scrollY > 40) {
    hint.classList.add('hide');
  } else {
    hint.classList.remove('hide');
  }
});

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomCorrectEmoji() {
  return ['🎉','✨','🔥','💯','⚡','🌟','👏'][Math.floor(Math.random()*7)];
}

function launchConfetti(n = 20) {
  const container = document.getElementById('confettiContainer');
  const colors = ['#7C3AED','#10B981','#F59E0B','#EF4444','#3B82F6','#A78BFA','#34D399'];
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.cssText = `left:${Math.random()*100}%; top:0; background:${colors[Math.floor(Math.random()*colors.length)]}; animation-duration:${0.8 + Math.random()*0.6}s; animation-delay:${Math.random()*0.3}s; transform:rotate(${Math.random()*360}deg);`;
      container.appendChild(el);
      setTimeout(() => el.remove(), 1600);
    }, i * 30);
  }
}

// 賑わいカウンター機能は削除済み

buildLevelGrid();
updateScrollHint('home');
