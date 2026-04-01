import { useState, useRef, useEffect } from "react";
import { useListStaff, useCreateStaff, useUpdateStaff, useDeleteStaff, Staff, StaffRole, getListStaffQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { format, startOfWeek, addWeeks, subWeeks, addDays } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { Users, Plus, Search, Edit2, Trash2, ChevronLeft, ChevronRight, Camera, Download, Copy, Printer } from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Tab = "profiles" | "scheduling" | "reports";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMondayOfWeek(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

function weekStartStr(date: Date): string {
  return format(getMondayOfWeek(date), "yyyy-MM-dd");
}

function getRoleColor(role: string, text = false) {
  switch (role) {
    case "owner": case "admin": return text ? "text-amber-700 dark:text-amber-400" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "manager": return text ? "text-green-700 dark:text-green-400" : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "cashier": return text ? "text-blue-700 dark:text-blue-400" : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    default: return text ? "" : "bg-muted text-muted-foreground";
  }
}

function getShiftCellColor(role: string | null | undefined) {
  if (!role) return "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800";
  return role === "manager" || role === "owner" || role === "admin"
    ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
    : "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800";
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, { credentials: "include", ...opts });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "Request failed"); }
  return r.json();
}

export default function StaffPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profiles");
  const { toast } = useToast();
  const { isManagerOrAbove, isOwner } = usePermissions();

  return (
    <div className="flex flex-col h-full bg-muted/20">
      {/* Header */}
      <div className="p-6 border-b bg-card flex-shrink-0">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Users className="text-emerald-500 w-5 h-5" />
          </div>
          <h1 className="text-2xl font-bold">Staff Management</h1>
        </div>
        <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
          {(["profiles", "scheduling", "reports"] as Tab[]).map(tab => (
            <button key={tab} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${activeTab === tab ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setActiveTab(tab)} data-testid={`tab-${tab}`}>{tab === "reports" ? "Time Reports" : tab}</button>
          ))}
        </div>
      </div>

      {activeTab === "profiles" && <ProfilesTab />}
      {activeTab === "scheduling" && <SchedulingTab />}
      {activeTab === "reports" && <ReportsTab />}
    </div>
  );
}

