# API Reference / API 參考文件

> **Language**: This document is written in Traditional Chinese with English technical terms.
> **語言**: 本文件以繁體中文撰寫，技術術語保留英文。

---

## 概覽 / Overview

| 項目 | 值 |
|------|-----|
| Base URL | `http://localhost:4001/v1` |
| 資料格式 | JSON |
| 字元編碼 | UTF-8 |
| 時間格式 | ISO 8601 (`2026-03-28T10:00:00.000Z`) |

---

## 認證 / Authentication

系統使用 **Bearer JWT Token** 進行身份驗證。

- Access Token 有效期：**15 分鐘**
- Refresh Token 有效期：**7 天**
- 所有受保護的端點需在請求標頭加入：

```
Authorization: Bearer <access_token>
```

### Token 刷新流程

```
Access Token 過期
       ↓
POST /auth/refresh (附上 refresh token)
       ↓
取得新的 access token
```

---

## 錯誤回應格式 / Error Response Format

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

| HTTP 狀態碼 | 說明 |
|-------------|------|
| 400 | 請求參數錯誤 |
| 401 | 未認證或 Token 無效 |
| 403 | 權限不足 |
| 404 | 資源不存在 |
| 409 | 資源衝突（如重複建立） |
| 500 | 伺服器內部錯誤 |

---

## 模組端點 / Module Endpoints

---

### Auth（認證）

#### POST /auth/login

