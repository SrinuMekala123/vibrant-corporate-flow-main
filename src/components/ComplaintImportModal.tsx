import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { X, Upload, Download, FileText, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { parseFile } from '@/lib/importHelpers';
import Papa from 'papaparse';

interface ComplaintImportModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isOpen?: boolean;
  onClose?: () => void;
  onImportSuccess?: () => void;
}

interface RowError {
  rowNumber: number;
  rowData: Record<string, any>;
  errorReason: string;
}

export default function ComplaintImportModal({
  open,
  onOpenChange,
  isOpen,
  onClose,
  onImportSuccess,
}: ComplaintImportModalProps) {
  const isModalOpen = open ?? isOpen ?? false;

  const handleCloseModal = () => {
    if (onOpenChange) onOpenChange(false);
    if (onClose) onClose();
    resetState();
  };

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Array<Record<string, any>>>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importSummary, setImportSummary] = useState<{
    successCount: number;
    failCount: number;
    errors: RowError[];
  } | null>(null);
  const [existingPhoneAlerts, setExistingPhoneAlerts] = useState<string[]>([]);

  const resetState = () => {
    setFile(null);
    setPreview([]);
    setImporting(false);
    setProgress(0);
    setImportSummary(null);
    setExistingPhoneAlerts([]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFieldValue = (row: Record<string, any>, possibleKeys: string[]): string => {
    for (const key of possibleKeys) {
      if (row[key] !== undefined && row[key] !== null) {
        return String(row[key]).trim();
      }
      const normalizedKey = key.toLowerCase().replace(/[\_\-\s]/g, '');
      for (const actualKey of Object.keys(row)) {
        if (actualKey.toLowerCase().replace(/[\_\-\s]/g, '') === normalizedKey) {
          if (row[actualKey] !== undefined && row[actualKey] !== null) {
            return String(row[actualKey]).trim();
          }
        }
      }
    }
    return '';
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const selected = acceptedFiles[0];

    if (selected.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds the 5MB limit.');
      return;
    }

    const fileNameLower = selected.name.toLowerCase();
    if (!fileNameLower.endsWith('.csv') && !fileNameLower.endsWith('.xlsx') && !fileNameLower.endsWith('.xls')) {
      toast.error('Only .csv, .xlsx, and .xls files are supported.');
      return;
    }

    setFile(selected);
    setImportSummary(null);

    parseFile(selected)
      .then((data) => {
        if (!data || data.length === 0) {
          toast.error('The selected file appears to be empty.');
          setPreview([]);
        } else {
          setPreview(data);
        }
      })
      .catch((err) => {
        toast.error('Failed to parse file: ' + (err.message || 'Invalid format'));
      });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: false,
    maxSize: 5 * 1024 * 1024,
  });

  const handleImport = async () => {
    if (!file || preview.length === 0) {
      toast.error('Please select a valid CSV or Excel file first.');
      return;
    }

    setImporting(true);
    setProgress(5);
    setImportSummary(null);

    const errors: RowError[] = [];
    const validRowsToInsert: any[] = [];

    try {
      const allRows = await parseFile(file);
      if (!allRows || allRows.length === 0) {
        toast.error('The selected file is empty.');
        setImporting(false);
        return;
      }

      setProgress(15);

      const severityAliases: Record<string, string> = {
        'low': 'minor',
        'minor': 'minor',
        'moderate': 'moderate',
        'medium': 'moderate',
        'high': 'major',
        'major': 'major',
        'critical': 'major',
        'urgent': 'major',
      };

      for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i];
        const rowNumber = i + 2;
        const title = getFieldValue(row, ['title', 'complaint_title', 'subject', 'issue', 'problem']);
        const customerName = getFieldValue(row, ['customer_name', 'customername', 'name', 'client']);
        const customerPhone = getFieldValue(row, ['customer_phone', 'customerphone', 'phone', 'mobile', 'contact']);
        const customerType = getFieldValue(row, ['customer_type', 'type', 'customer type']).trim();
        const category = getFieldValue(row, ['category', 'field_of_work', 'fieldofwork', 'type']);
        const coverage = getFieldValue(row, ['coverage', 'warranty_type', 'contract_type']) || 'Out of Warranty';
        const chargeable = getFieldValue(row, ['chargeable_service', 'chargeable', 'is_chargeable']) || 'No';
        const brand = getFieldValue(row, ['brand', 'make', 'manufacturer']);
        const severity = getFieldValue(row, ['severity', 'severity_level']) || 'minor';
        const priority = getFieldValue(row, ['priority']) || 'medium';
        const location = getFieldValue(row, ['location', 'address', 'site']);
        const description = getFieldValue(row, ['description', 'problem_description', 'notes', 'details']) || title;
        const scheduledDate = getFieldValue(row, ['scheduled_date', 'date']);
        const scheduledTime = getFieldValue(row, ['scheduled_time', 'time']);

        if (!title && !description) {
          continue;
        }

        const validCoverages = ['Under Warranty', 'Out of Warranty', 'AMC Covered', 'Not Covered'];
        const coverageMatch = validCoverages.find(c => c.toLowerCase() === coverage.toLowerCase());
        if (!coverageMatch && coverage) {
          errors.push({ rowNumber, rowData: row, errorReason: `Invalid coverage "${coverage}". Allowed: ${validCoverages.join(', ')}` });
          continue;
        }
        const resolvedCoverage = coverageMatch || coverage;

        const normalizedSeverity = (severity || '').toLowerCase();
        const resolvedSeverity = severityAliases[normalizedSeverity] || 'minor';

        if (customerPhone) {
          const digits = customerPhone.replace(/\D/g, '');
          if (!/^[6-9]\d{9}$/.test(digits)) {
            errors.push({ rowNumber, rowData: row, errorReason: 'Invalid phone number. Must be 10 digits starting with 6-9' });
            continue;
          }
        }

        validRowsToInsert.push({
          title: title || 'Service Complaint',
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          field_of_work: category || 'Solar PV',
          category: category || 'Solar PV',
          coverage: resolvedCoverage,
          chargeable_service: chargeable,
          brand: brand || null,
          severity: resolvedSeverity,
          priority: ['low', 'medium', 'high', 'urgent'].includes(priority.toLowerCase()) ? priority.toLowerCase() : 'medium',
          location: location || null,
          description,
          scheduled_date: scheduledDate || null,
          scheduled_time: scheduledTime || null,
          status: 'unassigned',
          current_phase: 1,
        });
      }

      setProgress(40);

      if (validRowsToInsert.length === 0) {
        errors.push({ rowNumber: 0, rowData: {}, errorReason: 'No valid complaints found. Check required columns.' });
        setImportSummary({ successCount: 0, failCount: errors.length, errors });
        setImporting(false);
        return;
      }

      setProgress(50);

      const uniquePhones = Array.from(new Set(validRowsToInsert.map(r => r.customer_phone).filter(Boolean))) as string[];
      const phoneToProfileId: Record<string, string> = {};

      if (uniquePhones.length > 0) {
        try {
          const { data: matchedProfiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, phone, full_name')
            .in('phone', uniquePhones);

          if (!profileError && matchedProfiles) {
            matchedProfiles.forEach((p: any) => {
              if (p.phone) {
                phoneToProfileId[p.phone] = p.id;
              }
            });
          }
        } catch (err) {
          console.warn('Customer lookup failed during import:', err);
        }
      }

      const existingPhoneAlertsState: string[] = [];

      for (let rowIdx = 0; rowIdx < validRowsToInsert.length; rowIdx++) {
        const row = validRowsToInsert[rowIdx];
        const phone = row.customer_phone;
        const name = row.customer_name;

        if (!phone) {
          continue;
        }

        if (phoneToProfileId[phone]) {
          row.customer_id = phoneToProfileId[phone];
          row.customer_type = 'Existing BTL Customer';
          existingPhoneAlertsState.push(`Row ${rowIdx + 2}: Phone ${phone} already exists. Linked to existing customer.`);
          continue;
        }

        try {
          const newProfileId = `walkin-import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const { error: createError } = await supabase.from('profiles').insert({
            id: newProfileId,
            full_name: name || 'Walk-in Customer',
            phone,
            email: null,
            role: 'customer',
            customer_type: 'Walk-in',
          });

          if (!createError) {
            row.customer_id = newProfileId;
            row.customer_type = 'New / Non-BTL Customer';
            phoneToProfileId[phone] = newProfileId;
          }
        } catch (err) {
          console.warn('Walk-in profile creation failed for import:', err);
        }
      }

      setExistingPhoneAlerts(existingPhoneAlertsState);
      setProgress(60);

      const chunkSize = 50;
      const optionalColumnsToDrop = new Set([
        'coverage',
        'chargeable_service',
        'service_charge',
        'payment_status',
        'brand',
        'location_id',
        'scheduled_date',
        'scheduled_time',
        'ticket_id',
        'reassignment_reason',
        'closed_at',
        'pir_approved_by',
        'pir_approved_at',
        'target_end_time',
        'pir_findings_severity',
        'supervisor_severity',
        'target_duration_hours',
        'pir_status',
        'pir_revision_notes',
        'pir_revision_requested_by',
        'pir_revision_requested_at',
        'pir_resubmitted_at',
        'closure_timestamp',
        'closed_by',
        'feedback_collected',
        'customer_satisfaction',
        'feedback_comments',
        'feedback_contact_method',
        'feedback_timestamp',
        'resolved_remotely',
        'resolution_type',
        'resolution_notes',
        'resolved_at',
        'resolved_by',
        'triage_outcome',
        'evidence_urls',
        'technician_evidence',
        'arrival_lat',
        'arrival_lng',
        'arrival_timestamp',
        'start_journey_timestamp',
        'pir_decision_tree',
        'happiness_code',
        'happiness_code_sent_at',
        'happiness_code_verified',
      ]);

      const sanitizeChunk = (rows: any[]) =>
        rows.map((c) => {
          const safe: any = {};
          for (const [key, value] of Object.entries(c)) {
            if (!optionalColumnsToDrop.has(key)) {
              safe[key] = value;
            }
          }
          return safe;
        });

      for (let i = 0; i < validRowsToInsert.length; i += chunkSize) {
        const chunk = validRowsToInsert.slice(i, i + chunkSize);
        const sanitized = sanitizeChunk(chunk);
        const { error: insertError } = await supabase.from('complaints').insert(sanitized);

        if (insertError) {
          console.warn('Complaint batch insert failed, retrying without extended columns:', insertError);
          const fallback = sanitized.map((c: any) => {
            if (!insertError.message?.includes('customer_id')) return c;
            const { customer_id, ...rest } = c;
            return rest;
          });
          const { error: fallbackError } = await supabase.from('complaints').insert(fallback);
          if (fallbackError) {
            errors.push({
              rowNumber: i + 2,
              rowData: chunk[0] || {},
              errorReason: fallbackError.message || 'Database insert failed',
            });
          }
        }

        setProgress(Math.min(95, 60 + Math.round(((i + chunkSize) / validRowsToInsert.length) * 35)));
      }

      setProgress(100);
      setImportSummary({
        successCount: validRowsToInsert.length - errors.length,
        failCount: errors.length,
        errors,
      });

      if (validRowsToInsert.length - errors.length > 0) {
        toast.success(`✅ ${validRowsToInsert.length - errors.length} complaint(s) imported successfully!`);
        onImportSuccess?.();
      }

      if (errors.length > 0) {
        toast.error(`❌ ${errors.length} row(s) failed validation or import.`);
      }
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred during import.');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadErrorReport = () => {
    if (!importSummary || importSummary.errors.length === 0) return;

    const errorRows = importSummary.errors.map((e) => ({
      Row_Number: e.rowNumber,
      Error_Reason: e.errorReason,
      ...e.rowData,
    }));

    const csvString = Papa.unparse(errorRows);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `complaint_import_errors_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetAndClose = () => {
    resetState();
    handleCloseModal();
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(openState) => !openState && resetAndClose()}>
      <DialogContent className="sm:max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 p-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/50 pr-12">
          <div>
            <DialogTitle className="text-xl font-display font-bold text-slate-800 flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" /> Import Complaints from CSV / Excel
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              Upload a spreadsheet to bulk create customer service complaints. Each row will automatically receive a sequential Ticket ID (e.g., BTL-CMS-2026-000001).
            </DialogDescription>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Download Sample Template & Instructions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg gap-3 mb-6">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-blue-900">Need the correct template?</p>
                <p className="text-[11px] text-blue-700">Download sample CSV with coverage, chargeable, and brand columns.</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="bg-white border-blue-200 text-blue-700 hover:bg-blue-50 text-xs shrink-0 font-semibold"
            >
              <a href="/templates/complaints_template.csv" download="complaints_import_template.csv">
                <Download className="w-4 h-4 mr-2" /> Sample CSV
              </a>
            </Button>
          </div>

          {/* File Drag & Drop Zone */}
          {!importSummary && (
            <div
              {...getRootProps()}
              className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <input {...getInputProps()} />
              <Upload className="w-10 h-10 text-slate-400 mb-3" />

              {file ? (
                <div>
                  <p className="text-sm font-semibold text-slate-800">{file.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Size: {formatFileSize(file.size)} &bull; Ready to process
                  </p>
                  <p className="text-[11px] text-blue-600 font-medium mt-2">Click or drag a new file to replace</p>
                </div>
              ) : isDragActive ? (
                <p className="text-sm font-semibold text-blue-600">Drop the CSV or Excel file here...</p>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Click to browse or drag and drop CSV / Excel file
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Supports .csv, .xlsx, .xls up to 5MB</p>
                  <p className="text-[11px] text-slate-400 mt-2">Required columns: title, customer_name, customer_phone, category, severity, priority</p>
                </div>
              )}
            </div>
          )}

          {/* Import Progress */}
          {importing && (
            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>Importing complaints to database...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Import Summary Results */}
          {importSummary && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-800">Successfully Imported</p>
                    <p className="text-xl font-bold text-emerald-900">{importSummary.successCount} complaints</p>
                  </div>
                </div>

                <div
                  className={`p-4 rounded-xl flex items-center gap-3 border ${
                    importSummary.failCount > 0
                      ? 'bg-rose-50 border-rose-200'
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <AlertCircle
                    className={`w-6 h-6 shrink-0 ${importSummary.failCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-700">Failed / Errors</p>
                    <p
                      className={`text-xl font-bold ${
                        importSummary.failCount > 0 ? 'text-rose-900' : 'text-slate-500'
                      }`}
                    >
                      {importSummary.failCount} rows
                    </p>
                  </div>
                </div>
              </div>

              {/* Existing Phone Alerts */}
              {existingPhoneAlerts.length > 0 && (
                <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-amber-900">Existing Customer Alerts ({existingPhoneAlerts.length})</p>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-amber-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-amber-100/70 text-amber-900 font-bold border-b border-amber-200">
                        <tr>
                          <th className="py-2 px-3">Alert</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100 text-slate-700">
                        {existingPhoneAlerts.slice(0, 20).map((alert, idx) => (
                          <tr key={idx} className="hover:bg-amber-50/50">
                            <td className="py-1.5 px-3 text-amber-900">{alert}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {existingPhoneAlerts.length > 20 && (
                      <p className="text-[11px] text-slate-500 p-2 bg-slate-50 text-center border-t border-slate-100">
                        Showing first 20 alerts.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Error Details Table / Download Button */}
              {importSummary.failCount > 0 && (
                <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-rose-900">Validation Errors ({importSummary.failCount})</p>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDownloadErrorReport}
                      className="h-8 text-xs font-semibold"
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" /> Download Error Log CSV
                    </Button>
                  </div>

                  <div className="max-h-40 overflow-y-auto rounded-lg border border-rose-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-rose-100/70 text-rose-900 font-bold border-b border-rose-200">
                        <tr>
                          <th className="py-2 px-3 w-16">Row #</th>
                          <th className="py-2 px-3">Error Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100 text-slate-700">
                        {importSummary.errors.slice(0, 10).map((errItem, idx) => (
                          <tr key={idx} className="hover:bg-rose-50/50">
                            <td className="py-1.5 px-3 font-bold text-rose-700">Row {errItem.rowNumber}</td>
                            <td className="py-1.5 px-3 text-rose-900">{errItem.errorReason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importSummary.errors.length > 10 && (
                      <p className="text-[11px] text-slate-500 p-2 bg-slate-50 text-center border-t border-slate-100">
                        Showing first 10 errors. Download complete error log CSV to see all {importSummary.errors.length} failed rows.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preview Table (First 5-10 rows) */}
          {!importSummary && preview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold">Data Preview ({preview.length} total rows detected)</span>
                <span className="text-slate-400">Showing first 5 rows</span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-48">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
                    <tr>
                      {Object.keys(preview[0]).map((col) => (
                        <th key={col} className="px-3 py-2 border-r last:border-r-0 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                    {preview.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        {Object.values(row).map((val, cIdx) => (
                          <td key={cIdx} className="px-3 py-1.5 border-r last:border-r-0 max-w-[160px] truncate">
                            {val !== undefined && val !== null ? String(val) : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div>
            {importSummary && (
              <Button variant="ghost" size="sm" onClick={resetState} className="text-xs text-slate-600 hover:bg-slate-200">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Upload Another File
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={resetAndClose} disabled={importing} className="rounded-lg text-xs font-bold">
              {importSummary ? 'Close' : 'Cancel'}
            </Button>

            {!importSummary && (
              <Button
                onClick={handleImport}
                disabled={!file || preview.length === 0 || importing}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm"
              >
                {importing ? 'Importing...' : 'Start Import'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
