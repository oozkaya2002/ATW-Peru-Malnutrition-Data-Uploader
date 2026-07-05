import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

export interface LMSDataRow {
  sex: number;
  agemos?: number;
  agedays?: number;
  l: number;
  m: number;
  s: number;
}

// Loads and parses any CDC/WHO LMS CSV file on demand
export function loadLmsCsv(fileName: string): LMSDataRow[] {
  const filePath = path.join(process.cwd(), 'data', fileName);
  const fileContent = fs.readFileSync(filePath, 'utf8');
  
  const parsed = Papa.parse(fileContent, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });

  return parsed.data.map((row: any) => ({
    sex: row.Sex ?? row.sex,
    agemos: row.Agemos ?? row.agemos ?? row._agedays ? (row._agedays / 30.4375) : undefined,
    agedays: row._agedays ?? row.agedays,
    // Safely capture generic or measurement-specific parameters
    l: row.L ?? row._bmi_l ?? row._wei_l ?? row._len_l ?? row._armc_l ?? 1.0,
    m: row.M ?? row._bmi_m ?? row._wei_m ?? row._len_m ?? row._armc_m ?? 1.0,
    s: row.S ?? row._bmi_s ?? row._wei_s ?? row._len_s ?? row._armc_s ?? 0.1,
  }));
}