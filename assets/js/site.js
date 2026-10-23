/* 星控科技 官网 — 语言切换 / 移动菜单 / 滚动渐入 */
(function () {
  var KEY = 'sk-lang';
  var root = document.documentElement;

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function store(v) {
    try { localStorage.setItem(KEY, v); } catch (e) { /* 隐私模式等 */ }
  }

  // 元素上写中文原文, data-en 写英文; 切换时把中文缓存到 data-zh 再互换。
  function apply(lang) {
    document.querySelectorAll('[data-en]').forEach(function (el) {
      if (el.dataset.zh === undefined) el.dataset.zh = el.innerHTML;
      el.innerHTML = lang === 'en' ? el.dataset.en : el.dataset.zh;
    });
    document.querySelectorAll('[data-en-alt]').forEach(function (el) {
      if (el.dataset.zhAlt === undefined) el.dataset.zhAlt = el.getAttribute('alt') || '';
      el.setAttribute('alt', lang === 'en' ? el.dataset.enAlt : el.dataset.zhAlt);
    });
    // 产品截图: 英文界面版为同名 .en.webp
    document.querySelectorAll('img[src*="assets/img/"][src*=".webp"]').forEach(function (el) {
      if (el.dataset.srcZh === undefined) el.dataset.srcZh = el.getAttribute('src');
      var zh = el.dataset.srcZh;
      el.setAttribute('src', lang === 'en' ? zh.replace(/\.webp(\?|$)/, '.en.webp$1') : zh);
    });
    var t = document.querySelector('meta[name="title-en"]');
    if (t) {
      if (!root.dataset.zhTitle) root.dataset.zhTitle = document.title;
      document.title = lang === 'en' ? t.content : root.dataset.zhTitle;
    }
    root.lang = lang === 'en' ? 'en' : 'zh-CN';
    document.querySelectorAll('.lang-switch button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.lang === lang);
    });
  }

  var initial = stored() || ((navigator.language || 'zh').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en');
  if (initial === 'en') apply('en');
  document.querySelectorAll('.lang-switch button').forEach(function (b) {
    b.classList.toggle('on', b.dataset.lang === initial);
    b.addEventListener('click', function () { store(b.dataset.lang); apply(b.dataset.lang); });
  });

  // 移动端菜单
  var btn = document.querySelector('.menu-btn');
  if (btn) btn.addEventListener('click', function () {
    var open = document.body.classList.toggle('menu-open');
    btn.setAttribute('aria-expanded', open);
  });
  document.querySelectorAll('.nav a').forEach(function (a) {
    a.addEventListener('click', function () { document.body.classList.remove('menu-open'); });
  });

  // 滚动渐入
  var els = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  } else {
    els.forEach(function (el) { el.classList.add('in'); });
  }

  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
