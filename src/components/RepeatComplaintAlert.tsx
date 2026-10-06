import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { AlertTriangle, History, ChevronDown, ChevronUp, ExternalLink, Wrench, ShieldAlert, Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatComplaintTicketId } from "@/services/complaintService";
import { Link } from "react-router-dom";

interface RepeatComplaintAlertProps {
  currentTicketId: string;
  customerId?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  assets?: any[];
  ticketTitle?: string;
}

export function RepeatComplaintAlert({
  currentTicketId,
  customerId,
  customerPhone,
  customerName,
  assets = [],
  ticketTitle = "",
}: RepeatComplaintAlertProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const cleanPhone = (customerPhone || "").replace(/\D/g, "");

  const { data: pastComplaints = [], isLoading } = useQuery({
    queryKey: ["repeat-complaints-check", currentTicketId, customerId, cleanPhone, customerName],
    queryFn: async () => {
      if (!currentTicketId) return [];

      let query = supabase
        .from("complaints")
        .select(`
          id,
          ticket_id,
          title,
          status,
          severity,
          created_at,
          resolution,
          resolution_notes,
          assigned_technician,
          customer_phone,
          customer_name,
          customer_id
        `)
        .neq("id", currentTicketId)
        .order("created_at", { ascending: false })
        .limit(20);

      // Match on customer id OR clean phone OR customer name (PostgREST requires double quotes around values with spaces/symbols)
      const orClauses: string[] = [];
      if (customerId) orClauses.push(`customer_id.eq."${customerId}"`);
      if (cleanPhone && cleanPhone.length >= 7) orClauses.push(`customer_phone.ilike."%${cleanPhone.slice(-10)}%"`);
      if (customerName && customerName.trim().length > 2) {
        const safeName = customerName.trim().replace(/"/g, '');
        orClauses.push(`customer_name.eq."${safeName}"`);
      }

      if (orClauses.length === 0) return [];

      query = query.or(orClauses.join(","));

      const { data, error } = await query;
      if (error) {
        console.warn("Error fetching past complaints for repeat check:", error);
        return [];
      }

      if (!data || data.length === 0) return [];

      // Fetch complaint_assets for these past complaints
      const complaintIds = data.map((c) => c.id);
      const { data: assetData } = await supabase
        .from("complaint_assets")
        .select("complaint_id, asset_name, asset_type, reported_issue")
        .in("complaint_id", complaintIds);

      const assetsMap = new Map<string, any[]>();
      (assetData || []).forEach((item) => {
        const list = assetsMap.get(item.complaint_id) || [];
        list.push(item);
        assetsMap.set(item.complaint_id, list);
      });

      return data.map((c) => ({
        ...c,
        past_assets: assetsMap.get(c.id) || [],
      }));
    },
    staleTime: 60 * 1000,
    enabled: Boolean(currentTicketId && (customerId || cleanPhone || customerName)),
  });

  if (isLoading || !pastComplaints || pastComplaints.length === 0) {
    return null;
  }

  // Current asset names (normalized)
  const currentAssetNames = (assets || [])
    .map((a) => (a.asset_name || "").trim().toLowerCase())
    .filter(Boolean);

  // Identify complaints targeting the SAME asset
  const sameAssetComplaints = pastComplaints.filter((pc) => {
    // 1. Direct asset list match
    const hasMatchingAsset = pc.past_assets?.some((pa: any) => {
      const name = (pa.asset_name || "").trim().toLowerCase();
      return currentAssetNames.some((can) => can && (can.includes(name) || name.includes(can)));
    });

    if (hasMatchingAsset) return true;

    // 2. Title match on asset keywords
    const lowerTitle = (pc.title || "").toLowerCase();
    const matchesCurrentAsset = currentAssetNames.some((can) => can.length > 2 && lowerTitle.includes(can));
    return matchesCurrentAsset;
  });

  // Calculate 90-day window
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const recentComplaints = pastComplaints.filter(
    (pc) => new Date(pc.created_at) >= ninetyDaysAgo
  );

  const isAssetRepeat = sameAssetComplaints.length > 0;
  const isCustomerRepeat = recentComplaints.length > 0;

  if (!isAssetRepeat && !isCustomerRepeat) {
    return null;
  }

  const repeatCount = isAssetRepeat ? sameAssetComplaints.length + 1 : recentComplaints.length + 1;
  const displayedComplaints = isAssetRepeat ? sameAssetComplaints : recentComplaints;

  return (
    <div className="rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 shadow-sm overflow-hidden transition-all duration-200">
      <div className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
            {isAssetRepeat ? <Cpu className="w-5 h-5 animate-pulse" /> : <ShieldAlert className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                ⚠️ Repeated Complaint Detected
              </span>
              <Badge variant="outline" className="bg-rose-100 text-rose-800 border-rose-300 font-extrabold text-[10px]">
                {repeatCount}rd Incident {isAssetRepeat ? "on Same Asset" : "for Customer"}
              </Badge>
              {isAssetRepeat && (
                <Badge variant="destructive" className="text-[10px] uppercase font-bold tracking-wider">
                  Chronic Asset Failure
                </Badge>
              )}
            </div>

            <p className="text-xs text-rose-800 dark:text-rose-300 mt-1 leading-relaxed">
              {isAssetRepeat ? (
                <>
                  This equipment has experienced <strong>{sameAssetComplaints.length} prior complaint(s)</strong>.
                  Management review is advised to determine if the hardware is defective or requires replacement under warranty.
                </>
              ) : (
                <>
                  This customer has raised <strong>{recentComplaints.length} other complaint(s)</strong> within the last 90 days.
                  Prioritize senior technician dispatch to safeguard customer retention.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="text-xs font-semibold border-rose-300 hover:bg-rose-100 text-rose-900 h-8 gap-1.5 shadow-2xs"
          >
            <History className="w-3.5 h-3.5" />
            <span>{isExpanded ? "Hide Past History" : `View ${displayedComplaints.length} Past Tickets`}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Collapsible History Table */}
      {isExpanded && (
        <div className="border-t border-rose-200 dark:border-rose-900/60 bg-white/70 dark:bg-slate-900/60 p-3 sm:p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Prior Incident History ({displayedComplaints.length})
            </span>
            <span className="text-[11px] text-muted-foreground">Click ticket to view full past resolution</span>
          </div>

          <div className="space-y-2">
            {displayedComplaints.map((pc: any, idx: number) => {
              const dateStr = pc.created_at
                ? new Date(pc.created_at).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "N/A";

              const assetSummary = (pc.past_assets || []).map((a: any) => a.asset_name).join(", ");

              return (
                <div
                  key={pc.id || idx}
                  className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-rose-300 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to={`/complaints/${pc.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-mono font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        {formatComplaintTicketId(pc)}
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </Link>
                      <span className="text-[10px] text-muted-foreground">• {dateStr}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold uppercase">
                        {pc.status}
                      </span>
                      {pc.assigned_technician && (
                        <span className="text-[10px] text-slate-600 flex items-center gap-1">
                          <Wrench className="w-3 h-3 text-slate-400" />
                          {pc.assigned_technician}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate mt-0.5">
                      {pc.title}
                      {assetSummary && <span className="text-slate-500 font-normal"> (Assets: {assetSummary})</span>}
                    </p>
                    {(pc.resolution || pc.resolution_notes) && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1 mt-0.5 italic">
                        Resolution: "{pc.resolution || pc.resolution_notes}"
                      </p>
                    )}
                  </div>

                  <Link
                    to={`/complaints/${pc.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-[11px] font-semibold text-rose-700 hover:text-rose-900 px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                  >
                    Open Ticket →
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
