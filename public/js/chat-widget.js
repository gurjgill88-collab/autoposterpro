// ============================================
// VINNY THE CAR SALESMAN - EMBEDDABLE CHAT WIDGET
// Add this script to any page: <script src="/js/chat-widget.js"></script>
// ============================================

(function() {
  // Inject styles
  const styles = `
    .chat-widget{position:fixed;bottom:20px;right:20px;z-index:9999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    .chat-toggle{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%);border:none;cursor:pointer;box-shadow:0 4px 20px rgba(124,58,237,.4);display:flex;align-items:center;justify-content:center;transition:transform .3s,box-shadow .3s}
    .chat-toggle:hover{transform:scale(1.1);box-shadow:0 6px 30px rgba(124,58,237,.5)}
    .chat-toggle svg{width:28px;height:28px;fill:#fff}
    .chat-toggle .close-icon{display:none}
    .chat-widget.open .chat-toggle .chat-icon{display:none}
    .chat-widget.open .chat-toggle .close-icon{display:block}
    .chat-badge{position:absolute;top:-5px;right:-5px;background:#f97316;color:#fff;font-size:11px;font-weight:700;padding:4px 8px;border-radius:10px;animation:pulse 2s infinite}
    @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
    .chat-widget.open .chat-badge{display:none}
    .chat-window{position:absolute;bottom:80px;right:0;width:380px;height:520px;background:#0f0a1a;border-radius:20px;box-shadow:0 10px 40px rgba(0,0,0,.5);display:none;flex-direction:column;overflow:hidden;border:1px solid #2d2640}
    .chat-widget.open .chat-window{display:flex}
    @media(max-width:500px){.chat-window{width:calc(100vw - 40px);height:70vh;right:-10px}}
    .chat-header{background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%);padding:16px 20px;display:flex;align-items:center;gap:12px}
    .chat-avatar{width:44px;height:44px;background:rgba(255,255,255,.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px}
    .chat-header-info h4{color:#fff;font-size:16px;margin:0 0 2px}
    .chat-header-info p{color:rgba(255,255,255,.8);font-size:12px;margin:0}
    .status-dot{width:8px;height:8px;background:#22c55e;border-radius:50%;display:inline-block;margin-right:4px;animation:blink 2s infinite}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:.5}}
    .chat-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px}
    .chat-messages::-webkit-scrollbar{width:6px}
    .chat-messages::-webkit-scrollbar-track{background:transparent}
    .chat-messages::-webkit-scrollbar-thumb{background:#2d2640;border-radius:3px}
    .message{max-width:85%;padding:12px 16px;border-radius:16px;font-size:14px;line-height:1.5;animation:fadeIn .3s ease}
    @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    .message.bot{background:#1a1425;color:#fff;border-bottom-left-radius:4px;align-self:flex-start}
    .message.user{background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%);color:#fff;border-bottom-right-radius:4px;align-self:flex-end}
    .typing-indicator{display:none;align-self:flex-start;padding:12px 16px;background:#1a1425;border-radius:16px;border-bottom-left-radius:4px}
    .typing-indicator.show{display:flex;gap:4px}
    .typing-indicator span{width:8px;height:8px;background:#7c3aed;border-radius:50%;animation:typing 1.4s infinite}
    .typing-indicator span:nth-child(2){animation-delay:.2s}
    .typing-indicator span:nth-child(3){animation-delay:.4s}
    @keyframes typing{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
    .quick-replies{display:flex;flex-wrap:wrap;gap:8px;padding:0 20px 15px}
    .quick-reply{background:transparent;border:1px solid #7c3aed;color:#7c3aed;padding:8px 16px;border-radius:20px;font-size:13px;cursor:pointer;transition:all .2s}
    .quick-reply:hover{background:#7c3aed;color:#fff}
    .chat-input-area{padding:16px;border-top:1px solid #2d2640;display:flex;gap:10px}
    .chat-input{flex:1;background:#1a1425;border:1px solid #2d2640;border-radius:24px;padding:12px 18px;color:#fff;font-size:14px;outline:none}
    .chat-input:focus{border-color:#7c3aed}
    .chat-input::placeholder{color:#6b7280}
    .chat-send{width:44px;height:44px;background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%);border:none;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .2s}
    .chat-send:hover{transform:scale(1.1)}
    .chat-send svg{width:20px;height:20px;fill:#fff}
    .message a{color:#f97316;text-decoration:underline}
  `;
  
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
  
  // Inject HTML
  const widgetHTML = `
    <div class="chat-widget" id="vinnyChat">
      <button class="chat-toggle" onclick="VinnyChat.toggle()">
        <span class="chat-badge">1</span>
        <svg class="chat-icon" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
        <svg class="close-icon" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
      </button>
      <div class="chat-window">
        <div class="chat-header">
          <div class="chat-avatar">🚗</div>
          <div class="chat-header-info">
            <h4>Vinny from AutoPosterPro</h4>
            <p><span class="status-dot"></span>Online • Sales Rep of the Month</p>
          </div>
        </div>
        <div class="chat-messages" id="vinnyChatMessages"></div>
        <div class="typing-indicator" id="vinnyTyping"><span></span><span></span><span></span></div>
        <div class="quick-replies" id="vinnyQuickReplies"></div>
        <div class="chat-input-area">
          <input type="text" class="chat-input" id="vinnyChatInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')VinnyChat.send()">
          <button class="chat-send" onclick="VinnyChat.send()">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;
  
  const container = document.createElement('div');
  container.innerHTML = widgetHTML;
  document.body.appendChild(container.firstElementChild);
  
  // Vinny's personality database
  const VINNY = {
    greetings: [
      "Hey there, friend! 👋 Welcome to the lot! I'm Vinny, your AutoPosterPro specialist. What brings you in today?",
      "Well well well, look who just pulled up! 🚗 I'm Vinny. You've come to the RIGHT place!",
      "Hey champ! 👊 Vinny here. Ready to sell more cars than you ever thought possible?",
    ],
    pricingIntro: "Ah, pricing! Let me grab my rate card... 📋 *shuffles papers*",
    pricing: `
Here's what we're working with:

**🚀 Starter** - $219/month
• 1 user • AI-Powered • Automated Images • Email Support

**⚡ Professional** - $1,199/month
• 6-11 users • Priority Support • Team Onboarding

**🏢 Enterprise** - $1,799/month  
• 12-20 users • Dedicated Account Manager • Custom Training

Now that's the sticker price... but 🤫 **we've got PROMOS running right now.** Let me talk to my manager!

What size dealership are we talking?`,
    promos: [
      "Between us? My manager's been on my case to hit quota. That works in YOUR favor! 💰",
      "I can probably knock something off if we shake hands today. My manager owes me one.",
      "You caught me on a good day! Let me see what kind of deal I can put together...",
    ],
    closes: [
      "Look, I want to make this work. If I can sharpen my pencil on the setup fee, can we shake hands today? 🤝",
      "Tell you what - let me see if I can get my manager to cut the setup cost in half. But I need a commitment today. We got a deal?",
      "I'm gonna be straight with you - I can probably work some magic on the setup fee if we can close this out right now. What do you say?",
      "Here's what I can do... if you're ready to pull the trigger today, I'll go to bat for you on the setup. Sound fair?",
      "Between us? I've got some wiggle room on the setup costs. But my manager's only gonna approve it if I can close today. You in?",
    ],
    carLingo: [
      "This baby's got LOW MILES on the code!",
      "We're talking CHERRY condition software!",
      "What's it gonna take to get you into this software today?",
      "Let me get you the keys for a test drive! 🔑",
      "I've had three other dealers kicking the tires today!",
    ],
    fillers: ["*adjusts tie* 👔", "*sips coffee* ☕", "*leans in conspiratorially*", "*checks for manager*"],
    howItWorks: `Let me show you how this baby runs! 🚗💨

**Step 1:** Click one button - all car info gets scraped automatically!
**Step 2:** AI writes a UNIQUE description - no shadowbans!
**Step 3:** Hit post - 30 seconds vs 15 minutes!

Want me to walk you through a demo? 🎬`,
    features: `This thing's fully loaded! 🎉

✅ **AI Descriptions** - Unique for every car
✅ **Automated Images** - No manual uploads
✅ **Universal Scraper** - Works with ANY dealer site
✅ **One-Click Posting** - My grandma could do it 👵
✅ **Shadowban Protection** - Stay off Facebook's radar

What feature caught your eye? 👀`,
  };
  
  // Chat state
  let history = [];
  let started = false;
  
  function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  
  window.VinnyChat = {
    toggle: function() {
      const widget = document.getElementById('vinnyChat');
      widget.classList.toggle('open');
      if (!started) {
        started = true;
        setTimeout(() => {
          this.botSay(rand(VINNY.greetings));
          this.showReplies(['Tell me about pricing', 'How does it work?', 'What features?']);
        }, 500);
      }
    },
    
    botSay: function(text) {
      const el = document.createElement('div');
      el.className = 'message bot';
      el.innerHTML = text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
      document.getElementById('vinnyChatMessages').appendChild(el);
      this.scroll();
      history.push({ role: 'bot', text });
    },
    
    userSay: function(text) {
      const el = document.createElement('div');
      el.className = 'message user';
      el.textContent = text;
      document.getElementById('vinnyChatMessages').appendChild(el);
      this.scroll();
      history.push({ role: 'user', text });
    },
    
    scroll: function() {
      const m = document.getElementById('vinnyChatMessages');
      m.scrollTop = m.scrollHeight;
    },
    
    showTyping: function() { document.getElementById('vinnyTyping').classList.add('show'); this.scroll(); },
    hideTyping: function() { document.getElementById('vinnyTyping').classList.remove('show'); },
    
    showReplies: function(arr) {
      document.getElementById('vinnyQuickReplies').innerHTML = arr.map(r => 
        `<button class="quick-reply" onclick="VinnyChat.reply('${r.replace(/'/g, "\\'")}')">${r}</button>`
      ).join('');
    },
    clearReplies: function() { document.getElementById('vinnyQuickReplies').innerHTML = ''; },
    
    reply: function(text) {
      this.clearReplies();
      this.userSay(text);
      this.process(text);
    },
    
    send: function() {
      const input = document.getElementById('vinnyChatInput');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      this.clearReplies();
      this.userSay(text);
      this.process(text);
    },
    
    process: function(text) {
      const lower = text.toLowerCase();
      let response = '';
      let replies = [];
      
      this.showTyping();
      
      if (lower.match(/price|cost|how much|pricing/)) {
        response = VINNY.pricingIntro + '\n\n' + VINNY.pricing;
        replies = ['Small dealer (1 user)', 'Mid-size (6-11)', 'Large (12-20)', "That's expensive"];
      }
      else if (lower.match(/how.*(work|use)/)) {
        response = VINNY.howItWorks;
        replies = ['Show features', 'Pricing?', 'Schedule demo'];
      }
      else if (lower.match(/feature|what can|what does/)) {
        response = VINNY.features;
        replies = ['Pricing', 'How it works', 'Sign me up!'];
      }
      else if (lower.match(/expensive|too much|cheaper/)) {
        response = "I hear ya... but how much time does your team spend posting manually? That's MONEY walking out! 💸\n\n" + rand(VINNY.carLingo);
        replies = ['What promos?', 'Need to think', "Let's talk numbers"];
      }
      else if (lower.match(/promo|deal|discount|special/)) {
        response = rand(VINNY.promos) + '\n\n' + rand(VINNY.fillers) + '\n\n' + rand(VINNY.closes);
        replies = ['Sign me up!', 'Tell me more', 'Need to think'];
      }
      else if (lower.match(/sign.?up|ready|interested|deal|let'?s do/)) {
        response = "NOW we're talking! 🎉 " + rand(VINNY.carLingo) + "\n\nAlright, let me see what I can do on the setup costs... *punches numbers into calculator* 🧮\n\nIf I can get my manager to give you a better deal on the setup, can we shake hands right now? 🤝\n\n👉 <a href='/pricing'>Let's make it official!</a>\n\nOr tell me what you need to make this happen today!";
        replies = ['Go to pricing', 'What about setup costs?', 'More questions'];
      }
      else if (lower.match(/demo|show me|see it/)) {
        response = "Smart move! Kick the tires first! 🧠\n\n👉 <a href='/contact'>Schedule a Demo</a>\n\nI'll personally walk you through everything!";
        replies = ['Contact form', 'Explain posting', 'Features'];
      }
      else if (lower.match(/small|1 user|just me|solo/)) {
        response = "Solo operation! Respect the hustle! 💪\n\n**Starter at $219/month** is PERFECT. " + rand(VINNY.promos);
        replies = ['Sign me up!', 'What promos?', 'Need to think'];
      }
      else if (lower.match(/mid|6|7|8|9|10|11|medium/)) {
        response = "Mid-size - the sweet spot! 🎯\n\n**Professional at $1,199/month** - your whole floor posting at once!\n\n" + rand(VINNY.promos);
        replies = ["Let's do it!", 'Current promos?', 'Team demo?'];
      }
      else if (lower.match(/large|12|enterprise|big|20/)) {
        response = "BIG operation! Now we're cooking! 🔥\n\n**Enterprise at $1,799/month** - dedicated account manager, the works!\n\n" + rand(VINNY.promos);
        replies = ['Schedule call', 'Enterprise promos?', 'Tell me more'];
      }
      else if (lower.match(/^(hi|hello|hey|yo|sup)/)) {
        response = rand(VINNY.greetings);
        replies = ['Pricing', 'How it works', 'Features'];
      }
      else if (lower.match(/contact|call|email|phone/)) {
        response = "Want a real human? I'm slightly offended! 😂\n\n📧 support@autoposterpro.com\n👉 <a href='/contact'>Contact Form</a>";
        replies = ['Contact form', 'Pricing', 'Question'];
      }
      else {
        response = rand(VINNY.fillers) + " " + rand(VINNY.carLingo) + "\n\nGreat question! Looking for:\n• **Pricing**\n• **Features**\n• **How it works**?";
        replies = ['Pricing', 'Features', 'How it works'];
      }
      
      setTimeout(() => {
        this.hideTyping();
        this.botSay(response);
        if (replies.length) setTimeout(() => this.showReplies(replies), 300);
      }, 1200 + Math.random() * 800);
    }
  };
})();
