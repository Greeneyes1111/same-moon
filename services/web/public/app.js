/* Same Moon: free bedtime stories for children far from home.
   No framework, no tracking, no cookies. */
(() => {
  'use strict';

  const arNum = (n) => Number(n).toLocaleString('ar-EG');

  const UI = {
    en: {
      appName: 'Same Moon', skip: 'Skip to content', language: 'Language',
      offline: "You're offline. Saved stories still work.",
      navStories: 'Stories', navCalm: 'Calm', navGrownUps: 'Grown-ups',
      heroTitle: 'Bedtime stories for children far from home',
      heroText: 'Short, gentle stories about missing people, new languages, new rooms and new streets. Read together, or press play.',
      pills: ['Free', 'No sign-up', 'Works offline', 'No tracking'],
      min: (n) => `${n} min`,
      saved: 'Saved',
      listen: 'Listen', pause: 'Pause', resume: 'Keep listening',
      computerVoice: 'Computer voice',
      readBy: (n) => `Read by ${n}`, volunteerVoice: 'A volunteer',
      noAudio: 'Read it aloud together. A recording is coming soon.',
      save: 'Save for offline', saving: 'Saving…', savedOn: 'Saved on this phone', saveFail: 'Could not save. Try again on Wi-Fi.',
      saveAll: 'Save all stories for offline', allSaved: 'All stories saved on this phone',
      savingN: (i, n) => `Saving ${i} of ${n}…`,
      remove: 'Remove from phone',
      forGrownUps: 'For the grown-up', allStories: 'All stories', nextStory: 'Next story',
      share: 'Share', copied: 'Link copied',
      notFound: 'That story is not in this language yet.',
      loadFail: 'The stories could not load. Check your connection and try again.', retry: 'Try again',
      empty: 'There are no stories in this language yet.',
      calmTitle: 'Blow the bubble',
      calmText: 'Breathe with the circle. Breathe in while it grows. Breathe out slowly while it gets small.',
      calmIn: 'Smell the flower…', calmOut: 'Blow the bubble…', start: 'Start', stop: 'Stop',
      grownUps: [
        ['About Same Moon', ['Same Moon is a small, free library of bedtime stories for children who have had to leave their homes, wherever they are now. The stories are short and gentle, and every one ends calmly. They are about the things children far from home carry with them: missing people, a new language, a new room, new streets.']],
        ['How to use it', [[
          'One story a night is plenty. Read it together, or press play and listen together.',
          'At the end of each story there is a question for you to ask. There is no right answer. The point is to talk.',
          'The Calm page is a breathing exercise. Practise it on easy nights, so it feels familiar on hard ones.',
          'If a story brings up big feelings, that is all right. Stay close, listen, and let your child lead.',
        ]]],
        ['Using it without internet', [[
          "When you have Wi-Fi, open a story and tap 'Save for offline'. It will then play with no internet and no data.",
          "To keep Same Moon on your phone like an app, open your browser menu and choose 'Add to Home screen'.",
        ]]],
        ['Privacy', ['No accounts, no adverts and no tracking. We do not collect anything about you or your child. We only count totals, such as how many times each story is played, so we can see that Same Moon is helping. Saved stories stay on your phone.']],
        ['Safety', ['Every story, and every voice recording, is checked by a person before it appears here. The stories avoid frightening images.']],
        ['For teachers and organisations', ['Same Moon is free to use in classes, clubs and sessions, and free to share. The stories are not about any one country, so they work for children from anywhere.']],
        ['Lend your voice', ['Children often settle best to a voice that sounds like home. If you are 18 or over, you can record a story in your own language or accent.']],
      ],
      recordLink: 'Record a story',
      voiceTitle: 'Lend your voice',
      voiceIntro: 'Record one of the stories in your own language or accent. A person listens to every recording before anyone else hears it. You must be 18 or over. Please record in a quiet room.',
      fStory: 'Story', fLang: 'Language of the text', fDialect: 'Your accent or dialect (optional)', fDialectPh: 'For example: Sudanese Arabic',
      fCredit: 'Name to show (optional)', fCreditPh: 'For example: Amal',
      fAdult: 'I am 18 or over.', fConsent: 'I agree that my recording can be shared freely in Same Moon.',
      readThis: 'Read this aloud:', recStart: 'Start recording', recStop: 'Stop', recAgain: 'Record again',
      orUpload: 'Or choose a recording from your phone', send: 'Send recording', sending: 'Sending…',
      sentTitle: 'Thank you.', sentText: 'We have your recording. A person will listen to it before it is shared.',
      needBoxes: 'Please tick both boxes.', needRecording: 'Please record or choose a recording first.',
      micFail: 'The microphone could not start. You can choose a recording from your phone instead.',
      sendFail: 'Sending failed. Please try again.',
    },
    ar: {
      appName: 'القمر نفسه', skip: 'انتقل إلى المحتوى', language: 'اللغة',
      offline: 'أنت غير متصل بالإنترنت. الحكايات المحفوظة ما زالت تعمل.',
      navStories: 'الحكايات', navCalm: 'هدوء', navGrownUps: 'للكبار',
      heroTitle: 'حكايات قبل النوم للأطفال البعيدين عن بيوتهم',
      heroText: 'حكايات قصيرة ولطيفة عن الاشتياق، واللغة الجديدة، والغرفة الجديدة، والشوارع الجديدة. اقرؤوها معًا، أو اضغطوا للاستماع.',
      pills: ['مجانية', 'دون تسجيل', 'تعمل دون إنترنت', 'دون تتبّع'],
      min: (n) => (n === 1 ? 'دقيقة واحدة' : n === 2 ? 'دقيقتان' : n <= 10 ? `${arNum(n)} دقائق` : `${arNum(n)} دقيقة`),
      saved: 'محفوظة',
      listen: 'استمع', pause: 'إيقاف مؤقت', resume: 'تابع الاستماع',
      computerVoice: 'صوت حاسوبي',
      readBy: (n) => `بصوت ${n}`, volunteerVoice: 'بصوت متطوّع',
      noAudio: 'اقرؤوها معًا بصوت عالٍ. التسجيل الصوتي قادم قريبًا.',
      save: 'احفظها للاستماع دون إنترنت', saving: 'جارٍ الحفظ…', savedOn: 'محفوظة على هذا الهاتف',
      saveAll: 'احفظ كل الحكايات للاستماع دون إنترنت', allSaved: 'كل الحكايات محفوظة على هذا الهاتف',
      savingN: (i, n) => `جارٍ الحفظ… ${arNum(i)} من ${arNum(n)}`,
      saveFail: 'تعذّر الحفظ. حاولوا مرة أخرى عبر الواي فاي.', remove: 'احذفها من الهاتف',
      forGrownUps: 'للكبار', allStories: 'كل الحكايات', nextStory: 'الحكاية التالية',
      share: 'مشاركة', copied: 'تم نسخ الرابط',
      notFound: 'هذه الحكاية غير متوفرة بهذه اللغة بعد.',
      loadFail: 'تعذّر تحميل الحكايات. تحقّقوا من الاتصال وحاولوا مرة أخرى.', retry: 'حاول مرة أخرى',
      empty: 'لا توجد حكايات بهذه اللغة بعد.',
      calmTitle: 'انفخ الفقاعة',
      calmText: 'تنفّس مع الدائرة. خذ نفسًا وهي تكبر، وأخرجه ببطء وهي تصغر.',
      calmIn: 'شمّ الوردة…', calmOut: 'انفخ الفقاعة…', start: 'ابدأ', stop: 'توقّف',
      grownUps: [
        ['عن «القمر نفسه»', ['«القمر نفسه» مكتبة صغيرة ومجانية من حكايات ما قبل النوم، للأطفال الذين اضطرّوا إلى ترك بيوتهم، أينما كانوا الآن. الحكايات قصيرة ولطيفة، وكل واحدة منها تنتهي بهدوء. وهي عن الأشياء التي يحملها الأطفال البعيدون عن بيوتهم: الاشتياق إلى من يحبّون، ولغة جديدة، وغرفة جديدة، وشوارع جديدة.']],
        ['كيف تستخدمونها', [[
          'حكاية واحدة كل ليلة تكفي. اقرؤوها معًا، أو اضغطوا للاستماع معًا.',
          'في نهاية كل حكاية سؤال لتطرحوه على طفلكم. لا توجد إجابة صحيحة. المهم أن تتحدّثوا.',
          'صفحة «هدوء» تمرين للتنفّس. تدرّبوا عليه في الليالي السهلة، حتى يكون مألوفًا في الليالي الصعبة.',
          'إذا أثارت حكاية مشاعر كبيرة، فلا بأس. ابقوا قريبين، واستمعوا، ودعوا طفلكم يقود الحديث.',
        ]]],
        ['استخدامها دون إنترنت', [[
          'حين يتوفّر الواي فاي، افتحوا الحكاية واضغطوا «احفظها للاستماع دون إنترنت». بعد ذلك ستعمل دون إنترنت ودون استهلاك بيانات.',
          'لإبقاء «القمر نفسه» على هاتفكم مثل التطبيق، افتحوا قائمة المتصفّح واختاروا «إضافة إلى الشاشة الرئيسية».',
        ]]],
        ['الخصوصية', ['لا حسابات، ولا إعلانات، ولا تتبّع. نحن لا نجمع أي معلومات عنكم أو عن أطفالكم. نكتفي بإحصاء الأعداد الإجمالية، مثل عدد مرات الاستماع إلى كل حكاية، لنعرف إن كانت «القمر نفسه» مفيدة. والحكايات المحفوظة تبقى على هاتفكم.']],
        ['الأمان', ['كل حكاية، وكل تسجيل صوتي، يراجعه شخص قبل أن يظهر هنا. والحكايات تتجنّب الصور المخيفة.']],
        ['للمعلّمين والمنظّمات', ['«القمر نفسه» مجانية للاستخدام في الصفوف والأندية والجلسات، ومجانية للمشاركة. الحكايات ليست عن بلد بعينه، فهي تناسب الأطفال من أي مكان.']],
        ['أعِرنا صوتك', ['كثيرًا ما يهدأ الأطفال أكثر مع صوت يشبه صوت البيت. إذا كان عمرك ١٨ عامًا أو أكثر، يمكنك تسجيل حكاية بلغتك أو بلهجتك.']],
      ],
      recordLink: 'سجّل حكاية',
      voiceTitle: 'أعِرنا صوتك',
      voiceIntro: 'سجّل إحدى الحكايات بلغتك أو بلهجتك. يستمع شخص إلى كل تسجيل قبل أن يسمعه أي أحد آخر. يجب أن يكون عمرك ١٨ عامًا أو أكثر. ويُرجى التسجيل في غرفة هادئة.',
      fStory: 'الحكاية', fLang: 'لغة النص', fDialect: 'لهجتك (اختياري)', fDialectPh: 'مثلًا: العربية السودانية',
      fCredit: 'الاسم الذي يظهر (اختياري)', fCreditPh: 'مثلًا: أمل',
      fAdult: 'عمري ١٨ عامًا أو أكثر.', fConsent: 'أوافق على مشاركة تسجيلي مجانًا في «القمر نفسه».',
      readThis: 'اقرأ هذا بصوت عالٍ:', recStart: 'ابدأ التسجيل', recStop: 'إيقاف', recAgain: 'سجّل من جديد',
      orUpload: 'أو اختر تسجيلًا من هاتفك', send: 'أرسل التسجيل', sending: 'جارٍ الإرسال…',
      sentTitle: 'شكرًا لك.', sentText: 'وصلنا تسجيلك. سيستمع إليه شخص قبل مشاركته.',
      needBoxes: 'يُرجى وضع علامة في المربّعين.', needRecording: 'يُرجى التسجيل أو اختيار تسجيل أولًا.',
      micFail: 'لم يعمل الميكروفون. يمكنك اختيار تسجيل من هاتفك بدلًا من ذلك.',
      sendFail: 'لم يتم الإرسال. يُرجى المحاولة مرة أخرى.',
    },
    es: {
      appName: 'La misma luna', skip: 'Ir al contenido', language: 'Idioma',
      offline: 'Estás sin conexión. Los cuentos guardados siguen funcionando.',
      navStories: 'Cuentos', navCalm: 'Calma', navGrownUps: 'Adultos',
      heroTitle: 'Cuentos para dormir para niños lejos de casa',
      heroText: 'Cuentos cortos y tiernos sobre extrañar a alguien, idiomas nuevos, cuartos nuevos y calles nuevas. Léanlos juntos o presionen reproducir.',
      pills: ['Gratis', 'Sin registro', 'Funciona sin internet', 'Sin rastreo'],
      min: (n) => `${n} min`,
      saved: 'Guardado',
      listen: 'Escuchar', pause: 'Pausa', resume: 'Seguir escuchando',
      computerVoice: 'Voz de computadora',
      readBy: (n) => `Lo lee ${n}`, volunteerVoice: 'Lo lee un voluntario',
      noAudio: 'Léanlo juntos en voz alta. La grabación llegará pronto.',
      save: 'Guardar para usar sin internet', saving: 'Guardando…', savedOn: 'Guardado en este teléfono',
      saveAll: 'Guardar todos los cuentos para usar sin internet', allSaved: 'Todos los cuentos guardados en este teléfono',
      savingN: (i, n) => `Guardando ${i} de ${n}…`,
      saveFail: 'No se pudo guardar. Inténtalo de nuevo con wifi.', remove: 'Quitar del teléfono',
      forGrownUps: 'Para el adulto', allStories: 'Todos los cuentos', nextStory: 'Siguiente cuento',
      share: 'Compartir', copied: 'Enlace copiado',
      notFound: 'Este cuento todavía no está en este idioma.',
      loadFail: 'No se pudieron cargar los cuentos. Revisa tu conexión e inténtalo de nuevo.', retry: 'Intentar de nuevo',
      empty: 'Todavía no hay cuentos en este idioma.',
      calmTitle: 'Sopla la burbuja',
      calmText: 'Respira con el círculo. Toma aire mientras crece. Suéltalo despacio mientras se hace pequeño.',
      calmIn: 'Huele la flor…', calmOut: 'Sopla la burbuja…', start: 'Empezar', stop: 'Parar',
      grownUps: [
        ['Sobre La misma luna', ['La misma luna es una pequeña biblioteca gratuita de cuentos para dormir para niños que tuvieron que dejar su casa, estén donde estén ahora. Los cuentos son cortos y tiernos, y todos terminan con calma. Tratan de las cosas que llevan consigo los niños lejos de casa: extrañar a alguien, un idioma nuevo, un cuarto nuevo, calles nuevas.']],
        ['Cómo usarlo', [[
          'Un cuento por noche es suficiente. Léanlo juntos, o presionen reproducir y escúchenlo juntos.',
          'Al final de cada cuento hay una pregunta para que se la hagas a tu hijo o hija. No hay respuesta correcta. Lo importante es conversar.',
          'La página Calma es un ejercicio de respiración. Practíquenlo en las noches fáciles, para que resulte conocido en las noches difíciles.',
          'Si un cuento despierta sentimientos fuertes, está bien. Quédate cerca, escucha y deja que tu hijo o hija guíe la conversación.',
        ]]],
        ['Usarlo sin internet', [[
          'Cuando tengas wifi, abre un cuento y toca «Guardar para usar sin internet». Después se podrá escuchar sin internet y sin gastar datos.',
          'Para tener La misma luna en tu teléfono como una aplicación, abre el menú del navegador y elige «Agregar a la pantalla de inicio».',
        ]]],
        ['Privacidad', ['Sin cuentas, sin anuncios y sin rastreo. No recopilamos nada sobre ti ni sobre tus hijos. Solo contamos totales, como cuántas veces se escucha cada cuento, para saber si La misma luna está ayudando. Los cuentos guardados se quedan en tu teléfono.']],
        ['Seguridad', ['Cada cuento, y cada grabación de voz, lo revisa una persona antes de aparecer aquí. Los cuentos evitan imágenes que den miedo.']],
        ['Para maestros y organizaciones', ['La misma luna es gratis para usar en clases, clubes y sesiones, y gratis para compartir. Los cuentos no tratan de ningún país en particular, así que sirven para niños de cualquier lugar.']],
        ['Presta tu voz', ['Muchas veces los niños se calman mejor con una voz que suena a casa. Si tienes 18 años o más, puedes grabar un cuento en tu propio idioma o acento.']],
      ],
      recordLink: 'Grabar un cuento',
      voiceTitle: 'Presta tu voz',
      voiceIntro: 'Graba uno de los cuentos en tu propio idioma o acento. Una persona escucha cada grabación antes de que alguien más la oiga. Debes tener 18 años o más. Por favor, graba en un lugar tranquilo.',
      fStory: 'Cuento', fLang: 'Idioma del texto', fDialect: 'Tu acento o variante (opcional)', fDialectPh: 'Por ejemplo: español de Venezuela',
      fCredit: 'Nombre que se mostrará (opcional)', fCreditPh: 'Por ejemplo: Ana',
      fAdult: 'Tengo 18 años o más.', fConsent: 'Acepto que mi grabación se comparta gratis en La misma luna.',
      readThis: 'Lee esto en voz alta:', recStart: 'Empezar a grabar', recStop: 'Detener', recAgain: 'Grabar de nuevo',
      orUpload: 'O elige una grabación de tu teléfono', send: 'Enviar grabación', sending: 'Enviando…',
      sentTitle: 'Gracias.', sentText: 'Recibimos tu grabación. Una persona la escuchará antes de compartirla.',
      needBoxes: 'Por favor, marca las dos casillas.', needRecording: 'Por favor, graba o elige una grabación primero.',
      micFail: 'El micrófono no funcionó. Puedes elegir una grabación de tu teléfono.',
      sendFail: 'No se pudo enviar. Por favor, inténtalo de nuevo.',
    },
  };

  const AUDIO_CACHE = 'audio-v1';
  const ICONS = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4.5" height="14" rx="1.5" fill="currentColor"/><rect x="13.5" y="5" width="4.5" height="14" rx="1.5" fill="currentColor"/></svg>',
  };

  const state = { catalogue: null, lang: null, cleanups: [] };
  const view = document.getElementById('view');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ui = () => UI[state.lang] || UI.en;
  const t = (key) => ui()[key] ?? UI.en[key];

  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) {
      if (c == null || c === false) continue;
      n.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return n;
  }

  const fmtTime = (s) => {
    if (!Number.isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  const canWebm = (() => {
    try { return !!new Audio().canPlayType('audio/webm; codecs="opus"'); } catch { return false; }
  })();
  const pickUrl = (src) => (canWebm && src.webm ? src.webm : src.m4a || src.webm);

  /* ---------- Language ---------- */

  function chooseInitialLang() {
    let saved = null;
    try { saved = localStorage.getItem('sm-lang'); } catch { /* storage may be blocked */ }
    if (saved) return saved;
    const nav = (navigator.languages || [navigator.language || 'en']).map((l) => l.slice(0, 2));
    return nav.find((l) => UI[l]) || 'en';
  }

  function availableLangs() {
    return state.catalogue?.languages?.length ? state.catalogue.languages : [{ code: 'en', name: 'English', dir: 'ltr' }];
  }

  function applyLang(lang, { persist = false } = {}) {
    const langs = availableLangs();
    if (state.catalogue && !langs.some((l) => l.code === lang)) lang = langs[0].code;
    state.lang = lang;
    if (persist) {
      try { localStorage.setItem('sm-lang', lang); } catch { /* ignore */ }
    }
    const info = langs.find((l) => l.code === lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = info?.dir || (lang === 'ar' ? 'rtl' : 'ltr');
    document.title = `${t('appName')} · ${t('heroTitle')}`;
    for (const node of document.querySelectorAll('[data-t]')) node.textContent = t(node.dataset.t);
    const select = document.getElementById('lang');
    select.replaceChildren(...langs.map((l) => el('option', { value: l.code, selected: l.code === lang }, l.name)));
  }

  document.getElementById('lang').addEventListener('change', (e) => {
    applyLang(e.target.value, { persist: true });
    route();
  });

  /* ---------- Data ---------- */

  async function loadCatalogue() {
    const res = await fetch('/api/catalogue');
    if (!res.ok) throw new Error(`catalogue ${res.status}`);
    state.catalogue = await res.json();
  }

  // Anonymous totals: that a story started playing or was saved, and in which
  // language. Nothing about the phone or the person is sent, and nothing at
  // all while offline.
  function count(e, story, lang) {
    if (!navigator.onLine) return;
    const body = JSON.stringify(story ? { e, story, lang } : { e });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon('/api/count', body)) return;
    } catch { /* fall back to fetch */ }
    fetch('/api/count', { method: 'POST', body, keepalive: true }).catch(() => {});
  }

  const storiesInLang = () => (state.catalogue?.stories || []).filter((s) => s.langs[state.lang]);

  function sourcesFor(L) {
    const out = (L.voices || []).map((v) => ({ ...v, kind: 'volunteer', label: v.credit ? t('readBy')(v.credit) : t('volunteerVoice') }));
    if (L.audio) out.push({ ...L.audio, kind: 'computer', label: t('computerVoice') });
    return out;
  }

  async function savedState(urls) {
    if (!('caches' in window) || !urls.length) return false;
    const cache = await caches.open(AUDIO_CACHE);
    for (const u of urls) if (!(await cache.match(u))) return false;
    return true;
  }

  /* ---------- Save all ---------- */

  // One "Save all" at a time. It carries on if the family opens a story
  // meanwhile, and skips stories that are already saved.
  let saveAllJob = null;
  const saveAllWatchers = new Set();

  function runSaveAll(lang, items) {
    const job = { lang, total: items.length, done: 0, saved: new Set(), failed: false, finished: false };
    saveAllJob = job;
    const tell = () => saveAllWatchers.forEach((fn) => fn(job));
    (async () => {
      try {
        const cache = await caches.open(AUDIO_CACHE);
        for (const x of items) {
          if (!(await savedState(x.urls))) await cache.addAll(x.urls);
          job.done += 1;
          job.saved.add(x.id);
          tell();
        }
        if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
        count('saveAll');
      } catch {
        job.failed = true;
      }
      job.finished = true;
      tell();
    })();
    return job;
  }

  function buildSaveAll(items, markSaved) {
    if (!('caches' in window) || !items.length) return null;
    const btn = el('button', { class: 'btn primary', type: 'button' }, t('saveAll'));
    const busy = () => saveAllJob && !saveAllJob.finished;
    const showIdle = async () => {
      const states = await Promise.all(items.map((x) => savedState(x.urls)));
      if (busy()) return;
      const all = states.every(Boolean);
      btn.textContent = all ? `✓ ${t('allSaved')}` : t('saveAll');
      btn.disabled = all;
    };
    const watch = (job) => {
      if (job.lang !== state.lang) {
        btn.disabled = !job.finished;
        btn.textContent = t('saving');
        if (job.finished) showIdle();
        return;
      }
      job.saved.forEach(markSaved);
      if (!job.finished) {
        btn.disabled = true;
        btn.textContent = t('savingN')(Math.min(job.done + 1, job.total), job.total);
      } else if (job.failed) {
        btn.disabled = false;
        btn.textContent = t('saveFail');
      } else {
        showIdle();
      }
    };
    saveAllWatchers.add(watch);
    state.cleanups.push(() => saveAllWatchers.delete(watch));
    if (busy()) watch(saveAllJob);
    else showIdle();
    btn.addEventListener('click', () => {
      if (busy()) return;
      watch(runSaveAll(state.lang, items));
    });
    return el('div', { class: 'save-all' }, btn);
  }

  /* ---------- Views ---------- */

  function renderLibrary() {
    const stories = storiesInLang();
    const hero = el('section', { class: 'hero' },
      el('h1', {}, t('heroTitle')),
      el('p', {}, t('heroText')),
      el('ul', { class: 'pills' }, t('pills').map((p) => el('li', {}, p))));
    if (!stories.length) return [hero, el('p', { class: 'empty' }, t('empty'))];
    const grid = el('ul', { class: 'grid' });
    const metaById = new Map();
    const markSaved = (id) => {
      const meta = metaById.get(id);
      if (meta && !meta.querySelector('.tick')) meta.append(el('span', { class: 'tick' }, `✓ ${t('saved')}`));
    };
    const items = [];
    for (const s of stories) {
      const L = s.langs[state.lang];
      const meta = el('div', { class: 'meta' }, el('span', {}, t('min')(L.minutes)));
      metaById.set(s.id, meta);
      grid.append(el('li', { class: 'card' },
        el('a', { href: `#/story/${s.id}` },
          el('img', { src: s.cover, alt: '', width: 400, height: 300, loading: 'lazy' }),
          el('div', { class: 'body' }, el('h2', {}, L.title), meta))));
      const urls = sourcesFor(L).map(pickUrl);
      if (urls.length) items.push({ id: s.id, urls });
      savedState(urls).then((ok) => { if (ok) markSaved(s.id); });
    }
    const saveAll = buildSaveAll(items, markSaved);
    return saveAll ? [hero, saveAll, grid] : [hero, grid];
  }

  function renderStory(id) {
    const stories = storiesInLang();
    const idx = stories.findIndex((s) => s.id === id);
    const back = el('a', { href: '#/', class: 'back' }, `${document.documentElement.dir === 'rtl' ? '→' : '←'} ${t('allStories')}`);
    if (idx === -1) return [back, el('p', { class: 'empty' }, t('notFound'))];
    const s = stories[idx];
    const L = s.langs[state.lang];

    const pages = L.pages.map((p, i) => el('p', { class: 'page', 'data-i': i }, p));
    const parts = [
      back,
      el('img', { class: 'story-cover', src: s.cover, alt: '', width: 400, height: 300 }),
      el('h1', {}, L.title),
      el('p', { class: 'meta' }, `${L.theme} · ${t('min')(L.minutes)}`),
    ];

    const sources = sourcesFor(L);
    if (sources.length) parts.push(buildPlayer(s, L, sources, pages));
    else parts.push(el('p', { class: 'player' }, t('noAudio')));

    parts.push(el('div', { class: 'pages' }, pages));
    parts.push(el('aside', { class: 'grown' }, el('h2', {}, t('forGrownUps')), el('p', {}, L.grownUp)));

    const actions = el('div', { class: 'btn-row' });
    if ('caches' in window && sources.length) actions.append(buildSaveButton(sources.map(pickUrl), s.id));
    const shareBtn = el('button', { class: 'btn', type: 'button' }, t('share'));
    shareBtn.addEventListener('click', async () => {
      const data = { title: L.title, url: location.href };
      try {
        if (navigator.share) await navigator.share(data);
        else { await navigator.clipboard.writeText(location.href); shareBtn.textContent = t('copied'); }
      } catch { /* the user closed the share sheet */ }
    });
    actions.append(shareBtn);
    parts.push(actions);

    const next = stories[(idx + 1) % stories.length];
    if (next && next.id !== s.id) {
      parts.push(el('a', { class: 'next', href: `#/story/${next.id}` },
        el('img', { src: next.cover, alt: '', width: 400, height: 300, loading: 'lazy' }),
        el('span', {}, el('small', {}, t('nextStory')), next.langs[state.lang].title)));
    }
    return [el('article', { class: 'story' }, parts)];
  }

  function buildPlayer(story, L, sources, pages) {
    const audio = new Audio();
    audio.preload = 'none';
    let current = sources[0];
    let lastPage = -1;
    let counted = false;

    const btn = el('button', { class: 'play', type: 'button', 'aria-label': t('listen') });
    btn.innerHTML = ICONS.play;
    const label = el('div', { class: 'play-label' }, t('listen'));
    const sub = el('div', { class: 'play-sub' }, current.kind === 'computer' ? '' : current.label);
    const seek = el('input', { class: 'seek', type: 'range', min: 0, max: 1000, value: 0, 'aria-label': 'Position' });
    const tNow = el('span', {}, '0:00');
    const tAll = el('span', {}, fmtTime(current.duration));

    const setPlaying = (on) => {
      btn.innerHTML = on ? ICONS.pause : ICONS.play;
      btn.setAttribute('aria-label', on ? t('pause') : t('listen'));
      label.textContent = on ? t('pause') : audio.currentTime > 0 ? t('resume') : t('listen');
    };

    const highlight = (i) => {
      if (i === lastPage) return;
      pages.forEach((p, j) => p.classList.toggle('now', j === i));
      if (i >= 0) pages[i].scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
      lastPage = i;
    };

    const load = (src) => {
      current = src;
      audio.src = pickUrl(src);
      sub.textContent = src.kind === 'computer' ? '' : src.label;
      tAll.textContent = fmtTime(src.duration);
      seek.value = 0;
      highlight(-1);
      setPlaying(false);
    };
    load(current);

    btn.addEventListener('click', () => {
      if (audio.paused) audio.play().catch(() => setPlaying(false));
      else audio.pause();
    });
    audio.addEventListener('play', () => {
      setPlaying(true);
      if (!counted) { counted = true; count('play', story.id, state.lang); }
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: L.title,
          artist: t('appName'),
          artwork: [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
        });
      }
    });
    audio.addEventListener('pause', () => setPlaying(false));
    audio.addEventListener('ended', () => { setPlaying(false); highlight(-1); seek.value = 0; });
    audio.addEventListener('timeupdate', () => {
      const d = audio.duration || current.duration;
      if (d) seek.value = Math.round((audio.currentTime / d) * 1000);
      tNow.textContent = fmtTime(audio.currentTime);
      if (current.pageStarts) {
        let i = -1;
        for (let j = 0; j < current.pageStarts.length; j++) if (audio.currentTime >= current.pageStarts[j]) i = j;
        highlight(i);
      }
    });
    seek.addEventListener('input', () => {
      const d = audio.duration || current.duration;
      if (d) audio.currentTime = (seek.value / 1000) * d;
    });

    state.cleanups.push(() => { audio.pause(); audio.removeAttribute('src'); audio.load(); });

    const box = el('section', { class: 'player', 'aria-label': t('listen') },
      el('div', { class: 'player-row' }, btn, el('div', {}, label, sub)),
      el('div', {}, seek, el('div', { class: 'times' }, tNow, tAll)));

    if (sources.length > 1) {
      const row = el('div', { class: 'voices', role: 'group' });
      sources.forEach((src) => {
        const b = el('button', { type: 'button', 'aria-pressed': src === current ? 'true' : 'false' }, src.label);
        b.addEventListener('click', () => {
          audio.pause();
          load(src);
          for (const x of row.children) x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
        });
        row.append(b);
      });
      box.append(row);
    }
    return box;
  }

  function buildSaveButton(urls, storyId) {
    const btn = el('button', { class: 'btn primary', type: 'button' }, t('save'));
    const show = (saved) => {
      btn.textContent = saved ? `✓ ${t('savedOn')}` : t('save');
      btn.dataset.saved = saved ? '1' : '';
      btn.disabled = false;
      btn.title = saved ? t('remove') : '';
    };
    savedState(urls).then(show);
    // A story is also kept once it has played with signal; the offline worker
    // says so when it finishes, and the button catches up.
    const onKept = (e) => {
      if (e.data?.kept && !btn.disabled) savedState(urls).then(show);
    };
    navigator.serviceWorker?.addEventListener('message', onKept);
    state.cleanups.push(() => navigator.serviceWorker?.removeEventListener('message', onKept));
    btn.addEventListener('click', async () => {
      const cache = await caches.open(AUDIO_CACHE);
      if (btn.dataset.saved) {
        if (!confirm(t('remove'))) return;
        await Promise.all(urls.map((u) => cache.delete(u)));
        show(false);
        return;
      }
      btn.disabled = true;
      btn.textContent = t('saving');
      try {
        await cache.addAll(urls);
        if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
        show(true);
        count('save', storyId, state.lang);
      } catch {
        btn.textContent = t('saveFail');
        btn.disabled = false;
      }
    });
    return btn;
  }

  function renderCalm() {
    const circle = el('div', { class: 'breath', 'aria-hidden': 'true' });
    const label = el('p', { class: 'breath-label', 'aria-live': 'polite' }, '');
    const btn = el('button', { class: 'btn primary', type: 'button' }, t('start'));
    let timer = null;
    const stop = () => {
      clearTimeout(timer);
      timer = null;
      circle.classList.remove('on');
      label.textContent = '';
      btn.textContent = t('start');
    };
    const cycle = () => {
      label.textContent = t('calmIn');
      timer = setTimeout(() => {
        label.textContent = t('calmOut');
        timer = setTimeout(cycle, 6000);
      }, 4000);
    };
    btn.addEventListener('click', () => {
      if (timer) return stop();
      circle.classList.add('on');
      btn.textContent = t('stop');
      cycle();
    });
    state.cleanups.push(stop);
    return [el('section', { class: 'calm' },
      el('h1', {}, t('calmTitle')),
      el('p', {}, t('calmText')),
      el('div', { class: 'breath-wrap' }, circle),
      label,
      btn)];
  }

  function renderGrownUps() {
    const out = [];
    for (const [heading, blocks] of t('grownUps')) {
      out.push(el(out.length ? 'h2' : 'h1', {}, heading));
      for (const b of blocks) out.push(Array.isArray(b) ? el('ul', {}, b.map((li) => el('li', {}, li))) : el('p', {}, b));
    }
    out.push(el('p', {}, el('a', { href: '#/voice', class: 'btn primary' }, t('recordLink'))));
    return [el('section', { class: 'prose' }, out)];
  }

  function renderVoice() {
    const stories = state.catalogue?.stories || [];
    const langs = availableLangs();
    const msg = el('div', { 'aria-live': 'polite' });
    const langSel = el('select', { name: 'lang' }, langs.map((l) => el('option', { value: l.code, selected: l.code === state.lang }, l.name)));
    const storySel = el('select', { name: 'story' });
    const prompter = el('div', { class: 'prompter' });
    const fillStories = () => {
      const lang = langSel.value;
      storySel.replaceChildren(...stories.filter((s) => s.langs[lang]).map((s) => el('option', { value: s.id }, s.langs[lang].title)));
      fillPrompter();
    };
    const fillPrompter = () => {
      const s = stories.find((x) => x.id === storySel.value);
      const L = s?.langs[langSel.value];
      prompter.dir = langs.find((l) => l.code === langSel.value)?.dir || 'ltr';
      prompter.replaceChildren(...(L ? [el('p', {}, el('strong', {}, L.title)), ...L.pages.map((p) => el('p', {}, p))] : []));
    };
    langSel.addEventListener('change', fillStories);
    storySel.addEventListener('change', fillPrompter);
    fillStories();

    const dialect = el('input', { type: 'text', name: 'dialect', maxlength: 40, placeholder: t('fDialectPh') });
    const credit = el('input', { type: 'text', name: 'credit', maxlength: 40, placeholder: t('fCreditPh'), autocomplete: 'off' });
    const adult = el('input', { type: 'checkbox', name: 'adult' });
    const consent = el('input', { type: 'checkbox', name: 'consent' });

    let blob = null;
    let recorder = null;
    let tick = null;
    const preview = el('audio', { controls: true, hidden: true });
    const status = el('span', { class: 'rec-status' });
    const recBtn = el('button', { class: 'btn', type: 'button' }, t('recStart'));
    const file = el('input', { type: 'file', accept: 'audio/*' });
    const sendBtn = el('button', { class: 'btn primary', type: 'submit' }, t('send'));

    const setBlob = (b) => {
      blob = b;
      preview.src = URL.createObjectURL(b);
      preview.hidden = false;
    };
    const stopRec = () => {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      clearInterval(tick);
    };
    recBtn.addEventListener('click', async () => {
      if (recorder && recorder.state === 'recording') return stopRec();
      msg.replaceChildren();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => window.MediaRecorder?.isTypeSupported?.(m));
        recorder = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 64000 } : undefined);
        const chunks = [];
        recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        recorder.onstop = () => {
          stream.getTracks().forEach((tr) => tr.stop());
          setBlob(new Blob(chunks, { type: recorder.mimeType || type || 'audio/webm' }));
          recBtn.textContent = t('recAgain');
          status.textContent = '';
        };
        const started = Date.now();
        recorder.start(1000);
        recBtn.textContent = t('recStop');
        tick = setInterval(() => {
          const s = (Date.now() - started) / 1000;
          status.replaceChildren(el('span', { class: 'rec-dot' }), fmtTime(s));
          if (s > 600) stopRec();
        }, 500);
      } catch {
        msg.replaceChildren(el('p', { class: 'error' }, t('micFail')));
      }
    });
    file.addEventListener('change', () => { if (file.files[0]) setBlob(file.files[0]); });
    state.cleanups.push(stopRec);

    const form = el('form', { class: 'voice' },
      el('label', {}, t('fLang'), langSel),
      el('label', {}, t('fStory'), storySel),
      el('label', {}, t('fDialect'), dialect),
      el('label', {}, t('fCredit'), credit),
      el('label', { class: 'check' }, adult, el('span', {}, t('fAdult'))),
      el('label', { class: 'check' }, consent, el('span', {}, t('fConsent'))),
      el('div', {}, el('p', {}, el('strong', {}, t('readThis'))), prompter),
      el('div', { class: 'btn-row' }, recBtn, status),
      preview,
      el('label', {}, t('orUpload'), file),
      sendBtn,
      msg);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!adult.checked || !consent.checked) return msg.replaceChildren(el('p', { class: 'error' }, t('needBoxes')));
      if (!blob) return msg.replaceChildren(el('p', { class: 'error' }, t('needRecording')));
      sendBtn.disabled = true;
      sendBtn.textContent = t('sending');
      try {
        const res = await fetch('/api/voices', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            storyId: storySel.value, lang: langSel.value, dialect: dialect.value, credit: credit.value,
            adult: true, consent: true, mime: blob.type || 'audio/webm',
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'failed');
        const { upload } = await res.json();
        const put = await fetch(upload.url, { method: upload.method, headers: upload.headers, body: blob });
        if (!put.ok) throw new Error('upload failed');
        form.replaceWith(el('div', { class: 'notice' }, el('h2', {}, t('sentTitle')), el('p', {}, t('sentText'))));
      } catch {
        msg.replaceChildren(el('p', { class: 'error' }, t('sendFail')));
        sendBtn.disabled = false;
        sendBtn.textContent = t('send');
      }
    });

    return [el('section', { class: 'prose' }, el('h1', {}, t('voiceTitle')), el('p', {}, t('voiceIntro'))), form];
  }

  /* ---------- Router ---------- */

  function route() {
    while (state.cleanups.length) {
      try { state.cleanups.pop()(); } catch { /* ignore */ }
    }
    const hash = location.hash.replace(/^#/, '') || '/';
    let nodes;
    let nav = 'stories';
    if (hash.startsWith('/story/')) nodes = renderStory(decodeURIComponent(hash.slice(7)));
    else if (hash === '/calm') { nodes = renderCalm(); nav = 'calm'; }
    else if (hash === '/grown-ups') { nodes = renderGrownUps(); nav = 'grown-ups'; }
    else if (hash === '/voice') { nodes = renderVoice(); nav = 'grown-ups'; }
    else nodes = renderLibrary();
    view.replaceChildren(...nodes);
    for (const a of document.querySelectorAll('nav.bottom a')) {
      if (a.dataset.nav === nav) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    window.scrollTo(0, 0);
    view.focus({ preventScroll: true });
  }

  async function start() {
    const wanted = state.lang || chooseInitialLang();
    applyLang(wanted);
    try {
      await loadCatalogue();
    } catch {
      const retry = el('button', { class: 'btn primary', type: 'button', onclick: start }, t('retry'));
      view.replaceChildren(el('div', { class: 'empty' }, el('p', {}, t('loadFail')), retry));
      return;
    }
    applyLang(wanted);
    route();
  }

  window.addEventListener('hashchange', route);
  const offline = document.getElementById('offline');
  const netState = () => { offline.hidden = navigator.onLine; };
  window.addEventListener('online', netState);
  window.addEventListener('offline', netState);
  netState();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }

  start();
})();
