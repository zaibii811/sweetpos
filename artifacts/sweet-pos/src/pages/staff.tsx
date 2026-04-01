import { useState } from "react";
import { 
  useListStaff, 
  useCreateStaff, 
  useUpdateStaff, 
  useDeleteStaff,
  Staff,
  StaffRole
} from "@workspace/api-client-react";
import { getListStaffQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Users, Plus, Search, Edit2, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

export default function StaffPage() {
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);

  const { data: staffList = [], isLoading } = useListStaff();
  
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const deleteStaff = useDeleteStaff();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm({
    defaultValues: {
      name: "",
      pin: "",
      role: "cashier" as StaffRole,
      active: true,
    }
  });

  const filteredStaff = staffList.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const openNewStaff = () => {
    setEditingStaff(null);
    form.reset({ name: "", pin: "", role: "cashier", active: true });
    setIsModalOpen(true);
  };

  const openEditStaff = (staff: Staff) => {
    setEditingStaff(staff);
    form.reset({
      name: staff.name,
      pin: "", // Don't show PIN when editing for security
      role: staff.role,
      active: staff.active,
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: any) => {
    try {
      if (editingStaff) {
        // If PIN is empty during edit, don't send it
        const payload = { ...data };
        if (!payload.pin) delete payload.pin;
        
        await updateStaff.mutateAsync({ id: editingStaff.id, data: payload });
        toast({ title: "Staff updated" });
      } else {
        if (!data.pin) {
          toast({ title: "PIN is required", variant: "destructive" });
          return;
        }
        await createStaff.mutateAsync({ data });
        toast({ title: "Staff created" });
      }
      queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
      setIsModalOpen(false);
    } catch (e: any) {
      toast({ title: "Error saving staff", description: e.message, variant: "destructive" });
    }
  };

  const confirmDelete = async () => {
    if (!staffToDelete) return;
    try {
      await deleteStaff.mutateAsync({ id: staffToDelete.id });
      toast({ title: "Staff deleted" });
      queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
      setIsDeleteDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Error deleting staff", description: e.message, variant: "destructive" });
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin": return "bg-primary text-primary-foreground";
      case "manager": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "cashier": return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/20">
      <div className="p-6 border-b bg-card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Users className="text-emerald-500 w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold">Staff Management</h1>
          </div>
          <Button onClick={openNewStaff} className="rounded-xl shadow-sm">
            <Plus className="w-4 h-4 mr-2" /> Add Staff
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input 
            placeholder="Search staff..." 
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
                <TableHead>Role</TableHead>
                <TableHead>Date Added</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10">Loading staff...</TableCell>
                </TableRow>
              ) : filteredStaff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No staff found.</TableCell>
                </TableRow>
              ) : (
                filteredStaff.map((staff) => (
                  <TableRow key={staff.id} className={!staff.active ? "opacity-60 bg-muted/30" : ""}>
                    <TableCell className="font-bold">{staff.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${getRoleColor(staff.role)} capitalize border-transparent`}>
                        {staff.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(staff.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={staff.active ? "default" : "secondary"}>
                        {staff.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditStaff(staff)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => { setStaffToDelete(staff); setIsDeleteDialogOpen(true); }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingStaff ? "Edit Staff" : "Add New Staff"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cashier">Cashier</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{editingStaff ? "New PIN (Leave blank to keep current)" : "Login PIN (4-6 digits)"}</FormLabel>
                    <FormControl>
                      <Input type="password" maxLength={6} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="pt-2 border-t mt-4">
                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="cursor-pointer">Account Active</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter className="pt-6">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit">{editingStaff ? "Save Changes" : "Create Staff"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Staff</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {staffToDelete?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}