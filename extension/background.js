// Calendar → Work Focus — background
// Core logic: OAuth, FreeBusy check, Events details (video-link), call-page awareness, idle detection, native bridge.

const CALL_DOMAINS = [
  "meet.google.com","zoom.us","teams.microsoft.com","webex.com","dialpad.com",
  "whereby.com","around.co","riverside.fm","bluejeans.com","gotomeeting.com"
];

const DEFAULTS = {
  leadInSec: 60,
  lagOutSec: 60,
  ignoreAllDay: true,
  requireVideoLink: true,
  focusName: "Work",
  callPageAwareness: true
};

let state = {
  focusOn: false,
  lastReason: "",
  accounts: [], // [{ email, tokens:{access_token, refresh_token, expiry}, calendars:[{id, summary, enabled}] }]
  cfg: { ...DEFAULTS },
};

// Boot
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("tick", { periodInMinutes: 0.5 }); // ~30s
});

chrome.alarms.onAlarm.addListener(a => { if (a.name === "tick") tick(); });
chrome.tabs.onActivated.addListener(() => tick());
chrome.tabs.onUpdated.addListener(() => tick());
chrome.idle.onStateChanged.addListener(() => tick());

// Messages from options/popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type === "get_state") {
      await load();
      sendResponse({ accounts: state.accounts, cfg: state.cfg, focusOn: state.focusOn, lastReason: state.lastReason });
    }
    if (msg?.type === "save_cfg") {
      state.cfg = { ...DEFAULTS, ...(msg.cfg||{}) };
      await save();
      sendResponse({ ok: true });
    }
    if (msg?.type === "oauth_add_account") {
      const acct = await oauthAddAccount();
      if (acct) {
        state.accounts.push(acct);
        await save();
        sendResponse({ ok: true, account: { email: acct.email } });
      } else sendResponse({ ok: false });
    }
    if (msg?.type === "toggle_calendar") {
      const { email, calId, enabled } = msg;
      const acct = state.accounts.find(a => a.email === email);
      if (acct) {
        const c = (acct.calendars||[]).find(c => c.id === calId);
        if (c) c.enabled = !!enabled;
        await save();
        sendResponse({ ok: true });
      }
    }
    if (msg?.type === "remove_account") {
      state.accounts = state.accounts.filter(a => a.email !== msg.email);
      await save();
      sendResponse({ ok: true });
    }
  })();
  return true; // async
});

async function tick() {
  await load();
  const active = await isMacActive();
  if (!active) return maybeToggle(false, "Mac idle");

  if (state.cfg.callPageAwareness) {
    const [onCall, reason] = await isOnCallPage();
    if (onCall) return maybeToggle(true, reason);
  }

  const inMeeting = await isInMeetingNow();
  return maybeToggle(inMeeting, inMeeting ? "Busy meeting" : "No meeting");
}

function isMacActive() {
  return new Promise(res => chrome.idle.queryState(60, s => res(s === "active")));
}

async function isOnCallPage() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.url) return [false, ""];
  try {
    const host = new URL(tab.url).hostname.replace(/^www\./, "");
    const hit = CALL_DOMAINS.some(dom => host === dom || host.endsWith("."+dom));
    return [hit, hit ? `Call page: ${host}` : ""];
  } catch { return [false, ""]; }
}

async function isInMeetingNow() {
  const now = Date.now();
  const cfg = state.cfg;
  const timeMin = new Date(now - (cfg.leadInSec||60)*1000).toISOString();
  const timeMax = new Date(now + (cfg.lagOutSec||60)*1000).toISOString();

  for (const acct of state.accounts) {
    if (!acct.tokens) continue;
    await ensureFreshToken(acct).catch(()=>{});

    const selected = (acct.calendars||[]).filter(c => c.enabled).map(c=>c.id);
    if (!selected.length) continue;

    // FreeBusy first
    const fbRes = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${acct.tokens.access_token}` },
      body: JSON.stringify({ timeMin, timeMax, items: selected.map(id=>({id})) })
    });
    if (!fbRes.ok) continue;
    const fb = await fbRes.json();
    const busyCalendars = Object.entries(fb.calendars||{})
      .filter(([_id,obj]) => (obj.busy||[]).some(win => overlapsNow(win, now, cfg)))
      .map(([id])=>id);
    if (!busyCalendars.length) continue;

    if (cfg.requireVideoLink) {
      // confirm at least one busy event has a join link
      for (const calId of busyCalendars) {
        const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`);
        url.searchParams.set("timeMin", timeMin);
        url.searchParams.set("timeMax", timeMax);
        url.searchParams.set("singleEvents", "true");
        url.searchParams.set("orderBy", "startTime");
        const r = await fetch(url, { headers: { Authorization: `Bearer ${acct.tokens.access_token}` } });
        if (!r.ok) continue;
        const data = await r.json();
        const items = (data.items||[]).filter(e => filterEventBusy(e, now, cfg));
        if (items.some(hasJoinLink)) return true;
      }
      continue; // none had join links
    }

    return true; // Busy now and no video-link requirement
  }
  return false;
}

function overlapsNow(win, nowMs, cfg) {
  const st = new Date(win.start).getTime();
  const en = new Date(win.end).getTime();
  return nowMs >= st - (cfg.leadInSec||60)*1000 && nowMs <= en + (cfg.lagOutSec||60)*1000;
}

