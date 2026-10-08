// 이 파일은 건드릴 일이 거의 없음. 콘텐츠 추가는 /data/*.json 파일만 수정하면 됨.

// Google Analytics 이벤트. gtag가 없으면(차단 등) 조용히 넘어감.
function track(name, params) {
  if (typeof gtag === 'function') gtag('event', name, params || {});
}

// data-track="이벤트명" 이 붙은 요소를 누르면(가운데 버튼 포함) 이벤트를 보냄. 나머지 data-*는 파라미터.
function initClickTracking() {
  const handler = e => {
    if (e.type === 'auxclick' && e.button !== 1) return;
    const el = e.target.closest('[data-track]');
    if (!el) return;
    const { track: name, ...params } = el.dataset;
    track(name, params);
  };
  document.addEventListener('click', handler);
  document.addEventListener('auxclick', handler);
}

// 책·논문·기사 목록이 화면에 처음 보였을 때 한 번씩 이벤트를 보냄.
function initSectionViews() {
  if (!('IntersectionObserver' in window)) return;
  const names = { 'book-list': 'book', 'paper-list': 'paper', 'article-list': 'article' };
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      track('list_view', { section: names[entry.target.id] });
    });
  }, { threshold: 0.1 });
  Object.keys(names).forEach(id => observer.observe(document.getElementById(id)));
}

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error('불러오기 실패: ' + path);
  return res.json();
}

