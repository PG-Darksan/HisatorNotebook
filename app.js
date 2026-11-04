/* HisatorNotebook 共通スクリプト
   - ナビゲーションのアクティブ状態
   - スクロール検知でナビにボーダー
   - 出現アニメーション (.reveal)
   - 料金トグル (月額 / 年額)
   - FAQ アコーディオン
   - 言語切替UI と 初回訪問時の自動言語検出
*/
(function () {
  'use strict';

  /* ── 言語 ──
     ページの言語は <html lang> (ja / en / zh-Hans / pt-BR …) の頭の 2 文字。 各言語版は
     _i18n/build.py が日本語のページから作る (en/ zh/ ko/ es/ fr/ de/ pt/ ru/)。
     以前はブラウザの言語へ自動で飛ばしていたが、 Google は言語による自動転送を勧めて
     いない (検索ロボットが日本語のトップを英語版への転送と見なしかねない) ので、
     ブラウザの言語の版がある時は上に案内の帯を出すだけにした。 言語メニューで選ぶか
     帯を閉じたら localStorage の "lang_chosen" = "true" で以後は出さない。 */
  const PAGE_LANG = (document.documentElement.lang || 'ja').toLowerCase().split('-')[0];
  const HREFLANG = { ja: 'ja', en: 'en', zh: 'zh-Hans', ko: 'ko', es: 'es', fr: 'fr', de: 'de', pt: 'pt', ru: 'ru' };

  // 案内の帯の言葉は「案内する先の言語」で書く
  const SUGGEST = {
    ja: ['このページは日本語でもご覧いただけます。', '日本語で見る', '閉じる'],
    en: ['This page is also available in English.', 'View in English', 'Close'],
    zh: ['本页面也提供简体中文版。', '查看中文版', '关闭'],
    ko: ['이 페이지는 한국어로도 볼 수 있습니다.', '한국어로 보기', '닫기'],
    es: ['Esta página también está disponible en español.', 'Ver en español', 'Cerrar'],
    fr: ['Cette page est aussi disponible en français.', 'Voir en français', 'Fermer'],
    de: ['Diese Seite gibt es auch auf Deutsch.', 'Auf Deutsch ansehen', 'Schließen'],
    pt: ['Esta página também está disponível em português.', 'Ver em português', 'Fechar'],
    ru: ['Эта страница доступна и на русском языке.', 'Открыть на русском', 'Закрыть']
  };

  function langChosen() {
    try { return localStorage.getItem('lang_chosen') === 'true'; } catch (e) { return true; }
  }
  function rememberLangChoice() {
    try { localStorage.setItem('lang_chosen', 'true'); } catch (e) { /* 保存できなくても動く */ }
  }

  (function suggestLanguage() {
    if (langChosen()) return;
    const want = (navigator.language || 'ja').toLowerCase().split('-')[0];
    if (want === PAGE_LANG || !SUGGEST[want]) return;
    const alt = document.querySelector(`link[rel="alternate"][hreflang="${HREFLANG[want]}"]`);
    if (!alt || !alt.href) return;
    const [msg, go, close] = SUGGEST[want];
    const bar = document.createElement('div');
    bar.className = 'lang-suggest';
    bar.setAttribute('role', 'region');
    bar.setAttribute('lang', HREFLANG[want]);
    bar.innerHTML = '<span class="lang-suggest-msg"></span><a class="lang-suggest-go"></a>' +
      '<button type="button" class="lang-suggest-close">×</button>';
    bar.querySelector('.lang-suggest-msg').textContent = msg;
    const link = bar.querySelector('.lang-suggest-go');
    link.textContent = go;
    link.href = alt.getAttribute('href');
    link.hreflang = HREFLANG[want];
    link.addEventListener('click', rememberLangChoice);
    const x = bar.querySelector('.lang-suggest-close');
    x.setAttribute('aria-label', close);
    x.addEventListener('click', () => { rememberLangChoice(); bar.remove(); });
    document.body.appendChild(bar);
  })();

  // 画面に出す言葉 (ページの言語で)。 無い言語は英語
  const STR = {
    ja: {
      annual: (t, s) => `✓ 年額 $${t} 一括 / 通常より $${s} お得`,
      name: 'お名前を入力してください。', email: 'メールアドレスを入力してください。',
      emailBad: '正しいメールアドレスを入力してください。', cat: 'お問い合わせの種類を選択してください。',
      msg: 'メッセージを入力してください。', msgShort: '10 文字以上入力してください。', sending: '送信中…',
      fail: '送信に失敗しました。 時間を空けて再度お試しください。',
      network: '通信エラーが発生しました。 ネットワークをご確認ください。'
    },
    en: {
      annual: (t, s) => `✓ $${t} billed yearly / save $${s}`,
      name: 'Please enter your name.', email: 'Please enter your email address.',
      emailBad: 'Please enter a valid email address.', cat: 'Please choose a topic.',
      msg: 'Please enter a message.', msgShort: 'Please enter at least 10 characters.', sending: 'Sending…',
      fail: 'Sending failed. Please try again later.',
      network: 'A network error occurred. Please check your connection.'
    },
    zh: {
      annual: (t, s) => `✓ 按年一次付 $${t} / 比按月节省 $${s}`,
      name: '请输入您的姓名。', email: '请输入电子邮箱地址。',
      emailBad: '请输入有效的电子邮箱地址。', cat: '请选择咨询类型。',
      msg: '请输入留言内容。', msgShort: '请至少输入 10 个字符。', sending: '发送中…',
      fail: '发送失败，请稍后再试。',
      network: '网络错误，请检查网络连接。'
    },
    ko: {
      annual: (t, s) => `✓ 연간 $${t} 일시불 / 월간 대비 $${s} 절약`,
      name: '이름을 입력해 주세요.', email: '이메일 주소를 입력해 주세요.',
      emailBad: '올바른 이메일 주소를 입력해 주세요.', cat: '문의 유형을 선택해 주세요.',
      msg: '메시지를 입력해 주세요.', msgShort: '10자 이상 입력해 주세요.', sending: '전송 중…',
      fail: '전송에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      network: '통신 오류가 발생했습니다. 네트워크를 확인해 주세요.'
    },
    es: {
      annual: (t, s) => `✓ $${t} al año en un solo pago / ahorras $${s}`,
      name: 'Escribe tu nombre.', email: 'Escribe tu correo electrónico.',
      emailBad: 'Escribe un correo electrónico válido.', cat: 'Elige el tipo de consulta.',
      msg: 'Escribe tu mensaje.', msgShort: 'Escribe al menos 10 caracteres.', sending: 'Enviando…',
      fail: 'No se pudo enviar. Inténtalo de nuevo más tarde.',
      network: 'Error de conexión. Revisa tu red.'
    },
    fr: {
      annual: (t, s) => `✓ $${t} facturés une fois par an / $${s} d’économie`,
      name: 'Veuillez saisir votre nom.', email: 'Veuillez saisir votre adresse e-mail.',
      emailBad: 'Veuillez saisir une adresse e-mail valide.', cat: 'Veuillez choisir le type de demande.',
      msg: 'Veuillez saisir votre message.', msgShort: 'Veuillez saisir au moins 10 caractères.', sending: 'Envoi…',
      fail: 'L’envoi a échoué. Veuillez réessayer plus tard.',
      network: 'Erreur réseau. Veuillez vérifier votre connexion.'
    },
    de: {
      annual: (t, s) => `✓ $${t} jährlich in einer Zahlung / $${s} gespart`,
      name: 'Bitte geben Sie Ihren Namen ein.', email: 'Bitte geben Sie Ihre E-Mail-Adresse ein.',
      emailBad: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.', cat: 'Bitte wählen Sie die Art der Anfrage.',
      msg: 'Bitte geben Sie eine Nachricht ein.', msgShort: 'Bitte geben Sie mindestens 10 Zeichen ein.', sending: 'Wird gesendet…',
      fail: 'Senden fehlgeschlagen. Bitte versuchen Sie es später erneut.',
      network: 'Netzwerkfehler. Bitte prüfen Sie Ihre Verbindung.'
    },
    pt: {
      annual: (t, s) => `✓ $${t} por ano em um só pagamento / economize $${s}`,
      name: 'Informe seu nome.', email: 'Informe seu e-mail.',
      emailBad: 'Informe um e-mail válido.', cat: 'Escolha o tipo de contato.',
      msg: 'Escreva sua mensagem.', msgShort: 'Escreva pelo menos 10 caracteres.', sending: 'Enviando…',
      fail: 'Falha no envio. Tente novamente mais tarde.',
      network: 'Erro de conexão. Verifique sua rede.'
    },
    ru: {
      annual: (t, s) => `✓ $${t} за год одним платежом / экономия $${s}`,
      name: 'Введите ваше имя.', email: 'Введите адрес электронной почты.',
      emailBad: 'Введите корректный адрес электронной почты.', cat: 'Выберите тему обращения.',
      msg: 'Введите сообщение.', msgShort: 'Введите не менее 10 символов.', sending: 'Отправка…',
      fail: 'Не удалось отправить. Повторите попытку позже.',
      network: 'Ошибка сети. Проверьте подключение.'
    }
  };
  const L = STR[PAGE_LANG] || STR.en;


  /* ── 全ページ共通の宇宙背景 (home 以外に固定レイヤーを挿入) ──
     トップの hero 装飾と同じ惑星・星雲・星座・流れ星を、 各ページの最背面に
     position:fixed で敷く。 home (data-page="home") は hero 内に専用装飾が
     あるため挿入しない。 点描の星空は body::before/::after で全ページ共通。 */
  (function injectCosmicBg() {
    if (document.body.dataset.page === 'home') return;
    if (document.querySelector('.cosmic-bg')) return;
    var layer = document.createElement('div');
    layer.className = 'cosmic-bg';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = `<!-- 土星 (リアル版 - 多層・大気・縞模様・カッシーニの空隙) -->
        <svg class="planet planet-saturn" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="satSphere" cx="32%" cy="28%" r="85%">
              <stop offset="0%" stop-color="#FFF0C8"/>
              <stop offset="15%" stop-color="#F5D88E"/>
              <stop offset="35%" stop-color="#D9A857"/>
              <stop offset="60%" stop-color="#9C7234"/>
              <stop offset="85%" stop-color="#4A3018"/>
              <stop offset="100%" stop-color="#0F0A05"/>
            </radialGradient>
            <radialGradient id="satShadow" cx="80%" cy="65%" r="60%">
              <stop offset="40%" stop-color="rgba(0,0,0,0)"/>
              <stop offset="100%" stop-color="rgba(0,0,0,0.65)"/>
            </radialGradient>
            <radialGradient id="satAtmos" cx="50%" cy="50%" r="50%">
              <stop offset="78%" stop-color="rgba(255,232,176,0)"/>
              <stop offset="88%" stop-color="rgba(255,232,176,0.18)"/>
              <stop offset="100%" stop-color="rgba(255,232,176,0)"/>
            </radialGradient>
            <linearGradient id="ringFront" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stop-color="rgba(150,100,50,0)"/>
              <stop offset="8%" stop-color="rgba(180,130,70,0.6)"/>
              <stop offset="20%" stop-color="rgba(232,199,126,0.95)"/>
              <stop offset="35%" stop-color="rgba(255,235,180,1)"/>
              <stop offset="44%" stop-color="rgba(160,110,60,0.45)"/>
              <stop offset="48%" stop-color="rgba(80,55,30,0.3)"/>
              <stop offset="52%" stop-color="rgba(80,55,30,0.3)"/>
              <stop offset="56%" stop-color="rgba(160,110,60,0.45)"/>
              <stop offset="65%" stop-color="rgba(255,235,180,1)"/>
              <stop offset="80%" stop-color="rgba(232,199,126,0.95)"/>
              <stop offset="92%" stop-color="rgba(180,130,70,0.6)"/>
              <stop offset="100%" stop-color="rgba(150,100,50,0)"/>
            </linearGradient>
            <linearGradient id="ringBack" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stop-color="rgba(150,100,50,0)"/>
              <stop offset="15%" stop-color="rgba(180,130,70,0.35)"/>
              <stop offset="35%" stop-color="rgba(232,199,126,0.5)"/>
              <stop offset="50%" stop-color="rgba(255,235,180,0.55)"/>
              <stop offset="65%" stop-color="rgba(232,199,126,0.5)"/>
              <stop offset="85%" stop-color="rgba(180,130,70,0.35)"/>
              <stop offset="100%" stop-color="rgba(150,100,50,0)"/>
            </linearGradient>
            <clipPath id="satClip"><circle cx="120" cy="120" r="50"/></clipPath>
            <filter id="satGlow"><feGaussianBlur stdDeviation="6"/></filter>
          </defs>
          <!-- 大気のハロー -->
          <circle cx="120" cy="120" r="60" fill="url(#satAtmos)" filter="url(#satGlow)"/>
          <!-- 後ろ側の環 (惑星の上半分) -->
          <g transform="rotate(-22 120 120)">
            <path d="M 18 120 Q 120 100 222 120" stroke="url(#ringBack)" stroke-width="4" fill="none"/>
            <path d="M 26 120 Q 120 104 214 120" stroke="rgba(232,199,126,0.4)" stroke-width="1.5" fill="none"/>
          </g>
          <!-- 惑星本体 -->
          <circle cx="120" cy="120" r="50" fill="url(#satSphere)"/>
          <!-- 縞模様 (clip-pathで球面内に) -->
          <g clip-path="url(#satClip)" opacity="0.7">
            <path d="M 70 102 Q 120 96 170 104" stroke="rgba(255,235,180,0.45)" stroke-width="2.5" fill="none"/>
            <path d="M 70 112 Q 120 108 170 114" stroke="rgba(160,110,60,0.5)" stroke-width="2" fill="none"/>
            <path d="M 70 120 Q 120 116 170 122" stroke="rgba(255,235,180,0.35)" stroke-width="3" fill="none"/>
            <path d="M 70 130 Q 120 126 170 132" stroke="rgba(120,80,40,0.55)" stroke-width="2" fill="none"/>
            <path d="M 70 138 Q 120 134 170 140" stroke="rgba(255,235,180,0.3)" stroke-width="1.8" fill="none"/>
            <ellipse cx="100" cy="125" rx="8" ry="3" fill="rgba(120,80,40,0.4)"/>
          </g>
          <!-- ハイライト -->
          <ellipse cx="100" cy="100" rx="15" ry="9" fill="rgba(255,250,230,0.35)" filter="url(#satGlow)"/>
          <!-- 影 -->
          <circle cx="120" cy="120" r="50" fill="url(#satShadow)"/>
          <!-- 前面の環 (惑星の下半分) -->
          <g transform="rotate(-22 120 120)">
            <path d="M 18 120 Q 120 140 222 120" stroke="url(#ringFront)" stroke-width="8" fill="none"/>
            <path d="M 26 120 Q 120 137 214 120" stroke="rgba(255,250,230,0.4)" stroke-width="1.5" fill="none"/>
            <path d="M 36 120 Q 120 134 204 120" stroke="rgba(80,55,30,0.4)" stroke-width="0.8" fill="none"/>
          </g>
        </svg>
<!-- 火星 (右側) -->
<svg class="planet planet-mars" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="marsSphere" cx="35%" cy="30%" r="78%">
      <stop offset="0%" stop-color="#E89B6C"/><stop offset="40%" stop-color="#C8633A"/>
      <stop offset="80%" stop-color="#7E3A1E"/><stop offset="100%" stop-color="#2A1208"/>
    </radialGradient>
    <radialGradient id="marsShadow" cx="75%" cy="68%" r="62%">
      <stop offset="45%" stop-color="rgba(0,0,0,0)"/><stop offset="100%" stop-color="rgba(0,0,0,0.5)"/>
    </radialGradient>
  </defs>
  <circle cx="50" cy="50" r="40" fill="url(#marsSphere)"/>
  <ellipse cx="40" cy="42" rx="10" ry="5" fill="rgba(120,50,25,0.4)"/>
  <ellipse cx="60" cy="60" rx="8" ry="4" fill="rgba(120,50,25,0.35)"/>
  <circle cx="37" cy="34" r="6" fill="rgba(255,220,180,0.25)"/>
  <circle cx="50" cy="50" r="40" fill="url(#marsShadow)"/>
</svg>
<!-- 星雲 (ガス雲、左下) -->
        <svg class="nebula nebula-1" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="nebulaPurple" cx="40%" cy="50%" r="50%">
              <stop offset="0%" stop-color="rgba(160,100,200,0.55)"/>
              <stop offset="40%" stop-color="rgba(120,70,180,0.3)"/>
              <stop offset="100%" stop-color="rgba(40,20,80,0)"/>
            </radialGradient>
            <radialGradient id="nebulaGold" cx="60%" cy="55%" r="40%">
              <stop offset="0%" stop-color="rgba(232,199,126,0.4)"/>
              <stop offset="60%" stop-color="rgba(184,150,104,0.15)"/>
              <stop offset="100%" stop-color="rgba(120,80,40,0)"/>
            </radialGradient>
            <filter id="nebulaBlur"><feGaussianBlur stdDeviation="10"/></filter>
          </defs>
          <ellipse cx="160" cy="200" rx="180" ry="140" fill="url(#nebulaPurple)" filter="url(#nebulaBlur)"/>
          <ellipse cx="240" cy="220" rx="150" ry="100" fill="url(#nebulaGold)" filter="url(#nebulaBlur)"/>
          <ellipse cx="200" cy="180" rx="100" ry="60" fill="rgba(180,130,200,0.2)" filter="url(#nebulaBlur)" transform="rotate(25 200 180)"/>
        </svg>
<!-- 星座 (オリオン風 右上) -->
        <svg class="constellation constellation-1" viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
          <line x1="20" y1="40" x2="60" y2="20" stroke="rgba(232,199,126,0.4)" stroke-width="0.7"/>
          <line x1="60" y1="20" x2="110" y2="50" stroke="rgba(232,199,126,0.4)" stroke-width="0.7"/>
          <line x1="110" y1="50" x2="150" y2="35" stroke="rgba(232,199,126,0.4)" stroke-width="0.7"/>
          <line x1="110" y1="50" x2="140" y2="95" stroke="rgba(232,199,126,0.4)" stroke-width="0.7"/>
          <line x1="150" y1="35" x2="185" y2="60" stroke="rgba(232,199,126,0.4)" stroke-width="0.7"/>
          <circle cx="20" cy="40" r="2.5" fill="#FFE8B0"/>
          <circle cx="60" cy="20" r="3" fill="#FFFFFF"/>
          <circle cx="110" cy="50" r="3.2" fill="#FFE8B0"/>
          <circle cx="150" cy="35" r="2.7" fill="#FFFFFF"/>
          <circle cx="185" cy="60" r="2.2" fill="#FFE8B0"/>
          <circle cx="140" cy="95" r="2.5" fill="#FFFFFF"/>
        </svg>
<!-- 星座 (北斗七星風 中下) -->
        <svg class="constellation constellation-2" viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg">
          <line x1="15" y1="30" x2="55" y2="55" stroke="rgba(232,199,126,0.35)" stroke-width="0.7"/>
          <line x1="55" y1="55" x2="90" y2="40" stroke="rgba(232,199,126,0.35)" stroke-width="0.7"/>
          <line x1="90" y1="40" x2="130" y2="70" stroke="rgba(232,199,126,0.35)" stroke-width="0.7"/>
          <line x1="55" y1="55" x2="80" y2="85" stroke="rgba(232,199,126,0.35)" stroke-width="0.7"/>
          <circle cx="15" cy="30" r="2.2" fill="#FFE8B0"/>
          <circle cx="55" cy="55" r="3" fill="#FFFFFF"/>
          <circle cx="90" cy="40" r="2.5" fill="#FFE8B0"/>
          <circle cx="130" cy="70" r="2.7" fill="#FFFFFF"/>
          <circle cx="80" cy="85" r="2.2" fill="#FFE8B0"/>
        </svg>
<!-- 流れ星 -->
<div class="shooting-star shooting-star-1"></div>
<div class="shooting-star shooting-star-2"></div>
<div class="shooting-star shooting-star-3"></div>`;
    document.body.insertBefore(layer, document.body.firstChild);
  })();

  /* ── 言語切替UIの開閉 ── */
  const langSwitcher = document.querySelector('.lang-switcher');
  if (langSwitcher) {
    const toggle = langSwitcher.querySelector('.lang-toggle');
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        langSwitcher.classList.toggle('open');
      });
      // 外側クリックで閉じる
      document.addEventListener('click', (e) => {
        if (!langSwitcher.contains(e.target)) {
          langSwitcher.classList.remove('open');
        }
      });
      // 言語選択時に localStorage に記録
      langSwitcher.querySelectorAll('.lang-menu a').forEach(a => {
        a.addEventListener('click', rememberLangChoice);
      });
    }
  }

  /* ── ナビアクティブ判定 ──
     <body data-page="X"> の値で現在ページを判別し、 該当する nav-link に .active を付与。
  */
  const currentPage = document.body.dataset.page || 'home';
  document.querySelectorAll('.nav-link').forEach(link => {
    const lp = link.dataset.page;
    const isActive = (lp === currentPage);
    link.classList.toggle('active', isActive);
  });

  /* ── スクロール検知 ── */
  const nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });
  }

  /* ── 出現アニメーション ── */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
  }

  /* ── 料金プラン: 月額/年額トグル ── */
  const billingButtons = document.querySelectorAll('.billing-option');
  const priceNums = document.querySelectorAll('.price-amount .num[data-monthly]');
  const annualNotes = document.querySelectorAll('.price-annual-note[data-annual-total]');
  const pricingGrid = document.querySelector('.pricing-grid');

  billingButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const billing = btn.dataset.billing;
      billingButtons.forEach(b => b.classList.toggle('active', b === btn));
      if (pricingGrid) pricingGrid.classList.toggle('billing-annual', billing === 'annual');
      priceNums.forEach(el => {
        el.textContent = billing === 'annual' ? el.dataset.annual : el.dataset.monthly;
      });
      annualNotes.forEach(el => {
        const total = el.dataset.annualTotal;
        if (billing === 'annual') {
          const numEl = el.parentElement && el.parentElement.querySelector('.num[data-monthly]');
          const monthly = numEl ? parseFloat(numEl.dataset.monthly) : 0;
          const monthlyTotal = monthly * 12;
          const saved = (monthlyTotal - parseFloat(total)).toFixed(2);
          el.textContent = L.annual(total, saved);
        } else {
          el.innerHTML = '&nbsp;';
        }
      });
    });
  });

  /* ── FAQ アコーディオン ── */
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-q');
    if (!q) return;
    q.addEventListener('click', () => {
      item.classList.toggle('open');
    });
  });

  /* ── 共通フォーム: ヘルパ ── */
  function showError(input, errorEl, message) {
    input.classList.add('is-error');
    errorEl.textContent = message;
  }
  function clearError(input, errorEl) {
    input.classList.remove('is-error');
    errorEl.textContent = '';
  }

  /* ── お問い合わせフォーム ── */
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    const contactPanel = document.getElementById('contact-panel');
    const thanksPanel = document.getElementById('thanks-panel');
    const cnameInput = document.getElementById('cname');
    const emailInput = document.getElementById('email');
    const categoryInput = document.getElementById('category');
    const messageInput = document.getElementById('message');
    const errCname = document.getElementById('err-cname');
    const errEmail = document.getElementById('err-email');
    const errCat = document.getElementById('err-cat');
    const errMsg = document.getElementById('err-msg');

    contactForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      let hasError = false;

      const nameValue = cnameInput.value.trim();
      if (nameValue === '') {
        showError(cnameInput, errCname, L.name);
        hasError = true;
      } else { clearError(cnameInput, errCname); }

      const emailValue = emailInput.value.trim();
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailValue === '') {
        showError(emailInput, errEmail, L.email);
        hasError = true;
      } else if (!emailPattern.test(emailValue)) {
        showError(emailInput, errEmail, L.emailBad);
        hasError = true;
      } else { clearError(emailInput, errEmail); }

      if (categoryInput.value === '') {
        showError(categoryInput, errCat, L.cat);
        hasError = true;
      } else { clearError(categoryInput, errCat); }

      const messageValue = messageInput.value.trim();
      if (messageValue === '') {
        showError(messageInput, errMsg, L.msg);
        hasError = true;
      } else if (messageValue.length < 10) {
        showError(messageInput, errMsg, L.msgShort);
        hasError = true;
      } else { clearError(messageInput, errMsg); }

      if (hasError) return;

      // Formspree に非同期送信
      // 失敗時はフォームのまま action 属性で通常 POST 送信にフォールバック
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalLabel = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = L.sending;
      }

      try {
        // Cloudflare Worker (/contact) に JSON で送る。 Worker が匿名認証で
        // Firestore の inquiries/ に書き込み、 アプリの受信箱に届く。
        const gotcha = contactForm.querySelector('[name="_gotcha"]');
        const response = await fetch(contactForm.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            name: nameValue,
            email: emailValue,
            category: categoryInput.value,
            message: messageValue,
            _gotcha: gotcha ? gotcha.value : ''
          })
        });

        const data = await response.json().catch(() => null);
        if (response.ok && data && data.ok) {
          contactPanel.hidden = true;
          thanksPanel.hidden = false;
          thanksPanel.scrollIntoView({ behavior: 'smooth' });
        } else {
          showError(messageInput, errMsg, L.fail);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel;
          }
        }
      } catch (err) {
        // ネットワークエラーなど
        showError(messageInput, errMsg, L.network);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalLabel;
        }
      }
    });
  }

  /* ── ダウンロードフォーム ── */
  const dlForm = document.getElementById('dl-form');
  if (dlForm) {
    const formPanel = document.getElementById('dl-form-panel');
    const resultPanel = document.getElementById('dl-result-panel');
    const resetBtn = document.getElementById('dl-reset');
    const greeting = document.getElementById('result-greeting');
    const deptInput = document.getElementById('dl-dept');
    const dlNameInput = document.getElementById('dl-name');
    const telInput = document.getElementById('dl-tel');
    const errDept = document.getElementById('err-dept');
    const errDlName = document.getElementById('err-dl-name');
    const errTel = document.getElementById('err-tel');

    dlForm.addEventListener('submit', (event) => {
      event.preventDefault();
      let hasError = false;
      const deptValue = deptInput.value.trim();
      if (deptValue === '') { showError(deptInput, errDept, '部署名を入力してください。'); hasError = true; }
      else { clearError(deptInput, errDept); }
      const nameValue = dlNameInput.value.trim();
      if (nameValue === '') { showError(dlNameInput, errDlName, 'お名前を入力してください。'); hasError = true; }
      else { clearError(dlNameInput, errDlName); }
      const telValue = telInput.value.trim();
      if (telValue === '') { showError(telInput, errTel, '電話番号を入力してください。'); hasError = true; }
      else { clearError(telInput, errTel); }
      if (hasError) return;
      greeting.innerHTML = deptValue + ' の ' + nameValue + ' さん、有難う御座います！<br>以下のリンクからダウンロードしてください。';
      formPanel.hidden = true;
      resultPanel.hidden = false;
      resultPanel.scrollIntoView({ behavior: 'smooth' });
    });
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        dlForm.reset();
        clearError(deptInput, errDept);
        clearError(dlNameInput, errDlName);
        clearError(telInput, errTel);
        resultPanel.hidden = true;
        formPanel.hidden = false;
        formPanel.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }
})();

