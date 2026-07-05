import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { calculateGrowthMetrics } from "./src/lib/growthCalculations";
// @ts-ignore
import heicConvert from "heic-convert";

dotenv.config();

// Define a schema for JSON output from Gemini
const parseFormSchema = {
  type: Type.OBJECT,
  properties: {
    nombre: { type: Type.STRING, description: "Full name of the patient (Nombre)" },
    dob: { type: Type.STRING, description: "Date of Birth (FDN) in DD/MM/YYYY format" },
    sexo: { type: Type.STRING, description: "Gender of the patient (Masculino, Femenino, or N/A)" },
    comunidad: { type: Type.STRING, description: "Community (Comunidad) name" },
    escuela: { type: Type.STRING, description: "School attendance status (Escuela S/N), return 'Si', 'No', or 'N/A'" },
    ultima_visita: { type: Type.STRING, description: "Date of current/last visit in DD/MM/YYYY format or the date stamped on the form (e.g. 20-06-2026 or 29/06/2026)" },
    alergias: { type: Type.STRING, description: "Allergies list or 'No' or 'Ninguna'" },
    medicamentos_actuales: { type: Type.STRING, description: "Current medications being taken (Medicamentos Que Esta Tomando)" },
    historial_medico: { type: Type.STRING, description: "Medical history or symptoms (Historial Medico / Hx)" },
    altura_cm: { type: Type.NUMBER, description: "Height (Altura) in centimeters. Handle decimal numbers." },
    peso_kg: { type: Type.NUMBER, description: "Weight (Peso) in kilograms. Handle decimal numbers." },
    presion_arterial: { type: Type.STRING, description: "Blood pressure in mmHg (e.g. '89/69')" },
    temperatura_c: { type: Type.NUMBER, description: "Temperature in degrees Celsius. Handle decimal numbers." },
    muac_cm: { type: Type.NUMBER, description: "Arm circumference (Perimetro braquial / MUAC) in centimeters. Handle decimal numbers." },
    albendazole: { type: Type.STRING, description: "Albendazole status, return 'Si', 'No', or 'N/A'" },
    nombre_doctor: { type: Type.STRING, description: "Doctor's name (Nombre de Doctor / Dr.)" },
    diagnostico: { type: Type.STRING, description: "Diagnosis (Diagnostic / Diagnostico)" },
    medicamentos_recetados: { type: Type.STRING, description: "Prescribed medications (Medicamentos recetados / Rx Prescribed)" },
    notas: { type: Type.STRING, description: "Additional notes or stamps" },
    
    dengue_test: { type: Type.STRING, description: "Dengue test status (Si/No/N/A)" },
    dengue_result: { type: Type.STRING, description: "Dengue test result (Positive/Negative or empty)" },
    malaria_test: { type: Type.STRING, description: "Malaria test status (Si/No/N/A)" },
    malaria_result: { type: Type.STRING, description: "Malaria test result (Positive/Negative or empty)" },
    urinalysis_test: { type: Type.STRING, description: "Urinalysis test status (Si/No/N/A)" },
    urinalysis_result: { type: Type.STRING, description: "Urinalysis test result" },
    glucose_test: { type: Type.STRING, description: "Glucose test status (Si/No/N/A)" },
    glucose_mg_dl: { type: Type.NUMBER, description: "Glucose mg/dL value if tested or null" },
    
    calculated_age_months: { type: Type.NUMBER, description: "Calculated age of the patient in months at the time of the visit" },
    calculated_age_years: { type: Type.NUMBER, description: "Calculated age of the patient in years at the time of the visit" },
    
    percentile_weight_for_age: { type: Type.STRING, description: "Weight-for-age percentile (e.g. '75th' or 'N/A' if > 20 years old). Based on WHO standards for <= 5 years old, or CDC standards for 5 to 20 years old." },
    percentile_height_for_age: { type: Type.STRING, description: "Height-for-age percentile (e.g. '50th' or 'N/A' if > 20 years old). Based on WHO standards for <= 5 years old, or CDC standards for 5 to 20 years old." },
    percentile_muac_for_age: { type: Type.STRING, description: "MUAC-for-age percentile (e.g. '15th' or 'N/A' if > 5 years old). Based on WHO standards for <= 5 years old. Set to 'N/A' if older than 5." },
    
    percentile_explanations: { type: Type.STRING, description: "Detailed explanation of which standards (WHO/CDC) were used, the estimated z-scores or percentiles, and how they match the age/gender." },
    
    validation_flags: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          field: { type: Type.STRING, description: "The field name with potential issues (e.g. 'peso_kg', 'altura_cm', 'dob', 'temperatura_c')" },
          issue_type: { type: Type.STRING, description: "Type of issue: 'illogical_outlier', 'missing_value', 'blurry_low_res', 'suspect_value'" },
          severity: { type: Type.STRING, description: "Severity of issue: 'red' (critical warning/illogical outlier), 'yellow' (minor warning/missing)" },
          description: { type: Type.STRING, description: "Detailed description of why this field is suspect (e.g. '83.0 cm height is expected, but form says 23.0 cm which is an outlier for 2yr old', or 'Temperature 36.5C is healthy but form says 12.5C')" }
        },
        required: ["field", "issue_type", "severity", "description"]
      },
      description: "List of fields flagged for manual review due to missing values (only for the 8 core fields: nombre, dob, sexo, comunidad, altura_cm, peso_kg, temperatura_c, muac_cm), illegible text, or illogical outliers (e.g. a baby of 1 year > 10kg, or incorrect temperature, or values that deviate significantly from standard growth curves)."
    }
  },
  required: [
    "nombre", "dob", "sexo", "comunidad", "escuela", "ultima_visita", "alergias", "medicamentos_actuales",
    "historial_medico", "altura_cm", "peso_kg", "presion_arterial", "temperatura_c", "muac_cm", "albendazole",
    "nombre_doctor", "diagnostico", "medicamentos_recetados", "notas", "calculated_age_months", "calculated_age_years",
    "percentile_weight_for_age", "percentile_height_for_age", "percentile_muac_for_age", "percentile_explanations", "validation_flags",
    "dengue_test", "dengue_result", "malaria_test", "malaria_result", "urinalysis_test", "urinalysis_result", "glucose_test", "glucose_mg_dl"
  ]
};

