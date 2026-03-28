# Changelog

All notable changes to ERP 全家桶 will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

*(下一版本的功能將記錄於此)*

---

## [0.3.0] - 2026-03-28

### Added

- **CRM 客服工單模組 (ServiceTicket)**: 支援投訴、詢問、維修、退貨四種工單類型；含工單指派、解決流程及關閉流程
- **管理後台 (Admin Module)**: 超級管理員可執行用戶管理、租戶管理及系統備份操作
- **雙因素驗證 (2FA)**: 基於 TOTP 標準，支援 QR 碼掃描設定、啟用與停用完整流程
- **管理員側邊欄區塊**: 依角色（超級管理員 / 租戶管理員）動態顯示不同導覽選項
- **Swagger API 文件**: 後端 API 完整文件化，並新增全面演示資料種子腳本

### Fixed

- 修正儀表板日期水合警告 (hydration warning)
- 修正 API 基礎 URL 備用埠號（從 3001 更新為 4001）
- 移除 nest-cli swagger 插件衝突，修正 Prisma client 輸出路徑
- 修正 `data?.meta?.total` 在 meta 未定義時的防衛性存取問題
- 修正本地 PostgreSQL 種子腳本

---

## [0.2.0] - 2026-03-27

### Added

- **商業智能儀表板 (BI Dashboard)**: 跨模組 KPI 彙整卡片、月度銷售趨勢折線圖、訂單狀態分佈圓餅圖、客戶消費排行榜；儀表板已串接後端即時 BI API
- **BPM 流程管理**: 流程定義建立、流程實例追蹤、逐步審核與狀態推進
- **POS 銷售端點**: 收銀台介面、班次開關管理、POS 訂單列表
- **品質管理 (QC)**: IQC（進料檢驗）、IPQC（製程檢驗）、OQC（出貨檢驗）三類工單，以及不合格品 (NCR) 管理流程
- **設定頁面 (Settings)**: 全域系統設定介面

### Added (Infrastructure)

- **E2E 測試套件**: 完整端對端測試，包含 GitHub Actions CI 工作流程，整合 PostgreSQL 服務容器

---

## [0.1.0] - 2026-03-25

### Added

**平台基礎架構**

- **11 模組完整架構**: 財務、採購、銷售、庫存、生產、人力資源、CRM、品質、BI、BPM、POS
- **多租戶架構 (Multi-tenancy)**: Schema-per-Tenant PostgreSQL 資料隔離設計
- **JWT 認證系統**: Access Token + Refresh Token，含帳戶鎖定機制
- **RBAC 權限系統**: 三層角色架構（超級管理員 / 租戶管理員 / 一般用戶）
- **Monorepo 基礎**: pnpm workspaces + Turborepo，前後端統一管理

**財務管理 (Finance)**

- 會計科目樹狀管理
- 日記帳（含借貸平衡驗證）
- 發票開立與管理
- 付款記錄

**採購管理 (Procurement)**

- 供應商主檔
- 採購申請 (PR) → 採購單 (PO) 審批工作流
- 收貨單 (GR) 管理

**銷售管理 (Sales)**

- 客戶主檔
- 銷售訂單
- 出貨單管理

**庫存管理 (Inventory)**

- 多倉庫管理
- 品項主檔
- 庫存交易（入庫／出庫／調撥）
- 庫存盤點作業

**生產管理 (Manufacturing)**

- 物料清單 (BOM) 管理
- 工單建立與追蹤
- 生產工序與材料領用

**人力資源 (HR)**

- 員工主檔
- 出勤記錄
- 請假申請
- 薪資計算

**客戶關係管理 (CRM)**

- 潛在客戶 (Lead) 管理
- 銷售機會 (Opportunity) 追蹤
- 活動記錄 (Activity Log)

**DevOps 與基礎設施**

- **Docker Compose**: PostgreSQL 16、Redis 7、MinIO 物件儲存、PgBouncer 連線池
- **GitHub Actions CI/CD**: TypeScript 型別檢查、ESLint、Build、E2E 測試自動化
- **Prisma ORM**: 資料庫遷移基線建立，多租戶 schema 動態切換

---

## Architecture Overview

| 層級 | 技術 |
|------|------|
| 前端 | Next.js 14 + shadcn/ui（深色科技主題） |
| 後端 | NestJS + Prisma ORM + RESTful API v1 |
| 資料庫 | PostgreSQL 16（Schema-per-Tenant） |
| 快取 | Redis 7 |
| 物件儲存 | MinIO |
| 認證 | JWT + TOTP 2FA |

**訂閱方案**: Starter NT$2,990／月 → Professional → Enterprise

---

[Unreleased]: https://github.com/marchmuffin/ERP全家桶/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/marchmuffin/ERP全家桶/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/marchmuffin/ERP全家桶/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/marchmuffin/ERP全家桶/releases/tag/v0.1.0