/* ── 訪問者数カウント (自前の Worker) ──
   以前は無料の外部サービス (counterapi.dev v1) を使っていたが、 その API が
   廃止されて 410 Gone を返すようになり、 数字が出せなくなっていた。
   今は自分の Worker (api.hisator-notebook.com) の KV で数えている。

     POST /site/visits … 1 つ増やして今の数を返す
     GET  /site/visits … 数えずに今の数だけ返す

   1 セッションにつき 1 回だけ +1 し、 それ以降は取得のみ。 通信に失敗した
   時はカウンター自体を隠す (「—」 のまま置いておくと壊れて見えるため)。 */
(function () {
  var el = document.getElementById('visitor-count');
  if (!el) return;
  var API = 'https://api.hisator-notebook.com/site/visits';
  /* 表示に足す数 (= 依頼: 訪問者数を +510 して見せる)。 */
  var BOOST = 510;
  var counted = false;
  try { counted = !!sessionStorage.getItem('hisator_visit_counted'); } catch (e) {}
  fetch(API, { method: counted ? 'GET' : 'POST' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!counted) {
        try { sessionStorage.setItem('hisator_visit_counted', '1'); } catch (e) {}
      }
      if (!d || typeof d.count !== 'number') throw new Error('bad response');
      /* 表示は下駄を履かせた数にする (= 依頼)。 数え方そのもの (Worker の KV)
         は素の値のままで、 見せ方だけ +BOOST する。 */
      el.textContent = (d.count + BOOST).toLocaleString();
    })
    .catch(function () {
      var box = el.closest ? el.closest('.visitor-counter') : null;
      if (box) box.style.display = 'none';
    });
})();
