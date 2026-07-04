import React, { useState } from 'react';
import { MedicalRecord, ValidationFlag } from '../types';
import { AlertTriangle, Eye, Edit2, Trash2, CheckCircle, Search, Filter, AlertCircle } from 'lucide-react';

interface FormDataTableProps {
  records: MedicalRecord[];
  onViewDetails: (record: MedicalRecord) => void;
  onDeleteRecord: (id: string) => void;
}

export default function FormDataTable({ records, onViewDetails, onDeleteRecord }: FormDataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'flagged' | 'clean'>('all');

  // Search and filter logic
  const filteredRecords = records.filter(record => {
    const matchesSearch = record.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          record.comunidad.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          record.diagnostico.toLowerCase().includes(searchTerm.toLowerCase());
    
    const hasRedFlags = record.validation_flags.some(f => f.severity === 'red');
    
    if (filterType === 'flagged') {
      return matchesSearch && hasRedFlags;
    }
    if (filterType === 'clean') {
      return matchesSearch && !hasRedFlags;
    }
    return matchesSearch;
  });

  // Helper to determine if a cell is flagged
  const getCellFlag = (record: MedicalRecord, field: string): ValidationFlag | undefined => {
    return record.validation_flags.find(f => f.field === field);
  };

  // Helper to get styling for a cell based on flags
  const getCellClassName = (record: MedicalRecord, field: string) => {
    const flag = getCellFlag(record, field);
    if (!flag) return 'px-4 py-3 text-sm text-slate-700 font-medium font-sans';
    if (flag.severity === 'red') {
      return 'px-4 py-3 text-sm font-semibold font-sans bg-rose-50 text-rose-700 border-x border-rose-200/60 animate-pulse';
    }
    return 'px-4 py-3 text-sm font-medium font-sans bg-amber-50 text-amber-700 border-x border-amber-200/60';
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Search and Filters bar */}
      <div className="p-4 border-b border-slate-250 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, community, dx..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 font-sans transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 font-sans">
            <Filter className="w-3.5 h-3.5" /> Filter Grid
          </span>
          <div className="flex gap-1 bg-slate-200/50 p-1 rounded-lg">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all font-sans ${
                filterType === 'all'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All ({records.length})
            </button>
            <button
              onClick={() => setFilterType('flagged')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 font-sans ${
                filterType === 'flagged'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-slate-500 hover:text-rose-600'
              }`}
            >
              Outliers ({records.filter(r => r.validation_flags.some(f => f.severity === 'red')).length})
            </button>
            <button
              onClick={() => setFilterType('clean')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all font-sans ${
                filterType === 'clean'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-indigo-600'
              }`}
            >
              Clean ({records.filter(r => !r.validation_flags.some(f => f.severity === 'red')).length})
            </button>
          </div>
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="bg-slate-100 p-3 rounded-full inline-block text-slate-400 mb-3">
            <Search className="w-6 h-6" />
          </div>
          <p className="text-slate-800 font-semibold mb-1 font-sans">No records found</p>
          <p className="text-slate-400 text-sm font-sans">Try altering your filters or search term.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-sans">Status</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-sans">Patient Name</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-sans">DOB</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-sans">Age (Mo/Yr)</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-sans">Sex</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-sans">Community</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-sans">Height</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-sans">Weight</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-sans">Temp</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-sans">MUAC</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-sans">Diagnosis</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-sans text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((record) => {
                const hasRedFlags = record.validation_flags.some(f => f.severity === 'red');
                const hasYellowFlags = record.validation_flags.some(f => f.severity === 'yellow');
                
                return (
                  <tr
                    key={record.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      record.status === 'processing' ? 'opacity-60 bg-slate-50/30' : ''
                    }`}
                  >
                    {/* Status column */}
                    <td className="px-4 py-3">
                      {record.status === 'processing' && (
                        <div className="flex items-center gap-1.5 text-indigo-600 font-bold text-[10px] font-sans uppercase tracking-wider">
                          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
                          Parsing...
                        </div>
                      )}
                      {record.status === 'success' && !hasRedFlags && !hasYellowFlags && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wider">
                          <CheckCircle className="w-3 h-3 text-indigo-600" /> Clean
                        </span>
                      )}
                      {record.status === 'success' && hasRedFlags && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100 animate-pulse uppercase tracking-wider">
                          <AlertTriangle className="w-3 h-3 text-rose-600" /> Outliers
                        </span>
                      )}
                      {record.status === 'success' && !hasRedFlags && hasYellowFlags && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 uppercase tracking-wider">
                          <AlertCircle className="w-3 h-3 text-amber-600" /> Missing
                        </span>
                      )}
                      {record.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-red-700 border border-red-100 uppercase tracking-wider">
                          Failed
                        </span>
                      )}
                    </td>

                    {/* Patient Name */}
                    <td className="px-4 py-3 font-semibold text-slate-850 text-sm font-sans">
                      {record.nombre || <span className="text-rose-500 font-bold italic">Missing</span>}
                    </td>

                    {/* DOB */}
                    <td className={getCellClassName(record, 'dob')}>
                      {record.dob || <span className="italic opacity-60">N/A</span>}
                    </td>

                    {/* Age in Months and Years */}
                    <td className="px-4 py-3 text-xs text-slate-600 font-mono">
                      {record.calculated_age_months !== null && record.calculated_age_years !== null ? (
                        <span>
                          {record.calculated_age_months.toFixed(0)}m / {record.calculated_age_years.toFixed(1)}y
                        </span>
                      ) : (
                        <span className="italic opacity-60">N/A</span>
                      )}
                    </td>

                    {/* Sex */}
                    <td className="px-4 py-3 text-xs text-slate-600 font-sans">
                      {record.sexo || <span className="italic opacity-60">N/A</span>}
                    </td>

                    {/* Community */}
                    <td className="px-4 py-3 text-xs text-slate-600 font-sans truncate max-w-[120px]">
                      {record.comunidad || <span className="italic opacity-60">N/A</span>}
                    </td>

                    {/* Height */}
                    <td className={getCellClassName(record, 'altura_cm')}>
                      {record.altura_cm !== null ? (
                        <div className="flex flex-col">
                          <span>{record.altura_cm} cm</span>
                          {record.percentile_height_for_age && record.percentile_height_for_age !== 'N/A' && (
                            <span className="text-[9px] text-indigo-600 font-bold font-mono bg-indigo-50 px-1 rounded h-fit w-fit mt-0.5">
                              HFA: {record.percentile_height_for_age}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="italic text-rose-500 font-bold">Missing</span>
                      )}
                    </td>

                    {/* Weight */}
                    <td className={getCellClassName(record, 'peso_kg')}>
                      {record.peso_kg !== null ? (
                        <div className="flex flex-col">
                          <span>{record.peso_kg} kg</span>
                          {record.percentile_weight_for_age && record.percentile_weight_for_age !== 'N/A' && (
                            <span className="text-[9px] text-indigo-600 font-bold font-mono bg-indigo-50 px-1 rounded h-fit w-fit mt-0.5">
                              WFA: {record.percentile_weight_for_age}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="italic text-rose-500 font-bold">Missing</span>
                      )}
                    </td>

                    {/* Temp */}
                    <td className={getCellClassName(record, 'temperatura_c')}>
                      {record.temperatura_c !== null ? (
                        <span>{record.temperatura_c} °C</span>
                      ) : (
                        <span className="italic text-slate-400">N/A</span>
                      )}
                    </td>

                    {/* MUAC */}
                    <td className={getCellClassName(record, 'muac_cm')}>
                      {record.muac_cm !== null ? (
                        <div className="flex flex-col">
                          <span>{record.muac_cm} cm</span>
                          {record.percentile_muac_for_age && record.percentile_muac_for_age !== 'N/A' && (
                            <span className="text-[9px] text-indigo-600 font-bold font-mono bg-indigo-50 px-1 rounded h-fit w-fit mt-0.5">
                              MFA: {record.percentile_muac_for_age}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="italic text-slate-400">N/A</span>
                      )}
                    </td>

                    {/* Diagnosis */}
                    <td className="px-4 py-3 text-xs text-slate-600 font-sans truncate max-w-[150px]" title={record.diagnostico}>
                      {record.diagnostico || <span className="italic opacity-60">N/A</span>}
                    </td>

                    {/* Action buttons */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onViewDetails(record)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="View / Edit clinical record details"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteRecord(record.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Remove record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
