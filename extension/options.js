<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Calendar → Work Focus — Settings</title>
  <style>
    body{font:14px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin:16px;}
    .row{margin:8px 0}
    .grid{display:grid; grid-template-columns: 2fr 1fr 1fr; gap:8px; align-items:center}
    .muted{opacity:0.8}
    code{background:#f5f5f5; padding:2px 4px; border-radius:4px}
    fieldset{margin:12px 0; border:1px solid #ddd; border-radius:8px; padding:12px}
  </style>
</head>
<body>
  <h2>Calendar → Work Focus</h2>

  <fieldset>
    <legend>Google OAuth (required once)</legend>
    <div class="row">Client ID<br><input id="clientId" style="width:100%" placeholder="xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com"></div>
    <div class="row">Client Secret<br><input id="clientSecret" style="width:100%" placeholder="xxxxxxxxxxxxxxxxxxxx"></div>
    <div class="muted">Redirect URI must be <code>https://&lt;EXTENSION_ID&gt;.chromiumapp.org/oauth2</code></div>
    <div class="row"><button id="addAccount">+ Add Google Account</button></div>
  </fieldset>

  <fieldset>
    <legend>Accounts & Calendars</legend>
    <div id="accounts"></div>
  </fieldset>

  <fieldset>
    <legend>Preferences</legend>
    <label>Lead-in seconds <input type="number" id="leadInSec" value="60" min="0"></label>
    &nbsp; &nbsp;
    <label>Lag-out seconds <input type="number" id="lagOutSec" value="60" min="0"></label>
    <br><br>
    <label><input type="checkbox" id="ignoreAllDay" checked> Ignore all-day events</label>
    <br>
    <label><input type="checkbox" id="requireVideoLink" checked> Require join link</label>
    <br>
    <label><input type="checkbox" id="callPageAwareness" checked> Force on during active call tab</label>
    <br><br>
    <label>Focus name <input id="focusName" value="Work"></label>
    <br><br>
    <button id="save">Save Preferences</button>
  </fieldset>

  <script src="options.js"></script>
</body>
</html>
