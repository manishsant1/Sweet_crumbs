import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { MAX_QTY_PER_LINE } from '../../shared/config';
import { load, save } from '../api/storage';

const CartContext = createContext(null);

// Cart lines are stored as { product, qty } so the cart renders without a lookup. The product is a
// snapshot: stock and price may be stale, and the server is the authority when the order is placed.
export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => load('cart', []));
  useEffect(() => save('cart', cart), [cart]);

  const value = useMemo(() => {
    const limit = (product) => Math.min(product.stock, MAX_QTY_PER_LINE);

    const addToCart = (product, qty = 1) =>
      setCart((lines) => {
        const existing = lines.find((l) => l.product.id === product.id);
        if (existing) {
          return lines.map((l) =>
            l.product.id === product.id ? { product, qty: Math.min(l.qty + qty, limit(product)) } : l);
        }
        return [...lines, { product, qty: Math.min(qty, limit(product)) }];
      });

    const updateQty = (id, qty) =>
      setCart((lines) =>
        qty <= 0
          ? lines.filter((l) => l.product.id !== id)
          : lines.map((l) => (l.product.id === id ? { ...l, qty: Math.min(qty, limit(l.product)) } : l)));

    const removeFromCart = (id) => setCart((lines) => lines.filter((l) => l.product.id !== id));
    const clearCart = () => setCart([]);

    return {
      cart,
      cartCount: cart.reduce((n, l) => n + l.qty, 0),
      subtotal: cart.reduce((sum, l) => sum + l.qty * l.product.price, 0),
      maxQty: limit,
      addToCart, updateQty, removeFromCart, clearCart,
    };
  }, [cart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
