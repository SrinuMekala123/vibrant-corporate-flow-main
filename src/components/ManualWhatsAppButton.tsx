import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Send, ExternalLink, Phone, User, Users, Shield, MessageSquare, Sparkles, CheckCircle2 } from "lucide-react";
import {
  sendWhatsAppMessage,
  getCustomerPhone,
  getCustomerName,
  getComplaintCreatedMessage,
  getRemoteResolutionMessage,
  getFieldVisitScheduledMessage,
  getTechnicianSignOffMessage,
  getComplaintClosedMessage,
  getInstallationCreatedMessage,
  getInstallationScheduledMessage,
  getInstallationSignOffMessage,
  getInstallationClosedMessage,
  getTicketFullSummaryMessage,
} from "@/utils/whatsappService";
import { whatsappTemplates } from "@/utils/whatsappTemplates";
import { formatComplaintTicketId } from "@/services/complaintService";
import { formatInstallationTicketId } from "@/services/installationService";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export type WhatsAppStage =
  | "creation"
  | "remote_resolution"
  | "field_visit_scheduled"
  | "reassign_old_tech"
  | "reassign_new_tech"
  | "journey_started"
  | "resolution_submitted"
  | "technician_signoff"
  | "closed"
  | "summary";

export type RecipientType = "customer" | "technician" | "admin";

export interface ManualWhatsAppButtonProps {
  stage?: WhatsAppStage;
  ticket: any;
  ticketType?: "complaint" | "installation";
  customTechnicianName?: string;
  customScheduledDate?: string;
  customScheduledTime?: string;
  customHappinessCode?: string;
  customEquipmentType?: string;
  buttonVariant?: "icon" | "button" | "badge" | "outline";
  buttonText?: string;
  className?: string;
  size?: "xs" | "sm" | "default";
  title?: string;
}

// WhatsApp Brand Icon (SVG)
export function WhatsAppIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM12.05 20.15C10.56 20.15 9.11 19.76 7.85 19.01L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.81 13.47 3.81 11.91C3.81 7.37 7.5 3.68 12.04 3.68C14.25 3.68 16.31 4.54 17.87 6.1C19.42 7.66 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.05 20.15ZM16.57 14.33C16.32 14.2 15.1 13.6 14.87 13.52C14.65 13.43 14.48 13.39 14.32 13.64C14.15 13.89 13.68 14.44 13.53 14.61C13.39 14.77 13.24 14.8 12.99 14.67C12.74 14.55 11.94 14.28 10.99 13.44C10.25 12.78 9.75 11.96 9.61 11.71C9.46 11.46 9.59 11.33 9.72 11.2C9.83 11.09 9.97 10.91 10.09 10.77C10.22 10.63 10.26 10.52 10.34 10.36C10.42 10.19 10.38 10.05 10.32 9.92C10.26 9.8 9.76 8.58 9.55 8.08C9.35 7.59 9.15 7.65 9 7.65C8.86 7.64 8.7 7.64 8.53 7.64C8.36 7.64 8.09 7.7 7.86 7.95C7.64 8.2 7 8.79 7 10C7 11.21 7.88 12.38 8 12.54C8.13 12.71 9.73 15.17 12.18 16.23C12.76 16.48 13.22 16.63 13.57 16.74C14.16 16.93 14.7 16.9 15.12 16.84C15.6 16.77 16.58 16.24 16.79 15.67C16.99 15.09 16.99 14.6 16.93 14.5C16.87 14.4 16.72 14.34 16.57 14.33Z" />
    </svg>
  );
}

