import React, { useState } from 'react';
import { MedicalRecord, ValidationFlag } from '../types';
import { X, Save, AlertTriangle, RefreshCw, ZoomIn, Info, Check, Sparkles, FileText } from 'lucide-react';

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

interface FormDetailModalProps {
  record: MedicalRecord;
  onClose: () => void;
  onSave: (updated: MedicalRecord) => void;
  onRecalculatePercentiles: (record: MedicalRecord) => Promise<void>;
  isRecalculating: boolean;
}

export default function FormDetailModal({
  record,
  onClose,
  onSave,
  onRecalculatePercentiles,
  isRecalculating
}: FormDetailModalProps) {
  const [formData, setFormData] = useState<MedicalRecord>({ ...record });
  const [zoomImage, setZoomImage] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Synchronize component state if parent record changes (e.g. after recalculating)
  React.useEffect(() => {
    setFormData({ ...record });
    setImageError(false);
  }, [record]);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
      const updated = { ...prev };
      
      // Handle numeric parses
      if (['altura_cm', 'peso_kg', 'temperatura_c', 'muac_cm', 'calculated_age_months', 'calculated_age_years', 'glucose_mg_dl'].includes(name)) {
        updated[name as keyof MedicalRecord] = value === '' ? null : (parseFloat(value) as any);
      } else {
        updated[name as keyof MedicalRecord] = value as any;
      }
      
      // If we change test status to 'Not done', clear corresponding result fields
      if (name === 'dengue_test' && value === 'Not done') {
        updated.dengue_result = '';
      } else if (name === 'malaria_test' && value === 'Not done') {
        updated.malaria_result = '';
      } else if (name === 'urinalysis_test' && value === 'Not done') {
        updated.urinalysis_result = '';
      } else if (name === 'glucose_test' && value === 'Not done') {
        updated.glucose_mg_dl = null;
      }
      
      return updated;
    });
  };

  const handleSave = () => {
    // Start with existing flags but filter out any missing_value flags for the 8 core fields first
    // so we can recalculate them cleanly based on current form inputs!
    let localFlags = formData.validation_flags.filter(f => f.issue_type !== 'missing_value');

    // Clean allergies
    let cleanAllergies = formData.alergias ? formData.alergias.trim() : 'None';
    if (!cleanAllergies || cleanAllergies.toLowerCase() === 'no' || cleanAllergies.toLowerCase() === 'ninguna' || cleanAllergies.toLowerCase() === 'ninguno' || cleanAllergies.toLowerCase() === 'n/a' || cleanAllergies.toLowerCase() === 'none' || cleanAllergies === '') {
      cleanAllergies = 'None';
    }

    // Clean notes (remove stamped symbol, stamped date and time)
    const cleanNotesVal = cleanStampInfo(formData.notas);

    // Clean glucose test status and value
    const cleanGlucoseTest = formData.glucose_test || 'Not done';
    let cleanGlucoseVal = formData.glucose_mg_dl;
    if (cleanGlucoseTest === 'Not done' || cleanGlucoseVal === -1) {
      cleanGlucoseVal = null;
    }

    // 1. nombre
    if (!formData.nombre || formData.nombre.trim() === '') {
      localFlags.push({
        field: 'nombre',
        issue_type: 'missing_value',
        text: 'Patient name is missing.',
        severity: 'yellow',
        description: 'Patient name is missing.'
      });
    }

    // 2. dob
    if (!formData.dob || formData.dob.trim() === '') {
      localFlags.push({
        field: 'dob',
        issue_type: 'missing_value',
        severity: 'yellow',
        description: 'Patient DOB is missing.'
      });
    }

    // 3. sexo
    if (!formData.sexo || formData.sexo.trim() === '' || formData.sexo === 'N/A') {
      localFlags.push({
        field: 'sexo',
        issue_type: 'missing_value',
        severity: 'yellow',
        description: 'Patient sex/gender is missing.'
      });
    }

    // 4. comunidad
    if (!formData.comunidad || formData.comunidad.trim() === '') {
      localFlags.push({
        field: 'comunidad',
        issue_type: 'missing_value',
        severity: 'yellow',
        description: 'Patient community is missing.'
      });
    }

    // 5. altura_cm
    if (formData.altura_cm === null || formData.altura_cm === undefined) {
      localFlags.push({
        field: 'altura_cm',
        issue_type: 'missing_value',
        severity: 'yellow',
        description: 'Height measurement is missing.'
      });
    }

    // 6. peso_kg
    if (formData.peso_kg === null || formData.peso_kg === undefined) {
      localFlags.push({
        field: 'peso_kg',
        issue_type: 'missing_value',
        severity: 'yellow',
        description: 'Weight measurement is missing.'
      });
    }

    // 7. temperatura_c
    if (formData.temperatura_c === null || formData.temperatura_c === undefined) {
      localFlags.push({
        field: 'temperatura_c',
        issue_type: 'missing_value',
        severity: 'yellow',
        description: 'Temperature measurement is missing.'
      });
    }

    // 8. muac_cm
    if (formData.muac_cm === null || formData.muac_cm === undefined) {
      localFlags.push({
        field: 'muac_cm',
        issue_type: 'missing_value',
        severity: 'yellow',
        description: 'MUAC measurement is missing.'
      });
    }

    // Now re-verify temperature outlier (red severity)
    const tempFlagIdx = localFlags.findIndex(f => f.field === 'temperatura_c' && f.issue_type === 'illogical_outlier');
    if (formData.temperatura_c !== null && (formData.temperatura_c < 35.0 || formData.temperatura_c > 41.5)) {
      if (tempFlagIdx === -1) {
        localFlags.push({
          field: 'temperatura_c',
          issue_type: 'illogical_outlier',
          severity: 'red',
          description: `Auditor corrected: Temperature ${formData.temperatura_c}°C is outside reasonable clinical ranges.`
        });
      }
    } else if (tempFlagIdx !== -1) {
      localFlags = localFlags.filter(f => !(f.field === 'temperatura_c' && f.issue_type === 'illogical_outlier'));
    }

    onSave({
      ...formData,
      alergias: cleanAllergies,
      notas: cleanNotesVal,
      glucose_mg_dl: cleanGlucoseVal,
      validation_flags: localFlags
    });
  };

  const handleRecalculate = async () => {
    await onRecalculatePercentiles(formData);
  };

  // Helper to check if a specific field has a red or yellow flag
  const getFieldStatus = (field: string) => {
    const flag = formData.validation_flags.find(f => f.field === field);
    if (!flag) return null;
    return flag;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all overflow-hidden animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-150 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-700">
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-sans font-bold text-lg text-slate-800">
                Auditing Clinical Record: <span className="text-indigo-700">{formData.nombre || 'Unnamed Patient'}</span>
              </h2>
              <p className="font-sans text-xs text-slate-500">
                Original image: <span className="font-mono">{formData.imageName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content - Two Columns */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* Left Column: Form Scanned Image Preview */}
          <div className="w-full lg:w-1/2 p-4 bg-slate-100 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> Source Document
              </span>
              <button
                onClick={() => setZoomImage(!zoomImage)}
                className="text-xs bg-white text-slate-700 border border-slate-200 px-2.5 py-1 rounded-md flex items-center gap-1 hover:bg-slate-50 transition-all font-semibold font-sans"
              >
                <ZoomIn className="w-3.5 h-3.5 text-slate-500" />
                {zoomImage ? 'Fit Width' : 'Zoom In'}
              </button>
            </div>

            <div className="flex-1 overflow-auto rounded-lg bg-slate-200 flex items-center justify-center border border-slate-300 relative p-4">
              {imageError || !formData.imageSrc ? (
                <div className="p-8 text-center space-y-3 flex flex-col items-center justify-center">
                  <div className="bg-slate-100 p-4 rounded-full border border-slate-300 text-slate-400">
                    <FileText className="w-10 h-10" />
                  </div>
                  <div>
                    <strong className="text-xs font-bold text-slate-700 block">Intake Form Sheet</strong>
                    <span className="text-[10px] font-mono text-slate-500 block mt-0.5">{formData.imageName || 'form_unnamed.jpg'}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed font-sans">
                    Handwritten sheet successfully processed by Gemini AI. The source image is kept locally on your machine during parsing.
                  </p>
                </div>
              ) : (
                <img
                  src={formData.imageSrc}
                  alt="Source intake document"
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                  className={`max-w-full max-h-full rounded-lg object-contain transition-all shadow-md ${
                    zoomImage ? 'scale-150 cursor-zoom-out' : 'scale-100'
                  }`}
                  onClick={() => setZoomImage(!zoomImage)}
                />
              )}
            </div>
          </div>

          {/* Right Column: Editable Fields & Quality Audits */}
          <div className="w-full lg:w-1/2 flex flex-col h-full overflow-hidden">
            {/* Scrollable inputs container */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Quality Audit Alerts Panel */}
              {formData.validation_flags.length > 0 && (
                <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-4 space-y-3">
                  <h3 className="font-sans text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" /> Active Data Quality Flags ({formData.validation_flags.length})
                  </h3>
                  <div className="divide-y divide-rose-100 max-h-40 overflow-y-auto">
                    {formData.validation_flags.map((flag, idx) => (
                      <div key={idx} className="py-2 flex gap-2 text-xs first:pt-0 last:pb-0">
                        <span className={`inline-block px-1.5 py-0.5 rounded-xs font-bold h-fit ${
                          flag.severity === 'red' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {flag.severity === 'red' ? 'OUTLIER' : 'WARNING'}
                        </span>
                        <div>
                          <strong className="text-slate-800 font-sans uppercase text-[10px]">Field: {flag.field}</strong>
                          <p className="text-rose-700 font-sans">{flag.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Patient Core Demographics Section */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 font-sans border-b border-slate-100 pb-1">
                  1. Demographics & Context
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Nombre */}
                  <div className="relative">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 font-sans">
                      Patient Name (Nombre)
                    </label>
                    <input
                      type="text"
                      name="nombre"
                      value={formData.nombre}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-lg text-sm font-sans focus:outline-hidden ${
                        getFieldStatus('nombre')?.severity === 'red'
                          ? 'border-rose-300 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                          : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10'
                      }`}
                    />
                  </div>

                  {/* Date of Birth */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 font-sans">
                      Date of Birth (FDN DD/MM/YYYY)
                    </label>
                    <input
                      type="text"
                      name="dob"
                      placeholder="e.g. 10-02-2024"
                      value={formData.dob}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-hidden ${
                        getFieldStatus('dob')?.severity === 'red'
                          ? 'border-rose-300 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                          : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10'
                      }`}
                    />
                  </div>

                  {/* Sex */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 font-sans">
                      Gender (Sexo)
                    </label>
                    <select
                      name="sexo"
                      value={formData.sexo}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-sans bg-white focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    >
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>

                  {/* Comunidad */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 font-sans">
                      Community (Comunidad)
                    </label>
                    <select
                      name="comunidad"
                      value={formData.comunidad || 'San Joaquin de Omaguas'}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-sans bg-white focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    >
                      <option value="San Joaquin de Omaguas">San Joaquin de Omaguas</option>
                      <option value="Manacamiri">Manacamiri</option>
                      <option value="Indiana">Indiana</option>
                      <option value="Santa Maria del Ojeal">Santa Maria del Ojeal</option>
                      <option value="Belen">Belen</option>
                    </select>
                  </div>

                  {/* Escuela */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 font-sans">
                      In School (Escuela S/N)?
                    </label>
                    <input
                      type="text"
                      name="escuela"
                      placeholder="Si or No"
                      value={formData.escuela}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-sans focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    />
                  </div>

                  {/* Ultima Visita / Form Stamp Date */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 font-sans">
                      Visit Date (Ultima Visita)
                    </label>
                    <input
                      type="text"
                      name="ultima_visita"
                      placeholder="e.g. 20-06-2026"
                      value={formData.ultima_visita}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-sans focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    />
                  </div>
                </div>
              </div>

              {/* Vitals & Growth Metrics Section */}
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-1">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">
                    2. Physical Measurements & Vitals
                  </h3>
                  <button
                    onClick={handleRecalculate}
                    disabled={isRecalculating}
                    className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-lg px-2 py-0.5 flex items-center gap-1 font-bold font-sans disabled:opacity-50 transition-all uppercase"
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${isRecalculating ? 'animate-spin' : ''}`} />
                    Recalculate Percentiles
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {/* Height (Altura_cm) */}
                  <div className="relative">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 font-sans">
                      Height (cm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      name="altura_cm"
                      value={formData.altura_cm || ''}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-hidden ${
                        getFieldStatus('altura_cm')?.severity === 'red'
                          ? 'border-rose-300 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                          : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10'
                      }`}
                    />
                  </div>

                  {/* Weight (Peso_kg) */}
                  <div className="relative">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 font-sans">
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="peso_kg"
                      value={formData.peso_kg || ''}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-hidden ${
                        getFieldStatus('peso_kg')?.severity === 'red'
                          ? 'border-rose-300 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                          : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10'
                      }`}
                    />
                  </div>

                  {/* Temperature */}
                  <div className="relative">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 font-sans">
                      Temp (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      name="temperatura_c"
                      value={formData.temperatura_c || ''}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-hidden ${
                        getFieldStatus('temperatura_c')?.severity === 'red'
                          ? 'border-rose-300 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                          : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10'
                      }`}
                    />
                  </div>

                  {/* MUAC */}
                  <div className="relative">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 font-sans">
                      MUAC (cm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      name="muac_cm"
                      value={formData.muac_cm || ''}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-hidden ${
                        getFieldStatus('muac_cm')?.severity === 'red'
                          ? 'border-rose-300 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                          : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10'
                      }`}
                    />
                  </div>
                </div>

                {/* Growth Percentile Results */}
                <div className="mt-4 bg-slate-50/70 border border-slate-100 rounded-xl p-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase font-sans">Weight % (WFA)</span>
                      <strong className="text-slate-800 text-sm font-mono">{formData.percentile_weight_for_age || 'N/A'}</strong>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase font-sans">Height % (HFA)</span>
                      <strong className="text-slate-800 text-sm font-mono">{formData.percentile_height_for_age || 'N/A'}</strong>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase font-sans">MUAC % (MFA)</span>
                      <strong className="text-slate-800 text-sm font-mono">{formData.percentile_muac_for_age || 'N/A'}</strong>
                    </div>
                  </div>
                  {formData.percentile_explanations && (
                    <div className="mt-3 p-3 bg-white/70 rounded-lg border border-slate-100 text-[11px] text-slate-500 leading-relaxed font-sans">
                      <strong>Percentile Derivation explanation:</strong> {formData.percentile_explanations}
                    </div>
                  )}
                </div>
              </div>

              {/* Diagnosis & Treatments Section */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 font-sans border-b border-slate-100 pb-1">
                  3. Diagnosis, RX & Medical Hx
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Presion Arterial */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1 font-sans">
                        Blood Pressure (BP)
                      </label>
                      <input
                        type="text"
                        name="presion_arterial"
                        placeholder="e.g. 89/69"
                        value={formData.presion_arterial}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-sans focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>

                    {/* Albendazole */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1 font-sans">
                        Albendazole Administered?
                      </label>
                      <input
                        type="text"
                        name="albendazole"
                        placeholder="Si or No"
                        value={formData.albendazole}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-sans focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Historial Medico */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 font-sans">
                      Historial Medico / Medical History (Hx)
                    </label>
                    <textarea
                      name="historial_medico"
                      rows={2}
                      value={formData.historial_medico}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-sans focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    />
                  </div>

                  {/* Diagnostico */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 font-sans">
                      Diagnosis (Diagnostico)
                    </label>
                    <textarea
                      name="diagnostico"
                      rows={2}
                      value={formData.diagnostico}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-sans focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    />
                  </div>

                  {/* Medicamentos recetados */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 font-sans">
                      Prescribed Rx (Medicamentos recetados)
                    </label>
                    <textarea
                      name="medicamentos_recetados"
                      rows={2}
                      value={formData.medicamentos_recetados}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-sans focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    />
                  </div>

                  {/* Doctor & Notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1 font-sans">
                        Doctor Name
                      </label>
                      <select
                        name="nombre_doctor"
                        value={formData.nombre_doctor || 'Edson, Dr.'}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-sans bg-white focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                      >
                        <option value="Anila, Dr.">Anila, Dr.</option>
                        <option value="Edson, Dr.">Edson, Dr.</option>
                        <option value="Alex, Dr.">Alex, Dr.</option>
                        <option value="Vanessa, Dr.">Vanessa, Dr.</option>
                        <option value="Arman">Arman</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1 font-sans">
                        Notes / Stamps
                      </label>
                      <input
                        type="text"
                        name="notas"
                        value={formData.notas}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-sans focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Laboratory Tests Section */}
              <div className="mt-6 border-t border-slate-100 pt-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 font-sans border-b border-slate-100 pb-1">
                  4. Laboratory Tests
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
                  {/* Dengue Test */}
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <span className="block text-xs font-bold text-indigo-700 uppercase tracking-wide mb-2 font-sans">Dengue Test</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5 font-sans">Status (Done/Not done)</label>
                        <select
                          name="dengue_test"
                          value={formData.dengue_test || 'Not done'}
                          onChange={handleChange}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs font-sans bg-white font-medium"
                        >
                          <option value="Done">Done</option>
                          <option value="Not done">Not done</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5 font-sans">Result</label>
                        <input
                          type="text"
                          name="dengue_result"
                          placeholder="Result/Positive/Negative"
                          value={formData.dengue_result || ''}
                          onChange={handleChange}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs font-sans bg-white focus:outline-hidden focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Malaria Test */}
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <span className="block text-xs font-bold text-indigo-700 uppercase tracking-wide mb-2 font-sans">Malaria Test</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5 font-sans">Status (Done/Not done)</label>
                        <select
                          name="malaria_test"
                          value={formData.malaria_test || 'Not done'}
                          onChange={handleChange}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs font-sans bg-white font-medium"
                        >
                          <option value="Done">Done</option>
                          <option value="Not done">Not done</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5 font-sans">Result</label>
                        <input
                          type="text"
                          name="malaria_result"
                          placeholder="Result/Positive/Negative"
                          value={formData.malaria_result || ''}
                          onChange={handleChange}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs font-sans bg-white focus:outline-hidden focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Urinalysis Test */}
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <span className="block text-xs font-bold text-indigo-700 uppercase tracking-wide mb-2 font-sans">Urinalysis Test</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5 font-sans">Status (Done/Not done)</label>
                        <select
                          name="urinalysis_test"
                          value={formData.urinalysis_test || 'Not done'}
                          onChange={handleChange}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs font-sans bg-white font-medium"
                        >
                          <option value="Done">Done</option>
                          <option value="Not done">Not done</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5 font-sans">Result</label>
                        <input
                          type="text"
                          name="urinalysis_result"
                          placeholder="Result"
                          value={formData.urinalysis_result || ''}
                          onChange={handleChange}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs font-sans bg-white focus:outline-hidden focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Glucose Test */}
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <span className="block text-xs font-bold text-indigo-700 uppercase tracking-wide mb-2 font-sans">Glucose Test</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5 font-sans">Status (Done/Not done)</label>
                        <select
                          name="glucose_test"
                          value={formData.glucose_test || 'Not done'}
                          onChange={handleChange}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs font-sans bg-white font-medium"
                        >
                          <option value="Done">Done</option>
                          <option value="Not done">Not done</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5 font-sans">Glucose (mg/dL)</label>
                        <input
                          type="number"
                          step="1"
                          name="glucose_mg_dl"
                          placeholder="mg/dL"
                          value={formData.glucose_mg_dl !== null && formData.glucose_mg_dl !== undefined ? formData.glucose_mg_dl : ''}
                          onChange={handleChange}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs font-mono bg-white focus:outline-hidden focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Row */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 font-semibold font-sans hover:bg-slate-100 rounded-lg transition-all"
              >
                Discard Changes
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 font-sans"
              >
                <Save className="w-4 h-4" /> Save & Update Audit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
