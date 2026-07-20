

const BACKEND = "http://127.0.0.1:5000";

// Store logged-in username globally (set by auth.js after login)
window._pallottiUser = null;

const chatHistory = [];
let isLoading = false;

// ════════════════════════════════════════════════════════
//  SEND CHAT
// ════════════════════════════════════════════════════════
async function sendChat(text) {
  if (isLoading) return;

  const input = document.getElementById('chatInput');
  const msg   = text || input.value.trim();
  if (!msg) return;

  const chips = document.getElementById('quickChips');
  if (chips) chips.remove();

  input.value = '';
  input.style.height = 'auto';
  appendChatMsg('user', msg);

  isLoading = true;
  const typingId = appendTyping();

  try {
    const res = await fetch(`${BACKEND}/chat`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        message:  msg,
        username: window._pallottiUser || "guest"
      })
    });

    const data = await res.json();
    removeTyping(typingId);
    appendChatMsg('bot', formatMsg(data.reply));

    // Show language badge if not English
    if (data.language && data.language !== 'en') {
      showLangBadge(data.language);
    }

  } catch (e) {
    removeTyping(typingId);
    appendChatMsg('bot', '⚠️ Cannot connect to backend. Please check the server.');
    console.error(e);
  }

  isLoading = false;
}

// ════════════════════════════════════════════════════════
//  CHAT RECOVERY  (load previous messages from DB)
// ════════════════════════════════════════════════════════
async function loadChatHistory(username) {
  if (!username) return;

  try {
    const res  = await fetch(`${BACKEND}/chat/history?username=${encodeURIComponent(username)}`);
    const data = await res.json();

    if (data.status === "success" && data.history.length > 0) {
      // Show a "recovery banner" at the top
      const msgs = document.getElementById('chat-messages');

      const banner = document.createElement('div');
      banner.style.cssText = `
        background: rgba(200,148,31,0.1);
        border: 1px solid rgba(200,148,31,0.3);
        border-radius: 10px;
        padding: 8px 14px;
        font-size: 12px;
        color: rgba(255,255,255,0.5);
        text-align: center;
        margin-bottom: 8px;
        font-family: 'Outfit', sans-serif;
      `;
      banner.innerHTML = `🕐 Showing last ${data.history.length} messages &nbsp;·&nbsp; <span style="color:#e8b84b;cursor:pointer;" onclick="clearRecoveredHistory(this)">Dismiss</span>`;
      msgs.appendChild(banner);

      // Append each message
      data.history.forEach(row => {
        appendChatMsg(row.role, formatMsg(row.message), row.created_at);
      });

      msgs.scrollTop = msgs.scrollHeight;
    }
  } catch (e) {
    console.log("Chat recovery skipped:", e);
  }
}

function clearRecoveredHistory(el) {
  el.parentElement.remove();
}

// ════════════════════════════════════════════════════════
//  DELETE CHAT
// ════════════════════════════════════════════════════════
async function deleteChat() {
  const username = window._pallottiUser;
  if (!username) return;

  if (!confirm("Delete all your chat history? This cannot be undone.")) return;

  try {
    const res  = await fetch(`${BACKEND}/chat/delete`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ username })
    });
    const data = await res.json();

    if (data.status === "success") {
      // Clear visible chat
      const msgs = document.getElementById('chat-messages');
      msgs.innerHTML = `
        <div class="chat-welcome">
          <h4>👋 Hi there!</h4>
          <p>Chat history cleared. Ask me anything about SVPCET</p>
        </div>
        <div class="quick-chips" id="quickChips">
          <div class="qchip" onclick="quickSend('Tell me about SVPCET')">🏛️ About</div>
          <div class="qchip" onclick="quickSend('What courses are offered?')">📚 Courses</div>
          <div class="qchip" onclick="quickSend('Admission procedure')">📋 Admissions</div>
          <div class="qchip" onclick="quickSend('Fee structure')">💰 Fees</div>
          <div class="qchip" onclick="quickSend('Placement details')">💼 Placements</div>
          <div class="qchip" onclick="quickSend('Campus facilities')">🏗️ Facilities</div>
          <div class="qchip" onclick="quickSend('Hostel information')">🏠 Hostel</div>
          <div class="qchip" onclick="quickSend('Contact and location')">📍 Contact</div>
        </div>`;
      showToast("✅ Chat history deleted.");
    } else {
      showToast("⚠️ " + (data.msg || "Delete failed."), "error");
    }
  } catch (e) {
    showToast("⚠️ Cannot connect to backend.", "error");
  }
}

