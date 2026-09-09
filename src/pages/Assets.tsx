import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import AssetImportModal from "@/components/AssetImportModal";
import {
  Loader2,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  X,
  Upload,
  Package,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  User,
  Building,
  Wrench,
  ShieldCheck,
  Download,
  ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { downloadCSV, generateSampleCSV } from "@/utils/csvHelpers";
import ExportButton from "@/components/ExportButton";

export default function Assets() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [warrantyFilter, setWarrantyFilter] = useState("all"); // all, active, expired
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Modal / Side-panel states
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "add" | "edit">("view");

  // Search states inside form for dropdowns
  const [customerSearch, setCustomerSearch] = useState("");
  const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);
  const [branchSearch, setBranchSearch] = useState("");
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);

  // Form States
  const [customerId, setCustomerId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [isAssetImportOpen, setIsAssetImportOpen] = useState(false);
  const [category, setCategory] = useState("Solar PV");
  const [productName, setProductName] = useState("");
  const [modelNumber, setModelNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [warrantyMonths, setWarrantyMonths] = useState(12);
  const [installationDate, setInstallationDate] = useState("");
  const [status, setStatus] = useState("Active");
  const [notes, setNotes] = useState("");

  // Role permissions
  const isAdmin = user?.role === "admin";
  const isSupervisor = user?.role === "supervisor";
  const canModify = isAdmin || isSupervisor;
  const isViewOnly = !canModify;

  const downloadSample = () => {
    const csv = generateSampleCSV("asset");
    downloadCSV(csv, "asset_sample.csv");
  };

  // React Query: Fetch Branches
  const { data: branches } = useQuery({
    queryKey: ['branches-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('branch_name', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  // React Query: Fetch Customers (Filtered for customer/technician role)
  const { data: customers } = useQuery({
    queryKey: ['customers-list-for-assets', user?.role, user?.id],
    queryFn: async () => {
      if (user?.role === 'technician') {
        // Fetch complaints assigned to this technician
        const { data: assignedComplaints, error: complaintsError } = await supabase
          .from('complaints')
          .select('customer_id')
          .eq('assigned_technician', user.id);

        if (complaintsError) throw complaintsError;

        if (!assignedComplaints || assignedComplaints.length === 0) {
          return [];
        }

        const customerProfileIds = [...new Set(assignedComplaints.map(c => c.customer_id).filter(Boolean))];
        if (customerProfileIds.length === 0) {
          return [];
        }

        const { data, error } = await supabase
          .from('customers')
          .select('id, full_name, user_id, phone, email')
          .in('user_id', customerProfileIds)
          .order('full_name', { ascending: true });

        if (error) throw error;
        return data || [];
      }

      let query = supabase.from('customers').select('id, full_name, user_id, phone, email');
      if (user?.role === 'customer') {
        query = query.eq('user_id', user.id);
      }
      const { data, error } = await query.order('full_name', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  // React Query: Fetch Assets
  const { data: assets, isLoading, refetch } = useQuery({
    queryKey: ['assets-list', user?.role, user?.id],
    queryFn: async () => {
      let query = supabase.from('customer_assets').select('*, customers(full_name, user_id), branches(branch_name)');

      // If customer role, only fetch their assets
      if (user?.role === 'customer') {
        const { data: customerRecord } = await supabase
          .from('customers')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (customerRecord) {
          query = query.eq('customer_id', customerRecord.id);
        } else {
          // If no customer record corresponds to this login, return empty
          return [];
        }
      } else if (user?.role === 'technician') {
        // Fetch complaints assigned to this technician
        const { data: assignedComplaints, error: complaintsError } = await supabase
          .from('complaints')
          .select('customer_id')
          .eq('assigned_technician', user.id);

        if (complaintsError) throw complaintsError;

        if (!assignedComplaints || assignedComplaints.length === 0) {
          return [];
        }

        const customerProfileIds = [...new Set(assignedComplaints.map(c => c.customer_id).filter(Boolean))];
        if (customerProfileIds.length === 0) {
          return [];
        }

        // Get customers.id corresponding to these customerProfileIds
        const { data: linkedCustomers, error: customersError } = await supabase
          .from('customers')
          .select('id')
          .in('user_id', customerProfileIds);

        if (customersError) throw customersError;

        if (!linkedCustomers || linkedCustomers.length === 0) {
          return [];
        }

        const customerIds = linkedCustomers.map(c => c.id);
        query = query.in('customer_id', customerIds);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // Helper: Warranty Expiry calculation
  const getWarrantyInfo = (purchaseDateStr: string, months: number) => {
    if (!purchaseDateStr) return { status: "Unknown", isExpired: true, expiryDateStr: "N/A" };

    const purchaseDate = new Date(purchaseDateStr);
    const expiryDate = new Date(purchaseDate);
    expiryDate.setMonth(expiryDate.getMonth() + Number(months || 0));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isExpired = expiryDate < today;
    return {
      status: isExpired ? "Expired" : "Active",
      isExpired,
      expiryDateStr: expiryDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    };
  };

  const handleOpenModal = (asset: any, mode: "view" | "add" | "edit") => {
    console.log("handleOpenModal called with mode:", mode, "asset:", asset);
    setModalMode(mode);
    setCustomerSearch("");
    setBranchSearch("");
    setIsCustomerPopoverOpen(false);
    setBranchDropdownOpen(false);

    if (mode === "add") {
      setSelectedAsset({});
      setCustomerId("");
      setBranchId("");
      setCategory("Solar PV");
      setProductName("");
      setModelNumber("");
      setSerialNumber("");
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setWarrantyMonths(12);
      setInstallationDate("");
      setStatus("Active");
      setNotes("");
    } else {
      setSelectedAsset(asset);
      setCustomerId(asset.customer_id || "");
      setBranchId(asset.branch_id || "");
      setCategory(asset.category || "Solar PV");
      setProductName(asset.product_name || "");
      setModelNumber(asset.model_number || "");
      setSerialNumber(asset.serial_number || "");
      setPurchaseDate(asset.purchase_date || "");
      setWarrantyMonths(asset.warranty_months || 12);
      setInstallationDate(asset.installation_date || "");
      setStatus(asset.status || "Active");
      setNotes(asset.notes || "");

      // Setup display search text for edit
      const currentCust = customers?.find(c => c.id === asset.customer_id);
      if (currentCust) setCustomerSearch(currentCust.full_name);

      const currentBranch = branches?.find(b => b.id === asset.branch_id);
      if (currentBranch) setBranchSearch(currentBranch.branch_name);
    }
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModify) {
      toast.error("You do not have permission to perform this action.");
      return;
    }

    if (!customerId) {
      toast.error("Please select a Customer.");
      return;
    }

    const trimmedProduct = productName.trim();
    if (!trimmedProduct) {
      toast.error("Product Name is required.");
      return;
    }

    if (!purchaseDate) {
      toast.error("Purchase Date is required.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        customer_id: customerId,
        branch_id: branchId || null,
        category,
        product_name: trimmedProduct,
        model_number: modelNumber.trim() || null,
        serial_number: serialNumber.trim() || null,
        purchase_date: purchaseDate,
        warranty_months: Number(warrantyMonths) || 0,
        installation_date: installationDate || null,
        status,
        notes: notes.trim() || null
      };

      if (modalMode === "add") {
        const { error } = await supabase.from('customer_assets').insert([payload]);
        if (error) throw error;
        toast.success(`Asset "${trimmedProduct}" added successfully!`);
      } else {
        const { error } = await supabase
          .from('customer_assets')
          .update(payload)
          .eq('id', selectedAsset.id);
        if (error) throw error;
        toast.success(`Asset "${trimmedProduct}" updated successfully!`);
      }

      setSelectedAsset(null);
      refetch();
    } catch (error: any) {
      toast.error(error.message || "An error occurred while saving.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!isAdmin) {
      toast.error("Only administrators can delete assets.");
      return;
    }

    if (!confirm(`Are you sure you want to delete asset "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase.from('customer_assets').delete().eq('id', id);
      if (error) throw error;
      toast.success("Asset record deleted successfully.");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete asset.");
    }
  };

  // Filters logic
  const filteredAssets = assets?.filter((a: any) => {
    const matchesSearch =
      (a.product_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.customers?.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.serial_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.branches?.branch_name || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === "all" || a.category === categoryFilter;

    // Warranty filter
    let matchesWarranty = true;
    if (warrantyFilter !== "all") {
      const wInfo = getWarrantyInfo(a.purchase_date, a.warranty_months);
      if (warrantyFilter === "active") {
        matchesWarranty = !wInfo.isExpired;
      } else if (warrantyFilter === "expired") {
        matchesWarranty = wInfo.isExpired;
      }
    }

    return matchesSearch && matchesCategory && matchesWarranty;
  }) || [];

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, warrantyFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / ITEMS_PER_PAGE));
  const paginatedAssets = filteredAssets.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const pageNumbers: Array<number | "ellipsis"> = totalPages <= 7
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : currentPage <= 4
      ? [1, 2, 3, 4, 5, "ellipsis", totalPages]
      : currentPage >= totalPages - 3
        ? [1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
        : [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages];

  // Filtered dropdown lists inside form
  const filteredFormBranches = branches?.filter(b =>
    b.branch_name.toLowerCase().includes(branchSearch.toLowerCase())
  ) || [];

  return (
    <div className="space-y-8 relative">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-6 relative z-10 pr-12 md:pr-16">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-800">Customer Assets</h1>
          <p className="text-muted-foreground font-light text-sm">
            {user?.role === "customer"
              ? "Track your bought equipments, purchase warranties, and deployment locations."
              : "Monitor client equipment profiles, warranty lifespans, and product deployments."}
          </p>
        </div>

        {canModify && (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 justify-end overflow-x-auto max-w-full">
            <ExportButton variant="asset" />
            <Button
              variant="outline"
              onClick={downloadSample}
              className="flex items-center gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Sample CSV</span>
              <span className="sm:hidden">Sample</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsAssetImportOpen(true)}
              className="flex items-center gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Import Assets</span>
              <span className="sm:hidden">Import</span>
            </Button>
            <Button
              onClick={() => handleOpenModal(null, 'add')}
              className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Add Asset</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        )}

        {isViewOnly && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-slate-500" /> View Only
          </div>
        )}
      </div>

      {/* Filter / Search section */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assets, customers, serial numbers..."
            className="pl-10 text-sm h-10 rounded-lg border-slate-200"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto shrink-0 justify-start lg:justify-end">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Category:</span>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px] h-10 rounded-lg border-slate-200 bg-white">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Solar PV">Solar PV</SelectItem>
                <SelectItem value="CCTV & Security">CCTV & Security</SelectItem>
                <SelectItem value="Networking">Networking</SelectItem>
                <SelectItem value="Power Systems">Power Systems</SelectItem>
                <SelectItem value="UPS & Battery">UPS & Battery</SelectItem>
                <SelectItem value="Others">Others</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Warranty:</span>
            <Select value={warrantyFilter} onValueChange={setWarrantyFilter}>
              <SelectTrigger className="w-[130px] h-10 rounded-lg border-slate-200 bg-white">
                <SelectValue placeholder="Warranty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="expired">Expired Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
          <span className="text-sm font-medium">Loading assets directory...</span>
        </div>
      ) : paginatedAssets.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm border-2 border-dashed rounded-xl bg-slate-50/50 border-slate-200/80">
          {user?.role === 'technician' && (!assets || assets.length === 0) ? (
            <>
              <Package className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="font-semibold text-slate-600">No asset data visible</p>
              <p className="text-xs text-slate-400 mt-1">You have no assigned complaints, so no customer data is visible.</p>
            </>
          ) : (
            <>
              <Package className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="font-semibold text-slate-600">No assets found</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search terms</p>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-[#f8fafc] text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 font-semibold text-xs uppercase tracking-wider">Customer Name</th>
                  <th className="py-3.5 px-4 font-semibold text-xs uppercase tracking-wider">Product details</th>
                  <th className="py-3.5 px-4 font-semibold text-xs uppercase tracking-wider">Category</th>
                  <th className="py-3.5 px-4 font-semibold text-xs uppercase tracking-wider">Purchase Date</th>
                  <th className="py-3.5 px-4 font-semibold text-xs uppercase tracking-wider">Warranty Status</th>
                  <th className="py-3.5 px-4 font-semibold text-xs uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedAssets.map((a: any) => {
                  const wInfo = getWarrantyInfo(a.purchase_date, a.warranty_months);
                  return (
                    <tr
                      key={a.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => handleOpenModal(a, "view")}
                    >
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {a.customers?.full_name || "Unknown Customer"}
                      </td>
                      <td className="py-3 px-4 asset-product-cell">
                        <div className="font-medium text-slate-700">{a.product_name}</div>
                        {(a.model_number || a.serial_number) && (
                          <div className="text-[11px] text-slate-400 mt-0.5 font-light">
                            {a.model_number && `Mod: ${a.model_number}`}
                            {a.model_number && a.serial_number && ' | '}
                            {a.serial_number && `S/N: ${a.serial_number}`}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-slate-600">
                        {a.category}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-medium">
                        {a.purchase_date ? new Date(a.purchase_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "N/A"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${wInfo.isExpired
                              ? 'bg-rose-50 border-rose-200 text-rose-600'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                            }`}>
                            {wInfo.isExpired ? (
                              <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                            )}
                            {wInfo.status}
                          </span>
                          <span className="text-[10px] text-slate-400 font-light">Expires: {wInfo.expiryDateStr}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenModal(a, "view")}
                            className="text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg h-8 w-8 p-0"
                            title="View asset details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canModify && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenModal(a, "edit")}
                              className="text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 rounded-lg h-8 w-8 p-0"
                              title="Edit asset details"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(a.id, a.product_name)}
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg h-8 w-8 p-0"
                              title="Delete asset"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {paginatedAssets.map((a: any) => {
              const wInfo = getWarrantyInfo(a.purchase_date, a.warranty_months);
              return (
                <div
                  key={a.id}
                  className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:border-slate-300 transition-all flex flex-col gap-3.5 cursor-pointer"
                  onClick={() => handleOpenModal(a, "view")}
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Client</h4>
                      <p className="font-semibold text-slate-800 text-sm">{a.customers?.full_name || "Unknown Customer"}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider shrink-0 ${wInfo.isExpired
                        ? 'bg-rose-50 border-rose-200 text-rose-600'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                      }`}>
                      {wInfo.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-800 text-base">{a.product_name}</h3>
                    <div className="flex flex-wrap gap-x-3 text-xs text-slate-400 mt-1 font-light">
                      <span>Category: <strong className="font-semibold text-slate-600">{a.category}</strong></span>
                      {a.serial_number && <span>S/N: <strong className="font-semibold text-slate-600">{a.serial_number}</strong></span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-3 text-slate-500">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Purchased</span>
                      <span className="font-semibold text-slate-600">{a.purchase_date ? new Date(a.purchase_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : "N/A"}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Expiry</span>
                      <span className="font-semibold text-slate-600">{wInfo.expiryDateStr}</span>
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenModal(a, "view")}
                      className="text-xs rounded-lg h-8 font-semibold flex-1"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1.5" /> Details
                    </Button>
                    {canModify && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenModal(a, "edit")}
                        className="text-xs rounded-lg h-8 font-semibold flex-1 border-indigo-100 text-indigo-600 hover:bg-indigo-50/50"
                      >
                        <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(a.id, a.product_name)}
                        className="text-xs rounded-lg h-8 font-semibold text-destructive hover:bg-destructive/5 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {filteredAssets.length > ITEMS_PER_PAGE && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
          <p className="text-xs text-muted-foreground">
            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredAssets.length)} of {filteredAssets.length}
          </p>
          <Pagination className="w-full sm:w-auto mx-0 justify-end overflow-x-auto">
            <PaginationContent className="flex-nowrap">
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage((p) => Math.max(1, p - 1));
                  }}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : undefined}
                />
              </PaginationItem>
              {pageNumbers.map((page, index) => (
                <PaginationItem key={page === "ellipsis" ? `ellipsis-${index}` : page}>
                  {page === "ellipsis" ? <PaginationEllipsis /> : <PaginationLink
                    href="#"
                    isActive={currentPage === page}
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentPage(page);
                    }}
                  >
                    {page}
                  </PaginationLink>}
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage((p) => Math.min(totalPages, p + 1));
                  }}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : undefined}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* View & Add/Edit Overlay Modal */}
      <AnimatePresence>
        {selectedAsset && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex justify-end">
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className="bg-white w-full max-w-xl h-full rounded-lg p-6 md:p-8 relative flex flex-col gap-6 overflow-y-auto shadow-xl border border-gray-200"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedAsset(null)}
                aria-label="Close modal"
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 p-1.5 rounded-lg transition-colors z-20"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div className="flex items-center gap-4 border-b pb-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white uppercase gradient-warm">
                  {(modalMode === 'add' ? 'N' : productName)?.charAt(0) || 'A'}
                </div>
                <div>
                  <h3 className="text-xl font-display font-bold text-slate-800">
                    {modalMode === 'view' ? "Asset Inventory Details" : modalMode === 'add' ? "Register New Equipment" : "Edit Equipment Details"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {modalMode === 'view' ? `Serial No: ${selectedAsset.serial_number || "N/A"}` : "Input asset parameters."}
                  </p>
                </div>
              </div>

              {modalMode === 'view' ? (
                /* View Mode */
                <div className="space-y-6 flex-1">
                  <div className="space-y-4 bg-muted/40 p-4 rounded-xl border border-slate-100">
                    <h4 className="text-xs font-bold text-primary uppercase tracking-wider font-display">Client & Location Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Customer</span>
                        <span className="text-sm font-semibold text-slate-800">{selectedAsset.customers?.full_name || "Unknown"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Branch deployed</span>
                        <span className="text-sm font-semibold text-slate-800 flex items-center gap-1 truncate">
                          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{selectedAsset.branches?.branch_name || "None"}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 bg-muted/40 p-4 rounded-xl border border-slate-100">
                    <h4 className="text-xs font-bold text-primary uppercase tracking-wider font-display">Equipment Parameters</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Product Name</span>
                        <span className="text-sm font-bold text-slate-800">{selectedAsset.product_name}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Category</span>
                        <span className="text-xs font-semibold text-slate-700">{selectedAsset.category}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Device Status</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider inline-block mt-0.5 ${selectedAsset.status === 'Active' ? 'bg-emerald-50 border border-emerald-200 text-emerald-600' :
                            selectedAsset.status === 'Under Repair' ? 'bg-amber-50 border border-amber-200 text-amber-600' :
                              'bg-slate-50 border border-slate-200 text-slate-600'
                          }`}>
                          {selectedAsset.status || 'Active'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Model Number</span>
                        <span className="text-xs font-semibold text-slate-700">{selectedAsset.model_number || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Serial Number</span>
                        <span className="text-xs font-semibold text-slate-700">{selectedAsset.serial_number || "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 bg-muted/40 p-4 rounded-xl border border-slate-100">
                    <h4 className="text-xs font-bold text-primary uppercase tracking-wider font-display font-semibold">Warranty Timeline</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Purchase Date</span>
                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mt-0.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {selectedAsset.purchase_date ? new Date(selectedAsset.purchase_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Warranty Span</span>
                        <span className="text-xs font-semibold text-slate-700">{selectedAsset.warranty_months} Months</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Installation Date</span>
                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mt-0.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {selectedAsset.installation_date ? new Date(selectedAsset.installation_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Warranty Status</span>
                        {(() => {
                          const wInfo = getWarrantyInfo(selectedAsset.purchase_date, selectedAsset.warranty_months);
                          return (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider flex items-center gap-1 ${wInfo.isExpired ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                }`}>
                                {wInfo.status}
                              </span>
                              <span className="text-[10px] text-slate-400 font-light">({wInfo.expiryDateStr})</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {selectedAsset.notes && (
                    <div className="space-y-2 bg-muted/40 p-4 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Technical Notes</span>
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap max-h-24 overflow-y-auto">{selectedAsset.notes}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 rounded-xl h-11 font-bold text-sm"
                      onClick={() => setSelectedAsset(null)}
                    >
                      Close Details
                    </Button>
                    {canModify && (
                      <Button
                        type="button"
                        className="flex-1 gradient-primary text-primary-foreground shadow-glow rounded-xl h-11 font-bold text-sm"
                        onClick={() => handleOpenModal(selectedAsset, "edit")}
                      >
                        <Edit className="w-4 h-4 mr-2" /> Edit Asset
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                /* Add / Edit Form Mode */
                <form onSubmit={handleSaveAsset} className="space-y-4 flex flex-col flex-1 justify-between">
                  <div className="space-y-4">
                    {/* Searchable Customer Dropdown */}
                    <div className="space-y-1.5 relative">
                      <label className="text-xs font-semibold text-slate-600">Select Customer <span className="text-destructive">*</span></label>
                      <Popover open={isCustomerPopoverOpen} onOpenChange={setIsCustomerPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="h-10 w-full justify-between font-normal disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-100"
                            disabled={loading}
                          >
                            {customerSearch ? (
                              <span className="truncate font-medium">{customerSearch}</span>
                            ) : (
                              <span className="text-muted-foreground">Search customer by name, phone, or email...</span>
                            )}
                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search customer by name, phone, or email..." />
                            <CommandList>
                              <CommandEmpty>No customer found.</CommandEmpty>
                              {customers?.map((c: any) => (
                                <CommandItem
                                  key={c.id}
                                  value={`${c.full_name} ${c.phone || ''} ${c.email || ''}`}
                                  onSelect={() => {
                                    setCustomerId(c.id);
                                    setCustomerSearch(c.full_name);
                                    setIsCustomerPopoverOpen(false);
                                  }}
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium">{c.full_name}</span>
                                    <span className="text-xs text-muted-foreground">{c.phone} {c.email ? `• ${c.email}` : ''}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Searchable Branch Dropdown */}
                    <div className="space-y-1.5 relative">
                      <label className="text-xs font-semibold text-slate-600">Deployment Branch Location</label>
                      <div className="relative">
                        <Input
                          value={branchSearch}
                          onChange={(e) => {
                            setBranchSearch(e.target.value);
                            setBranchDropdownOpen(true);
                          }}
                          onFocus={() => setBranchDropdownOpen(true)}
                          placeholder="Type branch name to filter..."
                          disabled={loading}
                          className="rounded-lg border-slate-200 h-10 pr-10"
                        />
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer" onClick={() => setBranchDropdownOpen(!branchDropdownOpen)} />
                      </div>

                      {branchDropdownOpen && (
                        <div className="absolute left-0 right-0 z-50 mt-1 max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg divide-y divide-slate-100">
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-rose-500 font-semibold"
                            onClick={() => {
                              setBranchId("");
                              setBranchSearch("");
                              setBranchDropdownOpen(false);
                            }}
                          >
                            -- Clear / No Branch --
                          </button>
                          {filteredFormBranches.length === 0 ? (
                            <div className="p-3 text-xs text-muted-foreground text-center">No branches match filter</div>
                          ) : (
                            filteredFormBranches.map((b: any) => (
                              <button
                                type="button"
                                key={b.id}
                                className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 transition-colors font-medium text-slate-700"
                                onClick={() => {
                                  setBranchId(b.id);
                                  setBranchSearch(b.branch_name);
                                  setBranchDropdownOpen(false);
                                }}
                              >
                                {b.branch_name}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">Product Name <span className="text-destructive">*</span></label>
                        <Input
                          value={productName}
                          onChange={(e) => setProductName(e.target.value)}
                          placeholder="e.g. Solar Panel 400W"
                          required
                          disabled={loading}
                          className="rounded-lg border-slate-200 h-10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">Category</label>
                        <Select value={category} onValueChange={setCategory} disabled={loading}>
                          <SelectTrigger className="w-full h-10 rounded-lg border-slate-200 bg-white">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Solar PV">Solar PV</SelectItem>
                            <SelectItem value="CCTV & Security">CCTV & Security</SelectItem>
                            <SelectItem value="Networking">Networking</SelectItem>
                            <SelectItem value="Power Systems">Power Systems</SelectItem>
                            <SelectItem value="UPS & Battery">UPS & Battery</SelectItem>
                            <SelectItem value="Others">Others</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">Model Number</label>
                        <Input
                          value={modelNumber}
                          onChange={(e) => setModelNumber(e.target.value)}
                          placeholder="e.g. SP-400-X"
                          disabled={loading}
                          className="rounded-lg border-slate-200 h-10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">Serial Number</label>
                        <Input
                          value={serialNumber}
                          onChange={(e) => setSerialNumber(e.target.value)}
                          placeholder="e.g. SN1234567890"
                          disabled={loading}
                          className="rounded-lg border-slate-200 h-10"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">Purchase Date <span className="text-destructive">*</span></label>
                        <Input
                          type="date"
                          value={purchaseDate}
                          onChange={(e) => setPurchaseDate(e.target.value)}
                          required
                          disabled={loading}
                          className="rounded-lg border-slate-200 h-10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">Warranty (Months)</label>
                        <Input
                          type="number"
                          value={warrantyMonths}
                          onChange={(e) => setWarrantyMonths(Number(e.target.value))}
                          min={0}
                          required
                          disabled={loading}
                          className="rounded-lg border-slate-200 h-10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">Installation Date</label>
                        <Input
                          type="date"
                          value={installationDate}
                          onChange={(e) => setInstallationDate(e.target.value)}
                          disabled={loading}
                          className="rounded-lg border-slate-200 h-10"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">Status</label>
                        <Select value={status} onValueChange={setStatus} disabled={loading}>
                          <SelectTrigger className="w-full h-10 rounded-lg border-slate-200 bg-white">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Under Repair">Under Repair</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                            <SelectItem value="Scrapped">Scrapped</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Additional Notes</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Technical comments, repair history, warranty terms..."
                        disabled={loading}
                        rows={2}
                        className="w-full p-3 border border-slate-200 rounded-lg text-sm bg-transparent focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-6 border-t border-slate-100 mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 rounded-xl h-11 font-bold text-sm"
                      onClick={() => setSelectedAsset(null)}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 gradient-primary text-primary-foreground shadow-glow rounded-xl h-11 font-bold text-sm"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                        </>
                      ) : (
                        "Save Asset"
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AssetImportModal
        open={isAssetImportOpen}
        onOpenChange={setIsAssetImportOpen}
        onImportSuccess={refetch}
      />
    </div>
  );
}