function cleanTranscribedText(text: string | null | undefined): string {
  if (!text) return "";
  const lines = text.split("\n");
  const cleanedLines = lines.map(line => {
    let cleaned = line.trim();
    while (
      cleaned.startsWith("-") || 
      cleaned.startsWith("+") || 
      cleaned.startsWith("=") || 
      cleaned.startsWith("@") || 
      cleaned.startsWith("*") || 
      cleaned.startsWith("•") ||
      cleaned.startsWith("–")
    ) {
      cleaned = cleaned.substring(1).trim();
    }
    return cleaned;
  }).filter(line => line.length > 0);
  
  return cleanedLines.join("; ");
}

function standardizeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  let cleaned = dateStr.trim();
  cleaned = cleaned.replace(/[-.]/g, "/");
  const parts = cleaned.split("/");
  if (parts.length === 3) {
    let day = parts[0].trim();
    let month = parts[1].trim();
    let year = parts[2].trim();
    
    if (year.length === 2) {
      const yearNum = parseInt(year, 10);
      year = yearNum > 26 ? `19${year}` : `20${year}`;
    }
    
    if (day.length === 1) day = `0${day}`;
    if (month.length === 1) month = `0${month}`;
    
    return `${day}/${month}/${year}`;
  }
  return cleaned;
}

function mapCommunity(comunidadStr: string | null | undefined): string {
  if (!comunidadStr) return "San Joaquin de Omaguas";
  const s = comunidadStr.trim().toLowerCase();
  
  if (s.includes("omagua")) return "San Joaquin de Omaguas";
  if (s.includes("manac") || s.includes("miri")) return "Manacamiri";
  if (s.includes("indiana")) return "Indiana";
  if (s.includes("maria") || s.includes("ojeal") || s.includes("santa")) return "Santa Maria del Ojeal";
  if (s.includes("belen") || s.includes("belén")) return "Belen";
  
  return "San Joaquin de Omaguas"; // fallback to standard community choice
}

