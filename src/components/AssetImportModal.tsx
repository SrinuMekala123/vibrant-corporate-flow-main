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

interface AssetImportModalProps {
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

export default function AssetImportModal({
  open,
  onOpenChange,
  isOpen,
  onClose,
  onImportSuccess,
}: AssetImportModalProps) {
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

  const resetState = () => {
    setFile(null);
    setPreview([]);
    setImporting(false);
    setProgress(0);
    setImportSummary(null);
  };

  // Helper to format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Helper to normalize header key string
  const getFieldValue = (row: Record<string, any>, possibleKeys: string[]): string => {
    for (const key of possibleKeys) {
      if (row[key] !== undefined && row[key] !== null) {
        return String(row[key]).trim();
      }
      // Case-insensitive match check
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

  // File Dropzone Handler
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const selected = acceptedFiles[0];

    // File size limit: 5MB
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

  // Main Import Process
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
      // 1. Fetch Customers and Branches from DB for resolution
      const [customersRes, branchesRes] = await Promise.all([
        supabase.from('customers').select('id, full_name, email'),
        supabase.from('branches').select('id, branch_name'),
      ]);

      if (customersRes.error) throw new Error('Failed to fetch customers: ' + customersRes.error.message);
      if (branchesRes.error) throw new Error('Failed to fetch branches: ' + branchesRes.error.message);

      const customerList = customersRes.data || [];
      const branchList = branchesRes.data || [];

      // Create lookup structures
      const customerIdMap = new Map<string, string>();
      const customerEmailMap = new Map<string, string>();
      const customerNameMap = new Map<string, string>();

      customerList.forEach((c) => {
        if (c.id) customerIdMap.set(c.id.toLowerCase(), c.id);
        if (c.email) customerEmailMap.set(c.email.trim().toLowerCase(), c.id);
        if (c.full_name) customerNameMap.set(c.full_name.trim().toLowerCase(), c.id);
      });

      const branchIdMap = new Map<string, string>();
      const branchNameMap = new Map<string, string>();

      branchList.forEach((b) => {
        if (b.id) branchIdMap.set(b.id.toLowerCase(), b.id);
        if (b.branch_name) branchNameMap.set(b.branch_name.trim().toLowerCase(), b.id);
      });

      setProgress(20);

      // 2. Validate and Process each row
      preview.forEach((row, idx) => {
        const rowNumber = idx + 2; // Row 1 is header in CSV

        const productName = getFieldValue(row, ['asset_name', 'product_name', 'assetname', 'productname', 'name']);
        const category = getFieldValue(row, ['asset_type', 'category', 'assettype', 'type']);
        const serialNumber = getFieldValue(row, ['serial_number', 'serialnumber', 'serial_no', 'serialno', 'sn', 's/n']);
        const modelNumber = getFieldValue(row, ['model_number', 'modelnumber', 'model_no', 'modelno', 'model']);
        const manufacturer = getFieldValue(row, ['manufacturer', 'make', 'brand']);
        const purchaseDateRaw = getFieldValue(row, ['purchase_date', 'purchasedate', 'purchase_date_yyyy_mm_dd']);
        const warrantyMonthsRaw = getFieldValue(row, ['warranty_months', 'warrantymonths', 'warranty']);
        const warrantyExpiryRaw = getFieldValue(row, ['warranty_expiry', 'warrantyexpiry']);
        const statusRaw = getFieldValue(row, ['status', 'state']);
        const customerIdRaw = getFieldValue(row, ['customer_id', 'customerid']);
        const customerEmailRaw = getFieldValue(row, ['customer_email', 'customeremail', 'email']);
        const customerNameRaw = getFieldValue(row, ['customer_name', 'customername', 'customer']);
        const locationRaw = getFieldValue(row, ['location', 'branch_id', 'branch_name', 'branchlocation', 'branch']);
        const installationDateRaw = getFieldValue(row, ['installation_date', 'installationdate']);
        const notesRaw = getFieldValue(row, ['description', 'notes', 'comments', 'details']);

        // Check required fields
        if (!productName) {
          errors.push({ rowNumber, rowData: row, errorReason: 'Missing required field: "asset_name" / "product_name"' });
          return;
        }

        if (!category) {
          errors.push({ rowNumber, rowData: row, errorReason: 'Missing required field: "asset_type" / "category"' });
          return;
        }

        // Validate purchase_date
        let purchaseDate = purchaseDateRaw;
        if (!purchaseDate) {
          purchaseDate = new Date().toISOString().split('T')[0];
        } else {
          const d = new Date(purchaseDate);
          if (isNaN(d.getTime())) {
            errors.push({ rowNumber, rowData: row, errorReason: `Invalid purchase_date format: "${purchaseDateRaw}". Expected YYYY-MM-DD` });
            return;
          }
          purchaseDate = d.toISOString().split('T')[0];
        }

        // Resolve customer_id
        let resolvedCustomerId: string | null = null;
        if (customerIdRaw && customerIdMap.has(customerIdRaw.toLowerCase())) {
          resolvedCustomerId = customerIdMap.get(customerIdRaw.toLowerCase())!;
        } else if (customerEmailRaw && customerEmailMap.has(customerEmailRaw.toLowerCase())) {
          resolvedCustomerId = customerEmailMap.get(customerEmailRaw.toLowerCase())!;
        } else if (customerNameRaw && customerNameMap.has(customerNameRaw.toLowerCase())) {
          resolvedCustomerId = customerNameMap.get(customerNameRaw.toLowerCase())!;
        }

        if (!resolvedCustomerId) {
          const matchAttempt = customerIdRaw || customerEmailRaw || customerNameRaw || 'Unspecified';
          errors.push({
            rowNumber,
            rowData: row,
            errorReason: `Customer not found for identifier "${matchAttempt}". Check customer_id or customer_email.`,
          });
          return;
        }

        // Resolve branch_id
        let resolvedBranchId: string | null = null;
        if (locationRaw) {
          if (branchIdMap.has(locationRaw.toLowerCase())) {
            resolvedBranchId = branchIdMap.get(locationRaw.toLowerCase())!;
          } else if (branchNameMap.has(locationRaw.toLowerCase())) {
            resolvedBranchId = branchNameMap.get(locationRaw.toLowerCase())!;
          }
        }

        // Resolve warranty_months
        let warrantyMonths = 12;
        if (warrantyMonthsRaw) {
          const parsedM = parseInt(warrantyMonthsRaw, 10);
          if (!isNaN(parsedM) && parsedM >= 0) {
            warrantyMonths = parsedM;
          }
        } else if (warrantyExpiryRaw && purchaseDate) {
          const expD = new Date(warrantyExpiryRaw);
          const purD = new Date(purchaseDate);
          if (!isNaN(expD.getTime()) && !isNaN(purD.getTime())) {
            const diffMonths = (expD.getFullYear() - purD.getFullYear()) * 12 + (expD.getMonth() - purD.getMonth());
            if (diffMonths >= 0) warrantyMonths = diffMonths;
          }
        }

        // Validate installation_date
        let installationDate: string | null = null;
        if (installationDateRaw) {
          const instD = new Date(installationDateRaw);
          if (!isNaN(instD.getTime())) {
            installationDate = instD.toISOString().split('T')[0];
          }
        }

        // Resolve status
        let status = 'Active';
        if (statusRaw) {
          const lowerS = statusRaw.toLowerCase();
          if (lowerS.includes('repair') || lowerS.includes('maint')) status = 'Under Repair';
          else if (lowerS.includes('inact') || lowerS.includes('off')) status = 'Inactive';
          else if (lowerS.includes('scrap') || lowerS.includes('trash')) status = 'Scrapped';
          else if (lowerS.includes('act') || lowerS.includes('on')) status = 'Active';
          else status = statusRaw;
        }

        // Build combined notes
        const notesParts: string[] = [];
        if (manufacturer) notesParts.push(`Manufacturer: ${manufacturer}`);
        if (notesRaw) notesParts.push(notesRaw);

        validRowsToInsert.push({
          customer_id: resolvedCustomerId,
          branch_id: resolvedBranchId,
          category,
          product_name: productName,
          model_number: modelNumber || null,
          serial_number: serialNumber || null,
          purchase_date: purchaseDate,
          warranty_months: warrantyMonths,
          installation_date: installationDate,
          status,
          notes: notesParts.length > 0 ? notesParts.join(' | ') : null,
        });
      });

      setProgress(40);

      // 3. Batch insert valid rows into Supabase customer_assets table
      let insertedCount = 0;
      const batchSize = 50;

      for (let i = 0; i < validRowsToInsert.length; i += batchSize) {
        const chunk = validRowsToInsert.slice(i, i + batchSize);
        const { error: insertError } = await supabase.from('customer_assets').insert(chunk);

        if (insertError) {
          // Fallback to row-by-row insert for this chunk to isolate exact failure
          for (const item of chunk) {
            const { error: singleErr } = await supabase.from('customer_assets').insert([item]);
            if (singleErr) {
              errors.push({
                rowNumber: i + 2,
                rowData: item,
                errorReason: singleErr.message || 'Database insert failed',
              });
            } else {
              insertedCount++;
            }
          }
        } else {
          insertedCount += chunk.length;
        }

        const currentProg = Math.min(95, 40 + Math.round(((i + chunk.length) / validRowsToInsert.length) * 55));
        setProgress(currentProg);
      }

      setProgress(100);

      setImportSummary({
        successCount: insertedCount,
        failCount: errors.length,
        errors,
      });

      if (insertedCount > 0) {
        toast.success(`✅ ${insertedCount} assets imported successfully!`);
        onImportSuccess?.();
      }

      if (errors.length > 0) {
        toast.error(`❌ ${errors.length} rows failed validation or import.`);
      }
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred during import.');
    } finally {
      setImporting(false);
    }
  };

  // Download error log as CSV
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
    link.setAttribute('download', `asset_import_errors_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(openState) => !openState && handleCloseModal()}>
      <DialogContent className="sm:max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 p-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/50 pr-12">
          <div>
            <DialogTitle className="text-xl font-display font-bold text-slate-800 flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" /> Import Assets (CSV / Excel)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              Bulk import client assets, warranty records, and equipment specs into the system.
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
              <a href="/templates/assets_template.csv" download="assets_import_template.csv">
                <Download className="w-3.5 h-3.5 mr-1.5" /> Sample CSV
              </a>
            </Button>
          </div>

          {/* File Drag & Drop Zone */}
          {!importSummary && (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
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
                    Size: {formatFileSize(file.size)} &bull; Ready to process
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
          )}

          {/* Progress Bar */}
          {importing && (
            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>Importing assets to database...</span>
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
                    <p className="text-xl font-bold text-emerald-900">{importSummary.successCount} assets</p>
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
            <Button variant="outline" onClick={handleCloseModal} disabled={importing} className="rounded-lg text-xs font-bold">
              {importSummary ? 'Close' : 'Cancel'}
            </Button>

            {!importSummary && (
              <Button
                onClick={handleImport}
                disabled={!file || preview.length === 0 || importing}
                className="gradient-primary text-white rounded-lg text-xs font-bold shadow-sm"
              >
                {importing ? 'Importing Data...' : `Import ${preview.length ? `${preview.length} Rows` : 'to Database'}`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
