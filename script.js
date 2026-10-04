// 이 파일은 건드릴 일이 거의 없음. 콘텐츠 추가는 /data/*.json 파일만 수정하면 됨.

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

function renderBooks(books) {
  const container = document.getElementById('book-list');
  container.innerHTML = books.map(b => {
    const cover = `<img class="cover${b.forthcoming ? ' forthcoming' : ''}" src="${b.cover}" alt="${b.title} 표지" loading="lazy">`;
    const titleText = b.link ? `<a href="${b.link}" target="_blank" rel="noopener">${b.title}</a>` : b.title;
    const afterword = b.afterword ? ` · <a class="afterword-link" href="#afterword-${b.afterword}" aria-haspopup="dialog">옮긴이 후기</a>` : '';
    const sub = (b.forthcoming ? `${b.publisher} · 출간 예정` : `${b.publisher} · ${formatDate(b.date)}`) + afterword;
    return `
    <div class="book">
      ${b.link
        ? `<a class="cover-link" href="${b.link}" target="_blank" rel="noopener">${cover}</a>`
        : `<span class="cover-link">${cover}</span>`}
      <div>
        <div class="title">${titleText}</div>
        <div class="sub">${sub}</div>
      </div>
    </div>
  `;
  }).join('');
}

function renderList(containerId, items) {
  const container = document.getElementById(containerId);
  container.innerHTML = items.map(item => `
    <li><a href="${item.url}" target="_blank" rel="noopener" title="${escapeHtml(item.title)}">${item.title}</a><span class="date">${formatDate(item.date)}</span></li>
  `).join('');
}

function initReveal(btn) {
  const container = document.querySelector(btn.dataset.target);
  const items = Array.from(container.children);
  const steps = btn.dataset.steps.split(',').map(Number);
  const total = items.length;
  let shown = 0;
  let expanded = false;

  const announcer = document.createElement('span');
  announcer.className = 'sr-only';
  announcer.setAttribute('role', 'status');
  announcer.setAttribute('aria-live', 'polite');
  btn.insertAdjacentElement('afterend', announcer);

  function render() {
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
      container.closest('section').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const revealedCount = Number(btn.dataset.next) - shown;
    expanded = true;
    shown = Number(btn.dataset.next);
    render();
    announcer.textContent = shown >= total
      ? `${revealedCount}개를 더 표시했습니다. 전체 ${total}개를 모두 표시했습니다.`
      : `${revealedCount}개를 더 표시했습니다.`;
  });

  shown = Math.min(steps[0], total);
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
    dialog.querySelector('.afterword-title').textContent = book.title;
    dialog.querySelector('.afterword-sub').innerHTML =
      `${escapeHtml(book.publisher)} · ${formatDate(book.date)}` +
      (book.link ? ` · <a href="${book.link}" target="_blank" rel="noopener" aria-label="책 구입 (새 창에서 열림)">책 구입 ↗</a>` : '');
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
        .map(line => `<p>${smallGloss(escapeHtml(line))}</p>`)
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
    if (typeof gtag === 'function') gtag('event', 'afterword_open', { book: slug });
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
    if (target) el.textContent = target.children.length;
  });
}

function initCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    let resetTimer;
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
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
  renderList('paper-list', papers);
  renderList('article-list', articles);

  document.querySelectorAll('.more[data-target]').forEach(initReveal);
  updateCounts();
}

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
