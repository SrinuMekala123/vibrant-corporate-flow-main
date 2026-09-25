import React, { useState } from "react";
import { Phone, MessageCircle, MapPin, Navigation, CheckCircle2, Loader2, Copy, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface TechnicianMissionControlProps {
  ticketType: "complaint" | "installation";
  ticketId: string;
  ticketDisplayId: string;
  customerName?: string;
  customerPhone?: string;
  locationAddress?: string;
  customerLat?: number | null;
  customerLng?: number | null;
  arrivalLat?: number | null;
  arrivalLng?: number | null;
  arrivalTimestamp?: string | null;
  isLeadOrAdmin?: boolean;
  onArrivalLogged?: (lat: number, lng: number, timestamp: string) => void;
  complaint?: any;
}

export const TechnicianMissionControl: React.FC<TechnicianMissionControlProps> = ({
  ticketType,
  ticketId,
  ticketDisplayId,
  customerName = "Customer",
  customerPhone,
  locationAddress,
  customerLat,
  customerLng,
  arrivalLat,
  arrivalLng,
  arrivalTimestamp,
  isLeadOrAdmin = true,
  onArrivalLogged,
  complaint,
}) => {
  const [isLoggingArrival, setIsLoggingArrival] = useState(false);
  const [loggedArrival, setLoggedArrival] = useState<{ lat: number; lng: number; time: string } | null>(
    arrivalTimestamp && arrivalLat && arrivalLng
      ? { lat: arrivalLat, lng: arrivalLng, time: arrivalTimestamp }
      : null
  );
  const [arrivedWithoutGps, setArrivedWithoutGps] = useState(false);

  // Robust Fallback: Pull from complaint object if Walk-in / non-linked
  const rawPhone = 
    customerPhone || 
    complaint?.customer_phone || 
    complaint?.phone || 
    complaint?.profiles?.phone || 
    "";

  const rawAddress = 
    locationAddress || 
    complaint?.location || 
    complaint?.address || 
    complaint?.location_address || 
    "";

  const effLat = customerLat ?? complaint?.customer_lat ?? null;
  const effLng = customerLng ?? complaint?.customer_lng ?? null;

  const cleanPhone = (rawPhone || "").replace(/\D/g, "");
  const cleanAddress = (rawAddress || "").trim();

  // WhatsApp Pre-filled message generator
  const getWhatsAppUrl = () => {
    if (!cleanPhone) return "#";
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const greetingMsg = `Hello ${customerName}, I am your service technician from Brihaspathi Technologies for ${
      ticketType === "installation" ? "Installation Job" : "Service Complaint"
    } #${ticketDisplayId}. I am on my way to your site location.`;
    return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(greetingMsg)}`;
  };

  // Google Maps Navigation URL
  const getNavigationUrl = () => {
    if (effLat && effLng) {
      return `https://www.google.com/maps/dir/?api=1&destination=${effLat},${effLng}&travelmode=driving`;
    }
    if (cleanAddress && cleanAddress !== "Site address not specified" && cleanAddress.toLowerCase() !== "on-site") {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanAddress)}`;
    }
    return "#";
  };

  // Handle GPS Arrival Capture (Resilient to permission denied or timeout)
  const handleIArrived = async () => {
    setIsLoggingArrival(true);
    toast.loading("Capturing GPS coordinates...", { id: "gps-arrival" });

    const nowIso = new Date().toISOString();

    const saveArrivalRecord = async (lat?: number | null, lng?: number | null) => {
      try {
        if (ticketType === "complaint") {
          const payload: any = {
            status: "in-progress",
            current_phase: 4,
            arrival_timestamp: nowIso,
          };
          if (lat != null && lng != null) {
            payload.arrival_lat = lat;
            payload.arrival_lng = lng;
          }
          const { error } = await supabase
            .from("complaints")
            .update(payload)
            .eq("id", ticketId);

          if (error) throw error;
        } else {
          const payload: any = {
            status: "arrived",
            current_phase: 4,
            arrival_time: nowIso,
            updated_at: nowIso,
          };
          if (lat != null && lng != null) {
            payload.arrival_gps_lat = lat;
            payload.arrival_gps_lng = lng;
          }
          const { error } = await supabase
            .from("installations")
            .update(payload)
            .eq("id", ticketId);

          if (error) throw error;
        }

        setLoggedArrival(lat && lng ? { lat, lng, time: nowIso } : null);
        setArrivedWithoutGps(!(lat && lng));
        if (onArrivalLogged) {
          onArrivalLogged(lat || 0, lng || 0, nowIso);
        }

        if (lat && lng) {
          toast.success("🎯 Arrival logged successfully with GPS coordinates!", { id: "gps-arrival" });
        } else {
          toast.success("🎯 Arrival logged successfully! (GPS coordinates unavailable)", { id: "gps-arrival" });
        }
      } catch (err: any) {
        console.error("Failed to log arrival:", err);
        toast.error(err?.message || "Failed to update arrival status in database.", { id: "gps-arrival" });
      } finally {
        setIsLoggingArrival(false);
      }
    };

    if (!navigator.geolocation) {
      toast.info("Geolocation is not supported. Recording arrival without GPS.", { id: "gps-arrival" });
      await saveArrivalRecord(null, null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        await saveArrivalRecord(latitude, longitude);
      },
      async (error) => {
        let warningNote = "GPS unavailable. Recording arrival without coordinates.";
        if (error.code === 1) warningNote = "GPS permission denied in browser. Recording arrival without coordinates.";
        else if (error.code === 2) warningNote = "GPS position unavailable. Recording arrival without coordinates.";
        else if (error.code === 3) warningNote = "GPS request timed out. Recording arrival without coordinates.";
        
        console.warn("GPS position error:", error.message);
        toast.info(warningNote, { id: "gps-arrival" });
        await saveArrivalRecord(null, null);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0,
      }
    );
  };

  return (
    <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white border border-slate-700/60 shadow-xl space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-primary/20 text-primary border border-primary/30">
            <Navigation className="w-4 h-4" />
          </span>
          <div>
            <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              Technician Mission Control
            </h3>
            <p className="text-[11px] text-slate-400">
              One-Tap On-site Communication, GPS Navigation & Arrival Proof
            </p>
          </div>
        </div>

        {loggedArrival ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Arrived on Site ({new Date(loggedArrival.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            En Route to Site
          </span>
        )}
      </div>

      {/* Quick 1-Tap Thumb Action Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {/* 1. Phone Call */}
        {cleanPhone ? (
          <a
            href={`tel:${cleanPhone.length === 10 ? `+91${cleanPhone}` : `+${cleanPhone}`}`}
            className="flex items-center justify-center gap-2 py-3.5 px-3 rounded-xl font-bold text-xs sm:text-sm text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all shadow-md text-center"
          >
            <Phone className="w-4 h-4" /> Call Client
          </a>
        ) : (
          <button
            disabled
            className="flex items-center justify-center gap-2 py-3.5 px-3 rounded-xl font-bold text-xs sm:text-sm text-slate-400 bg-slate-800 opacity-60 cursor-not-allowed"
          >
            <Phone className="w-4 h-4" /> No Phone
          </button>
        )}

        {/* 2. WhatsApp Message */}
        {cleanPhone ? (
          <a
            href={getWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-3.5 px-3 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 transition-all shadow-md text-center"
          >
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </a>
        ) : (
          <button
            disabled
            className="flex items-center justify-center gap-2 py-3.5 px-3 rounded-xl font-bold text-xs sm:text-sm text-slate-400 bg-slate-800 opacity-60 cursor-not-allowed"
          >
            <MessageCircle className="w-4 h-4" /> No WhatsApp
          </button>
        )}

        {/* 3. Turn-by-Turn GPS Navigation */}
        {(cleanAddress && cleanAddress !== "Site address not specified") || (effLat && effLng) ? (
          <a
            href={getNavigationUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-3.5 px-3 rounded-xl font-bold text-xs sm:text-sm text-white bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all shadow-md text-center"
          >
            <MapPin className="w-4 h-4" /> Navigate
          </a>
        ) : (
          <button
            disabled
            className="flex items-center justify-center gap-2 py-3.5 px-3 rounded-xl font-bold text-xs sm:text-sm text-slate-400 bg-slate-800 opacity-60 cursor-not-allowed"
          >
            <MapPin className="w-4 h-4" /> No Map
          </button>
        )}

        {/* 4. "I Arrived" (GPS Log) */}
        {loggedArrival ? (
          <div className="flex flex-col items-center justify-center py-2 px-3 rounded-xl bg-slate-800 border border-emerald-500/40 text-center">
            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> GPS Verified
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {loggedArrival.lat.toFixed(4)}, {loggedArrival.lng.toFixed(4)}
            </span>
          </div>
        ) : arrivedWithoutGps ? (
          <div className="flex flex-col items-center justify-center py-2 px-3 rounded-xl bg-slate-800 border border-slate-500/40 text-center">
            <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Arrived
            </span>
            <span className="text-[10px] text-slate-500 font-mono">No GPS coordinates</span>
          </div>
        ) : (
          <Button
            type="button"
            onClick={handleIArrived}
            disabled={isLoggingArrival || !isLeadOrAdmin}
            className="flex items-center justify-center gap-2 h-auto py-3.5 px-3 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 transition-all shadow-md border-0"
          >
            {isLoggingArrival ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4" /> I Arrived (GPS)
              </>
            )}
          </Button>
        )}
      </div>

      {/* Address Quick View & Copy */}
      {cleanAddress && (
        <div className="flex items-center justify-between gap-3 text-xs bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-slate-300">
          <span className="truncate flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
            <strong className="text-slate-100">Site:</strong> {cleanAddress}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(cleanAddress);
              toast.success("Site address copied to clipboard!");
            }}
            className="h-7 px-2 text-[11px] text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg shrink-0 gap-1"
          >
            <Copy className="w-3 h-3" /> Copy
          </Button>
        </div>
      )}
    </div>
  );
};
