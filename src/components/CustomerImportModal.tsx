import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileText } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { parseFile } from '@/lib/importHelpers';

interface CustomerImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function CustomerImportModal({ open, onOpenChange, onSuccess }: CustomerImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Array<Record<string, any>>>([]);
  const [importing, setImporting] = useState(false);

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
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    multiple: false,
    maxSize: 5 * 1024 * 1024,
  });

  const handleImport = async () => {
    if (!file) {
      toast.error('No file selected');
      return;
    }
    setImporting(true);
    try {
      const parsed = await parseFile(file);
      const normalizeKey = (key: string) => key.toLowerCase().replace(/[\s\-_]/g, "").replace(/\./g, "");
      const normalizedRows = parsed.map((row) => {
        const out: Record<string, string> = {};
        Object.entries(row).forEach(([key, value]) => {
          const normalizedKey = normalizeKey(key);
          const strVal = String(value ?? "").trim();
          if (normalizedKey.includes("name") && !normalizedKey.includes("company") && !normalizedKey.includes("business")) out.full_name = strVal;
          else if (normalizedKey.includes("phone") || normalizedKey.includes("mobile") || normalizedKey.includes("contact")) out.phone = strVal;
          else if (normalizedKey.includes("email") || normalizedKey.includes("e-mail") || normalizedKey === "test") out.email = strVal;
          else if (normalizedKey.includes("type") && !normalizedKey.includes("customer")) out.customer_type = strVal;
          else if (normalizedKey.includes("customer")) out.customer_type = strVal;
          else if (normalizedKey.includes("address") || normalizedKey.includes("location")) out.address = strVal;
        });
        return out;
      });
      const mapped = normalizedRows.map((row) => ({
        full_name: (row.full_name || '').trim(),
        phone: (row.phone || '').trim(),
        email: (row.email || '').trim().toLowerCase(),
        customer_type: (row.customer_type || '').trim(),
        address: (row.address || '').trim(),
      }));
      const validRows = mapped.filter((row, index) => {
        const errors: string[] = [];
        if (!row.full_name || row.full_name.trim() === '') {
          errors.push('Missing full_name');
        }
        if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
          errors.push('Invalid email');
        }
        if (!row.phone || !/^[6-9]\d{9}$/.test(row.phone.replace(/\D/g, ''))) {
          errors.push('Invalid phone (must be 10 digits starting with 6-9)');
        }
        if (!row.customer_type || !['BTL Corporate', 'Retail', 'Walk-in', 'AMC Client', 'Government', 'Individual'].includes(row.customer_type)) {
          errors.push('Invalid customer_type');
        }
        if (errors.length > 0) {
          console.error(`Row ${index + 1} validation errors:`, errors);
          toast.error(`Row ${index + 1}: ${errors.join(', ')}`);
          return false;
        }
        return true;
      });
      if (validRows.length === 0) {
        toast.error('No valid rows to import. Check your CSV format.');
        return;
      }
      const { data, error } = await supabase
        .from('customers')
        .insert(validRows.map(row => ({
          full_name: row.full_name.trim(),
          email: row.email.trim().toLowerCase(),
          phone: row.phone.trim(),
          customer_type: row.customer_type,
        })))
        .select();
      if (error) throw error;
      toast.success(`Successfully imported ${data?.length || validRows.length} customer(s)`);
      onSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Import failed');
    } finally {
      setImporting(false);
      setFile(null);
      setPreview([]);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    setImporting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(openState) => !openState && handleClose()}>
      <DialogContent className="sm:max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 p-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/50 pr-12">
          <div>
            <DialogTitle className="text-xl font-display font-bold text-slate-800 flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" /> Import Customers
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              Bulk import client profiles, contact details, and branch information into the system.
            </DialogDescription>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Download Sample Template & Instructions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-blue-50/60 border border-blue-100 rounded-lg gap-3">
            <div className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-blue-900">Need the correct column format?</p>
                <p className="text-[11px] text-blue-700">Download sample CSV template with instructions & sample data.</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="bg-white border-blue-200 text-blue-700 hover:bg-blue-50 text-xs shrink-0 font-semibold"
            >
              <a href="/templates/customers_template.csv" download="customers_import_template.csv">
                <Download className="w-3.5 h-3.5 mr-1.5" /> Sample CSV
              </a>
            </Button>
          </div>

          {/* File Drag & Drop Zone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragActive
                ? 'border-blue-500 bg-blue-50/50 scale-[0.99]'
                : file
                ? 'border-emerald-300 bg-emerald-50/30'
                : 'border-slate-300 hover:border-slate-400 bg-slate-50/30'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className={`w-8 h-8 mx-auto mb-2 ${isDragActive ? 'text-blue-500' : 'text-slate-400'}`} />

            {file ? (
              <div>
                <p className="text-sm font-semibold text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {(file.size / 1024).toFixed(1)} KB &bull; Ready to process
                </p>
                <p className="text-[11px] text-blue-600 font-medium mt-2">Click or drag a new file to replace</p>
              </div>
            ) : isDragActive ? (
              <p className="text-sm font-semibold text-blue-600">Drop the CSV or Excel file here...</p>
            ) : (
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Drag & drop your CSV or Excel file here, or <span className="text-blue-600 underline">browse</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">Supports .csv, .xlsx, and .xls (Max size: 5MB)</p>
              </div>
            )}
          </div>

          {/* Preview Table (First 5 rows) */}
          {preview.length > 0 && !importing && (
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

          {/* Import Progress */}
          {importing && (
            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>Importing customers to database...</span>
                <span>Please wait</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div className="bg-blue-600 h-2 rounded-full animate-pulse w-full" />
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={importing} className="rounded-lg text-xs font-bold">
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || preview.length === 0 || importing}
            className="gradient-primary text-white rounded-lg text-xs font-bold shadow-sm"
          >
            {importing ? 'Importing...' : `Import ${preview.length ? `${preview.length} Rows` : 'to Database'}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
