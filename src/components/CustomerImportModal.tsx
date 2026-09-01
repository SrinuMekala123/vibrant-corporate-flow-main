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
}

export default function CustomerImportModal({ open, onOpenChange }: CustomerImportModalProps) {
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
      // Map CSV/Excel column names to DB fields (case‑insensitive) and trim values
      const mapped = parsed.map((row) => ({
        full_name: (row['Full Name'] ?? row['full_name'] ?? '').trim(),
        phone: (row['Phone Number'] ?? row['phone'] ?? '').trim(),
        email: (row['Email Address'] ?? row['email'] ?? '').trim(),
        customer_type: (row['Customer Type'] ?? row['customer_type'] ?? '').trim(),
        branch_id: row['Branch Location'] ?? row['branch_id'] ? Number(row['Branch Location'] ?? row['branch_id']) : null,
        address: (row['Physical Address'] ?? row['address'] ?? '').trim(),
      }));
      const required = ['full_name', 'phone', 'email'];
      const validRows = mapped.filter((r) => required.every((k) => r[k] && r[k].length > 0));
      if (validRows.length === 0) {
        toast.error('No valid rows to import');
        return;
      }
      const { error } = await supabase.from('customers').insert(validRows);
      if (error) throw error;
      toast.success(`Imported ${validRows.length} customers`);
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
      <DialogContent className="sm:max-w-lg bg-white rounded-lg shadow-lg">
        <DialogHeader>
          <DialogTitle>Import Customers</DialogTitle>
        </DialogHeader>
        <DialogDescription className="mt-2">
          <Button variant="link" asChild>
            <a href="/templates/customers_template.csv" download>
              Download Sample CSV
            </a>
          </Button>
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