export function ManualWhatsAppButton({
  stage,
  ticket,
  ticketType = "complaint",
  customTechnicianName,
  customScheduledDate,
  customScheduledTime,
  customHappinessCode,
  customEquipmentType,
  buttonVariant = "icon",
  buttonText,
  className,
  size = "sm",
  title,
}: ManualWhatsAppButtonProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [recipientType, setRecipientType] = useState<RecipientType>("customer");
  const [targetPhone, setTargetPhone] = useState("");
  const [targetName, setTargetName] = useState("");
  const [messageText, setMessageText] = useState("");
  const [activeStage, setActiveStage] = useState<WhatsAppStage>("creation");

  // Technician & Admin state
  const [techniciansList, setTechniciansList] = useState<Array<{ id: string; name: string; phone: string; is_lead?: boolean }>>([]);
  const [selectedTechId, setSelectedTechId] = useState<string>("");
  const [adminsList, setAdminsList] = useState<Array<{ id: string; name: string; phone: string }>>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>("");

  const userRole = (user as any)?.role || "user";
  const isAdminOrSupervisor = ["admin", "superadmin", "supervisor"].includes(userRole);
  const isTechnician = userRole === "technician";

  // Check if current user is lead technician
  const isLeadTechnician = isTechnician && (
    (ticket?.complaint_technicians && ticket.complaint_technicians.some((ct: any) => ct.technician_id === user?.id && ct.is_lead)) ||
    (!ticket?.complaint_technicians?.length && ticket?.assigned_to === user?.id)
  );

  const slicedId =
    ticketType === "installation"
      ? formatInstallationTicketId(ticket)
      : formatComplaintTicketId(ticket);

  const rawCustPhone = getCustomerPhone(ticket);
  const rawCustName = getCustomerName(ticket);

  // Load Technicians and Admins phone numbers when dialog opens
  useEffect(() => {
    if (!isOpen) return;

    // 1. Fetch technicians from junction or ticket
    const loadTechs = async () => {
      const techs: Array<{ id: string; name: string; phone: string; is_lead?: boolean }> = [];
      if (ticket?.complaint_technicians && ticket.complaint_technicians.length > 0) {
        for (const ct of ticket.complaint_technicians) {
          const tid = ct.technician_id;
          const tName = ct.technician?.full_name || "Technician";
          let tPhone = ct.technician?.phone || "";
          if (!tPhone && tid) {
            const { data: prof } = await supabase.from("profiles").select("phone, full_name").eq("id", tid).maybeSingle();
            if (prof) {
              tPhone = prof.phone || "";
            }
          }
          techs.push({
            id: tid,
            name: tName,
            phone: tPhone,
            is_lead: Boolean(ct.is_lead),
          });
        }
      } else if (ticket?.assigned_to) {
        const { data: prof } = await supabase.from("profiles").select("id, full_name, phone").eq("id", ticket.assigned_to).maybeSingle();
        if (prof) {
          techs.push({
            id: prof.id,
            name: prof.full_name || ticket?.assigned_technician || "Technician",
            phone: prof.phone || "",
            is_lead: true,
          });
        }
      } else if (ticket?.assigned_technician) {
        techs.push({
          id: "temp-1",
          name: ticket.assigned_technician,
          phone: "",
          is_lead: true,
        });
      }
      setTechniciansList(techs);
      if (techs.length > 0 && !selectedTechId) {
        setSelectedTechId(techs[0].id);
      }
    };

    // 2. Fetch admins & supervisor
    const loadAdmins = async () => {
      const adms: Array<{ id: string; name: string; phone: string }> = [];
      // Supervisor assigned to this ticket first
      if (ticket?.assigned_supervisor) {
        const { data: supProf } = await supabase
          .from("profiles")
          .select("id, full_name, phone")
          .ilike("full_name", `%${ticket.assigned_supervisor}%`)
          .maybeSingle();
        if (supProf && supProf.phone) {
          adms.push({ id: supProf.id, name: `${supProf.full_name} (Supervisor)`, phone: supProf.phone });
        }
      }

      // System admins
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .eq("role", "admin")
        .not("phone", "is", null);

      if (adminProfiles) {
        for (const ap of adminProfiles) {
          if (!adms.some((a) => a.id === ap.id) && ap.phone) {
            adms.push({ id: ap.id, name: `${ap.full_name || "Admin"} (Admin)`, phone: ap.phone });
          }
        }
      }

      setAdminsList(adms);
      if (adms.length > 0 && !selectedAdminId) {
        setSelectedAdminId(adms[0].id);
      }
    };

    loadTechs();
    loadAdmins();
  }, [isOpen, ticket]);

  // Compute intelligent default stage based on current ticket state
  const resolveDefaultStage = (recType: RecipientType): WhatsAppStage => {
    if (stage) return stage;

    if (ticketType === "installation") {
      if (ticket?.status === "closed" || ticket?.status === "force_closed" || ticket?.force_closed) return "closed";
      if (ticket?.status === "completed" || ticket?.current_phase >= 5) return "technician_signoff";
      if (ticket?.status === "Assigned" || ticket?.current_phase >= 2 || ticket?.scheduled_date) return "field_visit_scheduled";
      return "creation";
    }

    // Complaints logic
    if (recType === "customer") {
      if (ticket?.status === "closed" || ticket?.current_phase >= 6) return "closed";
      if (ticket?.current_phase >= 5 || ticket?.happiness_code) return "resolution_submitted";
      if (ticket?.resolution_type === "remote_fixed" || ticket?.status === "resolved_remotely") return "remote_resolution";
      if (ticket?.status === "in_progress" || ticket?.status === "in-progress" || ticket?.current_phase >= 4) return "journey_started";
      if (ticket?.current_phase >= 3 || ticket?.status === "assigned" || ticket?.scheduled_date) return "field_visit_scheduled";
      return "creation";
    } else if (recType === "technician") {
      if (ticket?.reassignment_reason || ticket?.status === "rework_required") return "reassign_new_tech";
      return "field_visit_scheduled";
    } else {
      // admin
      if (ticket?.current_phase >= 5) return "resolution_submitted";
      return "journey_started";
    }
  };

  // Helper variables for template construction
  const getTechName = () => {
    return (
      customTechnicianName ||
      ticket?.assigned_technician ||
      ticket?.technician_name ||
      techniciansList[0]?.name ||
      "Technician"
    );
  };

  const getFormattedDate = () => {
    return (
      customScheduledDate ||
      (ticket?.scheduled_date
        ? new Date(`${ticket.scheduled_date}T00:00:00`).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "the scheduled date")
    );
  };

  const getFormattedTime = () => {
    return (
      customScheduledTime ||
      (ticket?.scheduled_time ? ticket.scheduled_time.slice(0, 5) : "10:00 AM")
    );
  };

  const getHappinessCodeVal = () => {
    return (
      customHappinessCode ||
      ticket?.happiness_code ||
      ticket?.walk_in_happiness_code ||
      "XXXXX"
    );
  };

  const getLocationDisplay = () => {
    return (
      ticket?.location ||
      ticket?.installation_site_address ||
      ticket?.address ||
      ticket?.customer_address ||
      ticket?.site_address ||
      "Customer Site"
    );
  };

  // Standard Template Generator matching the 9-stage matrix and requirements
  const generateTemplate = (stg: WhatsAppStage, recType: RecipientType, currentRecipientName: string): string => {
    const techName = getTechName();
    const sDate = getFormattedDate();
    const sTime = getFormattedTime();
    const hpCode = getHappinessCodeVal();
    const loc = getLocationDisplay();
    const custName = rawCustName || "Customer";

    if (stg === "summary") {
      return getTicketFullSummaryMessage({
        ticketType,
        ticketId: slicedId,
        customerName: custName,
        titleOrEquipment: ticket?.title || ticket?.brand || "Service Request",
        status: ticket?.status,
        phase: ticket?.current_phase,
        technicianName: techName,
        scheduledDate: sDate !== "the scheduled date" ? sDate : undefined,
        scheduledTime: sTime !== "10:00 AM" ? sTime : undefined,
        happinessCode: hpCode !== "XXXXX" ? hpCode : undefined,
        location: loc !== "Customer Site" ? loc : undefined,
        notes: ticket?.resolution_notes || ticket?.description || undefined,
      });
    }

    if (ticketType === "installation") {
      switch (stg) {
        case "creation":
          return getInstallationCreatedMessage({ customerName: custName, ticketId: slicedId, equipmentType: "Equipment" });
        case "field_visit_scheduled":
          return getInstallationScheduledMessage({ customerName: custName, technicianName: techName, ticketId: slicedId, scheduledDate: sDate, scheduledTime: sTime });
        case "technician_signoff":
          return getInstallationSignOffMessage({ customerName: custName, ticketId: slicedId, happinessCode: hpCode });
        case "closed":
          return getInstallationClosedMessage({ customerName: custName, ticketId: slicedId });
        default:
          return getInstallationCreatedMessage({ customerName: custName, ticketId: slicedId, equipmentType: "Equipment" });
      }
    }

    // Complaints template resolution based on Recipient Type & Stage:
    if (recType === "customer") {
      switch (stg) {
        case "creation":
          return whatsappTemplates.complaintCreatedCustomer({ customerName: currentRecipientName || custName, ticketId: slicedId });
        case "remote_resolution":
          return `Dear ${currentRecipientName || custName}, your complaint #${slicedId} has been resolved remotely. Your Happiness Code is: ${hpCode}. Please share this with our supervisor. - Brihaspathi Technologies`;
        case "field_visit_scheduled":
          return `Dear ${currentRecipientName || custName}, Technician ${techName} has been assigned to your complaint #${slicedId}. The site visit is scheduled for ${sDate} at ${sTime}. - Brihaspathi Technologies`;
        case "reassign_old_tech":
        case "reassign_new_tech":
          return `Update: Your visit for complaint #${slicedId} has been rescheduled. Technicians: ${techName}. Scheduled: ${sDate} at ${sTime}. - Brihaspathi Technologies`;
        case "journey_started":
          return `Your technician ${techName} has started their journey to your location for complaint #${slicedId}. - Brihaspathi Technologies`;
        case "resolution_submitted":
        case "technician_signoff":
          return `Work completed for #${slicedId}! Your Happiness Code is: ${hpCode}. Please share this with our supervisor. - Brihaspathi Technologies`;
        case "closed":
          return `Your complaint #${slicedId} has been successfully closed. Thank you for choosing Brihaspathi!`;
        default:
          return whatsappTemplates.complaintCreatedCustomer({ customerName: currentRecipientName || custName, ticketId: slicedId });
      }
    } else if (recType === "technician") {
      switch (stg) {
        case "field_visit_scheduled":
          return `New Job Assigned: Complaint #${slicedId} for ${custName} at ${loc}. Scheduled: ${sDate} at ${sTime}. Team size: ${techniciansList.length || 1} tech(s). - Brihaspathi Technologies`;
        case "reassign_old_tech":
          return `Job Update: Complaint #${slicedId} has been cancelled/reassigned. You are no longer required to visit ${custName}. - Brihaspathi Technologies`;
        case "reassign_new_tech":
          return `New Job Assigned (Reassignment): Complaint #${slicedId} for ${custName}. Scheduled: ${sDate} at ${sTime}. - Brihaspathi Technologies`;
        default:
          return `Job Update: Complaint #${slicedId} for ${custName}. Scheduled: ${sDate} at ${sTime}. - Brihaspathi Technologies`;
      }
    } else {
      // Admin / Supervisor
      switch (stg) {
        case "journey_started":
          return `Technician ${techName} started journey for #${slicedId} (Customer: ${custName}). - Brihaspathi Technologies`;
        case "resolution_submitted":
        case "technician_signoff":
          return `Resolution submitted for #${slicedId} by ${techName}. Please verify. - Brihaspathi Technologies`;
        default:
          return `Update: Complaint #${slicedId} for ${custName} status: ${ticket?.status || "In-Progress"}. - Brihaspathi Technologies`;
      }
    }
  };

  // Initialize dialog state when opened
  const handleOpenModal = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const initialRecType: RecipientType = "customer";
    const initialStage = resolveDefaultStage(initialRecType);

    setRecipientType(initialRecType);
    setTargetPhone(rawCustPhone);
    setTargetName(rawCustName);
    setActiveStage(initialStage);
    setMessageText(generateTemplate(initialStage, initialRecType, rawCustName));
    setIsOpen(true);
  };

  // Change recipient type tab
  const handleRecipientTypeChange = (newRecType: RecipientType) => {
    setRecipientType(newRecType);
    let newPhone = "";
    let newName = "";

    if (newRecType === "customer") {
      newPhone = rawCustPhone;
      newName = rawCustName;
    } else if (newRecType === "technician") {
      const chosenTech = techniciansList.find((t) => t.id === selectedTechId) || techniciansList[0];
      newPhone = chosenTech?.phone || "";
      newName = chosenTech?.name || getTechName();
    } else {
      const chosenAdmin = adminsList.find((a) => a.id === selectedAdminId) || adminsList[0];
      newPhone = chosenAdmin?.phone || "";
      newName = chosenAdmin?.name || "Admin/Supervisor";
    }

    setTargetPhone(newPhone);
    setTargetName(newName);

    const newStage = resolveDefaultStage(newRecType);
    setActiveStage(newStage);
    setMessageText(generateTemplate(newStage, newRecType, newName));
  };

  // Change selected technician from dropdown
  const handleSelectTechnician = (techId: string) => {
    setSelectedTechId(techId);
    const chosen = techniciansList.find((t) => t.id === techId);
    if (chosen) {
      setTargetPhone(chosen.phone || "");
      setTargetName(chosen.name);
      setMessageText(generateTemplate(activeStage, "technician", chosen.name));
    }
  };

  // Change selected admin from dropdown
  const handleSelectAdmin = (adminId: string) => {
    setSelectedAdminId(adminId);
    const chosen = adminsList.find((a) => a.id === adminId);
    if (chosen) {
      setTargetPhone(chosen.phone || "");
      setTargetName(chosen.name);
      setMessageText(generateTemplate(activeStage, "admin", chosen.name));
    }
  };

  // Change stage template button
  const handleStageChange = (newStage: WhatsAppStage) => {
    setActiveStage(newStage);
    setMessageText(generateTemplate(newStage, recipientType, targetName));
  };

  // Open in WhatsApp Web / App directly
  const handleOpenWhatsAppWeb = () => {
    const cleanPhone = targetPhone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageText)}`;
    window.open(url, "_blank");
  };

  // Automated Send via Edge function with fallback to WhatsApp Web
  const handleSendMessage = async () => {
    if (!targetPhone.trim()) {
      toast.error(`Please provide a valid phone number for ${targetName || recipientType}.`);
      return;
    }
    if (!messageText.trim()) {
      toast.error("Message content cannot be empty.");
      return;
    }

    setIsSending(true);
    try {
      const res = await sendWhatsAppMessage(targetPhone, messageText.trim(), {
        name: targetName,
        ticketId: slicedId,
        event_type: activeStage,
        technicianName: customTechnicianName || ticket?.assigned_technician,
        date: customScheduledDate || ticket?.scheduled_date,
        time: customScheduledTime || ticket?.scheduled_time,
        happiness_code: customHappinessCode || ticket?.happiness_code,
        code: customHappinessCode || ticket?.happiness_code,
      });

      if (res.success) {
        toast.success(`WhatsApp message dispatched successfully to ${targetName || targetPhone}!`);
        setIsOpen(false);
      } else {
        toast.info("WhatsApp API gateway unavailable. Opening WhatsApp Web / App directly...");
        handleOpenWhatsAppWeb();
        setIsOpen(false);
      }
    } catch (err: any) {
      console.warn("Manual WhatsApp trigger fallback:", err);
      toast.info("Opening WhatsApp Web / App directly...");
      handleOpenWhatsAppWeb();
      setIsOpen(false);
    } finally {
      setIsSending(false);
    }
  };

  // Available Stage Templates depending on Recipient Type & User Role
  const getAvailableStages = (): { key: WhatsAppStage; label: string; icon: string }[] => {
    if (recipientType === "customer") {
      const stages: { key: WhatsAppStage; label: string; icon: string }[] = [
        { key: "creation", label: "1. Registered", icon: "📋" },
        { key: "field_visit_scheduled", label: "2. Visit Scheduled", icon: "📅" },
        { key: "journey_started", label: "3. Journey Started", icon: "🚀" },
        { key: "remote_resolution", label: "4. Remote Fixed (Code)", icon: "📞" },
        { key: "resolution_submitted", label: "5. Work Done (Code)", icon: "🔧" },
        { key: "closed", label: "6. Closed", icon: "✓" },
        { key: "summary", label: "📊 Share Summary", icon: "📊" },
      ];
      // Lead Tech should only see stages they are involved in
      if (!isAdminOrSupervisor && isLeadTechnician) {
        return stages.filter((s) => ["journey_started", "resolution_submitted", "summary"].includes(s.key));
      }
      return stages;
    }

    if (recipientType === "technician") {
      return [
        { key: "field_visit_scheduled", label: "1. Visit Assigned", icon: "📅" },
        { key: "reassign_old_tech", label: "2. Cancel/Reassigned (Old Tech)", icon: "❌" },
        { key: "reassign_new_tech", label: "3. Reassigned (New Tech)", icon: "🔄" },
      ];
    }

    // Admin / Supervisor recipient
    return [
      { key: "journey_started", label: "1. Journey Started", icon: "🚀" },
      { key: "resolution_submitted", label: "2. Resolution Submitted", icon: "📋" },
    ];
  };

  // Render Trigger Button
  const renderTrigger = () => {
    if (buttonVariant === "icon") {
      return (
        <button
          type="button"
          onClick={handleOpenModal}
          className={cn(
            "inline-flex items-center justify-center p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 transition-all hover:scale-105 active:scale-95 shadow-2xs cursor-pointer",
            className
          )}
          title={title || "Send WhatsApp Update"}
        >
          <WhatsAppIcon className={size === "xs" ? "w-3.5 h-3.5" : "w-4 h-4"} />
        </button>
      );
    }

    if (buttonVariant === "badge") {
      return (
        <button
          type="button"
          onClick={handleOpenModal}
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-200 transition-colors cursor-pointer",
            className
          )}
        >
          <WhatsAppIcon className="w-3.5 h-3.5" />
          <span>{buttonText || "WhatsApp"}</span>
        </button>
      );
    }

    return (
      <Button
        type="button"
        size={size === "xs" ? "sm" : size}
        variant={buttonVariant === "outline" ? "outline" : "default"}
        onClick={handleOpenModal}
        className={cn(
          buttonVariant === "outline"
            ? "border-emerald-500/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold"
            : "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs",
          className
        )}
      >
        <WhatsAppIcon className="w-4 h-4 mr-1.5" />
        <span>{buttonText || "WhatsApp Update"}</span>
      </Button>
    );
  };

  const currentStageList = getAvailableStages();

  return (
    <>
      {renderTrigger()}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl p-6">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <WhatsAppIcon className="w-4 h-4" />
                </div>
                <span>WhatsApp Notification Center</span>
              </DialogTitle>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {slicedId}
              </span>
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Select recipient role and lifecycle template to preview and dispatch pre-filled WhatsApp messages.
            </DialogDescription>
          </DialogHeader>

          {/* 1. Recipient Role Selection Tabs */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              1. Select Recipient:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleRecipientTypeChange("customer")}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
                  recipientType === "customer"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                    : "bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                )}
              >
                <User className="w-3.5 h-3.5" />
                <span>Customer</span>
              </button>

              {isAdminOrSupervisor && (
                <button
                  type="button"
                  onClick={() => handleRecipientTypeChange("technician")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
                    recipientType === "technician"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                  )}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Technicians</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleRecipientTypeChange("admin")}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
                  recipientType === "admin"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                    : "bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                )}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin / Supv</span>
              </button>
            </div>
          </div>

          {/* 2. Interactive Template Stage Selector */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              2. Choose Stage Template:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {currentStageList.map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => handleStageChange(st.key)}
                  className={cn(
                    "text-xs px-2.5 py-1.5 rounded-lg font-semibold border transition-all cursor-pointer flex items-center gap-1",
                    activeStage === st.key
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                  )}
                >
                  <span>{st.icon}</span>
                  <span>{st.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Recipient Details & Phone */}
          <div className="space-y-3 pt-1">
            {/* Technician Picker when Recipient = Technician */}
            {recipientType === "technician" && techniciansList.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Specific Technician
                </label>
                <select
                  value={selectedTechId}
                  onChange={(e) => handleSelectTechnician(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950 font-medium"
                >
                  {techniciansList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.is_lead ? "(Lead)" : ""} {t.phone ? `(${t.phone})` : "(No phone)"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Admin Picker when Recipient = Admin */}
            {recipientType === "admin" && adminsList.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Supervisor / Admin
                </label>
                <select
                  value={selectedAdminId}
                  onChange={(e) => handleSelectAdmin(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950 font-medium"
                >
                  {adminsList.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.phone})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Recipient Name
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    value={targetName}
                    onChange={(e) => {
                      setTargetName(e.target.value);
                      setMessageText(generateTemplate(activeStage, recipientType, e.target.value));
                    }}
                    placeholder="Recipient Name"
                    className="pl-8 text-xs h-9 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  WhatsApp Phone *
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    value={targetPhone}
                    onChange={(e) => setTargetPhone(e.target.value)}
                    placeholder="10-digit phone number"
                    className="pl-8 text-xs h-9 font-mono bg-white dark:bg-slate-950"
                  />
                </div>
              </div>
            </div>

            {/* Message Preview & Editing */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Message Content (Editable)
                </label>
                <button
                  type="button"
                  onClick={() => setMessageText(generateTemplate(activeStage, recipientType, targetName))}
                  className="text-[11px] text-emerald-600 hover:underline font-medium"
                >
                  Reset Template
                </button>
              </div>
              <Textarea
                rows={4}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type WhatsApp message..."
                className="text-xs bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 focus-visible:ring-emerald-500 rounded-xl leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="text-xs order-3 sm:order-1"
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleOpenWhatsAppWeb}
              className="text-xs order-2 border-emerald-500 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 font-semibold flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open WhatsApp Web
            </Button>

            <Button
              type="button"
              onClick={handleSendMessage}
              disabled={isSending || !targetPhone.trim() || !messageText.trim()}
              className="text-xs order-1 sm:order-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> Send WhatsApp Update
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
