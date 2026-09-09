import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { parseFile } from '@/lib/importHelpers';
import { supabase } from '@/lib/supabase';
import { Upload, Loader2 } from 'lucide-react';

interface StaffImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  role?: StaffRole | '';
  onRoleChange?: (role: StaffRole | '') => void;
}

type StaffRole = 'technician' | 'supervisor';

const COMMON_FIELDS = ['full_name', 'email', 'phone', 'branch', 'expertise', 'password'];
const TECHNICIAN_FIELDS = ['full_name', 'email', 'phone', 'branch', 'expertise', 'password'];
const SUPERVISOR_FIELDS = [...COMMON_FIELDS];

export default function StaffImportModal({ open, onOpenChange, onSuccess, role = '', onRoleChange }: StaffImportModalProps) {
  const [internalRole, setInternalRole] = useState<StaffRole | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Array<Record<string, any>>>([]);
  const [importing, setImporting] = useState(false);

  const currentRole = role || internalRole;
  const setRole = (value: StaffRole | '') => {
    if (onRoleChange) {
      onRoleChange(value);
    } else {
      setInternalRole(value);
    }
  };

  const fields = currentRole === 'technician' ? TECHNICIAN_FIELDS : currentRole === 'supervisor' ? SUPERVISOR_FIELDS : [];

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const selected = acceptedFiles[0];
    setFile(selected);
    parseFile(selected)
      .then((data) => setPreview(data))
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
    maxSize: 10 * 1024 * 1024,
  });

  const handleImport = async () => {
    if (!file) {
      toast.error('No file selected');
      return;
    }

    setImporting(true);
    try {
      const parsed = await parseFile(file);
      const normalized = parsed.map((row) => {
        const normalizedRow: Record<string, any> = {};
        fields.forEach((field) => {
          const key = Object.keys(row).find((k) => k.toLowerCase().trim() === field.toLowerCase().trim());
          normalizedRow[field] = key ? String(row[key]).trim() : '';
        });
        return normalizedRow;
      });

      const required = ['full_name', 'email'];
      const validRows = normalized.filter((r) => required.every((k) => r[k] && r[k].length > 0));
      if (validRows.length === 0) {
        toast.error('No valid rows to import');
        return;
      }

      const { data, error } = await supabase.functions.invoke('bulk-import-staff', {
        body: {
          rows: validRows,
          role,
        },
      });

      if (error) throw error;

      const results = data?.results || { success: 0, failed: 0, errors: [] };
      if (results.success > 0) {
        toast.success(`✅ ${results.success} ${role}(s) created successfully.`);
      }
      if (results.failed > 0) {
        toast.error(`⚠️ ${results.failed} failed. Check details.`);
        console.warn('Import failures:', results.errors);
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e.message || 'Import failed');
    } finally {
      setImporting(false);
      setFile(null);
      setPreview([]);
    }
  };

  const handleClose = () => {
    if (importing) return;
    setFile(null);
    setPreview([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl bg-white rounded-lg shadow-lg">
        <DialogHeader>
          <DialogTitle>Import Staff</DialogTitle>
          <DialogDescription>
            Import technicians or supervisors in bulk using a CSV or Excel file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Role to Import</label>
            <Select value={currentRole || undefined} onValueChange={(v) => { setRole(v as StaffRole); setFile(null); setPreview([]); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Staff Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="technician">Technician</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {role === 'technician'
                ? 'Technician CSV requires: full_name, email, phone, branch, expertise, password'
                : role === 'supervisor'
                  ? 'Supervisor CSV: full_name, email, phone, branch, expertise, password'
                  : 'Select a staff type to see required columns.'}
            </p>
          </div>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            {isDragActive ? (
              <p className="text-sm text-primary font-medium">Drop the file here…</p>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drag & drop a CSV or Excel file here, or click to select
                </p>
              </div>
            )}
          </div>

          {preview.length > 0 && (
            <div className="mt-4 max-h-64 overflow-y-auto border rounded-lg">
              <table className="w-full table-auto">
                <thead className="bg-gray-100">
                  <tr>
                    {fields.map((col) => (
                      <th key={col} className="px-3 py-2 text-left text-xs font-semibold border-b">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 5).map((row, i) => (
                    <tr key={i} className="odd:bg-gray-50">
                      {fields.map((col) => (
                        <td key={col} className="px-3 py-2 text-xs border-b">
                          {String(row[col] || '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 5 && (
                <p className="text-xs text-muted-foreground mt-2 p-2">Showing first 5 rows…</p>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={handleClose} disabled={importing}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!file || importing}>
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing…
                </>
              ) : (
                'Import to Database'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
