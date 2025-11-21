import React, { useState } from 'react';
import { X, User, Calendar, MapPin, Sparkles, Users, Heart, GitBranch, Route } from 'lucide-react';
import { Person, GedcomData } from '../types';
import { generateBiography } from '../services/geminiService';
import { getSiblings } from '../utils/gedcom';

interface RelativeItemProps {
  p: Person;
  label?: string;
  onSelect: (id: string) => void;
}

const RelativeItem: React.FC<RelativeItemProps> = ({ p, label, onSelect }) => (
  <div 
    onClick={() => onSelect(p.id)}
    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-gray-100"
  >
      <img 
        src={p.imageUrl || `https://picsum.photos/seed/${p.id}/100/100`} 
        alt={p.name} 
        className="w-10 h-10 rounded-full object-cover bg-gray-200" 
      />
      <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
              {p.name} {p.surname}
          </p>
          <p className="text-xs text-gray-500 truncate">
              {p.birth?.date?.split(' ').pop() || '?'} — {label}
          </p>
      </div>
  </div>
);

interface PersonSidebarProps {
  person: Person | null;
  rootId: string;
  onClose: () => void;
  onSelectRelative: (id: string) => void;
  onTracePath: (targetId: string) => void;
  data: GedcomData; // Pass full data to calculate relationships
}

export const PersonSidebar: React.FC<PersonSidebarProps> = ({ person, rootId, onClose, onSelectRelative, onTracePath, data }) => {
  const [bio, setBio] = useState<string | null>(null);
  const [loadingBio, setLoadingBio] = useState(false);

  // Reset bio when person changes
  React.useEffect(() => {
    setBio(null);
    setLoadingBio(false);
  }, [person?.id]);

  if (!person) return null;

  const handleGenerateBio = async () => {
    setLoadingBio(true);
    const text = await generateBiography(person);
    setBio(text);
    setLoadingBio(false);
  };

  // Placeholder image
  const imgSrc = person.imageUrl || `https://picsum.photos/seed/${person.id}/400/400`;

  // Format dates
  const birthYear = person.birth?.date ? person.birth.date.split(' ').pop() : '?';
  const deathYear = person.death?.date ? person.death.date.split(' ').pop() : (person.death ? '?' : 'Presente');

  // Relationships Logic
  const siblings = getSiblings(person.id, data);
  
  const spouses: Person[] = [];
  const children: Person[] = [];

  if (person.fams) {
    person.fams.forEach(famId => {
        const fam = data.families[famId];
        if (fam) {
            // Find spouse
            const spouseId = person.sex === 'M' ? fam.wife : fam.husb;
            if (spouseId && data.people[spouseId]) {
                spouses.push(data.people[spouseId]);
            }
            // Find children
            if (fam.children) {
                fam.children.forEach(childId => {
                    if (data.people[childId]) children.push(data.people[childId]);
                });
            }
        }
    });
  }

  const isRoot = person.id === rootId;

  return (
    <div className="absolute top-0 right-0 h-full w-96 bg-white shadow-2xl z-30 overflow-y-auto border-l border-gray-200 transform transition-transform duration-300 ease-in-out flex flex-col">
      
      {/* Header Image */}
      <div className="relative h-64 shrink-0">
        <img src={imgSrc} alt={person.name} className="w-full h-full object-cover" />
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 transition-colors"
        >
          <X size={24} />
        </button>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 pt-20">
          <h2 className="text-2xl font-bold text-white leading-tight">
            {person.name} <span className="text-blue-300">{person.surname}</span>
          </h2>
          <p className="text-white/80 text-sm mt-1 font-medium">
            {birthYear} — {deathYear}
          </p>
        </div>
      </div>

      <div className="p-6 space-y-6 overflow-y-auto flex-1">
        {/* Vital Info */}
        <div className="space-y-4">
          <div className="flex items-start gap-3 text-gray-700">
            <Calendar className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-xs uppercase text-gray-500 font-semibold">Nascimento</p>
              <p className="font-medium">{person.birth?.date || 'Data desconhecida'}</p>
              {person.birth?.place && <p className="text-sm text-gray-500">{person.birth.place}</p>}
            </div>
          </div>

          <div className="flex items-start gap-3 text-gray-700">
            <div className="w-5 flex justify-center text-gray-400 font-serif italic font-bold">†</div>
             <div>
              <p className="text-xs uppercase text-gray-500 font-semibold">Falecimento</p>
              <p className="font-medium">{person.death?.date || 'Vivo'}</p>
              {person.death?.place && <p className="text-sm text-gray-500">{person.death.place}</p>}
            </div>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Family Relations */}
        <div className="space-y-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Users size={18} className="text-gray-500"/>
                Família Imediata
            </h3>
            
            {spouses.length > 0 && (
                <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-1 ml-1">Cônjuge(s)</p>
                    <div className="space-y-1">
                        {spouses.map(s => <RelativeItem key={s.id} p={s} label="Esposo(a)" onSelect={onSelectRelative} />)}
                    </div>
                </div>
            )}

            {children.length > 0 && (
                <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-1 ml-1">Filhos</p>
                    <div className="space-y-1">
                        {children.map(c => <RelativeItem key={c.id} p={c} label="Filho(a)" onSelect={onSelectRelative} />)}
                    </div>
                </div>
            )}

            {siblings.length > 0 && (
                <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-1 ml-1">Irmãos</p>
                    <div className="space-y-1">
                        {siblings.map(s => <RelativeItem key={s.id} p={s} label="Irmão/ã" onSelect={onSelectRelative} />)}
                    </div>
                </div>
            )}

            {spouses.length === 0 && children.length === 0 && siblings.length === 0 && (
                <p className="text-sm text-gray-500 italic ml-1">Nenhum parente próximo listado.</p>
            )}
        </div>

        <hr className="border-gray-100" />

        {/* AI Biography Section */}
        <div>
           <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Sparkles size={18} className="text-purple-500"/>
                Biografia
              </h3>
              <button 
                onClick={handleGenerateBio}
                disabled={loadingBio}
                className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-md hover:bg-purple-200 transition-colors disabled:opacity-50"
              >
                {loadingBio ? 'Gerando...' : 'Gerar com IA'}
              </button>
           </div>
           <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600 leading-relaxed border border-gray-100">
              {bio ? bio : (
                  person.notes ? person.notes : "Nenhuma nota disponível. Use a IA para gerar uma história baseada nos dados."
              )}
           </div>
        </div>

        <div className="pb-6 space-y-3">
            <button 
                onClick={() => onSelectRelative(person.id)}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-md"
            >
                <GitBranch size={18} />
                Focar Árvore nesta Pessoa
            </button>
            
            {!isRoot && (
                <button 
                    onClick={() => onTracePath(person.id)}
                    className="w-full flex items-center justify-center gap-2 bg-orange-100 text-orange-700 py-3 rounded-lg hover:bg-orange-200 transition-colors text-sm font-medium border border-orange-200"
                >
                    <Route size={18} />
                    Traçar Caminho até Principal
                </button>
            )}
        </div>
      </div>
    </div>
  );
};