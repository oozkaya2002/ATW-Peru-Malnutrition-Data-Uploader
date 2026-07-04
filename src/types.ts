export interface ValidationFlag {
  field: string;
  issue_type: 'illogical_outlier' | 'missing_value' | 'blurry_low_res' | 'suspect_value';
  severity: 'red' | 'yellow';
  description: string;
}

export interface MedicalRecord {
  id: string; // Unique client-side ID
  imageName: string;
  imageSrc: string; // Base64 or ObjectURL for display
  status: 'pending' | 'processing' | 'success' | 'failed';
  errorMsg?: string;

  // Extracted Data Fields
  nombre: string;
  dob: string;
  sexo: string;
  comunidad: string;
  escuela: string;
  ultima_visita: string;
  alergias: string;
  medicamentos_actuales: string;
  historial_medico: string;
  altura_cm: number | null;
  peso_kg: number | null;
  presion_arterial: string;
  temperatura_c: number | null;
  muac_cm: number | null;
  albendazole: string;
  nombre_doctor: string;
  diagnostico: string;
  medicamentos_recetados: string;
  notas: string;

  // New Lab Test Fields
  dengue_test?: string;
  dengue_result?: string;
  malaria_test?: string;
  malaria_result?: string;
  urinalysis_test?: string;
  urinalysis_result?: string;
  glucose_test?: string;
  glucose_mg_dl?: number | null;

  // Calculated Age and Percentiles
  calculated_age_months: number | null;
  calculated_age_years: number | null;
  percentile_weight_for_age: string;
  percentile_height_for_age: string;
  percentile_muac_for_age: string;
  percentile_explanations: string;

  // Auditing
  validation_flags: ValidationFlag[];
}
