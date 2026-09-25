import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Plus,
  Users,
  Calendar,
  Clock,
  Search,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  Loader2,
  MapPin,
  Phone,
  User,
  Wrench,
  FileText,
  AlertTriangle,
  ChevronDown,
  Navigation,
  Copy,
  Crown,
  Edit2,
  Trash2,
  UserPlus,
  CheckSquare,
  Square
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import OffCanvasPanel from "@/components/OffCanvasPanel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { supabase } from "@/lib/supabase";
import { installationService, formatInstallationTicketId, type Installation } from "@/services/installationService";
import { toast } from "sonner";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { TechnicianMissionControl } from "@/components/TechnicianMissionControl";
import { ManualWhatsAppButton } from "@/components/ManualWhatsAppButton";
import {
  sendWhatsAppMessage,
  getCustomerPhone,
  getCustomerName,
  getInstallationCreatedMessage,
  getInstallationScheduledMessage,
} from "@/utils/whatsappService";
import { notificationService } from "@/services/notificationService";
import {
  INSTALLATION_STATUSES,
  getInstallationStatusLabel,
} from "@/constants/installationStatuses";

const STATUS_OPTIONS = ["All statuses", ...INSTALLATION_STATUSES];

const getStatusBadgeStyle = (status: string) => {
  const s = getInstallationStatusLabel(status).toLowerCase().trim();
  switch (s) {
    case "unassigned":
      return "bg-slate-100 text-slate-700 border-slate-300";
    case "assigned":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "dispatched":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "in progress":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "pending due to material shortage":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "site completed and handed over":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "verified":
      return "bg-sky-50 text-sky-700 border-sky-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
};

const formatTechId = (t: any): string => {
  if (!t) return "";
  if (t.technician_id && String(t.technician_id).trim()) return String(t.technician_id).trim();
  if (t.employee_id && String(t.employee_id).trim()) return String(t.employee_id).trim();
  if (t.employeeId && String(t.employeeId).trim()) return String(t.employeeId).trim();
  if (t.id) {
    return `TECH-${String(t.id).replace(/-/g, "").slice(0, 4).toUpperCase()}`;
  }
  return "";
};

const getPriorityBadgeStyle = (priority: string) => {
  const p = (priority || "").toLowerCase().trim();
  switch (p) {
    case "critical":
      return "bg-rose-100 text-rose-800 border-rose-200";
    case "high":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "medium":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "low":
      return "bg-slate-100 text-slate-700 border-slate-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

const formatDateToYYYYMMDD = (d: Date | null) => {
  if (!d) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function Installations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ----------------------------------------------------
  // SECTION A: Log New Installation Form State
  // ----------------------------------------------------
  const [customerType, setCustomerType] = useState<"Existing BTL Customer" | "New / Non-BTL Customer">("Existing BTL Customer");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [nonBtlName, setNonBtlName] = useState("");
  const [nonBtlContact, setNonBtlContact] = useState("");
  const [nonBtlAddress, setNonBtlAddress] = useState("");
  const [equipmentDetails, setEquipmentDetails] = useState("");
  const [brand, setBrand] = useState("");
  const [priority, setPriority] = useState<"Critical" | "High" | "Medium" | "Low">("Medium");
  const [isChargeable, setIsChargeable] = useState<"No" | "Yes">("Yes");
  const [serviceCharge, setServiceCharge] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🔍 Smart Walk-in Auto-Detector State
  const [matchedCustomer, setMatchedCustomer] = useState<any>(null);
  const [showMatchAlert, setShowMatchAlert] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);

  const checkExistingCustomerPhone = async (phoneStr: string) => {
    if (!phoneStr) {
      setShowMatchAlert(false);
      return;
    }
    const cleanPhone = phoneStr.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setShowMatchAlert(false);
      return;
    }

    setIsCheckingPhone(true);
    try {
      const last10 = cleanPhone.slice(-10);
      const { data: custData } = await supabase
        .from('customers')
        .select('id, full_name, phone, customer_type')
        .ilike('phone', `%${last10}%`)
        .limit(1)
        .maybeSingle();

      if (custData) {
        setMatchedCustomer(custData);
        setShowMatchAlert(true);
        return;
      }

      const { data: profData } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('role', 'customer')
        .ilike('phone', `%${last10}%`)
        .limit(1)
        .maybeSingle();

      if (profData) {
        setMatchedCustomer(profData);
        setShowMatchAlert(true);
      } else {
        setShowMatchAlert(false);
      }
    } catch (err) {
      console.warn("Smart Walk-in check error:", err);
      setShowMatchAlert(false);
    } finally {
      setIsCheckingPhone(false);
    }
  };

  const handleConvertToRegistered = (matched: any) => {
    setCustomerType("Existing BTL Customer");
    handleCustomerSelect(matched.id);
    setShowMatchAlert(false);
    toast.success(`Switched to registered customer: ${matched.full_name}`);
  };

  // ----------------------------------------------------
  // SECTION B: Assign Technicians State
  // ----------------------------------------------------
  const [assignInstallationId, setAssignInstallationId] = useState("");
  const [isAssignJobPopoverOpen, setIsAssignJobPopoverOpen] = useState(false);
  const [assignTechSearch, setAssignTechSearch] = useState("");
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<string[]>([]);
  const [leadTechnicianId, setLeadTechnicianId] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [scheduledTime, setScheduledTime] = useState("");
  const [reassignmentReason, setReassignmentReason] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  // ----------------------------------------------------
  // SECTION C: Jobs Table & Filters State
  // ----------------------------------------------------
  const { user, isRole } = useAuth();
  const isAdmin = isRole ? isRole("admin") : (user?.role === "admin" || !user);
  const isTechnician = isRole ? isRole("technician") : user?.role === "technician";

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");

  // View Details Modal State
  const [viewInstallation, setViewInstallation] = useState<Installation | null>(null);
  const [modalUpdatingStatus, setModalUpdatingStatus] = useState(false);

  // Edit Installation Modal State (Admin)
  const [editInstallation, setEditInstallation] = useState<Installation | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete Installation State (Admin)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isLogNewOpen, setIsLogNewOpen] = useState(false);

  const [selectedInstallationIds, setSelectedInstallationIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "card">("table");

  // ----------------------------------------------------
  // Queries
  // ----------------------------------------------------
  // 1. Installations list
  const { data: installations = [], isLoading: isLoadingInstallations } = useQuery({
    queryKey: ["installations-list"],
    queryFn: () => installationService.getAll(),
  });

  // Real-time live synchronization
  useEffect(() => {
    const channel = supabase
      .channel("installations-live-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "installations" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["installations-list"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "installation_technicians" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["installations-list"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // ----------------------------------------------------
  // Dynamic State & Data Fetching (Customers, Locations, Technicians)
  // ----------------------------------------------------
  const [customers, setCustomers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [isLoadingTechnicians, setIsLoadingTechnicians] = useState(false);

  // Fetch Customers on Mount
  useEffect(() => {
    const fetchCustomers = async () => {
      setIsLoadingCustomers(true);
      try {
        const { data: custList } = await supabase
          .from('customers')
          .select('id, user_id, full_name, email, phone, customer_type')
          .order('full_name', { ascending: true });

        const { data: profList } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone')
          .eq('role', 'customer');

        const map = new Map<string, any>();

        (custList || []).forEach((c: any) => {
          map.set(c.id, {
            id: c.id,
            user_id: c.user_id,
            full_name: c.full_name,
            email: c.email || '',
            phone: c.phone || '',
            customer_type: c.customer_type || 'BTL Customer'
          });
        });

        (profList || []).forEach((p: any) => {
          const existing = Array.from(map.values()).find((c: any) => c.user_id === p.id || c.id === p.id);
          if (!existing) {
            map.set(p.id, {
              id: p.id,
              user_id: p.id,
              full_name: p.full_name,
              email: p.email || '',
              phone: p.phone || '',
              customer_type: 'Registered'
            });
          }
        });

        setCustomers(Array.from(map.values()));
      } catch (err) {
        console.error("Error fetching combined customers:", err);
      } finally {
        setIsLoadingCustomers(false);
      }
    };
    fetchCustomers();
  }, []);

  // Fetch Technicians on Mount
  useEffect(() => {
    const fetchTechnicians = async () => {
      setIsLoadingTechnicians(true);
      // Select available profile columns (with fallback if technician_id or designation are separate columns)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'technician')
        .order('full_name');
      console.log("Fetched Technicians:", data, "Error:", error);
      if (data) setTechnicians(data);
      setIsLoadingTechnicians(false);
    };
    fetchTechnicians();
  }, []);

  // Fetch Locations when Customer changes
  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setSelectedLocationId("");

    if (customerId) {
      const fetchLocations = async () => {
        setIsLoadingLocations(true);
        const { data, error } = await supabase
          .from('customer_locations')
          .select('id, location_name, city')
          .eq('customer_id', customerId)
          .order('location_name');
        console.log("Fetched Locations:", data, "Error:", error);
        if (data) setLocations(data || []);
        setIsLoadingLocations(false);
      };
      fetchLocations();
    } else {
      setLocations([]);
    }
  };

  // Toggle technician checkbox
  const handleTechToggle = (techId: string, checked: boolean) => {
    if (checked) {
      setSelectedTechnicianIds((prev) => {
        const next = [...prev, techId];
        if (!leadTechnicianId || prev.length === 0) {
          setLeadTechnicianId(techId);
        }
        return next;
      });
    } else {
      setSelectedTechnicianIds((prev) => {
        const next = prev.filter((id) => id !== techId);
        if (leadTechnicianId === techId) {
          setLeadTechnicianId(next[0] || "");
        }
        return next;
      });
    }
  };

  // When selected installation in Section B changes, populate its current assignees & schedule
  const selectedJob = useMemo(() => {
    return installations.find((inst) => inst.id === assignInstallationId) || null;
  }, [installations, assignInstallationId]);

  const initialAssigneeIds = useMemo(() => {
    if (!selectedJob || !selectedJob.installation_technicians) return [];
    return selectedJob.installation_technicians.map((it: any) => it.technician_id);
  }, [selectedJob]);

  useEffect(() => {
    if (selectedJob) {
      const currentIds = (selectedJob.installation_technicians || []).map((it: any) => it.technician_id);
      setSelectedTechnicianIds(currentIds);
      const foundLead = selectedJob.lead_technician_id || (selectedJob.installation_technicians?.find((it: any) => it.is_lead)?.technician_id) || currentIds[0] || "";
      setLeadTechnicianId(foundLead);
      if (selectedJob.scheduled_date) {
        setScheduledDate(new Date(`${selectedJob.scheduled_date}T00:00:00`));
      } else {
        setScheduledDate(null);
      }
      setScheduledTime(selectedJob.scheduled_time || "");
      setReassignmentReason(selectedJob.reassignment_reason || "");
    } else {
      setSelectedTechnicianIds([]);
      setLeadTechnicianId("");
      setScheduledDate(null);
      setScheduledTime("");
      setReassignmentReason("");
    }
  }, [selectedJob]);

  // Determine if technician assignment has changed from current state
  const isTechnicianSelectionChanged = useMemo(() => {
    if (!selectedJob) return false;
    const sortedCurrent = [...initialAssigneeIds].sort().join(",");
    const sortedNew = [...selectedTechnicianIds].sort().join(",");
    return sortedCurrent !== sortedNew;
  }, [initialAssigneeIds, selectedTechnicianIds, selectedJob]);

  const isReassignmentReasonRequired = isTechnicianSelectionChanged && initialAssigneeIds.length > 0;

  // Helper to get formatted name of currently assigned technicians
  const currentAssigneesDisplay = useMemo(() => {
    if (!assignInstallationId || !selectedJob) {
      return "— Select an installation job first —";
    }
    const assignedTechs = selectedJob.installation_technicians || [];
    if (assignedTechs.length === 0) {
      return "Unassigned";
    }
    return assignedTechs
      .map((it: any) => {
        const t = it.technician || technicians.find((tech: any) => tech.id === it.technician_id);
        const name = t?.full_name || t?.email || "Technician";
        const techId = formatTechId(t);
        return techId ? `${name} (${techId})` : name;
      })
      .join(", ");
  }, [assignInstallationId, selectedJob, technicians]);

  // ----------------------------------------------------
  // SECTION A: Handle Log New Installation
  // ----------------------------------------------------
  const handleLogInstallation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (customerType === "Existing BTL Customer") {
      if (!selectedCustomerId) {
        toast.error("Please select a customer");
        return;
      }
    } else {
      if (!nonBtlName.trim()) {
        toast.error("Please enter the customer / contact name");
        return;
      }
      if (!nonBtlContact.trim()) {
        toast.error("Please enter the contact number");
        return;
      }
      const contactDigits = nonBtlContact.replace(/\D/g, "");
      if (!/^[6-9]\d{9}$/.test(contactDigits)) {
        toast.error("Please enter a valid 10-digit Indian mobile number for the contact");
        return;
      }
      if (!nonBtlAddress.trim()) {
        toast.error("Please enter the installation site address");
        return;
      }
    }

    if (!equipmentDetails.trim()) {
      toast.error("Please specify the equipment to install (models, quantity, scope)");
      return;
    }

    if (isChargeable === "Yes") {
      const chargeVal = Number(serviceCharge);
      if (isNaN(chargeVal) || chargeVal <= 0) {
        toast.error("Service Charge must be greater than 0 when chargeable");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let linkedCustomerId = customerType === "Existing BTL Customer" ? selectedCustomerId : null;

      // Auto-create customer in customers table for Walk-in / Non-BTL if not existing
      if (customerType === "New / Non-BTL Customer" && nonBtlContact.trim()) {
        try {
          const cleanPhone = nonBtlContact.replace(/\D/g, "");
          const last10 = cleanPhone.slice(-10);
          if (last10.length === 10) {
            const { data: matchedCust } = await supabase
              .from("customers")
              .select("id, full_name, user_id")
              .ilike("phone", `%${last10}%`)
              .maybeSingle();

            if (matchedCust?.id) {
              linkedCustomerId = matchedCust.id;
            } else {
              const { data: profMatch } = await supabase
                .from("profiles")
                .select("id")
                .ilike("phone", `%${last10}%`)
                .maybeSingle();

              if (profMatch?.id) {
                linkedCustomerId = profMatch.id;
              } else {
                const { data: newCust } = await supabase
                  .from("customers")
                  .insert([{
                    full_name: nonBtlName.trim() || "Walk-in Customer",
                    phone: nonBtlContact.trim(),
                    address: nonBtlAddress.trim() || null,
                    customer_type: "Walk-in"
                  }])
                  .select("id")
                  .maybeSingle();

                if (newCust?.id) {
                  linkedCustomerId = newCust.id;
                }
              }
            }
          }
        } catch (custErr) {
          console.warn("Walk-in installation customer auto-registration skipped:", custErr);
        }
      }

      const payload: Partial<Installation> = {
        customer_type: customerType === "Existing BTL Customer" ? "BTL" : "Non-BTL",
        customer_id: linkedCustomerId,
        location_id: customerType === "Existing BTL Customer" && selectedLocationId ? selectedLocationId : null,
        non_btl_customer_name: customerType === "New / Non-BTL Customer" ? nonBtlName.trim() : null,
        non_btl_contact_number: customerType === "New / Non-BTL Customer" ? nonBtlContact.trim() : null,
        non_btl_address: customerType === "New / Non-BTL Customer" ? nonBtlAddress.trim() : null,
        equipment_details: equipmentDetails.trim(),
        brand: brand.trim() || null,
        priority,
        is_chargeable: isChargeable === "Yes",
        service_charge: isChargeable === "Yes" ? (Number(serviceCharge) || 0) : 0,
        payment_status: "Pending",
        notes: notes.trim() || null,
        status: "Unassigned",
        current_phase: 1,
      };

      const created = await installationService.create(payload);
      toast.success(`Installation ${created.ticket_id} logged successfully!`);

      // 🔔 Stage 1 App Notification on Installation Creation
      try {
        const custObj = customers.find((c: any) => c.id === selectedCustomerId);
        const recipientId = customerType === "Existing BTL Customer" ? custObj?.id : null;
        const instTicketId = created.ticket_id || formatInstallationTicketId(created) || "Installation";
        const adminIds = await notificationService.getAdminUserIds();

        if (recipientId) {
          await notificationService.insertNotification(
            recipientId,
            created.id,
            "info",
            "Installation Created",
            `Installation ${instTicketId} has been logged for equipment installation.`,
            1,
            `/installations/${created.id}`,
            user?.id
          );
        }

        await notificationService.insertNotification(
          adminIds,
          created.id,
          "info",
          "New Installation Logged",
          `Installation ${instTicketId} has been created.`,
          1,
          `/installations/${created.id}`,
          user?.id
        );
      } catch (notifErr) {
        console.warn("Installation creation app notification warning:", notifErr);
      }

      // 🔔 Stage 1 Automated WhatsApp Notification on Installation Creation
      try {
        const custObj = customers.find((c: any) => c.id === selectedCustomerId);
        const recipientPhone = customerType === "Existing BTL Customer" ? (custObj?.phone || "") : nonBtlContact.trim();
        const recipientName = customerType === "Existing BTL Customer" ? (custObj?.full_name || "Valued Customer") : (nonBtlName.trim() || "Valued Customer");
        const instTicketId = created.ticket_id || formatInstallationTicketId(created) || "Installation";
        const equip = equipmentDetails.trim() || brand.trim() || "Equipment Installation";

        if (recipientPhone) {
          const msg = getInstallationCreatedMessage({
            customerName: recipientName,
            ticketId: instTicketId,
            equipmentType: equip,
          });
          await sendWhatsAppMessage(recipientPhone, msg, {
            ticketId: instTicketId,
            name: recipientName,
            title: equip,
            event_type: 'creation',
          });
        }
      } catch (waErr) {
        console.warn("Installation creation WhatsApp dispatch error:", waErr);
      }

      // Reset form fields
      setSelectedCustomerId("");
      setSelectedLocationId("");
      setNonBtlName("");
      setNonBtlContact("");
      setNonBtlAddress("");
      setEquipmentDetails("");
      setBrand("");
      setPriority("Medium");
      setIsChargeable("Yes");
      setServiceCharge("");
      setNotes("");
      setIsLogNewOpen(false);

      // Refresh lists
      await queryClient.invalidateQueries({ queryKey: ["installations-list"] });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (err: any) {
      console.error("Failed to log installation:", err);
      toast.error(err?.message || "Failed to create installation job");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // SECTION B: Handle Assign / Reassign Technicians
  // ----------------------------------------------------
  const handleAssignTeam = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!assignInstallationId) {
      toast.error("Please select an installation job to assign");
      return;
    }

    if (selectedTechnicianIds.length === 0) {
      toast.error("Please select at least one technician");
      return;
    }

    if (!scheduledDate) {
      toast.error("Scheduled Date is required to assign technicians");
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduled = new Date(scheduledDate);
    scheduled.setHours(0, 0, 0, 0);
    if (scheduled < today) {
      toast.error("Scheduled Date must be today or in the future");
      return;
    }

    if (!scheduledTime) {
      toast.error("Scheduled Time is required to assign technicians");
      return;
    }

    if (isReassignmentReasonRequired && !reassignmentReason.trim()) {
      toast.error("Reassignment reason is required when modifying assigned technicians");
      return;
    }

    setIsAssigning(true);
    try {
      const formattedDate = formatDateToYYYYMMDD(scheduledDate);
      const effectiveLeadId = leadTechnicianId || selectedTechnicianIds[0];
      await installationService.assignTechnicians(
        assignInstallationId,
        selectedTechnicianIds,
        formattedDate || null,
        scheduledTime || null,
        reassignmentReason.trim() || null,
        effectiveLeadId
      );

      // 🔔 Stage 2 WhatsApp Notification on Installation Assignment & Scheduling
      try {
        const instObj = installations.find(i => i.id === assignInstallationId);
        const recipientPhone = instObj ? getCustomerPhone(instObj) : "";
        const recipientName = instObj ? getCustomerName(instObj) : "Valued Customer";
        const assignedTechObj = technicians.find(t => t.id === effectiveLeadId) || technicians.find(t => t.id === selectedTechnicianIds[0]);
        const techName = assignedTechObj?.full_name || "Field Technician";
        const instTicketId = instObj ? formatInstallationTicketId(instObj) : "Installation";
        const sDate = formattedDate
          ? new Date(`${formattedDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          : "the scheduled date";
        const sTime = scheduledTime || "10:00 AM";

        if (recipientPhone) {
          const schedMsg = getInstallationScheduledMessage({
            customerName: recipientName,
            technicianName: techName,
            ticketId: instTicketId,
            scheduledDate: sDate,
            scheduledTime: sTime,
          });
          await sendWhatsAppMessage(recipientPhone, schedMsg, {
            ticketId: instTicketId,
            name: recipientName,
            technicianName: techName,
            date: sDate,
            time: sTime,
            event_type: reassignmentReason ? "reassignment" : "assignment",
          });
        }
      } catch (waErr) {
        console.warn("Installation assign WhatsApp dispatch skipped:", waErr);
      }

      toast.success("Technicians assigned successfully!");

      // 🔔 Stage 2 App Notification on Installation Assignment & Scheduling
      try {
        const instObj = installations.find(i => i.id === assignInstallationId);
        const instTicketId = instObj ? formatInstallationTicketId(instObj) : "Installation";
        const assignedTechObj = technicians.find(t => t.id === effectiveLeadId) || technicians.find(t => t.id === selectedTechnicianIds[0]);
        const techName = assignedTechObj?.full_name || "Field Technician";
        const sDate = formattedDate
          ? new Date(`${formattedDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          : "the scheduled date";
        const sTime = scheduledTime || "10:00 AM";

        for (const techId of selectedTechnicianIds) {
          await notificationService.insertNotification(
            techId,
            assignInstallationId,
            "assignment",
            "Installation Assigned",
            `You have been assigned to installation ${instTicketId} with ${techName}. Scheduled: ${sDate} ${sTime}.`,
            2,
            `/installations/${assignInstallationId}`,
            user?.id
          );
        }

        if (instObj?.customer_id) {
          await notificationService.insertNotification(
            instObj.customer_id,
            assignInstallationId,
            "assignment",
            "Technician Assigned",
            `Technician ${techName} has been assigned to your installation ${instTicketId}. Scheduled: ${sDate} ${sTime}.`,
            2,
            `/installations/${assignInstallationId}`,
            user?.id
          );
        }
      } catch (notifErr) {
        console.warn("Installation assignment app notification warning:", notifErr);
      }

      setAssignInstallationId("");
      setSelectedTechnicianIds([]);
      setScheduledDate(null);
      setScheduledTime("");
      setReassignmentReason("");

      await queryClient.invalidateQueries({ queryKey: ["installations-list"] });
    } catch (err: any) {
      console.error("Failed to assign technicians:", err);
      toast.error(err?.message || "Failed to assign technicians");
    } finally {
      setIsAssigning(false);
    }
  };

  // ----------------------------------------------------
  // SECTION C: Filtered Jobs
  // ----------------------------------------------------
  const filteredInstallations = useMemo(() => {
    return installations.filter((item) => {
      // Status filter
      if (statusFilter !== "All statuses" && getInstallationStatusLabel(item.status) !== statusFilter) {
        return false;
      }

      // Search query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();

      const formattedId = formatInstallationTicketId(item).toLowerCase();
      const ticketMatch = (item.ticket_id || "").toLowerCase().includes(q) || formattedId.includes(q);
      const btlCustomerName = item.customer?.full_name || "";
      const nonBtlName = item.non_btl_customer_name || "";
      const customerMatch = btlCustomerName.toLowerCase().includes(q) || nonBtlName.toLowerCase().includes(q);
      const phoneMatch =
        (item.customer?.phone || "").toLowerCase().includes(q) ||
        (item.non_btl_contact_number || "").toLowerCase().includes(q);

      const techMatch = (item.installation_technicians || []).some((it: any) => {
        const t = it.technician || technicians.find((tech: any) => tech.id === it.technician_id);
        return (
          (t?.full_name || "").toLowerCase().includes(q) ||
          (t?.technician_id || "").toLowerCase().includes(q) ||
          (t?.employee_id || "").toLowerCase().includes(q) ||
          (t?.email || "").toLowerCase().includes(q)
        );
      });

      const equipMatch = (item.equipment_details || "").toLowerCase().includes(q);
      const addressMatch =
        (item.non_btl_address || "").toLowerCase().includes(q) ||
        (item.location?.address || "").toLowerCase().includes(q) ||
        (item.location?.location_name || "").toLowerCase().includes(q);

      return ticketMatch || customerMatch || phoneMatch || techMatch || equipMatch || addressMatch;
    });
  }, [installations, statusFilter, searchQuery, technicians]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("All statuses");
  };

  // Update status from view modal
  const handleUpdateStatus = async (newStatus: string) => {
    if (!viewInstallation) return;
    setModalUpdatingStatus(true);
    try {
      await installationService.update(viewInstallation.id, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      setViewInstallation((prev) => (prev ? { ...prev, status: newStatus } : null));
      await queryClient.invalidateQueries({ queryKey: ["installations-list"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status");
    } finally {
      setModalUpdatingStatus(false);
    }
  };

  // Admin Handlers: Edit, Delete, Quick Assign
  const handleOpenEdit = (item: any) => {
    setEditInstallation(item);

    // Resolve classification
    const isWalkIn = item.customer_type === "New / Non-BTL Customer" ||
      item.customer_type === "walk-in" ||
      item.customer_type === "Non-BTL" ||
      (!item.customer_id && (item.non_btl_customer_name || item.walk_in_customer_name));

    const custType = isWalkIn ? "New / Non-BTL Customer" : "Existing BTL Customer";
    const walkInName = item.walk_in_customer_name || item.non_btl_customer_name || item.customer?.full_name || "";
    const walkInPhone = item.walk_in_customer_phone || item.non_btl_contact_number || item.customer?.phone || "";
    const siteAddr = item.installation_site_address || item.non_btl_address || item.site_address || item.location?.address || "";
    const eqScope = item.equipment_scope || item.equipment_details || item.equipment_type || item.equipment_model || "";
    const brandName = item.brand_oem || item.brand || "";
    const priorityVal = item.priority || "Medium";
    const isChargeableVal = (item.is_chargeable === true || item.is_chargeable === "Yes" || Number(item.service_charge) > 0) ? "Yes" : "No";
    const chargeAmt = item.service_charge ?? 0;
    const scopeNotes = item.scope_instructions || item.notes || item.installation_notes || item.site_notes || "";
    const statusVal = item.status || "Unassigned";

    setEditFormData({
      customer_type: custType,
      customer_id: item.customer_id || "",
      location_id: item.location_id || "",
      non_btl_customer_name: walkInName,
      walk_in_customer_name: walkInName,
      non_btl_contact_number: walkInPhone,
      walk_in_customer_phone: walkInPhone,
      non_btl_address: siteAddr,
      installation_site_address: siteAddr,
      equipment_details: eqScope,
      equipment_scope: eqScope,
      brand: brandName,
      brand_oem: brandName,
      priority: priorityVal,
      is_chargeable: isChargeableVal,
      chargeable_service: isChargeableVal,
      service_charge: chargeAmt,
      notes: scopeNotes,
      scope_instructions: scopeNotes,
      status: statusVal
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInstallation) return;
    setIsSavingEdit(true);
    try {
      const isChargeableBool = editFormData.is_chargeable === "Yes" || editFormData.chargeable_service === "Yes";
      const walkInName = editFormData.walk_in_customer_name || editFormData.non_btl_customer_name || null;
      const walkInPhone = editFormData.walk_in_customer_phone || editFormData.non_btl_contact_number || null;
      const siteAddr = editFormData.installation_site_address || editFormData.non_btl_address || null;
      const eqScope = editFormData.equipment_scope || editFormData.equipment_details || null;
      const brandVal = editFormData.brand_oem || editFormData.brand || null;
      const scopeNotes = editFormData.scope_instructions || editFormData.notes || null;

      const payload: any = {
        customer_type: editFormData.customer_type,
        customer_id: editFormData.customer_type === "Existing BTL Customer" ? editFormData.customer_id || null : null,
        location_id: editFormData.customer_type === "Existing BTL Customer" ? editFormData.location_id || null : null,
        non_btl_customer_name: walkInName,
        walk_in_customer_name: walkInName,
        non_btl_contact_number: walkInPhone,
        walk_in_customer_phone: walkInPhone,
        non_btl_address: siteAddr,
        installation_site_address: siteAddr,
        equipment_details: eqScope,
        equipment_scope: eqScope,
        brand: brandVal,
        brand_oem: brandVal,
        priority: editFormData.priority,
        is_chargeable: isChargeableBool,
        service_charge: isChargeableBool ? Number(editFormData.service_charge) || 0 : 0,
        notes: scopeNotes,
        scope_instructions: scopeNotes,
        status: editFormData.status
      };

      await installationService.update(editInstallation.id, payload);
      toast.success("Installation details updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["installations-list"] });
      setEditInstallation(null);
    } catch (err: any) {
      toast.error(`Failed to update installation: ${err?.message || "Unknown error"}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteInstallation = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    try {
      await installationService.delete(deleteConfirmId);
      toast.success("Installation deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["installations-list"] });
      setDeleteConfirmId(null);
    } catch (err: any) {
      toast.error(`Failed to delete: ${err?.message || "Unknown error"}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleQuickAssign = (item: Installation | string) => {
    const instId = typeof item === "string" ? item : item.id;
    const instObj = typeof item === "string" ? installations.find(i => i.id === item) : item;

    setAssignInstallationId(instId);

    if (instObj) {
      const existingTechIds = (instObj.installation_technicians || []).map((it: any) => it.technician_id);
      setSelectedTechnicianIds(existingTechIds);
      const foundLead = instObj.lead_technician_id || (instObj.installation_technicians?.find((it: any) => it.is_lead)?.technician_id) || existingTechIds[0] || "";
      setLeadTechnicianId(foundLead);
      if (instObj.scheduled_date) {
        setScheduledDate(new Date(`${instObj.scheduled_date}T00:00:00`));
      } else {
        setScheduledDate(null);
      }
      setScheduledTime(instObj.scheduled_time || "");
      setReassignmentReason(instObj.reassignment_reason || "");
    }

    // Smooth scroll and highlight assignment section
    const assignSection = document.getElementById("technician-assignment-section") || document.getElementById("assign-team-section");
    if (assignSection) {
      assignSection.scrollIntoView({ behavior: "smooth", block: "start" });
      assignSection.classList.add("ring-4", "ring-primary/40", "transition-all", "duration-500");
      setTimeout(() => {
        assignSection.classList.remove("ring-4", "ring-primary/40");
      }, 2500);
    }
    toast.success("Selected installation for assignment. Scrolled to assignment panel.");
  };

  const toggleSelectInstallation = (id: string) => {
    setSelectedInstallationIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllInstallations = () => {
    if (selectedInstallationIds.size === filteredInstallations.length) {
      setSelectedInstallationIds(new Set());
    } else {
      setSelectedInstallationIds(new Set(filteredInstallations.map((i) => i.id)));
    }
  };

  const handleBulkDeleteInstallations = async () => {
    const selectedCount = selectedInstallationIds.size;
    if (selectedCount === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedCount} selected installation(s)? This action cannot be undone.`)) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      await Promise.all(Array.from(selectedInstallationIds).map((id) => installationService.delete(id)));
      toast.success(`${selectedCount} installation(s) deleted successfully.`);
      setSelectedInstallationIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ["installations-list"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to delete installations.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const instStats = {
    total: installations.length,
    completed: installations.filter(i => i.status?.toLowerCase().includes("completed") || i.status?.toLowerCase().includes("handed over")).length,
    inProgress: installations.filter(i => i.status?.toLowerCase().includes("progress") || i.status?.toLowerCase().includes("assigned")).length,
    pending: installations.filter(i => i.status?.toLowerCase().includes("pending") || i.status?.toLowerCase().includes("shortage")).length,
  };

  return (
    <div className="space-y-8 pb-16 relative overflow-x-hidden">
      {/* Background Ambient Glows */}
      <div className="bg-ambient-blur top-0 right-10 bg-primary/10" />
      <div className="bg-ambient-blur top-80 left-10 bg-teal-500/10" />

      {/* Top Header */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-border/60 shadow-xl relative overflow-hidden z-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 via-teal-500/5 to-transparent rounded-full filter blur-3xl pointer-events-none" />

        <div className="space-y-1.5 relative z-10">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-primary/10 text-primary border border-primary/20 shadow-sm">
              <Package className="w-3.5 h-3.5" /> SITE DEPLOYMENTS
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-foreground">
            Equipment Installations & Site Commissioning
          </h1>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Schedule on-site hardware setups, dispatch multi-technician teams, configure equipment, and record customer handovers.
            </p>
            <Button
              size="sm"
              onClick={() => setIsLogNewOpen(true)}
              className="gradient-primary text-white hover:opacity-95 rounded-xl h-10 px-4 gap-2 font-bold shadow-glow text-xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              Log New Installation
            </Button>
          </div>
        </div>
      </div>

      {/* 📊 Stat Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 relative z-10">
        <div className="glass-card rounded-2xl p-4 border border-border/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-muted-foreground block">Total Installations</span>
            <span className="text-2xl font-black text-foreground mt-0.5 block">{instStats.total}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-border/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-blue-600 dark:text-blue-400 block">In Progress / Assigned</span>
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5 block">{instStats.inProgress}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <Loader2 className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-border/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-rose-600 dark:text-rose-400 block">Pending / Blocked</span>
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5 block">{instStats.pending}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-border/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">Completed</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">{instStats.completed}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative z-10">
        {/* SECTION B: Assign Technicians to Installation */}
        <Card id="technician-assignment-section" className="p-6 lg:col-span-12 shadow-sm border border-slate-200 bg-white">
          <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-slate-100">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Assign Technicians to Installation</h2>
              <p className="text-xs text-muted-foreground">
                Dispatch multi-technician teams and schedule job dates
              </p>
            </div>
          </div>

          <form onSubmit={handleAssignTeam} className="space-y-4 text-sm">
            {/* 1 & 2: Installation Job & Current Assignee(s) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* 1. Searchable Installation Job Combobox */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Installation Job <span className="text-destructive">*</span>
                </label>
                <Popover open={isAssignJobPopoverOpen} onOpenChange={setIsAssignJobPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="h-10 w-full justify-between font-normal bg-white border-slate-200 text-slate-800 hover:bg-slate-50 text-left"
                    >
                      {selectedJob ? (
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-semibold text-primary font-mono">
                            {formatInstallationTicketId(selectedJob)}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="truncate font-medium text-slate-900">
                            {selectedJob.customer?.full_name || selectedJob.non_btl_customer_name || "Unknown Customer"}
                          </span>
                          <span className="text-xs text-muted-foreground">({selectedJob.status})</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs sm:text-sm truncate">
                          Search by Ticket ID, Customer, Phone, or Equipment...
                        </span>
                      )}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[92vw] sm:w-[480px] max-w-[480px] p-0 shadow-lg border-slate-200" align="start">
                    <Command>
                      <CommandInput placeholder="Search ticket ID, customer name, phone, equipment..." />
                      <CommandList className="max-h-[320px] overflow-y-auto">
                        <CommandEmpty className="p-4 text-center text-xs text-muted-foreground">
                          No installation jobs found.
                        </CommandEmpty>
                        {installations.map((inst) => {
                          const ticketId = formatInstallationTicketId(inst);
                          const custName = inst.customer?.full_name || inst.non_btl_customer_name || "Walk-in Customer";
                          const phone = inst.customer?.phone || inst.non_btl_contact_number || "";
                          const equip = inst.equipment_details || "";
                          const brandText = inst.brand || "";
                          const isSelected = inst.id === assignInstallationId;

                          return (
                            <CommandItem
                              key={inst.id}
                              value={`${ticketId} ${custName} ${phone} ${equip} ${brandText} ${inst.status}`}
                              onSelect={() => {
                                setAssignInstallationId(inst.id);
                                setIsAssignJobPopoverOpen(false);
                              }}
                              className={`cursor-pointer px-3 py-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 ${isSelected ? "bg-primary/5 font-medium" : ""
                                }`}
                            >
                              <div className="flex flex-col w-full gap-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold text-xs text-primary font-mono">
                                    {ticketId}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${inst.status === "Assigned"
                                          ? "bg-blue-100 text-blue-700"
                                          : inst.status === "In Progress"
                                            ? "bg-amber-100 text-amber-700"
                                            : inst.status === "Completed"
                                              ? "bg-emerald-100 text-emerald-700"
                                              : "bg-slate-100 text-slate-700"
                                        }`}
                                    >
                                      {inst.status}
                                    </span>
                                    {inst.priority && (
                                      <span
                                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${inst.priority === "Critical"
                                            ? "bg-rose-100 text-rose-700"
                                            : inst.priority === "High"
                                              ? "bg-orange-100 text-orange-700"
                                              : "bg-slate-100 text-slate-600"
                                          }`}
                                      >
                                        {inst.priority}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between text-xs text-slate-800">
                                  <span className="font-semibold truncate">{custName}</span>
                                  {phone && <span className="text-muted-foreground text-[11px] shrink-0">📞 {phone}</span>}
                                </div>
                                {equip && (
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    ⚙️ {equip} {brandText ? `(${brandText})` : ""}
                                  </p>
                                )}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* 2. Current Assignee(s) (Read-only) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">Current Assignee(s)</label>
                <Input
                  value={currentAssigneesDisplay}
                  readOnly
                  disabled
                  title={currentAssigneesDisplay}
                  placeholder="— Select an installation job first —"
                  className="bg-slate-100 text-slate-800 font-semibold cursor-not-allowed border-slate-200 h-10 truncate"
                />
              </div>
            </div>

            {/* Assignment History Panel (For Supervisors/Admins) */}
            {selectedJob && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    Assignment History ({formatInstallationTicketId(selectedJob)})
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Status: <span className="text-primary font-bold">{selectedJob.status}</span>
                  </span>
                </div>

                {selectedJob.installation_technicians && selectedJob.installation_technicians.length > 0 ? (
                  <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                    {selectedJob.installation_technicians.map((it: any, idx: number) => {
                      const isLead = selectedJob.lead_technician_id === it.technician_id;
                      return (
                        <div key={it.id || idx} className="flex items-center justify-between text-xs bg-white p-2 rounded border border-slate-200 shadow-xs">
                          <div className="flex items-center gap-2">
                            {isLead ? <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> : <Wrench className="w-3.5 h-3.5 text-slate-400" />}
                            <span className="font-semibold text-slate-800">
                              {it.technician?.full_name || "Field Technician"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              ({isLead ? "Lead" : "Assisting"})
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>Assigned: {selectedJob.scheduled_date || "Recent"}</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 font-semibold text-[10px] text-slate-700">{selectedJob.status}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic py-0.5">
                    No past technician assignments on record for this job.
                  </p>
                )}
              </div>
            )}

            {/* 3. Assign To Checkboxes with Search Filter */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-700 block">
                  Assign To (Select Technicians) <span className="text-destructive">*</span>
                </label>
                <span className="text-[11px] font-medium text-primary">
                  {selectedTechnicianIds.length} selected
                </span>
              </div>

              {/* Search/Filter input box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search technician by name, ID, or expertise..."
                  value={assignTechSearch}
                  onChange={(e) => setAssignTechSearch(e.target.value)}
                  className="h-8 pl-8 text-xs bg-white border-slate-200"
                />
                {assignTechSearch && (
                  <button
                    type="button"
                    onClick={() => setAssignTechSearch("")}
                    className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-700 font-bold"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="border border-slate-200 rounded-md p-3 max-h-56 overflow-y-auto space-y-2 bg-slate-50/50">
                {isLoadingTechnicians ? (
                  <p className="text-xs text-muted-foreground p-2">Loading technicians...</p>
                ) : technicians.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2">No technicians found.</p>
                ) : (() => {
                  const filteredTechs = technicians.filter((tech: any) => {
                    if (!assignTechSearch.trim()) return true;
                    const q = assignTechSearch.toLowerCase();
                    return (
                      (tech.full_name || "").toLowerCase().includes(q) ||
                      (tech.technician_id || "").toLowerCase().includes(q) ||
                      (tech.expertise || "").toLowerCase().includes(q) ||
                      (tech.phone || "").toLowerCase().includes(q)
                    );
                  });

                  if (filteredTechs.length === 0) {
                    return <p className="text-xs text-muted-foreground p-2 text-center">No matching technicians found.</p>;
                  }

                  return filteredTechs.map((tech: any) => {
                    const isChecked = selectedTechnicianIds.includes(tech.id);
                    const isLead = isChecked && (tech.id === leadTechnicianId || (selectedTechnicianIds.length === 1 && selectedTechnicianIds[0] === tech.id));
                    const techIdDisplay = formatTechId(tech);
                    const desigDisplay = tech.designation || tech.expertise || "Field Technician";

                    return (
                      <label
                        key={tech.id}
                        className={`flex items-center justify-between p-2 rounded-md cursor-pointer text-xs transition-colors gap-2 ${isChecked
                            ? "bg-primary/10 border border-primary/30 text-primary font-semibold"
                            : "hover:bg-slate-100 border border-transparent text-slate-700"
                          }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            value={tech.id}
                            checked={isChecked}
                            onChange={(e) => handleTechToggle(tech.id, e.target.checked)}
                            className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer shrink-0"
                          />
                          <span className="truncate">
                            {tech.full_name} {techIdDisplay ? `(${techIdDisplay})` : ""} — {desigDisplay}
                          </span>
                        </div>

                        {isChecked && (
                          <div className="shrink-0 flex items-center">
                            {isLead ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 border border-amber-300">
                                <Crown className="w-3 h-3 text-amber-500 fill-amber-500" /> Lead Tech
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setLeadTechnicianId(tech.id);
                                }}
                                className="text-[10px] font-medium px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 text-slate-500 transition-colors"
                              >
                                Set as Lead
                              </button>
                            )}
                          </div>
                        )}
                      </label>
                    );
                  });
                })()}
              </div>

              {/* Designated Lead Summary Card */}
              {selectedTechnicianIds.length > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200 flex items-center justify-between text-xs mt-2">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-600 fill-amber-600" />
                    <span className="font-semibold text-amber-950">
                      Designated Lead Technician:{" "}
                      <strong>
                        {technicians.find((t: any) => t.id === (leadTechnicianId || selectedTechnicianIds[0]))?.full_name || "Lead Technician"}
                      </strong>
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-800 font-medium hidden sm:inline">
                    Responsible for field updates & completion
                  </span>
                </div>
              )}
            </div>

            {/* 4. Required Scheduled Date & Time (Single Unified Field) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Scheduled Date & Time <span className="text-destructive">*</span>
              </label>
              <Input
                type="datetime-local"
                required
                value={(() => {
                  if (!scheduledDate) return "";
                  const d = new Date(scheduledDate);
                  if (isNaN(d.getTime())) return "";
                  const pad = (n: number) => String(n).padStart(2, '0');
                  const yyyy = d.getFullYear();
                  const mm = pad(d.getMonth() + 1);
                  const dd = pad(d.getDate());
                  const time = scheduledTime ? (scheduledTime.length === 5 ? scheduledTime : scheduledTime.slice(0, 5)) : "09:00";
                  return `${yyyy}-${mm}-${dd}T${time}`;
                })()}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    setScheduledDate(null);
                    setScheduledTime("");
                    return;
                  }
                  const [datePart, timePart] = val.split("T");
                  if (datePart) {
                    const [y, m, d] = datePart.split("-").map(Number);
                    setScheduledDate(new Date(y, m - 1, d));
                  }
                  if (timePart) {
                    setScheduledTime(timePart);
                  }
                }}
                className="w-full bg-white border-slate-200 h-10 text-sm"
              />
            </div>

            {/* 5. Reassignment Reason */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-700 block">
                  Reassignment Reason
                  {isReassignmentReasonRequired && <span className="text-destructive ml-1">*</span>}
                </label>
                {isReassignmentReasonRequired && (
                  <span className="text-[10px] text-rose-600 font-semibold">
                    Required for team modifications
                  </span>
                )}
              </div>
              <Input
                value={reassignmentReason}
                onChange={(e) => setReassignmentReason(e.target.value)}
                placeholder="Reason for modifying or reassigning technician(s)..."
                required={isReassignmentReasonRequired}
                className={isReassignmentReasonRequired && !reassignmentReason.trim() ? "border-rose-300 bg-rose-50/30" : ""}
              />
            </div>

            <Button
              type="submit"
              disabled={isAssigning || !assignInstallationId || (isReassignmentReasonRequired && !reassignmentReason.trim())}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-sm h-10 disabled:opacity-50"
            >
              {isAssigning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating Assignments...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4 mr-2" /> Assign / Reassign Team
                </>
              )}
            </Button>
          </form>
        </Card>
      </div>

      {/* ==================================================== */}
      {/* SECTION C: Installation Jobs Table                   */}
      {/* ==================================================== */}
      <Card className="p-6 shadow-sm border border-slate-200 bg-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" /> Installation Jobs
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Overview of all active and completed equipment installations ({filteredInstallations.length} records)
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as "table" | "card")} className="bg-muted/60 p-0.5 rounded-lg border border-border/60 shrink-0">
              <ToggleGroupItem value="table" size="sm" className="text-[11px] font-semibold h-8 px-2.5 rounded-md data-[state=on]:bg-white data-[state=on]:shadow-sm">
                List View
              </ToggleGroupItem>
              <ToggleGroupItem value="card" size="sm" className="text-[11px] font-semibold h-8 px-2.5 rounded-md data-[state=on]:bg-white data-[state=on]:shadow-sm">
                Card View
              </ToggleGroupItem>
            </ToggleGroup>

            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket, customer, tech..."
                className="pl-9 h-9 text-xs"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48 h-9 text-xs">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt} className="text-xs">
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(searchQuery || statusFilter !== "All statuses") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-9 px-2.5 text-xs text-slate-500 hover:text-slate-800"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Clear
              </Button>
            )}

            {(isRole("admin", "supervisor")) && selectedInstallationIds.size > 0 && (
              <Button
                size="sm"
                onClick={handleBulkDeleteInstallations}
                disabled={isBulkDeleting}
                className="bg-red-600 hover:bg-red-700 text-white rounded-lg h-9 px-3 gap-1.5 font-bold shadow-sm text-xs shrink-0"
              >
                {isBulkDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Trash2 className="w-4 h-4 shrink-0" />
                )}
                <span>Delete {selectedInstallationIds.size} rows</span>
              </Button>
            )}
          </div>
        </div>

        {/* Selection Bar */}
        {(isRole("admin", "supervisor")) && selectedInstallationIds.size > 0 && (
          <div className="flex items-center justify-between p-3 bg-blue-50/80 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAllInstallations}
                className="text-slate-600 hover:text-slate-800"
              >
                {selectedInstallationIds.size === filteredInstallations.length ? (
                  <CheckSquare className="w-5 h-5 text-blue-600" />
                ) : (
                  <Square className="w-5 h-5" />
                )}
              </button>
              <span className="text-sm font-medium text-slate-700">
                {selectedInstallationIds.size} of {filteredInstallations.length} selected
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedInstallationIds(new Set())}
              className="text-xs text-slate-600 hover:text-slate-800"
            >
              Clear Selection
            </Button>
          </div>
        )}

        {/* Table Content */}
        {isLoadingInstallations ? (
          <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm font-medium">Loading installation records...</span>
          </div>
        ) : filteredInstallations.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground border-2 border-dashed rounded-xl">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-slate-700">No installation records found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or log a new installation above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {viewMode === "table" && (
              <div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                      <tr>
                        {(isAdmin || isTechnician) && <th className="py-3 px-4 w-10"></th>}
                        <th className="py-3 px-4">Ticket ID</th>
                        <th className="py-3 px-4">Customer & Site</th>
                        <th className="py-3 px-4">Technician(s)</th>
                        <th className="py-3 px-4">Scheduled Visit</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredInstallations.map((item) => {
                        const custName = item.customer?.full_name || item.non_btl_customer_name || "N/A";
                        const siteAddress =
                          item.location?.location_name ||
                          item.location?.address ||
                          item.non_btl_address ||
                          "Site address not specified";

                        const assignedTechs = (item.installation_technicians || []).map((it: any) => {
                          const t = it.technician || technicians.find((tech: any) => tech.id === it.technician_id);
                          return t?.full_name || t?.email || "Technician";
                        });

                        return (
                          <tr key={item.id} className={`hover:bg-slate-50/70 transition-colors ${selectedInstallationIds.has(item.id) ? 'bg-blue-50/60' : ''}`}>
                            {(isRole("admin", "supervisor")) && (
                              <td className="py-3 px-4">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSelectInstallation(item.id);
                                  }}
                                  className={`shrink-0 ${selectedInstallationIds.has(item.id) ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                  {selectedInstallationIds.has(item.id) ? (
                                    <CheckSquare className="w-4 h-4" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </button>
                              </td>
                            )}
                            {/* Ticket ID */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                onClick={() => navigate(`/installations/${item.id}`)}
                                className="font-mono font-bold text-primary hover:underline cursor-pointer"
                              >
                                {formatInstallationTicketId(item)}
                              </span>
                              <div className="mt-0.5">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${getPriorityBadgeStyle(item.priority)}`}>
                                  {item.priority}
                                </span>
                                {item.is_chargeable && (
                                  <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Chargeable
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Customer & Site */}
                            <td className="py-3 px-4 min-w-[180px]">
                              <div
                                className="flex items-center gap-1.5 flex-wrap cursor-pointer"
                                onClick={() => navigate(`/installations/${item.id}`)}
                              >
                                <span className="font-semibold text-slate-800 hover:text-primary transition-colors">{custName}</span>
                                {(!item.customer_id || item.customer_type !== "BTL") ? (
                                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-300">
                                    Walk-in / Non-BTL
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 border">
                                    BTL Customer
                                  </span>
                                )}
                              </div>
                               <p className="text-slate-500 text-[11px] break-words mt-0.5" title={siteAddress}>
                                 <MapPin className="w-3 h-3 inline mr-1 text-slate-400 shrink-0" />
                                 {siteAddress}
                               </p>
                            </td>

                            {/* Technicians */}
                            <td className="py-3 px-4">
                              {assignedTechs.length > 0 ? (
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {assignedTechs.map((name: string, i: number) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200"
                                    >
                                      <Wrench className="w-2.5 h-2.5" /> {name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-xs">Unassigned</span>
                              )}
                            </td>

                            {/* Scheduled Visit */}
                            <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                              {item.scheduled_date ? (
                                <div>
                                  <p className="font-medium flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    {new Date(`${item.scheduled_date}T00:00:00`).toLocaleDateString("en-IN", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </p>
                                  {item.scheduled_time && (
                                    <p className="text-slate-500 text-xs flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      {item.scheduled_time}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-xs">Not scheduled</span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeStyle(item.status)}`}>
                                {item.status}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* View Quick Modal */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setViewInstallation(item)}
                                  title="View Quick Details"
                                  className="h-8 w-8 p-0 text-slate-600 hover:text-primary hover:bg-slate-100"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>

                                {/* Full Workflow Page */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(`/installations/${item.id}`)}
                                  title="Open Full Execution & Verification Workflow"
                                  className="h-8 px-2.5 text-xs text-primary border-primary/30 bg-primary/5 hover:bg-primary/10 font-semibold gap-1"
                                >
                                  <Wrench className="w-3.5 h-3.5" /> Workflow
                                </Button>

                                {/* Edit Installation (Admin) */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenEdit(item)}
                                  title="Edit Installation Details"
                                  className="h-8 w-8 p-0 text-slate-600 hover:text-amber-600 hover:bg-amber-50"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>

                                {/* Quick Assign */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleQuickAssign(item)}
                                  title="Assign Technicians & Schedule"
                                  className="h-8 w-8 p-0 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                </Button>

                                {/* Navigate with Google Maps */}
                                {siteAddress && siteAddress !== "Site address not specified" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(siteAddress)}`, '_blank')}
                                    title="Navigate with Google Maps"
                                    className="h-8 px-2 text-xs text-emerald-700 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 gap-1 font-semibold"
                                  >
                                    <Navigation className="w-3 h-3 text-emerald-600" />
                                  </Button>
                                )}

                                {/* Delete Installation */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteConfirmId(item.id)}
                                  title="Delete Installation"
                                  className="h-8 w-8 p-0 text-slate-600 hover:text-rose-600 hover:bg-rose-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 text-center md:hidden">
                  Swipe horizontally to see more columns →
                </p>
              </div>
            )}

            {viewMode === "card" && (
              <div className="space-y-3">
                {filteredInstallations.map((item) => {
                  const custName = item.customer?.full_name || item.non_btl_customer_name || "N/A";
                  const siteAddress =
                    item.location?.location_name ||
                    item.location?.address ||
                    item.non_btl_address ||
                    "Site address not specified";

                  const assignedTechs = (item.installation_technicians || []).map((it: any) => {
                    const t = it.technician || technicians.find((tech: any) => tech.id === it.technician_id);
                    return t?.full_name || t?.email || "Technician";
                  });

                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-xl border shadow-sm space-y-2.5 transition-all ${
                        selectedInstallationIds.has(item.id)
                          ? 'bg-blue-50/60 border-blue-200'
                          : 'border-slate-200 bg-white hover:shadow'
                      }`}
                    >
                      {(isRole("admin", "supervisor")) && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectInstallation(item.id);
                            }}
                            className={`shrink-0 ${selectedInstallationIds.has(item.id) ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            {selectedInstallationIds.has(item.id) ? (
                              <CheckSquare className="w-5 h-5" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      )}
                      {/* Header: ID + Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span
                            onClick={() => navigate(`/installations/${item.id}`)}
                            className="font-mono font-bold text-sm text-primary hover:underline cursor-pointer"
                          >
                            {formatInstallationTicketId(item)}
                          </span>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${getPriorityBadgeStyle(item.priority)}`}>
                              {item.priority}
                            </span>
                            {item.is_chargeable && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Chargeable
                              </span>
                            )}
                            {(!item.customer_id || item.customer_type !== "BTL") ? (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 border border-amber-300">
                                Walk-in
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border">
                                BTL
                              </span>
                            )}
                          </div>
                        </div>
                         <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border truncate max-w-[140px] sm:max-w-none shrink-0 ${getStatusBadgeStyle(item.status)}`}>
                          {item.status}
                        </span>
                      </div>

                      {/* Customer & Address */}
                      <div
                        className="text-xs cursor-pointer"
                        onClick={() => navigate(`/installations/${item.id}`)}
                      >
                        <p className="font-semibold text-slate-900 hover:text-primary transition-colors">{custName}</p>
                         <p className="text-slate-500 text-[11px] mt-0.5 flex items-start gap-1">
                           <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                           <span className="break-words whitespace-normal">{siteAddress}</span>
                         </p>
                      </div>

                      {/* Technicians & Schedule */}
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        {item.scheduled_date ? (
                          <div className="flex items-center gap-1 text-slate-700 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {new Date(`${item.scheduled_date}T00:00:00`).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                              })}
                            </span>
                            {item.scheduled_time && (
                              <span className="text-slate-500 text-[10px]">({item.scheduled_time})</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not scheduled</span>
                        )}

                        <div className="flex items-center gap-1 flex-wrap">
                          {assignedTechs.length > 0 ? (
                            assignedTechs.slice(0, 2).map((name: string, i: number) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200"
                              >
                                <Wrench className="w-2 h-2" /> {name}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 italic text-[10px]">No tech</span>
                          )}
                          {assignedTechs.length > 2 && (
                            <span className="text-[9px] text-slate-400 font-medium">+{assignedTechs.length - 2}</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewInstallation(item)}
                            className="h-7 px-2 text-xs text-slate-600 hover:text-primary gap-1"
                          >
                            <Eye className="w-3 h-3" /> View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(item)}
                            className="h-7 px-2 text-xs text-amber-700 hover:bg-amber-50 gap-1"
                          >
                            <Edit2 className="w-3 h-3" /> Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleQuickAssign(item)}
                            className="h-7 px-2 text-xs text-indigo-700 hover:bg-indigo-50 gap-1"
                          >
                            <UserPlus className="w-3 h-3" /> Assign
                          </Button>
                        </div>

                        <div className="flex items-center gap-1">
                          {siteAddress && siteAddress !== "Site address not specified" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(siteAddress)}`, '_blank')}
                              className="h-7 px-2 text-xs text-emerald-700 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70"
                            >
                              <Navigation className="w-3 h-3 text-emerald-600" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/installations/${item.id}`)}
                            className="h-7 px-2 text-xs text-primary border-primary/30 bg-primary/5 hover:bg-primary/10 font-semibold gap-1"
                          >
                            <Wrench className="w-3 h-3" /> Workflow
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmId(item.id)}
                            className="h-7 px-1.5 text-xs text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ==================================================== */}
      {/* View Details Modal                                   */}
      {/* ==================================================== */}

      {/* Log New Installation — ~80% off-canvas */}
      <OffCanvasPanel
        open={isLogNewOpen}
        onClose={() => setIsLogNewOpen(false)}
        header={
          <>
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Plus className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-display font-bold text-slate-800">Log New Installation</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Create a new installation work order for BTL or walk-in clients.
              </p>
            </div>
          </>
        }
      >

          <form onSubmit={handleLogInstallation} className="space-y-4 text-sm">
            {/* 1. Customer Type Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Customer Type <span className="text-destructive">*</span>
              </label>
              <Select
                value={customerType}
                onValueChange={(val: any) => {
                  setCustomerType(val);
                }}
              >
                <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Select Customer Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Existing BTL Customer">Existing BTL Customer</SelectItem>
                  <SelectItem value="New / Non-BTL Customer">New / Non-BTL Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* CONDITIONAL: Existing BTL Customer */}
            {customerType === "Existing BTL Customer" ? (
              <div className="space-y-4 p-3.5 rounded-lg bg-slate-50/70 border border-slate-200/80">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Customer <span className="text-destructive">*</span>
                  </label>
                  <Popover open={isCustomerPopoverOpen && !isLoadingCustomers} onOpenChange={setIsCustomerPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className="h-10 w-full justify-between font-normal bg-white border-slate-200 text-slate-800 disabled:bg-slate-100 disabled:cursor-not-allowed hover:bg-slate-50"
                        disabled={isLoadingCustomers}
                      >
                        {selectedCustomerId ? (
                          <span className="truncate font-medium text-slate-900">
                            {customers.find((c: any) => c.id === selectedCustomerId)?.full_name || "Selected Customer"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs sm:text-sm">Search customer by name, phone, or email...</span>
                        )}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[92vw] sm:w-[420px] max-w-[420px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search customer by name, phone, or email..." />
                        <CommandList>
                          <CommandEmpty>No customer found.</CommandEmpty>
                          {customers.map((c: any) => (
                            <CommandItem
                              key={c.id}
                              value={`${c.full_name} ${c.phone || ''} ${c.email || ''}`}
                              onSelect={() => {
                                handleCustomerSelect(c.id);
                                setIsCustomerPopoverOpen(false);
                              }}
                            >
                              <div className="flex flex-col py-0.5">
                                <span className="font-semibold text-sm text-foreground">{c.full_name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {c.phone ? `📞 ${c.phone}` : ''} {c.email ? `• ${c.email}` : ''} {c.customer_type ? `(${c.customer_type})` : ''}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Site / Location
                  </label>
                  <select
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e.target.value)}
                    disabled={!selectedCustomerId || isLoadingLocations}
                    className="w-full h-10 px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-800 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    <option value="">-- Select Location --</option>
                    {locations.map((l: any) => (
                      <option key={l.id} value={l.id}>
                        {l.location_name}{l.city ? ` - ${l.city}` : ""}
                      </option>
                    ))}
                  </select>
                  {selectedCustomerId && locations.length === 0 && !isLoadingLocations && (
                    <p className="text-[11px] text-muted-foreground">
                      Note: Using primary customer registered address as no branch locations were found.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* CONDITIONAL: New / Non-BTL Customer */
              <div className="space-y-3.5 p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/80">
                {/* Smart Walk-in Alert Banner */}
                {showMatchAlert && matchedCustomer && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 rounded-xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-950 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md"
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-xs">
                          ⚠️ Existing Customer Profile Detected!
                        </p>
                        <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80 mt-0.5">
                          Phone number matches registered customer: <strong>{matchedCustomer.full_name}</strong> ({matchedCustomer.phone}). Do you want to link this installation to their registered account instead?
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleConvertToRegistered(matchedCustomer)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-7 px-3 shadow-sm rounded-lg flex-1 sm:flex-none"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Yes, Switch to Registered
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowMatchAlert(false)}
                        className="text-xs h-7 px-2 text-slate-600 hover:text-slate-900 rounded-lg"
                      >
                        No, Keep as Walk-in
                      </Button>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Customer Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={nonBtlName}
                    onChange={(e) => setNonBtlName(e.target.value)}
                    placeholder="Customer / Site Contact Name"
                    className="bg-white border-slate-200"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Contact Number <span className="text-destructive">*</span></span>
                    {isCheckingPhone && (
                      <span className="text-[10px] text-primary flex items-center gap-1 font-semibold">
                        <Loader2 className="w-3 h-3 animate-spin" /> Checking customer database...
                      </span>
                    )}
                  </label>
                  <Input
                    type="tel"
                    value={nonBtlContact}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNonBtlContact(val);
                      if (val.replace(/\D/g, '').length >= 10) {
                        checkExistingCustomerPhone(val);
                      }
                    }}
                    onBlur={(e) => checkExistingCustomerPhone(e.target.value)}
                    placeholder="Contact Number (e.g., +91 9876543210)"
                    className="bg-white border-slate-200"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Installation Site / Address <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={nonBtlAddress}
                    onChange={(e) => setNonBtlAddress(e.target.value)}
                    placeholder="Full site address"
                    className="bg-white border-slate-200"
                    required
                  />
                </div>
              </div>
            )}

            {/* Equipment to Install and Brand / Make */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Equipment to Install <span className="text-destructive">*</span>
                </label>
                <Input
                  value={equipmentDetails}
                  onChange={(e) => setEquipmentDetails(e.target.value)}
                  placeholder="Models, quantity, scope (e.g., 4x CCTV Cameras)"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Brand / Make
                </label>
                <Input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g., Hikvision, Schneider, Luminous"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">Priority</label>
                <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                  <SelectTrigger className="w-full bg-white border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Critical">Critical</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">Chargeable</label>
                <Select value={isChargeable} onValueChange={(val: any) => setIsChargeable(val)}>
                  <SelectTrigger className="w-full bg-white border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="No">No (Included in Scope)</SelectItem>
                    <SelectItem value="Yes">Yes (Billable)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Conditional Service Charge Amount Field */}
            {isChargeable === "Yes" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Service Charge Amount (₹) <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter amount (e.g. 500)"
                  value={serviceCharge}
                  onChange={(e) => setServiceCharge(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                  className="bg-white border-slate-200 font-medium"
                  required
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">Installation Notes</label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any specific site requirements, gate pass details, electrical arrangements..."
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full gradient-primary text-white font-semibold shadow-sm h-10"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Logging Installation...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4 mr-2" /> Log Installation
                </>
              )}
            </Button>
          </form>
        
      </OffCanvasPanel>

      <OffCanvasPanel
        open={!!viewInstallation}
        onClose={() => setViewInstallation(null)}
        bodyClassName="!px-0 !py-0"
        header={
          <div className="min-w-0 pr-2">
            <h3 className="text-xl font-display font-bold text-slate-800">Installation Details</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {viewInstallation ? formatInstallationTicketId(viewInstallation) : ""}
            </p>
          </div>
        }
      >
          {viewInstallation && (
            <div className="flex flex-col">
              {/* Premium Header Banner */}
              <div className="p-5 sm:p-6 bg-slate-900 text-white border-b border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-sm sm:text-base font-bold px-3 py-1 rounded-lg bg-primary/20 text-sky-200 border border-primary/30 shadow-inner">
                      {formatInstallationTicketId(viewInstallation)}
                    </span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getStatusBadgeStyle(viewInstallation.status)}`}>
                      {viewInstallation.status}
                    </span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border uppercase ${getPriorityBadgeStyle(viewInstallation.priority)}`}>
                      Priority: {viewInstallation.priority}
                    </span>
                    {viewInstallation.is_chargeable ? (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        Chargeable (Billable Service)
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        Standard Scope
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mt-3">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      Installation Work Order & Dispatch
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                      Created on {viewInstallation.created_at ? new Date(viewInstallation.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "N/A"}
                    </p>
                  </div>
                  <div className="text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">Customer Class:</span>{" "}
                    {(!viewInstallation.customer_id || viewInstallation.customer_type !== "BTL") ? (
                      <span className="text-amber-300 font-bold">Direct / Non-BTL Client</span>
                    ) : (
                      <span className="text-sky-300 font-bold">Registered BTL Customer</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 🚀 Technician Mission Control Bar (Technicians Only) */}
              {isTechnician && (
                <div className="p-4 sm:p-5 bg-slate-900/95 border-b border-slate-800">
                  <TechnicianMissionControl
                    ticketType="installation"
                    ticketId={viewInstallation.id}
                    ticketDisplayId={formatInstallationTicketId(viewInstallation)}
                    customerName={viewInstallation.customer?.full_name || viewInstallation.non_btl_customer_name || "Client"}
                    customerPhone={viewInstallation.customer?.phone || viewInstallation.non_btl_contact_number || ""}
                    locationAddress={viewInstallation.location?.address || viewInstallation.non_btl_address || ""}
                    isLeadOrAdmin={true}
                    onArrivalLogged={() => {
                      queryClient.invalidateQueries({ queryKey: ["installations-list"] });
                    }}
                  />
                </div>
              )}

              {/* 2-Column Spacious Grid */}
              <div className="p-5 sm:p-6 bg-slate-50/60 grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* LEFT COLUMN: Customer, Site, Equipment Details (7 Cols) */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Customer & Contact Details Card */}
                  <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <h3 className="font-bold text-slate-800 text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
                        <User className="w-4 h-4 text-primary" /> Customer & Contact Details
                      </h3>
                      {(!viewInstallation.customer_id || viewInstallation.customer_type !== "BTL") ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Walk-in / Non-BTL
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                          Verified BTL Account
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-muted-foreground block text-[11px] uppercase font-semibold">Client Name</span>
                        <span className="font-bold text-base text-slate-900 block mt-0.5">
                          {viewInstallation.customer?.full_name || viewInstallation.non_btl_customer_name || "N/A"}
                        </span>
                        <span className="text-xs text-slate-500 block mt-0.5">
                          Classification: {viewInstallation.customer_type || "Direct Client"}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground block text-[11px] uppercase font-semibold">Contact Phone</span>
                        {viewInstallation.customer?.phone || viewInstallation.non_btl_contact_number ? (
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-bold text-base text-slate-900">
                              {viewInstallation.customer?.phone || viewInstallation.non_btl_contact_number}
                            </span>
                            <a
                              href={`tel:${(viewInstallation.customer?.phone || viewInstallation.non_btl_contact_number || "").replace(/\D/g, "")}`}
                              className="p-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                              title="Call Client"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                            <ManualWhatsAppButton
                              stage={
                                viewInstallation.status === "closed" || viewInstallation.status === "Closed" ? "closed" :
                                  viewInstallation.status === "completed" ? "technician_signoff" :
                                    viewInstallation.status === "Assigned" ? "field_visit_scheduled" : "creation"
                              }
                              ticket={viewInstallation}
                              ticketType="installation"
                              buttonVariant="icon"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Not provided</span>
                        )}
                        {viewInstallation.customer?.email && (
                          <span className="text-xs text-slate-500 block truncate mt-0.5">
                            {viewInstallation.customer.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Site Location & Turn-by-Turn GPS Card */}
                  {(() => {
                    const resolvedAddress = viewInstallation.location?.address || viewInstallation.non_btl_address || "";
                    const resolvedLocName = viewInstallation.location?.location_name || "";
                    const fullAddressDisplay = [resolvedLocName, resolvedAddress].filter(Boolean).join(" — ") || "No site address specified";

                    return (
                      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <h3 className="font-bold text-slate-800 text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-rose-500" /> Site Location & Navigation
                          </h3>
                          {resolvedAddress && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              GPS Turn-by-Turn Ready
                            </span>
                          )}
                        </div>

                        <p className="text-slate-800 font-medium text-xs sm:text-sm bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed">
                          {fullAddressDisplay}
                        </p>

                        {resolvedAddress && (
                          <div className="flex flex-wrap items-center gap-2.5 pt-1">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resolvedAddress)}`;
                                window.open(mapsUrl, "_blank");
                                toast.success("Opening Google Maps Navigation...");
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-3.5 gap-1.5 shadow-sm rounded-lg"
                            >
                              <Navigation className="w-3.5 h-3.5" /> Navigate (Google Maps)
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(fullAddressDisplay);
                                toast.success("Address copied to clipboard!");
                              }}
                              className="text-xs h-9 px-3 gap-1.5 rounded-lg text-slate-700 hover:bg-slate-100"
                            >
                              <Copy className="w-3.5 h-3.5" /> Copy Address
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Equipment to Install Card */}
                  <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <h3 className="font-bold text-slate-800 text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
                        <Package className="w-4 h-4 text-primary" /> Equipment to Install & Scope
                      </h3>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded border ${viewInstallation.is_chargeable
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>
                        {viewInstallation.is_chargeable ? "Billable Service" : "Standard Scope"}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <p className="text-slate-800 font-medium text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                        {viewInstallation.equipment_details || "No equipment scope specified"}
                      </p>
                    </div>

                    {viewInstallation.brand && (
                      <div className="text-xs text-slate-600 flex items-center gap-2">
                        <span className="font-semibold text-slate-700">Brand / Make:</span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-medium">
                          {viewInstallation.brand}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Notes & Special Instructions */}
                  {viewInstallation.notes && (
                    <div className="bg-amber-50/50 rounded-xl p-4 sm:p-5 border border-amber-200/80 shadow-sm space-y-2">
                      <h3 className="font-bold text-amber-900 text-xs uppercase tracking-wider flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-600" /> Site Notes & Special Instructions
                      </h3>
                      <p className="text-slate-800 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                        {viewInstallation.notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN: Field Crew, Schedule, Job Status Update (5 Cols) */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Assigned Technicians Card */}
                  <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <h3 className="font-bold text-slate-800 text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-primary" /> Assigned Field Crew
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {viewInstallation.installation_technicians?.length || 0} Assigned
                      </span>
                    </div>

                    {viewInstallation.installation_technicians && viewInstallation.installation_technicians.length > 0 ? (
                      <div className="space-y-2">
                        {viewInstallation.installation_technicians.map((it: any) => {
                          const t = it.technician || technicians.find((tech: any) => tech.id === it.technician_id);
                          const isLead = viewInstallation.lead_technician_id === it.technician_id;

                          return (
                            <div key={it.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5 truncate">
                                  {isLead && <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                                  <span className="truncate">{t?.full_name || t?.email || "Technician"}</span>
                                  {isLead && (
                                    <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded shrink-0">
                                      Lead
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                  {t?.phone || t?.email || "No phone available"}
                                </p>
                              </div>
                              <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 shrink-0">
                                {t?.technician_id || t?.employee_id || "TECH"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-5 border border-dashed rounded-lg bg-slate-50/50">
                        <Wrench className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                        <p className="text-xs text-slate-500 font-medium">No technicians assigned yet.</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Assign technicians from Section B above.</p>
                      </div>
                    )}

                    {viewInstallation.reassignment_reason && (
                      <div className="p-3 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-xs">
                        <strong className="block font-bold mb-0.5">Reassignment Reason:</strong>
                        <p>{viewInstallation.reassignment_reason}</p>
                      </div>
                    )}
                  </div>

                  {/* Scheduled Window Card */}
                  <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
                    <h3 className="font-bold text-slate-800 text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2.5">
                      <Calendar className="w-4 h-4 text-primary" /> Scheduled Visit Window
                    </h3>

                    {viewInstallation.scheduled_date ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Date</span>
                          <span className="font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-primary" />
                            {new Date(`${viewInstallation.scheduled_date}T00:00:00`).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Time Slot</span>
                          <span className="font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-primary" />
                            {viewInstallation.scheduled_time || "Flexible"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 border border-dashed rounded-lg bg-slate-50/50">
                        <Calendar className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                        <p className="text-xs text-slate-500 font-medium">No visit date scheduled</p>
                      </div>
                    )}
                  </div>

                  {/* Quick Status Update Card */}
                  <div className="bg-blue-50/50 rounded-xl p-4 sm:p-5 border border-blue-200/80 shadow-sm space-y-3">
                    <h3 className="font-bold text-slate-800 text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 border-b border-blue-100 pb-2.5">
                      <CheckCircle2 className="w-4 h-4 text-blue-600" /> Update Job Status
                    </h3>

                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-slate-600 block">
                        Lifecycle Stage
                      </label>
                      <div className="flex items-center gap-2">
                        <Select
                          value={viewInstallation.status}
                          onValueChange={handleUpdateStatus}
                          disabled={modalUpdatingStatus}
                        >
                          <SelectTrigger className="w-full bg-white h-10 text-xs font-semibold shadow-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.filter((s) => s !== "All statuses").map((status) => (
                              <SelectItem key={status} value={status} className="text-xs font-medium">
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {modalUpdatingStatus && (
                          <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Changing status synchronizes live across technician apps and dashboard KPI feeds.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dialog Footer */}
              <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const ticketIdStr = formatInstallationTicketId(viewInstallation);
                    navigator.clipboard.writeText(ticketIdStr);
                    toast.success(`Copied ticket ID ${ticketIdStr}`);
                  }}
                  className="text-xs h-9 gap-1.5 text-slate-600 hover:text-slate-900"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Ticket ID
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const instId = viewInstallation.id;
                      setViewInstallation(null);
                      navigate(`/installations/${instId}`);
                    }}
                    className="text-xs h-9 gap-1.5 text-primary border-primary/40 hover:bg-primary/5 font-semibold"
                  >
                    <Wrench className="w-3.5 h-3.5" /> Open Workflow
                  </Button>

                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setViewInstallation(null)}
                    className="text-xs h-9 px-5 font-bold"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
      </OffCanvasPanel>

      {/* ==================================================== */}
      {/* Edit Installation Modal (Admin)                      */}
      {/* ==================================================== */}
      <OffCanvasPanel
        open={!!editInstallation}
        onClose={() => setEditInstallation(null)}
        header={
          <div className="min-w-0 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Edit2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-display font-bold text-slate-800">
                Edit Installation {editInstallation ? formatInstallationTicketId(editInstallation) : ""}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Update installation details, customer information, equipment scope, charges, and lifecycle status.
              </p>
            </div>
          </div>
        }
        footer={
          editInstallation ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl h-11 font-bold text-sm"
                onClick={() => setEditInstallation(null)}
                disabled={isSavingEdit}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="edit-installation-form"
                className="flex-1 gradient-primary text-primary-foreground shadow-glow rounded-xl h-11 font-bold text-sm"
                disabled={isSavingEdit}
              >
                {isSavingEdit ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </>
          ) : null
        }
      >
{editInstallation && (
            <form id="edit-installation-form" onSubmit={handleSaveEdit} className="space-y-4 text-sm">
              {/* Customer Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Customer Classification</label>
                  <Select
                    value={editFormData.customer_type}
                    onValueChange={(val) => setEditFormData((prev: any) => ({ ...prev, customer_type: val }))}
                  >
                    <SelectTrigger className="w-full text-xs font-medium bg-slate-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Existing BTL Customer">Existing BTL Customer</SelectItem>
                      <SelectItem value="New / Non-BTL Customer">New / Non-BTL Customer (Walk-in)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Status</label>
                  <Select
                    value={editFormData.status}
                    onValueChange={(val) => setEditFormData((prev: any) => ({ ...prev, status: val }))}
                  >
                    <SelectTrigger className="w-full text-xs font-medium bg-slate-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.filter((s) => s !== "All statuses").map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Non-BTL Customer info if Walk-in */}
              {editFormData.customer_type !== "Existing BTL Customer" && (
                <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/80 space-y-3">
                  <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">
                    Walk-in Customer Contact Info
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-700 block mb-1">Customer Name</label>
                      <Input
                        value={editFormData.non_btl_customer_name || ""}
                        onChange={(e) => setEditFormData((prev: any) => ({ ...prev, non_btl_customer_name: e.target.value }))}
                        className="text-xs bg-white"
                        placeholder="Client Full Name"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700 block mb-1">Contact Phone</label>
                      <Input
                        value={editFormData.non_btl_contact_number || ""}
                        onChange={(e) => setEditFormData((prev: any) => ({ ...prev, non_btl_contact_number: e.target.value }))}
                        className="text-xs bg-white"
                        placeholder="10-digit Phone Number"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">Installation Site Address</label>
                    <Textarea
                      value={editFormData.non_btl_address || ""}
                      onChange={(e) => setEditFormData((prev: any) => ({ ...prev, non_btl_address: e.target.value }))}
                      className="text-xs bg-white resize-none"
                      rows={2}
                      placeholder="Complete Site Address, Landmark, City"
                    />
                  </div>
                </div>
              )}

              {/* Equipment & Brand */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Equipment Scope / Details</label>
                  <Input
                    value={editFormData.equipment_details || ""}
                    onChange={(e) => setEditFormData((prev: any) => ({ ...prev, equipment_details: e.target.value }))}
                    className="text-xs bg-slate-50"
                    placeholder="e.g. 4-Ch IP CCTV System, Biometric Reader"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Brand / OEM</label>
                  <Input
                    value={editFormData.brand || ""}
                    onChange={(e) => setEditFormData((prev: any) => ({ ...prev, brand: e.target.value }))}
                    className="text-xs bg-slate-50"
                    placeholder="e.g. Hikvision, Dahua, CP Plus, Matrix"
                  />
                </div>
              </div>

              {/* Priority & Financials */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Priority</label>
                  <Select
                    value={editFormData.priority}
                    onValueChange={(val) => setEditFormData((prev: any) => ({ ...prev, priority: val }))}
                  >
                    <SelectTrigger className="w-full text-xs font-medium bg-slate-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Critical">Critical</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Chargeable Service?</label>
                  <Select
                    value={editFormData.is_chargeable}
                    onValueChange={(val) => setEditFormData((prev: any) => ({ ...prev, is_chargeable: val }))}
                  >
                    <SelectTrigger className="w-full text-xs font-medium bg-slate-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="No">No (Included / Free)</SelectItem>
                      <SelectItem value="Yes">Yes (Billable)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Service Charge (₹)</label>
                  <Input
                    type="number"
                    value={editFormData.service_charge ?? ""}
                    onChange={(e) => setEditFormData((prev: any) => ({ ...prev, service_charge: e.target.value }))}
                    disabled={editFormData.is_chargeable !== "Yes"}
                    className="text-xs bg-slate-50 disabled:opacity-50"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Scope Notes */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Scope & Instructions</label>
                <Textarea
                  value={editFormData.notes || ""}
                  onChange={(e) => setEditFormData((prev: any) => ({ ...prev, notes: e.target.value }))}
                  className="text-xs bg-slate-50 resize-none"
                  rows={3}
                  placeholder="Deployment instructions, material specs, or cabling details..."
                />
              </div>

</form>
          )}
      </OffCanvasPanel>

      {/* ==================================================== */}
      {/* Delete Confirmation Dialog (Admin)                   */}
      {/* ==================================================== */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-md p-6 rounded-2xl border border-slate-200 shadow-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" /> Confirm Deletion
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 mt-2">
              Are you sure you want to delete this installation record? This will also remove any assigned technician linkages. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmId(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleDeleteInstallation}
              className="text-xs font-semibold"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Deleting...
                </>
              ) : (
                "Yes, Delete Record"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
