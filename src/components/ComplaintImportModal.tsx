import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, Download, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { parseFile } from '@/lib/importHelpers';
import { generateSampleCSV, downloadCSV } from '@/utils/csvHelpers';

interface ComplaintImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess?: () => void;
}

export default function ComplaintImportModal({
  open,
  onOpenChange,
  onImportSuccess,
}: ComplaintImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Array<Record<string, any>>>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const resetState = () => {
    setFile(null);
    setPreview([]);
    setImporting(false);
    setProgress(0);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetState();
  };

  const downloadSample = () => {
    const csv = generateSampleCSV('complaint');
    downloadCSV(csv, 'complaint_sample.csv');
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const selected = acceptedFiles[0];

    if (selected.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds the 5MB limit.');
      return;
    }

    setFile(selected);
    parseFile(selected)
      .then((data) => setPreview(data.slice(0, 5)))
      .catch((err) => toast.error('Failed to parse file: ' + err.message));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    multiple: false,
    maxSize: 5 * 1024 * 1024,
  });

  const getFieldValue = (row: Record<string, any>, possibleKeys: string[]): string => {
    for (const key of possibleKeys) {
      if (row[key] !== undefined && row[key] !== null && String(row[key]).trim()) {
        return String(row[key]).trim();
      }
      const normalizedKey = key.toLowerCase().replace(/[\_\-\s]/g, '');
      for (const actualKey of Object.keys(row)) {
        if (actualKey.toLowerCase().replace(/[\_\-\s]/g, '') === normalizedKey) {
          if (row[actualKey] !== undefined && row[actualKey] !== null && String(row[actualKey]).trim()) {
            return String(row[actualKey]).trim();
          }
        }
      }
    }
    return '';
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file to import.');
      return;
    }

    setImporting(true);
    setProgress(10);

    try {
      const allRows = await parseFile(file);
      if (!allRows || allRows.length === 0) {
        toast.error('The selected file is empty.');
        setImporting(false);
        return;
      }

      setProgress(25);

      // Fetch current year max ticket number for sequential numbering
      const currentYear = new Date().getFullYear();
      const prefix = `BTL-CMS-${currentYear}-`;
      const { data: existingTickets } = await supabase
        .from('complaints')
        .select('ticket_id')
        .ilike('ticket_id', `${prefix}%`)
        .order('ticket_id', { ascending: false })
        .limit(500);

      let maxNum = 0;
      if (existingTickets && existingTickets.length > 0) {
        for (const row of existingTickets) {
          if (row.ticket_id && row.ticket_id.startsWith(prefix)) {
            const suffix = row.ticket_id.slice(prefix.length);
            const num = parseInt(suffix, 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        }
      }

      setProgress(40);

      // Map rows
      const validRowsToInsert: any[] = [];
      let currentSeq = maxNum;

      for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i];
        const title = getFieldValue(row, ['title', 'complaint_title', 'subject', 'issue', 'problem']);
        const customerName = getFieldValue(row, ['customer_name', 'customername', 'name', 'client']);
        const customerPhone = getFieldValue(row, ['customer_phone', 'customerphone', 'phone', 'mobile', 'contact']);
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
          continue; // Skip completely blank lines
        }

        currentSeq++;
        const ticketId = `${prefix}${String(currentSeq).padStart(7, '0')}`;

        validRowsToInsert.push({
          ticket_id: ticketId,
          title: title || 'Service Complaint',
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          field_of_work: category || 'Solar PV',
          category: category || 'Solar PV',
          coverage: coverage,
          chargeable_service: chargeable,
          brand: brand || null,
          severity: ['minor', 'moderate', 'major'].includes(severity.toLowerCase()) ? severity.toLowerCase() : 'minor',
          priority: ['low', 'medium', 'high', 'urgent'].includes(priority.toLowerCase()) ? priority.toLowerCase() : 'medium',
          location: location || null,
          description: description,
          scheduled_date: scheduledDate || null,
          scheduled_time: scheduledTime || null,
          status: 'unassigned',
          current_phase: 1,
        });
      }

      if (validRowsToInsert.length === 0) {
        toast.error('No valid complaints found in the CSV. Make sure "title" and "customer_name" columns exist.');
        setImporting(false);
        return;
      }

      setProgress(60);

      // Batch insert in chunks of 50
      const chunkSize = 50;
      for (let i = 0; i < validRowsToInsert.length; i += chunkSize) {
        const chunk = validRowsToInsert.slice(i, i + chunkSize);
        const { error: insertError } = await supabase.from('complaints').insert(chunk);
        if (insertError) {
          console.warn('Complaint batch insert failed, retrying without extended columns:', insertError);
          // Fallback stripping optional columns if schema not fully migrated
          const fallbackChunk = chunk.map((c) => {
            const { coverage, chargeable_service, brand, scheduled_date, scheduled_time, ...rest } = c;
            return rest;
          });
          const { error: fallbackError } = await supabase.from('complaints').insert(fallbackChunk);
          if (fallbackError) throw fallbackError;
        }
        setProgress(Math.min(95, 60 + Math.round(((i + chunkSize) / validRowsToInsert.length) * 35)));
      }

      setProgress(100);
      toast.success(`Successfully imported ${validRowsToInsert.length} complaint(s) with 7-digit sequential IDs!`);
      onImportSuccess?.();
      handleClose();
    } catch (err: any) {
      console.error('Import complaints error:', err);
      toast.error(err.message || 'Failed to import complaints.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Upload className="w-5 h-5 text-primary" />
              Import Complaints from CSV / Excel
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Upload a spreadsheet to bulk create customer service complaints. Each row will automatically receive a 7-digit sequential Ticket ID (e.g. BTL-CMS-{new Date().getFullYear()}-0000001).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Sample template banner */}
          <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl p-3">
            <div className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">Need the correct template?</p>
                <p className="text-[11px] text-muted-foreground">Download the sample CSV with coverage, chargeable, and brand columns.</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadSample}
              className="rounded-lg h-8 px-2.5 gap-1.5 text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10 shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Sample CSV
            </Button>
          </div>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-border/80 hover:border-primary/50 bg-muted/20'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-xs font-semibold text-foreground">
              {file ? file.name : 'Click to browse or drag and drop CSV / Excel file'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Supports .csv, .xlsx, .xls up to 5MB
            </p>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Data Preview (first {preview.length} rows):</span>
              <div className="border rounded-lg p-2.5 bg-muted/10 max-h-36 overflow-x-auto text-[11px] space-y-1">
                {preview.map((row, idx) => (
                  <div key={idx} className="truncate text-slate-700 dark:text-slate-300">
                    <span className="font-semibold text-primary">#{idx + 1}:</span> {row.title || row.description || 'Complaint'} • {row.customer_name || 'Customer'} • {row.category || 'Solar'} • {row.coverage || 'Warranty'}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress bar */}
          {importing && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Importing records...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={importing}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleImport}
            disabled={!file || importing}
            className="gradient-primary text-white font-semibold gap-1.5"
          >
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {importing ? 'Importing...' : 'Start Import'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
