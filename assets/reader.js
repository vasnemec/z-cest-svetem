// Lightweight reader: turns poem list items into links and handles navigation
(function(){
  function slugify(str){
    return str
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/(^-|-$)/g,'');
  }

  const lists = Array.from(document.querySelectorAll('.poem-list'));
  if (!lists.length) return;

  // Build a flat ordered list of poem titles and add anchors
  const poems = [];
  lists.forEach(list => {
    Array.from(list.querySelectorAll('li')).forEach(li => {
      const title = li.textContent.trim();
      if (!title) return;
      const a = document.createElement('a');
      a.textContent = title;
      a.href = '#poem/' + slugify(title);
      a.className = 'poem-link';
      a.dataset.title = title;
      li.textContent = '';
      li.appendChild(a);
      poems.push({title, slug: slugify(title), el: a});
    });
  });

  // Build modal elements
  function ensureModal(){
    let overlay = document.getElementById('poem-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'poem-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="poem-title">
        <div class="modal-header">
          <span></span>
          <button class="modal-close" aria-label="Zavřít">×</button>
        </div>
        <h2 class="poem-title" id="poem-title"></h2>
        <div class="poem-body" id="poem-body">
          <p></p>
        </div>
        <div class="modal-nav">
          <button class="btn" id="modal-prev">← Předchozí</button>
          <button class="btn" id="modal-next">Další →</button>
        </div>
        <div class="page-meta"><span id="page-count"></span></div>
      </div>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  const overlay = ensureModal();
  const modal = overlay.querySelector('.modal');
  const closeBtn = overlay.querySelector('.modal-close');
  const titleEl = overlay.querySelector('#poem-title');
  const bodyEl = overlay.querySelector('#poem-body');
  const prevBtn = overlay.querySelector('#modal-prev');
  const nextBtn = overlay.querySelector('#modal-next');
  // Overlay scroll helper
  let overlayScrollTip = document.getElementById('overlay-scroll-tip');
  if (!overlayScrollTip) {
    overlayScrollTip = document.createElement('button');
    overlayScrollTip.id = 'overlay-scroll-tip';
    overlayScrollTip.className = 'overlay-scroll-tip hidden';
    overlayScrollTip.type = 'button';
    overlayScrollTip.setAttribute('aria-label', 'Posunout níže');
    overlayScrollTip.textContent = '↓ Posunout';
    document.body.appendChild(overlayScrollTip);
  }
  let index = -1;
  // Embedded poems support (static, no fetch)
  let embeddedPoems = null;
  const poemsJsonEl = document.getElementById('poems-json');
  if (poemsJsonEl) {
    try { embeddedPoems = JSON.parse(poemsJsonEl.textContent || '{}'); } catch(e) { embeddedPoems = null; }
  }
  const slugAliases = {
    // Handle filename-title discrepancy: "rety" vs "rty"
    'chladnymi-jak-kus-ledu-rty': 'chladnymi-jak-kus-ledu-rety'
  };
  const countEl = overlay.querySelector('#page-count');

  function openModal(){
    overlay.classList.add('open');
    overlay.scrollTop = 0;
    closeBtn.focus();
    document.documentElement.classList.add('no-scroll');
    updateScrollTip();
  }

  function closeModal(){
    overlay.classList.remove('open');
    // Clear hash but keep scroll
    if (location.hash.startsWith('#poem/')){
      history.replaceState(null, '', location.pathname + location.search);
    }
    document.documentElement.classList.remove('no-scroll');
    overlayScrollTip.classList.add('hidden');
  }

  function show(i){
    if (i < 0 || i >= poems.length) return;
    index = i;
    const p = poems[i];
    titleEl.textContent = p.title;
    // Use only embedded content; do not fall back to lorem ipsum
    let text = '';
    if (embeddedPoems) {
      text = embeddedPoems[p.slug] || embeddedPoems[slugAliases[p.slug] || ''] || '';
    }
    if (!text.trim()) {
      bodyEl.innerHTML = '<p>Text této básně zatím není k dispozici.</p>';
    } else {
      const html = text.split('\n').map(l => l.length ? l.replace(/&/g,'&amp;').replace(/</g,'&lt;') : '').join('<br>');
      bodyEl.innerHTML = `<p>${html}</p>`;
    }
    openModal();
    prevBtn.disabled = (i === 0);
    nextBtn.disabled = (i === poems.length - 1);
    // Mark active link in the list
    poems.forEach(x => x.el.classList.remove('active'));
    p.el.classList.add('active');
    if (countEl) countEl.textContent = (i+1) + ' / ' + poems.length;
    // Update hash without scrolling jump
    const newHash = '#poem/' + p.slug;
    if (location.hash !== newHash) {
      history.replaceState(null, '', newHash);
    }
  }

  function findIndexBySlug(slug){
    return poems.findIndex(p => p.slug === slug);
  }

  // Click handlers
  poems.forEach((p, i) => {
    p.el.addEventListener('click', (e) => {
      e.preventDefault();
      show(i);
    });
  });
  prevBtn.addEventListener('click', () => { if (index > 0) show(index - 1); });
  nextBtn.addEventListener('click', () => { if (index < poems.length - 1) show(index + 1); });
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  modal.addEventListener('click', (e) => e.stopPropagation());

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    const isOpen = overlay.classList.contains('open');
    if (!isOpen) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft') { if (index > 0) show(index - 1); }
    if (e.key === 'ArrowRight') { if (index < poems.length - 1) show(index + 1); }
  });

  // Load from hash
  function handleHash(){
    const m = location.hash.match(/^#poem\/(.+)$/);
    if (m){
      const i = findIndexBySlug(m[1]);
      if (i >= 0) show(i);
    }
  }
  window.addEventListener('hashchange', handleHash);
  handleHash();

  function updateScrollTip(){
    const needsScroll = overlay.scrollHeight > overlay.clientHeight + 8;
    const nearBottom = overlay.scrollTop + overlay.clientHeight >= overlay.scrollHeight - 16;
    if (needsScroll && !nearBottom && overlay.classList.contains('open')) {
      overlayScrollTip.classList.remove('hidden');
    } else {
      overlayScrollTip.classList.add('hidden');
    }
  }

  overlay.addEventListener('scroll', updateScrollTip, { passive:true });
  overlayScrollTip.addEventListener('click', () => {
    overlay.scrollBy({ top: overlay.clientHeight * 0.6, behavior: 'smooth' });
  });
})();
