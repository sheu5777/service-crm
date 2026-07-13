# 服務處 CRM V7.1 iPhone 登入修正版

此版針對 iPhone Safari 點登入按鈕無反應：

- iPhone 改用 Firebase `signInWithRedirect`
- 移除可能讓 Safari 模組停止執行的 top-level await
- 加入登入中狀態與錯誤訊息
- 為 app.js 與 firebase-config.js 加版本參數，避免 Safari/GitHub Pages 快取舊檔
- 其餘 V7 功能與 Firestore Rules 不變

更新方式：把全部檔案上傳到 GitHub `service-crm` 並 Commit。這次不需要重貼 Firestore Rules。
更新後等待約 1–3 分鐘，再於 Safari 重新整理網站。
