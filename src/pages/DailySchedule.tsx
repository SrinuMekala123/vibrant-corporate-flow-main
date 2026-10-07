import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Printer, Download, Wrench, AlertCircle, Layers, Navigation, Phone, Clock, MapPin, User, Eye, X, FileText, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase, resolveSupabaseUrl } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DayPickerCalendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { toast } from "sonner";
import { formatComplaintTicketId } from "@/services/complaintService";
import { formatInstallationTicketId } from "@/services/installationService";
import { complaintService } from "@/services/complaintService";
import { installationService } from "@/services/installationService";
import { getEvidenceCategory, getEvidenceFileName, getFileExtension } from "@/utils/evidenceFileHelpers";

export interface UnifiedScheduleTask {
  id: string;
  raw_id: string;
  task_type: "complaint" | "installation";
  ticket_id: string;
  scheduled_date: string;
  scheduled_time: string;
  technician_name: string;
  technician_id_display: string;
  assigned_technician_ids: string[];
  assigned_supervisor?: string | null;
  client_name: string;
  contact_number: string;
  address: string;
  notes_description: string;
  status: string;
}

const formatDateToYYYYMMDD = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateToDDMMYYYY = (d: Date) => {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
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

const formatText = (text?: string, maxLen = 45) => {
  if (!text) return "N/A";
  return text.length > maxLen ? `${text.substring(0, maxLen)}...` : text;
};

const getStatusBadgeClass = (status?: string) => {
  const s = (status || "").toLowerCase().trim();
  if (["completed", "resolved", "verified", "site completed and handed over"].includes(s)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (["in-progress", "in_progress", "inprogress", "work in progress", "configuration pending"].includes(s)) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }
  if (["assigned", "pending"].includes(s)) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  if (["pending due to material shortage", "signature pending due to client unavailability"].includes(s)) {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
};

const escapeHtml = (unsafe?: string | null): string => {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const renderEvidenceGridHtml = (images: any[], title: string): string => {
  if (!images || !Array.isArray(images) || images.length === 0) {
    return `<div style="font-style: italic; color: #94a3b8; font-size: 10px; padding: 4px 0;">No evidence files or photos submitted.</div>`;
  }
  const itemsHtml = images.map((item, idx) => {
    const rawUrl = typeof item === "string" ? item : (item?.url || item?.src || item?.path || "");
    const resolved = resolveSupabaseUrl(item);
    if (!resolved) return "";

    const category = getEvidenceCategory(resolved || rawUrl);
    const rawExt = getFileExtension(resolved || rawUrl);
    const rawFileName = getEvidenceFileName(resolved || rawUrl, `${title} #${idx + 1}`);
    const cleanFileName = rawFileName.replace(/^\d{10,13}[-_]/, "") || rawFileName;

    if (category === "image") {
      const extTag = (rawExt || "IMG").toUpperCase();
      return `
        <div class="photo-item photo-type-image">
          <a href="${escapeHtml(resolved)}" target="_blank" rel="noopener noreferrer" title="Click to view full image (${escapeHtml(cleanFileName)})" style="text-decoration: none; display: block;">
            <div class="media-thumb-wrap">
              <img src="${escapeHtml(resolved)}" alt="${escapeHtml(cleanFileName)}" class="photo-img" />
              <span class="file-tag-badge badge-img">.${escapeHtml(extTag)}</span>
            </div>
          </a>
          <div class="photo-caption" title="${escapeHtml(cleanFileName)}">
            <span class="badge-mini badge-img-mini">🖼️ .${escapeHtml(extTag)}</span>
            <span class="file-name-text">${escapeHtml(cleanFileName)}</span>
          </div>
        </div>
      `;
    }

    if (category === "pdf") {
      return `
        <div class="photo-item photo-type-pdf">
          <a href="${escapeHtml(resolved)}" target="_blank" rel="noopener noreferrer" title="Click to open PDF (${escapeHtml(cleanFileName)})" style="text-decoration: none; display: block;">
            <div class="doc-thumb-box pdf-box">
              <div class="doc-icon">📄</div>
              <div class="doc-ext-label">.PDF</div>
              <div class="doc-action-hint">Click to Open</div>
            </div>
          </a>
          <div class="photo-caption" title="${escapeHtml(cleanFileName)}">
            <span class="badge-mini badge-pdf-mini">📄 .PDF</span>
            <span class="file-name-text">${escapeHtml(cleanFileName)}</span>
          </div>
        </div>
      `;
    }

    if (category === "spreadsheet") {
      const extTag = (rawExt || "CSV").toUpperCase();
      return `
        <div class="photo-item photo-type-csv">
          <a href="${escapeHtml(resolved)}" target="_blank" rel="noopener noreferrer" title="Click to view Spreadsheet (${escapeHtml(cleanFileName)})" style="text-decoration: none; display: block;">
            <div class="doc-thumb-box csv-box">
              <div class="doc-icon">📊</div>
              <div class="doc-ext-label">.${escapeHtml(extTag)}</div>
              <div class="doc-action-hint">Click to View</div>
            </div>
          </a>
          <div class="photo-caption" title="${escapeHtml(cleanFileName)}">
            <span class="badge-mini badge-csv-mini">📊 .${escapeHtml(extTag)}</span>
            <span class="file-name-text">${escapeHtml(cleanFileName)}</span>
          </div>
        </div>
      `;
    }

    if (category === "video") {
      const extTag = (rawExt || "MP4").toUpperCase();
      return `
        <div class="photo-item photo-type-video">
          <a href="${escapeHtml(resolved)}" target="_blank" rel="noopener noreferrer" title="Click to view Video (${escapeHtml(cleanFileName)})" style="text-decoration: none; display: block;">
            <div class="doc-thumb-box video-box">
              <div class="doc-icon">🎬</div>
              <div class="doc-ext-label">.${escapeHtml(extTag)}</div>
              <div class="doc-action-hint">▶ View Video</div>
            </div>
          </a>
          <div class="photo-caption" title="${escapeHtml(cleanFileName)}">
            <span class="badge-mini badge-video-mini">🎬 .${escapeHtml(extTag)}</span>
            <span class="file-name-text">${escapeHtml(cleanFileName)}</span>
          </div>
        </div>
      `;
    }

    if (category === "audio") {
      const extTag = (rawExt || "AUDIO").toUpperCase();
      return `
        <div class="photo-item photo-type-audio">
          <a href="${escapeHtml(resolved)}" target="_blank" rel="noopener noreferrer" title="Click to listen to Audio (${escapeHtml(cleanFileName)})" style="text-decoration: none; display: block;">
            <div class="doc-thumb-box audio-box">
              <div class="doc-icon">🎵</div>
              <div class="doc-ext-label">.${escapeHtml(extTag)}</div>
              <div class="doc-action-hint">▶ Listen</div>
            </div>
          </a>
          <div class="photo-caption" title="${escapeHtml(cleanFileName)}">
            <span class="badge-mini badge-audio-mini">🎵 .${escapeHtml(extTag)}</span>
            <span class="file-name-text">${escapeHtml(cleanFileName)}</span>
          </div>
          <audio src="${escapeHtml(resolved)}" controls class="audio-player-sm no-print" style="width: 100%; height: 22px; margin-top: 3px;"></audio>
        </div>
      `;
    }

    // Default / Other Documents
    const extTag = (rawExt || "DOC").toUpperCase();
    return `
      <div class="photo-item photo-type-doc">
        <a href="${escapeHtml(resolved)}" target="_blank" rel="noopener noreferrer" title="Click to open File (${escapeHtml(cleanFileName)})" style="text-decoration: none; display: block;">
          <div class="doc-thumb-box generic-box">
            <div class="doc-icon">📁</div>
            <div class="doc-ext-label">.${escapeHtml(extTag)}</div>
            <div class="doc-action-hint">Click to Open</div>
          </div>
        </a>
        <div class="photo-caption" title="${escapeHtml(cleanFileName)}">
          <span class="badge-mini badge-doc-mini">📁 .${escapeHtml(extTag)}</span>
          <span class="file-name-text">${escapeHtml(cleanFileName)}</span>
        </div>
      </div>
    `;
  }).filter(Boolean).join("");

  return itemsHtml ? `<div class="photo-grid">${itemsHtml}</div>` : `<div style="font-style: italic; color: #94a3b8; font-size: 10px; padding: 4px 0;">No evidence files or photos submitted.</div>`;
};

const generateComplaintPrintHtml = (c: any, item: UnifiedScheduleTask, techList: any[] = []): string => {
  const ticketId = c.ticket_id || item.ticket_id;
  const printedAtStr = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const registeredAtStr = c.created_at ? new Date(c.created_at).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }) : "N/A";

  const arrivalStr = c.arrival_timestamp ? new Date(c.arrival_timestamp).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }) : (c.scheduled_time || "N/A");

  // Technicians with lead marked with 👑
  let techHtml = "";
  if (c.complaint_technicians && c.complaint_technicians.length > 0) {
    const sorted = [...c.complaint_technicians].sort((a: any, b: any) => {
      if (a.is_lead === b.is_lead) return 0;
      return a.is_lead ? -1 : 1;
    });
    techHtml = sorted.map((ct: any) => {
      const t = ct.technician || ct.profiles || techList.find((tech: any) => tech.id === ct.technician_id);
      const name = t?.full_name || "Technician";
      const isLead = ct.is_lead === true || ct.is_lead === "true";
      const techId = formatTechId(t);
      const phone = t?.phone ? `(${t.phone})` : "";
      return `<div style="margin-bottom: 3px;">${isLead ? "👑 <strong>" + escapeHtml(name) + "</strong> <span style=\"font-size:8.5px; background:#dbeafe; color:#1e40af; padding:1px 4px; border-radius:3px; font-weight:bold;\">LEAD</span>" : escapeHtml(name)} ${techId ? `<span style="font-family:monospace; color:#64748b;">[${escapeHtml(techId)}]</span>` : ""} ${escapeHtml(phone)}</div>`;
    }).join("");
  } else {
    techHtml = `<div>${escapeHtml(item.technician_name || "Unassigned")} ${item.technician_id_display ? `<span style="font-family:monospace; color:#64748b;">[${escapeHtml(item.technician_id_display)}]</span>` : ""}</div>`;
  }

  // PIR files & photos: evidence_urls, complaint_images, pir_audio_url
  const rawPirList = [
    ...(Array.isArray(c.evidence_urls) ? c.evidence_urls : []),
    ...(Array.isArray(c.complaint_images) ? c.complaint_images : []),
    ...(c.pir_audio_url ? [c.pir_audio_url] : []),
  ].filter(Boolean);
  const pirImages: string[] = Array.from(new Set(rawPirList));

  // Resolution files & photos: technician_evidence, resolution_audio_url
  const rawResList = [
    ...(Array.isArray(c.technician_evidence) ? c.technician_evidence : []),
    ...(c.resolution_audio_url ? [c.resolution_audio_url] : []),
  ].filter(Boolean);
  const resImages: string[] = Array.from(new Set(rawResList));

  const signatureUrl = c.signature_url ? resolveSupabaseUrl(c.signature_url) : null;

  const isOtpVerified = Boolean(
    c.happiness_code_verified === true ||
    c.happiness_code_verified === "true" ||
    (typeof c.status === "string" && c.status.toLowerCase().trim() === "verified") ||
    c.feedback_collected === true
  );

  // Multi-asset line items table
  const complaintAssets: any[] = Array.isArray(c.complaint_assets) ? c.complaint_assets : [];
  const totalAssetCharge = complaintAssets.reduce(
    (sum: number, a: any) => sum + (a.is_chargeable ? (Number(a.service_charge) || 0) : 0),
    0
  );

  let assetsTableHtml = "";
  if (complaintAssets.length > 0) {
    assetsTableHtml = `
    <!-- Assets & Line Items Table (Multi-Asset) -->
    <div class="section-card">
      <div class="section-header" style="display: flex; justify-content: space-between; align-items: center;">
        <span>Assets & Line Items to Service (${complaintAssets.length})</span>
        <span style="font-size: 9px; font-weight: normal; color: #475569;">Multi-Asset Service Breakdown</span>
      </div>
      <div class="section-body" style="padding: 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 1.5px solid #cbd5e1; text-align: left;">
              <th style="padding: 5px 8px; width: 28px; text-align: center;">#</th>
              <th style="padding: 5px 8px;">Asset Name</th>
              <th style="padding: 5px 8px; width: 85px;">Type</th>
              <th style="padding: 5px 8px;">Reported Issue</th>
              <th style="padding: 5px 8px; width: 140px; text-align: center;">Warranty Status</th>
              <th style="padding: 5px 8px; width: 80px; text-align: right;">Charge (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${complaintAssets.map((a: any, idx: number) => {
              const isExpired = a.warranty_status === "Expired" || Boolean(a.is_chargeable);
              const charge = a.service_charge ? Number(a.service_charge) : 0;
              const badgeText = isExpired
                ? `[Expired - ₹${charge.toLocaleString("en-IN")}]`
                : `[Active - Under Warranty]`;
              return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 5px 8px; text-align: center; color: #64748b; font-family: monospace;">${idx + 1}</td>
                  <td style="padding: 5px 8px; font-weight: 600; color: #0f172a;">${escapeHtml(a.asset_name || "Asset #" + (idx + 1))}</td>
                  <td style="padding: 5px 8px; color: #475569;">${escapeHtml(a.asset_type || "General")}</td>
                  <td style="padding: 5px 8px; color: #334155;">${escapeHtml(a.reported_issue || "No specific issue noted")}</td>
                  <td style="padding: 5px 8px; text-align: center; font-weight: 600; color: ${isExpired ? '#c2410c' : '#15803d'}; font-family: monospace;">${escapeHtml(badgeText)}</td>
                  <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 600;">${isExpired && charge > 0 ? "₹" + charge.toLocaleString("en-IN") : "—"}</td>
                </tr>
              `;
            }).join("")}
            <tr style="background: #f1f5f9; border-top: 1.5px solid #cbd5e1; font-weight: bold;">
              <td colspan="5" style="padding: 6px 8px; text-align: right;">Total Chargeable Amount:</td>
              <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #0f172a;">
                ₹${totalAssetCharge.toLocaleString("en-IN")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Service Call Report - ${escapeHtml(ticketId)}</title>
  <style>
    @page {
      size: portrait;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 0;
      color: #0f172a;
      background: #f1f5f9;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      line-height: 1.35;
      font-size: 10.5px;
    }
    .screen-toolbar {
      position: sticky;
      top: 0;
      z-index: 9999;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    }
    .toolbar-title {
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
      color: #f8fafc;
    }
    .toolbar-actions {
      display: flex;
      gap: 10px;
    }
    .btn-action {
      padding: 6px 15px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 5px;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s ease;
    }
    .btn-print {
      background: #2563eb;
      color: #ffffff;
    }
    .btn-print:hover {
      background: #1d4ed8;
    }
    .btn-close {
      background: #475569;
      color: #f8fafc;
    }
    .btn-close:hover {
      background: #334155;
    }
    .page-sheet {
      max-width: 210mm;
      margin: 20px auto 40px auto;
      background: #ffffff;
      padding: 14mm 16mm;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
      border-radius: 4px;
      min-height: 280mm;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .brand-title {
      font-size: 19px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #0f172a;
    }
    .brand-subtitle {
      font-size: 12px;
      font-weight: 800;
      color: #ea580c;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .header-right {
      text-align: right;
    }
    .ticket-badge {
      font-family: monospace;
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      background: #f1f5f9;
      border: 1.5px solid #cbd5e1;
      padding: 3px 8px;
      border-radius: 4px;
      display: inline-block;
    }
    .print-date {
      font-size: 9px;
      color: #64748b;
      margin-top: 3px;
    }
    .section-card {
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      margin-bottom: 10px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .section-header {
      background: #f8fafc;
      border-bottom: 1px solid #cbd5e1;
      padding: 5px 8px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1e293b;
    }
    .section-body {
      padding: 8px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .field-group {
      margin-bottom: 4px;
    }
    .field-lbl {
      font-size: 8.5px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
    }
    .field-val {
      font-size: 10.5px;
      font-weight: 600;
      color: #0f172a;
      word-break: break-word;
    }
    .badge-pill {
      display: inline-block;
      padding: 1.5px 6px;
      border-radius: 3px;
      font-size: 8.5px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .photo-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 6px;
    }
    .photo-item {
      width: 145px;
      max-width: 145px;
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
      background: #ffffff;
      padding: 5px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-inside: avoid;
      box-sizing: border-box;
    }
    .media-thumb-wrap {
      position: relative;
      width: 100%;
      height: 110px;
      border-radius: 4px;
      overflow: hidden;
      background: #f8fafc;
    }
    .photo-img {
      width: 100%;
      height: 110px;
      object-fit: contain;
      background: #f8fafc;
      border-radius: 4px;
      display: block;
    }
    .file-tag-badge {
      position: absolute;
      top: 4px;
      right: 4px;
      font-size: 7.5px;
      font-weight: 800;
      padding: 1px 5px;
      border-radius: 3px;
      letter-spacing: 0.5px;
      background: rgba(15, 23, 42, 0.85);
      color: #ffffff;
    }
    .doc-thumb-box {
      width: 100%;
      height: 110px;
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 6px;
      border: 1.5px dashed #cbd5e1;
      box-sizing: border-box;
      background: #f8fafc;
    }
    .doc-icon {
      font-size: 30px;
      line-height: 1;
      margin-bottom: 4px;
    }
    .doc-ext-label {
      font-family: monospace;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.8px;
    }
    .doc-action-hint {
      font-size: 8px;
      font-weight: 600;
      margin-top: 4px;
      color: #64748b;
    }
    .pdf-box {
      background: #fef2f2;
      border-color: #fca5a5;
      color: #b91c1c;
    }
    .csv-box {
      background: #f0fdf4;
      border-color: #86efac;
      color: #15803d;
    }
    .video-box {
      background: #faf5ff;
      border-color: #d8b4fe;
      color: #7e22ce;
    }
    .audio-box {
      background: #fffbeb;
      border-color: #fde68a;
      color: #b45309;
    }
    .generic-box {
      background: #f1f5f9;
      border-color: #cbd5e1;
      color: #334155;
    }
    .photo-caption {
      font-size: 8.5px;
      font-weight: 700;
      color: #334155;
      margin-top: 4px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      align-items: center;
      width: 100%;
      overflow: hidden;
    }
    .badge-mini {
      display: inline-block;
      font-size: 8px;
      font-weight: 800;
      padding: 1.5px 6px;
      border-radius: 3px;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      max-width: 100%;
    }
    .badge-img-mini { background: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .badge-pdf-mini { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
    .badge-csv-mini { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    .badge-video-mini { background: #f3e8ff; color: #7e22ce; border: 1px solid #e9d5ff; }
    .badge-audio-mini { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .badge-doc-mini { background: #e2e8f0; color: #334155; border: 1px solid #cbd5e1; }
    .file-name-text {
      font-size: 8px;
      font-weight: 600;
      color: #475569;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 135px;
      display: block;
      margin-top: 1px;
    }
    .sig-container {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 6px;
    }
    .sig-img-box {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 4px;
      background: #ffffff;
      width: 160px;
      height: 65px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sig-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .signoff-strip {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1.5px solid #94a3b8;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      page-break-inside: avoid;
    }
    .sig-line {
      margin-top: 25px;
      border-bottom: 1px dotted #475569;
      width: 130px;
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .no-print, .screen-toolbar, .audio-player-sm {
        display: none !important;
      }
      .page-sheet {
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        min-height: auto !important;
      }
      .doc-thumb-box, .photo-item, .badge-mini {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <!-- Sticky Screen Preview Toolbar (Hidden in Print) -->
  <div class="screen-toolbar no-print">
    <div class="toolbar-title">
      <span>📄 Service Call Report Preview — <strong>${escapeHtml(ticketId)}</strong></span>
      ${isOtpVerified ? `<span style="background: #059669; color: #ffffff; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px;">✓ VERIFIED BY OTP</span>` : ""}
    </div>
    <div class="toolbar-actions">
      <button onclick="window.print()" class="btn-action btn-print">🖨️ Print Report</button>
      <button onclick="if(window.parent&&window.parent!==window){window.parent.postMessage('close-in-app-print','*');}else{window.close();}" class="btn-action btn-close">✕ Close Preview</button>
    </div>
  </div>

  <!-- A4 Page Sheet Container -->
  <div class="page-sheet">
    <!-- Header -->
    <div class="header">
      <div>
        <div class="brand-title">Brihaspathi Technologies</div>
        <div class="brand-subtitle">SERVICE CALL REPORT</div>
      </div>
      <div class="header-right">
        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px; margin-bottom: 3px;">
          <div class="ticket-badge">${escapeHtml(ticketId)}</div>
          ${isOtpVerified ? `<span style="background: #059669; color: #ffffff; font-size: 9px; font-weight: 800; padding: 3px 8px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">✓ VERIFIED BY OTP</span>` : ""}
        </div>
        <div class="print-date">Report Date: ${escapeHtml(printedAtStr)}</div>
      </div>
    </div>

    <!-- Customer Info -->
    <div class="section-card">
      <div class="section-header">Customer & Site Information</div>
      <div class="section-body grid-3">
        <div class="field-group">
          <div class="field-lbl">Customer Name</div>
          <div class="field-val">${escapeHtml(c.customer_name || c.profiles?.full_name || item.client_name)}</div>
        </div>
        <div class="field-group">
          <div class="field-lbl">Contact Phone</div>
          <div class="field-val">${escapeHtml(c.customer_phone || c.profiles?.phone || item.contact_number)}</div>
        </div>
        <div class="field-group">
          <div class="field-lbl">Category / Field of Work</div>
          <div class="field-val">${escapeHtml(c.field_of_work || c.category || "General Maintenance")}</div>
        </div>
        <div class="field-group" style="grid-column: span 2;">
          <div class="field-lbl">Address / Location</div>
          <div class="field-val">${escapeHtml(c.location || item.address)}</div>
        </div>
        <div class="field-group">
          <div class="field-lbl">Severity / Priority</div>
          <div class="field-val">${escapeHtml(c.severity || c.priority || "Standard")}</div>
        </div>
      </div>
    </div>

    ${assetsTableHtml}

    <!-- Assignment -->
    <div class="section-card">
      <div class="section-header">Assignment & Field Crew</div>
      <div class="section-body grid-3">
        <div class="field-group">
          <div class="field-lbl">Field Supervisor</div>
          <div class="field-val">${escapeHtml(c.assigned_supervisor || item.assigned_supervisor || "Not assigned")}</div>
        </div>
        <div class="field-group">
          <div class="field-lbl">Scheduled Date & Time</div>
          <div class="field-val">${escapeHtml(c.scheduled_date || item.scheduled_date || "N/A")} at ${escapeHtml(c.scheduled_time || item.scheduled_time || "N/A")}</div>
        </div>
        <div class="field-group">
          <div class="field-lbl">Assigned Field Technicians</div>
          <div class="field-val">${techHtml}</div>
        </div>
      </div>
    </div>

    <!-- Phase 1: Intake -->
    <div class="section-card">
      <div class="section-header">Phase 1: Complaint Intake</div>
      <div class="section-body grid-2">
        <div class="field-group" style="grid-column: span 2;">
          <div class="field-lbl">Issue Title</div>
          <div class="field-val" style="font-weight: 700; color: #1e3a8a;">${escapeHtml(c.title || item.notes_description)}</div>
        </div>
        <div class="field-group" style="grid-column: span 2;">
          <div class="field-lbl">Detailed Description</div>
          <div class="field-val" style="white-space: pre-wrap;">${escapeHtml(c.description || "N/A")}</div>
        </div>
        <div class="field-group">
          <div class="field-lbl">Registered Date & Time</div>
          <div class="field-val">${escapeHtml(registeredAtStr)}</div>
        </div>
        <div class="field-group">
          <div class="field-lbl">Registered By</div>
          <div class="field-val">${escapeHtml(c.created_by_name || "Customer / Helpdesk")}</div>
        </div>
      </div>
    </div>

    <!-- Phase 3: Dispatch -->
    <div class="section-card">
      <div class="section-header">Phase 3: Dispatch & Instructions</div>
      <div class="section-body grid-2">
        <div class="field-group">
          <div class="field-lbl">Dispatch Status</div>
          <div style="margin-top: 2px; display: flex; align-items: center; gap: 6px;">
            <span class="badge-pill" style="background:#e0f2fe; color:#0369a1; border:1px solid #7dd3fc;">${escapeHtml(c.status || item.status)}</span>
            ${isOtpVerified ? `<span class="badge-pill" style="background:#d1fae5; color:#065f46; border:1px solid #6ee7b7;">✓ OTP Verified</span>` : ""}
          </div>
        </div>
        <div class="field-group">
          <div class="field-lbl">Supervisor Instructions</div>
          <div class="field-val" style="white-space: pre-wrap;">${escapeHtml(c.supervisor_notes || "Standard field service protocol.")}</div>
        </div>
      </div>
    </div>

    <!-- Phase 4: Execution -->
    <div class="section-card">
      <div class="section-header">Phase 4: Field Execution & Preliminary Inspection (PIR)</div>
      <div class="section-body">
        <div class="grid-3">
          <div class="field-group">
            <div class="field-lbl">Observed Severity</div>
            <div class="field-val">${escapeHtml(c.pir_findings_severity || c.supervisor_severity || c.severity || "Standard")}</div>
          </div>
          <div class="field-group">
            <div class="field-lbl">Arrival / On-site Time</div>
            <div class="field-val">${escapeHtml(arrivalStr)}</div>
          </div>
          <div class="field-group">
            <div class="field-lbl">Target Duration</div>
            <div class="field-val">${escapeHtml(c.target_duration_hours ? c.target_duration_hours + " hours" : "Standard SLA")}</div>
          </div>
        </div>
        <div class="field-group" style="margin-top: 6px;">
          <div class="field-lbl">PIR Diagnostic Findings</div>
          <div class="field-val" style="white-space: pre-wrap;">${escapeHtml(c.pir_findings || "No specific diagnostic findings recorded.")}</div>
        </div>
        <div style="margin-top: 6px;">
          <div class="field-lbl">PIR Evidence Files & Photos (Pre-Service)</div>
          ${renderEvidenceGridHtml(pirImages, "PIR Evidence")}
        </div>
      </div>
    </div>

    <!-- Phase 5: Resolution -->
    <div class="section-card">
      <div class="section-header">Phase 5: Resolution & Spares Utilized</div>
      <div class="section-body">
        <div class="grid-2">
          <div class="field-group">
            <div class="field-lbl">Resolution Notes</div>
            <div class="field-val" style="white-space: pre-wrap;">${escapeHtml(c.resolution_notes || c.resolution || "Service completed as per standard procedure.")}</div>
          </div>
          <div class="field-group">
            <div class="field-lbl">Spares / Materials Used</div>
            <div class="field-val">${escapeHtml(c.spares_used || c.parts_used || (c.chargeable_service ? "Chargeable components / spares replaced" : "Standard parts / No major spare replaced"))}</div>
          </div>
          <div class="field-group" style="grid-column: span 2;">
            <div class="field-lbl">Technician Remarks</div>
            <div class="field-val">${escapeHtml(c.technician_remarks || c.remarks || c.resolution_type || "All systems checked and functional.")}</div>
          </div>
        </div>

        <div style="margin-top: 6px;">
          <div class="field-lbl">Resolution Evidence Files & Photos (Post-Service)</div>
          ${renderEvidenceGridHtml(resImages, "Resolution Evidence")}
        </div>

        <div style="margin-top: 8px;">
          <div class="field-lbl">Customer Digital Signature</div>
          <div class="sig-container">
            <div class="sig-img-box">
              ${signatureUrl ? `<img src="${escapeHtml(signatureUrl)}" alt="Customer Signature" class="sig-img" />` : `<span style="font-size: 9px; color:#94a3b8; font-style: italic;">Pending Signature</span>`}
            </div>
            <div style="font-size: 9px; color: #475569;">
              <div>Signed on site upon physical inspection & resolution.</div>
              <div><strong>Signoff Timestamp:</strong> ${escapeHtml(c.signoff_timestamp ? new Date(c.signoff_timestamp).toLocaleString("en-IN") : "Recorded on field")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Phase 6: Verification -->
    <div class="section-card">
      <div class="section-header" style="display: flex; justify-content: space-between; align-items: center;">
        <span>Phase 6: Quality Verification & Customer Feedback</span>
        ${isOtpVerified 
          ? `<span style="background: #059669; color: #ffffff; font-size: 9px; font-weight: 800; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px;">✓ VERIFIED BY OTP</span>` 
          : `<span style="background: #f59e0b; color: #ffffff; font-size: 9px; font-weight: 800; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px;">⏳ PENDING OTP VERIFICATION</span>`}
      </div>
      <div class="section-body grid-3">
        <div class="field-group">
          <div class="field-lbl">Customer Happiness Code (OTP)</div>
          <div class="field-val" style="margin-top: 3px;">
            ${isOtpVerified ? `
              <div style="display: inline-flex; align-items: center; gap: 6px;">
                <span style="font-family: monospace; font-size: 13px; font-weight: 800; color: #065f46; background: #d1fae5; border: 1.5px solid #059669; padding: 2px 8px; border-radius: 4px; letter-spacing: 1px;">
                  ${escapeHtml(c.happiness_code ? String(c.happiness_code) : "VERIFIED")}
                </span>
                <span style="background: #059669; color: #ffffff; font-size: 9px; font-weight: 800; padding: 2px 7px; border-radius: 3px; display: inline-flex; align-items: center; gap: 3px;">
                  ✓ VERIFIED BY OTP
                </span>
              </div>
            ` : `
              <div style="display: inline-flex; align-items: center; gap: 6px;">
                <span style="font-family: monospace; font-size: 12px; font-weight: 700; color: #64748b; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 2px 8px; border-radius: 4px;">
                  ${escapeHtml(c.happiness_code ? String(c.happiness_code) : "PENDING")}
                </span>
                <span style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-size: 8.5px; font-weight: 700; padding: 2px 6px; border-radius: 3px;">
                  Pending Verification
                </span>
              </div>
            `}
          </div>
        </div>
        <div class="field-group">
          <div class="field-lbl">Customer Satisfaction</div>
          <div class="field-val" style="color: ${isOtpVerified ? "#065f46" : "#0f172a"}; font-weight: 700;">
            ${isOtpVerified ? "✓ Customer Verified & Satisfied (OTP Confirmed)" : escapeHtml(c.customer_satisfaction || "Pending Customer Confirmation")}
          </div>
        </div>
        <div class="field-group">
          <div class="field-lbl">Verified By / Timestamp</div>
          <div class="field-val">${escapeHtml(c.closed_by || c.resolved_by || "Admin Operations")} · ${escapeHtml(c.feedback_timestamp || c.closure_timestamp ? new Date(c.feedback_timestamp || c.closure_timestamp).toLocaleString("en-IN") : (isOtpVerified ? "Verified" : "Pending"))}</div>
        </div>
        <div class="field-group" style="grid-column: span 3;">
          <div class="field-lbl">Customer Feedback Comments</div>
          <div class="field-val">${escapeHtml(c.feedback_comments || (isOtpVerified ? "Customer validated job completion with happiness OTP verification." : "Customer expressed full satisfaction with the resolution."))}</div>
        </div>
      </div>
    </div>

    <!-- Footer Signatures -->
    <div class="signoff-strip">
      <div>
        <strong style="color: #0f172a;">Lead Field Technician:</strong>
        <div class="sig-line"></div>
        <div style="font-size: 8px; color: #64748b; margin-top: 2px;">Signature & Date</div>
      </div>
      <div>
        <strong style="color: #0f172a;">Field Operations Supervisor:</strong>
        <div class="sig-line"></div>
        <div style="font-size: 8px; color: #64748b; margin-top: 2px;">Verification Signature & Date</div>
      </div>
      <div>
        <strong style="color: #0f172a;">Customer Acknowledgment:</strong>
        <div class="sig-line"></div>
        <div style="font-size: 8px; color: #64748b; margin-top: 2px;">Signature & Stamp</div>
      </div>
    </div>
  </div>
</body>
</html>`;
};

const generateInstallationPrintHtml = (inst: any, item: UnifiedScheduleTask, techList: any[] = []): string => {
  const ticketId = inst.ticket_id || item.ticket_id;
  const printedAtStr = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  // Client info
  const clientName = (inst.customer_type === "BTL" ? inst.customer?.full_name : inst.non_btl_customer_name) || item.client_name;
  const contactPhone = (inst.customer_type === "BTL" ? inst.customer?.phone : inst.non_btl_contact_number) || item.contact_number;
  const addressStr = item.address;

  // Technicians with lead marked with 👑
  let techHtml = "";
  if (inst.installation_technicians && inst.installation_technicians.length > 0) {
    const sorted = [...inst.installation_technicians].sort((a: any, b: any) => {
      if (a.is_lead === b.is_lead) return 0;
      return a.is_lead ? -1 : 1;
    });
    techHtml = sorted.map((it: any) => {
      const t = it.technician || techList.find((tech: any) => tech.id === it.technician_id);
      const name = t?.full_name || "Technician";
      const isLead = it.is_lead === true || it.is_lead === "true";
      const techId = formatTechId(t);
      const phone = t?.phone ? `(${t.phone})` : "";
      return `<div style="margin-bottom: 3px;">${isLead ? "👑 <strong>" + escapeHtml(name) + "</strong> <span style=\"font-size:8.5px; background:#dbeafe; color:#1e40af; padding:1px 4px; border-radius:3px; font-weight:bold;\">LEAD</span>" : escapeHtml(name)} ${techId ? `<span style="font-family:monospace; color:#64748b;">[${escapeHtml(techId)}]</span>` : ""} ${escapeHtml(phone)}</div>`;
    }).join("");
  } else {
    techHtml = `<div>${escapeHtml(item.technician_name || "Unassigned")} ${item.technician_id_display ? `<span style="font-family:monospace; color:#64748b;">[${escapeHtml(item.technician_id_display)}]</span>` : ""}</div>`;
  }

  // Evidence photos
  const rawEvidence = Array.isArray(inst.evidence_photos)
    ? inst.evidence_photos
    : (Array.isArray(inst.evidence_urls) ? inst.evidence_urls : []);
  const evidencePhotos: string[] = rawEvidence
    .map((p: any) => resolveSupabaseUrl(p))
    .filter(Boolean);
  const signatureUrl = inst.customer_signature ? resolveSupabaseUrl(inst.customer_signature) : null;

  const isOtpVerified = Boolean(
    inst.happiness_code_verified === true ||
    inst.happiness_code_verified === "true" ||
    (typeof inst.status === "string" && inst.status.toLowerCase().trim() === "verified") ||
    inst.feedback_collected === true
  );

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Installation Work Order - ${escapeHtml(ticketId)}</title>
  <style>
    @page {
      size: portrait;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 0;
      color: #0f172a;
      background: #f1f5f9;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      line-height: 1.35;
      font-size: 10.5px;
    }
    .screen-toolbar {
      position: sticky;
      top: 0;
      z-index: 9999;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    }
    .toolbar-title {
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
      color: #f8fafc;
    }
    .toolbar-actions {
      display: flex;
      gap: 10px;
    }
    .btn-action {
      padding: 6px 15px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 5px;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s ease;
    }
    .btn-print {
      background: #2563eb;
      color: #ffffff;
    }
    .btn-print:hover {
      background: #1d4ed8;
    }
    .btn-close {
      background: #475569;
      color: #f8fafc;
    }
    .btn-close:hover {
      background: #334155;
    }
    .page-sheet {
      max-width: 210mm;
      margin: 20px auto 40px auto;
      background: #ffffff;
      padding: 14mm 16mm;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
      border-radius: 4px;
      min-height: 280mm;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .brand-title {
      font-size: 19px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #0f172a;
    }
    .brand-subtitle {
      font-size: 12px;
      font-weight: 800;
      color: #2563eb;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .header-right {
      text-align: right;
    }
    .ticket-badge {
      font-family: monospace;
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      background: #f1f5f9;
      border: 1.5px solid #cbd5e1;
      padding: 3px 8px;
      border-radius: 4px;
      display: inline-block;
    }
    .print-date {
      font-size: 9px;
      color: #64748b;
      margin-top: 3px;
    }
    .section-card {
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      margin-bottom: 10px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .section-header {
      background: #f8fafc;
      border-bottom: 1px solid #cbd5e1;
      padding: 5px 8px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1e293b;
    }
    .section-body {
      padding: 8px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .field-group {
      margin-bottom: 4px;
    }
    .field-lbl {
      font-size: 8.5px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
    }
    .field-val {
      font-size: 10.5px;
      font-weight: 600;
      color: #0f172a;
      word-break: break-word;
    }
    .photo-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 6px;
    }
    .photo-item {
      width: 145px;
      max-width: 145px;
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
      background: #ffffff;
      padding: 5px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-inside: avoid;
      box-sizing: border-box;
    }
    .media-thumb-wrap {
      position: relative;
      width: 100%;
      height: 110px;
      border-radius: 4px;
      overflow: hidden;
      background: #f8fafc;
    }
    .photo-img {
      width: 100%;
      height: 110px;
      object-fit: contain;
      background: #f8fafc;
      border-radius: 4px;
      display: block;
    }
    .file-tag-badge {
      position: absolute;
      top: 4px;
      right: 4px;
      font-size: 7.5px;
      font-weight: 800;
      padding: 1px 5px;
      border-radius: 3px;
      letter-spacing: 0.5px;
      background: rgba(15, 23, 42, 0.85);
      color: #ffffff;
    }
    .doc-thumb-box {
      width: 100%;
      height: 110px;
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 6px;
      border: 1.5px dashed #cbd5e1;
      box-sizing: border-box;
      background: #f8fafc;
    }
    .doc-icon {
      font-size: 30px;
      line-height: 1;
      margin-bottom: 4px;
    }
    .doc-ext-label {
      font-family: monospace;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.8px;
    }
    .doc-action-hint {
      font-size: 8px;
      font-weight: 600;
      margin-top: 4px;
      color: #64748b;
    }
    .pdf-box {
      background: #fef2f2;
      border-color: #fca5a5;
      color: #b91c1c;
    }
    .csv-box {
      background: #f0fdf4;
      border-color: #86efac;
      color: #15803d;
    }
    .video-box {
      background: #faf5ff;
      border-color: #d8b4fe;
      color: #7e22ce;
    }
    .audio-box {
      background: #fffbeb;
      border-color: #fde68a;
      color: #b45309;
    }
    .generic-box {
      background: #f1f5f9;
      border-color: #cbd5e1;
      color: #334155;
    }
    .photo-caption {
      font-size: 8.5px;
      font-weight: 700;
      color: #334155;
      margin-top: 4px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      align-items: center;
      width: 100%;
      overflow: hidden;
    }
    .badge-mini {
      display: inline-block;
      font-size: 8px;
      font-weight: 800;
      padding: 1.5px 6px;
      border-radius: 3px;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      max-width: 100%;
    }
    .badge-img-mini { background: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .badge-pdf-mini { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
    .badge-csv-mini { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    .badge-video-mini { background: #f3e8ff; color: #7e22ce; border: 1px solid #e9d5ff; }
    .badge-audio-mini { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .badge-doc-mini { background: #e2e8f0; color: #334155; border: 1px solid #cbd5e1; }
    .file-name-text {
      font-size: 8px;
      font-weight: 600;
      color: #475569;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 135px;
      display: block;
      margin-top: 1px;
    }
    .sig-container {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 6px;
    }
    .sig-img-box {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 4px;
      background: #ffffff;
      width: 160px;
      height: 65px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sig-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .signoff-strip {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1.5px solid #94a3b8;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      page-break-inside: avoid;
    }
    .sig-line {
      margin-top: 25px;
      border-bottom: 1px dotted #475569;
      width: 130px;
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .no-print, .screen-toolbar, .audio-player-sm {
        display: none !important;
      }
      .page-sheet {
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        min-height: auto !important;
      }
      .doc-thumb-box, .photo-item, .badge-mini {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <!-- Sticky Screen Preview Toolbar (Hidden in Print) -->
  <div class="screen-toolbar no-print">
    <div class="toolbar-title">
      <span>📄 Installation Work Order Preview — <strong>${escapeHtml(ticketId)}</strong></span>
      ${isOtpVerified ? `<span style="background: #059669; color: #ffffff; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px;">✓ VERIFIED BY OTP</span>` : ""}
    </div>
    <div class="toolbar-actions">
      <button onclick="window.print()" class="btn-action btn-print">🖨️ Print Work Order</button>
      <button onclick="if(window.parent&&window.parent!==window){window.parent.postMessage('close-in-app-print','*');}else{window.close();}" class="btn-action btn-close">✕ Close Preview</button>
    </div>
  </div>

  <!-- A4 Page Sheet Container -->
  <div class="page-sheet">
    <!-- Header -->
    <div class="header">
      <div>
        <div class="brand-title">Brihaspathi Technologies</div>
        <div class="brand-subtitle">INSTALLATION WORK ORDER</div>
      </div>
      <div class="header-right">
        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px; margin-bottom: 3px;">
          <div class="ticket-badge">${escapeHtml(ticketId)}</div>
          ${isOtpVerified ? `<span style="background: #059669; color: #ffffff; font-size: 9px; font-weight: 800; padding: 3px 8px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">✓ VERIFIED BY OTP</span>` : ""}
        </div>
        <div class="print-date">Work Order Date: ${escapeHtml(printedAtStr)}</div>
      </div>
    </div>

    <!-- Customer & Site Info -->
    <div class="section-card">
      <div class="section-header">Customer & Site Information</div>
      <div class="section-body grid-3">
        <div class="field-group">
          <div class="field-lbl">Customer Name</div>
          <div class="field-val">${escapeHtml(clientName)}</div>
        </div>
        <div class="field-group">
          <div class="field-lbl">Contact Phone</div>
          <div class="field-val">${escapeHtml(contactPhone)}</div>
        </div>
        <div class="field-group">
          <div class="field-lbl">Customer Account Type</div>
          <div class="field-val">${escapeHtml(inst.customer_type === "BTL" ? "Existing BTL Customer" : "New / Walk-in Customer")}</div>
        </div>
        <div class="field-group" style="grid-column: span 3;">
          <div class="field-lbl">Installation Site Address</div>
          <div class="field-val">${escapeHtml(addressStr)}</div>
        </div>
        <div class="field-group">
          <div class="field-lbl">Equipment Model / Scope</div>
          <div class="field-val">${escapeHtml([inst.brand, inst.equipment_model].filter(Boolean).join(" ") || inst.equipment_details || "Standard Equipment")}</div>
        </div>
        <div class="field-group">
          <div class="field-lbl">Serial Number</div>
          <div class="field-val" style="font-family: monospace;">${escapeHtml(inst.serial_number || "Pending Handover")}</div>
        </div>
        <div class="field-group">
          <div class="field-lbl">Warranty Classification</div>
          <div class="field-val">${escapeHtml(inst.customer_type === "BTL" ? "Standard Manufacturer Warranty" : "Out of Warranty / Standard")}</div>
        </div>
      </div>
    </div>

    <!-- Assignment -->
    <div class="section-card">
      <div class="section-header">Field Deployment & Schedule</div>
      <div class="section-body grid-2">
        <div class="field-group">
          <div class="field-lbl">Scheduled Date & Time</div>
          <div class="field-val">${escapeHtml(inst.scheduled_date || item.scheduled_date || "N/A")} at ${escapeHtml(inst.scheduled_time || item.scheduled_time || "N/A")}</div>
        </div>
        <div class="field-group">
          <div class="field-lbl">Installation Lead & Crew</div>
          <div class="field-val">${techHtml}</div>
        </div>
      </div>
    </div>

    <!-- Phase 4: Execution -->
    <div class="section-card">
      <div class="section-header">Phase 4: Execution & Commissioning</div>
      <div class="section-body">
        <div class="field-group">
          <div class="field-lbl">Installation Notes & Scope</div>
          <div class="field-val" style="white-space: pre-wrap;">${escapeHtml(inst.installation_notes || inst.notes || "Complete system mounting, wiring, power configuration, and operational commissioning.")}</div>
        </div>
        <div class="field-group" style="margin-top: 6px;">
          <div class="field-lbl">Testing Results & Quality Checklist</div>
          <div class="field-val" style="white-space: pre-wrap;">${escapeHtml(inst.testing_results || "All testing benchmarks completed successfully. System is stable and operational.")}</div>
        </div>
        <div style="margin-top: 6px;">
          <div class="field-lbl">Site Evidence Files & Photos (Mounting & Handover)</div>
          ${renderEvidenceGridHtml(evidencePhotos, "Installation Evidence")}
        </div>
      </div>
    </div>

    <!-- Phase 5/6: Completion & Verification -->
    <div class="section-card">
      <div class="section-header" style="display: flex; justify-content: space-between; align-items: center;">
        <span>Phase 5 & 6: Completion Handover & Quality Verification</span>
        ${isOtpVerified 
          ? `<span style="background: #059669; color: #ffffff; font-size: 9px; font-weight: 800; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px;">✓ VERIFIED BY OTP</span>` 
          : `<span style="background: #f59e0b; color: #ffffff; font-size: 9px; font-weight: 800; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px;">⏳ PENDING OTP VERIFICATION</span>`}
      </div>
      <div class="section-body">
        <div class="grid-3">
          <div class="field-group">
            <div class="field-lbl">Customer Happiness Code (OTP)</div>
            <div class="field-val" style="margin-top: 3px;">
              ${isOtpVerified ? `
                <div style="display: inline-flex; align-items: center; gap: 6px;">
                  <span style="font-family: monospace; font-size: 13px; font-weight: 800; color: #065f46; background: #d1fae5; border: 1.5px solid #059669; padding: 2px 8px; border-radius: 4px; letter-spacing: 1px;">
                    ${escapeHtml(inst.happiness_code ? String(inst.happiness_code) : "VERIFIED")}
                  </span>
                  <span style="background: #059669; color: #ffffff; font-size: 9px; font-weight: 800; padding: 2px 7px; border-radius: 3px; display: inline-flex; align-items: center; gap: 3px;">
                    ✓ VERIFIED BY OTP
                  </span>
                </div>
              ` : `
                <div style="display: inline-flex; align-items: center; gap: 6px;">
                  <span style="font-family: monospace; font-size: 12px; font-weight: 700; color: #64748b; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 2px 8px; border-radius: 4px;">
                    ${escapeHtml(inst.happiness_code ? String(inst.happiness_code) : "PENDING")}
                  </span>
                  <span style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-size: 8.5px; font-weight: 700; padding: 2px 6px; border-radius: 3px;">
                    Pending Verification
                  </span>
                </div>
              `}
            </div>
          </div>
          <div class="field-group">
            <div class="field-lbl">Customer Satisfaction</div>
            <div class="field-val" style="color: ${isOtpVerified ? "#065f46" : "#0f172a"}; font-weight: 700;">
              ${isOtpVerified ? "✓ Customer Verified & Satisfied (OTP Confirmed)" : escapeHtml(inst.customer_satisfaction || "Pending Handover Verification")}
            </div>
          </div>
          <div class="field-group">
            <div class="field-lbl">Verified By / Timestamp</div>
            <div class="field-val">${escapeHtml(inst.verified_by || inst.closed_by || "Admin Operations")} · ${escapeHtml(inst.signoff_timestamp ? new Date(inst.signoff_timestamp).toLocaleString("en-IN") : (isOtpVerified ? "Verified" : "Recorded"))}</div>
          </div>
          <div class="field-group" style="grid-column: span 3;">
            <div class="field-lbl">Customer Feedback Comments</div>
            <div class="field-val">${escapeHtml(inst.feedback_comments || (isOtpVerified ? "Customer confirmed satisfactory installation and verified via happiness OTP." : "Customer verified installation quality and accepted site handover."))}</div>
          </div>
        </div>

        <div style="margin-top: 8px;">
          <div class="field-lbl">Customer Digital Signature</div>
          <div class="sig-container">
            <div class="sig-img-box">
              ${signatureUrl ? `<img src="${escapeHtml(signatureUrl)}" alt="Customer Signature" class="sig-img" />` : `<span style="font-size: 9px; color:#94a3b8; font-style: italic;">Pending Signature</span>`}
            </div>
            <div style="font-size: 9px; color: #475569;">
              <div>Signed on site upon physical installation acceptance.</div>
              <div><strong>Signoff Date:</strong> ${escapeHtml(inst.signoff_timestamp ? new Date(inst.signoff_timestamp).toLocaleString("en-IN") : "Recorded on field")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Signoff Strip -->
    <div class="signoff-strip">
      <div>
        <strong style="color: #0f172a;">Lead Installation Technician:</strong>
        <div class="sig-line"></div>
        <div style="font-size: 8px; color: #64748b; margin-top: 2px;">Signature & Date</div>
      </div>
      <div>
        <strong style="color: #0f172a;">Technical Supervisor:</strong>
        <div class="sig-line"></div>
        <div style="font-size: 8px; color: #64748b; margin-top: 2px;">Verification Signature & Date</div>
      </div>
      <div>
        <strong style="color: #0f172a;">Customer Handover Approval:</strong>
        <div class="sig-line"></div>
        <div style="font-size: 8px; color: #64748b; margin-top: 2px;">Signature & Stamp</div>
      </div>
    </div>
  </div>
</body>
</html>`;
};

const DailySchedule = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Hide floating icons during print if present
  useEffect(() => {
    document.body.classList.add("hide-header-icons");
    return () => {
      document.body.classList.remove("hide-header-icons");
    };
  }, []);

  const [fromDate, setFromDate] = useState<Date>(today);
  const [toDate, setToDate] = useState<Date>(today);
  const [fromCalendarOpen, setFromCalendarOpen] = useState(false);
  const [toCalendarOpen, setToCalendarOpen] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState("all");
  const [technicianSearch, setTechnicianSearch] = useState("");
  const [taskTypeFilter, setTaskTypeFilter] = useState<"all" | "installation" | "complaint">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [viewingItem, setViewingItem] = useState<UnifiedScheduleTask | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [fullDetails, setFullDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [printOnlyItem, setPrintOnlyItem] = useState<any>(null);
  const [inAppPrintModal, setInAppPrintModal] = useState<{
    isOpen: boolean;
    title: string;
    htmlContent: string;
  }>({
    isOpen: false,
    title: "",
    htmlContent: "",
  });

  useEffect(() => {
    const handleFrameMsg = (e: MessageEvent) => {
      if (e.data === "close-in-app-print") {
        setInAppPrintModal((prev) => ({ ...prev, isOpen: false }));
      }
    };
    window.addEventListener("message", handleFrameMsg);
    return () => window.removeEventListener("message", handleFrameMsg);
  }, []);

  const ITEMS_PER_PAGE = 20;

  const fromDateStr = formatDateToYYYYMMDD(fromDate);
  const toDateStr = formatDateToYYYYMMDD(toDate);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [fromDateStr, toDateStr, selectedTechnician, taskTypeFilter]);

  // Fetch Technicians list
  const { data: technicians = [] } = useQuery({
    queryKey: ["technicians-list-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "technician")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const filteredTechnicians = useMemo(() => {
    if (!technicianSearch.trim()) return technicians;
    const q = technicianSearch.toLowerCase();
    return technicians.filter((t: any) =>
      (t.full_name || "").toLowerCase().includes(q) ||
      (t.email || "").toLowerCase().includes(q) ||
      (t.phone || "").toLowerCase().includes(q)
    );
  }, [technicians, technicianSearch]);

  // Fetch Scheduled Complaints
  const { data: complaintsData = [], isLoading: isComplaintsLoading, refetch: refetchComplaints } = useQuery({
    queryKey: ["daily-schedule-complaints", fromDateStr, toDateStr],
    queryFn: async () => {
      console.log("Querying complaints for schedule:", fromDateStr, toDateStr);

      const selectColumns = `
        id,
        title,
        description,
        status,
        scheduled_date,
        scheduled_time,
        assigned_to,
        assigned_technician,
        assigned_supervisor,
        customer_name,
        customer_phone,
        location,
        location_id,
        created_at,
        complaint_technicians (
          id,
          technician_id,
          is_lead
        )
      `;

      const [scheduledResult, unscheduledResult] = await Promise.all([
        supabase
          .from("complaints")
          .select(selectColumns)
          .not("scheduled_date", "is", null)
          .gte("scheduled_date", fromDateStr)
          .lte("scheduled_date", toDateStr)
          .order("scheduled_date", { ascending: false, nullsFirst: false })
          .order("scheduled_time", { ascending: true, nullsFirst: false }),
        supabase
          .from("complaints")
          .select(selectColumns)
          .is("scheduled_date", null)
          .gte("created_at", `${fromDateStr}T00:00:00`)
          .lte("created_at", `${toDateStr}T23:59:59.999Z`)
          .order("created_at", { ascending: false }),
      ]);

      const scheduledError = scheduledResult.error;
      const unscheduledError = unscheduledResult.error;

      if (scheduledError) {
        console.error("Error fetching scheduled complaints:", scheduledError);
      }
      if (unscheduledError) {
        console.warn("Error fetching unscheduled complaints:", unscheduledError);
      }

      const scheduledRows = scheduledResult.data || [];
      const unscheduledRows = unscheduledResult.data || [];
      const rows = [...scheduledRows, ...unscheduledRows];

      if (rows.length === 0) return rows;

      const complaintIds = rows.map(r => r.id);
      const { data: junctionRows, error: junctionError } = await supabase
        .from("complaint_technicians")
        .select("complaint_id, technician_id, is_lead, technician:profiles!complaint_technicians_technician_id_fkey (id, full_name, phone, email)")
        .in("complaint_id", complaintIds);

      if (junctionError) {
        console.warn("Fallback complaint_technicians query failed:", junctionError);
        return rows;
      }

      const junctionMap = new Map<string, any[]>();
      (junctionRows || []).forEach((jr: any) => {
        const list = junctionMap.get(jr.complaint_id) || [];
        list.push(jr);
        junctionMap.set(jr.complaint_id, list);
      });

      return rows.map((row: any) => ({
        ...row,
        complaint_technicians: junctionMap.get(row.id) || row.complaint_technicians || [],
      }));
    },
  });

  // Fetch Scheduled Installations
  const { data: installationsData = [], isLoading: isInstallationsLoading, refetch: refetchInstallations } = useQuery({
    queryKey: ["daily-schedule-installations", fromDateStr, toDateStr],
    queryFn: async () => {
      console.log("Querying installations for schedule:", fromDateStr, toDateStr);
      const { data, error } = await supabase
        .from("installations")
        .select(`
          id,
          ticket_id,
          equipment_details,
          scheduled_date,
          scheduled_time,
          status,
          notes,
          customer_type,
          customer_id,
          location_id,
          non_btl_customer_name,
          non_btl_contact_number,
          non_btl_address,
          customer:customer_id (
            id,
            full_name,
            phone
          ),
          location:location_id (
            id,
            location_name,
            city,
            address
          ),
          installation_technicians (*)
        `)
        .not("scheduled_date", "is", null)
        .gte("scheduled_date", fromDateStr)
        .lte("scheduled_date", toDateStr)
        .order("scheduled_date", { ascending: false, nullsFirst: false })
        .order("scheduled_time", { ascending: true, nullsFirst: false });

      if (error) {
        console.error("Error fetching scheduled installations:", error);
        return [];
      }
      return data || [];
    },
  });

  useEffect(() => {
    refetchComplaints();
    refetchInstallations();
  }, [fromDateStr, toDateStr, refetchComplaints, refetchInstallations]);

  useEffect(() => {
    if (!viewingItem) {
      setFullDetails(null);
      return;
    }

    let cancelled = false;
    setLoadingDetails(true);
    setFullDetails(null);

    const fetchDetails = async () => {
      try {
        let data: any = null;
        if (viewingItem.task_type === "complaint") {
          data = await complaintService.getById(viewingItem.raw_id);
        } else if (viewingItem.task_type === "installation") {
          data = await installationService.getById(viewingItem.raw_id);
        }

        if (!cancelled) {
          setFullDetails(data);
        }
      } catch (err) {
        console.error("Failed to fetch task details:", err);
      } finally {
        if (!cancelled) {
          setLoadingDetails(false);
        }
      }
    };

    fetchDetails();

    return () => {
      cancelled = true;
    };
  }, [viewingItem]);

  const isLoading = isComplaintsLoading || isInstallationsLoading;

  // Transform and merge into Unified Tasks dataset
  const unifiedAllTasks: UnifiedScheduleTask[] = useMemo(() => {
    const currentYear = new Date().getFullYear();

    // 1. Process Complaints
    const formattedComplaints: UnifiedScheduleTask[] = complaintsData.map((c: any) => {
      const ctList = (c.complaint_technicians || []).slice().sort((a: any, b: any) => {
        if (a.is_lead === b.is_lead) return 0;
        return a.is_lead ? -1 : 1;
      });
      let techName = "";
      let techId = "";
      let assignedIds: string[] = [];

      if (ctList.length > 0) {
        assignedIds = Array.from(new Set([...ctList.map((ct: any) => ct.technician_id), c.assigned_to].filter(Boolean)));
        const parts = ctList.map((ct: any) => {
          const t = ct.technician || technicians.find((tech: any) => tech.id === ct.technician_id);
          const name = t?.full_name || "Technician";
          return ct.is_lead ? { lead: name, crew: "" } : { lead: "", crew: name };
        });
        const lead = parts.map(p => p.lead).filter(Boolean);
        const crew = parts.map(p => p.crew).filter(Boolean);
        techName = [...lead.map(n => `👑 ${n}`), ...crew].join(", ");
        techId = ctList
          .map((ct: any) => {
            const t = ct.technician || technicians.find((tech: any) => tech.id === ct.technician_id);
            return formatTechId(t);
          })
          .filter(Boolean)
          .join(", ");
      } else {
        const tech = technicians.find((t: any) => t.id === c.assigned_to);
        techName = tech?.full_name || c.assigned_technician || "Unassigned";
        techId = tech ? formatTechId(tech) : "";
        assignedIds = c.assigned_to ? [c.assigned_to] : [];
      }

      const ticketIdDisplay = formatComplaintTicketId(c);

      return {
        id: `complaint-${c.id}`,
        raw_id: c.id,
        task_type: "complaint",
        ticket_id: ticketIdDisplay,
        scheduled_date: c.scheduled_date || (c.created_at ? c.created_at.slice(0, 10) : ""),
        scheduled_time: c.scheduled_time ? c.scheduled_time.slice(0, 5) : "",
        technician_name: techName,
        technician_id_display: techId,
        assigned_technician_ids: assignedIds,
        assigned_supervisor: c.assigned_supervisor || null,
        client_name: c.customer_name || "N/A",
        contact_number: c.customer_phone || "N/A",
        address: c.location || "N/A",
        notes_description: c.title || c.description || "N/A",
        status: c.status || "Assigned",
      };
    });

    // 2. Process Installations
    const formattedInstallations: UnifiedScheduleTask[] = installationsData.map((inst: any) => {
      const itList = (inst.installation_technicians || []).slice().sort((a: any, b: any) => {
        if (a.is_lead === b.is_lead) return 0;
        return a.is_lead ? -1 : 1;
      });
      const assignedIds = itList.map((it: any) => it.technician_id);

      const parts = itList.map((it: any) => {
        const t = it.technician || technicians.find((tech: any) => tech.id === it.technician_id);
        const name = t?.full_name || "Technician";
        return it.is_lead ? { lead: name, crew: "" } : { lead: "", crew: name };
      });
      const lead = parts.map(p => p.lead).filter(Boolean);
      const crew = parts.map(p => p.crew).filter(Boolean);
      const assignedNames = [...lead.map(n => `👑 ${n}`), ...crew].join(", ");

      const assignedTechIds = itList
        .map((it: any) => {
          const t = it.technician || technicians.find((tech: any) => tech.id === it.technician_id);
          return formatTechId(t);
        })
        .filter(Boolean)
        .join(", ");

      // Client name & contact
      let clientName = "Non-BTL Customer";
      let contactNumber = "N/A";
      let addressStr = "N/A";

      if (inst.customer_type === "BTL") {
        clientName = inst.customer?.full_name || "Existing BTL Customer";
        contactNumber = inst.customer?.phone || "N/A";
        if (inst.location) {
          const locParts = [
            inst.location.location_name,
            inst.location.city,
            inst.location.address,
          ].filter(Boolean);
          addressStr = locParts.join(" - ") || "Primary Registered Address";
        } else {
          addressStr = "Primary Registered Address";
        }
      } else {
        clientName = inst.non_btl_customer_name || "New / Non-BTL Customer";
        contactNumber = inst.non_btl_contact_number || "N/A";
        addressStr = inst.non_btl_address || "N/A";
      }

      const ticketIdDisplay = formatInstallationTicketId(inst);

      return {
        id: `installation-${inst.id}`,
        raw_id: inst.id,
        task_type: "installation",
        ticket_id: ticketIdDisplay,
        scheduled_date: inst.scheduled_date || "",
        scheduled_time: inst.scheduled_time ? inst.scheduled_time.slice(0, 5) : "",
        technician_name: assignedNames || "Unassigned",
        technician_id_display: assignedTechIds,
        assigned_technician_ids: assignedIds,
        assigned_supervisor: inst.assigned_supervisor || null,
        client_name: clientName,
        contact_number: contactNumber,
        address: addressStr,
        notes_description: inst.equipment_details || inst.notes || "Installation Scope",
        status: inst.status || "Assigned",
      };
    });

    // Merge and sort by scheduled_date descending, then scheduled_time ascending
    const combined = [...formattedComplaints, ...formattedInstallations];
    combined.sort((a, b) => {
      if (a.scheduled_date !== b.scheduled_date) {
        return b.scheduled_date.localeCompare(a.scheduled_date);
      }
      return (a.scheduled_time || "").localeCompare(b.scheduled_time || "");
    });

    return combined;
  }, [complaintsData, installationsData, technicians]);

  const isTechnician = user?.role === "technician";
  const isSupervisor = user?.role === "supervisor";

  // Scope tasks according to user role:
  // - Supervisor: ONLY show complaints and installations assigned to that supervisor
  // - Technician: ONLY show tasks assigned to that technician
  // - Admin / Manager: Show all tasks
  const userScopedTasks = useMemo(() => {
    if (isSupervisor) {
      const supName = (user?.name || "").trim().toLowerCase();
      const supEmail = (user?.email || "").trim().toLowerCase();
      const supId = (user?.id || "").trim().toLowerCase();

      return unifiedAllTasks.filter((item) => {
        const assignedSup = (item.assigned_supervisor || "").trim().toLowerCase();
        const isAssignedSupervisor = Boolean(
          (supName && (assignedSup === supName || assignedSup.includes(supName))) ||
          (supEmail && assignedSup === supEmail) ||
          (supId && assignedSup === supId)
        );

        if (item.task_type === "complaint") {
          return isAssignedSupervisor;
        }

        if (item.task_type === "installation") {
          return (
            isAssignedSupervisor ||
            (user?.id && item.assigned_technician_ids.includes(user.id))
          );
        }

        return false;
      });
    }

    if (isTechnician && user?.id) {
      return unifiedAllTasks.filter((item) => {
        if (item.assigned_technician_ids.includes(user.id)) return true;
        if (user.name && item.technician_name && item.technician_name.toLowerCase().includes(user.name.toLowerCase())) return true;
        return false;
      });
    }

    return unifiedAllTasks;
  }, [unifiedAllTasks, isSupervisor, isTechnician, user?.id, user?.name, user?.email]);

  // Counts for buttons
  const totalCount = userScopedTasks.length;
  const installationCount = useMemo(
    () => userScopedTasks.filter((t) => t.task_type === "installation").length,
    [userScopedTasks]
  );
  const complaintCount = useMemo(
    () => userScopedTasks.filter((t) => t.task_type === "complaint").length,
    [userScopedTasks]
  );

  // Filtered dataset by Task Type and Technician
  const filteredScheduleData = useMemo(() => {
    return userScopedTasks.filter((item) => {
      // 1. Task Type Filter
      if (taskTypeFilter !== "all" && item.task_type !== taskTypeFilter) {
        return false;
      }

      // 2. Technician Filter (Only for Admin / Supervisor)
      if (!isTechnician && selectedTechnician !== "all") {
        if (!item.assigned_technician_ids.includes(selectedTechnician)) {
          return false;
        }
      }

      return true;
    });
  }, [userScopedTasks, taskTypeFilter, selectedTechnician, isTechnician]);

  const totalPages = Math.ceil(filteredScheduleData.length / ITEMS_PER_PAGE);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredScheduleData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredScheduleData, currentPage]);

  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, "ellipsis", totalPages];
    }
    if (currentPage >= totalPages - 2) {
      return [1, "ellipsis", totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "ellipsis", currentPage, "ellipsis", totalPages];
  };

  const goToPrevDay = () => {
    const next = new Date(fromDate);
    next.setDate(next.getDate() - 1);
    setFromDate(next);
    setToDate(next);
  };

  const goToNextDay = () => {
    const next = new Date(fromDate);
    next.setDate(next.getDate() + 1);
    setFromDate(next);
    setToDate(next);
  };

  const goToToday = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    setFromDate(now);
    setToDate(now);
  };

  const getDateLabel = () => {
    if (fromDateStr === toDateStr) {
      return fromDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
    return `${fromDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} - ${toDate.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}`;
  };

  const navigateToTicket = (ticketId: string, taskType: string) => {
    if (taskType === "Installation" || taskType.toLowerCase() === "installation") {
      navigate(`/installations/${ticketId}`);
    } else {
      navigate(`/complaints/${ticketId}`);
    }
  };

  const handlePrintTimetable = () => {
    if (filteredScheduleData.length === 0) {
      toast.error("No schedule tasks to print for the selected filter.");
      return;
    }

    const dateLabel = getDateLabel();
    const techLabel = selectedTechnician === "all"
      ? "All Technicians"
      : `${filteredTechnicians.find((t: any) => t.id === selectedTechnician)?.full_name || "Assigned"} (${formatTechId(filteredTechnicians.find((t: any) => t.id === selectedTechnician))})`;
    const typeLabel = taskTypeFilter === "all" 
      ? "All Tasks (Complaints & Installations)" 
      : taskTypeFilter === "installation" ? "Installations Only" : "Complaints Only";
    
    const printedAtStr = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const tableRowsHtml = filteredScheduleData.map((item, index) => {
      const isInstall = item.task_type === "installation";
      return `
        <tr>
          <td style="text-align: center; font-weight: bold; color: #475569;">${index + 1}</td>
          <td style="font-weight: 700; color: #0f172a;">${escapeHtml(item.technician_name)}</td>
          <td style="font-family: monospace; color: #334155; white-space: nowrap;">${escapeHtml(item.technician_id_display || "—")}</td>
          <td style="text-align: center; font-weight: 600; white-space: nowrap;">${escapeHtml(item.scheduled_time || "—")}</td>
          <td style="text-align: center; white-space: nowrap;">
            <span class="badge ${isInstall ? "badge-install" : "badge-complaint"}">
              ${isInstall ? "Installation" : "Complaint"}
            </span>
          </td>
          <td style="font-family: monospace; font-weight: 700; color: #1e40af; white-space: nowrap;">${escapeHtml(item.ticket_id)}</td>
          <td style="font-weight: 600; color: #0f172a;">${escapeHtml(item.client_name)}</td>
          <td style="white-space: nowrap; color: #334155;">${escapeHtml(item.contact_number)}</td>
          <td style="color: #334155;">${escapeHtml(item.address)}</td>
          <td style="color: #1e293b;">${escapeHtml(item.notes_description)}</td>
          <td style="text-align: center; white-space: nowrap;">
            <span class="badge badge-status">${escapeHtml(item.status)}</span>
          </td>
        </tr>
      `;
    }).join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Daily Field Schedule - Brihaspathi Technologies</title>
  <style>
    @page {
      size: landscape;
      margin: 8mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 0;
      color: #0f172a;
      background: #f1f5f9;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .screen-toolbar {
      position: sticky;
      top: 0;
      z-index: 9999;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    }
    .toolbar-title {
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
      color: #f8fafc;
    }
    .toolbar-actions {
      display: flex;
      gap: 10px;
    }
    .btn-action {
      padding: 6px 15px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 5px;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s ease;
    }
    .btn-print {
      background: #2563eb;
      color: #ffffff;
    }
    .btn-print:hover {
      background: #1d4ed8;
    }
    .btn-close {
      background: #475569;
      color: #f8fafc;
    }
    .btn-close:hover {
      background: #334155;
    }
    .page-sheet-landscape {
      max-width: 297mm;
      margin: 20px auto 40px auto;
      background: #ffffff;
      padding: 12mm 15mm;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
      border-radius: 4px;
      min-height: 200mm;
    }
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .company-title {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #0f172a;
    }
    .doc-subtitle {
      font-size: 11px;
      font-weight: 700;
      color: #2563eb;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .header-meta {
      text-align: right;
      font-size: 10px;
      color: #475569;
      line-height: 1.4;
    }
    .meta-strip {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 6px 10px;
      margin-bottom: 10px;
      font-size: 10px;
      color: #334155;
    }
    .meta-strip strong {
      color: #0f172a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
      margin-bottom: 15px;
    }
    th, td {
      border: 1px solid #94a3b8;
      padding: 5px 6px;
      text-align: left;
      vertical-align: middle;
      word-break: break-word;
    }
    th {
      background-color: #e2e8f0;
      color: #0f172a;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 9px;
      white-space: nowrap;
    }
    tr {
      page-break-inside: avoid;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .badge {
      display: inline-block;
      padding: 2px 5px;
      border-radius: 3px;
      font-weight: 800;
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .badge-install {
      background: #dbeafe;
      color: #1e40af;
      border: 1px solid #93c5fd;
    }
    .badge-complaint {
      background: #ffedd5;
      color: #9a3412;
      border: 1px solid #fdba74;
    }
    .badge-status {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
    }
    .signoff-section {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #94a3b8;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      font-size: 9.5px;
      page-break-inside: avoid;
    }
    .sig-line {
      margin-top: 30px;
      border-bottom: 1px dotted #475569;
      width: 140px;
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .no-print, .screen-toolbar {
        display: none !important;
      }
      .page-sheet-landscape {
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        min-height: auto !important;
      }
    }
  </style>
</head>
<body>
  <!-- Sticky Screen Preview Toolbar (Hidden in Print) -->
  <div class="screen-toolbar no-print">
    <div class="toolbar-title">
      <span>📄 Daily Field Schedule Preview — <strong>${escapeHtml(dateLabel)}</strong> (${filteredScheduleData.length} Tasks)</span>
    </div>
    <div class="toolbar-actions">
      <button onclick="window.print()" class="btn-action btn-print">🖨️ Print Timetable</button>
      <button onclick="if(window.parent&&window.parent!==window){window.parent.postMessage('close-in-app-print','*');}else{window.close();}" class="btn-action btn-close">✕ Close Preview</button>
    </div>
  </div>

  <!-- Landscape Page Sheet Container -->
  <div class="page-sheet-landscape">
    <div class="header-container">
      <div>
        <div class="company-title">Brihaspathi Technologies</div>
        <div class="doc-subtitle">Daily Field Service Schedule & Dispatch Sheet</div>
      </div>
      <div class="header-meta">
        <div><strong>Printed:</strong> ${escapeHtml(printedAtStr)}</div>
        <div><strong>Total Scheduled Jobs:</strong> ${filteredScheduleData.length} (Complaints: ${complaintCount}, Installations: ${installationCount})</div>
      </div>
    </div>

    <div class="meta-strip">
      <div><strong>Schedule Date:</strong> ${escapeHtml(dateLabel)}</div>
      <div><strong>Category Scope:</strong> ${escapeHtml(typeLabel)}</div>
      <div><strong>Technician Filter:</strong> ${escapeHtml(techLabel)}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="text-align: center; width: 3%;">#</th>
          <th style="width: 14%;">Technician Name</th>
          <th style="width: 7%;">Tech ID</th>
          <th style="text-align: center; width: 6%;">Time</th>
          <th style="text-align: center; width: 8%;">Task Type</th>
          <th style="width: 13%;">Ticket ID</th>
          <th style="width: 13%;">Client Name</th>
          <th style="width: 9%;">Contact</th>
          <th style="width: 14%;">Address / Site</th>
          <th style="width: 13%;">Notes / Description</th>
          <th style="text-align: center; width: 8%;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
    </table>

    <div class="signoff-section">
      <div>
        <strong>Prepared / Dispatched By:</strong>
        <div class="sig-line"></div>
        <div style="font-size: 8.5px; color: #64748b; margin-top: 3px;">Signature & Date</div>
      </div>
      <div>
        <strong>Field Operations Supervisor:</strong>
        <div class="sig-line"></div>
        <div style="font-size: 8.5px; color: #64748b; margin-top: 3px;">Signature & Date</div>
      </div>
      <div>
        <strong>Operations Head Approval:</strong>
        <div class="sig-line"></div>
        <div style="font-size: 8.5px; color: #64748b; margin-top: 3px;">Signature & Date</div>
      </div>
    </div>
  </div>

</body>
</html>`;

    setInAppPrintModal({
      isOpen: true,
      title: `Daily Field Schedule — ${dateLabel}`,
      htmlContent: html,
    });
  };

  const handleRowView = (item: UnifiedScheduleTask) => {
    setViewingItem(item);
    setIsViewModalOpen(true);
  };

  const handlePrintSingleTicket = async (item: UnifiedScheduleTask) => {
    const toastId = toast.loading(`Preparing printable report for ${item.ticket_id}...`);
    try {
      let fullRecord: any = null;
      if (item.task_type === "complaint") {
        fullRecord = await complaintService.getById(item.raw_id);
      } else {
        fullRecord = await installationService.getById(item.raw_id);
      }

      const htmlContent = item.task_type === "complaint"
        ? generateComplaintPrintHtml(fullRecord, item, technicians)
        : generateInstallationPrintHtml(fullRecord, item, technicians);

      setInAppPrintModal({
        isOpen: true,
        title: `${item.task_type === "installation" ? "Installation Work Order" : "Service Call Report"} — ${item.ticket_id}`,
        htmlContent: htmlContent,
      });
      toast.dismiss(toastId);
    } catch (err: any) {
      console.error("Print generation error:", err);
      toast.error("Failed to load ticket for printing: " + (err?.message || "Unknown error"), { id: toastId });
    }
  };

  const handleDownloadCSV = () => {
    setIsExporting(true);
    try {
      if (filteredScheduleData.length === 0) {
        toast.error("No scheduled tasks to download for this filter selection.");
        return;
      }

      const headers = [
        "Date",
        "Time",
        "Task Type",
        "Ticket ID",
        "Technician",
        "Tech ID",
        "Client Name",
        "Contact Number",
        "Address",
        "Notes / Description",
        "Status",
      ];

      const rows = filteredScheduleData.map((item) => [
        item.scheduled_date || "",
        item.scheduled_time || "",
        item.task_type === "installation" ? "Installation" : "Complaint",
        item.ticket_id || "",
        item.technician_name || "",
        item.technician_id_display || "",
        item.client_name || "",
        item.contact_number || "",
        item.address || "",
        item.notes_description || "",
        item.status || "",
      ]);

      const csvContent = [headers, ...rows]
        .map((r) => r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const typeLabel = taskTypeFilter === "all" ? "all-tasks" : taskTypeFilter;
      link.download = `daily-schedule-${typeLabel}-${fromDateStr}-to-${toDateStr}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${filteredScheduleData.length} schedule records to CSV`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to download CSV");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 relative overflow-x-hidden">
      {/* Background Ambient Glows */}
      <div className="bg-ambient-blur top-0 right-10 bg-primary/10 no-print" />
      <div className="bg-ambient-blur top-80 left-10 bg-emerald-500/10 no-print" />

      {/* Top Page Header - Above Buttons & Filters */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-border/60 shadow-xl relative overflow-hidden z-10 no-print">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 via-emerald-500/5 to-transparent rounded-full filter blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-primary/10 text-primary border border-primary/20 shadow-sm">
                <CalendarDays className="w-3.5 h-3.5" /> FIELD DISPATCH CALENDAR
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-foreground">
              Daily Service Timetable
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              {isSupervisor
                ? `Supervisor Timetable: Displaying active complaints and installations assigned to you (${user?.name || "Supervisor"}).`
                : isTechnician
                ? "Technician Timetable: Displaying tasks assigned to you."
                : "Unified dispatch schedule of all active installations and maintenance complaints mapped per technician."}
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadCSV}
              disabled={isExporting}
              className="rounded-xl border-border/70 hover:bg-muted/80 h-10 px-3.5 gap-2 shadow-sm font-semibold text-xs"
            >
              <Download className="w-4 h-4 text-primary" /> {isExporting ? "Exporting..." : "Export CSV"}
            </Button>
            <Button
              type="button"
              onClick={handlePrintTimetable}
              className="gradient-primary text-white hover:opacity-95 rounded-xl h-10 px-4 gap-2 font-bold shadow-glow text-xs"
            >
              <Printer className="w-4 h-4" /> Print Timetable
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Bar - Hidden during print */}
      <div className="glass-card rounded-2xl p-5 no-print shadow-sm border border-border/60 relative z-10">
        <div className="flex flex-wrap gap-3 justify-between items-end">
          <div className="flex flex-wrap gap-3 items-end">
            {/* From Date */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">From Date</label>
              <Popover open={fromCalendarOpen} onOpenChange={setFromCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="border border-border/60 rounded-xl h-10 px-3 text-xs w-[140px] bg-card text-foreground font-semibold flex items-center justify-start gap-2 text-left shadow-2xs hover:bg-muted/40"
                  >
                    <Calendar className="w-4 h-4 text-primary shrink-0" />
                    <span>{fromDate ? formatDateToDDMMYYYY(fromDate) : "dd/MM/yyyy"}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50 bg-card border border-border/80 shadow-2xl rounded-2xl" align="start">
                  <DayPickerCalendar
                    mode="single"
                    selected={fromDate}
                    onSelect={(date) => {
                      if (date) {
                        setFromDate(date);
                        setFromCalendarOpen(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* To Date */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">To Date</label>
              <Popover open={toCalendarOpen} onOpenChange={setToCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="border border-border/60 rounded-xl h-10 px-3 text-xs w-[140px] bg-card text-foreground font-semibold flex items-center justify-start gap-2 text-left shadow-2xs hover:bg-muted/40"
                  >
                    <Calendar className="w-4 h-4 text-primary shrink-0" />
                    <span>{toDate ? formatDateToDDMMYYYY(toDate) : "dd/MM/yyyy"}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50 bg-card border border-border/80 shadow-2xl rounded-2xl" align="start">
                  <DayPickerCalendar
                    mode="single"
                    selected={toDate}
                    onSelect={(date) => {
                      if (date) {
                        setToDate(date);
                        setToCalendarOpen(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Technician Dropdown (Only for Admin / Supervisor) */}
            {!isTechnician ? (
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Technician</label>
                <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                  <SelectTrigger className="w-[220px] h-10 rounded-xl border-border/60 bg-card text-xs font-semibold">
                    <SelectValue placeholder="All Technicians" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80 rounded-xl border-border/60 shadow-xl">
                    <div className="p-2">
                      <Input
                        placeholder="Search technician..."
                        value={technicianSearch}
                        onChange={(e) => setTechnicianSearch(e.target.value)}
                        className="h-8 text-xs rounded-lg"
                      />
                    </div>
                    <SelectItem value="all">All Technicians</SelectItem>
                    {filteredTechnicians.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.full_name || t.email} ({formatTechId(t)})
                      </SelectItem>
                    ))}
                    {filteredTechnicians.length === 0 && (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">No technicians found.</p>
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">My Schedule</label>
                <div className="h-10 px-3.5 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center gap-2 text-xs font-bold">
                  <Wrench className="w-3.5 h-3.5" /> {user?.name || "My Assigned Jobs"}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 items-end">
            {/* Navigation */}
            <Button type="button" variant="outline" onClick={goToPrevDay} className="h-10 rounded-xl border-border/60 text-xs font-bold">
              <ChevronLeft className="w-4 h-4 mr-1" /> Prev
            </Button>
            <Button type="button" variant="outline" onClick={goToToday} className="h-10 rounded-xl border-border/60 text-xs font-bold">
              Today
            </Button>
            <Button type="button" variant="outline" onClick={goToNextDay} className="h-10 rounded-xl border-border/60 text-xs font-bold">
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Task Type Filter Buttons (All Tasks, Installations Only, Complaints Only) */}
      <div className="flex flex-wrap items-center gap-2.5 no-print">
        <Button
          type="button"
          variant={taskTypeFilter === "all" ? "default" : "outline"}
          onClick={() => setTaskTypeFilter("all")}
          className={`h-9 px-4 font-semibold text-xs rounded-lg transition-all ${
            taskTypeFilter === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Layers className="w-3.5 h-3.5 mr-1.5" /> All Tasks
          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${
            taskTypeFilter === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600 font-bold"
          }`}>
            {totalCount}
          </span>
        </Button>

        <Button
          type="button"
          variant={taskTypeFilter === "installation" ? "default" : "outline"}
          onClick={() => setTaskTypeFilter("installation")}
          className={`h-9 px-4 font-semibold text-xs rounded-lg transition-all ${
            taskTypeFilter === "installation"
              ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              : "bg-white text-blue-700 border-blue-200 hover:bg-blue-50/50"
          }`}
        >
          <Wrench className="w-3.5 h-3.5 mr-1.5" /> Installations Only
          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${
            taskTypeFilter === "installation" ? "bg-white/25 text-white" : "bg-blue-100 text-blue-800 font-bold"
          }`}>
            {installationCount}
          </span>
        </Button>

        <Button
          type="button"
          variant={taskTypeFilter === "complaint" ? "default" : "outline"}
          onClick={() => setTaskTypeFilter("complaint")}
          className={`h-9 px-4 font-semibold text-xs rounded-lg transition-all ${
            taskTypeFilter === "complaint"
              ? "bg-orange-600 hover:bg-orange-700 text-white shadow-sm"
              : "bg-white text-orange-700 border-orange-200 hover:bg-orange-50/50"
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5 mr-1.5" /> Complaints Only
          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${
            taskTypeFilter === "complaint" ? "bg-white/25 text-white" : "bg-orange-100 text-orange-800 font-bold"
          }`}>
            {complaintCount}
          </span>
        </Button>
      </div>

      {/* Daily Field Schedule Section */}
      <div className="space-y-4">
        {/* On-screen Header (Hidden in Print) */}
        <div className="screen-only no-print flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h2 className="text-lg font-display font-bold uppercase tracking-wider text-slate-800">
            DAILY FIELD SCHEDULE — BRIHASPATHI TECHNOLOGIES
          </h2>
          <span className="text-sm text-muted-foreground font-medium">
            {getDateLabel()} · {filteredScheduleData.length} task(s)
          </span>
        </div>

        {selectedTechnician !== "all" && (
          <p className="screen-only no-print text-sm text-slate-600">
            Technician:{" "}
            <span className="font-semibold text-slate-900">
              {filteredTechnicians.find((t: any) => t.id === selectedTechnician)?.full_name ||
                filteredTechnicians.find((t: any) => t.id === selectedTechnician)?.email ||
                "Unknown"}
            </span>
          </p>
        )}

        {isLoading ? (
          <Card className="p-8 text-center text-muted-foreground bg-white border border-slate-200">
            <p className="text-sm font-medium">Loading schedule tasks...</p>
          </Card>
        ) : filteredScheduleData.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground bg-white border border-slate-200">
            <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-60" />
            <p className="text-sm font-medium">
              No {taskTypeFilter === "all" ? "scheduled tasks" : taskTypeFilter === "installation" ? "installations" : "complaints"} found for this date range and technician filter.
            </p>
          </Card>
        ) : (
          <>
            {/* Screen View (Paginated Unified Table) */}
            <div className="screen-only no-print space-y-4">
              {/* Desktop Table View */}
              <Card className="hidden md:block overflow-x-auto shadow-sm border border-slate-200 bg-white">
                <table className="w-full text-sm min-w-[1050px]">
                  <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold text-xs uppercase tracking-wider">
                    <tr>
                      <th className="text-left py-3 px-3 whitespace-nowrap">Technician</th>
                      <th className="text-left py-3 px-2.5 whitespace-nowrap">Tech ID</th>
                      <th className="text-center py-3 px-2 whitespace-nowrap">Time</th>
                      <th className="text-center py-3 px-2.5 whitespace-nowrap">Task Type</th>
                      <th className="text-left py-3 px-3 whitespace-nowrap">Ticket ID</th>
                      <th className="text-left py-3 px-2.5 whitespace-nowrap">Client Name</th>
                      <th className="text-left py-3 px-2 whitespace-nowrap">Contact Number</th>
                      <th className="text-left py-3 px-2.5 whitespace-nowrap">Address</th>
                      <th className="text-left py-3 px-2.5 whitespace-nowrap">Notes / Description</th>
                      <th className="text-center py-3 px-2.5 whitespace-nowrap">Status</th>
                      <th className="sticky right-0 bg-slate-50 text-slate-700 py-3 px-3 text-center whitespace-nowrap w-20 z-20 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)] border-l border-slate-200">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedData.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => navigateToTicket(item.raw_id || item.ticket_id, item.task_type)}
                        className="group hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        {/* 1. Technician */}
                        <td className="py-2.5 px-3 font-semibold text-slate-800 text-xs max-w-[150px] truncate" title={item.technician_name}>
                          {item.technician_name}
                        </td>

                        {/* 2. Tech ID */}
                        <td className="py-2.5 px-2.5 text-slate-600 font-mono text-xs max-w-[110px] truncate" title={item.technician_id_display || ""}>
                          {item.technician_id_display || "—"}
                        </td>

                        {/* 3. Time */}
                        <td className="py-2.5 px-2 text-center whitespace-nowrap font-medium text-slate-700 text-xs">
                          {item.scheduled_time || "—"}
                        </td>

                        {/* 4. Task Type Badge */}
                        <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                          {item.task_type === "installation" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <Wrench className="w-3 h-3" /> Installation
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                              <AlertCircle className="w-3 h-3" /> Complaint
                            </span>
                          )}
                        </td>

                        {/* 5. Ticket ID */}
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-xs text-primary">
                          {item.ticket_id}
                        </td>

                        {/* 6. Client Name */}
                        <td className="py-2.5 px-2.5 text-slate-800 font-medium text-xs max-w-[130px] truncate" title={item.client_name}>
                          {item.client_name}
                        </td>

                        {/* 7. Contact Number */}
                        <td className="py-2.5 px-2 text-slate-600 whitespace-nowrap text-xs">
                          {item.contact_number}
                        </td>

                        {/* 8. Address */}
                        <td className="py-2.5 px-2.5 text-slate-600 text-xs max-w-[160px]">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate" title={item.address}>{formatText(item.address, 26)}</span>
                            {item.address && item.address !== "N/A" && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`, '_blank');
                                }}
                                title="Open GPS Route"
                                className="text-emerald-600 hover:text-emerald-800 p-1 hover:bg-emerald-50 rounded shrink-0 no-print"
                              >
                                <Navigation className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 9. Notes / Description */}
                        <td className="py-2.5 px-2.5 text-slate-800 text-xs max-w-[160px] truncate" title={item.notes_description}>
                          {formatText(item.notes_description, 35)}
                        </td>

                        {/* 10. Status */}
                        <td className="py-2.5 px-2.5 text-center whitespace-normal max-w-[135px]">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border leading-tight ${getStatusBadgeClass(item.status)}`}
                            title={item.status}
                          >
                            {item.status}
                          </span>
                        </td>

                        {/* 11. Actions (Sticky Right Column) */}
                        <td className="sticky right-0 bg-white group-hover:bg-slate-50 py-2.5 px-3 whitespace-nowrap z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)] border-l border-slate-100 transition-colors">
                          <div className="flex items-center justify-center gap-1 no-print">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowView(item);
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="View details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrintSingleTicket(item);
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Print ticket report"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              {/* Mobile Cards View */}
              <div className="md:hidden space-y-3">
                {paginatedData.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigateToTicket(item.raw_id || item.ticket_id, item.task_type)}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    {/* Header: Task type + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.task_type === "installation" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Wrench className="w-3 h-3" /> Installation
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                            <AlertCircle className="w-3 h-3" /> Complaint
                          </span>
                        )}
                        <span className="font-mono font-bold text-xs text-primary">
                          {item.ticket_id}
                        </span>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${getStatusBadgeClass(item.status)}`}>
                        {item.status}
                      </span>
                    </div>

                    {/* Client Name & Contact */}
                    <div className="text-xs">
                      <p className="font-bold text-slate-900 text-sm">{item.client_name}</p>
                      {item.contact_number && item.contact_number !== "N/A" && (
                        <p className="text-slate-600 text-xs mt-0.5 flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <a
                            href={`tel:${item.contact_number}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary hover:underline font-medium"
                          >
                            {item.contact_number}
                          </a>
                        </p>
                      )}
                    </div>

                    {/* Technician Info & Scheduled Time */}
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.technician_name}</span>
                        {item.technician_id_display && (
                          <span className="text-[10px] text-slate-400 font-mono">({item.technician_id_display})</span>
                        )}
                      </div>
                      {item.scheduled_time && (
                        <div className="flex items-center gap-1 text-slate-600 text-[11px]">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{item.scheduled_time}</span>
                        </div>
                      )}
                    </div>

                    {/* Notes / Description */}
                    {item.notes_description && item.notes_description !== "—" && (
                      <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-2">
                        {item.notes_description}
                      </p>
                    )}

                    {/* Address & Navigation Action */}
                    {item.address && item.address !== "N/A" && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <p className="text-[11px] text-slate-500 line-clamp-1 flex items-center gap-1 min-w-0">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{item.address}</span>
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`, '_blank');
                          }}
                          className="h-7 px-2 text-xs text-emerald-700 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 gap-1 shrink-0 font-semibold"
                        >
                          <Navigation className="w-3 h-3 text-emerald-600" /> Map
                        </Button>
                      </div>
                    )}

                    {/* View / Print Actions */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2 no-print">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowView(item);
                        }}
                        className="h-7 px-2 text-xs text-slate-700 border-slate-200 hover:bg-slate-50 gap-1 font-semibold"
                      >
                        <Eye className="w-3 h-3" /> View
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrintSingleTicket(item);
                        }}
                        className="h-7 px-2 text-xs text-slate-700 border-slate-200 hover:bg-slate-50 gap-1 font-semibold"
                      >
                        <Printer className="w-3.5 h-3.5" /> Print
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {filteredScheduleData.length > ITEMS_PER_PAGE && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 no-print">
                  <p className="text-xs text-muted-foreground font-medium">
                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredScheduleData.length)} of {filteredScheduleData.length} records
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
                      {getPageNumbers().map((page, index) => (
                        <PaginationItem key={page === "ellipsis" ? `ellipsis-${index}` : page}>
                          {page === "ellipsis" ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              href="#"
                              isActive={currentPage === page}
                              onClick={(e) => {
                                e.preventDefault();
                                setCurrentPage(page as number);
                              }}
                            >
                              {page}
                            </PaginationLink>
                          )}
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
            </div>

            {/* Print View (Executive-Grade Dispatch Sheet) */}
            <div className="print-only">
              {/* Document Header */}
              <div className="mb-4 pb-3 border-b-2 border-slate-800">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xl font-extrabold uppercase tracking-wide text-slate-950">
                      BRIHASPATHI TECHNOLOGIES
                    </div>
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mt-0.5">
                      Daily Field Service Schedule & Dispatch Sheet
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-700">
                    <div><strong>Date Printed:</strong> {new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</div>
                    <div><strong>Total Tasks:</strong> {filteredScheduleData.length} (Complaints: {complaintCount}, Installations: {installationCount})</div>
                  </div>
                </div>

                {/* Metadata Strip */}
                <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-slate-300 text-[10px] text-slate-700 bg-slate-50 p-2 rounded">
                  <div>
                    <span className="font-bold text-slate-900">Schedule Date:</span> {getDateLabel()}
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">Category Scope:</span>{" "}
                    {taskTypeFilter === "all" ? "All Tasks (Complaints & Installations)" : taskTypeFilter === "installation" ? "Installations Only" : "Complaints Only"}
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">Technician Filter:</span>{" "}
                    {selectedTechnician === "all"
                      ? "All Field Technicians"
                      : `${filteredTechnicians.find((t: any) => t.id === selectedTechnician)?.full_name || "Assigned"} (${formatTechId(filteredTechnicians.find((t: any) => t.id === selectedTechnician))})`}
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <table className="w-full text-[10px] border-collapse border border-slate-700">
                <thead>
                  <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-700">
                    <th className="py-1.5 px-1 border border-slate-700 text-center w-[3%]">#</th>
                    <th className="py-1.5 px-2 border border-slate-700 text-left w-[13%]">Technician</th>
                    <th className="py-1.5 px-1.5 border border-slate-700 text-left w-[7%]">Tech ID</th>
                    <th className="py-1.5 px-1.5 border border-slate-700 text-center w-[6%]">Time</th>
                    <th className="py-1.5 px-1.5 border border-slate-700 text-center w-[8%]">Type</th>
                    <th className="py-1.5 px-1.5 border border-slate-700 text-left w-[13%]">Ticket ID</th>
                    <th className="py-1.5 px-2 border border-slate-700 text-left w-[13%]">Client Name</th>
                    <th className="py-1.5 px-1.5 border border-slate-700 text-left w-[9%]">Contact</th>
                    <th className="py-1.5 px-2 border border-slate-700 text-left w-[14%]">Address / Site</th>
                    <th className="py-1.5 px-2 border border-slate-700 text-left w-[14%]">Work Description</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScheduleData.map((item, idx) => (
                    <tr key={item.id} className="border-b border-slate-300 page-break-inside-avoid">
                      <td className="py-1.5 px-1 border border-slate-300 text-center font-mono text-slate-600">{idx + 1}</td>
                      <td className="py-1.5 px-2 border border-slate-300 font-bold text-slate-900">{item.technician_name}</td>
                      <td className="py-1.5 px-1.5 border border-slate-300 font-mono text-slate-800 whitespace-nowrap">{item.technician_id_display || "—"}</td>
                      <td className="py-1.5 px-1.5 border border-slate-300 text-center font-medium text-slate-700 whitespace-nowrap">{item.scheduled_time || "—"}</td>
                      <td className="py-1.5 px-1.5 border border-slate-300 text-center font-bold uppercase text-[9px]">
                        {item.task_type === "installation" ? (
                          <span className="text-blue-900">Installation</span>
                        ) : (
                          <span className="text-amber-900">Complaint</span>
                        )}
                      </td>
                      <td className="py-1.5 px-1.5 border border-slate-300 font-mono font-bold text-slate-900 whitespace-nowrap">{item.ticket_id}</td>
                      <td className="py-1.5 px-2 border border-slate-300 font-medium text-slate-900">{item.client_name}</td>
                      <td className="py-1.5 px-1.5 border border-slate-300 whitespace-nowrap text-slate-700">{item.contact_number}</td>
                      <td className="py-1.5 px-2 border border-slate-300 text-slate-700 break-words">{item.address}</td>
                      <td className="py-1.5 px-2 border border-slate-300 text-slate-700 break-words">{item.notes_description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Sign-off / Verification Footer */}
              <div className="mt-8 pt-4 border-t border-slate-400 grid grid-cols-3 gap-8 text-[10px] text-slate-700 page-break-inside-avoid">
                <div>
                  <div className="font-bold text-slate-900">Prepared / Dispatched By:</div>
                  <div className="mt-6 border-b border-dotted border-slate-500 w-36"></div>
                  <div className="text-[9px] text-slate-500 mt-0.5">Signature & Date</div>
                </div>
                <div>
                  <div className="font-bold text-slate-900">Field Supervisor:</div>
                  <div className="mt-6 border-b border-dotted border-slate-500 w-36"></div>
                  <div className="text-[9px] text-slate-500 mt-0.5">Signature & Date</div>
                </div>
                <div>
                  <div className="font-bold text-slate-900">Operations Manager:</div>
                  <div className="mt-6 border-b border-dotted border-slate-500 w-36"></div>
                  <div className="text-[9px] text-slate-500 mt-0.5">Approval & Date</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Print-only styles */}
      <style>{`
        @media screen {
          .print-only {
            display: none !important;
          }
        }
        @media print {
          @page {
            size: portrait;
            margin: 10mm;
          }
          .no-print,
          .screen-only,
          header,
          nav,
          aside,
          button,
          .fixed,
          footer,
          [role="dialog"],
          [data-state="open"] {
            display: none !important;
          }
          .print-only:not(.single-item-print) {
            display: none !important;
          }
          .single-item-print {
            display: block !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .single-item-print * {
            color: black !important;
            background: white !important;
          }
          body, html, #root {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
        }
        body.hide-header-icons button.fixed.top-4.left-4,
        body.hide-header-icons div.fixed.top-4.right-4 {
          display: none !important;
        }
      `}</style>

      {/* View Task Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={(openState) => !openState && setIsViewModalOpen(false)}>
        <DialogContent className="sm:max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between">
            <div>
              <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" /> Work Order Details
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-1">
                Read-only summary of the scheduled task.
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg hover:bg-slate-100"
              onClick={() => setIsViewModalOpen(false)}
            >
              <X className="w-4 h-4 text-slate-500" />
            </Button>
          </DialogHeader>

          {loadingDetails ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-sm font-medium">Loading work order details...</p>
            </div>
          ) : fullDetails && viewingItem ? (
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ticket ID</span>
                  <p className="text-sm font-mono font-bold text-primary">{viewingItem.ticket_id}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Task Type</span>
                  <p className="text-sm font-semibold text-slate-800 capitalize">{viewingItem.task_type}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</span>
                  <p className="text-sm font-semibold text-slate-800">{viewingItem.scheduled_date || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Time</span>
                  <p className="text-sm font-semibold text-slate-800">{viewingItem.scheduled_time || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Client Name</span>
                  <p className="text-sm font-semibold text-slate-800">{viewingItem.client_name}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contact Number</span>
                  <p className="text-sm font-semibold text-slate-800">{viewingItem.contact_number}</p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Address / Site</span>
                  <p className="text-sm font-semibold text-slate-800">{viewingItem.address}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</span>
                  <p className="text-sm font-semibold text-slate-800 capitalize">{viewingItem.status}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer Type</span>
                  <p className="text-sm font-semibold text-slate-800 capitalize">{fullDetails.customer_type || viewingItem.client_name ? "Existing / Registered" : "Walk-in"}</p>
                </div>
              </div>

              {/* Complaint / Installation Specific Details */}
              {viewingItem.task_type === "complaint" && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1">Complaint Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Title</span>
                      <p className="text-sm font-semibold text-slate-800">{fullDetails.title || viewingItem.notes_description}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Severity</span>
                      <p className="text-sm font-semibold text-slate-800 capitalize">{fullDetails.severity || "N/A"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Priority</span>
                      <p className="text-sm font-semibold text-slate-800 capitalize">{fullDetails.priority || "N/A"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Category</span>
                      <p className="text-sm font-semibold text-slate-800">{fullDetails.field_of_work || fullDetails.category || "N/A"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Coverage</span>
                      <p className="text-sm font-semibold text-slate-800">{fullDetails.coverage || "N/A"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Chargeable</span>
                      <p className="text-sm font-semibold text-slate-800 capitalize">{fullDetails.chargeable_service ? "Yes" : "No"}</p>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</span>
                      <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap">{fullDetails.description || viewingItem.notes_description}</p>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Resolution Notes</span>
                      <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap">{fullDetails.resolution_notes || fullDetails.resolution || "N/A"}</p>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Supervisor Notes</span>
                      <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap">{fullDetails.supervisor_notes || "N/A"}</p>
                    </div>
                  </div>
                </div>
              )}

              {viewingItem.task_type === "installation" && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1">Installation Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Equipment Details</span>
                      <p className="text-sm font-semibold text-slate-800">{fullDetails.equipment_details || "N/A"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Brand</span>
                      <p className="text-sm font-semibold text-slate-800">{fullDetails.brand || "N/A"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Model / Serial</span>
                      <p className="text-sm font-semibold text-slate-800">{[fullDetails.equipment_model, fullDetails.serial_number].filter(Boolean).join(" / ") || "N/A"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Priority</span>
                      <p className="text-sm font-semibold text-slate-800 capitalize">{fullDetails.priority || "N/A"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Warranty Type</span>
                      <p className="text-sm font-semibold text-slate-800">{fullDetails.customer_type === "BTL" ? "Under Warranty" : "Out of Warranty"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Chargeable</span>
                      <p className="text-sm font-semibold text-slate-800">{fullDetails.is_chargeable ? "Yes" : "No"}</p>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Installation Notes</span>
                      <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap">{fullDetails.installation_notes || fullDetails.notes || "N/A"}</p>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Testing Results</span>
                      <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap">{fullDetails.testing_results || "N/A"}</p>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Resolution Notes</span>
                      <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap">{fullDetails.correction_notes || fullDetails.resolution_notes || "N/A"}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Technicians Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1">Assigned Team</h4>
                {(fullDetails.installation_technicians || fullDetails.complaint_technicians || viewingItem.assigned_technician_ids.length > 0) ? (
                  <div className="space-y-2">
                    {(fullDetails.installation_technicians || fullDetails.complaint_technicians || []).map((tech: any, idx: number) => {
                      const t = tech.technician || {};
                      const isLead = tech.is_lead === true || tech.is_lead === "true";
                      return (
                        <div key={idx} className={`p-3 rounded-lg border ${isLead ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-200"}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className={`text-sm font-bold ${isLead ? "text-blue-900" : "text-slate-900"}`}>
                                {isLead && "👑 "}{t.full_name || "Technician"}
                                {isLead && <span className="ml-2 text-[10px] font-bold uppercase bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">Lead</span>}
                              </p>
                              <p className="text-xs text-slate-600 mt-0.5">{t.phone || t.email || "N/A"}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-mono text-slate-700">{t.technician_id || t.employee_id || "—"}</p>
                              <p className="text-[10px] text-slate-500 capitalize">{t.role || "technician"}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No technician details available.</p>
                )}
              </div>

              {/* Images / Evidence */}
              {(fullDetails.evidence_photos || fullDetails.complaint_images || fullDetails.technician_evidence || fullDetails.customer_signature) && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1">Evidence & Images</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(fullDetails.evidence_photos || []).map((url: string, idx: number) => (
                      <img key={idx} src={url} alt={`Evidence ${idx + 1}`} className="w-full h-24 object-cover rounded-lg border border-slate-200" />
                    ))}
                    {(fullDetails.complaint_images || []).map((url: string, idx: number) => (
                      <img key={idx} src={url} alt={`Complaint image ${idx + 1}`} className="w-full h-24 object-cover rounded-lg border border-slate-200" />
                    ))}
                    {(fullDetails.technician_evidence || []).map((url: string, idx: number) => (
                      <img key={idx} src={url} alt={`Technician evidence ${idx + 1}`} className="w-full h-24 object-cover rounded-lg border border-slate-200" />
                    ))}
                    {fullDetails.customer_signature && (
                      <div key="sig" className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Customer Signature</p>
                        <img src={fullDetails.customer_signature} alt="Customer Signature" className="w-full h-24 object-contain rounded-lg border border-slate-200 bg-white" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-sm font-medium">No details available.</p>
            </div>
          )}

          <DialogFooter className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Button variant="outline" size="sm" onClick={() => setIsViewModalOpen(false)} className="rounded-lg text-xs font-bold">
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (viewingItem) {
                  handlePrintSingleTicket(viewingItem);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm"
            >
              <Printer className="w-3.5 h-3.5 mr-2" /> Print Work Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Item Print View */}
      {printOnlyItem && (
        <div className="print-only single-item-print">
          <div className="mb-4 pb-3 border-b-2 border-slate-800">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xl font-extrabold uppercase tracking-wide text-slate-950">
                  BRIHASPATHI TECHNOLOGIES
                </div>
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mt-0.5">
                  {printOnlyItem.task_type === "installation" ? "INSTALLATION WORK ORDER" : "COMPLAINT SERVICE ORDER"}
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-700">
                <div><strong>Date Printed:</strong> {new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-300 text-[10px] text-slate-700 bg-slate-50 p-2 rounded">
            <div><span className="font-bold text-slate-900">Ticket ID:</span> {printOnlyItem.ticket_id}</div>
            <div><span className="font-bold text-slate-900">Date:</span> {printOnlyItem.scheduled_date || "N/A"}</div>
            <div><span className="font-bold text-slate-900">Time:</span> {printOnlyItem.scheduled_time || "N/A"}</div>
            <div><span className="font-bold text-slate-900">Status:</span> {printOnlyItem.status}</div>
            <div><span className="font-bold text-slate-900">Client:</span> {printOnlyItem.client_name}</div>
            <div><span className="font-bold text-slate-900">Contact:</span> {printOnlyItem.contact_number}</div>
            <div className="col-span-2"><span className="font-bold text-slate-900">Address:</span> {printOnlyItem.address}</div>
            <div className="col-span-2"><span className="font-bold text-slate-900">Technician(s):</span> {printOnlyItem.technician_name}</div>
            <div className="col-span-2"><span className="font-bold text-slate-900">Work Description:</span> {printOnlyItem.notes_description}</div>
          </div>

          {fullDetails && (
            <div className="mt-4 space-y-2 text-[10px] text-slate-700">
              {printOnlyItem.task_type === "complaint" && (
                <>
                  <div><span className="font-bold text-slate-900">Severity:</span> {fullDetails.severity || "N/A"}</div>
                  <div><span className="font-bold text-slate-900">Priority:</span> {fullDetails.priority || "N/A"}</div>
                  <div><span className="font-bold text-slate-900">Category:</span> {fullDetails.field_of_work || fullDetails.category || "N/A"}</div>
                  <div><span className="font-bold text-slate-900">Resolution Notes:</span> {fullDetails.resolution_notes || fullDetails.resolution || "N/A"}</div>
                  <div><span className="font-bold text-slate-900">Supervisor Notes:</span> {fullDetails.supervisor_notes || "N/A"}</div>
                </>
              )}
              {printOnlyItem.task_type === "installation" && (
                <>
                  <div><span className="font-bold text-slate-900">Equipment:</span> {fullDetails.equipment_details || "N/A"}</div>
                  <div><span className="font-bold text-slate-900">Brand / Model:</span> {[fullDetails.brand, fullDetails.equipment_model].filter(Boolean).join(" / ") || "N/A"}</div>
                  <div><span className="font-bold text-slate-900">Serial Number:</span> {fullDetails.serial_number || "N/A"}</div>
                  <div><span className="font-bold text-slate-900">Priority:</span> {fullDetails.priority || "N/A"}</div>
                  <div><span className="font-bold text-slate-900">Installation Notes:</span> {fullDetails.installation_notes || fullDetails.notes || "N/A"}</div>
                  <div><span className="font-bold text-slate-900">Testing Results:</span> {fullDetails.testing_results || "N/A"}</div>
                  <div><span className="font-bold text-slate-900">Resolution Notes:</span> {fullDetails.correction_notes || fullDetails.resolution_notes || "N/A"}</div>
                </>
              )}
            </div>
          )}

          <div className="mt-8 pt-4 border-t border-slate-400 grid grid-cols-3 gap-8 text-[10px] text-slate-700 page-break-inside-avoid">
            <div>
              <div className="font-bold text-slate-900">Technician Signature:</div>
              <div className="mt-6 border-b border-dotted border-slate-500 w-36"></div>
              <div className="text-[9px] text-slate-500 mt-0.5">Signature & Date</div>
            </div>
            <div>
              <div className="font-bold text-slate-900">Supervisor Signature:</div>
              <div className="mt-6 border-b border-dotted border-slate-500 w-36"></div>
              <div className="text-[9px] text-slate-500 mt-0.5">Signature & Date</div>
            </div>
            <div>
              <div className="font-bold text-slate-900">Customer Signature:</div>
              <div className="mt-6 border-b border-dotted border-slate-500 w-36"></div>
              <div className="text-[9px] text-slate-500 mt-0.5">Signature & Date</div>
            </div>
          </div>
        </div>
      )}
      {/* In-App Print Preview Modal (Renders directly within app, no separate browser tab) */}
      <Dialog
        open={inAppPrintModal.isOpen}
        onOpenChange={(openState) => {
          if (!openState) {
            setInAppPrintModal((prev) => ({ ...prev, isOpen: false }));
          }
        }}
      >
        <DialogContent className="max-w-[96vw] w-[1300px] h-[92vh] max-h-[95vh] p-0 flex flex-col overflow-hidden bg-slate-900 border border-slate-700 shadow-2xl rounded-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 bg-slate-950 text-white border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5">
              <Printer className="w-5 h-5 text-blue-400" />
              <span className="font-bold text-sm text-slate-100">{inAppPrintModal.title}</span>
              <span className="text-[11px] bg-blue-900/60 text-blue-300 border border-blue-700/50 px-2 py-0.5 rounded-full font-medium">
                In-App Document
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  const frame = document.getElementById("in-app-print-frame") as HTMLIFrameElement;
                  if (frame?.contentWindow) {
                    frame.contentWindow.focus();
                    frame.contentWindow.print();
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8 px-4 gap-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" /> Print Now
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setInAppPrintModal((prev) => ({ ...prev, isOpen: false }))}
                className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs h-8 px-3"
              >
                <X className="w-4 h-4 mr-1" /> Close
              </Button>
            </div>
          </div>

          {/* Embedded Preview Iframe */}
          <div className="flex-1 w-full h-full bg-slate-200 overflow-hidden relative">
            <iframe
              id="in-app-print-frame"
              title="Print Preview"
              srcDoc={inAppPrintModal.htmlContent}
              className="w-full h-full border-none"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DailySchedule;
