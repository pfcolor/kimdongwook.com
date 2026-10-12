// 책·논문·기사 목록을 index.html에 미리 채워 넣는다(프리렌더).
// 브라우저에서는 script.js가 같은 목록을 다시 그려 덮어쓰므로 화면은 달라지지 않고,
// JS를 실행하지 않는 검색 로봇·미리보기 봇이 목록 텍스트를 읽을 수 있게 하는 것이 목적.
//
// 사용: node scripts/prerender.mjs
// data/*.json을 푸시하면 GitHub Action이 자동으로 돌리므로 보통은 직접 실행할 일이 없다.
// 로컬에서 결과를 보고 싶을 때만 실행.
//
// index.html의 <!--prerender:이름--> … <!--/prerender:이름--> 사이만 갈아 끼운다.
// 아래 템플릿은 script.js의 renderBooks / renderList와 같은 모양을 따른다(복사본).
// 어긋나도 화면에는 script.js 결과가 쓰이므로 큰 문제는 없다.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');

const formatDate = iso => iso.replaceAll('-', '.');

const escapeHtml = str => str
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const trimBrackets = text => text
  .replace(/[《「〈『]/g, '<span class="bo">$&</span>⁠')
  .replace(/[》」〉』]/g, '<span class="bc">$&</span>');

const bookByline = b => (b.author ? `${escapeHtml(b.author)} 지음 · ` : '') + escapeHtml(b.publisher);

// 처음 화면에 보일 개수(더보기 버튼의 data-steps 첫 값). 나머지는 숨겨 둔 채로 넣어
// JS가 뜨기 전에 긴 목록이 펼쳐 보이는 일이 없게 한다.
const hidden = (i, shown) => (i >= shown ? ' style="display:none"' : '');

function bookHtml(b, i, shown) {
  const cover = `<img class="cover${b.forthcoming ? ' forthcoming' : ''}" src="${b.cover}" alt="${escapeHtml(b.title)} 표지" loading="lazy">`;
  const titleText = b.link ? `<a href="${b.link}" target="_blank" rel="noopener">${b.title}</a>` : b.title;
  const original = b.original ? ` title="원제: ${escapeHtml(b.original)}"` : '';
  const afterword = b.afterword ? ` · <a class="afterword-link" href="#afterword-${b.afterword}" aria-haspopup="dialog">옮긴이 후기</a>` : '';
  const sub = bookByline(b) + (b.forthcoming ? ' · 출간 예정' : ` · ${formatDate(b.date)}`) + afterword;
  return `<div class="book"${hidden(i, shown)}>
      ${b.link
        ? `<a class="cover-link" href="${b.link}" target="_blank" rel="noopener">${cover}</a>`
        : `<span class="cover-link">${cover}</span>`}
      <div>
        <div class="title"${original}>${titleText}</div>
        <div class="sub">${sub}</div>
      </div>
    </div>`;
}

const itemHtml = (item, i, shown) =>
  `<li${hidden(i, shown)}><a href="${item.url}" target="_blank" rel="noopener" title="${escapeHtml(item.title)}">${trimBrackets(item.title)}</a><span class="date">${formatDate(item.date)}</span></li>`;

const byDateDesc = (a, b) => b.date.localeCompare(a.date);

const lists = [
  { id: 'book-list', file: 'data/books.json', html: bookHtml },
  { id: 'paper-list', file: 'data/papers.json', html: itemHtml },
  { id: 'article-list', file: 'data/articles.json', html: itemHtml },
];

let page = read('index.html');

for (const { id, file, html } of lists) {
  const items = JSON.parse(read(file)).sort(byDateDesc);

  const steps = page.match(new RegExp(`data-target="#${id}" data-steps="(\\d+)`));
  if (!steps) throw new Error(`index.html에서 #${id}의 data-steps를 찾지 못했습니다.`);
  const shown = Number(steps[1]);

  const marker = new RegExp(`(<!--prerender:${id}-->)[\\s\\S]*?(<!--/prerender:${id}-->)`);
  if (!marker.test(page)) throw new Error(`index.html에 <!--prerender:${id}--> 마커가 없습니다.`);
  const body = items.map((item, i) => html(item, i, shown)).join('\n    ');
  page = page.replace(marker, (_, open, close) => `${open}\n    ${body}\n    ${close}`);

  // 목록 옆 개수 표시(JS가 뜨기 전에 비어 있지 않게)
  page = page.replace(
    new RegExp(`(<span class="count" data-count-for="#${id}">)[^<]*(</span>)`),
    `$1${items.length}$2`,
  );
}

writeFileSync(join(root, 'index.html'), page);
console.log('prerendered:', lists.map(l => l.id).join(', '));
