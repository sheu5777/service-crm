# 服務處 CRM V6 登入修正版

V5 的 Google 登入本身成功，但 Firestore 規則不允許尚未成為成員的登入者讀取自己的 member 文件，因此權限檢查失敗。

V6 修正：
- 保存 Google 登入狀態
- 允許登入者讀取自己的 member 文件
- `sheu5777@gmail.com` 第一次登入時自動建立為 admin
- 顯示權限檢查與錯誤訊息
- 保留 Email 邀請、角色權限與操作紀錄

更新方式：
1. 將本資料夾全部檔案上傳到 GitHub `service-crm` 並 Commit。
2. Firebase → Firestore Database → 規則。
3. 用本版 `firestore.rules` 全部覆蓋並發布。
4. 回到網站重新整理，再用 `sheu5777@gmail.com` 登入。
