import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const privacyReady = import.meta.env.VITE_CHILD_SOCIAL_READY === 'true';
const supabase = url && anonKey ? createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const code6 = () => String(Math.floor(100000 + Math.random() * 900000));
const localProfile = () => {
  try {
    const social = JSON.parse(localStorage.getItem('tafelhelden-social-v1') || '{}');
    return social.users?.[social.currentUser] || null;
  } catch { return null; }
};
let channel = null;
let role = '';
let profile = null;
let roomCode = '';
let roomState = null;
let players = new Map();
let scores = new Map();
let answered = new Set();
let chosenTables = [7];
let countdownId = null;
let waitingForAuth = false;

function toast(message) {
  document.querySelector('.toast')?.remove();
  const node = document.createElement('div'); node.className = 'toast'; node.textContent = message;
  document.body.appendChild(node); setTimeout(() => node.remove(), 3300);
}
function status(message) { $('#quizStatus').textContent = message; }
function game(markup) { $('#quizSetup').classList.add('hidden'); $('#quizGame').classList.remove('hidden'); $('#quizGame').innerHTML = markup; }
function close() {
  clearInterval(countdownId); countdownId = null;
  if (channel) { channel.unsubscribe(); channel = null; }
  role = ''; roomCode = ''; roomState = null; players = new Map(); scores = new Map(); answered = new Set();
  $('#classQuizModal').classList.add('hidden'); $('#classQuizModal').setAttribute('aria-hidden', 'true');
  $('#quizGame').classList.add('hidden'); $('#quizSetup').classList.remove('hidden');
}
function drawTablePicks() {
  const host = $('#quizTables'); host.innerHTML = '';
  for (let n = 0; n <= 10; n++) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `training-pick${chosenTables.includes(n) ? ' selected' : ''}`;
    button.textContent = n; button.setAttribute('aria-pressed', String(chosenTables.includes(n)));
    button.onclick = () => { chosenTables = chosenTables.includes(n) ? chosenTables.filter((x) => x !== n) : [...chosenTables, n].sort((a, b) => a - b); drawTablePicks(); };
    host.appendChild(button);
  }
}
function renderRoster() {
  const list = [...players.values()].sort((a, b) => a.username.localeCompare(b.username));
  const target = $('#quizRoster');
  if (target) target.innerHTML = list.length
    ? list.map((p) => `<span class="quiz-player-pill">🟢 ${esc(p.username)}</span>`).join('')
    : '<span class="quiz-player-pill">Nog geen leerlingen — deel de code!</span>';
  const counter = $('#quizPlayerCount'); if (counter) counter.textContent = `${list.length} ${list.length === 1 ? 'leerling' : 'leerlingen'} doen mee`;
}
function leaderboard() {
  return [...scores.values()].sort((a, b) => b.points - a.points || a.username.localeCompare(b.username))
    .map((p, i) => `<div class="quiz-rank"><span>${['🥇', '🥈', '🥉'][i] || `${i + 1}.`} ${esc(p.username)}</span><strong>${p.points} pt</strong></div>`).join('') || '<p class="quiz-note">Het scorebord verschijnt zodra de eerste antwoorden binnen zijn.</p>';
}
function publicState(state) {
  if (!state?.question) return state;
  const { answerIndex, ...question } = state.question;
  return { ...state, question };
}
function hostMarkup() {
  game(`<div class="quiz-stage"><div class="quiz-meta"><span>🎤 DOCENTENBORD</span><span id="quizPlayerCount">0 leerlingen doen mee</span></div><p>Laat leerlingen op hun apparaat naar Tafelhelden gaan en deze code invullen:</p><div class="quiz-code">${esc(roomCode)}</div><div class="quiz-roster" id="quizRoster"></div><div id="quizHostQuestion"></div><h3>🏆 Tussenstand</h3><div id="quizLeaderboard">${leaderboard()}</div><div class="quiz-foot"><button class="social-close" id="quizExit">Quiz sluiten</button><button class="social-save" id="quizNext">Start quiz 🚀</button></div><div class="quiz-status" id="quizStatus" aria-live="polite">Wachten tot de klas meedoet…</div></div>`);
  $('#quizExit').onclick = leaveQuiz; $('#quizNext').onclick = advance;
  renderRoster();
}
function renderHostQuestion() {
  const node = $('#quizHostQuestion'); if (!node || !roomState) return;
  const q = roomState.question;
  node.innerHTML = `<div class="quiz-question">${esc(q.text)}</div><div class="quiz-answer-grid">${q.options.map((n, i) => `<div class="quiz-answer-tile" style="display:grid;place-items:center;min-height:65px">${['🔺', '🔷', '🟡', '🟩'][i]} ${n}</div>`).join('')}</div><div class="quiz-meta"><span>Vraag ${roomState.round} van ${roomState.total}</span><span id="quizClock">${Math.max(0, Math.ceil((q.expiresAt - Date.now()) / 1000))} sec</span><span id="quizAnswered">0 / ${players.size} geantwoord</span></div>`;
  $('#quizNext').textContent = roomState.round >= roomState.total ? 'Bekijk eindscore 🏁' : 'Volgende vraag →';
  clearInterval(countdownId);
  countdownId = setInterval(() => {
    const seconds = Math.max(0, Math.ceil((q.expiresAt - Date.now()) / 1000));
    const clock = $('#quizClock'); if (clock) clock.textContent = `${seconds} sec`;
    if (seconds <= 0) { clearInterval(countdownId); status('Tijd! Bekijk de antwoorden en ga door.'); }
  }, 250);
}
function playerQuestion(q) {
  if (!q) return;
  game(`<div class="quiz-stage"><div class="quiz-meta"><span>🔑 KLASQUIZ ${esc(roomCode)}</span><span id="playerClock"></span></div><div class="quiz-question">${esc(q.text)}</div><div class="quiz-answer-grid">${q.options.map((n, i) => `<button class="quiz-answer-tile" data-answer="${i}">${['🔺', '🔷', '🟡', '🟩'][i]}<br>${n}</button>`).join('')}</div><div id="playerMessage" class="quiz-status" aria-live="polite">Kies snel je antwoord!</div></div>`);
  document.querySelectorAll('[data-answer]').forEach((button) => button.onclick = async () => {
    if (!channel || button.disabled) return;
    document.querySelectorAll('[data-answer]').forEach((x) => { x.disabled = true; });
    $('#playerMessage').textContent = 'Antwoord verstuurd! ✨';
    await channel.send({ type: 'broadcast', event: 'answer', payload: { userId: profile.id, username: profile.username, index: Number(button.dataset.answer), round: roomState?.round } });
  });
  clearInterval(countdownId);
  countdownId = setInterval(() => {
    const clock = $('#playerClock'); if (clock) clock.textContent = `${Math.max(0, Math.ceil((q.expiresAt - Date.now()) / 1000))} sec`;
  }, 250);
}
function connect(code, asRole) {
  if (!supabase || !privacyReady) { status('De online quiz staat nog uit. De beheerder moet eerst de gratis Supabase-verbinding en de privacy-inrichting voor kinderen activeren. Zie docs/WEBSITE-SETUP.md.'); return; }
  if (!profile?.id) { status('Log eerst in met een online gastaccount of account en kies je gebruikersnaam.'); return; }
  roomCode = code; role = asRole; players = new Map(); scores = new Map(); answered = new Set();
  channel = supabase.channel(`tafelhelden-klas-${code}`, { config: { broadcast: { self: false }, presence: { key: profile.id } } });
  channel.on('presence', { event: 'sync' }, () => {
    players = new Map(Object.values(channel.presenceState()).flat().map((entry) => [entry.userId, entry]));
    if (role === 'host') renderRoster();
  });
  channel.on('broadcast', { event: 'hello' }, ({ payload }) => {
    if (role !== 'host') return;
    players.set(payload.userId, { userId: payload.userId, username: payload.username }); renderRoster();
    channel.send({ type: 'broadcast', event: 'room-state', payload: { target: payload.userId, roomState: publicState(roomState) } });
  });
  channel.on('broadcast', { event: 'room-state' }, ({ payload }) => {
    if (role !== 'player' || payload.target !== profile.id || !payload.roomState) return;
    roomState = payload.roomState;
    if (roomState.status === 'question') playerQuestion(roomState.question);
    else if (roomState.status === 'finished') playerFinished();
  });
  channel.on('broadcast', { event: 'question' }, ({ payload }) => {
    roomState = payload.state;
    if (role === 'player') playerQuestion(roomState.question);
    else { answered = new Set(); renderHostQuestion(); status('De klas is aan het rekenen…'); }
  });
  channel.on('broadcast', { event: 'answer' }, ({ payload }) => {
    if (role !== 'host' || roomState?.status !== 'question' || payload.round !== roomState.round || answered.has(payload.userId)) return;
    answered.add(payload.userId);
    const player = players.get(payload.userId); if (!player) return;
    const correct = payload.index === roomState.question.answerIndex;
    const timeLeft = Math.max(0, roomState.question.expiresAt - Date.now());
    const current = scores.get(payload.userId) || { userId: payload.userId, username: player.username, points: 0 };
    if (correct) current.points += Math.max(100, Math.round(1000 * timeLeft / (Number(roomState.seconds) * 1000)));
    scores.set(payload.userId, current);
    channel.send({ type: 'broadcast', event: 'answer-result', payload: { target: payload.userId, correct, rightAnswer: roomState.question.options[roomState.question.answerIndex], points: current.points } });
    const board = $('#quizLeaderboard'); if (board) board.innerHTML = leaderboard();
    const answerCount = $('#quizAnswered'); if (answerCount) answerCount.textContent = `${answered.size} / ${players.size} geantwoord`;
    if (players.size && answered.size >= players.size) status('Iedereen heeft geantwoord! Klaar voor de volgende?');
  });
  channel.on('broadcast', { event: 'answer-result' }, ({ payload }) => {
    if (role !== 'player' || payload.target !== profile.id) return;
    const message = $('#playerMessage'); if (message) message.textContent = payload.correct ? `Goed! + punten voor jou 🎉` : `Bijna! Het goede antwoord was ${payload.rightAnswer}.`;
  });
  channel.on('broadcast', { event: 'finished' }, () => { roomState = { status: 'finished' }; if (role === 'player') playerFinished(); else finishHost(); });
  channel.on('broadcast', { event: 'closed' }, () => {
    if (role !== 'player') return;
    game('<div class="quiz-stage" style="text-align:center"><div style="font-size:48px">👋</div><h2>De quiz is gesloten</h2><p>De docent heeft de quizruimte afgesloten.</p><div class="quiz-foot"><button class="social-close" id="quizExit">Klaar</button></div></div>');
    $('#quizExit').onclick = close;
  });
  channel.subscribe(async (state) => {
    if (state !== 'SUBSCRIBED') return;
    await channel.track({ userId: profile.id, username: profile.username, role });
    if (role === 'player') {
      game(`<div class="quiz-stage"><div class="quiz-meta"><span>🔑 KLASQUIZ</span><span>@${esc(profile.username)}</span></div><p>Je bent binnen! Kijk naar het bord bij je docent.</p><div class="quiz-code">${esc(roomCode)}</div><div id="playerWait" class="quiz-status">Wachten tot de docent start…</div><div class="quiz-foot"><button class="social-close" id="quizExit">Verlaten</button></div></div>`);
      $('#quizExit').onclick = close;
      channel.send({ type: 'broadcast', event: 'hello', payload: { userId: profile.id, username: profile.username } });
      channel.send({ type: 'broadcast', event: 'state-request', payload: { userId: profile.id } });
    } else { hostMarkup(); status('Deelnemers worden live bijgewerkt.'); }
  });
  channel.on('broadcast', { event: 'state-request' }, ({ payload }) => {
    if (role === 'host') channel.send({ type: 'broadcast', event: 'room-state', payload: { target: payload.userId, roomState: publicState(roomState) } });
  });
}
function makeQuestion(round, total, tables, seconds) {
  const table = tables[Math.floor(Math.random() * tables.length)];
  const factor = Math.floor(Math.random() * 11);
  const answer = table * factor;
  const options = new Set([answer]);
  while (options.size < 4) options.add(Math.max(0, answer + (Math.floor(Math.random() * 19) - 9)));
  const choices = [...options].sort(() => Math.random() - 0.5);
  return { round, total, seconds, text: `${table} × ${factor} = ?`, options: choices, answerIndex: choices.indexOf(answer), expiresAt: Date.now() + seconds * 1000 };
}
async function advance() {
  if (!channel || role !== 'host') return;
  const total = roomState?.total || Number($('#quizCount').value) || 10;
  if (roomState?.round >= total) { roomState = { ...roomState, status: 'finished' }; await channel.send({ type: 'broadcast', event: 'finished', payload: {} }); finishHost(); return; }
  const seconds = Number($('#quizSeconds')?.value || roomState?.seconds || 15);
  const tables = chosenTables.length ? chosenTables : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const nextNumber = (roomState?.round || 0) + 1;
  roomState = { status: 'question', round: nextNumber, total, seconds, question: makeQuestion(nextNumber, total, tables, seconds) };
  answered = new Set();
  await channel.send({ type: 'broadcast', event: 'question', payload: { state: publicState(roomState) } });
  renderHostQuestion(); status('De vraag staat op het bord. Wie is het snelst?');
}
function finishHost() {
  clearInterval(countdownId);
  const rankings = leaderboard();
  game(`<div class="quiz-stage" style="text-align:center"><div style="font-size:52px">🏆</div><h2>Wat een rekenkanjers!</h2><p>De quiz is klaar. Goed meegedaan allemaal!</p><h3>🏅 Eindscore</h3>${rankings}<div class="quiz-foot"><button class="social-close" id="quizExit">Quiz sluiten</button></div></div>`);
  $('#quizExit').onclick = leaveQuiz;
}
function playerFinished() {
  clearInterval(countdownId);
  game(`<div class="quiz-stage" style="text-align:center"><div style="font-size:52px">🎉</div><h2>Klasquiz afgelopen!</h2><p>Goed meegedaan, @${esc(profile.username)}. Kijk naar het bord voor de eindscore.</p><div class="quiz-foot"><button class="social-close" id="quizExit">Klaar</button></div></div>`);
  $('#quizExit').onclick = close;
}
async function leaveQuiz() {
  if (role === 'host' && channel) await channel.send({ type: 'broadcast', event: 'closed', payload: {} });
  close();
}
function renderSetup() {
  drawTablePicks();
  const note = $('#quizConnectionNote');
  note.textContent = !supabase || !privacyReady
    ? 'Live meedoen vanaf verschillende apparaten werkt zodra Supabase is gekoppeld en de privacy-inrichting voor leerlingen van 9–11 jaar klaar is. Nu staat de online dienst nog uit; er is geen verbinding om klasapparaten aan elkaar te koppelen.'
    : 'Gebruik een online profiel. De docent deelt de code vanaf het bord; leerlingen voeren die code hier in.';
}
$('#classQuizModal').setAttribute('aria-hidden', 'true');
$('#classQuizModal').addEventListener('click', (event) => { if (event.target === $('#classQuizModal')) close(); });
$('#closeClassQuiz').onclick = leaveQuiz;
$('#hostQuizButton').onclick = async () => {
  if (!chosenTables.length) { toast('Kies eerst minstens één tafel.'); return; }
  if (!supabase || !privacyReady) { status('Live klasquiz is nog niet verbonden. Koppel eerst de online dienst en privacy-inrichting; zie docs/WEBSITE-SETUP.md.'); return; }
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) { status('Maak eerst een online profiel via 👤 Profiel. Een lokaal profiel kan niet op andere apparaten worden gevonden.'); return; }
  const { data: teacher, error: profileError } = await supabase.from('profiles').select('id,username,is_teacher').eq('id', user.id).maybeSingle();
  if (profileError) { status('Docentinstelling niet gevonden. Voer de nieuwste supabase/schema.sql uit en sla je docentprofiel opnieuw op.'); return; }
  if (!teacher?.is_teacher) { status('Vink in je profiel “Ik ben docent/leerkracht” aan en sla het profiel op.'); return; }
  profile = teacher; waitingForAuth = false; roomState = { status: 'lobby', round: 0, total: Number($('#quizCount').value), seconds: Number($('#quizSeconds').value) };
  connect(code6(), 'host');
};
$('#joinQuizButton').onclick = () => { $('#quizJoinRow').classList.toggle('hidden'); $('#quizCodeInput').focus(); };
$('#quizCodeInput').oninput = () => { $('#quizCodeInput').value = $('#quizCodeInput').value.replace(/\D/g, '').slice(0, 6); };
$('#quizCodeInput').onkeydown = (event) => { if (event.key === 'Enter') $('#quizJoinConfirm').click(); };
$('#quizJoinConfirm').onclick = async () => {
  if (!supabase || !privacyReady) { status('Live klasquiz is nog niet verbonden. Koppel eerst de online dienst en privacy-inrichting; zie docs/WEBSITE-SETUP.md.'); return; }
  const code = $('#quizCodeInput').value.trim(); if (!/^\d{6}$/.test(code)) { status('Vul de 6-cijferige code van je docent in.'); return; }
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) { status('Maak eerst een online gastprofiel via 👤 Profiel om mee te doen.'); return; }
  const { data: student, error: profileError } = await supabase.from('profiles').select('id,username').eq('id', user.id).maybeSingle();
  if (profileError || !student) { status('Sla eerst je gebruikersnaam op bij je online profiel.'); return; }
  profile = student; connect(code, 'player');
};
window.tafelheldenClassQuiz = {
  open() { $('#classQuizModal').classList.remove('hidden'); $('#classQuizModal').setAttribute('aria-hidden', 'false'); renderSetup(); status(localProfile()?.isTeacher ? 'Je profiel is docent. Stel de quiz in en nodig je klas uit.' : 'Je kunt meedoen als leerling. Vink docent aan in je profiel om zelf een quiz te hosten.'); }
};
