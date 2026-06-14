(() => {
  'use strict';
  const BANK = window.QUESTION_BANK || [];
  const CATEGORIES = [...new Set(BANK.map(q => q.category))];
  const KEY = 'upperLimbQuizState.v1';
  const SETTINGS_KEY = 'upperLimbQuizSettings.v1';
  const main = document.getElementById('main');
  const navButtons = [...document.querySelectorAll('.nav-item')];
  const settingsDialog = document.getElementById('settingsDialog');
  let currentView = 'home';
  let session = null;
  let listFilter = 'all';

  const defaultState = () => ({
    questions: {}, totalAnswered: 0, totalCorrect: 0, lastStudyDate: '', streak: 0,
    sessions: 0, createdAt: Date.now()
  });
  const defaultSettings = () => ({order:'smart', showInput:true, largeText:false});
  let state = load(KEY, defaultState());
  let settings = load(SETTINGS_KEY, defaultSettings());

  function load(key, fallback){
    try { return {...fallback, ...(JSON.parse(localStorage.getItem(key)) || {})}; }
    catch { return fallback; }
  }
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch{} }
  function saveSettings(){ try{ localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }catch{} }
  function qState(id){
    if(!state.questions[id]) state.questions[id] = {level:0,due:0,seen:0,correct:0,wrong:0,last:0};
    return state.questions[id];
  }
  function esc(s=''){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function todayKey(d=new Date()){return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;}
  function daysBetween(a,b){return Math.round((new Date(b).setHours(0,0,0,0)-new Date(a).setHours(0,0,0,0))/86400000);}
  function updateStreak(){
    const t=todayKey();
    if(state.lastStudyDate===t) return;
    if(state.lastStudyDate && daysBetween(state.lastStudyDate,t)===1) state.streak=(state.streak||0)+1;
    else state.streak=1;
    state.lastStudyDate=t;
  }
  function stats(){
    const now=Date.now(); let mastered=0, learning=0, unseen=0, due=0;
    BANK.forEach(q=>{const s=state.questions[q.id]; if(!s||!s.seen) unseen++; else if(s.level>=4) mastered++; else learning++; if(s&&s.seen&&s.due<=now) due++;});
    const accuracy=state.totalAnswered?Math.round(state.totalCorrect/state.totalAnswered*100):0;
    return {mastered,learning,unseen,due,accuracy};
  }
  function categoryProgress(cat){
    const qs=BANK.filter(q=>q.category===cat); const mastered=qs.filter(q=>(state.questions[q.id]?.level||0)>=4).length;
    return {mastered,total:qs.length,pct:Math.round(mastered/qs.length*100)};
  }
  function setView(view, opts={}){
    currentView=view;
    navButtons.forEach(b=>b.classList.toggle('active', b.dataset.view===view));
    if(view==='home') renderHome();
    if(view==='study') renderStudySetup(opts);
    if(view==='list') renderList();
    if(view==='stats') renderStats();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function renderHome(){
    const s=stats();
    main.innerHTML=`
      <section class="hero">
        <div class="hero-kicker">SPACED REPETITION</div>
        <h1>${s.due ? `復習が ${s.due} 問<br>たまっています` : '上肢121問を<br>定着させる'}</h1>
        <p>答えを見る前に必ず思い出す。曖昧なら正解扱いにしない。その積み重ねだけが、試験で使える記憶になります。</p>
        <div class="hero-actions">
          <button class="primary-btn" id="todayBtn">${s.due?'今日の復習':'10問始める'}</button>
          <button class="secondary-btn" id="setupBtn">条件を選ぶ</button>
        </div>
      </section>
      <div class="section-title"><h2>進捗</h2><span>端末内に自動保存</span></div>
      <section class="stat-grid">
        <div class="stat-card"><b>${s.mastered}</b><span>定着</span></div>
        <div class="stat-card"><b>${s.accuracy}%</b><span>正答率</span></div>
        <div class="stat-card"><b>${state.streak||0}日</b><span>連続学習</span></div>
      </section>
      <div class="section-title"><h2>分野別</h2><button id="allStudyBtn">すべて学習</button></div>
      <section class="category-grid">
        ${CATEGORIES.map(cat=>{const p=categoryProgress(cat);return `<button class="category-card" data-category="${esc(cat)}"><strong>${esc(cat)}</strong><small>${p.mastered}/${p.total} 定着</small><div class="mini-progress"><i style="width:${p.pct}%"></i></div></button>`}).join('')}
      </section>
      ${s.unseen>0?`<div class="callout"><strong>未学習 ${s.unseen} 問。</strong> 一周目は速く回し、二周目から「曖昧」を潰す方が効率的です。</div>`:''}
    `;
    document.getElementById('todayBtn').onclick=()=>startSession({pool:s.due?'due':'smart',count:10,mode:'recall'});
    document.getElementById('setupBtn').onclick=()=>setView('study');
    document.getElementById('allStudyBtn').onclick=()=>setView('study',{category:'all'});
    document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>setView('study',{category:b.dataset.category}));
  }

  function renderStudySetup(opts={}){
    const initialCat=opts.category||'all';
    main.innerHTML=`
      <section class="panel">
        <h2>学習条件</h2>
        <div class="form-grid two">
          <div class="field"><label>出題形式</label><div class="segmented" id="modeSeg"><button class="active" data-mode="recall">思い出す</button><button data-mode="choice">四択</button></div></div>
          <div class="field"><label>問題数</label><select id="countSelect"><option value="10">10問</option><option value="20">20問</option><option value="30">30問</option><option value="all">全問</option></select></div>
          <div class="field"><label>分野</label><select id="categorySelect"><option value="all">全分野</option>${CATEGORIES.map(c=>`<option value="${esc(c)}" ${c===initialCat?'selected':''}>${esc(c)}</option>`).join('')}</select></div>
          <div class="field"><label>対象</label><select id="poolSelect"><option value="smart">弱点・未学習を優先</option><option value="due">復習期限が来た問題</option><option value="unseen">未学習のみ</option><option value="weak">間違えた問題</option><option value="all">全問題</option></select></div>
        </div>
        <button class="primary-btn" id="startBtn" style="width:100%;margin-top:18px">開始する</button>
      </section>
      <div class="callout"><strong>おすすめ：</strong> 最初は「思い出す」で10〜20問。四択だけでは、答えを見れば分かる状態から抜けにくいです。</div>
    `;
    let mode='recall';
    document.querySelectorAll('#modeSeg button').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('#modeSeg button').forEach(x=>x.classList.toggle('active',x===b));});
    document.getElementById('startBtn').onclick=()=>startSession({
      mode, count:document.getElementById('countSelect').value,
      category:document.getElementById('categorySelect').value,
      pool:document.getElementById('poolSelect').value
    });
  }

  function selectQuestions({category='all',pool='smart',count=10}){
    const now=Date.now();
    let arr=BANK.filter(q=>category==='all'||q.category===category);
    if(pool==='due') arr=arr.filter(q=>qState(q.id).seen&&qState(q.id).due<=now);
    if(pool==='unseen') arr=arr.filter(q=>!qState(q.id).seen);
    if(pool==='weak') arr=arr.filter(q=>qState(q.id).wrong>0 && qState(q.id).level<4);
    const smartScore=q=>{const s=qState(q.id);return (!s.seen?1000:0)+(s.due<=now?500:0)+(s.wrong*18)-(s.level*35)+Math.random()*15;};
    if(settings.order==='number') arr.sort((a,b)=>a.id-b.id);
    else if(settings.order==='random') arr.sort(()=>Math.random()-.5);
    else arr.sort((a,b)=>smartScore(b)-smartScore(a));
    if(pool==='smart') arr.sort((a,b)=>smartScore(b)-smartScore(a));
    const n=count==='all'?arr.length:Number(count);
    return arr.slice(0,n);
  }

  function startSession(opts){
    const queue=selectQuestions(opts);
    if(!queue.length){toast('条件に合う問題がありません');setView('study');return;}
    session={queue,index:0,mode:opts.mode||'recall',answered:false,choiceLocked:false,sessionCorrect:0};
    renderQuestion();
  }

  function renderQuestion(){
    const q=session.queue[session.index];
    const progress=Math.round(session.index/session.queue.length*100);
    main.innerHTML=`
      <div class="study-head"><div class="progress-track"><i style="width:${progress}%"></i></div><span>${session.index+1} / ${session.queue.length}</span></div>
      <section class="question-card">
        <div class="q-meta"><span class="badge">Q${q.id}</span><span class="badge">${esc(q.category)}</span>${q.note?'<span class="badge warn">要確認</span>':''}</div>
        <div class="question-text">${esc(q.question)}</div>
        ${session.mode==='recall' ? recallBody(q) : choiceBody(q)}
      </section>
    `;
    if(session.mode==='recall') bindRecall(q); else bindChoice(q);
  }

  function recallBody(q){
    return `${settings.showInput?`<textarea class="answer-input" id="answerInput" placeholder="頭の中だけで済ませず、できるだけ書き出す"></textarea><div class="hint-text">目安：${q.expected}項目。表記ゆれがあるため、最終判定は自分で行います。</div>`:''}
      <div id="answerArea"></div>
      <div class="question-actions" id="questionActions"><button class="primary-btn" id="revealBtn">答えを表示</button></div>`;
  }
  function bindRecall(q){document.getElementById('revealBtn').onclick=()=>revealAnswer(q);}
  function revealAnswer(q){
    session.answered=true;
    const area=document.getElementById('answerArea');
    area.innerHTML=`<div class="answer-box"><div class="answer-label">資料の回答</div><div class="answer-text">${esc(q.answer).replaceAll('／','<br>')}</div>${q.note?`<div class="source-note"><strong>要確認：</strong>${esc(q.note)}</div>`:''}</div>`;
    document.getElementById('questionActions').innerHTML=`<div class="grade-grid">
      <button class="grade-btn grade-again" data-grade="again"><b>不正解</b><small>すぐ再出題</small></button>
      <button class="grade-btn grade-hard" data-grade="hard"><b>曖昧</b><small>明日</small></button>
      <button class="grade-btn grade-good" data-grade="good"><b>正解</b><small>数日後</small></button>
      <button class="grade-btn grade-easy" data-grade="easy"><b>余裕</b><small>長め</small></button>
    </div>`;
    document.querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>grade(q,b.dataset.grade));
  }

  function distractors(q){
    const count=q.answer.split('／').length;
    let pool=BANK.filter(x=>x.id!==q.id && x.category===q.category && Math.abs(x.answer.split('／').length-count)<=1);
    if(pool.length<3) pool=BANK.filter(x=>x.id!==q.id && Math.abs(x.answer.split('／').length-count)<=1);
    pool.sort(()=>Math.random()-.5);
    const vals=[];
    for(const x of pool){if(!vals.includes(x.answer)){vals.push(x.answer);if(vals.length===3)break;}}
    return [q.answer,...vals].sort(()=>Math.random()-.5);
  }
  function choiceBody(q){
    const choices=distractors(q);
    return `<div class="choice-list">${choices.map((c,i)=>`<button class="choice-btn" data-answer="${encodeURIComponent(c)}"><strong>${String.fromCharCode(65+i)}.</strong> ${esc(c)}</button>`).join('')}</div><div id="answerArea"></div>`;
  }
  function bindChoice(q){
    document.querySelectorAll('.choice-btn').forEach(b=>b.onclick=()=>{
      if(session.choiceLocked)return; session.choiceLocked=true;
      const chosen=decodeURIComponent(b.dataset.answer), correct=chosen===q.answer;
      document.querySelectorAll('.choice-btn').forEach(x=>{const val=decodeURIComponent(x.dataset.answer);x.disabled=true;x.classList.toggle('correct',val===q.answer);if(x===b&&!correct)x.classList.add('wrong');});
      document.getElementById('answerArea').innerHTML=`<div class="answer-box"><div class="answer-label">${correct?'正解':'不正解'}</div><div class="answer-text">${esc(q.answer).replaceAll('／','<br>')}</div>${q.note?`<div class="source-note"><strong>要確認：</strong>${esc(q.note)}</div>`:''}</div><div class="question-actions"><button class="primary-btn" id="nextChoiceBtn">次へ</button></div>`;
      record(q,correct?'good':'again'); if(correct)session.sessionCorrect++;
      document.getElementById('nextChoiceBtn').onclick=()=>nextQuestion();
    });
  }

  function grade(q,grade){record(q,grade);if(grade==='good'||grade==='easy')session.sessionCorrect++;nextQuestion();}
  function record(q,grade){
    const s=qState(q.id), now=Date.now(); s.seen++; s.last=now; state.totalAnswered++;
    let days=0;
    if(grade==='again'){s.level=Math.max(0,s.level-1);s.wrong++;s.due=now+5*60*1000;}
    if(grade==='hard'){s.level=Math.max(1,s.level);s.wrong++;days=1;s.due=now+86400000;}
    if(grade==='good'){s.level=Math.min(5,s.level+1);s.correct++;state.totalCorrect++;days=[1,2,4,8,16,30][s.level];s.due=now+days*86400000;}
    if(grade==='easy'){s.level=Math.min(5,s.level+2);s.correct++;state.totalCorrect++;days=[2,4,8,16,30,60][s.level];s.due=now+days*86400000;}
    updateStreak(); save();
  }
  function nextQuestion(){
    session.index++;session.choiceLocked=false;
    if(session.index>=session.queue.length){finishSession();return;}
    renderQuestion();window.scrollTo({top:0,behavior:'smooth'});
  }
  function finishSession(){
    state.sessions=(state.sessions||0)+1;save();
    const total=session.queue.length, correct=session.sessionCorrect;
    main.innerHTML=`<section class="hero"><div class="hero-kicker">SESSION COMPLETE</div><h1>${total}問 完了</h1><p>正解・余裕：${correct}問。曖昧を正解に含めなかったなら、この記録には意味があります。</p><div class="hero-actions"><button class="primary-btn" id="againBtn">もう10問</button><button class="secondary-btn" id="finishHomeBtn">ホームへ</button></div></section>`;
    document.getElementById('againBtn').onclick=()=>startSession({pool:'smart',count:10,mode:session.mode});
    document.getElementById('finishHomeBtn').onclick=()=>setView('home');
  }

  function renderList(){
    main.innerHTML=`<div class="list-toolbar"><input id="searchInput" class="searchbox" placeholder="問題・回答を検索"><div class="filter-row"><button class="chip active" data-filter="all">すべて</button><button class="chip" data-filter="weak">弱点</button><button class="chip" data-filter="mastered">定着</button>${CATEGORIES.map(c=>`<button class="chip" data-filter="${esc(c)}">${esc(c)}</button>`).join('')}</div></div><div class="question-list" id="questionList"></div>`;
    const renderRows=()=>{
      const term=document.getElementById('searchInput').value.trim().toLowerCase();
      let rows=BANK.filter(q=>(!term||`${q.question} ${q.answer}`.toLowerCase().includes(term)));
      if(listFilter==='weak')rows=rows.filter(q=>(state.questions[q.id]?.wrong||0)>0&&(state.questions[q.id]?.level||0)<4);
      else if(listFilter==='mastered')rows=rows.filter(q=>(state.questions[q.id]?.level||0)>=4);
      else if(CATEGORIES.includes(listFilter))rows=rows.filter(q=>q.category===listFilter);
      document.getElementById('questionList').innerHTML=rows.length?rows.map(q=>{const lv=state.questions[q.id]?.level||0;const status=lv>=4?'mastered':state.questions[q.id]?.seen?'learning':'';return `<button class="question-row" data-qid="${q.id}"><div class="question-row-head"><span class="status-dot ${status}"></span><strong>Q${q.id} ・ ${esc(q.category)}</strong>${q.note?'<span class="badge warn">要確認</span>':''}</div><p>${esc(q.question)}</p></button>`}).join(''):`<div class="empty"><b>該当なし</b>検索条件を変えてください。</div>`;
      document.querySelectorAll('[data-qid]').forEach(b=>b.onclick=()=>{session={queue:[BANK.find(q=>q.id===Number(b.dataset.qid))],index:0,mode:'recall',sessionCorrect:0};renderQuestion();});
    };
    document.getElementById('searchInput').oninput=renderRows;
    document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{listFilter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));renderRows();});
    renderRows();
  }

  function renderStats(){
    const s=stats();
    main.innerHTML=`
      <section class="stat-grid"><div class="stat-card"><b>${state.totalAnswered||0}</b><span>総回答</span></div><div class="stat-card"><b>${s.accuracy}%</b><span>正答率</span></div><div class="stat-card"><b>${state.sessions||0}</b><span>完了セッション</span></div></section>
      <div class="section-title"><h2>分野別の定着率</h2><span>${s.mastered}/121</span></div>
      <section class="panel bar-chart">${CATEGORIES.map(cat=>{const p=categoryProgress(cat);return `<div class="bar-row"><span>${esc(cat)}</span><div class="bar"><i style="width:${p.pct}%"></i></div><b>${p.pct}%</b></div>`}).join('')}</section>
      <div class="section-title"><h2>現状</h2></div>
      <section class="panel"><div class="stat-grid"><div class="stat-card"><b>${s.unseen}</b><span>未学習</span></div><div class="stat-card"><b>${s.learning}</b><span>学習中</span></div><div class="stat-card"><b>${s.due}</b><span>復習期限</span></div></div></section>
    `;
  }

  function toast(msg){
    let t=document.querySelector('.toast');if(!t){t=document.createElement('div');t.className='toast';document.body.appendChild(t);}t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800);
  }
  navButtons.forEach(b=>b.onclick=()=>setView(b.dataset.view));
  document.getElementById('homeBtn').onclick=()=>setView('home');
  document.getElementById('settingsBtn').onclick=()=>settingsDialog.showModal();
  const orderSetting=document.getElementById('orderSetting'), inputSetting=document.getElementById('inputSetting'), largeTextSetting=document.getElementById('largeTextSetting');
  orderSetting.value=settings.order;inputSetting.checked=settings.showInput;largeTextSetting.checked=settings.largeText;document.body.classList.toggle('large-text',settings.largeText);
  orderSetting.onchange=()=>{settings.order=orderSetting.value;saveSettings();};
  inputSetting.onchange=()=>{settings.showInput=inputSetting.checked;saveSettings();};
  largeTextSetting.onchange=()=>{settings.largeText=largeTextSetting.checked;document.body.classList.toggle('large-text',settings.largeText);saveSettings();};
  document.getElementById('resetBtn').onclick=()=>{if(confirm('学習履歴をすべて消去します。元に戻せません。')){state=defaultState();save();settingsDialog.close();renderHome();toast('学習履歴を消去しました');}};
  if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  setView('home');
})();
