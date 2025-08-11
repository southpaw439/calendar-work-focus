(async function(){
  const st = await new Promise(r => chrome.runtime.sendMessage({type:'get_state'}, r));
  const s = document.getElementById('status');
  const badge = st.focusOn ? '●' : '○';
  s.textContent = `${badge} ${st.focusOn ? 'Work Focus ON' : 'Work Focus OFF'} — ${st.lastReason || ''}`;
})();
