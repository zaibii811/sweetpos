import { useState } from "react";
import { 
  useListProducts, 
  useListCategories, 
  useCreateProduct,
  useUpdateProduct,
  Product,
  Category
} from "@workspace/api-client-react";
import { getListProductsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Package, Plus, Search, Edit2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const { data: products = [], isLoading } = useListProducts();
  const { data: categories = [] } = useListCategories();
  
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm({
    defaultValues: {
      name: "",
      price: 0,
      stock: 0,
      categoryId: undefined as number | undefined,
      taxable: true,
      active: true,
    }
  });

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const openNewProduct = () => {
    setEditingProduct(null);
    form.reset({ name: "", price: 0, stock: 0, categoryId: undefined, taxable: true, active: true });
    setIsProductModalOpen(true);
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    form.reset({
      name: product.name,
      price: product.price,
      stock: product.stock,
      categoryId: product.categoryId || undefined,
      taxable: product.taxable,
      active: product.active,
    });
    setIsProductModalOpen(true);
  };

  const onSubmit = async (data: any) => {
    try {
      if (editingProduct) {
        await updateProduct.mutateAsync({ id: editingProduct.id, data });
        toast({ title: "Product updated" });
      } else {
        await createProduct.mutateAsync({ data });
        toast({ title: "Product created" });
      }
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      setIsProductModalOpen(false);
    } catch (e: any) {
      toast({ title: "Error saving product", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/20">
      <div className="p-6 border-b bg-card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
              <Package className="text-secondary w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold">Inventory</h1>
          </div>
          <Button onClick={openNewProduct} className="rounded-xl shadow-sm">
            <Plus className="w-4 h-4 mr-2" /> Add Product
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input 
            placeholder="Search products..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-background"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-center">SST</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">Loading inventory...</TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No products found.</TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => (
                  <TableRow key={product.id} className={!product.active ? "opacity-60 bg-muted/30" : ""}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      {product.categoryName ? (
                        <Badge variant="secondary" className="font-normal">{product.categoryName}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">RM {product.price.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <span className={`px-2 py-1 rounded-md text-sm font-bold ${product.stock < 10 ? 'bg-destructive/10 text-destructive' : 'bg-muted'}`}>
                        {product.stock}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {product.taxable ? <Badge variant="outline" className="border-primary text-primary">Yes</Badge> : <span className="text-muted-foreground text-sm">No</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={product.active ? "default" : "secondary"}>
                        {product.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEditProduct(product)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>

      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "New Product"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (RM)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value?.toString() || ""} onValueChange={(val) => field.onChange(parseInt(val, 10))}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-center gap-6 pt-2 border-t mt-4">
                <FormField
                  control={form.control}
                  name="taxable"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="cursor-pointer">Apply 8% SST</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="cursor-pointer">Active in POS</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter className="pt-6">
                <Button type="button" variant="outline" onClick={() => setIsProductModalOpen(false)}>Cancel</Button>
                <Button type="submit">{editingProduct ? "Save Changes" : "Create Product"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}