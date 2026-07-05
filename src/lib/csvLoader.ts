import fs from "fs";
import path from "path";

export interface WHORow {
  agedays: number;
  armc_l: number;
  armc_m: number;
  armc_s: number;
  wei_l: number;
  wei_m: number;
  wei_s: number;
  len_l: number;
  len_m: number;
  len_s: number;
}

export interface CDCRow {
  agemos: number;
  l: number;
  m: number;
  s: number;
}

// Simple robust CSV parser
function parseCSV(content: string): string[][] {
  return content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => line.split(","));
}

export function loadWHOMilestones(): WHORow[] {
  try {
    const filePath = path.join(process.cwd(), "src", "data", "who_lms.csv");
    if (!fs.existsSync(filePath)) {
      console.warn(`CSV file not found at ${filePath}. Make sure it is deployed or created.`);
      return [];
    }
    const content = fs.readFileSync(filePath, "utf8");
    const rows = parseCSV(content);
    
    // Header is row 0. Structure:
    // index 1: _agedays
    // index 11: _armc_l, index 12: _armc_m, index 13: _armc_s
    // index 17: _wei_l, index 18: _wei_m, index 19: _wei_s
    // index 20: _len_l, index 21: _len_m, index 22: _len_s
    const dataRows = rows.slice(1);
    
    return dataRows.map(row => {
      return {
        agedays: parseInt(row[1], 10) || 0,
        armc_l: parseFloat(row[11]) || 1.0,
        armc_m: parseFloat(row[12]) || 1.0,
        armc_s: parseFloat(row[13]) || 0.1,
        wei_l: parseFloat(row[17]) || 1.0,
        wei_m: parseFloat(row[18]) || 1.0,
        wei_s: parseFloat(row[19]) || 0.1,
        len_l: parseFloat(row[20]) || 1.0,
        len_m: parseFloat(row[21]) || 1.0,
        len_s: parseFloat(row[22]) || 0.1
      };
    });
  } catch (error) {
    console.error("Error reading or parsing WHO milestones from CSV:", error);
    return [];
  }
}

export function loadCDCStatureMilestones(): CDCRow[] {
  try {
    const filePath = path.join(process.cwd(), "src", "data", "cdc_stature_age.csv");
    if (!fs.existsSync(filePath)) {
      console.warn(`CSV file not found at ${filePath}.`);
      return [];
    }
    const content = fs.readFileSync(filePath, "utf8");
    const rows = parseCSV(content);
    
    // Header is row 0. Structure: Sex [0], Agemos [1], L [2], M [3], S [4]
    const dataRows = rows.slice(1);
    
    return dataRows.map(row => ({
      agemos: parseFloat(row[1]) || 0,
      l: parseFloat(row[2]) || 1.0,
      m: parseFloat(row[3]) || 1.0,
      s: parseFloat(row[4]) || 0.1
    }));
  } catch (error) {
    console.error("Error reading or parsing CDC stature milestones from CSV:", error);
    return [];
  }
}

export function loadCDCWeightMilestones(): CDCRow[] {
  try {
    const filePath = path.join(process.cwd(), "src", "data", "cdc_weight_age.csv");
    if (!fs.existsSync(filePath)) {
      console.warn(`CSV file not found at ${filePath}.`);
      return [];
    }
    const content = fs.readFileSync(filePath, "utf8");
    const rows = parseCSV(content);
    
    // Header is row 0. Structure: Sex [0], Agemos [1], L [2], M [3], S [4]
    const dataRows = rows.slice(1);
    
    return dataRows.map(row => ({
      agemos: parseFloat(row[1]) || 0,
      l: parseFloat(row[2]) || 1.0,
      m: parseFloat(row[3]) || 1.0,
      s: parseFloat(row[4]) || 0.1
    }));
  } catch (error) {
    console.error("Error reading or parsing CDC weight milestones from CSV:", error);
    return [];
  }
}
