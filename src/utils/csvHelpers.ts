export function generateCSV(data: Record<string, unknown>[], columns: string[]): string {
  if (!columns.length) return "";

  const escape = (value: unknown): string => {
    const str = String(value ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map(escape).join(",");
  if (!data.length) return header;

  const rows = data.map((row) => columns.map((col) => escape(row[col] ?? "")).join(","));
  return [header, ...rows].join("\n");
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateSampleCSV(type: "customer" | "asset" | "technician" | "supervisor"): string {
  if (type === "customer") {
    const headers = ["full_name", "email", "phone", "password"];
    const example = ["John Doe", "john@test.com", "9876543210", "Welcome@123"];
    return [headers.join(","), example.join(",")].join("\n");
  }

  if (type === "asset") {
    const headers = [
      "customer_name",
      "product_name",
      "model_number",
      "serial_number",
      "category",
      "purchase_date",
      "warranty_months",
    ];
    const example = ["Lakshmi", "CCTV Camera", "CAM-HD-1080", "SN123456", "CCTV & Security", "2024-01-01", "12"];
    return [headers.join(","), example.join(",")].join("\n");
  }

  if (type === "technician") {
    const headers = ["full_name", "email", "phone", "branch", "expertise", "password"];
    const example = [{
      full_name: "John Doe",
      email: "john@test.com",
      phone: "9999999999",
      branch: "Hyderabad",
      expertise: "Solar,CCTV,Networking",
      password: "TechPass123!",
    }];
    return generateCSV(example, headers);
  }

  if (type === "supervisor") {
    const headers = ["full_name", "email", "phone", "branch", "expertise", "password"];
    const example = [{
      full_name: "Jane Smith",
      email: "jane@test.com",
      phone: "8888888888",
      branch: "Bangalore",
      expertise: "Solar,CCTV,Networking",
      password: "SupPass123!",
    }];
    return generateCSV(example, headers);
  }

  return "";
}
