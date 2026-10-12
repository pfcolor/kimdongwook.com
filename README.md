# kimdongwook.com

## 구조
```
index.html          디자인/레이아웃 뼈대 (거의 안 건드림)
style.css           색깔·폰트·여백 (디자인 바꿀 때만)
script.js           JSON을 읽어서 화면에 그려주는 로직 (더보기 기능 포함, 거의 안 건드림)
data/books.json      책 목록 ← 새 책 나오면 여기 추가
data/papers.json     논문 목록 ← 새 논문 나오면 여기 추가
data/articles.json   기사 목록 ← 새 기사 나오면 여기 추가
assets/img/          프로필 사진, 책 표지 이미지
scripts/prerender.mjs  JSON 목록을 index.html에 미리 채워 넣는 스크립트 (아래 '프리렌더' 참고)
```

## 콘텐츠 추가하는 법
`data/` 안의 JSON 파일에 항목 하나 추가하고 커밋/푸시하면 끝. 예를 들어 책 추가:

```json
{
  "title": "새 책 제목",
  "publisher": "출판사",
  "date": "2026-08-01",
  "cover": "assets/img/새파일.jpg"
}
```

표지 이미지는 `assets/img/`에 파일을 올린 뒤 `cover` 경로만 맞춰주면 됨.
목록 순서는 신경 안 써도 됨 — `script.js`가 날짜 기준 최신순으로 자동 정렬함.

## 로컬에서 미리 보기
JSON을 `fetch`로 불러오기 때문에 파일을 더블클릭해서 여는(file://) 방식으로는 안 보임.
터미널에서 이 폴더 안에 들어가 아래 명령 중 하나 실행 후 `http://localhost:8000` 접속:

```
python3 -m http.server 8000
```

GitHub Pages에 배포된 실제 사이트에서는 이 과정 필요 없이 그냥 바로 보임.

## 배포
GitHub Pages가 push할 때마다 자동 반영. 별도 빌드 과정 없음.

## 프리렌더
책·논문·기사 목록은 브라우저에서 `script.js`가 그리지만, JS를 실행하지 않는 검색 로봇(네이버 등)과 링크 미리보기 봇을 위해
같은 목록을 `index.html`에도 미리 채워 둔다. `<!--prerender:…-->` 주석 사이가 그 구간이며, 직접 고치지 않는다.
`data/*.json`을 푸시하면 GitHub Action이 `node scripts/prerender.mjs`를 돌려 `index.html`을 갱신해 커밋한다.
로컬에서 확인하려면 같은 명령을 직접 실행하면 된다.
