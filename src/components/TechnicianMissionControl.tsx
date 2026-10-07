import React, { useState, useEffect, useRef } from "react";
import { Phone, MessageCircle, MapPin, Navigation, CheckCircle2, Loader2, Copy, ExternalLink, ShieldCheck, Play } from "lucide-react";
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
  currentPhase?: number;
  status?: string;
  dispatchedAt?: string | null;
  onDispatched?: () => void;
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
  currentPhase,
  status,
  dispatchedAt,
  onDispatched,
}) => {
  const effectiveArrivalTimestamp = arrivalTimestamp || complaint?.arrival_timestamp;
  const effectiveArrivalLat = arrivalLat ?? complaint?.arrival_lat;
  const effectiveArrivalLng = arrivalLng ?? complaint?.arrival_lng;

  const [isLoggingArrival, setIsLoggingArrival] = useState(false);
  const [loggedArrival, setLoggedArrival] = useState<{ lat: number; lng: number; time: string } | null>(
    effectiveArrivalTimestamp && effectiveArrivalLat != null && effectiveArrivalLng != null
      ? { lat: Number(effectiveArrivalLat), lng: Number(effectiveArrivalLng), time: effectiveArrivalTimestamp }
      : null
  );
  const [arrivedWithoutGps, setArrivedWithoutGps] = useState(
    Boolean(effectiveArrivalTimestamp && (effectiveArrivalLat == null || effectiveArrivalLng == null))
  );

  useEffect(() => {
    if (effectiveArrivalTimestamp) {
      if (effectiveArrivalLat != null && effectiveArrivalLng != null) {
        setLoggedArrival({ lat: Number(effectiveArrivalLat), lng: Number(effectiveArrivalLng), time: effectiveArrivalTimestamp });
        setArrivedWithoutGps(false);
      } else {
        setLoggedArrival(null);
        setArrivedWithoutGps(true);
      }
    } else {
      setLoggedArrival(null);
      setArrivedWithoutGps(false);
    }
  }, [effectiveArrivalTimestamp, effectiveArrivalLat, effectiveArrivalLng]);

  // Check if ticket has already started journey (Phase >= 4 or start timestamp exists)
  const isInitiallyDispatched = Boolean(
    dispatchedAt ||
    complaint?.start_journey_timestamp ||
    (currentPhase && currentPhase >= 4) ||
    (status && [
      'dispatched',
      'en_route',
      'en route',
      'in_progress',
      'in progress',
      'arrived',
      'completed',
      'site completed and handed over',
      'verified',
      'closed',
    ].includes(status.toLowerCase())) ||
    (complaint?.status && [
      'dispatched',
      'arrived',
      'completed',
      'closed'
    ].includes(complaint.status.toLowerCase()))
  );

  const [isDispatched, setIsDispatched] = useState(isInitiallyDispatched);
  const [isStartingJourney, setIsStartingJourney] = useState(false);

  useEffect(() => {
    if (isInitiallyDispatched) {
      setIsDispatched(true);
    }
  }, [isInitiallyDispatched]);

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

  // Live distance to site state for auto-arrival geofencing
  const [distanceToSiteMeters, setDistanceToSiteMeters] = useState<number | null>(null);
  const hasAutoArrivedRef = useRef(false);

  // Haversine formula for calculating distance in meters
  const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth radius in metres
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // WhatsApp Pre-filled message generator
  const getWhatsAppUrl = () => {
    if (!cleanPhone) return "#";
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const isEnRoute = Boolean(isDispatched && !loggedArrival && !effectiveArrivalTimestamp);
    const greetingMsg = isEnRoute
      ? `Hello ${customerName}, I am your service technician from Brihaspathi Technologies for ${
          ticketType === "installation" ? "Installation Job" : "Service Complaint"
        } #${ticketDisplayId}. I am currently on my way to your site location (approx. 5-10 mins away). Please ensure someone is available at the site.`
      : `Hello ${customerName}, I am your service technician from Brihaspathi Technologies for ${
          ticketType === "installation" ? "Installation Job" : "Service Complaint"
        } #${ticketDisplayId}. I will be attending to your service request.`;
    return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(greetingMsg)}`;
  };

  // Google Maps Navigation URL (supports origin coordinates when available)
  const getNavigationUrl = (originCoords?: { lat: number; lng: number } | null) => {
    const hasValidCoords =
      typeof effLat === 'number' && typeof effLng === 'number' &&
      effLat >= 6 && effLat <= 38 && effLng >= 68 && effLng <= 98;

    let dest = "";
    if (cleanAddress && cleanAddress !== "Site address not specified" && cleanAddress.toLowerCase() !== "on-site") {
      dest = encodeURIComponent(cleanAddress);
    } else if (hasValidCoords) {
      dest = `${effLat},${effLng}`;
    }

    if (!dest) return "#";

    if (originCoords && originCoords.lat && originCoords.lng) {
      return `https://www.google.com/maps/dir/?api=1&origin=${originCoords.lat},${originCoords.lng}&destination=${dest}&travelmode=driving`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
  };

  // Core function to save arrival in database (Used by both Auto-Geofence and Manual Click)
  const saveArrivalRecord = async (lat?: number | null, lng?: number | null, isAuto = false) => {
    try {
      const nowIso = new Date().toISOString();
      if (ticketType === "complaint") {
        const targetStatus = "in-progress";

        const payload: any = {
          status: targetStatus,
          current_phase: 4,
          arrival_timestamp: nowIso,
          start_journey_timestamp: complaint?.start_journey_timestamp || nowIso,
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
          status: "In Progress",
          current_phase: 4,
          arrival_time: nowIso,
          dispatched_at: dispatchedAt || nowIso,
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

      if (isAuto) {
        toast.success("🎯 Destination reached! Arrival recorded automatically.", { id: "gps-arrival" });
      } else if (lat && lng) {
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

  // Automated Geofencing Arrival Detection Effect
  useEffect(() => {
    const isAlreadyArrived = Boolean(loggedArrival || arrivedWithoutGps || effectiveArrivalTimestamp);
    if (!isDispatched || isAlreadyArrived || effLat == null || effLng == null) {
      return;
    }

    if (!navigator.geolocation) return;

    let watchId: number | null = null;

    const checkPosition = (position: GeolocationPosition) => {
      if (hasAutoArrivedRef.current) return;
      const { latitude, longitude } = position.coords;
      const dist = calculateDistanceMeters(latitude, longitude, Number(effLat), Number(effLng));
      setDistanceToSiteMeters(Math.round(dist));

      // Geofence: 100m threshold (with GPS accuracy tolerance up to 150m)
      const threshold = Math.max(100, Math.min(150, position.coords.accuracy || 100));
      if (dist <= threshold && !hasAutoArrivedRef.current) {
        hasAutoArrivedRef.current = true;
        if (typeof navigator.vibrate === "function") {
          try { navigator.vibrate([200, 100, 200]); } catch {}
        }
        saveArrivalRecord(latitude, longitude, true);
      }
    };

    try {
      watchId = navigator.geolocation.watchPosition(
        checkPosition,
        (err) => console.warn("Auto-arrival geolocation watch error:", err.message),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
      );
    } catch (e) {
      console.warn("watchPosition failed:", e);
    }

    // Re-check whenever the technician switches back from Google Maps app to the browser tab
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible" && !hasAutoArrivedRef.current) {
        navigator.geolocation.getCurrentPosition(
          checkPosition,
          (err) => console.warn("Visibility location check skipped:", err.message),
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, [isDispatched, loggedArrival, arrivedWithoutGps, effectiveArrivalTimestamp, effLat, effLng]);

  // Handle Start Journey (Captures GPS, Opens Navigation Route in Maps, Transitions to Phase 3: Dispatched)
  const handleStartJourney = async () => {
    setIsStartingJourney(true);
    toast.loading("Acquiring GPS & starting journey...", { id: "start-journey" });
    const nowIso = new Date().toISOString();

    let startCoords: { lat: number; lng: number } | null = null;
    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 0,
          });
        });
        startCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
      } catch (gpsErr) {
        console.warn("Could not acquire precise start GPS, proceeding:", gpsErr);
      }
    }

    try {
      // 1. Record starting location into tracking table
      if (startCoords) {
        try {
          await supabase.from("location_tracking").insert({
            ...(ticketType === "complaint" ? { complaint_id: ticketId } : { installation_id: ticketId }),
            latitude: startCoords.lat,
            longitude: startCoords.lng,
            accuracy: 10,
            timestamp: nowIso,
          });
        } catch (dbErr) {
          console.warn("Location tracking insert skipped:", dbErr);
        }
      }

      // 2. Update status in database
      if (ticketType === "installation") {
        const { error } = await supabase
          .from("installations")
          .update({
            status: "Dispatched",
            current_phase: 3,
            dispatched_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", ticketId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("complaints")
          .update({
            status: "dispatched",
            current_phase: 3,
            start_journey_timestamp: nowIso,
          })
          .eq("id", ticketId);
        if (error) throw error;
      }

      // 3. Open Turn-by-Turn Route Navigation in Google Maps
      const navUrl = getNavigationUrl(startCoords);
      if (navUrl && navUrl !== "#") {
        window.open(navUrl, "_blank");
        toast.success("🚀 Journey started! Opening navigation route to customer site...", { id: "start-journey" });
      } else {
        toast.success("🚀 Journey started! Technician dispatched to site.", { id: "start-journey" });
      }

      setIsDispatched(true);
      if (onDispatched) onDispatched();
    } catch (err: any) {
      console.error("Start journey error:", err);
      toast.error(err.message || "Failed to start journey", { id: "start-journey" });
    } finally {
      setIsStartingJourney(false);
    }
  };

  // Handle Manual GPS Arrival Capture (Fallback at any time)
  const handleIArrived = async () => {
    hasAutoArrivedRef.current = true;
    setIsLoggingArrival(true);
    toast.loading("Capturing GPS coordinates...", { id: "gps-arrival" });

    if (!navigator.geolocation) {
      toast.info("Geolocation is not supported. Recording arrival without GPS.", { id: "gps-arrival" });
      await saveArrivalRecord(null, null, false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        await saveArrivalRecord(latitude, longitude, false);
      },
      async (error) => {
        let warningNote = "GPS unavailable. Recording arrival without coordinates.";
        if (error.code === 1) warningNote = "GPS permission denied in browser. Recording arrival without coordinates.";
        else if (error.code === 2) warningNote = "GPS position unavailable. Recording arrival without coordinates.";
        else if (error.code === 3) warningNote = "GPS request timed out. Recording arrival without coordinates.";

        console.warn("GPS position error:", error.message);
        toast.info(warningNote, { id: "gps-arrival" });
        await saveArrivalRecord(null, null, false);
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
        ) : isDispatched ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            {distanceToSiteMeters != null
              ? distanceToSiteMeters <= 250
                ? `Approaching Site (~${distanceToSiteMeters}m) • Auto-arriving shortly`
                : `En Route • ~${distanceToSiteMeters > 1000 ? (distanceToSiteMeters / 1000).toFixed(1) + " km" : distanceToSiteMeters + " m"} away`
              : "En Route to Site"}
            {effLat && effLng && (distanceToSiteMeters == null || distanceToSiteMeters > 250) ? " (Auto-Arrival Active)" : ""}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-700 text-slate-300 border border-slate-600">
            Assigned • Ready to Start
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

        {/* 4. "Start Journey" (Phase 3) or "I Arrived" (Phase 4 GPS Log) */}
        {loggedArrival ? (
          <div className="flex flex-col items-center justify-center py-2 px-3 rounded-xl bg-slate-800 border border-emerald-500/40 text-center">
            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> GPS Verified
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {loggedArrival.lat.toFixed(4)}, {loggedArrival.lng.toFixed(4)}
            </span>
          </div>
        ) : (arrivedWithoutGps || Boolean(effectiveArrivalTimestamp)) ? (
          <div className="flex flex-col items-center justify-center py-2 px-3 rounded-xl bg-slate-800 border border-emerald-500/40 text-center">
            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Arrived on Site
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {effectiveArrivalTimestamp ? new Date(effectiveArrivalTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Logged"}
            </span>
          </div>
        ) : !isDispatched ? (
          <Button
            type="button"
            onClick={handleStartJourney}
            disabled={isStartingJourney || !isLeadOrAdmin}
            className="flex items-center justify-center gap-2 h-auto py-3.5 px-3 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 transition-all shadow-md border-0"
          >
            {isStartingJourney ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Starting Journey...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Start Journey
              </>
            )}
          </Button>
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
