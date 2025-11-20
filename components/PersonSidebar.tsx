import React, { useState } from 'react';
import { X, User, Calendar, MapPin, Sparkles, Users } from 'lucide-react';
import { Person } from '../types';
import { generateBiography } from '../services/geminiService';
import { getSiblings } from '../utils/gedcom';

interface PersonSidebarProps {
  person: Person | null;
  onClose: () => void;
  onSelectRelative: (id: string) => void;
  allPeople: Record<string, Person>; // To resolve names of relatives
}

export const PersonSidebar: React.FC<PersonSidebarProps> = ({ person, onClose, onSelectRelative, allPeople }) => {
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

  // Get Siblings mock context (needs data structure support, but we can assume we have logic if passed or access globally)
  // For now, we need to reconstruct siblings from parent families if not passed directly.
  // Since we have `allPeople` and `person.famc`, we can find siblings locally:
  let siblings: Person[] = [];
  
  // Note: Previous logic trying to access .children on allPeople[person.famc] was incorrect type usage.
  // allPeople values are Person objects, which do not have children. famc points to a Family object.
  // Without passing 'families' data to this component, we cannot reliably compute siblings here.

  return (
    <div className="absolute top-0 right-0 h-full w-96 bg-white shadow-2xl z-30 overflow-y-auto border-l border-gray-200 transform transition-transform duration-300 ease-in-out">
      <div className="relative h-64">
        <img src={imgSrc} alt={person.name} className="w-full h-full object-cover" />
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 transition-colors"
        >
          <X size={24} />
        </button>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 pt-20">
          <h2 className="text-3xl font-bold text-white leading-tight">
            {person.name} <span className="text-blue-300">{person.surname}</span>
          </h2>
          <p className="text-white/80 text-sm mt-1 font-medium">
            {birthYear} — {deathYear}
          </p>
        </div>
      </div>

      <div className="p-6 space-y-6">
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

        {/* AI Biography Section */}
        <div>
           <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-800">Biografia</h3>
              <button 
                onClick={handleGenerateBio}
                disabled={loadingBio}
                className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-md hover:bg-purple-200 transition-colors disabled:opacity-50"
              >
                <Sparkles size={12} />
                {loadingBio ? 'Gerando...' : 'Gerar com IA'}
              </button>
           </div>
           <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600 leading-relaxed border border-gray-100">
              {bio ? bio : (
                  person.notes ? person.notes : "Nenhuma nota disponível. Use a IA para gerar uma história baseada nos dados."
              )}
           </div>
        </div>

        <hr className="border-gray-100" />

        {/* Actions */}
        <div>
            <h3 className="font-bold text-gray-800 mb-3">Navegação</h3>
            <button 
                onClick={() => onSelectRelative(person.id)}
                className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-700 py-2 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
            >
                <Users size={16} />
                Ver Árvore Completa Desta Pessoa
            </button>
        </div>
      </div>
    </div>
  );
};