function formatDate(iso) {
  return iso.replaceAll('-', '.');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// 《》「」〈〉『』는 한쪽이 비어 있어 글자 사이가 벌어져 보이므로 부호를 span(.bo 여는 쪽, .bc 닫는 쪽)으로 감싸
// CSS로 빈 쪽을 접는다. 여는 부호 뒤에는 word joiner를 넣어 부호만 줄 끝에 남지 않게 한다(WebKit의 keep-all 대응).
// 텍스트에만 쓸 것: 속성값에 넣으면 안 된다.
function trimBrackets(text) {
  return text
    .replace(/[《「〈『]/g, '<span class="bo">$&</span>\u2060')
    .replace(/[》」〉』]/g, '<span class="bc">$&</span>');
}

function bookByline(b) {
  return (b.author ? `${escapeHtml(b.author)} 지음 · ` : '') + escapeHtml(b.publisher);
}

function renderBooks(books) {
  const container = document.getElementById('book-list');
  container.innerHTML = books.map(b => {
    const cover = `<img class="cover${b.forthcoming ? ' forthcoming' : ''}" src="${b.cover}" alt="${b.title} 표지" loading="lazy">`;
    const buyTrack = `data-track="book_buy_click" data-item="${escapeHtml(b.title)}" data-location="list"`;
    const titleText = b.link ? `<a href="${b.link}" target="_blank" rel="noopener" ${buyTrack}>${b.title}</a>` : b.title;
    // 원제는 마우스를 올렸을 때만 보여 준다
    const original = b.original ? ` title="원제: ${escapeHtml(b.original)}"` : '';
    const afterword = b.afterword ? ` · <a class="afterword-link" href="#afterword-${b.afterword}" aria-haspopup="dialog">옮긴이 후기</a>` : '';
    const sub = bookByline(b) + (b.forthcoming ? ' · 출간 예정' : ` · ${formatDate(b.date)}`) + afterword;
    return `
    <div class="book">
      ${b.link
        ? `<a class="cover-link" href="${b.link}" target="_blank" rel="noopener" ${buyTrack}>${cover}</a>`
        : `<span class="cover-link">${cover}</span>`}
      <div>
        <div class="title"${original}>${titleText}</div>
        <div class="sub">${sub}</div>
      </div>
    </div>
  `;
  }).join('');
}

function renderList(containerId, items, eventName) {
  const container = document.getElementById(containerId);
  container.innerHTML = items.map(item => `
    <li><a href="${item.url}" target="_blank" rel="noopener" title="${escapeHtml(item.title)}" data-track="${eventName}" data-item="${escapeHtml(item.title)}">${trimBrackets(item.title)}</a><span class="date">${formatDate(item.date)}</span></li>
  `).join('');
}

function initReveal(btn) {
  const container = document.querySelector(btn.dataset.target);
  const steps = btn.dataset.steps.split(',').map(Number);
  let shown = 0;
  let expanded = false;

  const announcer = document.createElement('span');
  announcer.className = 'sr-only';
  announcer.setAttribute('role', 'status');
  announcer.setAttribute('aria-live', 'polite');
  btn.insertAdjacentElement('afterend', announcer);

  // 주제 필터에서 빠진 항목(.is-filtered)은 세지도 보여 주지도 않음
  const visibleItems = () => Array.from(container.children).filter(el => !el.classList.contains('is-filtered'));

  function render() {
    const items = visibleItems();
    const total = items.length;
    Array.from(container.children).forEach(el => { el.style.display = 'none'; });
    items.forEach((el, i) => { el.style.display = i < shown ? '' : 'none'; });
    if (shown >= total) {
      if (!expanded) {
        btn.hidden = true;
        return;
      }
      btn.hidden = false;
      btn.classList.add('is-top');
      btn.querySelector('.label').textContent = '위로';
      btn.querySelector('.arrow').textContent = '▴';
      return;
    }
    btn.hidden = false;
    btn.classList.remove('is-top');
    const nextStep = steps.find(s => s > shown);
    const nextShown = Math.min(nextStep === undefined ? total : nextStep, total);
    const remaining = nextShown - shown;
    btn.querySelector('.label').textContent = remaining + '개 더보기';
    btn.querySelector('.arrow').textContent = '▾';
    btn.dataset.next = nextShown;
  }

  btn.addEventListener('click', () => {
    if (btn.classList.contains('is-top')) {
      container.parentElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const revealedCount = Number(btn.dataset.next) - shown;
    track('list_more_click', { section: container.id.replace('-list', ''), shown_after: Number(btn.dataset.next) });
    expanded = true;
    shown = Number(btn.dataset.next);
    render();
    const total = visibleItems().length;
    announcer.textContent = shown >= total
      ? `${revealedCount}개를 더 표시했습니다. 전체 ${total}개를 모두 표시했습니다.`
      : `${revealedCount}개를 더 표시했습니다.`;
  });

  // 주제를 고르면 걸러진 항목을 모두 펼치고, 해제하면 처음 개수로 되돌림
  btn.resetReveal = showAll => {
    expanded = false;
    shown = showAll ? Infinity : steps[0];
    render();
  };

  shown = steps[0];
  render();
}

// 원어 병기: 한글 바로 뒤에 띄어쓰기 없이 붙은 영문(예: 일어서자Stand Up to Racism)을 작은 글씨로
function smallGloss(html) {
  return html.replace(/([가-힣])([A-Za-z][A-Za-z0-9 .,'\-]*[A-Za-z0-9.])/g, '$1<span class="gloss" lang="en">$2</span>');
}

// 옮긴이 후기 패널. 주소에 #afterword-<slug>를 남겨서
// 뒤로가기(모바일 스와이프 포함)로 패널만 닫히고, 링크로 바로 열 수도 있게 함.
function initAfterword(books) {
  const dialog = document.getElementById('afterword');
  const scroller = dialog.querySelector('.afterword-scroll');
  const body = dialog.querySelector('.afterword-body');
  const bySlug = Object.fromEntries(books.filter(b => b.afterword).map(b => [b.afterword, b]));
  const cache = {};
  let trigger = null;

  const slugFromHash = () => {
    const m = location.hash.match(/^#afterword-(.+)$/);
    return m && bySlug[decodeURIComponent(m[1])] ? decodeURIComponent(m[1]) : null;
  };

  async function fill(book) {
    dialog.querySelector('.afterword-cover').src = book.cover;
    // 화면에는 책 제목만, 스크린리더에는 "○○ 옮긴이 후기"로 읽히게
    dialog.querySelector('.afterword-title').innerHTML =
      `${escapeHtml(book.title)}<span class="sr-only"> 옮긴이 후기</span>`;
    dialog.querySelector('.afterword-sub').innerHTML =
      `${bookByline(book)} · ${formatDate(book.date)}` +
      (book.link ? ` · <a href="${book.link}" target="_blank" rel="noopener" aria-label="책 구입 (새 창에서 열림)" data-track="book_buy_click" data-item="${escapeHtml(book.title)}" data-location="afterword">책 구입 ↗</a>` : '');
    body.innerHTML = '<p class="loading-state">불러오는 중…</p>';
    try {
      if (!cache[book.afterword]) {
        const res = await fetch(`data/afterwords/${book.afterword}.md`);
        if (!res.ok) throw new Error('불러오기 실패');
        cache[book.afterword] = await res.text();
      }
      // 제목(# …) 줄은 빼고, 빈 줄이 아닌 각 줄을 한 문단으로
      body.innerHTML = cache[book.afterword].split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => `<p>${trimBrackets(smallGloss(escapeHtml(line)))}</p>`)
        .join('');
    } catch (err) {
      console.error(err);
      body.innerHTML = '<p class="afterword-error">후기를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>';
    }
  }

  function open(slug, push) {
    const book = bySlug[slug];
    if (!book) return;
    if (push) history.pushState({ afterword: slug }, '', `#afterword-${slug}`);
    fill(book);
    if (!dialog.open) dialog.showModal();
    scroller.scrollTop = 0;
    scroller.focus({ preventScroll: true });
    track('afterword_open', { book: slug });
  }

  document.getElementById('book-list').addEventListener('click', e => {
    const link = e.target.closest('.afterword-link');
    if (!link || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    trigger = link;
    open(link.getAttribute('href').replace('#afterword-', ''), true);
  });

  // X 버튼, 바깥(배경) 클릭, Esc 모두 결국 dialog.close() → 'close' 이벤트로 모임
  dialog.querySelector('.afterword-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  dialog.addEventListener('close', () => {
    if (history.state && history.state.afterword) {
      history.back();
    } else if (slugFromHash()) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    if (trigger && document.contains(trigger)) trigger.focus({ preventScroll: true });
    trigger = null;
  });

  window.addEventListener('popstate', () => {
    const slug = slugFromHash();
    if (slug) open(slug, false);
    else if (dialog.open) dialog.close();
  });

  const initial = slugFromHash();
  if (initial) open(initial, false);
}

function updateCounts() {
  document.querySelectorAll('[data-count-for]').forEach(el => {
    const target = document.querySelector(el.dataset.countFor);
    if (!target) return;
    const total = target.children.length;
    const shown = target.querySelectorAll(':scope > :not(.is-filtered)').length;
    const tag = document.querySelector('.tag[aria-pressed="true"]')?.dataset.tag;
    if (shown === total || !tag) el.textContent = total;
    else el.innerHTML = `<span class="count-tag">${escapeHtml(tag)}</span> ${shown} / ${total}`;
  });
}

// 주제 칩. 누르면 논문·기사 목록을 그 주제로 거르고, 다시 누르거나 '전체'를 누르면 해제.
// 칩은 data/*.json의 tags에서 만들어지고 항목이 많은 주제부터 놓임.
function initTagFilter(papers, articles) {
  const lists = [
    { el: document.getElementById('paper-list'), items: papers, name: '논문' },
    { el: document.getElementById('article-list'), items: articles, name: '기사' },
  ];
  const counts = {};
  [...papers, ...articles].forEach(item => (item.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
  const tags = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

  const group = document.getElementById('tag-list');
  const status = document.getElementById('tag-status');
  // 헤더 링크 줄처럼 '·'로 잇되, 줄바꿈은 항목 사이에서만 일어나게 항목과 구분자를 한 덩어리로 묶음
  const chip = (tag, label, n, last) =>
    `<span class="tag-item"><button type="button" class="tag" data-tag="${escapeHtml(tag)}" aria-pressed="${tag === ''}">${label}<span class="n">${n}</span></button>${last ? '' : '<span class="sep" aria-hidden="true">·</span>'}</span>`;
  group.innerHTML = [chip('', '전체', papers.length + articles.length), ...tags.map((t, i) => chip(t, t, counts[t], i === tags.length - 1))].join(' ');

  let current = '';
  group.addEventListener('click', e => {
    const btn = e.target.closest('.tag');
    if (!btn) return;
    apply(btn.dataset.tag === current ? '' : btn.dataset.tag);
  });

  function apply(tag) {
    current = tag;
    group.querySelectorAll('.tag').forEach(b => b.setAttribute('aria-pressed', b.dataset.tag === tag));
    const summary = lists.map(({ el, items, name }) => {
      let matches = 0;
      Array.from(el.children).forEach((li, i) => {
        const hit = !tag || (items[i].tags || []).includes(tag);
        li.classList.toggle('is-filtered', !hit);
        if (hit) matches++;
      });
      el.parentElement.querySelector('.more').resetReveal(!!tag);
      el.parentElement.querySelector('.filter-empty').hidden = matches > 0;
      return `${name} ${matches}편`;
    });
    updateCounts();
    if (tag) track('tag_filter', { tag });
    status.textContent = tag ? `${tag}: ${summary.join(', ')}` : '모든 주제를 표시합니다.';
  }
}

function initCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    let resetTimer;
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      // 클립보드가 응답하지 않아도 클릭은 기록되도록 복사보다 먼저 보낸다.
      track('email_copy');
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      const toast = btn.parentElement.querySelector('.copy-toast');
      btn.classList.add('copied');
      toast.classList.add('show');
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        btn.classList.remove('copied');
        toast.classList.remove('show');
      }, 1500);
    });
  });
}

async function init() {
  const [books, papers, articles] = await Promise.all([
    loadJSON('data/books.json'),
    loadJSON('data/papers.json'),
    loadJSON('data/articles.json'),
  ]);

  // 최신순 정렬 (JSON 순서와 무관하게 항상 최신이 위로)
  const byDateDesc = (a, b) => b.date.localeCompare(a.date);
  books.sort(byDateDesc);
  papers.sort(byDateDesc);
  articles.sort(byDateDesc);

  renderBooks(books);
  initAfterword(books);
  renderList('paper-list', papers, 'paper_click');
  renderList('article-list', articles, 'article_click');

  document.querySelectorAll('.more[data-target]').forEach(initReveal);
  initTagFilter(papers, articles);
  updateCounts();
  initSectionViews();
}

initClickTracking();
initCopyButtons();

init().catch(err => {
  console.error(err);
  document.querySelectorAll('.loading-state').forEach(el => el.remove());
  document.querySelector('.wrap').insertAdjacentHTML(
    'beforeend',
    `<div class="error-state" role="alert">
      <p>콘텐츠를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      <button type="button" onclick="location.reload()">다시 시도</button>
    </div>`
  );
});
