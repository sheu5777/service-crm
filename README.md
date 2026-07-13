# 服務處 CRM Secure V4

這一版已加入：

- Google 登入
- 白名單成員
- 角色權限
- 志工唯讀
- 助理／主任可新增與修改
- 管理員可管理成員
- 操作紀錄
- Firebase Firestore 雲端同步
- 完整 JSON 備份

## 一、先上傳檔案到 GitHub

把本壓縮檔解壓縮後，將以下檔案上傳到原本 `service-crm` 儲存庫並覆蓋舊檔：

- index.html
- styles.css
- app.js
- firebase-config.js
- manifest.json
- firestore.rules
- README.md

## 二、把 Firestore 規則貼上

Firebase Console：

Firestore Database → Rules

把 `firestore.rules` 全部內容貼上，按 Publish。

## 三、建立第一位管理員

因為安全規則已經鎖住，第一位管理員必須手動建立。

### 1. 取得你的 Firebase UID

Firebase Console：

Authentication → Users → 點你的 Google 帳號

複製 UID。

### 2. 在 Firestore 建立文件

Firestore Database → Data

依序建立：

- Collection：`workspaces`
- Document ID：`service-office-main`
- Subcollection：`members`
- Document ID：貼上你的 UID

欄位：

- `email`：你的 Google Email（string）
- `displayName`：你的姓名（string）
- `role`：`admin`（string）
- `active`：`true`（boolean）

建立完成後重新整理網站，就能進入。

## 四、加入其他同仁

每位同仁先用 Google 登入一次，Firebase Authentication 就會留下該帳號與 UID。

管理員再到 Firestore 的：

`workspaces / service-office-main / members`

新增一筆文件：

- Document ID：該同仁 UID
- email：同仁 Email
- displayName：同仁姓名
- role：可用 `director`、`assistant`、`volunteer`
- active：true

角色說明：

- `admin`：管理員，可管理所有功能與成員
- `director`：主任，可讀寫民眾、案件、追蹤
- `assistant`：助理，可讀寫民眾、案件、追蹤
- `volunteer`：志工，只能查看

## 五、Authorized Domains

Firebase Console：

Authentication → Settings → Authorized domains

加入：

`sheu5777.github.io`

若新版介面暫時找不到，可先測試登入；如果出現 `auth/unauthorized-domain` 再補設定。

## 六、重要安全提醒

這一版已經比前版安全，但正式存放大量真實個資前，仍建議：

- 啟用多因素驗證
- 建立定期備份
- 建立離職停權流程
- 定期檢查成員白名單
- 設定資料保存期限
- 不紀錄政治傾向、投票意向或其他不必要敏感資料