// ════════════════════════════════════════════════════════
//  LANGUAGE SELECTOR (EN / HI / MR)
// ════════════════════════════════════════════════════════
function injectLangSelector() {
  const header = document.querySelector('.chat-header');
  if (!header || document.getElementById('lang-selector')) return;

  const sel = document.createElement('select');
  sel.id = 'lang-selector';
  sel.style.cssText = `
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(200,148,31,0.35);
    color: rgba(255,255,255,0.7);
    border-radius: 7px;
    padding: 4px 8px;
    font-size: 11px;
    font-family: 'Outfit', sans-serif;
    cursor: pointer;
    outline: none;
    margin-left: auto;
    margin-right: 8px;
  `;
  sel.innerHTML = `
    <option value="en">🌐 EN</option>
    <option value="hi">🇮🇳 HI</option>
    <option value="mr">🟠 MR</option>
  `;
  sel.addEventListener('change', (e) => {
    window._pallottiLang = e.target.value;
    updateQuickChipsLang(e.target.value);
    showToast({"en":"English selected","hi":"हिंदी चुनी गई","mr":"मराठी निवडली"}[e.target.value]);
  });

  // Insert before the status dot
  const statusEl = header.querySelector('.chat-status');
  if (statusEl) header.insertBefore(sel, statusEl);
  else header.appendChild(sel);
}

function updateQuickChipsLang(lang) {
  const chips = document.getElementById('quickChips');
  if (!chips) return;

  const labels = {
    "en": ["🏛️ About","📚 Courses","📋 Admissions","💰 Fees","💼 Placements","🏗️ Facilities","🏠 Hostel","📍 Contact"],
    "hi": ["🏛️ परिचय","📚 कोर्स","📋 प्रवेश","💰 फीस","💼 प्लेसमेंट","🏗️ सुविधाएं","🏠 हॉस्टल","📍 संपर्क"],
    "mr": ["🏛️ परिचय","📚 अभ्यासक्रम","📋 प्रवेश","💰 फी","💼 प्लेसमेंट","🏗️ सुविधा","🏠 वसतिगृह","📍 संपर्क"]
  };

  const queries = {
    "en": ["Tell me about SVPCET","What courses are offered?","Admission procedure","Fee structure","Placement details","Campus facilities","Hostel information","Contact and location"],
    "hi": ["SVPCET के बारे में बताएं","कौन से कोर्स हैं?","प्रवेश प्रक्रिया","फीस क्या है","प्लेसमेंट की जानकारी","कैंपस सुविधाएं","हॉस्टल की जानकारी","संपर्क और पता"],
    "mr": ["SVPCET बद्दल सांगा","कोणते अभ्यासक्रम आहेत?","प्रवेश प्रक्रिया","फी किती आहे","प्लेसमेंट माहिती","कॅम्पस सुविधा","वसतिगृह माहिती","संपर्क व पत्ता"]
  };

  const lbl = labels[lang] || labels["en"];
  const qry = queries[lang] || queries["en"];
  chips.innerHTML = lbl.map((l, i) =>
    `<div class="qchip" onclick="quickSend('${qry[i]}')">${l}</div>`
  ).join('');
}

function showLangBadge(lang) {
  const existing = document.getElementById('lang-badge');
  if (existing) existing.remove();
  const badge = document.createElement('div');
  badge.id = 'lang-badge';
  badge.style.cssText = `
    text-align:center; font-size:10px; color: rgba(255,255,255,0.3);
    font-family:'Outfit',sans-serif; padding: 2px 0 6px;
    animation: fadeUp 0.3s ease;
  `;
  badge.textContent = { "hi": "↑ Replied in Hindi  🇮🇳", "mr": "↑ Replied in Marathi  🟠" }[lang] || '';
  const msgs = document.getElementById('chat-messages');
  if (msgs) msgs.appendChild(badge);
}

