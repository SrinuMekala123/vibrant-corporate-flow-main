import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import Papa from 'papaparse';
import { Progress } from '@/components/ui/progress';

// Helper to parse CSV using PapaParse
const parseCSV = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data as any[]),
      error: (err) => reject(err),
    });
  });
};

interface AssetImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
}

export default function AssetImportModal({ isOpen, onClose, onImportSuccess }: AssetImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Array<Record<string, any>>>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  // Dropzone configuration
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const selected = acceptedFiles[0];
    // Validate size (<5MB) and type
    if (selected.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5 MB limit');
      return;
    }
    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!validTypes.includes(selected.type)) {
      toast.error('Unsupported file type');
      return;
    }
    setFile(selected);
    parseCSV(selected)
      .then((data) => setPreview(data))
      .catch((err) => toast.error('Failed to parse file: ' + err.message));
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
    if (!file) {
      toast.error('No file selected');
      return;
    }
    setImporting(true);
    setProgress(0);
    try {
      const rows = await parseCSV(file);
      // Map CSV columns to DB fields (case‑insensitive)
      const mapped = rows.map((row) => ({
        customer_id: row['Customer Name'] ?? row['customer_name'] ?? null,
        branch_id: row['Branch Location'] ?? row['branch_location'] ?? null,
        category: row['Category'] ?? row['category'] ?? null,
        product_name: row['Product Name'] ?? row['product_name'] ?? null,
        model_number: row['Model Number'] ?? row['model_number'] ?? null,
        serial_number: row['Serial Number'] ?? row['serial_number'] ?? null,
        purchase_date: row['Purchase Date'] ?? row['purchase_date'] ?? null,
        warranty_months: Number(row['Warranty Months'] ?? row['warranty_months'] ?? 0),
        installation_date: row['Installation Date'] ?? row['installation_date'] ?? null,
        status: row['Status'] ?? row['status'] ?? 'Active',
        notes: row['Notes'] ?? row['notes'] ?? null,
      }));
      // Simple validation – required fields present
      const required = ['customer_id', 'category', 'product_name', 'purchase_date'];
      const validRows = mapped.filter((r) => required.every((k) => r[k] != null && r[k] !== ''));
      // Upsert in chunks to provide progress feedback
      const chunkSize = 200;
      for (let i = 0; i < validRows.length; i += chunkSize) {
        const chunk = validRows.slice(i, i + chunkSize);
        const { error } = await supabase.from('customer_assets').upsert(chunk);
        if (error) throw error;
        setProgress(Math.min(100, Math.round(((i + chunk.length) / validRows.length) * 100)));
      }
      toast.success(`Imported ${validRows.length} assets`);
      onImportSuccess?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? 'Import failed');
    } finally {
      setImporting(false);
      setFile(null);
      setPreview([]);
      setProgress(0);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-white rounded-lg shadow-lg">
        <DialogHeader className="flex items-center justify-between">
          <DialogTitle>Import Assets</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>
        <DialogDescription className="mt-2">
          <Button variant="link" asChild>
            <a href="/templates/assets_template.csv" download>
              Download Sample CSV
            </a>
          </Button>
        </DialogDescription>
        <div {...getRootProps()} className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer mt-4 ${isDragActive ? 'border-primary' : 'border-gray-300'}`}>
          <input {...getInputProps()} />
          {isDragActive ? <p>Drop the file here …</p> : <p>Drag &amp; drop a CSV or Excel file here, or click to select</p>}
        </div>
        {preview.length > 0 && (
          <div className="mt-4 max-h-64 overflow-y-auto">
            <table className="w-full table-auto border">
              <thead className="bg-gray-100">
                <tr>
                  {Object.keys(preview[0]).map((col) => (
                    <th key={col} className="px-2 py-1 text-left text-sm font-medium border">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 5).map((row, i) => (
                  <tr key={i} className="odd:bg-gray-50">
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-2 py-1 text-sm border">{String(val)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 5 && <p className="text-xs text-gray-500 mt-2">Showing first 5 rows …</p>}
          </div>
        )}
        {importing && <Progress value={progress} className="mt-2" />}
        <div className="flex justify-end space-x-2 mt-4">
          <Button variant="outline" onClick={onClose} disabled={importing}>Cancel</Button>
          <Button onClick={handleImport} disabled={!file || importing}>
            {importing ? 'Importing…' : 'Import to Database'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