function mapDoctor(doctorStr: string | null | undefined): string {
  if (!doctorStr) return "Edson, Dr.";
  const s = doctorStr.trim().toLowerCase();
  
  if (s.includes("anila")) return "Anila, Dr.";
  if (s.includes("edson")) return "Edson, Dr.";
  if (s.includes("alex")) return "Alex, Dr.";
  if (s.includes("vanessa")) return "Vanessa, Dr.";
  if (s.includes("arman")) return "Arman";
  
  return "Edson, Dr."; // fallback to standard doctor choice
}

function mapAllergies(allergiesStr: string | null | undefined): string {
  if (!allergiesStr) return "None";
  const s = allergiesStr.trim().toLowerCase();
  if (s === "" || s === "no" || s === "ninguna" || s === "ninguno" || s === "n/a" || s === "none") {
    return "None";
  }
  return allergiesStr.trim();
}

function mapTestStatus(statusStr: string | null | undefined): string {
  if (!statusStr) return "Not done";
  const s = statusStr.trim().toLowerCase();
  if (s === "si" || s === "yes" || s === "done" || s === "sí" || s === "true") {
    return "Done";
  }
  return "Not done";
}

function cleanStampInfo(text: string | null | undefined): string {
  if (!text) return "";
  let cleaned = text.trim();
  
  // Remove references to stamped dates, stamps, or stamp symbols
  cleaned = cleaned.replace(/\(Stamp\)/gi, "");
  cleaned = cleaned.replace(/\[Stamp\]/gi, "");
  cleaned = cleaned.replace(/\bStamp\b/gi, "");
  cleaned = cleaned.replace(/\bstamped\b/gi, "");
  cleaned = cleaned.replace(/sello/gi, "");
  cleaned = cleaned.replace(/sticker/gi, "");
  
  // Remove blue star, red check, green smiley references (English & Spanish)
  const symbolsRegex = /\b(?:blue\s+star|estrella\s+azul|red\s+check\s*(?:mark)?|checkmark|verificación|check\s*mark|green\s+smiley|carita\s+(?:feliz|verde)|smile|smiley|smiley\s+face)\b/gi;
  cleaned = cleaned.replace(symbolsRegex, "");
  
  // Remove dates that look like a stamp, e.g. "JUN 29 2026", "JUN 29, 2026"
  const dateRegex = /\b(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+\d{1,2}(?:\s*,\s*|\s+)\d{4}\b/gi;
  cleaned = cleaned.replace(dateRegex, "");

  // Also remove standard dates if they are in the notes field
  const standardDateRegex = /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g;
  cleaned = cleaned.replace(standardDateRegex, "");

  // Clean up any stray semicolons, commas, or extra whitespace left behind
  cleaned = cleaned.replace(/^[;,\s\-\•\+]+|[;,\s\-\•\+]+$/g, "");
  cleaned = cleaned.replace(/\s*[;,]\s*[;,]\s*/g, "; ");
  cleaned = cleaned.split(";").map(p => p.trim()).filter(p => {
    if (!p) return false;
    const lower = p.toLowerCase();
    if (
      lower === "stamp" || 
      lower === "stamped" || 
      lower === "n/a" || 
      lower.includes("star") || 
      lower.includes("estrella") || 
      lower.includes("check") || 
      lower.includes("carita") || 
      lower.includes("smiley")
    ) return false;
    return true;
  }).join("; ");

  return cleaned.trim();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support large base64 body uploads
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));

  // Initialize Google GenAI on the server side
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  // API endpoint to parse the handwritten medical form image
  app.post("/api/parse-form", async (req, res) => {
    try {
      const { image, mimeType } = req.body;

      if (!image) {
        return res.status(400).json({ error: "No image data provided" });
      }

      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY") {
        return res.status(500).json({
          error: "API Key is not configured. Please configure your GEMINI_API_KEY in the Secrets panel in the AI Studio UI.",
          isApiKeyMissing: true
        });
      }

      let activeMimeType = mimeType || "image/jpeg";
      let activeImageData = image;
      let convertedImageBase64: string | undefined = undefined;

      const isHeic = (
        (mimeType && (mimeType.toLowerCase().includes("heic") || mimeType.toLowerCase().includes("heif"))) ||
        (image && (image.startsWith("AAAAIGZ0eXBoZWlj") || image.startsWith("AAAAIGZ0eXBoZWlm") || image.startsWith("AAAAFnZ0eXBoZWlj") || image.startsWith("AAAAGGZ0eXBoZWlj") || image.startsWith("AAAAGGZ0eXBoZWlm")))
      );

      if (isHeic) {
        try {
          console.log("Server-side HEIC conversion triggered...");
          const inputBuffer = Buffer.from(image, "base64");
          const outputBuffer = await heicConvert({
            buffer: inputBuffer,
            format: "JPEG",
            quality: 0.8
          });
          activeImageData = outputBuffer.toString("base64");
          activeMimeType = "image/jpeg";
          convertedImageBase64 = `data:image/jpeg;base64,${activeImageData}`;
          console.log("Server-side HEIC conversion succeeded!");
        } catch (err: any) {
          console.error("Server-side HEIC conversion failed:", err);
        }
      }

      // Convert the base64 data to Gemini part format
      const imagePart = {
        inlineData: {
          mimeType: activeMimeType,
          data: activeImageData,
        },
      };

      const systemInstruction = `You are an expert clinical pediatric data assistant specializing in parsing paper medical campaign intake sheets, calculating pediatric growth percentiles, and auditing clinical data quality.

Your task is to accurately extract fields from the uploaded medical form image, even if the text is handwritten in different styles, rotated, or contains medical abbreviations.

Additionally, you MUST calculate or estimate the child's growth percentiles:
1. Use WHO standards (Weight-for-Age, Height-for-Age, and Arm Circumference/MUAC-for-Age) for infants and children up to age 5 (60 months).
2. Use CDC standards (Weight-for-Age, Stature/Height-for-Age) for children and adolescents aged 5 to 20 years.
3. If they are older than 20 years, return "N/A" for all percentile fields.
Provide a clear, clinical explanation of how you derived these percentiles in 'percentile_explanations'.

Crucially, you MUST clean up transcribed text fields to prevent dirtying clinical records:
- Do NOT directly transcribe leading dashes ("-"), bullet points ("•", "*"), plus signs ("+"), or equals signs ("=") that doctors use to indicate list items. Strip these leading symbols completely.
- If a doctor writes list items across multiple lines, clean each line of its leading dashes/symbols, and join them with semicolons (e.g., "Paracetamol; Ibuprofeno") rather than newlines with bullet points. This prevents formula parsing issues in spreadsheet software like Excel/Sheets.
- Standardize all dates to DD/MM/YYYY format (e.g. if written as "10-02-2024", transcribe as "10/02/2024").

***NEW DATA CLEANING AND TRANSLATION RULES***:
1. For 'diagnostico' (Diagnosis), 'medicamentos_recetados' (Rx Prescribed), and 'notas' (Notes), you MUST clean the text to be a consistent, clean, and easily understandable format.
2. If the transcribed field contains Spanish, you MUST append the accurate English translation in parentheses. For example:
   - "Faringitis aguda" -> "Faringitis aguda (Acute pharyngitis)"
   - "Tos" -> "Tos (Cough)"
   - "Parasitosis intestinal" -> "Parasitosis intestinal (Intestinal parasitosis)"
   - "Ninguna" or "Ninguno" or "No" -> "None"
   - "Ibuprofeno 100 mg/5ml | 2.5 ml c/8horas x 3dias" -> "Ibuprofeno 100 mg/5ml; 2.5 ml cada 8 horas por 3 días (Ibuprofen 100 mg/5ml; 2.5 ml every 8 hours for 3 days)"
3. For 'notas' (Notes), completely remove/omit any mentions of stickers or stamps (e.g. "sello de estrella azul", "blue star sticker", "red check mark", "carita feliz", "green smiley face", "sello", etc.). Only transcribe genuine clinical notes, with their English translation in parentheses. If the notes field contains only stamps/stickers or stamps dates, return an empty string "".
4. Ensure medical abbreviations are expanded into standard medical terminology where appropriate (e.g. "c/8h" -> "cada 8 horas", "x 3d" -> "por 3 días").

Crucially, you MUST audit the extracted data for correctness:
- Flag illogical outliers in 'validation_flags' as 'red' severity. For example:
  - If a baby around 1 year old (12 months) has a weight > 12.5kg or a height < 65cm, check if the handwriting was misread (e.g. 23.0 cm height for a 2-year-old child is likely a typo or misread of 83.0 cm). Flag this!
  - If a patient's temperature is outside the human normal range of 35.5°C to 40.0°C (e.g. 12.50 °C is clearly a weight value written in the temperature field, or 39.2 cm is height written in height field but with temperature missing, etc.). Flag any incorrect placements of values.
- ONLY flag missing values or blank fields as 'yellow' severity if they are one of the following 8 core fields: 'nombre' (name), 'dob' (date of birth), 'sexo' (gender), 'comunidad' (community), 'altura_cm' (height), 'peso_kg' (weight), 'temperatura_c' (temperature), or 'muac_cm' (MUAC). Do NOT flag blank values for any other fields (such as allergies, doctor name, current medications, prescribed medications, notes, or laboratory tests) as missing or yellow.
- Flag illegible, low-resolution, or blurry values as 'yellow' or 'red' severity with 'issue_type': 'blurry_low_res'.
- If the patient has any other clinical indicators (e.g., extremely high/low blood pressure, critical diagnoses), note them.

Ensure all parsed fields match the handwritten data as closely as possible. If a value is missing or completely illegible on the sheet, return null for numbers or 'N/A' / empty for strings and flag it in validation_flags.`;

      const prompt = "Please process this medical form image. Parse all handwritten fields, compute child ages, calculate percentiles (WHO for <=5 yrs, CDC for 5-20 yrs, N/A for >20 yrs) for height/stature, weight, and MUAC, and check for illogical clinical outliers or reading errors.";

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: { parts: [imagePart, { text: prompt }] },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: parseFormSchema,
          temperature: 0.1, // low temperature for high extraction accuracy
        },
      });

      if (!response.text) {
        throw new Error("No text returned from Gemini");
      }

      const extractedData = JSON.parse(response.text.trim());

      // Post-processing string field sanitization and date standardizations
      const stringFieldsToClean = [
        "nombre", "sexo", "comunidad", "escuela", "alergias", "medicamentos_actuales",
        "historial_medico", "presion_arterial", "albendazole", "nombre_doctor", "diagnostico",
        "medicamentos_recetados", "notas", "dengue_test", "dengue_result", "malaria_test",
        "malaria_result", "urinalysis_test", "urinalysis_result", "glucose_test"
      ];

      for (const field of stringFieldsToClean) {
        if (typeof extractedData[field] === "string") {
          extractedData[field] = cleanTranscribedText(extractedData[field]);
        }
      }

      // Standardize to strict single choice of 5 possible community values
      extractedData.comunidad = mapCommunity(extractedData.comunidad);

      // Standardize to strict single choice of 5 possible doctors
      extractedData.nombre_doctor = mapDoctor(extractedData.nombre_doctor);

      // Standardize allergies to "None" if empty or none reported
      extractedData.alergias = mapAllergies(extractedData.alergias);

      // Map laboratory tests to "Done" / "Not done"
      extractedData.dengue_test = mapTestStatus(extractedData.dengue_test);
      extractedData.malaria_test = mapTestStatus(extractedData.malaria_test);
      extractedData.urinalysis_test = mapTestStatus(extractedData.urinalysis_test);
      extractedData.glucose_test = mapTestStatus(extractedData.glucose_test);

      // Sanitize notes (strip stamped symbol, stamped date and time)
      extractedData.notas = cleanStampInfo(extractedData.notas);

      // Fix glucose -1 or empty glucose test bug
      if (extractedData.glucose_test === 'Not done' || extractedData.glucose_mg_dl === -1) {
        extractedData.glucose_mg_dl = null;
      }

      // Standardize dates
      if (extractedData.dob) {
        extractedData.dob = standardizeDate(extractedData.dob);
      }
      if (extractedData.ultima_visita) {
        if (/^\d+[-/.]\d+[-/.]\d+$/.test(extractedData.ultima_visita.trim())) {
          extractedData.ultima_visita = standardizeDate(extractedData.ultima_visita);
        } else {
          extractedData.ultima_visita = cleanTranscribedText(extractedData.ultima_visita);
        }
      }

      // programmatically calculate exact Z-scores and percentiles using the LMS tables and SAS math logic
      if (extractedData.dob && extractedData.sexo) {
        try {
          const calculatedMetrics = calculateGrowthMetrics(
            extractedData.dob,
            extractedData.ultima_visita || "",
            extractedData.sexo,
            extractedData.altura_cm,
            extractedData.peso_kg,
            extractedData.muac_cm
          );

          extractedData.calculated_age_months = calculatedMetrics.calculated_age_months;
          extractedData.calculated_age_years = calculatedMetrics.calculated_age_years;
          extractedData.percentile_weight_for_age = calculatedMetrics.percentile_weight_for_age;
          extractedData.percentile_height_for_age = calculatedMetrics.percentile_height_for_age;
          extractedData.percentile_muac_for_age = calculatedMetrics.percentile_muac_for_age;
          extractedData.percentile_explanations = calculatedMetrics.percentile_explanations;
        } catch (calcErr) {
          console.error("Error during programmatic growth calculation:", calcErr);
        }
      }

      // Filter out validation flags for missing values of fields that are NOT the 8 core fields
      const coreFields = ["nombre", "dob", "sexo", "comunidad", "altura_cm", "peso_kg", "temperatura_c", "muac_cm"];
      if (extractedData.validation_flags) {
        extractedData.validation_flags = extractedData.validation_flags.filter((flag: any) => {
          if (flag.issue_type === "missing_value") {
            return coreFields.includes(flag.field);
          }
          return true;
        });
      }

      // Perform a secondary programmatic validation to catch common human writing slips
      const programmaticFlags = [];
      const { dob, ultima_visita, peso_kg, altura_cm, temperatura_c, calculated_age_years } = extractedData;

      if (temperatura_c !== null) {
        if (temperatura_c < 35.0 || temperatura_c > 41.5) {
          programmaticFlags.push({
            field: "temperatura_c",
            issue_type: "illogical_outlier",
            severity: "red",
            description: `Programmatic alert: Temperature of ${temperatura_c}°C is clinically improbable for a living patient. This is likely a writing slip or misplaced value (e.g. weight of 12.50kg written in Celsius).`
          });
        }
      }

      if (calculated_age_years !== null && calculated_age_years < 1) {
        if (peso_kg !== null && peso_kg > 15) {
          programmaticFlags.push({
            field: "peso_kg",
            issue_type: "illogical_outlier",
            severity: "red",
            description: `Programmatic alert: Weight of ${peso_kg}kg is extremely high for an infant under 1 year old.`
          });
        }
      }

      if (altura_cm !== null && calculated_age_years !== null && calculated_age_years >= 1 && calculated_age_years <= 3) {
        if (altura_cm < 40) {
          programmaticFlags.push({
            field: "altura_cm",
            issue_type: "illogical_outlier",
            severity: "red",
            description: `Programmatic alert: Height of ${altura_cm}cm is extremely low for a child aged ${calculated_age_years.toFixed(1)} years. Check if 83.0 cm was misread as 23.0 cm.`
          });
        }
      }

      // Merge programmatic flags into validation flags
      if (programmaticFlags.length > 0) {
        if (!extractedData.validation_flags) {
          extractedData.validation_flags = [];
        }
        // Avoid duplicate flags for the same field if already exists
        for (const progFlag of programmaticFlags) {
          const exists = extractedData.validation_flags.some(
            (f: any) => f.field === progFlag.field && f.issue_type === progFlag.issue_type
          );
          if (!exists) {
            extractedData.validation_flags.push(progFlag);
          }
        }
      }

      if (convertedImageBase64) {
        extractedData.convertedImage = convertedImageBase64;
      }

      res.json(extractedData);
    } catch (error: any) {
      console.error("Error parsing form:", error);
      res.status(500).json({ error: error.message || "An error occurred while processing the form" });
    }
  });

  // API endpoint to recalculate growth metrics programmatically
  app.post("/api/calculate-metrics", (req, res) => {
    try {
      const { dob, ultima_visita, sexo, altura_cm, peso_kg, muac_cm } = req.body;
      const metrics = calculateGrowthMetrics(
        dob,
        ultima_visita || "",
        sexo || "",
        altura_cm !== undefined ? altura_cm : null,
        peso_kg !== undefined ? peso_kg : null,
        muac_cm !== undefined ? muac_cm : null
      );
      res.json(metrics);
    } catch (error: any) {
      console.error("Error calculating growth metrics on backend:", error);
      res.status(500).json({ error: error.message || "An error occurred during calculation" });
    }
  });

  // Serve static files / Vite dev server integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
