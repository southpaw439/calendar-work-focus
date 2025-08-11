# calendar-work-focus

Chrome extension + macOS helper that turns on **Work Focus** (DND) during busy meetings and while you’re on an active call tab — only when you’re active on your Mac.

## Quick Start (Public Distribution)

1) **Install the extension** from the Chrome Web Store: `[ADD LINK]`

2) **Download the Helper** from GitHub Releases: `[ADD LATEST RELEASE LINK]`  
   Unzip and run these commands in **Terminal**:
   ```bash
   sudo mkdir -p /usr/local/bin
   sudo cp payload/focusbridge /usr/local/bin/focusbridge
   sudo chmod +x /usr/local/bin/focusbridge

   mkdir -p "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
   cp "payload/com.readyai.focusbridge.json" \
      "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.readyai.focusbridge.json"
   	3.	Install the Shortcuts
	•	Download Enable Work Focus.shortcut and Disable Work Focus.shortcut from Releases (or the shortcuts/ folder).
	•	Double-click each to add.
	•	macOS Settings → Focus → Share Across Devices = ON (optional; quiets iPhone too).
	4.	Open the extension Options
	•	Paste Google OAuth Client ID/Secret (or click “Use Publisher OAuth” if provided).
	•	Click + Add Google Account → grant access.
	•	Select calendars. Recommended defaults:
	•	Busy-only (enforced)
	•	Require join link: ON
	•	Lead-in: 60s, Lag-out: 60s
	•	Call-page awareness: ON
	•	Focus name: Work
	5.	Test
	•	Create a Busy meeting starting now with a Meet/Zoom link. Keep Mac active.
	•	Within ~30s, Work Focus should turn ON.
	•	After the meeting ends (plus lag-out), it turns OFF.
	•	Opening a Meet/Zoom/Teams tab also forces Focus ON while that tab is active.

Dev / Maintainer Notes

Build helper via GitHub Actions
	•	Go to Actions → build-helper → Run workflow.
	•	Enter your Chrome Web Store extension ID.
	•	A draft Release will be created with helper_payload.zip containing:
	•	payload/focusbridge (CLI)
	•	payload/com.readyai.focusbridge.json (manifest with your store ID baked in)

Google OAuth Setup
	•	Enable Google Calendar API in Google Cloud.
	•	Create OAuth Web application client with redirect URI:
 
```
https://<WEB_STORE_EXTENSION_ID>.chromiumapp.org/oauth2
```
 
Share the Client ID/Secret with users (paste into Options), or add a “Use Publisher OAuth” button in Options.

Local Dev (optional)
	•	Load unpacked from extension/ at chrome://extensions.
	•	If testing unpacked, the extension ID differs; patch the native host manifest accordingly.

Troubleshooting
	•	Helper not found: Ensure files exist exactly at the paths above.
	•	OAuth fails: Redirect must be https://<STORE_ID>.chromiumapp.org/oauth2 in Google Cloud.
	•	No trigger: Event must be Busy and within lead/lag; if “Require join link” is ON, the event needs a Meet/Zoom/Teams link.
	•	Phone still pings: Enable Share Across Devices in macOS Focus.

Privacy

Only calendar.readonly scope; data stays local in Chrome storage.

License

MIT
```
say **“next”** if you also want the optional pkg scripts (`pkg/postinstall`, `pkg/make_pkg.sh`) and a sample MIT `LICENSE`.
```
