import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Send, ExternalLink, Phone, User, MessageSquare, Sparkles, CheckCircle2 } from "lucide-react";
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
import { formatComplaintTicketId } from "@/services/complaintService";
import { formatInstallationTicketId } from "@/services/installationService";
import { cn } from "@/lib/utils";

export type WhatsAppStage =
  | "creation"
  | "remote_resolution"
  | "field_visit_scheduled"
  | "technician_signoff"
  | "closed"
  | "summary";

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
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [targetPhone, setTargetPhone] = useState("");
  const [targetName, setTargetName] = useState("");
  const [messageText, setMessageText] = useState("");
  const [activeStage, setActiveStage] = useState<WhatsAppStage>("creation");

  const slicedId =
    ticketType === "installation"
      ? formatInstallationTicketId(ticket)
      : formatComplaintTicketId(ticket);

  const rawCustPhone = getCustomerPhone(ticket);
  const rawCustName = getCustomerName(ticket);

  // Compute intelligent stage based on current ticket properties
  const resolveDefaultStage = (): WhatsAppStage => {
    if (stage) return stage;
    if (ticketType === "installation") {
      if (ticket?.status === "verified" || ticket?.status === "force_closed" || ticket?.force_closed) return "closed";
      if (ticket?.status === "completed" || ticket?.current_phase >= 5) return "technician_signoff";
      if (ticket?.status === "Assigned" || ticket?.current_phase >= 2 || ticket?.scheduled_date) return "field_visit_scheduled";
      return "creation";
    } else {
      if (ticket?.status === "closed" || ticket?.status === "verified" || ticket?.current_phase >= 6) return "closed";
      if (ticket?.status === "completed" || ticket?.current_phase >= 5 || ticket?.resolution_type === "on_site") return "technician_signoff";
      if (ticket?.resolution_type === "remote_fixed" || ticket?.happiness_code || ticket?.status === "resolved_remotely") return "remote_resolution";
      if (ticket?.current_phase >= 3 || ticket?.status === "assigned" || ticket?.scheduled_date) return "field_visit_scheduled";
      return "creation";
    }
  };

  const generateTemplate = (stg: WhatsAppStage, name: string): string => {
    const techName =
      customTechnicianName ||
      ticket?.assigned_technician ||
      ticket?.technician_name ||
      "Field Technician";

    const sDate =
      customScheduledDate ||
      (ticket?.scheduled_date
        ? new Date(`${ticket.scheduled_date}T00:00:00`).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "the scheduled date");

    const sTime =
      customScheduledTime ||
      (ticket?.scheduled_time ? ticket.scheduled_time.slice(0, 5) : "10:00 AM");

    const hpCode =
      customHappinessCode ||
      ticket?.happiness_code ||
      ticket?.walk_in_happiness_code ||
      "XXXXX";

    const equipType =
      customEquipmentType ||
      ticket?.equipment_model ||
      ticket?.brand ||
      ticket?.equipment_details ||
      "Equipment Installation";

    if (stg === "summary") {
      const locDisplay =
        ticket?.location ||
        ticket?.installation_site_address ||
        ticket?.address ||
        ticket?.customer_address ||
        ticket?.site_address;
      return getTicketFullSummaryMessage({
        ticketType,
        ticketId: slicedId,
        customerName: name,
        titleOrEquipment: ticket?.title || equipType,
        status: ticket?.status,
        phase: ticket?.current_phase,
        technicianName: techName,
        scheduledDate: sDate !== "the scheduled date" ? sDate : (ticket?.scheduled_date || undefined),
        scheduledTime: sTime !== "10:00 AM" ? sTime : (ticket?.scheduled_time || undefined),
        happinessCode: hpCode !== "XXXXX" ? hpCode : (ticket?.happiness_code || undefined),
        location: locDisplay || undefined,
        notes: ticket?.resolution_notes || ticket?.notes || undefined,
      });
    }

    if (ticketType === "installation") {
      switch (stg) {
        case "creation":
          return getInstallationCreatedMessage({
            customerName: name,
            ticketId: slicedId,
            equipmentType: equipType,
          });
        case "field_visit_scheduled":
          return getInstallationScheduledMessage({
            customerName: name,
            technicianName: techName,
            ticketId: slicedId,
            scheduledDate: sDate,
            scheduledTime: sTime,
          });
        case "technician_signoff":
          return getInstallationSignOffMessage({
            customerName: name,
            ticketId: slicedId,
            happinessCode: hpCode,
          });
        case "closed":
          return getInstallationClosedMessage({
            customerName: name,
            ticketId: slicedId,
          });
        default:
          return getInstallationCreatedMessage({
            customerName: name,
            ticketId: slicedId,
            equipmentType: equipType,
          });
      }
    } else {
      switch (stg) {
        case "creation":
          return getComplaintCreatedMessage({
            customerName: name,
            ticketId: slicedId,
          });
        case "remote_resolution":
          return getRemoteResolutionMessage({
            customerName: name,
            ticketId: slicedId,
            happinessCode: hpCode,
          });
        case "field_visit_scheduled":
          return getFieldVisitScheduledMessage({
            customerName: name,
            technicianName: techName,
            ticketId: slicedId,
            scheduledDate: sDate,
            scheduledTime: sTime,
          });
        case "technician_signoff":
          return getTechnicianSignOffMessage({
            customerName: name,
            ticketId: slicedId,
            happinessCode: hpCode,
          });
        case "closed":
          return getComplaintClosedMessage({
            customerName: name,
            ticketId: slicedId,
          });
        default:
          return getComplaintCreatedMessage({
            customerName: name,
            ticketId: slicedId,
          });
      }
    }
  };

  // Initialize dialog state with computed template
  const handleOpenModal = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const phone = rawCustPhone;
    const name = rawCustName;
    const initialStage = resolveDefaultStage();

    setTargetPhone(phone);
    setTargetName(name);
    setActiveStage(initialStage);
    setMessageText(generateTemplate(initialStage, name));
    setIsOpen(true);
  };

  const handleStageChange = (newStage: WhatsAppStage) => {
    setActiveStage(newStage);
    setMessageText(generateTemplate(newStage, targetName || rawCustName));
  };

  const handleOpenWhatsAppWeb = () => {
    const cleanPhone = targetPhone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(messageText)}`;
    window.open(url, "_blank");
  };

  const handleSendMessage = async () => {
    if (!targetPhone.trim()) {
      toast.error("Please provide a valid customer phone number.");
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
        toast.success(`WhatsApp message dispatched successfully to ${targetPhone}!`);
        setIsOpen(false);
      } else {
        console.warn("API WhatsApp gateway returned issue:", res.error);
        toast.info("WhatsApp API gateway unavailable. Opening WhatsApp Web / App directly...");
        handleOpenWhatsAppWeb();
        setIsOpen(false);
      }
    } catch (err: any) {
      console.warn("Manual WhatsApp trigger failed:", err);
      toast.info("Opening WhatsApp Web / App directly...");
      handleOpenWhatsAppWeb();
      setIsOpen(false);
    } finally {
      setIsSending(false);
    }
  };

  // Complaint Stages List
  const complaintStages: { key: WhatsAppStage; label: string; icon: string }[] = [
    { key: "creation", label: "1. Registered", icon: "📋" },
    { key: "remote_resolution", label: "2. Remote Fix (Code)", icon: "📞" },
    { key: "field_visit_scheduled", label: "3. Scheduled", icon: "📅" },
    { key: "technician_signoff", label: "4. On-site Sign-Off", icon: "🔧" },
    { key: "closed", label: "5. Closed", icon: "✓" },
    { key: "summary", label: "📊 Share Summary (with Code)", icon: "📊" },
  ];

  // Installation Stages List
  const installationStages: { key: WhatsAppStage; label: string; icon: string }[] = [
    { key: "creation", label: "1. Created", icon: "📋" },
    { key: "field_visit_scheduled", label: "2. Assigned & Scheduled", icon: "📅" },
    { key: "technician_signoff", label: "3. Completed (Code)", icon: "🔐" },
    { key: "closed", label: "4. Verified & Closed", icon: "✓" },
    { key: "summary", label: "📊 Share Summary (with Code)", icon: "📊" },
  ];

  const stageList = ticketType === "installation" ? installationStages : complaintStages;

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
        <span>{buttonText || "Send WhatsApp"}</span>
      </Button>
    );
  };

  return (
    <>
      {renderTrigger()}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl p-6">
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
              Select a stage template below or customize the message before sending to the customer.
            </DialogDescription>
          </DialogHeader>

          {/* Interactive Template Stage Selector */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Choose Stage Template:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {stageList.map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => handleStageChange(st.key)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-lg font-semibold border transition-all cursor-pointer flex items-center gap-1",
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

          <div className="space-y-3.5 pt-2">
            {/* Customer & Phone fields */}
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
                      setMessageText(generateTemplate(activeStage, e.target.value));
                    }}
                    placeholder="Customer Name"
                    className="pl-8 text-xs h-9 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Recipient WhatsApp Phone *
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
                  onClick={() => setMessageText(generateTemplate(activeStage, targetName || rawCustName))}
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
