-- ERP 全家桶 - Sales Module Tenant Schema DDL
-- Run this script inside the tenant's schema after creation
-- Usage: SET search_path TO "tenant_xxx"; then run this file

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            VARCHAR(20) UNIQUE NOT NULL,
  name            VARCHAR(200) NOT NULL,
  name_en         VARCHAR(200),
  tax_id          VARCHAR(20),
  credit_limit    NUMERIC(15,2) NOT NULL DEFAULT 0,
  credit_balance  NUMERIC(15,2) NOT NULL DEFAULT 0,
  payment_terms   INTEGER NOT NULL DEFAULT 30,
  grade           VARCHAR(1) NOT NULL DEFAULT 'C',
  contact_name    VARCHAR(100),
  contact_phone   VARCHAR(50),
  contact_email   VARCHAR(254),
  address         TEXT,
  city            VARCHAR(100),
  country         VARCHAR(2) NOT NULL DEFAULT 'TW',
  currency        VARCHAR(3) NOT NULL DEFAULT 'TWD',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(code);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);

-- ============================================================
-- SALES ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_no          VARCHAR(30) UNIQUE NOT NULL,
  customer_id       UUID NOT NULL REFERENCES customers(id),
  status            VARCHAR(30) NOT NULL DEFAULT 'draft',
  order_date        DATE NOT NULL,
  requested_date    DATE,
  shipping_address  TEXT,
  currency          VARCHAR(3) NOT NULL DEFAULT 'TWD',
  exchange_rate     NUMERIC(10,6) NOT NULL DEFAULT 1,
  subtotal          NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
  total             NUMERIC(15,2) NOT NULL DEFAULT 0,
  credit_checked    BOOLEAN NOT NULL DEFAULT FALSE,
  notes             TEXT,
  approved_by       UUID,
  approved_at       TIMESTAMP WITH TIME ZONE,
  created_by        UUID NOT NULL,
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sales_orders_order_no ON sales_orders(order_no);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer_id ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_date ON sales_orders(order_date DESC);

-- ============================================================
-- SALES ORDER LINES
-- ============================================================
CREATE TABLE IF NOT EXISTS so_lines (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  so_id       UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  line_no     INTEGER NOT NULL,
  item_code   VARCHAR(30) NOT NULL,
  item_name   VARCHAR(200) NOT NULL,
  spec        VARCHAR(200),
  unit        VARCHAR(20) NOT NULL,
  quantity    NUMERIC(15,4) NOT NULL,
  unit_price  NUMERIC(15,4) NOT NULL,
  discount    NUMERIC(5,2) NOT NULL DEFAULT 0,
  amount      NUMERIC(15,2) NOT NULL,
  shipped_qty NUMERIC(15,4) NOT NULL DEFAULT 0,
  notes       TEXT,
  UNIQUE(so_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_so_lines_so_id ON so_lines(so_id);

-- ============================================================
-- DELIVERY ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_orders (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  do_no       VARCHAR(30) UNIQUE NOT NULL,
  so_id       UUID NOT NULL REFERENCES sales_orders(id),
  status      VARCHAR(20) NOT NULL DEFAULT 'draft',
  ship_date   DATE,
  carrier     VARCHAR(100),
  tracking_no VARCHAR(100),
  notes       TEXT,
  created_by  UUID NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_orders_so_id ON delivery_orders(so_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_status ON delivery_orders(status);

-- Auto-update triggers
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sales_orders_updated_at BEFORE UPDATE ON sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_delivery_orders_updated_at BEFORE UPDATE ON delivery_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
