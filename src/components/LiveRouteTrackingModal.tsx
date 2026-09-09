import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { X, Play, Pause, RotateCcw, MapPin, Clock, Navigation, Battery, HelpCircle, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface LiveRouteTrackingModalProps {
  complaintId: string;
  ticket: {
    id: string;
    status: string;
    customer_name?: string;
    customer_lat?: number | null;
    customer_lng?: number | null;
    location?: string;
    assigned_technician?: string;
    start_journey_timestamp?: string;
    arrival_timestamp?: string;
  };
  onClose: () => void;
}

interface LocationPoint {
  id: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  battery_level?: number | null;
  accuracy?: number | null;
}

// Helper: Haversine distance formula (in km)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // radius of Earth in km
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

export default function LiveRouteTrackingModal({
  complaintId,
  ticket,
  onClose,
}: LiveRouteTrackingModalProps) {
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Playback state
  const isLive = ["in-progress", "dispatched", "pir_submitted_awaiting_approval"].includes(
    ticket.status
  );
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackTimer = useRef<NodeJS.Timeout | null>(null);

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const techMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);

  // Load initial tracking points
  useEffect(() => {
    const fetchPoints = async () => {
      try {
        const { data, error } = await supabase
          .from("location_tracking")
          .select("*")
          .eq("complaint_id", complaintId)
          .order("timestamp", { ascending: true });

        if (error) throw error;

        const formatted = (data || []).map((p: any) => ({
          id: p.id,
          latitude: Number(p.latitude),
          longitude: Number(p.longitude),
          timestamp: p.timestamp,
          battery_level: p.battery_level ? Number(p.battery_level) : null,
          accuracy: p.accuracy ? Number(p.accuracy) : null,
        }));

        setPoints(formatted);
        if (!isLive) {
          setPlaybackIndex(formatted.length > 0 ? formatted.length - 1 : 0);
        }
      } catch (err) {
        console.error("Error loading route tracking:", err);
        toast.error("Failed to load tracking data");
      } finally {
        setLoading(false);
      }
    };

    fetchPoints();

    // Subscribe to live inserts if the job is active
    if (isLive) {
      // Realtime updates are disabled to prevent WebSocket 403 errors
      // If you need realtime tracking, set REALTIME_ENABLED to true
      const REALTIME_ENABLED = false;
      if (!REALTIME_ENABLED) {
        return;
      }
      
      const channel = supabase
        .channel(`live-tracking-${complaintId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "location_tracking",
            filter: `complaint_id=eq.${complaintId}`,
          },
          (payload) => {
            const newPt = payload.new as any;
            const ptObj: LocationPoint = {
              id: newPt.id,
              latitude: Number(newPt.latitude),
              longitude: Number(newPt.longitude),
              timestamp: newPt.timestamp,
              battery_level: newPt.battery_level ? Number(newPt.battery_level) : null,
              accuracy: newPt.accuracy ? Number(newPt.accuracy) : null,
            };

            setPoints((prev) => {
              if (prev.some((p) => p.id === ptObj.id)) return prev;
              return [...prev, ptObj];
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [complaintId, isLive]);

  // Map Initialization
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Center map around customer destination or default center
    const destLat = ticket.customer_lat ? Number(ticket.customer_lat) : 25.2048; // Dubai default
    const destLng = ticket.customer_lng ? Number(ticket.customer_lng) : 55.2708;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
    }).setView([destLat, destLng], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);

    mapRef.current = map;

    // Add Customer Marker
    const customerIcon = L.divIcon({
      className: "custom-customer-marker-container",
      html: `
        <div class="relative flex h-10 w-10 items-center justify-center">
          <span class="absolute inline-flex h-8 w-8 rounded-full bg-blue-400 opacity-20 animate-pulse"></span>
          <div class="relative flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 border border-white text-white shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    destMarkerRef.current = L.marker([destLat, destLng], { icon: customerIcon })
      .addTo(map)
      .bindPopup(`<b>${ticket.customer_name || "Customer Location"}</b><br/>${ticket.location || ""}`);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [ticket]);

  // Update map coordinates / polyline when points change
  useEffect(() => {
    if (!mapRef.current || points.length === 0) return;

    const map = mapRef.current;
    const latLngs = points.map((p) => [p.latitude, p.longitude] as L.LatLngTuple);

    // Update Polyline
    if (polylineRef.current) {
      polylineRef.current.setLatLngs(latLngs);
    } else {
      polylineRef.current = L.polyline(latLngs, {
        color: "#6366f1", // Indigo-500
        weight: 4,
        opacity: 0.8,
        dashArray: isLive ? "8, 6" : undefined,
      }).addTo(map);
    }

    // Determine current tracking point (either latest live point or current playback index point)
    const activeIndex = isLive ? points.length - 1 : playbackIndex;
    const currentPoint = points[activeIndex];

    if (currentPoint) {
      const techPos: L.LatLngTuple = [currentPoint.latitude, currentPoint.longitude];

      const techIcon = L.divIcon({
        className: "custom-tech-marker-container",
        html: `
          <div class="relative flex h-10 w-10 items-center justify-center">
            <span class="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 ${isLive ? 'animate-ping' : ''}"></span>
            <div class="relative flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 border border-white text-white shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-navigation"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      if (techMarkerRef.current) {
        techMarkerRef.current.setLatLng(techPos);
      } else {
        techMarkerRef.current = L.marker(techPos, { icon: techIcon })
          .addTo(map)
          .bindPopup(`<b>Technician: ${ticket.assigned_technician || "Onsite Team"}</b>`);
      }

      // Automatically adjust bounds to fit both markers
      if (ticket.customer_lat && ticket.customer_lng) {
        const bounds = L.latLngBounds([
          [Number(ticket.customer_lat), Number(ticket.customer_lng)],
          techPos,
        ]);
        map.fitBounds(bounds, { padding: [50, 50] });
      } else {
        map.setView(techPos, 14);
      }
    }
  }, [points, playbackIndex, isLive, ticket]);

  // Handle Playback Interval
  useEffect(() => {
    if (isPlaying) {
      playbackTimer.current = setInterval(() => {
        setPlaybackIndex((prev) => {
          if (prev >= points.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 600);
    } else {
      if (playbackTimer.current) {
        clearInterval(playbackTimer.current);
      }
    }

    return () => {
      if (playbackTimer.current) {
        clearInterval(playbackTimer.current);
      }
    };
  }, [isPlaying, points]);

  // Calculate Metrics
  const activeIndex = isLive ? points.length - 1 : playbackIndex;
  const activePoint = points[activeIndex];

  const distanceRemaining =
    activePoint && ticket.customer_lat && ticket.customer_lng
      ? calculateDistance(
          activePoint.latitude,
          activePoint.longitude,
          Number(ticket.customer_lat),
          Number(ticket.customer_lng)
        )
      : null;

  // Assuming average transit speed of 35 km/h
  const etaMinutes = distanceRemaining ? Math.round((distanceRemaining / 35) * 60) : null;

  // Calculate historical total stats
  const totalDistance = (() => {
    let d = 0;
    for (let i = 1; i < points.length; i++) {
      d += calculateDistance(
        points[i - 1].latitude,
        points[i - 1].longitude,
        points[i].latitude,
        points[i].longitude
      );
    }
    return d;
  })();

  const travelTimeMinutes = (() => {
    if (points.length < 2) return 0;
    const start = new Date(points[0].timestamp).getTime();
    const end = new Date(points[points.length - 1].timestamp).getTime();
    return Math.round((end - start) / 60000);
  })();

  return (
    <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md flex flex-col md:flex-row p-4 gap-4 animate-in fade-in zoom-in-95 duration-200">
      {/* Sidebar Control Panel */}
      <div className="w-full md:w-80 flex flex-col glass-card border border-border/60 rounded-2xl overflow-hidden shadow-2xl bg-card">
        {/* Header */}
        <div className="p-4 border-b border-border/40 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-foreground">Travel Route Proof</h3>
            <p className="text-[11px] text-muted-foreground">
              {isLive ? "📡 Live Technician Tracking" : "⏱️ Historic Journey Playback"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full w-8 h-8 hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* Main Status Panel */}
          {loading ? (
            <div className="space-y-2 py-4">
              <div className="h-6 w-32 bg-muted animate-pulse rounded"></div>
              <div className="h-4 w-48 bg-muted animate-pulse rounded"></div>
            </div>
          ) : points.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground space-y-2">
              <HelpCircle className="w-8 h-8 mx-auto text-muted-foreground/60" />
              <p className="text-sm font-semibold">No journey data recorded yet.</p>
              <p className="text-xs">Location coordinates will record once the transit starts.</p>
            </div>
          ) : (
            <>
              {/* Live Info Card */}
              {isLive ? (
                <div className="space-y-3">
                  <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl space-y-2.5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary animate-pulse" />
                      <span className="text-xs font-semibold text-primary">Live Transit Details</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <span className="text-[10px] text-muted-foreground block font-medium">Distance remaining</span>
                        <span className="text-sm font-bold text-foreground">
                          {distanceRemaining !== null
                            ? distanceRemaining < 0.1
                              ? "Arrived"
                              : `${distanceRemaining.toFixed(2)} km`
                            : "Calculating..."}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block font-medium">Est. ETA</span>
                        <span className="text-sm font-bold text-foreground">
                          {etaMinutes !== null
                            ? etaMinutes <= 0
                              ? "Arrived"
                              : `${etaMinutes} mins`
                            : "Calculating..."}
                        </span>
                      </div>
                    </div>
                  </div>

                  {activePoint && (
                    <div className="p-3 bg-muted/40 rounded-xl border space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Technician:</span>
                        <span className="font-semibold text-foreground truncate max-w-[150px]">
                          {ticket.assigned_technician || "On-site Team"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Ping:</span>
                        <span className="font-semibold text-foreground">
                          {new Date(activePoint.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {activePoint.battery_level !== null && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Battery Level:</span>
                          <span className="font-semibold text-foreground flex items-center gap-1">
                            <Battery className="w-3.5 h-3.5 text-muted-foreground" />
                            {activePoint.battery_level}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Playback Info Panel */
                <div className="space-y-4">
                  <div className="p-3.5 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        Completed Journey Summary
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <span className="text-[10px] text-muted-foreground block font-medium">Total Distance</span>
                        <span className="text-sm font-bold text-foreground">
                          {totalDistance.toFixed(2)} km
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block font-medium">Travel Duration</span>
                        <span className="text-sm font-bold text-foreground">
                          {travelTimeMinutes} mins
                        </span>
                      </div>
                    </div>
                  </div>

                  {activePoint && (
                    <div className="p-3 bg-muted/40 rounded-xl border space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Playback Index:</span>
                        <span className="font-semibold text-foreground">
                          {playbackIndex + 1} of {points.length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Record Time:</span>
                        <span className="font-semibold text-foreground">
                          {new Date(activePoint.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {activePoint.battery_level !== null && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Battery:</span>
                          <span className="font-semibold text-foreground flex items-center gap-1">
                            <Battery className="w-3.5 h-3.5 text-muted-foreground" />
                            {activePoint.battery_level}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Playback Controls */}
                  <div className="p-3 bg-card border rounded-xl space-y-3 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="rounded-full w-9 h-9"
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-foreground" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setIsPlaying(false);
                          setPlaybackIndex(0);
                        }}
                        className="rounded-full w-9 h-9"
                        title="Restart Playback"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {isPlaying ? "Playing..." : "Paused"}
                      </span>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={points.length - 1}
                      value={playbackIndex}
                      onChange={(e) => {
                        setIsPlaying(false);
                        setPlaybackIndex(Number(e.target.value));
                      }}
                      className="w-full accent-primary h-1 bg-muted rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Location Marker Information */}
          <div className="p-3 bg-muted/30 border rounded-xl space-y-3">
            <span className="text-xs font-semibold text-foreground block">Route Marker Guide</span>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full bg-blue-600 border border-white flex items-center justify-center shadow-sm">
                  <User className="w-2.5 h-2.5 text-white" />
                </span>
                <span className="text-muted-foreground">Customer Destination Pin</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full bg-emerald-500 border border-white flex items-center justify-center shadow-sm">
                  <Navigation className="w-2.5 h-2.5 text-white" />
                </span>
                <span className="text-muted-foreground">Technician Position Pin</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Map View Area */}
      <div className="flex-1 relative rounded-2xl overflow-hidden shadow-2xl border border-border/40">
        <div ref={mapContainerRef} className="w-full h-full z-10" />
      </div>
    </div>
  );
}
