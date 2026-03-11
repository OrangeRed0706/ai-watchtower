# ai-watchtower

`ai-watchtower` 不是單純的 AI 新聞站，也不是 RSS reader。

它的目標是把高噪音、分散、容易造成焦慮的 AI 資訊流，轉成**可驗證、可回看、可決策**的個人 intelligence publishing system。

---

## 這個專案在做什麼

系統分成四層：

1. **Source Acquisition**
   - 抓取 RSS / Atom / 官方 news / blog / changelog / release notes
   - 管理來源分級、優先級、抓取策略

2. **Intelligence Pipeline**
   - normalization
   - dedup
   - classification
   - scoring
   - digest candidate selection
   - digest assembly

3. **Static Publishing**
   - 只讀 pipeline 產出的 artifacts
   - 用 Eleventy render 成靜態網站

4. **Delivery**
   - GitHub Actions 跑 pipeline + build
   - GitHub Pages 只負責 serve 最終靜態內容

---

## 架構圖

```text
[ Sources / Feeds ]
        |
        v
[ scripts/ingest.js ]
  - fetch
  - normalize
  - dedup
  - classify
  - score
        |
        v
[ artifacts/*.json ]
  - ingested.json
  - candidates.json
  - digests.json
  - dedupGroups.json
        |
        v
[ Eleventy site (src/) ]
  - load artifacts
  - render pages
        |
        v
[ public/ ]
        |
        v
[ GitHub Pages ]
```

---

## 現在的設計原則

### 1. Artifact-first
先產資料，再 render 網站。

不是在 build 頁面時順便偷偷算資料，而是：
- pipeline 先產出 artifacts
- site 只讀 artifacts
- deploy 只發靜態結果

### 2. Architecture first
必要時接受 breaking changes。

這個專案目前優先順序不是相容舊混合態，而是先把架構收斂正確。

### 3. Deterministic first
現階段優先用 deterministic pipeline 建立穩定骨架。

AI summary / synthesis 會放在後續階段，不在目前這一輪硬塞進整條鏈。

### 4. Real-data first
不再接受 fake/example content 當主要展示內容。

---

## 目前已完成的能力

### 已完成
- GitHub Pages 上線
- RSS / Atom ingestion MVP
- source policy / tiering
- normalization
- deterministic candidate scoring
- cross-source dedup 初版
- deterministic classification 初版
- real-data-first homepage / candidates / dedup views
- CI 與本機 Node 版本對齊（Node 24）
- GitHub Pages workflow 已改成先跑 pipeline，再 build site
- artifact-first 主幹已開始落地

### 目前 artifact 輸出
執行 pipeline 後會產生：

- `artifacts/ingested.json`
- `artifacts/candidates.json`
- `artifacts/digests.json`
- `artifacts/dedupGroups.json`

這些檔案是網站渲染的正式資料輸入。

---

## 目前還沒完成的部分

這個專案還沒有完全收斂完成，主要剩下：

- site layer 再瘦身，徹底只做 render
- artifact contract 再固定
- digest assembly 再產品化
- AI summary / why-it-matters / synthesis layer
- 更完整的 publishing quality（daily / weekly intelligence surface）

也就是說：

**現在已經不是錯架構，但仍在從 prototype / mixed build 過渡到完整 artifact-first publishing pipeline 的過程中。**

---

## 目錄說明

### 手寫 source / pipeline
- `config/sources.json`：來源設定
- `scripts/ingest.js`：抓取與處理入口
- `scripts/build-artifacts.js`：生成 publishing artifacts
- `scripts/lib/`：dedup / classify / scoring / publish 等邏輯

### Site layer
- `src/`：Eleventy templates / styles / site data loaders

### Generated artifacts
- `artifacts/`：pipeline 產出的資料（gitignored）

### Final static output
- `public/`：Eleventy build 後產出的網站（gitignored）

---

## 本機執行方式

### 1. 安裝依賴
```bash
npm ci
```

### 2. 跑 pipeline
```bash
npm run pipeline
```

這一步會：
- 抓來源
- 更新資料庫
- 產出 artifacts

### 3. build 靜態網站
```bash
npm run build
```

### 4. 開發模式
```bash
npm run dev
```

### 清理
```bash
npm run clean
```

---

## CI / Deploy 流程

GitHub Actions Pages workflow 現在是：

1. `npm ci`
2. `npm run pipeline`
3. `npm run build`
4. deploy 到 GitHub Pages

這代表：
- CI 不再只 build 頁面
- CI 會先生成 artifacts
- Pages 看到的是 pipeline + site 一致的結果

---

## Source of Truth

### Pipeline truth
- `artifacts/*.json`
- 這些是網站真正吃的資料輸出

### Site truth
- `src/` 裡的 templates / styles / loaders
- 只負責 render，不應再承擔主要 business logic

---

## Live URLs

- Site: <https://orangered0706.github.io/ai-watchtower/>
- Candidates: <https://orangered0706.github.io/ai-watchtower/candidates/>
- Dedup: <https://orangered0706.github.io/ai-watchtower/dedup/>
- Repo: <https://github.com/OrangeRed0706/ai-watchtower>

---

## 目前 Phase 狀態

### Phase 1
- ingestion MVP
- 已完成

### Phase 2
- source policy / scoring / candidates / dedup / classification 初版
- 已大致完成

### Phase 3
- artifact-first refactor
- 進行中，但已完成關鍵主幹：
  - 拆掉 prebuild coupling
  - 導入 artifacts/
  - CI 改成先 pipeline 再 build

### 後續階段
- digest productization
- summary synthesis
- higher-quality intelligence surface

---

## 專案判斷標準

這個專案後續不是看「加了幾個頁面」或「抓了多少來源」，而是看：

1. pipeline / artifacts / site / deploy 邊界是否清楚
2. local / CI / Pages 是否一致
3. 最終輸出是否真的降低資訊噪音
4. Lynn 是否能直接看懂並做判斷
5. 專案是否可長期穩定演進

如果這幾件事沒有同時成立，就不算真正完成。
