import React, { useRef, useState } from 'react';
import { UploadCloud, Image as ImageIcon, X, AlertTriangle } from 'lucide-react';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing: boolean;
}

export default function UploadZone({ onFilesSelected, isProcessing }: UploadZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files: File[] = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        if (file.type.startsWith('image/')) {
          files.push(file);
        }
      }
      if (files.length > 0) {
        onFilesSelected(files);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const files: File[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        if (file.type.startsWith('image/')) {
          files.push(file);
        }
      }
      if (files.length > 0) {
        onFilesSelected(files);
      }
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div id="upload-container" className="w-full">
      <div
        id="drag-drop-zone"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`w-full min-h-[220px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-8 text-center transition-all duration-200 cursor-pointer ${
          isDragActive
            ? 'border-indigo-500 bg-indigo-50/40 scale-[0.99]'
            : 'border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-white'
        }`}
        onClick={onButtonClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*"
          onChange={handleChange}
          disabled={isProcessing}
        />

        <div className="bg-white p-4 rounded-full shadow-xs border border-slate-150 text-slate-500 mb-4 transition-transform duration-200 hover:scale-105">
          <UploadCloud className="w-8 h-8 text-indigo-600" />
        </div>

        <h3 className="font-sans text-base font-bold text-slate-800 mb-1">
          Upload medical checkup sheets
        </h3>
        <p className="font-sans text-sm text-slate-500 max-w-md mb-4">
          Drag and drop handwritten intake form photos, or <span className="text-indigo-600 font-semibold hover:text-indigo-700 hover:underline">browse your computer</span>.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400 font-medium">
          <span className="flex items-center gap-1">
            <ImageIcon className="w-3.5 h-3.5" /> PNG, JPG, JPEG
          </span>
          <span>•</span>
          <span>Supports batch uploading</span>
        </div>
      </div>
    </div>
  );
}