function ProfilesTab() {
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const { data: staffList = [], isLoading } = useListStaff();
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const deleteStaff = useDeleteStaff();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isOwner, isManagerOrAbove } = usePermissions();

  const form = useForm({ defaultValues: { name: "", pin: "", role: "cashier" as StaffRole, active: true, phone: "", hourlyRate: "", username: "", password: "" } });

  const filteredStaff = staffList.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  const openNew = () => {
    setEditingStaff(null);
    setPhotoPreview(null);
    form.reset({ name: "", pin: "", role: "cashier", active: true, phone: "", hourlyRate: "", username: "", password: "" });
    setIsModalOpen(true);
  };

  const openEdit = (staff: any) => {
    setEditingStaff(staff);
    setPhotoPreview((staff as any).photoUrl || null);
    form.reset({ name: staff.name, pin: "", role: staff.role, active: staff.active, phone: (staff as any).phone || "", hourlyRate: (staff as any).hourlyRate || "", username: (staff as any).username || "", password: "" });
    setIsModalOpen(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: any) => {
    try {
      const payload: any = { name: data.name, role: data.role, active: data.active };
      if (data.pin) payload.pin = data.pin;
      if (data.phone) payload.phone = data.phone;
      if (data.hourlyRate) payload.hourlyRate = data.hourlyRate;
      if (data.username) payload.username = data.username;
      if (data.password) payload.password = data.password;
      if (photoPreview && photoPreview.startsWith("data:")) payload.photoUrl = photoPreview;
      if (!photoPreview && editingStaff) payload.photoUrl = null;

      if (editingStaff) {
        await apiFetch(`/api/staff/${editingStaff.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast({ title: "Staff updated" });
      } else {
        if (!data.pin) { toast({ title: "PIN is required", variant: "destructive" }); return; }
        await apiFetch("/api/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast({ title: "Staff created" });
      }
      queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
      setIsModalOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
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
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input placeholder="Search staff..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-background" />
          </div>
          {isManagerOrAbove() && <Button onClick={openNew} className="rounded-xl" data-testid="button-add-staff"><Plus className="w-4 h-4 mr-2" /> Add Staff</Button>}
        </div>

        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Hourly Rate</TableHead>
                <TableHead className="text-center">Status</TableHead>
                {isManagerOrAbove() && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10">Loading...</TableCell></TableRow>
              ) : filteredStaff.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No staff found.</TableCell></TableRow>
              ) : filteredStaff.map(staff => (
                <TableRow key={staff.id} className={!staff.active ? "opacity-60" : ""}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                        {(staff as any).photoUrl ? (
                          <img src={(staff as any).photoUrl} alt={staff.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-muted-foreground">{staff.name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">{staff.name}</p>
                        {(staff as any).username && <p className="text-xs text-muted-foreground">@{(staff as any).username}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className={`${getRoleColor(staff.role)} capitalize border-transparent`}>{staff.role}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{(staff as any).phone || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{(staff as any).hourlyRate ? `RM ${parseFloat((staff as any).hourlyRate).toFixed(2)}/hr` : "—"}</TableCell>
                  <TableCell className="text-center"><Badge variant={staff.active ? "default" : "secondary"}>{staff.active ? "Active" : "Inactive"}</Badge></TableCell>
                  {isManagerOrAbove() && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(staff)} data-testid={`button-edit-staff-${staff.id}`}><Edit2 className="w-4 h-4" /></Button>
                        {isOwner() && <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => { setStaffToDelete(staff); setIsDeleteDialogOpen(true); }} data-testid={`button-delete-staff-${staff.id}`}><Trash2 className="w-4 h-4" /></Button>}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingStaff ? "Edit Staff" : "Add New Staff"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
              {/* Photo */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  {photoPreview ? <img src={photoPreview} className="w-full h-full object-cover" alt="Photo" /> : <Camera className="w-8 h-8 text-muted-foreground" />}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                <div>
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} data-testid="button-upload-photo">
                    <Camera className="w-4 h-4 mr-2" /> {photoPreview ? "Change Photo" : "Upload Photo"}
                  </Button>
                  {photoPreview && <Button type="button" variant="ghost" size="sm" className="mt-1 text-xs" onClick={() => setPhotoPreview(null)}>Remove</Button>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Full Name</FormLabel><FormControl><Input {...field} data-testid="input-staff-name" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem><FormLabel>Role</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger data-testid="select-staff-role"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="cashier">Cashier</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        {isOwner() && <SelectItem value="owner">Owner</SelectItem>}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="pin" render={({ field }) => (
                  <FormItem><FormLabel>{editingStaff ? "New PIN (optional)" : "PIN (4 digits)*"}</FormLabel><FormControl><Input type="password" maxLength={6} {...field} data-testid="input-staff-pin" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="+60 12-345 6789" {...field} data-testid="input-staff-phone" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="hourlyRate" render={({ field }) => (
                  <FormItem><FormLabel>Hourly Rate (RM)</FormLabel><FormControl><Input type="number" step="0.50" min="0" placeholder="0.00" {...field} data-testid="input-staff-hourly-rate" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="username" render={({ field }) => (
                  <FormItem><FormLabel>Username (optional)</FormLabel><FormControl><Input placeholder="For password login" {...field} data-testid="input-staff-username" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>Password (optional)</FormLabel><FormControl><Input type="password" placeholder="Set login password" {...field} data-testid="input-staff-password" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="pt-2 border-t">
                <FormField control={form.control} name="active" render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-staff-active" /></FormControl>
                    <FormLabel className="cursor-pointer">Account Active</FormLabel>
                  </FormItem>
                )} />
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" data-testid="button-save-staff">{editingStaff ? "Save Changes" : "Create Staff"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle className="text-destructive">Delete Staff</DialogTitle>
            <DialogDescription>Delete {staffToDelete?.name}? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}

function SchedulingTab() {
  const [weekBase, setWeekBase] = useState<Date>(() => getMondayOfWeek(new Date()));
  const [shiftModal, setShiftModal] = useState<{ staffId: number; staffName: string; dayOfWeek: number; existing: any | null } | null>(null);
  const [shiftForm, setShiftForm] = useState({ startTime: "09:00", endTime: "17:00", shiftRole: "" });
  const [isCopying, setIsCopying] = useState(false);
  const { toast } = useToast();
  const { data: staffList = [] } = useListStaff();
  const activeStaff = (staffList as any[]).filter(s => s.active);

  const weekStart = format(weekBase, "yyyy-MM-dd");
  const { data: shifts = [], refetch } = useQuery<any[]>({
    queryKey: ["shifts", weekStart],
    queryFn: () => apiFetch(`/api/shifts?weekStart=${weekStart}`),
    enabled: true,
  });

  const shiftMap = new Map<string, any>();
  for (const s of shifts) {
    shiftMap.set(`${s.staffId}-${s.dayOfWeek}`, s);
  }

  const openShiftModal = (staffId: number, staffName: string, dayOfWeek: number) => {
    const existing = shiftMap.get(`${staffId}-${dayOfWeek}`) || null;
    setShiftForm({ startTime: existing?.startTime || "09:00", endTime: existing?.endTime || "17:00", shiftRole: existing?.shiftRole || "" });
    setShiftModal({ staffId, staffName, dayOfWeek, existing });
  };

  const saveShift = async () => {
    if (!shiftModal) return;
    try {
      await apiFetch("/api/shifts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: shiftModal.staffId, weekStart, dayOfWeek: shiftModal.dayOfWeek, startTime: shiftForm.startTime, endTime: shiftForm.endTime, shiftRole: shiftForm.shiftRole || null }),
      });
      await refetch();
      toast({ title: "Shift saved" });
      setShiftModal(null);
    } catch (e: any) {
      toast({ title: "Error saving shift", description: e.message, variant: "destructive" });
    }
  };

  const deleteShift = async () => {
    if (!shiftModal?.existing) return;
    try {
      await apiFetch(`/api/shifts/${shiftModal.existing.id}`, { method: "DELETE" });
      await refetch();
      toast({ title: "Shift removed" });
      setShiftModal(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const copyLastWeek = async () => {
    const prevWeek = format(subWeeks(weekBase, 1), "yyyy-MM-dd");
    setIsCopying(true);
    try {
      const r = await apiFetch("/api/shifts/copy-week", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fromWeek: prevWeek, toWeek: weekStart }) });
      await refetch();
      toast({ title: `Copied ${r.copied} shifts from last week` });
    } catch (e: any) {
      toast({ title: "Error copying", description: e.message, variant: "destructive" });
    } finally {
      setIsCopying(false);
    }
  };

  const printSchedule = () => window.print();

  const weekLabel = `${format(weekBase, "d MMM")} – ${format(addDays(weekBase, 6), "d MMM yyyy")}`;

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b bg-card flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekBase(subWeeks(weekBase, 1))} data-testid="button-prev-week"><ChevronLeft className="w-4 h-4" /></Button>
          <span className="font-semibold min-w-[180px] text-center text-sm" data-testid="week-label">{weekLabel}</span>
          <Button variant="outline" size="icon" onClick={() => setWeekBase(addWeeks(weekBase, 1))} data-testid="button-next-week"><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setWeekBase(getMondayOfWeek(new Date()))}>Today</Button>
        </div>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={copyLastWeek} disabled={isCopying} data-testid="button-copy-last-week">
            <Copy className="w-4 h-4 mr-2" /> {isCopying ? "Copying..." : "Copy Last Week"}
          </Button>
          <Button variant="outline" size="sm" onClick={printSchedule} data-testid="button-print-schedule">
            <Printer className="w-4 h-4 mr-2" /> Print / PDF
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-2 flex gap-4 text-xs border-b bg-card">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-200 dark:bg-green-800 inline-block" /> Manager/Owner</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-200 dark:bg-blue-800 inline-block" /> Cashier</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-muted inline-block" /> No shift</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6">
          <div id="schedule-grid" className="bg-card border rounded-xl overflow-hidden shadow-sm min-w-[700px]">
            {/* Header row */}
            <div className="grid border-b" style={{ gridTemplateColumns: "180px repeat(7, 1fr)" }}>
              <div className="px-4 py-3 bg-muted/50 font-semibold text-sm border-r">Staff</div>
              {DAYS.map((day, i) => {
                const dayDate = addDays(weekBase, i);
                const isToday = format(dayDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
                return (
                  <div key={day} className={`px-2 py-3 text-center text-sm font-semibold border-r last:border-r-0 ${isToday ? "bg-primary/5 text-primary" : "bg-muted/50"}`}>
                    <div>{day}</div>
                    <div className="text-xs font-normal text-muted-foreground">{format(dayDate, "d MMM")}</div>
                  </div>
                );
              })}
            </div>

            {/* Staff rows */}
            {activeStaff.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No active staff</div>
            ) : activeStaff.map((staff: any) => (
              <div key={staff.id} className="grid border-b last:border-b-0" style={{ gridTemplateColumns: "180px repeat(7, 1fr)" }}>
                <div className="px-4 py-3 border-r flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {staff.photoUrl ? <img src={staff.photoUrl} className="w-full h-full object-cover" alt="" /> : <span className="text-xs font-bold text-muted-foreground">{staff.name.charAt(0)}</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{staff.name}</p>
                    <p className={`text-xs capitalize ${getRoleColor(staff.role, true)}`}>{staff.role}</p>
                  </div>
                </div>
                {DAYS.map((_, dayIdx) => {
                  const shift = shiftMap.get(`${staff.id}-${dayIdx}`);
                  return (
                    <div
                      key={dayIdx}
                      className="border-r last:border-r-0 p-1 min-h-[60px] cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => openShiftModal(staff.id, staff.name, dayIdx)}
                      data-testid={`cell-shift-${staff.id}-${dayIdx}`}
                    >
                      {shift ? (
                        <div className={`rounded-lg border px-2 py-1.5 text-xs h-full flex flex-col justify-center ${getShiftCellColor(shift.shiftRole || staff.role)}`}>
                          <p className="font-semibold">{shift.startTime}–{shift.endTime}</p>
                          {shift.shiftRole && <p className="text-muted-foreground capitalize">{shift.shiftRole}</p>}
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                          <Plus className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Shift modal */}
      <Dialog open={!!shiftModal} onOpenChange={() => setShiftModal(null)}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>{shiftModal?.existing ? "Edit Shift" : "Assign Shift"}</DialogTitle>
            <DialogDescription>{shiftModal?.staffName} — {shiftModal ? DAYS[shiftModal.dayOfWeek] : ""}, {weekLabel}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={shiftForm.startTime} onChange={e => setShiftForm(f => ({ ...f, startTime: e.target.value }))} data-testid="input-shift-start" />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={shiftForm.endTime} onChange={e => setShiftForm(f => ({ ...f, endTime: e.target.value }))} data-testid="input-shift-end" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Role for this shift (optional)</Label>
              <Select value={shiftForm.shiftRole} onValueChange={v => setShiftForm(f => ({ ...f, shiftRole: v === "default" ? "" : v }))}>
                <SelectTrigger data-testid="select-shift-role"><SelectValue placeholder="Same as staff role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Same as staff role</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            {shiftModal?.existing && <Button variant="outline" className="text-destructive hover:text-destructive mr-auto" onClick={deleteShift} data-testid="button-delete-shift">Remove</Button>}
            <Button variant="outline" onClick={() => setShiftModal(null)}>Cancel</Button>
            <Button onClick={saveShift} data-testid="button-save-shift">Save Shift</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type ReportPeriod = "this-week" | "last-week" | "this-month" | "last-month";

function getDateRange(period: ReportPeriod): { from: string; to: string; label: string } {
  const now = new Date();
  const thisMonday = getMondayOfWeek(now);
  switch (period) {
    case "this-week": {
      const from = format(thisMonday, "yyyy-MM-dd");
      const to = format(addDays(thisMonday, 6), "yyyy-MM-dd");
      return { from, to, label: "This Week" };
    }
    case "last-week": {
      const lastMon = subWeeks(thisMonday, 1);
      return { from: format(lastMon, "yyyy-MM-dd"), to: format(addDays(lastMon, 6), "yyyy-MM-dd"), label: "Last Week" };
    }
    case "this-month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: format(start, "yyyy-MM-dd"), to: format(end, "yyyy-MM-dd"), label: "This Month" };
    }
    case "last-month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: format(start, "yyyy-MM-dd"), to: format(end, "yyyy-MM-dd"), label: "Last Month" };
    }
  }
}

function ReportsTab() {
  const [period, setPeriod] = useState<ReportPeriod>("this-week");
  const [editEntry, setEditEntry] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ clockInAt: "", clockOutAt: "", notes: "" });
  const { toast } = useToast();
  const { isManagerOrAbove } = usePermissions();
  const { data: staffList = [] } = useListStaff();
  const activeStaff = (staffList as any[]).filter(s => s.active);
  const range = getDateRange(period);

  const { data: payroll, isLoading, refetch } = useQuery<any>({
    queryKey: ["payroll", range.from, range.to],
    queryFn: () => apiFetch(`/api/payroll/summary?from=${range.from}&to=${range.to}`),
    enabled: true,
  });

  const { data: rawEntries = [], refetch: refetchEntries } = useQuery<any[]>({
    queryKey: ["time-entries", range.from, range.to],
    queryFn: () => apiFetch(`/api/time-entries?from=${range.from}&to=${range.to}`),
  });

  const exportCSV = () => {
    if (!payroll?.summary) return;
    const rows = [
      ["Staff", "Role", "Hourly Rate (RM)", "Hours Worked", "Late Arrivals", "Overtime Days", "Est. Pay (RM)"],
      ...payroll.summary.map((r: any) => [r.staffName, r.role, r.hourlyRate, r.totalHours.toFixed(2), r.lateCount, r.overtimeDays, r.estimatedPay.toFixed(2)])
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${range.from}-${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported" });
  };

  const openEdit = (entry: any) => {
    setEditEntry(entry);
    setEditForm({
      clockInAt: new Date(entry.clockInAt).toISOString().slice(0, 16),
      clockOutAt: entry.clockOutAt ? new Date(entry.clockOutAt).toISOString().slice(0, 16) : "",
      notes: entry.notes || "",
    });
  };

  const saveEdit = async () => {
    if (!editEntry) return;
    try {
      const payload: any = { notes: editForm.notes };
      if (editForm.clockInAt) payload.clockInAt = new Date(editForm.clockInAt).toISOString();
      if (editForm.clockOutAt) payload.clockOutAt = new Date(editForm.clockOutAt).toISOString();
      else payload.clockOutAt = null;
      await apiFetch(`/api/time-entries/${editEntry.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      await refetchEntries();
      await refetch();
      toast({ title: "Entry updated" });
      setEditEntry(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const deleteEntry = async (id: number) => {
    try {
      await apiFetch(`/api/time-entries/${id}`, { method: "DELETE" });
      await refetchEntries();
      await refetch();
      toast({ title: "Entry deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
    { value: "this-week", label: "This Week" },
    { value: "last-week", label: "Last Week" },
    { value: "this-month", label: "This Month" },
    { value: "last-month", label: "Last Month" },
  ];

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 bg-muted p-1 rounded-xl">
            {PERIOD_OPTIONS.map(opt => (
              <button key={opt.value} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${period === opt.value ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setPeriod(opt.value)}>{opt.label}</button>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV} data-testid="button-export-csv">
              <Download className="w-4 h-4 mr-2" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-export-pdf">
              <Printer className="w-4 h-4 mr-2" /> PDF
            </Button>
          </div>
        </div>

        {/* Payroll summary table */}
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b bg-muted/50">
            <h2 className="font-semibold">Payroll Summary — {range.label}</h2>
            <p className="text-xs text-muted-foreground">{range.from} to {range.to}</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-center">Late</TableHead>
                <TableHead className="text-center">Overtime Days</TableHead>
                <TableHead className="text-right">Rate (RM/hr)</TableHead>
                <TableHead className="text-right">Est. Pay (RM)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : payroll?.summary?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No data for this period</TableCell></TableRow>
              ) : payroll?.summary?.map((row: any) => (
                <TableRow key={row.staffId}>
                  <TableCell>
                    <p className="font-medium">{row.staffName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{row.role}</p>
                  </TableCell>
                  <TableCell className="text-right font-mono">{row.totalHours.toFixed(2)}</TableCell>
                  <TableCell className="text-center">
                    {row.lateCount > 0 ? <Badge className="bg-destructive/10 text-destructive border-transparent">{row.lateCount}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.overtimeDays > 0 ? <Badge className="bg-amber-100 text-amber-800 border-transparent dark:bg-amber-900/30 dark:text-amber-400">{row.overtimeDays}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">{parseFloat(row.hourlyRate || "0").toFixed(2)}</TableCell>
                  <TableCell className="text-right font-bold text-primary">
                    {row.estimatedPay > 0 ? `RM ${row.estimatedPay.toFixed(2)}` : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {payroll?.summary && payroll.summary.length > 0 && (
                <TableRow className="bg-muted/30 font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{payroll.summary.reduce((s: number, r: any) => s + r.totalHours, 0).toFixed(2)}</TableCell>
                  <TableCell className="text-center">{payroll.summary.reduce((s: number, r: any) => s + r.lateCount, 0)}</TableCell>
                  <TableCell className="text-center">{payroll.summary.reduce((s: number, r: any) => s + r.overtimeDays, 0)}</TableCell>
                  <TableCell />
                  <TableCell className="text-right text-primary">RM {payroll.summary.reduce((s: number, r: any) => s + r.estimatedPay, 0).toFixed(2)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Time entries detail */}
        {isManagerOrAbove() && (
          <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b bg-muted/50">
              <h2 className="font-semibold">Clock Entries Log</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  {isManagerOrAbove() && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rawEntries.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No clock entries for this period</TableCell></TableRow>
                ) : rawEntries.map((entry: any) => (
                  <TableRow key={entry.id} className={entry.isManualEdit ? "bg-amber-50/50 dark:bg-amber-900/5" : ""}>
                    <TableCell className="font-medium">{entry.staffName}</TableCell>
                    <TableCell className="text-sm">{new Date(entry.clockInAt).toLocaleString("en-MY", { dateStyle: "short", timeStyle: "short" })}</TableCell>
                    <TableCell className="text-sm">{entry.clockOutAt ? new Date(entry.clockOutAt).toLocaleString("en-MY", { dateStyle: "short", timeStyle: "short" }) : <span className="text-amber-600 font-medium">Active</span>}</TableCell>
                    <TableCell className="text-right font-mono">{entry.hoursWorked ? parseFloat(entry.hoursWorked).toFixed(2) : "—"}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex gap-1 justify-center flex-wrap">
                        {entry.isLate && <Badge className="bg-destructive/10 text-destructive border-transparent text-xs">Late {entry.lateMinutes}m</Badge>}
                        {entry.isManualEdit && <Badge className="bg-amber-100 text-amber-800 border-transparent text-xs dark:bg-amber-900/30 dark:text-amber-400">Edited</Badge>}
                        {parseFloat(entry.hoursWorked || "0") > 8 && <Badge className="bg-purple-100 text-purple-800 border-transparent text-xs dark:bg-purple-900/30 dark:text-purple-400">OT</Badge>}
                      </div>
                    </TableCell>
                    {isManagerOrAbove() && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(entry)} data-testid={`button-edit-entry-${entry.id}`}><Edit2 className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteEntry(entry.id)} data-testid={`button-delete-entry-${entry.id}`}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Edit entry modal */}
      <Dialog open={!!editEntry} onOpenChange={() => setEditEntry(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
            <DialogDescription>{editEntry?.staffName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Clock In</Label>
              <Input type="datetime-local" value={editForm.clockInAt} onChange={e => setEditForm(f => ({ ...f, clockInAt: e.target.value }))} data-testid="input-edit-clock-in" />
            </div>
            <div className="space-y-2">
              <Label>Clock Out</Label>
              <Input type="datetime-local" value={editForm.clockOutAt} onChange={e => setEditForm(f => ({ ...f, clockOutAt: e.target.value }))} data-testid="input-edit-clock-out" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Reason for edit..." data-testid="input-edit-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)}>Cancel</Button>
            <Button onClick={saveEdit} data-testid="button-save-entry">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}
