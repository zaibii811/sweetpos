import { useState, useMemo } from "react";
import { 
  useListProducts, 
  useListCategories, 
  useCreateOrder,
  Product,
  Category
} from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Minus, Trash2, ShoppingBag, CreditCard, Wallet, Banknote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface CartItem extends Product {
  cartQuantity: number;
}

export default function POS() {
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "ewallet">("cash");
  const [amountPaid, setAmountPaid] = useState<string>("");

  const { data: products = [], isLoading: isLoadingProducts } = useListProducts({ 
    active: true,
  });
  const { data: categories = [] } = useListCategories();
  const createOrder = useCreateOrder();
  const { toast } = useToast();
  const { user } = useAuth();

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = activeCategory === null || p.categoryId === activeCategory;
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, activeCategory, searchQuery]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.cartQuantity >= product.stock) {
          toast({ title: "Out of stock", variant: "destructive" });
          return prev;
        }
        return prev.map(item => 
          item.id === product.id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item
        );
      }
      if (product.stock < 1) {
        toast({ title: "Out of stock", variant: "destructive" });
        return prev;
      }
      return [...prev, { ...product, cartQuantity: 1 }];
    });
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const newQ = item.cartQuantity + delta;
          if (newQ > item.stock) {
             toast({ title: "Exceeds stock limit", variant: "destructive" });
             return item;
          }
          return { ...item, cartQuantity: Math.max(0, newQ) };
        }
        return item;
      }).filter(item => item.cartQuantity > 0);
    });
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.cartQuantity), 0);
  const taxTotal = cart.reduce((sum, item) => sum + (item.taxable ? (item.price * item.cartQuantity * 0.08) : 0), 0);
  const total = subtotal + taxTotal;
  const change = paymentMethod === "cash" && amountPaid ? Math.max(0, Number(amountPaid) - total) : 0;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === "cash" && (Number(amountPaid) < total || !amountPaid)) {
      toast({ title: "Insufficient payment amount", variant: "destructive" });
      return;
    }

    try {
      await createOrder.mutateAsync({
        data: {
          items: cart.map(item => ({ productId: item.id, quantity: item.cartQuantity })),
          paymentMethod,
          amountPaid: paymentMethod === "cash" ? Number(amountPaid) : null,
          staffId: user?.id,
        }
      });
      
      toast({ title: "Checkout successful", description: "Order has been created." });
      setCart([]);
      setAmountPaid("");
    } catch (e: any) {
      toast({ title: "Checkout failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex h-full w-full bg-muted/30 flex-col md:flex-row">
      {/* Main POS Grid */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header / Categories */}
        <div className="bg-card border-b p-4 space-y-4 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input 
                className="pl-10 h-12 rounded-xl text-lg bg-muted/50 border-none focus-visible:ring-primary"
                placeholder="Search sweet treats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-products"
              />
            </div>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <Button
              variant={activeCategory === null ? "default" : "outline"}
              className="rounded-xl h-12 px-6 whitespace-nowrap font-semibold shadow-sm"
              onClick={() => setActiveCategory(null)}
              data-testid="category-all"
            >
              All Sweets
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={activeCategory === cat.id ? "default" : "outline"}
                className="rounded-xl h-12 px-6 whitespace-nowrap font-semibold shadow-sm bg-card"
                onClick={() => setActiveCategory(cat.id)}
                data-testid={`category-${cat.id}`}
              >
                {cat.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <ScrollArea className="flex-1 p-4 md:p-6">
          {isLoadingProducts ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Package className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-xl font-medium">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {filteredProducts.map((product) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.95 }}
                  className={`bg-card rounded-2xl border p-4 cursor-pointer shadow-sm hover:shadow-md transition-all ${product.stock < 1 ? "opacity-50 grayscale cursor-not-allowed" : ""}`}
                  onClick={() => addToCart(product)}
                  data-testid={`product-${product.id}`}
                >
                  <div className="aspect-square bg-muted rounded-xl mb-4 overflow-hidden relative">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/10">
                        <Store className="w-12 h-12 text-primary/40" />
                      </div>
                    )}
                    {product.taxable && (
                      <div className="absolute top-2 right-2 bg-black/70 text-white text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-md">
                        SST 8%
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold text-foreground leading-tight mb-1 line-clamp-2">{product.name}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-primary font-extrabold text-lg">RM {product.price.toFixed(2)}</span>
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                      {product.stock} left
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Cart Sidebar */}
      <div className="w-full md:w-96 bg-card border-l flex flex-col h-full shadow-2xl z-20">
        <div className="p-4 border-b bg-muted/20">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            Current Order
          </h2>
        </div>

        <ScrollArea className="flex-1 p-4">
          <AnimatePresence>
            {cart.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="flex flex-col items-center justify-center h-48 text-muted-foreground"
              >
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <ShoppingBag className="w-8 h-8 opacity-40" />
                </div>
                <p>Cart is empty</p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <motion.div 
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20, scale: 0.9 }}
                    className="flex items-start justify-between gap-3 bg-background border p-3 rounded-xl"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm truncate">{item.name}</h4>
                      <p className="text-muted-foreground text-xs font-medium">RM {item.price.toFixed(2)} {item.taxable && <span className="text-[10px] bg-muted px-1 rounded ml-1">SST</span>}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="font-bold text-sm">RM {(item.price * item.cartQuantity).toFixed(2)}</span>
                      <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="w-6 h-6 rounded-md hover:bg-background"
                          onClick={() => updateQuantity(item.id, -1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-6 text-center font-bold text-sm">{item.cartQuantity}</span>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="w-6 h-6 rounded-md hover:bg-background"
                          onClick={() => updateQuantity(item.id, 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </ScrollArea>

        {/* Checkout Footer */}
        <div className="bg-card border-t p-4 space-y-4 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
          <div className="space-y-2 text-sm font-medium">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>RM {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>SST (8%)</span>
              <span>RM {taxTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-2xl font-black pt-2 border-t text-foreground">
              <span>Total</span>
              <span className="text-primary">RM {total.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button 
              variant={paymentMethod === "cash" ? "default" : "outline"} 
              className={`h-12 rounded-xl ${paymentMethod === "cash" ? "shadow-md" : ""}`}
              onClick={() => setPaymentMethod("cash")}
            >
              <Banknote className="w-4 h-4 mr-2 hidden sm:block" /> Cash
            </Button>
            <Button 
              variant={paymentMethod === "card" ? "default" : "outline"} 
              className={`h-12 rounded-xl ${paymentMethod === "card" ? "shadow-md" : ""}`}
              onClick={() => setPaymentMethod("card")}
            >
              <CreditCard className="w-4 h-4 mr-2 hidden sm:block" /> Card
            </Button>
            <Button 
              variant={paymentMethod === "ewallet" ? "default" : "outline"} 
              className={`h-12 rounded-xl ${paymentMethod === "ewallet" ? "shadow-md" : ""}`}
              onClick={() => setPaymentMethod("ewallet")}
            >
              <Wallet className="w-4 h-4 mr-2 hidden sm:block" /> E-Wallet
            </Button>
          </div>

          {paymentMethod === "cash" && (
            <div className="bg-muted/50 p-3 rounded-xl space-y-2 border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Amount Paid</span>
                <Input 
                  type="number" 
                  value={amountPaid} 
                  onChange={(e) => setAmountPaid(e.target.value)} 
                  className="w-32 text-right h-10 font-bold bg-background"
                  placeholder="0.00"
                />
              </div>
              {amountPaid && Number(amountPaid) >= total && (
                <div className="flex items-center justify-between pt-1 text-green-600 dark:text-green-400 font-bold">
                  <span>Change</span>
                  <span>RM {change.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          <Button 
            className="w-full h-16 text-xl font-bold rounded-xl shadow-lg hover:shadow-xl transition-shadow"
            disabled={cart.length === 0 || createOrder.isPending}
            onClick={handleCheckout}
            data-testid="button-checkout"
          >
            {createOrder.isPending ? "Processing..." : "Charge RM " + total.toFixed(2)}
          </Button>
        </div>
      </div>
    </div>
  );
}