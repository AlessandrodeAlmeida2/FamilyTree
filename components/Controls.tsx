import React from 'react';
import { ZoomIn, ZoomOut, Maximize, RefreshCcw, Upload, Home } from 'lucide-react';

interface ControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onHome: () => void;
  generations: number;
  setGenerations: (n: number) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Controls: React.FC<ControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onReset,
  onHome,
  generations,
  setGenerations,
  onUpload
}) => {
  return (
    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-gray-200 flex items-center gap-6 z-20">
      
      <div className="flex flex-col items-start">
        <label className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Gerações</label>
        <select 
          value={generations} 
          onChange={(e) => setGenerations(Number(e.target.value))}
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2 outline-none"
        >
          <option value={2}>2 Gerações</option>
          <option value={3}>3 Gerações</option>
          <option value={4}>4 Gerações</option>
          <option value={5}>5 Gerações</option>
          <option value={6}>6 Gerações</option>
        </select>
      </div>

      <div className="h-8 w-px bg-gray-300 mx-2"></div>

      <div className="flex items-center gap-2">
        <button onClick={onHome} className="p-2 hover:bg-gray-100 rounded-full text-blue-600 transition-colors" title="Voltar para Início">
          <Home size={20} />
        </button>
        <div className="h-4 w-px bg-gray-300"></div>
        <button onClick={onZoomOut} className="p-2 hover:bg-gray-100 rounded-full text-gray-700 transition-colors" title="Diminuir Zoom">
          <ZoomOut size={20} />
        </button>
        <button onClick={onReset} className="p-2 hover:bg-gray-100 rounded-full text-gray-700 transition-colors" title="Centralizar">
          <Maximize size={20} />
        </button>
        <button onClick={onZoomIn} className="p-2 hover:bg-gray-100 rounded-full text-gray-700 transition-colors" title="Aumentar Zoom">
          <ZoomIn size={20} />
        </button>
      </div>

      <div className="h-8 w-px bg-gray-300 mx-2"></div>

      <div className="relative">
         <input 
            type="file" 
            id="gedcom-upload" 
            accept=".ged" 
            className="hidden" 
            onChange={onUpload}
         />
         <label 
            htmlFor="gedcom-upload" 
            className="flex items-center gap-2 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
         >
            <Upload size={16} />
            <span>Carregar GEDCOM</span>
         </label>
      </div>
    </div>
  );
};