function filterEventBusy(e, nowMs, cfg) {
  if (e.status === "cancelled") return false;
  const isAllDay = !!e.start?.date && !!e.end?.date;
  if (isAllDay && cfg.ignoreAllDay) return false;
  const transparency = (e.transparency || "opaque").toLowerCase();
  if (transparency === "transparent") return false; // Busy-only
  const st = new Date(e.start.dateTime || e.start.date).getTime();
  const en = new Date(e.end.dateTime || e.end.date).getTime();
  return nowMs >= st - (cfg.leadInSec||60)*1000 && nowMs <= en + (cfg.lagOutSec||60)*1000;
}

function hasJoinLink(e) {
  if (e.conferenceData?.entryPoints?.length) return true;
  const blob = [e.location, e.description, e.hangoutLink].filter(Boolean).join(" ");
  if (!blob) return false;
  try {
    const urls = blob.match(/\bhttps?:\/\/[^\s)]+/g) || [];
    return urls.some(u => {
      const h = new URL(u).hostname.replace(/^www\./,'');
      return CALL_DOMAINS.some(dom => h === dom || h.endsWith("."+dom));
    });
  } catch { return false; }
}

async function maybeToggle(shouldOn, reason) {
  if (state.focusOn === shouldOn) return;
  state.focusOn = shouldOn;
  state.lastReason = reason;
  await save();

  // Try native bridge; fallback to shortcuts:// URL if not installed
  try {
    const port = chrome.runtime.connectNative("com.readyai.focusbridge");
    port.postMessage({ cmd: shouldOn ? "on" : "off", focusName: state.cfg.focusName || "Work" });
    port.disconnect();
  } catch (e) {
    // Fallback (may prompt; not ideal)
    const name = encodeURIComponent(`${shouldOn ? 'Enable' : 'Disable'} ${state.cfg.focusName||'Work'} Focus`);
    chrome.tabs.create({ url: `shortcuts://run-shortcut?name=${name}` });
  }

  chrome.action.setBadgeText({ text: shouldOn ? "ON" : "" });
}

async function load() {
  const s = await chrome.storage.local.get(["accounts", "cfg", "focusOn", "lastReason"]);
  state.accounts = s.accounts || [];
  state.cfg = { ...DEFAULTS, ...(s.cfg||{}) };
  state.focusOn = !!s.focusOn;
  state.lastReason = s.lastReason || "";
}

async function save() {
  await chrome.storage.local.set({ accounts: state.accounts, cfg: state.cfg, focusOn: state.focusOn, lastReason: state.lastReason });
}

// ===== OAuth (multi-account) =====
const OAUTH = {
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  scope: [
    "https://www.googleapis.com/auth/calendar.readonly",
    "openid","email","profile"
  ].join(' '),
  redirectPath: "oauth2"
};

async function oauthAddAccount() {
  const redirectUri = chrome.identity.getRedirectURL(OAUTH.redirectPath);
  const stateStr = Math.random().toString(36).slice(2);

  // NOTE: You must create an OAuth Client ID (Web) and allow the redirect URI: https://<EXTENSION_ID>.chromiumapp.org/oauth2
  const cfg = await chrome.storage.local.get(["oauthClientId","oauthClientSecret"]);
  const clientId = cfg.oauthClientId; const clientSecret = cfg.oauthClientSecret;
  if (!clientId || !clientSecret) { alertOnce("Missing OAuth client credentials in Options"); return null; }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent select_account",
    scope: OAUTH.scope,
    state: stateStr
  });
  const url = `${OAUTH.authUrl}?${params.toString()}`;
  const redirect = await chrome.identity.launchWebAuthFlow({ url, interactive: true });
  const parsed = new URL(redirect);
  if (parsed.searchParams.get("state") !== stateStr) throw new Error("State mismatch");
  const code = parsed.searchParams.get("code");

  const tokenRes = await fetch(OAUTH.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    })
  });
  const t = await tokenRes.json();
  if (!t.access_token) return null;
  const expiry = Date.now() + (t.expires_in||3600)*1000;
  const tokens = { ...t, expiry };

  // Identify account email
  const who = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` }}).then(r=>r.json()).catch(()=>({}));
  const email = who.email || `account_${Math.random().toString(36).slice(2)}@unknown`;

  // Fetch calendarList
  const cals = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", { headers: { Authorization: `Bearer ${tokens.access_token}` } }).then(r=>r.json());
  const calendars = (cals.items||[]).map(it => ({ id: it.id, summary: it.summaryOverride || it.summary || it.id, enabled: it.primary || false }));

  return { email, tokens, calendars };
}

async function ensureFreshToken(acct) {
  if (acct.tokens && Date.now() < (acct.tokens.expiry||0) - 30000) return;
  const cfg = await chrome.storage.local.get(["oauthClientId","oauthClientSecret"]);
  if (!acct.tokens?.refresh_token) throw new Error("No refresh token");
  const r = await fetch(OAUTH.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: acct.tokens.refresh_token,
      client_id: cfg.oauthClientId,
      client_secret: cfg.oauthClientSecret,
      grant_type: "refresh_token"
    })
  });
  const t = await r.json();
  if (!t.access_token) throw new Error("refresh failed");
  acct.tokens = { ...acct.tokens, ...t, expiry: Date.now() + (t.expires_in||3600)*1000 };
  await save();
}

let alerted = false;
function alertOnce(msg){ if (!alerted) { alerted = true; chrome.notifications.create({ type:'basic', iconUrl:'assets/icon128.png', title:'Calendar → Work Focus', message: msg }); setTimeout(()=>alerted=false, 5000); } }
