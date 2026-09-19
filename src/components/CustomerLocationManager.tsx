import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { MapPin, Phone, User, Building, Plus, Trash2, CheckCircle2 } from "lucide-react";

interface CustomerLocation {
  id: string;
  customer_id: string;
  location_name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contact_person: string;
  contact_phone: string;
  is_primary: boolean;
  created_at?: string;
}

interface CustomerLocationManagerProps {
  customerId: string;
  customerName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export default function CustomerLocationManager({ customerId, customerName, open, onOpenChange, onSaved }: CustomerLocationManagerProps) {
  const [locations, setLocations] = useState<CustomerLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingLocation, setEditingLocation] = useState<CustomerLocation | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    location_name: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    contact_person: "",
    contact_phone: "",
    is_primary: false,
  });

  const resolveTargetCustomerId = async (id: string): Promise<string> => {
    if (!id) return "";
    try {
      // Check if id exists directly in customers table
      const { data: byId } = await supabase.from("customers").select("id").eq("id", id).maybeSingle();
      if (byId?.id) return byId.id;

      // Check if id is user_id in customers table
      const { data: byUserId } = await supabase.from("customers").select("id").eq("user_id", id).maybeSingle();
      if (byUserId?.id) return byUserId.id;
    } catch (e) {
      console.warn("Could not resolve customer ID:", e);
    }
    return id;
  };

  const fetchLocations = async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const resolvedId = await resolveTargetCustomerId(customerId);
      const queryFilter = resolvedId !== customerId
        ? `customer_id.eq.${customerId},customer_id.eq.${resolvedId}`
        : `customer_id.eq.${customerId}`;

      const { data, error } = await supabase
        .from("customer_locations")
        .select("*")
        .or(queryFilter)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLocations(data || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load locations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchLocations();
      setShowForm(false);
      setEditingLocation(null);
      resetForm();
    }
  }, [open, customerId]);

  const resetForm = () => {
    setForm({
      location_name: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      contact_person: "",
      contact_phone: "",
      is_primary: false,
    });
    setEditingLocation(null);
  };

  const handleEdit = (location: CustomerLocation) => {
    setEditingLocation(location);
    setForm({
      location_name: location.location_name,
      address: location.address,
      city: location.city,
      state: location.state,
      pincode: location.pincode,
      contact_person: location.contact_person,
      contact_phone: location.contact_phone,
      is_primary: location.is_primary,
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.location_name.trim()) {
      toast.error("Location name is required");
      return;
    }

    setSaving(true);
    try {
      const targetId = await resolveTargetCustomerId(customerId);

      if (editingLocation) {
        const { error } = await supabase
          .from("customer_locations")
          .update({
            location_name: form.location_name.trim(),
            address: form.address.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
            pincode: form.pincode.trim(),
            contact_person: form.contact_person.trim(),
            contact_phone: form.contact_phone.trim(),
            is_primary: form.is_primary,
          })
          .eq("id", editingLocation.id);

        if (error) throw error;
        toast.success("Location updated");
      } else {
        const { error } = await supabase
          .from("customer_locations")
          .insert({
            customer_id: targetId,
            location_name: form.location_name.trim(),
            address: form.address.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
            pincode: form.pincode.trim(),
            contact_person: form.contact_person.trim(),
            contact_phone: form.contact_phone.trim(),
            is_primary: form.is_primary,
          });

        if (error) throw error;
        toast.success("Location added");
      }

      resetForm();
      setShowForm(false);
      fetchLocations();
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to save location");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this location?")) return;
    try {
      const { error } = await supabase.from("customer_locations").delete().eq("id", id);
      if (error) throw error;
      toast.success("Location deleted");
      fetchLocations();
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete location");
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      const { error } = await supabase
        .from("customer_locations")
        .update({ is_primary: true })
        .eq("id", id);

      if (error) throw error;
      fetchLocations();
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to set primary location");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            {customerName ? `Locations for ${customerName}` : "Customer Locations"}
          </DialogTitle>
          <DialogDescription>Manage service locations, offices, and contact details for this customer.</DialogDescription>
        </DialogHeader>

        {!showForm && (
          <div className="mb-4">
            <Button onClick={() => { resetForm(); setShowForm(true); }} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" /> Add Location
            </Button>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSave} className="space-y-4 border rounded-lg p-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Location Name *</label>
                <Input value={form.location_name} onChange={(e) => setForm({ ...form, location_name: e.target.value })} placeholder="Head Office" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">City</label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Hyderabad" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Address</label>
                <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} placeholder="Street, Area..." />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">State</label>
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="Telangana" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Pincode</label>
                <Input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} placeholder="500081" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Contact Person</label>
                <Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} placeholder="Ravi Kumar" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Contact Phone</label>
                <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="9876543210" />
              </div>
              <div className="sm:col-span-2 flex items-center gap-2">
                <input
                  id="is_primary"
                  type="checkbox"
                  checked={form.is_primary}
                  onChange={(e) => setForm({ ...form, is_primary: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="is_primary" className="text-sm font-medium text-slate-700">Set as primary location</label>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <><span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />Saving...</> : editingLocation ? "Update" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <span className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mr-2" />
            Loading locations...
          </div>
        ) : locations.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
            No locations found. Add a location to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {locations.map((loc) => (
              <div key={loc.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-semibold text-sm truncate">{loc.location_name}</span>
                    {loc.is_primary && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 uppercase tracking-wider shrink-0">
                        Primary
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    {[loc.address, loc.city, loc.state, loc.pincode].filter(Boolean).join(", ")}
                  </p>
                  {(loc.contact_person || loc.contact_phone) && (
                    <p className="text-xs text-muted-foreground ml-6 mt-0.5">
                      {loc.contact_person && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {loc.contact_person}</span>}
                      {loc.contact_phone && <span className="flex items-center gap-1 ml-3"><Phone className="w-3 h-3" /> {loc.contact_phone}</span>}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!loc.is_primary && (
                    <Button variant="ghost" size="sm" onClick={() => handleSetPrimary(loc.id)} title="Set as primary">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(loc)} title="Edit">
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(loc.id)} title="Delete" className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
