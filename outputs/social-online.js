import { createClient } from '@supabase/supabase-js';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
if (!supabaseUrl || !supabaseAnonKey || import.meta.env.VITE_CHILD_SOCIAL_READY !== 'true') {
  console.info('Tafelhelden: cloud accounts stay off until Supabase and the child-safety/parent-consent review are configured.');
} else {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);
  const appScheme = 'nl.tafelhelden.app://auth/callback';
  const native = Capacitor.isNativePlatform();
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: !native, flowType: 'pkce' }
  });
  let authUser = null;
  let profile = null;
  let ownedPools = [];
  let allInvites = [];
  let selectedInvitePool = null;
  let deletingPool = null;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
  function toast(message) {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const node = document.createElement('div');
    node.className = 'toast';
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 3200);
  }
  function show(id) { $(id)?.classList.remove('hidden'); }
  function hide(id) { $(id)?.classList.add('hidden'); }
  function report(error, fallback) {
    if (!error) return false;
    console.error(fallback, error);
    toast(error.message || fallback);
    return true;
  }
  async function loadProfile() {
    if (!authUser) { profile = null; return; }
    const { data, error } = await supabase.from('profiles').select('id,username').eq('id', authUser.id).maybeSingle();
    if (report(error, 'Profiel laden ging niet.')) return;
    profile = data;
  }
  async function loadRemoteData() {
    if (!authUser || !profile) { ownedPools = []; allInvites = []; return; }
    const [poolsResult, inviteResult] = await Promise.all([
      supabase.rpc('get_my_pools'),
      supabase.rpc('get_my_invites')
    ]);
    if (report(poolsResult.error, 'Poules ophalen ging niet.')) return;
    if (report(inviteResult.error, 'Meldingen ophalen ging niet.')) return;
    ownedPools = poolsResult.data || [];
    allInvites = inviteResult.data || [];
  }
  function renderHeader() {
    $('#accountLabel').textContent = profile ? `@${profile.username}` : authUser ? 'Naam kiezen' : 'Inloggen';
    $('#signOutButton').classList.toggle('hidden', !authUser);
    $('#deleteAccountButton').classList.toggle('hidden', !authUser);
    const count = allInvites.filter((item) => item.invitee_id === authUser?.id && item.status === 'pending').length;
    $('#noticeCount').textContent = count > 9 ? '9+' : String(count);
    $('#noticeCount').classList.toggle('hidden', count === 0);
    $('#notificationsButton').setAttribute('aria-label', count ? `Meldingen, ${count} uitnodigingen` : 'Meldingen');
    $('#socialSubtitle').textContent = profile
      ? `Online als @${profile.username}. Je poules worden gesynchroniseerd.`
      : authUser ? 'Kies eerst je gebruikersnaam om poules te gebruiken.' : 'Gebruik een klascode met een tijdelijke gebruikersnaam.';
    $('#accountIntro').textContent = profile
      ? `Je bent online ingelogd als @${profile.username}. Je vrienden zien alleen je gekozen gebruikersnaam.`
      : authUser ? 'Kies een gebruikersnaam van 2–20 tekens. Andere spelers zien deze naam in poules.'
        : 'Doe mee met een klascode met alleen een tijdelijke gebruikersnaam, of gebruik Apple/Google.';
    const note = document.querySelector('.social-note');
    note.textContent = 'Je poules en uitnodigingen worden online bewaard en zijn beschikbaar op je andere apparaten.';
  }
  async function refresh() {
    const { data, error } = await supabase.auth.getSession();
    if (report(error, 'Aanmeldstatus controleren ging niet.')) return;
    authUser = data.session?.user || null;
    await loadProfile();
    await loadRemoteData();
    renderHeader();
    renderPools();
    if (authUser && !profile) show('#accountModal');
  }
  function renderPools() {
    const host = $('#poolList');
    host.innerHTML = '';
    if (!authUser) {
      host.innerHTML = '<div class="empty-pools">Log in met Apple of Google om online poules te gebruiken.</div>';
      return;
    }
    if (!profile) {
      host.innerHTML = '<div class="empty-pools">Kies eerst een gebruikersnaam via je profielknop.</div>';
      return;
    }
    if (!ownedPools.length) {
      host.innerHTML = '<div class="empty-pools">Je zit nog niet in een poule. Maak er zelf een of accepteer een uitnodiging. ✨</div>';
      return;
    }
    for (const pool of ownedPools) {
      const members = pool.members || [];
      const ranking = members.map((member, index) => `<div class="leader-row"><span>${index + 1}. @${esc(member.username)}${member.role === 'owner' ? ' 👑' : ''}</span><strong>${member.points || 0} pt</strong></div>`).join('');
      const pending = allInvites.filter((invite) => invite.pool_id === pool.id && invite.inviter_id === authUser.id && invite.status === 'pending')
        .map((invite) => `<div class="pool-sub">⏳ Uitnodiging naar @${esc(invite.invitee_username)} verstuurd</div>`).join('');
      const owner = pool.owner_id === authUser.id;
      host.insertAdjacentHTML('beforeend', `<article class="pool-card"><h3>👯 ${esc(pool.name)}</h3><p class="pool-sub">${members.length} speler${members.length === 1 ? '' : 's'} · ${owner ? 'Jij bent beheerder' : `Beheerder: @${esc(members.find((m) => m.role === 'owner')?.username || 'speler')}`}</p><div class="pool-code-row"><span>Klascode</span><span class="class-code">${esc(pool.join_code || '------')}</span><button data-copy-code="${esc(pool.join_code || '')}">Kopieer</button></div><div class="pool-members">${members.map((m) => `${m.role === 'owner' ? '👑 ' : ''}@${esc(m.username)}${m.role === 'owner' ? ' · beheerder' : ''}`).join('<br>')}</div><div class="pool-members"><strong>🏆 Poulescore</strong>${ranking}</div>${pending}<div class="pool-actions"><button class="pool-action" data-pool-invite="${esc(pool.id)}">＋ Uitnodigen</button>${owner ? `<button class="pool-action danger" data-pool-delete="${esc(pool.id)}">Poule verwijderen</button>` : `<button class="pool-action secondary" data-pool-leave="${esc(pool.id)}">Poule verlaten</button>`}</div></article>`);
    }
  }
  async function renderNotices() {
    await loadRemoteData();
    renderHeader();
    const list = $('#noticeList');
    list.innerHTML = '';
    if (!authUser || !profile) {
      list.innerHTML = '<div class="empty-pools">Log in en kies een gebruikersnaam om uitnodigingen te ontvangen.</div>';
      return;
    }
    const incoming = allInvites.filter((invite) => invite.invitee_id === authUser.id && invite.status === 'pending');
    const outgoing = allInvites.filter((invite) => invite.inviter_id === authUser.id && invite.status === 'pending');
    if (!incoming.length && !outgoing.length) {
      list.innerHTML = '<div class="empty-pools">Geen nieuwe meldingen. Lekker doorspelen! 🌟</div>';
      return;
    }
    for (const invite of incoming) list.insertAdjacentHTML('beforeend', `<div class="notice-item"><strong>@${esc(invite.inviter_username)} nodigt je uit!</strong>Kom bij de poule <b>${esc(invite.pool_name)}</b>.<div class="notice-actions"><button class="accept-invite" data-accept="${esc(invite.id)}">Accepteren</button><button class="decline-invite" data-decline="${esc(invite.id)}">Weigeren</button></div></div>`);
    for (const invite of outgoing) list.insertAdjacentHTML('beforeend', `<div class="notice-item"><strong>Uitnodiging verstuurd</strong>@${esc(invite.invitee_username)} is uitgenodigd voor <b>${esc(invite.pool_name)}</b>.</div>`);
  }
  async function requireProfile() {
    if (!authUser) { show('#accountModal'); toast('Log eerst in met Apple of Google.'); return false; }
    if (!profile) { show('#accountModal'); toast('Kies eerst je gebruikersnaam.'); return false; }
    return true;
  }
  async function startOAuth(provider) {
    const redirectTo = native ? appScheme : `${window.location.origin}${window.location.pathname}`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: native, queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined }
    });
    if (report(error, `${provider} aanmelden ging niet.`)) return;
    if (native && data.url) await Browser.open({ url: data.url });
  }
  for (const button of $$('[data-provider]')) button.onclick = () => startOAuth(button.dataset.provider.toLowerCase());
  $('#guestLoginButton').onclick = async () => {
    if (authUser) { if (!profile) show('#accountModal'); return; }
    const { error } = await supabase.auth.signInAnonymously();
    if (report(error, 'Tijdelijk profiel maken ging niet.')) return;
    await refresh();
    toast('Je kunt nu meedoen met alleen een gebruikersnaam.');
  };
  $('#accountButton').onclick = async () => {
    $('#usernameInput').value = profile?.username || '';
    $('#signOutButton').classList.toggle('hidden', !authUser);
    $('#saveUsername').textContent = profile ? 'Gebruikersnaam wijzigen' : 'Gebruikersnaam opslaan';
    show('#accountModal');
    if (authUser && !profile) $('#usernameInput').focus();
  };
  $('#saveUsername').onclick = async () => {
    if (!authUser) { toast('Log eerst in met Apple of Google.'); return; }
    const username = $('#usernameInput').value.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_-]{2,20}$/.test(username)) { toast('Kies 2–20 letters, cijfers, _ of -.'); return; }
    const { error } = await supabase.from('profiles').upsert({ id: authUser.id, username }, { onConflict: 'id' });
    if (report(error, 'Gebruikersnaam opslaan ging niet.')) return;
    await refresh();
    hide('#accountModal');
    toast(`Welkom, @${username}!`);
  };
  $('#signOutButton').onclick = async () => {
    const { error } = await supabase.auth.signOut();
    if (report(error, 'Uitloggen ging niet.')) return;
    hide('#accountModal');
    await refresh();
  };
  $('#deleteAccountButton').onclick = () => show('#accountDeleteModal');
  $('#confirmDeleteAccount').onclick = async () => {
    const { error } = await supabase.functions.invoke('delete-account');
    if (report(error, 'Account verwijderen ging niet.')) return;
    hide('#accountDeleteModal');
    hide('#accountModal');
    await supabase.auth.signOut();
    await refresh();
    toast('Je account en bijbehorende gegevens zijn verwijderd.');
  };
  $('#createPoolButton').onclick = async () => {
    if (!await requireProfile()) return;
    $('#poolNameInput').value = '';
    show('#poolModal');
    $('#poolNameInput').focus();
  };
  $('#joinPoolButton').onclick = async () => {
    if (!await requireProfile()) return;
    document.querySelector('#joinPoolModal .class-help')?.classList.add('hidden');
    $('#joinCodeInput').value = '';
    show('#joinPoolModal');
    $('#joinCodeInput').focus();
  };
  $('#joinPoolSave').onclick = async () => {
    if (!await requireProfile()) return;
    const code = $('#joinCodeInput').value.trim().toUpperCase();
    if (!/^[A-F0-9]{6}$/.test(code)) { toast('Vul de klascode van 6 tekens in.'); return; }
    const { error } = await supabase.rpc('join_pool_by_code', { p_code: code });
    if (report(error, 'Deze klascode is niet gevonden.')) return;
    hide('#joinPoolModal');
    await refresh();
    toast('Je bent bij de klas! 🎉');
  };
  $('#joinCodeInput').onkeydown = (event) => { if (event.key === 'Enter') $('#joinPoolSave').click(); };
  $('#savePool').onclick = async () => {
    if (!await requireProfile()) return;
    const name = $('#poolNameInput').value.trim();
    if (name.length < 2 || name.length > 32) { toast('De naam moet 2 tot 32 tekens lang zijn.'); return; }
    const { error } = await supabase.rpc('create_pool', { p_name: name });
    if (report(error, 'Poule maken ging niet. Controleer de online dienst.')) return;
    hide('#poolModal');
    await refresh();
    toast('Poule gemaakt! Jij bent de beheerder 👑');
  };
  $('#poolNameInput').onkeydown = (event) => { if (event.key === 'Enter') $('#savePool').click(); };
  $('#notificationsButton').onclick = async () => {
    if (!authUser) { show('#accountModal'); toast('Log in om je meldingen te bekijken.'); return; }
    await renderNotices();
    show('#notificationsModal');
  };
  $('#poolList').onclick = async (event) => {
    const copyButton = event.target.closest('[data-copy-code]');
    if (copyButton) {
      const code = copyButton.dataset.copyCode;
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(() => toast('Klascode gekopieerd!')).catch(() => toast(`Klascode: ${code}`));
      else toast(`Klascode: ${code}`);
      return;
    }
    const inviteButton = event.target.closest('[data-pool-invite]');
    if (inviteButton) {
      selectedInvitePool = inviteButton.dataset.poolInvite;
      const pool = ownedPools.find((item) => item.id === selectedInvitePool);
      $('#inviteDescription').textContent = `Nodig iemand uit voor ${pool?.name || 'de poule'}.`;
      $('#inviteUsernameInput').value = '';
      $('#safeInviteCheck').checked = false;
      show('#inviteModal');
      $('#inviteUsernameInput').focus();
      return;
    }
    const deleteButton = event.target.closest('[data-pool-delete]');
    if (deleteButton) {
      deletingPool = deleteButton.dataset.poolDelete;
      const pool = ownedPools.find((item) => item.id === deletingPool);
      $('#deleteDescription').textContent = `Weet je zeker dat je de poule “${pool?.name || ''}” en de bijbehorende uitnodigingen wilt verwijderen?`;
      show('#deleteModal');
      return;
    }
    const leaveButton = event.target.closest('[data-pool-leave]');
    if (leaveButton) {
      const { error } = await supabase.from('pool_members').delete().eq('pool_id', leaveButton.dataset.poolLeave).eq('user_id', authUser.id);
      if (report(error, 'Poule verlaten ging niet.')) return;
      await refresh();
      toast('Je hebt de poule verlaten.');
    }
  };
  $('#sendInvite').onclick = async () => {
    const username = $('#inviteUsernameInput').value.trim().replace(/^@/, '').toLowerCase();
    if (!selectedInvitePool || !username) { toast('Vul een gebruikersnaam in.'); return; }
    if (!$('#safeInviteCheck').checked) { toast('Vink eerst de online-veiligheidsafspraak aan.'); return; }
    const { error } = await supabase.rpc('invite_to_pool', { p_pool_id: selectedInvitePool, p_username: username });
    if (report(error, 'Uitnodiging versturen ging niet.')) return;
    hide('#inviteModal');
    await refresh();
    toast(`Uitnodiging voor @${username} verstuurd.`);
  };
  $('#inviteUsernameInput').onkeydown = (event) => { if (event.key === 'Enter') $('#sendInvite').click(); };
  $('#noticeList').onclick = async (event) => {
    const accept = event.target.closest('[data-accept]');
    const decline = event.target.closest('[data-decline]');
    const inviteId = accept?.dataset.accept || decline?.dataset.decline;
    if (!inviteId) return;
    const { error } = await supabase.rpc('respond_to_invitation', { p_invite_id: inviteId, p_accept: Boolean(accept) });
    if (report(error, 'Uitnodiging verwerken ging niet.')) return;
    await refresh();
    await renderNotices();
    toast(accept ? 'Je bent bij de poule gekomen! 🎉' : 'Uitnodiging geweigerd.');
  };
  $('#confirmDeletePool').onclick = async () => {
    if (!deletingPool) return;
    const { error } = await supabase.from('pools').delete().eq('id', deletingPool).eq('owner_id', authUser.id);
    if (report(error, 'Poule verwijderen ging niet.')) return;
    deletingPool = null;
    hide('#deleteModal');
    await refresh();
    toast('Poule verwijderd.');
  };
  $('#inviteUsernameInput').onkeydown = (event) => { if (event.key === 'Enter') $('#sendInvite').click(); };
  window.tafelheldenAddPoints = async (points) => {
    if (!authUser || !profile) return;
    const { error } = await supabase.rpc('record_pool_points', { p_points: points });
    if (!error) await refresh();
  };
  $('#socialSubtitle').textContent = 'Verbinden met online poules…';
  supabase.auth.onAuthStateChange(() => { setTimeout(() => refresh(), 0); });
  if (native) App.addListener('appUrlOpen', async ({ url }) => {
    if (!url?.startsWith(appScheme)) return;
    try {
      const callback = new URL(url);
      const code = callback.searchParams.get('code');
      if (code) await supabase.auth.exchangeCodeForSession(code);
      else {
        const fragment = new URLSearchParams(callback.hash.slice(1));
        const access_token = fragment.get('access_token');
        const refresh_token = fragment.get('refresh_token');
        if (access_token && refresh_token) await supabase.auth.setSession({ access_token, refresh_token });
      }
      await Browser.close();
      await refresh();
    } catch (error) { report(error, 'Aanmelding afronden ging niet.'); }
  });
  refresh();
}
