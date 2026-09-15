import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
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
    maxSize: 10 * 1024 * 1024, // 10 MB
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
          else if (normalizedKey.includes("password")) out.password = strVal;
          else if (normalizedKey.includes("type") && !normalizedKey.includes("customer")) out.customer_type = strVal;
          else if (normalizedKey.includes("customer")) out.customer_type = strVal;
          else if (normalizedKey.includes("branch")) out.branch_id = strVal;
          else if (normalizedKey.includes("address") || normalizedKey.includes("location")) out.address = strVal;
        });
        return out;
      });
      const mapped = normalizedRows.map((row) => ({
        full_name: (row.full_name || '').trim(),
        phone: (row.phone || '').trim(),
        email: (row.email || '').trim().toLowerCase(),
        password: (row.password || '').trim(),
        customer_type: (row.customer_type || '').trim(),
        branch_id: (row.branch_id || '').trim() || null,
        address: (row.address || '').trim(),
      }));
      const required = ['full_name', 'phone', 'email'];
      const validRows = mapped.filter((r) =>
        required.every((key) => r[key] && r[key].length > 0)
      );
      if (validRows.length === 0) {
        toast.error('No valid rows to import. Ensure full_name, phone, and email columns are present in your CSV.');
        return;
      }
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-import-customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ customers: validRows }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import failed');
      }
      const result = await response.json();
      
      if (result.success > 0) {
        toast.success(`Successfully imported ${result.success} customer(s)`);
      }
      
      if (result.failed > 0) {
        toast.warning(`Imported with issues: ${result.failed} row(s) failed. Check console.`);
        console.warn('Import issues:', result.errors);
      } else {
        toast.success(`Successfully imported ${result.success} customer(s)`);
      }
      
      if (result.success === 0 && result.failed === 0) {
        toast.error('No valid rows to import. Check your CSV format.');
      }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-lg">
        <DialogHeader>
          <DialogTitle>Import Customers</DialogTitle>
        </DialogHeader>
        <DialogDescription className="mt-2 space-y-2">
          <Button variant="link" asChild className="p-0 h-auto">
            <a href="/templates/customers_template.csv" download>
              Download Sample CSV
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            Password is optional. If left blank, default password <span className="font-mono bg-muted px-1 rounded">Welcome@123!</span> will be used.
          </p>
        </DialogDescription>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer mt-4 ${isDragActive ? 'border-primary' : 'border-gray-300'}`}
        >
          <input {...getInputProps()} />
          {isDragActive ? <p>Drop the file here …</p> : <p>Drag & drop a CSV or Excel file here, or click to select</p>}
        </div>
        {preview.length > 0 && (
          <div className="mt-4 max-h-64 overflow-y-auto">
            <table className="w-full table-auto border">
              <thead className="bg-gray-100">
                <tr>
                  {Object.keys(preview[0]).map((col) => (
                    <th key={col} className="px-2 py-1 text-left text-sm font-medium border">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 5).map((row, i) => (
                  <tr key={i} className="odd:bg-gray-50">
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-2 py-1 text-sm border">
                        {String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 5 && <p className="text-xs text-gray-500 mt-2">Showing first 5 rows …</p>}
          </div>
        )}
        <div className="flex justify-end space-x-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || importing}>
            {importing ? 'Importing…' : 'Import to Database'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
