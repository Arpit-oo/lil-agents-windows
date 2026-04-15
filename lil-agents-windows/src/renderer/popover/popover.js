const messagesEl = document.getElementById('messages');
const inputField = document.getElementById('input-field');
const btnRefresh = document.getElementById('btn-refresh');
const btnCopy = document.getElementById('btn-copy');
const providerNameEl = document.getElementById('provider-name');

let lastAssistantText = '';
let currentAssistantEl = null;

function addMessage(role, text, className) {
  const div = document.createElement('div');
  div.className = ('message ' + role + ' ' + (className || '')).trim();
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

inputField.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const text = inputField.value.trim();
    if (!text) return;
    inputField.value = '';

    if (text.startsWith('/')) {
      const cmd = text.slice(1).toLowerCase();
      if (cmd === 'clear') { messagesEl.innerHTML = ''; window.lilAgents.slashCommand('clear'); return; }
      if (cmd === 'copy') { window.lilAgents.copyLast(); return; }
      if (cmd === 'help') { addMessage('system', 'Commands: /clear (clear chat), /copy (copy last response), /help'); return; }
    }

    addMessage('user', text);
    currentAssistantEl = null;
    lastAssistantText = '';
    window.lilAgents.sendMessage(text);
  }
});

window.lilAgents.onStreamText((text) => {
  if (!currentAssistantEl) {
    currentAssistantEl = addMessage('assistant', '');
    lastAssistantText = '';
  }
  lastAssistantText += text;
  currentAssistantEl.textContent = lastAssistantText;
  scrollToBottom();
});

window.lilAgents.onToolUse((name, input) => { addMessage('tool', '[' + name + '] ' + input); });
window.lilAgents.onToolResult((result, isError) => { addMessage('tool', result, isError ? 'error' : ''); });
window.lilAgents.onTurnComplete(() => { currentAssistantEl = null; });
window.lilAgents.onSessionError((error) => { addMessage('error', error, 'error'); });
window.lilAgents.onSessionClear(() => { messagesEl.innerHTML = ''; });
window.lilAgents.onThemeChanged((isDark) => { document.body.classList.toggle('dark', isDark); });

btnRefresh.addEventListener('click', () => { messagesEl.innerHTML = ''; window.lilAgents.refreshSession(); });
btnCopy.addEventListener('click', () => { window.lilAgents.copyLast(); });

window.lilAgents.reportReady();
