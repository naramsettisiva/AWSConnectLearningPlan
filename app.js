// ===== Generic helpers shared by both track pages =====
function loadJSON(key, fallback){
  try{ return JSON.parse(localStorage.getItem(key)) || fallback; }catch(e){ return fallback; }
}
function saveJSON(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){}
}

function buildTrack(TRACK){
  const container = document.getElementById('days');
  const DONE_KEY = TRACK.id + '-done-v1';
  const SCORES_KEY = TRACK.id + '-scores-v1';
  let doneState = loadJSON(DONE_KEY, {});
  let scores = loadJSON(SCORES_KEY, {}); // { dayN: {correct, total, ts} , mock: {...} }

  function updateProgress(){
    const doneCount = Object.values(doneState).filter(Boolean).length;
    document.getElementById('progressFill').style.width = (doneCount/TRACK.days.length*100)+'%';
    document.getElementById('progressLabel').textContent = doneCount + ' / ' + TRACK.days.length + ' DAYS';
  }

  function renderScoreHistory(){
    const el = document.getElementById('scoreHistory');
    if(!el) return;
    const rows = [];
    TRACK.days.forEach(d=>{
      const s = scores[d.n];
      if(s) rows.push({label:'Day '+d.n+' — '+d.title, correct:s.correct, total:s.total, ts:s.ts});
    });
    if(scores.mock) rows.push({label:'Full Mock Exam', correct:scores.mock.correct, total:scores.mock.total, ts:scores.mock.ts});
    if(rows.length===0){
      el.innerHTML = '<p class="empty-note">No quiz scores saved yet — complete a day\'s assessment below to start tracking.</p>';
      return;
    }
    el.innerHTML = `<table class="scores"><thead><tr><th>Assessment</th><th>Score</th><th>Date</th></tr></thead><tbody>
      ${rows.map(r=>{
        const pct = Math.round(r.correct/r.total*100);
        const cls = pct>=70?'score-good':'score-bad';
        return `<tr><td>${r.label}</td><td class="${cls}">${r.correct}/${r.total} (${pct}%)</td><td>${new Date(r.ts).toLocaleDateString()}</td></tr>`;
      }).join('')}
    </tbody></table>`;
  }

  function renderQuiz(quizId, questions, onSave){
    return `
      <div class="quiz" id="quiz-${quizId}">
        <div class="quiz-title">End-of-session assessment</div>
        ${questions.map((q,qi)=>`
          <div class="q" data-qi="${qi}">
            <div class="q-text">${qi+1}. ${q.q}</div>
            <div class="opts">
              ${q.opts.map((o,oi)=>`<div class="opt" data-oi="${oi}">${o}</div>`).join('')}
            </div>
          </div>
        `).join('')}
        <button class="quiz-btn" data-submit="${quizId}">Submit assessment</button>
        <div class="quiz-result" id="result-${quizId}"></div>
      </div>
    `;
  }

  function wireQuiz(quizId, questions, onSave){
    const root = document.getElementById('quiz-'+quizId);
    const answers = {};
    root.querySelectorAll('.q').forEach(qEl=>{
      const qi = qEl.getAttribute('data-qi');
      qEl.querySelectorAll('.opt').forEach(optEl=>{
        optEl.addEventListener('click', ()=>{
          if(root.dataset.submitted) return;
          qEl.querySelectorAll('.opt').forEach(o=>o.classList.remove('selected'));
          optEl.classList.add('selected');
          answers[qi] = parseInt(optEl.getAttribute('data-oi'));
        });
      });
    });
    root.querySelector('[data-submit]').addEventListener('click', (e)=>{
      if(root.dataset.submitted) return;
      let correctCount = 0;
      questions.forEach((q,qi)=>{
        const qEl = root.querySelector(`.q[data-qi="${qi}"]`);
        const opts = qEl.querySelectorAll('.opt');
        opts.forEach((o,oi)=>{
          if(oi === q.correct) o.classList.add('correct');
          else if(answers[qi]===oi) o.classList.add('incorrect');
        });
        if(answers[qi]===q.correct) correctCount++;
      });
      root.dataset.submitted = 'true';
      const resEl = document.getElementById('result-'+quizId);
      const total = questions.length;
      resEl.textContent = `Score: ${correctCount}/${total} — saved to your score history.`;
      resEl.classList.add('saved');
      onSave(correctCount, total);
      renderScoreHistory();
    });
  }

  // build day strips
  let currentWeek = null;
  TRACK.days.forEach(d=>{
    if(d.week !== currentWeek){
      currentWeek = d.week;
      const wt = document.createElement('div');
      wt.className = 'week-title';
      wt.textContent = currentWeek;
      container.appendChild(wt);
    }

    const strip = document.createElement('div');
    strip.className = 'strip';
    strip.id = 'strip-'+d.n;

    const quizId = 'day'+d.n;
    strip.innerHTML = `
      <div class="strip-head" role="button" tabindex="0" aria-expanded="false">
        <div class="chk" data-check="${d.n}"><svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4" stroke="#0B1220" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div class="daynum">D${String(d.n).padStart(2,'0')}</div>
        <div>
          <div class="head-date">${d.date.toUpperCase()}</div>
          <div class="head-title">${d.title}</div>
        </div>
      </div>
      <div class="strip-body">
        ${d.note ? `<div class="note">⏱ ${d.note}</div>` : ''}
        ${d.tasks.map(t=>`<div class="task">${t}</div>`).join('')}
        <div class="links">${d.links.map(l=>`<a href="${l.url}" target="_blank" rel="noopener">${l.label} ↗</a>`).join('')}</div>
        ${renderQuiz(quizId, d.quiz, (c,t)=>{ scores[d.n] = {correct:c, total:t, ts:Date.now()}; saveJSON(SCORES_KEY, scores); })}
      </div>
    `;
    container.appendChild(strip);

    if(d.offAfter){
      const off = document.createElement('div');
      off.className = 'off-day';
      off.textContent = d.offAfter;
      container.appendChild(off);
    }
  });

  // wire all quizzes after DOM insert
  TRACK.days.forEach(d=>{
    wireQuiz('day'+d.n, d.quiz, ()=>{});
  });

  // mock exam
  const mockContainer = document.getElementById('mockQuiz');
  if(mockContainer && TRACK.mock){
    mockContainer.innerHTML = renderQuiz('mock', TRACK.mock, ()=>{});
    wireQuiz('mock', TRACK.mock, (c,t)=>{ scores.mock = {correct:c,total:t,ts:Date.now()}; saveJSON(SCORES_KEY, scores); });
  }

  function applyDoneState(){
    TRACK.days.forEach(d=>{
      const strip = document.getElementById('strip-'+d.n);
      if(doneState[d.n]) strip.classList.add('done'); else strip.classList.remove('done');
    });
    updateProgress();
  }

  container.addEventListener('click',(e)=>{
    const checkEl = e.target.closest('[data-check]');
    if(checkEl){
      e.stopPropagation();
      const n = checkEl.getAttribute('data-check');
      doneState[n] = !doneState[n];
      saveJSON(DONE_KEY, doneState);
      applyDoneState();
      return;
    }
    const head = e.target.closest('.strip-head');
    if(head){
      const strip = head.closest('.strip');
      const open = strip.classList.toggle('open');
      head.setAttribute('aria-expanded', open);
    }
  });
  container.addEventListener('keydown',(e)=>{
    if(e.key==='Enter'||e.key===' '){
      const head = e.target.closest('.strip-head');
      if(head){ e.preventDefault(); head.click(); }
    }
  });

  const resetBtn = document.getElementById('resetBtn');
  if(resetBtn){
    resetBtn.addEventListener('click', ()=>{
      if(confirm('Reset checklist and all saved scores for this track?')){
        doneState = {}; scores = {};
        saveJSON(DONE_KEY, doneState); saveJSON(SCORES_KEY, scores);
        applyDoneState(); renderScoreHistory();
      }
    });
  }

  applyDoneState();
  renderScoreHistory();
}
