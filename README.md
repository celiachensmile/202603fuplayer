# 富玩家顧問實踐營 — 問卷系統

## 部署到 Netlify（免費）

### 步驟一：上傳到 GitHub
1. 在 GitHub 建立新的 repository（可設為 Private）
2. 將此資料夾所有檔案上傳或 git push 至 repo

### 步驟二：連結 Netlify
1. 至 https://app.netlify.com 登入 / 註冊
2. 點「Add new site → Import an existing project」
3. 選擇你的 GitHub repo
4. Build settings：
   - Build command：留空（不需要）
   - Publish directory：`public`
5. 點「Deploy site」

### 步驟三：設定環境變數
在 Netlify Dashboard → Site settings → Environment variables：
- `ADMIN_PASSWORD` = 你的管理員密碼（例如 `fuplayer2026`）

### 步驟四：啟用 Netlify Blobs
Blobs 資料庫在部署後自動啟用，無需額外設定。

---

## 頁面說明
- `/` 或 `/index.html` → 問卷填答頁
- `/admin.html` → 後台管理（需輸入密碼）

## 後台功能
- 即時統計摘要（份數、年齡層、AI衝擊、顧問興趣、意願比例）
- 15 個題目圖表分析
- 5 組交叉分析熱度圖
- 原始記錄瀏覽
- CSV 一鍵匯出（Excel 相容 UTF-8 BOM）

## 修改密碼
在 Netlify 的環境變數中修改 `ADMIN_PASSWORD` 即可，無需改動程式碼。
