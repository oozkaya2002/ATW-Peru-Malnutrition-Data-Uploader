import React, { useState, useEffect } from 'react';
import { MedicalRecord, ValidationFlag } from './types';
import UploadZone from './components/UploadZone';
import FormDataTable from './components/FormDataTable';
import FormDetailModal from './components/FormDetailModal';
import { calculateGrowthMetrics } from './lib/growthCalculations';
import { 
  FileText, 
  AlertTriangle, 
  Activity, 
  CheckCircle, 
  Download, 
  Sparkles, 
  Loader2, 
  AlertCircle
} from 'lucide-react';

export default function App() {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);

  // Convert a local File object to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64Str = (reader.result as string).split(',')[1];
        resolve(base64Str);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle uploading and parsing files
  const handleFilesSelected = async (files: File[]) => {
    setIsProcessing(true);
    setAppError(null);

    const pendingRecords: MedicalRecord[] = [];

    // Pre-insert pending placeholders for visual streaming feedback
    for (const file of files) {
      const id = 'rec-' + Math.random().toString(36).substr(2, 9);
      const recordPlaceholder: MedicalRecord = {
        id,
        imageName: file.name,
        imageSrc: URL.createObjectURL(file), // temp preview url
        status: 'processing',
        nombre: 'Analyzing handwritten sheet...',
        dob: '',
        sexo: 'N/A',
        comunidad: '',
        escuela: 'No',
        ultima_visita: '',
        alergias: '',
        medicamentos_actuales: '',
        historial_medico: '',
        altura_cm: null,
        peso_kg: null,
        presion_arterial: '',
        temperatura_c: null,
        muac_cm: null,
        albendazole: 'No',
        nombre_doctor: '',
        diagnostico: '',
        medicamentos_recetados: '',
        notas: '',
        dengue_test: 'No',
        dengue_result: '',
        malaria_test: 'No',
        malaria_result: '',
        urinalysis_test: 'No',
        urinalysis_result: '',
        glucose_test: 'No',
        glucose_mg_dl: null,
        calculated_age_months: null,
        calculated_age_years: null,
        percentile_weight_for_age: 'N/A',
        percentile_height_for_age: 'N/A',
        percentile_muac_for_age: 'N/A',
        percentile_explanations: '',
        validation_flags: []
      };
      pendingRecords.push(recordPlaceholder);
    }

    setRecords(prev => [...prev, ...pendingRecords]);

    // Process each file sequentially to avoid overloading rate limits
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const placeholder = pendingRecords[i];

      try {
        const base64Image = await fileToBase64(file);
        
        const response = await fetch('/api/parse-form', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64Image,
            mimeType: file.type
          })
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.isApiKeyMissing) {
            setIsApiKeyMissing(true);
          }
          throw new Error(data.error || 'Server error during extraction');
        }

        // Update the state with the extracted data
        setRecords(prev => prev.map(rec => {
          if (rec.id === placeholder.id) {
            return {
              ...rec,
              ...data,
              status: 'success',
              imageSrc: placeholder.imageSrc // retain local object URL for preview
            };
          }
          return rec;
        }));

      } catch (err: any) {
        console.error('Error parsing file:', err);
        setRecords(prev => prev.map(rec => {
          if (rec.id === placeholder.id) {
            return {
              ...rec,
              status: 'failed',
              nombre: 'Failed to extract',
              errorMsg: err.message || 'Error occurred'
            };
          }
          return rec;
        }));
        setAppError(`Failed to parse ${file.name}: ${err.message}`);
      }
    }

    setIsProcessing(false);
  };

  // Recalculate percentiles for a record if the DOB, height, or weight were corrected by the auditor
  const handleRecalculatePercentiles = async (currentData: MedicalRecord) => {
    setIsRecalculating(true);
    try {
      // Calculate growth metrics using the exact same robust Z-score calculation module
      const metrics = calculateGrowthMetrics(
        currentData.dob,
        currentData.ultima_visita || "",
        currentData.sexo,
        currentData.altura_cm,
        currentData.peso_kg,
        currentData.muac_cm
      );

      // Update current data state with exact recalculated values
      setRecords(prev => prev.map(rec => {
        if (rec.id === currentData.id) {
          return {
            ...currentData,
            calculated_age_months: metrics.calculated_age_months,
            calculated_age_years: metrics.calculated_age_years,
            percentile_weight_for_age: metrics.percentile_weight_for_age,
            percentile_height_for_age: metrics.percentile_height_for_age,
            percentile_muac_for_age: metrics.percentile_muac_for_age,
            percentile_explanations: metrics.percentile_explanations
          };
        }
        return rec;
      }));

      // Update local modal data too
      setSelectedRecord(prev => prev ? {
        ...prev,
        calculated_age_months: metrics.calculated_age_months,
        calculated_age_years: metrics.calculated_age_years,
        percentile_weight_for_age: metrics.percentile_weight_for_age,
        percentile_height_for_age: metrics.percentile_height_for_age,
        percentile_muac_for_age: metrics.percentile_muac_for_age,
        percentile_explanations: metrics.percentile_explanations
      } : null);

      // Delay slightly for high quality UI feel
      await new Promise(resolve => setTimeout(resolve, 600));
    } catch (err) {
      console.error(err);
    } finally {
      setIsRecalculating(false);
    }
  };

  // Save changes from details modal
  const handleSaveRecord = (updatedRecord: MedicalRecord) => {
    setRecords(prev => prev.map(rec => rec.id === updatedRecord.id ? updatedRecord : rec));
    setSelectedRecord(null);
  };

  // Delete an item
  const handleDeleteRecord = (id: string) => {
    setRecords(prev => prev.filter(rec => rec.id !== id));
    if (selectedRecord?.id === id) {
      setSelectedRecord(null);
    }
  };

  // Export clean CSV matches the template
  const handleExportCSV = () => {
    const successRecords = records.filter(r => r.status === 'success');
    if (successRecords.length === 0) return;

    // Define columns based on the exact campaign sheet template fields requested
    const headers = [
      'Name',
      'DOB (DD/MM/YYYY)',
      'Red Flag?',
      'Gender',
      'Community',
      'School',
      'Last Doctor Visit',
      'Allergies',
      'Current Medications',
      'Medical History (Hx)',
      'Dengue test',
      'Dengue result',
      'Malaria test',
      'Malaria result',
      'Urinalysis test',
      'Urinalysis result',
      'Glucose test',
      'Glucose mg/dL',
      'Height cm',
      'Height (%)',
      'Weight kg',
      'Weight (%)',
      'Blood Pressure (e.g. 120/80)',
      'Temperature °C',
      'MUAC cm',
      'MUAC (%)',
      'Albendazole given?',
      'Name of Dr.',
      'Diagnosis',
      'Rx Prescribed',
      'Notes',
      'Image Name'
    ];

    const cleanForCsvCell = (val: any): string => {
      if (val === null || val === undefined) return '';
      let str = String(val).trim();
      
      // Clean multiple lines of leading dashes/plus/equals/bullets
      const lines = str.split('\n');
      const cleanedLines = lines.map(line => {
        let cleaned = line.trim();
        while (
          cleaned.startsWith('-') || 
          cleaned.startsWith('+') || 
          cleaned.startsWith('=') || 
          cleaned.startsWith('@') || 
          cleaned.startsWith('*') || 
          cleaned.startsWith('•') ||
          cleaned.startsWith('–')
        ) {
          cleaned = cleaned.substring(1).trim();
        }
        return cleaned;
      }).filter(line => line.length > 0);
      
      str = cleanedLines.join('; ');
      
      // Secondary safeguard for Excel formula injection
      while (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
        str = str.substring(1).trim();
      }
      
      return str;
    };

    const cleanPercentileForCsv = (val: string): string => {
      if (!val || val === 'N/A') return '';
      // Strip percentage sign or English suffix (th, rd, nd, st) to export pure numerical values (or empty if none)
      let cleaned = val.replace(/th|rd|nd|st|%| percentile/gi, '').trim();
      return cleaned;
    };

    const rows = successRecords.map(rec => {
      // Escape CSV values containing commas or quotes
      const escape = (val: any) => {
        const str = cleanForCsvCell(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const genderCode = rec.sexo?.toLowerCase().startsWith('m') ? 'M' : rec.sexo?.toLowerCase().startsWith('f') ? 'F' : rec.sexo;
      const schoolCode = rec.escuela?.toLowerCase().startsWith('s') || rec.escuela?.toLowerCase().startsWith('y') ? 'Y' : rec.escuela?.toLowerCase().startsWith('n') ? 'N' : '';
      const albendazoleCode = rec.albendazole?.toLowerCase().startsWith('s') || rec.albendazole?.toLowerCase().startsWith('y') ? 'Y' : rec.albendazole?.toLowerCase().startsWith('n') ? 'N' : '';
      const redFlag = rec.validation_flags.some(f => f.severity === 'red') ? 'Y' : 'N';

      return [
        escape(rec.nombre),
        escape(rec.dob),
        escape(redFlag),
        escape(genderCode),
        escape(rec.comunidad),
        escape(schoolCode),
        escape(rec.ultima_visita),
        escape(rec.alergias),
        escape(rec.medicamentos_actuales),
        escape(rec.historial_medico),
        escape(rec.dengue_test || 'No'),
        escape(rec.dengue_result || ''),
        escape(rec.malaria_test || 'No'),
        escape(rec.malaria_result || ''),
        escape(rec.urinalysis_test || 'No'),
        escape(rec.urinalysis_result || ''),
        escape(rec.glucose_test || 'No'),
        escape(rec.glucose_mg_dl !== null && rec.glucose_mg_dl !== undefined ? rec.glucose_mg_dl : ''),
        escape(rec.altura_cm),
        escape(cleanPercentileForCsv(rec.percentile_height_for_age)),
        escape(rec.peso_kg),
        escape(cleanPercentileForCsv(rec.percentile_weight_for_age)),
        escape(rec.presion_arterial),
        escape(rec.temperatura_c),
        escape(rec.muac_cm),
        escape(cleanPercentileForCsv(rec.percentile_muac_for_age)),
        escape(albendazoleCode),
        escape(rec.nombre_doctor),
        escape(rec.diagnostico),
        escape(rec.medicamentos_recetados),
        escape(rec.notas),
        escape(rec.imageName)
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n'); // Add UTF-8 BOM
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Pediatric_Campaign_Data_Export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Summary Metrics calculations
  const parsedRecords = records.filter(r => r.status === 'success');
  const totalParsed = parsedRecords.length;
  const totalOutliers = parsedRecords.filter(r => r.validation_flags.some(f => f.severity === 'red')).length;
  const totalWarnings = parsedRecords.filter(r => r.validation_flags.some(f => f.severity === 'yellow')).length;
  const cleanRecords = parsedRecords.filter(r => r.validation_flags.length === 0).length;
  const cleanRate = totalParsed > 0 ? Math.round((cleanRecords / totalParsed) * 100) : 100;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-indigo-500/20 text-slate-900">
      {/* Top Professional Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm shadow-indigo-600/10">
              P
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none">
                Peru Malnutrition Project Data Uploader
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5 uppercase tracking-wider">
                Clinical Data Extraction & Growth Percentile Pipeline
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {totalParsed > 0 && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-md">
                <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
                <span className="text-xs font-semibold text-rose-700">
                  {totalOutliers} Red Flags Detected
                </span>
              </div>
            )}
            
            {totalParsed > 0 && (
              <button
                onClick={handleExportCSV}
                className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg shadow-sm shadow-indigo-600/10 transition-all flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV ({totalParsed})
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* API Key Missing Banner Warning */}
        {isApiKeyMissing && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex gap-3 animate-pulse">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-sm text-rose-800 font-semibold font-sans">Gemini API Key Missing</strong>
              <p className="text-xs text-rose-700 font-medium mt-0.5">
                The Gemini AI API Key has not been configured in your secrets. Please configure <strong>GEMINI_API_KEY</strong> in the Secrets panel in the AI Studio UI settings to allow clinical form extraction.
              </p>
            </div>
          </div>
        )}

        {/* Global Errors Banner */}
        {appError && !isApiKeyMissing && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-sm text-amber-800 font-semibold font-sans">Extraction Warning</strong>
              <p className="text-xs text-amber-700 font-medium mt-0.5">{appError}</p>
            </div>
          </div>
        )}

        {/* Summary Statistics Dashboard (Visible after records loaded) */}
        {totalParsed > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Processed Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Parsed Sheets</span>
                <strong className="text-2xl text-slate-800 font-mono">{totalParsed}</strong>
              </div>
            </div>

            {/* Outliers High-Alert Card */}
            <div className={`p-5 rounded-2xl border shadow-xs flex items-center gap-4 transition-all ${
              totalOutliers > 0 
                ? 'bg-rose-50/60 border-rose-200 text-rose-800' 
                : 'bg-white border-slate-200'
            }`}>
              <div className={`p-3 rounded-xl ${totalOutliers > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Red Flag Outliers</span>
                <strong className={`text-2xl font-mono ${totalOutliers > 0 ? 'text-rose-700' : 'text-slate-800'}`}>{totalOutliers}</strong>
              </div>
            </div>

            {/* Warnings/Missing Fields Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Warnings/Missing</span>
                <strong className="text-2xl text-slate-800 font-mono">{totalWarnings}</strong>
              </div>
            </div>

            {/* Data Cleanliness Rate Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-indigo-50/80 text-indigo-700 rounded-xl">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Clean Data Rate</span>
                <strong className="text-2xl text-slate-800 font-mono">{cleanRate}%</strong>
              </div>
            </div>
          </div>
        )}

        {/* Top Interactive UploadZone Workspace */}
        <div className="w-full">
          <UploadZone onFilesSelected={handleFilesSelected} isProcessing={isProcessing} />
        </div>

        {/* Scannings Spreadsheet Workspace */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">
              Clinical Campaign Intake Data ({records.length} Sheets)
            </h2>
          </div>

          {records.length > 0 ? (
            <FormDataTable
              records={records}
              onViewDetails={(rec) => setSelectedRecord(rec)}
              onDeleteRecord={handleDeleteRecord}
            />
          ) : (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <div className="bg-slate-50 p-4 rounded-full inline-block text-slate-400 mb-3 border border-slate-100">
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-slate-800 font-bold text-base mb-1 font-sans">No documents processed yet</h3>
              <p className="text-slate-400 text-sm max-w-sm mx-auto font-sans">
                Please upload clinical checkup forms using the drag-and-drop area above to begin parsing and auditing.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Side-by-Side Auditor Workspace Modal */}
      {selectedRecord && (
        <FormDetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onSave={handleSaveRecord}
          onRecalculatePercentiles={handleRecalculatePercentiles}
          isRecalculating={isRecalculating}
        />
      )}

      {/* Clean Footer Status Bar */}
      <footer className="mt-auto bg-slate-900 text-slate-300 h-10 px-6 flex items-center text-[10px] font-bold uppercase tracking-wider font-sans border-t border-slate-800">
        <div className="flex gap-6">
          <span className="hidden sm:inline">SOURCE: WHO Anthro / CDC 2000 Growth Reference</span>
          <span className="hidden md:inline">Campaign: Peru Malnutrition Project</span>
        </div>
      </footer>
    </div>
  );
}