使用者登入，取得 JWT Token。

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response 200:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clx1234567890",
    "email": "admin@example.com",
    "name": "系統管理員",
    "role": "SUPER_ADMIN",
    "tenantId": null,
    "twoFactorEnabled": false
  }
}
```

**Response 200（需要 2FA）:**
```json
{
  "requiresTwoFactor": true,
  "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### POST /auth/refresh

使用 Refresh Token 取得新的 Access Token。

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response 200:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### GET /auth/me

取得目前登入使用者的資訊。需要有效的 Access Token。

**Response 200:**
```json
{
  "id": "clx1234567890",
  "email": "admin@example.com",
  "name": "系統管理員",
  "role": "SUPER_ADMIN",
  "tenantId": null,
  "twoFactorEnabled": true,
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

---

#### POST /auth/2fa/setup

初始化 2FA 設定，取得 QR Code 與備用碼。需要已登入。

**Response 200:**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "backupCodes": [
    "abc12345",
    "def67890",
    "ghi11223"
  ]
}
```

---

#### POST /auth/2fa/enable

驗證 TOTP 並啟用 2FA。

**Request Body:**
```json
{
  "token": "123456"
}
```

**Response 200:**
```json
{
  "message": "Two-factor authentication enabled successfully"
}
```

---

#### POST /auth/2fa/disable

停用 2FA，需提供當前 TOTP 驗證碼。

**Request Body:**
```json
{
  "token": "123456"
}
```

**Response 200:**
```json
{
  "message": "Two-factor authentication disabled successfully"
}
```

---

### Users（使用者管理）

#### GET /users

取得租戶範圍內的使用者列表（一般管理員）。支援分頁與搜尋。

**Query Parameters:**

| 參數 | 類型 | 說明 |
|------|------|------|
| `page` | number | 頁碼（預設 1）|
| `limit` | number | 每頁筆數（預設 20）|
| `search` | string | 搜尋姓名或 Email |
| `role` | string | 依角色篩選 |
| `isActive` | boolean | 依啟用狀態篩選 |

**Response 200:**
```json
{
  "data": [
    {
      "id": "clx1234567890",
      "email": "user@tenant.com",
      "name": "張三",
      "role": "TENANT_ADMIN",
      "isActive": true,
      "twoFactorEnabled": false,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

#### GET /users/system

取得系統全域使用者列表（僅限 Super Admin）。

**Response 200:** 格式同 `GET /users`。

---

#### GET /users/roles

取得可用角色列表。

**Response 200:**
```json
{
  "roles": [
    "SUPER_ADMIN",
    "TENANT_ADMIN",
    "MANAGER",
    "STAFF",
    "VIEWER"
  ]
}
```

---

#### POST /users

建立新使用者。

**Request Body:**
```json
{
  "email": "newuser@tenant.com",
  "name": "李四",
  "password": "SecurePass123!",
  "role": "STAFF",
  "tenantId": "clx9876543210"
}
```

**Response 201:**
```json
{
  "id": "clx1111111111",
  "email": "newuser@tenant.com",
  "name": "李四",
  "role": "STAFF",
  "isActive": true,
  "createdAt": "2026-03-28T10:00:00.000Z"
}
```

---

#### PATCH /users/:id

更新使用者資訊（部分更新）。

**Request Body:**
```json
{
  "name": "李四（更新）",
  "role": "MANAGER"
}
```

**Response 200:** 回傳更新後的使用者物件。

---

#### PATCH /users/:id/activate

啟用或停用使用者帳號。

**Request Body:**
```json
{
  "isActive": false
}
```

**Response 200:**
```json
{
  "message": "User account deactivated successfully"
}
```

---

#### PATCH /users/:id/reset-2fa

重設使用者的 2FA（僅限管理員）。

**Response 200:**
```json
{
  "message": "Two-factor authentication reset successfully"
}
```

---

#### DELETE /users/:id

刪除使用者（軟刪除）。

**Response 204:** 無內容。

---

### Tenants（租戶管理）

#### GET /tenants

取得所有租戶列表（僅限 Super Admin）。

**Query Parameters:**

| 參數 | 類型 | 說明 |
|------|------|------|
| `page` | number | 頁碼 |
| `limit` | number | 每頁筆數 |
| `search` | string | 搜尋租戶名稱 |
| `status` | string | `ACTIVE` \| `SUSPENDED` |

**Response 200:**
```json
{
  "data": [
    {
      "id": "clx9876543210",
      "name": "台灣製造股份有限公司",
      "slug": "taiwan-mfg",
      "status": "ACTIVE",
      "userCount": 25,
      "createdAt": "2026-01-15T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 10,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

#### POST /tenants

建立新租戶，並自動初始化獨立的 PostgreSQL Schema。

**Request Body:**
```json
{
  "name": "新創企業有限公司",
  "slug": "startup-co",
  "adminEmail": "admin@startup-co.com",
  "adminName": "王五",
  "adminPassword": "SecurePass123!"
}
```

**Response 201:**
```json
{
  "id": "clx2222222222",
  "name": "新創企業有限公司",
  "slug": "startup-co",
  "status": "ACTIVE",
  "createdAt": "2026-03-28T10:00:00.000Z"
}
```

---

#### GET /tenants/export

匯出租戶列表為 CSV 檔案（僅限 Super Admin）。

**Response 200:** `Content-Type: text/csv`

```
id,name,slug,status,userCount,createdAt
clx9876543210,台灣製造股份有限公司,taiwan-mfg,ACTIVE,25,2026-01-15T00:00:00.000Z
```

---

#### GET /tenants/:id

取得單一租戶詳細資訊。

**Response 200:**
```json
{
  "id": "clx9876543210",
  "name": "台灣製造股份有限公司",
  "slug": "taiwan-mfg",
  "status": "ACTIVE",
  "userCount": 25,
  "schemaName": "tenant_taiwan_mfg",
  "createdAt": "2026-01-15T00:00:00.000Z",
  "updatedAt": "2026-03-01T00:00:00.000Z"
}
```

---

#### PATCH /tenants/:id

更新租戶資訊。

**Request Body:**
```json
{
  "name": "台灣製造（更新後）股份有限公司"
}
```

**Response 200:** 回傳更新後的租戶物件。

---

#### PATCH /tenants/:id/suspend

暫停租戶，所有租戶使用者將無法登入。

**Response 200:**
```json
{
  "message": "Tenant suspended successfully"
}
```

---

#### PATCH /tenants/:id/activate

重新啟用已暫停的租戶。

**Response 200:**
```json
{
  "message": "Tenant activated successfully"
}
```

---

### Procurement（採購）

#### GET /procurement/vendors

取得供應商列表。

**Response 200:**
```json
{
  "data": [
    {
      "id": "clx3333333333",
      "name": "原材料供應商甲",
      "contactName": "陳大明",
      "email": "chen@supplier-a.com",
      "phone": "+886-2-1234-5678",
      "address": "台北市信義區...",
      "isActive": true
    }
  ]
}
```

---

#### POST /procurement/vendors

建立新供應商。

**Request Body:**
```json
{
  "name": "原材料供應商乙",
  "contactName": "林小美",
  "email": "lin@supplier-b.com",
  "phone": "+886-3-9876-5432",
  "address": "新竹市東區..."
}
```

---

#### GET /procurement/purchase-orders

取得採購訂單列表。

**Query Parameters:** `page`, `limit`, `status` (`DRAFT` | `PENDING` | `APPROVED` | `RECEIVED` | `CANCELLED`)

**Response 200:**
```json
{
  "data": [
    {
      "id": "clx4444444444",
      "orderNumber": "PO-2026-0001",
      "vendorId": "clx3333333333",
      "vendor": { "name": "原材料供應商甲" },
      "status": "APPROVED",
      "totalAmount": 150000.00,
      "currency": "TWD",
      "orderDate": "2026-03-01T00:00:00.000Z",
      "expectedDeliveryDate": "2026-03-15T00:00:00.000Z"
    }
  ]
}
```

---

#### POST /procurement/purchase-orders

建立採購訂單。

**Request Body:**
```json
{
  "vendorId": "clx3333333333",
  "orderDate": "2026-03-28",
  "expectedDeliveryDate": "2026-04-10",
  "items": [
    {
      "itemId": "clx5555555555",
      "quantity": 100,
      "unitPrice": 500.00,
      "unit": "個"
    }
  ],
  "notes": "請於指定日期前交貨"
}
```

---

#### GET /procurement/purchase-orders/:id

取得單一採購訂單詳細資訊，包含所有項目明細。

---

#### PATCH /procurement/purchase-orders/:id/approve

核准採購訂單（需主管權限）。

**Response 200:**
```json
{
  "message": "Purchase order approved successfully",
  "status": "APPROVED"
}
```

---

#### PATCH /procurement/purchase-orders/:id/receive

標記採購訂單為已收貨，並自動更新庫存。

**Request Body:**
```json
{
  "receivedDate": "2026-04-10",
  "items": [
    {
      "lineId": "clx6666666666",
      "receivedQuantity": 95
    }
  ],
  "notes": "5件因品質問題退回"
}
```

---

### Sales（銷售）

#### GET /sales/customers

取得客戶列表。

**Response 200:**
```json
{
  "data": [
    {
      "id": "clx7777777777",
      "name": "客戶A股份有限公司",
      "contactName": "黃建國",
      "email": "huang@customer-a.com",
      "phone": "+886-4-2345-6789",
      "creditLimit": 500000.00,
      "balance": 120000.00
    }
  ]
}
```

---

#### POST /sales/customers

建立新客戶。

---

#### GET /sales/orders

取得銷售訂單列表。

**Query Parameters:** `page`, `limit`, `status` (`DRAFT` | `CONFIRMED` | `SHIPPED` | `DELIVERED` | `CANCELLED`)

---

#### POST /sales/orders

建立銷售訂單。

**Request Body:**
```json
{
  "customerId": "clx7777777777",
  "orderDate": "2026-03-28",
  "requestedDeliveryDate": "2026-04-05",
  "items": [
    {
      "itemId": "clx5555555555",
      "quantity": 50,
      "unitPrice": 1200.00
    }
  ]
}
```

---

#### GET /sales/orders/:id

取得單一銷售訂單詳細資訊，包含客戶資訊與訂單明細。

---

#### PATCH /sales/orders/:id/confirm

確認銷售訂單（狀態從 DRAFT 變為 CONFIRMED）。

---

#### PATCH /sales/orders/:id/ship

標記訂單為已出貨。

**Request Body:**
```json
{
  "shippedDate": "2026-04-03",
  "trackingNumber": "TWE1234567890",
  "carrier": "黑貓宅急便"
}
```

---

#### PATCH /sales/orders/:id/deliver

標記訂單為已送達（完成）。

---

### Inventory（庫存）

#### GET /inventory/items

取得庫存品項列表。

**Response 200:**
```json
{
  "data": [
    {
      "id": "clx5555555555",
      "sku": "ITEM-001",
      "name": "鋁製零件A",
      "category": "原材料",
      "unit": "個",
      "reorderPoint": 50,
      "currentStock": 235
    }
  ]
}
```

---

#### POST /inventory/items

建立新庫存品項。

---

#### GET /inventory/warehouses

取得倉庫列表。

---

#### POST /inventory/warehouses

建立新倉庫。

**Request Body:**
```json
{
  "name": "台北主倉庫",
  "code": "WH-TPE-001",
  "address": "台北市南港區...",
  "capacity": 10000
}
```

---

#### GET /inventory/warehouses/:id

取得單一倉庫詳細資訊及庫存狀況。

---

#### GET /inventory/stock-levels

取得各倉庫庫存水位總覽。

**Query Parameters:** `warehouseId`, `itemId`, `belowReorderPoint` (boolean)

**Response 200:**
```json
{
  "data": [
    {
      "itemId": "clx5555555555",
      "item": { "sku": "ITEM-001", "name": "鋁製零件A" },
      "warehouseId": "clx8888888888",
      "warehouse": { "name": "台北主倉庫" },
      "quantity": 235,
      "reservedQuantity": 50,
      "availableQuantity": 185,
      "reorderPoint": 50
    }
  ]
}
```

---

#### GET /inventory/transactions

取得庫存異動記錄。

**Query Parameters:** `page`, `limit`, `type` (`IN` | `OUT` | `TRANSFER` | `ADJUSTMENT`), `itemId`, `warehouseId`

---

#### POST /inventory/transactions

手動建立庫存異動記錄（用於調整盤點差異等情況）。

---

#### GET /inventory/counts

取得盤點單列表。

---

#### POST /inventory/counts

建立新盤點單。

**Request Body:**
```json
{
  "warehouseId": "clx8888888888",
  "countDate": "2026-03-31",
  "notes": "季末盤點"
}
```

---

#### GET /inventory/counts/:id

取得單一盤點單詳細資訊及盤點明細。

---

#### PATCH /inventory/counts/:id/complete

完成盤點，自動計算差異並調整庫存數量。

---

#### PATCH /inventory/counts/:id/lines/:lineId

更新單一盤點明細的實際數量。

**Request Body:**
```json
{
  "actualQuantity": 230,
  "notes": "發現5件損壞"
}
```

---

### Finance（財務）

#### GET /finance/accounts

取得會計科目列表。

**Response 200:**
```json
{
  "data": [
    {
      "id": "clxaaaaaaaaa",
      "code": "1101",
      "name": "現金",
      "type": "ASSET",
      "normalBalance": "DEBIT",
      "balance": 1250000.00,
      "isActive": true
    }
  ]
}
```

---

#### POST /finance/accounts

建立新會計科目。

---

#### GET /finance/journal-entries

取得分錄列表。

**Query Parameters:** `page`, `limit`, `status` (`DRAFT` | `POSTED`), `startDate`, `endDate`

---

#### POST /finance/journal-entries

建立新分錄。借方合計必須等於貸方合計，否則回傳 400 錯誤。

**Request Body:**
```json
{
  "entryDate": "2026-03-28",
  "description": "支付供應商貨款",
  "lines": [
    {
      "accountId": "clxbbbbbbbbb",
      "debit": 150000.00,
      "credit": 0,
      "description": "應付帳款減少"
    },
    {
      "accountId": "clxaaaaaaaaa",
      "debit": 0,
      "credit": 150000.00,
      "description": "現金減少"
    }
  ]
}
```

---

#### GET /finance/journal-entries/:id

取得單一分錄詳細資訊及各行明細。

---

#### PATCH /finance/journal-entries/:id/post

過帳分錄（狀態從 DRAFT 變為 POSTED）。過帳後不可修改或刪除。

**Response 200:**
```json
{
  "message": "Journal entry posted successfully",
  "postedAt": "2026-03-28T10:00:00.000Z"
}
```

---

#### GET /finance/payables

取得應付帳款列表（來自已核准採購訂單）。

**Response 200:**
```json
{
  "data": [
    {
      "vendorId": "clx3333333333",
      "vendor": { "name": "原材料供應商甲" },
      "totalAmount": 150000.00,
      "paidAmount": 0,
      "balance": 150000.00,
      "dueDate": "2026-04-28T00:00:00.000Z"
    }
  ]
}
```

---

#### GET /finance/receivables

取得應收帳款列表（來自已確認銷售訂單）。

---

### HR（人力資源）

#### GET /hr/employees

取得員工列表。

**Response 200:**
```json
{
  "data": [
    {
      "id": "clxccccccccc",
      "employeeNumber": "EMP-0001",
      "name": "張小明",
      "department": "生產部",
      "position": "生產工程師",
      "hireDate": "2024-07-01",
      "salary": 65000.00,
      "isActive": true
    }
  ]
}
```

---

#### POST /hr/employees

建立新員工記錄。

---

#### GET /hr/leave-requests

取得請假申請列表。

**Query Parameters:** `status` (`PENDING` | `APPROVED` | `REJECTED`), `employeeId`

---

#### POST /hr/leave-requests

提交請假申請。

**Request Body:**
```json
{
  "employeeId": "clxccccccccc",
  "leaveType": "ANNUAL",
  "startDate": "2026-04-01",
  "endDate": "2026-04-03",
  "reason": "家庭旅遊"
}
```

---

#### PATCH /hr/leave-requests/:id/approve

核准請假申請（需主管權限）。

---

#### PATCH /hr/leave-requests/:id/reject

拒絕請假申請，需提供拒絕原因。

**Request Body:**
```json
{
  "reason": "該期間產能不足，請另擇時間"
}
```

---

#### GET /hr/attendances

取得出勤記錄。

**Query Parameters:** `employeeId`, `startDate`, `endDate`

---

#### POST /hr/attendances

建立出勤打卡記錄。

---

#### GET /hr/payroll-runs

取得薪資發放批次列表。

---

#### POST /hr/payroll-runs

建立新薪資發放批次，系統自動計算所有員工薪資。

**Request Body:**
```json
{
  "periodStart": "2026-03-01",
  "periodEnd": "2026-03-31",
  "payDate": "2026-04-05"
}
```

---

#### GET /hr/payroll-runs/:id

取得薪資發放批次詳細資訊及各員工薪資明細。

---

#### PATCH /hr/payroll-runs/:id/approve

核准薪資發放批次（需財務主管權限）。

---

#### PATCH /hr/payroll-runs/:id/mark-paid

標記薪資批次為已發放完成。

---

### Admin（系統管理）

#### GET /admin/backup

觸發資料庫備份並回傳備份檔案（僅限 Super Admin）。

**Response 200:** `Content-Type: application/octet-stream`

回傳備份的 SQL 轉儲檔案，檔名格式：`backup_YYYY-MM-DD_HH-mm-ss.sql`

```
Content-Disposition: attachment; filename="backup_2026-03-28_10-00-00.sql"
```

---

## 角色權限對照表 / Role Permission Matrix

| 功能 | SUPER_ADMIN | TENANT_ADMIN | MANAGER | STAFF | VIEWER |
|------|:-----------:|:------------:|:-------:|:-----:|:------:|
| 管理租戶 | ✓ | - | - | - | - |
| 系統備份 | ✓ | - | - | - | - |
| 管理全體使用者 | ✓ | ✓ | - | - | - |
| 採購核准 | ✓ | ✓ | ✓ | - | - |
| 建立採購單 | ✓ | ✓ | ✓ | ✓ | - |
| 查看所有模組 | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## Swagger UI

開發環境下，可透過以下網址存取互動式 API 文件：

```
http://localhost:4001/api-docs
```
