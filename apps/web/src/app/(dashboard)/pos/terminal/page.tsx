'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart, Trash2, Plus, Minus, X, Search,
  CreditCard, Smartphone, Banknote, CheckCircle, AlertTriangle,
} from 'lucide-react';
import { posApi } from '@/lib/api/pos';
import { inventoryApi } from '@/lib/api/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CartItem {
  itemId?: string;
  itemCode: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  discount: number;
}

const TAX_RATE = 0.05;

type PaymentMethod = 'cash' | 'card' | 'mobile';

const PAYMENT_METHODS: { key: PaymentMethod; label: string; icon: any }[] = [
  { key: 'cash', label: '現金', icon: Banknote },
  { key: 'card', label: '刷卡', icon: CreditCard },
  { key: 'mobile', label: '行動支付', icon: Smartphone },
];

function formatCurrency(n: number) {
  return `NT$ ${n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDateTime(s: string) {
  return new Date(s).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' });
}

export default function PosTerminalPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paidInput, setPaidInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [successOrderNo, setSuccessOrderNo] = useState<string | null>(null);

  // Active session
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['pos-active-session'],
    queryFn: posApi.sessions.active,
    retry: false,
  });

  // Inventory items for quick grid (first 8)
  const { data: itemsData } = useQuery({
    queryKey: ['inventory-items-pos', ''],
    queryFn: () => inventoryApi.items.list({ page: 1, perPage: 8 }),
  });

  // Search results
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['inventory-items-search', searchTerm],
    queryFn: () => inventoryApi.items.list({ page: 1, perPage: 10, search: searchTerm }),
    enabled: searchTerm.length >= 1,
  });

  // Cart calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const discountFactor = 1 - item.discount / 100;
      return sum + item.quantity * item.unitPrice * discountFactor;
    }, 0);
  }, [cart]);

  const taxAmount = useMemo(() => subtotal * TAX_RATE, [subtotal]);
  const totalAmount = useMemo(() => subtotal + taxAmount, [subtotal, taxAmount]);
  const paidAmount = Number(paidInput) || 0;
  const changeAmount = paidAmount - totalAmount;

  const addToCart = (item: { id?: string; code: string; name: string; unitCost: number }) => {
    setCart((prev) => {
      const existing = prev.findIndex((c) => c.itemCode === item.code);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + 1 };
        return updated;
      }
      return [...prev, {
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        unitPrice: Number(item.unitCost) || 0,
        quantity: 1,
        discount: 0,
      }];
    });
    setSearchTerm('');
    setShowSearch(false);
  };

  const updateQty = (index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) {
        updated.splice(index, 1);
      } else {
        updated[index] = { ...updated[index], quantity: newQty };
      }
      return updated;
    });
  };

  const removeItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setPaidInput('');
  };

  const createOrderMutation = useMutation({
    mutationFn: () =>
      posApi.orders.create({
        sessionId: session!.id,
        paymentMethod,
        paidAmount,
        lines: cart.map((item) => ({
          itemId: item.itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
        })),
      }),
    onSuccess: (order) => {
      setSuccessOrderNo(order.orderNo);
      clearCart();
    },
  });

  const canCheckout = cart.length > 0 && paidAmount >= totalAmount && session?.status === 'open';

  const quickItems = itemsData?.data ?? [];

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* Left: Cart (60%) */}
      <div className="flex-[3] flex flex-col glass rounded-xl overflow-hidden">
        {/* Cart Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-primary" />
            <h3 className="font-semibold text-foreground">購物車</h3>
            {cart.length > 0 && (
              <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5 font-bold">
                {cart.length}
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearCart} className="text-muted-foreground hover:text-destructive">
              <Trash2 size={14} /> 清空
            </Button>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <ShoppingCart size={40} className="opacity-20" />
              <p className="text-sm">購物車是空的，請新增商品</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item, idx) => {
                const discountFactor = 1 - item.discount / 100;
                const lineAmount = item.quantity * item.unitPrice * discountFactor;
                return (
                  <div key={idx} className="flex items-center gap-3 bg-background/40 rounded-lg px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.itemName}</p>
                      <p className="text-xs text-muted-foreground">{item.itemCode} · {formatCurrency(item.unitPrice)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQty(idx, -1)}
                        className="w-6 h-6 rounded-md bg-border flex items-center justify-center hover:bg-muted transition-colors"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(idx, 1)}
                        className="w-6 h-6 rounded-md bg-border flex items-center justify-center hover:bg-muted transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <p className="w-24 text-right text-sm font-bold text-foreground">{formatCurrency(lineAmount)}</p>
                    <button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart Totals */}
        <div className="border-t border-border px-5 py-4 space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>小計</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>稅額 (5%)</span>
            <span>{formatCurrency(taxAmount)}</span>
          </div>
          <div className="flex justify-between text-xl font-bold text-foreground border-t border-border pt-2 mt-2">
            <span>合計</span>
            <span className="text-primary">{formatCurrency(totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* Right: Numpad + Checkout (40%) */}
      <div className="flex-[2] flex flex-col gap-4 overflow-y-auto">
        {/* Session Info */}
        <div className="glass rounded-xl px-4 py-3">
          {session?.status === 'open' ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">目前班次</p>
                <p className="text-sm font-semibold text-foreground">{session.sessionNo}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">收銀員</p>
                <p className="text-sm font-medium text-foreground">{session.cashierName}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400">開班中</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle size={16} />
              <p className="text-sm font-medium">無開啟班次，請先開班</p>
              <Button size="sm" variant="outline" onClick={() => router.push('/pos')}>去開班</Button>
            </div>
          )}
        </div>

        {/* Item Search */}
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="搜尋商品代碼或名稱..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
            />
          </div>

          {/* Search results dropdown */}
          {showSearch && searchTerm.length >= 1 && (
            <div className="bg-background border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
              {searchLoading ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">搜尋中...</p>
              ) : (searchResults?.data?.length ?? 0) === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">無符合商品</p>
              ) : (
                searchResults?.data?.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addToCart({ id: item.id, code: item.code, name: item.name, unitCost: item.unitCost })}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors border-b border-border/40 last:border-0"
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground">{formatCurrency(Number(item.unitCost))}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Quick item grid */}
          {!showSearch && (
            <div className="grid grid-cols-2 gap-2">
              {quickItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addToCart({ id: item.id, code: item.code, name: item.name, unitCost: item.unitCost })}
                  className="bg-background/50 hover:bg-muted border border-border rounded-lg px-3 py-2.5 text-left transition-colors"
                >
                  <p className="text-xs text-muted-foreground truncate">{item.code}</p>
                  <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                  <p className="text-xs text-primary font-semibold mt-0.5">{formatCurrency(Number(item.unitCost))}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Payment */}
        <div className="glass rounded-xl p-4 space-y-4">
          {/* Payment Method */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">付款方式</p>
            <div className="flex gap-2">
              {PAYMENT_METHODS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setPaymentMethod(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    paymentMethod === key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-muted-foreground'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Paid Amount */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">收款金額</p>
            <Input
              type="number"
              min={0}
              step={1}
              placeholder={`最少 ${Math.ceil(totalAmount)}`}
              value={paidInput}
              onChange={(e) => setPaidInput(e.target.value)}
              className="text-lg font-mono"
            />
            <div className="flex gap-2 mt-2">
              {[Math.ceil(totalAmount), Math.ceil(totalAmount / 100) * 100 + 100, Math.ceil(totalAmount / 500) * 500 + 500].map((v) => (
                <button
                  key={v}
                  onClick={() => setPaidInput(String(v))}
                  className="flex-1 text-xs bg-background/50 border border-border rounded py-1 hover:bg-muted transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Change */}
          <div className="bg-background/40 rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">找零</p>
            <p className={`text-3xl font-bold font-mono ${changeAmount >= 0 ? 'text-emerald-400' : 'text-destructive'}`}>
              {paidInput ? formatCurrency(Math.max(0, changeAmount)) : '--'}
            </p>
          </div>

          {/* Checkout Button */}
          <Button
            size="lg"
            className="w-full text-base"
            disabled={!canCheckout || createOrderMutation.isPending}
            onClick={() => createOrderMutation.mutate()}
          >
            {createOrderMutation.isPending ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                處理中...
              </span>
            ) : (
              <>完成結帳</>
            )}
          </Button>

          {createOrderMutation.error && (
            <p className="text-sm text-destructive text-center">
              {(createOrderMutation.error as Error).message}
            </p>
          )}
        </div>
      </div>

      {/* Success Dialog */}
      {successOrderNo && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass rounded-2xl p-8 text-center max-w-sm w-full mx-4 border border-emerald-500/30">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-1">結帳成功！</h3>
            <p className="text-muted-foreground text-sm mb-1">訂單號碼</p>
            <p className="text-lg font-mono font-semibold text-primary mb-4">{successOrderNo}</p>
            <p className="text-emerald-400 font-bold text-2xl mb-6">找零 {formatCurrency(changeAmount >= 0 ? 0 : 0)}</p>
            <Button className="w-full" onClick={() => setSuccessOrderNo(null)}>
              繼續收銀
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