// ════════════════════════════════════════════════════════
//  DELETE BUTTON in header
// ════════════════════════════════════════════════════════
function injectDeleteBtn() {
  const userBar = document.getElementById('chat-user-bar');
  if (!userBar || document.getElementById('delete-chat-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'delete-chat-btn';
  btn.title = 'Delete chat history';
  btn.style.cssText = `
    background: transparent !important;
    border: 1px solid rgba(255,80,80,0.3) !important;
    color: rgba(255,100,100,0.6) !important;
    border-radius: 6px !important;
    padding: 3px 9px !important;
    font-size: 11px !important;
    cursor: pointer !important;
    font-family: 'Outfit', sans-serif !important;
    transition: all 0.2s !important;
    margin-left: 6px !important;
  `;
  btn.innerHTML = '🗑️';
  btn.addEventListener('mouseenter', () => {
    btn.style.background = 'rgba(255,80,80,0.1) !important';
    btn.style.borderColor = 'rgba(255,80,80,0.5) !important';
  });
  btn.onclick = deleteChat;
  userBar.appendChild(btn);
}

// ════════════════════════════════════════════════════════
//  TOAST NOTIFICATION
// ════════════════════════════════════════════════════════
function showToast(msg, type = 'success') {
  const existing = document.getElementById('pallotti-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'pallotti-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 90px;
    right: 20px;
    z-index: 99998;
    background: ${type === 'error' ? 'rgba(255,80,80,0.15)' : 'rgba(94,224,94,0.12)'};
    border: 1px solid ${type === 'error' ? 'rgba(255,80,80,0.4)' : 'rgba(94,224,94,0.4)'};
    color: ${type === 'error' ? '#ff9090' : '#7ee87e'};
    padding: 10px 18px;
    border-radius: 10px;
    font-size: 13px;
    font-family: 'Outfit', sans-serif;
    backdrop-filter: blur(8px);
    animation: fadeUp 0.3s ease;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ════════════════════════════════════════════════════════
//  FORMAT MESSAGE
// ════════════════════════════════════════════════════════
function formatMsg(t) {
  if (!t) return '';
  return t
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\n- /g, '<br>• ')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

// ════════════════════════════════════════════════════════
//  APPEND MESSAGE
// ════════════════════════════════════════════════════════
function appendChatMsg(role, text, timestamp) {
  const msgs = document.getElementById('chat-messages');
  const div  = document.createElement('div');
  div.className = `chat-msg ${role === 'user' ? 'user' : ''}`;

  const time = timestamp
    ? `<div style="font-size:9px;color:rgba(255,255,255,0.2);margin-top:4px;font-family:'Outfit',sans-serif;">${timestamp}</div>`
    : '';

  div.innerHTML = `
    <div class="msg-av ${role === 'user' ? 'u' : 'b'}">${role === 'user' ? '👤' : 'P'}</div>
    <div class="msg-bubble ${role === 'user' ? 'user' : 'bot'}">${text}${time}</div>
  `;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

// ════════════════════════════════════════════════════════
//  TYPING INDICATOR
// ════════════════════════════════════════════════════════
function appendTyping() {
  const msgs = document.getElementById('chat-messages');
  const id   = 'ty' + Date.now();
  const div  = document.createElement('div');
  div.className = 'chat-msg';
  div.id = id;
  div.innerHTML = `
    <div class="msg-av b">P</div>
    <div class="msg-bubble bot">
      <div class="typing-indicator"><span></span><span></span><span></span></div>
    </div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ════════════════════════════════════════════════════════
//  QUICK SEND
// ════════════════════════════════════════════════════════
function quickSend(q) {
  sendChat(q);
}

// ════════════════════════════════════════════════════════
//  KEYBOARD HANDLER
// ════════════════════════════════════════════════════════
function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
}

// ════════════════════════════════════════════════════════
//  AUTO-RESIZE TEXTAREA
// ════════════════════════════════════════════════════════
function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

// ════════════════════════════════════════════════════════
//  TOGGLE CHAT (mobile)
// ════════════════════════════════════════════════════════
function toggleChat() {
  const sidebar = document.getElementById('chat-sidebar');
  sidebar.classList.toggle('open');
  document.getElementById('chat-toggle').textContent =
    sidebar.classList.contains('open') ? '✕' : '💬';
}

// ════════════════════════════════════════════════════════
//  VOICE INPUT
// ════════════════════════════════════════════════════════
function startVoice() {
  const input    = document.getElementById("chatInput");
  const voiceBtn = document.querySelector(".voice-btn");

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast("⚠️ Voice not supported in this browser.", "error");
    return;
  }

  // Pick language based on selector
  const langMap = { "en": "en-IN", "hi": "hi-IN", "mr": "mr-IN" };
  const selectedLang = (document.getElementById('lang-selector')?.value) || "en";

  const recognition = new SpeechRecognition();
  recognition.lang = langMap[selectedLang] || "en-IN";
  recognition.interimResults = true;
  recognition.continuous = false;

  voiceBtn.style.backgroundColor = "#b07d14";
  recognition.start();

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    input.value = transcript;
    if (event.results[event.results.length - 1].isFinal) {
      sendChat(transcript);
      input.value = "";
      voiceBtn.style.backgroundColor = "#c8941f";
    }
  };

  recognition.onerror = () => { voiceBtn.style.backgroundColor = "#c8941f"; };
  recognition.onend   = () => { voiceBtn.style.backgroundColor = "#c8941f"; };
}

// ════════════════════════════════════════════════════════
//  INIT — called by auth.js after successful login
// ════════════════════════════════════════════════════════
window._onChatUnlocked = function(username) {
  window._pallottiUser = username;
  injectLangSelector();
  injectDeleteBtn();
  // Load previous chat history
  loadChatHistory(username);
};
