# 服務處 CRM V5

這一版已完成：

- Google 登入
- Firebase Firestore 雲端同步
- 成員白名單與 Email 邀請
- 管理員、主任、助理、志工角色
- 志工唯讀
- 操作紀錄
- 民眾、案件、追蹤任務
- 完整 JSON 備份

Firebase 官方支援模組化 Web SDK、Google 登入與 Firestore Security Rules；本專案使用 CDN 模組，方便 GitHub Pages 直接部署。

## 手機部署：覆蓋 GitHub 舊檔

1. 下載並解壓縮 V5。
2. 打開 GitHub 的 `service-crm`。
3. Add file → Upload files。
4. 選取本資料夾內全部檔案。
5. 同名檔案會更新，最後按 Commit changes。

上傳檔案：

- index.html
- styles.css
- app.js
- firebase-config.js
- firestore.rules
- manifest.json
- README.md

## Firestore 規則

Firebase Console：

Firestore Database → Rules

把 `firestore.rules` 全部貼上，按 Publish。

若手機無法打開規則檔，可直接在 ChatGPT 對話中要求「把 V5 規則貼出來」。

## 建立第一位管理員（只做一次）

第一位管理員仍需在 Firebase Console 手動建立，之後新增同仁就能直接用 Email 邀請。

### 取得 UID

Firebase Console：

Authentication → Users → 點自己的 Google 帳號 → 複製 UID。

### 建立管理員文件

Firestore Database → Data：

1. 建立 Collection：`workspaces`
2. 文件 ID：`service-office-main`
3. 在該文件建立 Subcollection：`members`
4. 文件 ID：貼上自己的 UID
5. 建立欄位：

- email（string）：自己的 Google Email
- displayName（string）：自己的姓名
- role（string）：admin
- active（boolean）：true

完成後重新開啟 CRM。

## 之後邀請同仁

管理員進入 CRM：

成員權限 → 輸入同仁 Google Email → 選角色 → 送出邀請。

同仁用該 Google 帳號登入，系統會自動建立成員權限，不需要再找 UID。

## GitHub Pages 網域

若登入出現 `auth/unauthorized-domain`：

Firebase Authentication → Settings → Authorized domains

加入：

`sheu5777.github.io`

## 正式使用前

- 定期匯出備份
- 離職人員立即停用
- 不共用 Google 帳號
- 不紀錄政治傾向、投票意向或不必要敏感資料
- 建議後續加入多因素驗證與附件存取規則
