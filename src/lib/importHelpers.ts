// src/lib/importHelpers.ts

import Papa from 'papaparse';
import * as XLSX from 'xlsx';

/** Detect file type based on extension */
export function detectFileType(file: File): 'csv' | 'excel' {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) return 'csv';
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'excel';
  // default to csv for safety
  return 'csv';
}

/** Parse CSV file using PapaParse */
export function parseCsv(file: File): Promise<Array<Record<string, any>>> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, any>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data as any),
      error: (err) => reject(err),
    });
  });
}

/** Parse Excel file (xlsx or xls) using SheetJS */
export function parseExcel(file: File): Promise<Array<Record<string, any>>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      if (!data) {
        reject(new Error('Failed to read file'));
        return;
      }
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
      resolve(json);
    };
    reader.onerror = (e) => reject(e);
    // read as binary string for SheetJS
    reader.readAsBinaryString(file);
  });
}

/** Utility to parse a file (CSV or Excel) */
export async function parseFile(file: File): Promise<Array<Record<string, any>>> {
  const type = detectFileType(file);
  if (type === 'csv') return await parseCsv(file);
  return await parseExcel(file);
}
