# 服務處 CRM V7.2 Safari 登入修正版

真正原因是 iPhone Safari 會限制跨網站儲存；網站在 GitHub Pages，Firebase Auth 處理頁在 firebaseapp.com，`signInWithRedirect` 回來後可能遺失登入狀態。

此版改回直接由按鈕觸發的 `signInWithPopup`，並保留：
- 登入狀態保存
- 管理員自動建立
- V7 民眾、案件、統計與 CSV 功能
- 明確錯誤訊息
- 快取版本更新

更新方式：把全部檔案上傳到 GitHub `service-crm` 並 Commit。Firestore Rules 不需修改。
