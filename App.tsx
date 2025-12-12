import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { TreeVisualization, TreeHandle } from './components/TreeVisualization';
import { PersonSidebar } from './components/PersonSidebar';
import { Controls } from './components/Controls';
import { parseGedcom, MOCK_GEDCOM_FILE, findFirstPersonId, findShortestPath, getPathPeak } from './utils/gedcom';
import { GedcomData, Person } from './types';
import { Search } from 'lucide-react';

const MAIN_PERSON_ID = '@I1@'; // ID fixo de Valter Alessandro

const App: React.FC = () => {
  const [gedcomData, setGedcomData] = useState<GedcomData | null>(null);
  const [rootPersonId, setRootPersonId] = useState<string | null>(null);
  const [originalRootId, setOriginalRootId] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [generations, setGenerations] = useState<number>(3);
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
  
  // Global Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Reference to the Tree Component to control zoom/pan
  const treeRef = useRef<TreeHandle>(null);

  // Load Initial Data (Mock)
  useEffect(() => {
    // Simulate loading the "Gedcom_nov2025.ged" file
    const data = parseGedcom(MOCK_GEDCOM_FILE);
    setGedcomData(data);
    
    // Force start with specific ID or first person
    const startId = data.people[MAIN_PERSON_ID] ? MAIN_PERSON_ID : findFirstPersonId(data);
    
    setRootPersonId(startId);
    setOriginalRootId(startId);
  }, []);

  // Filter logic for Global Search
  const searchResults = useMemo(() => {
    if (!gedcomData || !searchQuery) return [];
    const lower = searchQuery.toLowerCase();
    return (Object.values(gedcomData.people) as Person[])
        .filter(p => `${p.name} ${p.surname}`.toLowerCase().includes(lower))
        .slice(0, 8);
  }, [gedcomData, searchQuery]);

  // Handlers
  const handlePersonClick = useCallback((id: string) => {
    setSelectedPersonId(id);
  }, []);

  const handleSetRoot = (id: string) => {
    setRootPersonId(id);
    setHighlightedPath([]); // Limpa o caminho ao mudar o foco
    // Reset zoom to center on new tree
    setTimeout(() => treeRef.current?.reset(), 100);
  };

  const handleSearchSelect = (id: string) => {
    handleSetRoot(id);
    setSelectedPersonId(id);
    setSearchQuery(''); // Clear search after selection
  };
  
  const handleGoHome = () => {
    if (originalRootId) {
        handleSetRoot(originalRootId);
        setGenerations(3);
        setHighlightedPath([]);
        setSelectedPersonId(originalRootId);
    }
  };

  const handleTracePath = (targetId: string) => {
    if (!gedcomData || !selectedPersonId) return;

    // Calcula o caminho mais curto usando BFS
    const path = findShortestPath(gedcomData, selectedPersonId, targetId);
    
    if (path.length > 0) {
        setHighlightedPath(path);
        
        // Encontra o "Pico" do caminho (Ancestral Comum ou ponto mais alto da conexão)
        // Isso garante que tanto a origem quanto o destino sejam visíveis como descendentes/ancestrais do pico.
        const peakId = getPathPeak(gedcomData, path);
        
        if (peakId && peakId !== rootPersonId) {
             setRootPersonId(peakId);
        }

        // Aumenta as gerações para garantir que o caminho seja visível se for longo
        // Usa o tamanho do caminho como base, mínimo 6, máximo 12
        const requiredGens = Math.min(Math.max(path.length + 2, 6), 12);
        setGenerations(requiredGens);
        
        // Centraliza a visão
        setTimeout(() => treeRef.current?.reset(), 100);

    } else {
        alert("Não foi possível encontrar uma conexão entre estas pessoas.");
    }
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          const data = parseGedcom(text);
          setGedcomData(data);
          const newRoot = findFirstPersonId(data);
          setRootPersonId(newRoot);
          setOriginalRootId(newRoot);
          setHighlightedPath([]);
          setTimeout(() => treeRef.current?.reset(), 100);
        }
      };
      reader.readAsText(file);
    }
  };

  // Derived state for sidebar
  const selectedPerson = (gedcomData && selectedPersonId) ? gedcomData.people[selectedPersonId] : null;

  if (!gedcomData || !rootPersonId) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-blue-200 rounded-full mb-4"></div>
          <div className="text-gray-400 font-medium">Carregando Árvore...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen flex overflow-hidden bg-[#f3f4f6]">
      {/* Main Visualization Area */}
      <div className="flex-1 relative h-full">
        <TreeVisualization 
          ref={treeRef}
          data={gedcomData}
          rootId={rootPersonId}
          generations={generations}
          onSelectPerson={handlePersonClick}
          highlightedPath={highlightedPath}
        />

        {/* Top Header & Global Search */}
        <div className="absolute top-4 left-4 z-30 flex flex-col gap-3 w-80 max-w-[90vw]">
           {/* Title Card */}
           <div className="bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-sm border border-gray-200">
             <h1 className="text-lg font-bold text-gray-800">
                Minha Árvore
             </h1>
             <p className="text-xs text-gray-600">
                {highlightedPath.length > 0 
                  ? <span className="text-orange-600 font-bold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Modo Caminho Ativo</span>
                  : "Visualizador GEDCOM"}
             </p>
           </div>

           {/* Global Search Bar */}
           <div className="relative group">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
                  <Search size={18} className="text-gray-400" />
                  <input 
                      type="text" 
                      placeholder="Buscar pessoa na árvore..." 
                      className="w-full text-sm outline-none text-gray-900 placeholder-gray-500 bg-transparent"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                  />
              </div>

              {/* Search Results Dropdown */}
              {searchQuery && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white shadow-xl rounded-xl border border-gray-100 max-h-80 overflow-y-auto overflow-hidden">
                      {searchResults.length > 0 ? (
                        searchResults.map(p => (
                            <div 
                                key={p.id}
                                className="p-3 hover:bg-blue-50 cursor-pointer flex items-center gap-3 border-b border-gray-50 last:border-none transition-colors"
                                onClick={() => handleSearchSelect(p.id)}
                            >
                                <img 
                                  src={p.imageUrl || `https://picsum.photos/seed/${p.id}/50`} 
                                  className="w-9 h-9 rounded-full bg-gray-200 object-cover border border-gray-100"
                                  alt=""
                                />
                                <div className="flex flex-col min-w-0">
                                    <span className="font-semibold text-sm text-gray-800 truncate">{p.name} {p.surname}</span>
                                    <span className="text-xs text-gray-500 truncate">
                                        {p.birth?.date ? `Nasc: ${p.birth.date.split(' ').pop()}` : 'Data desconhecida'}
                                        {p.birth?.place ? ` • ${p.birth.place.split(',')[0]}` : ''}
                                    </span>
                                </div>
                            </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-gray-500">
                           Nenhuma pessoa encontrada.
                        </div>
                      )}
                  </div>
              )}
           </div>
        </div>

        {/* Floating Controls connected to Tree via Ref */}
        <Controls 
          generations={generations}
          setGenerations={setGenerations}
          onZoomIn={() => treeRef.current?.zoomIn()}
          onZoomOut={() => treeRef.current?.zoomOut()}
          onReset={() => treeRef.current?.reset()}
          onHome={handleGoHome}
          onUpload={handleUpload}
        />
      </div>

      {/* Right Sidebar for Person Details */}
      {selectedPerson && (
        <PersonSidebar 
          person={selectedPerson}
          rootId={rootPersonId}
          data={gedcomData}
          onClose={() => setSelectedPersonId(null)}
          onSelectRelative={handleSetRoot}
          onTracePath={handleTracePath}
          mainPersonId={originalRootId}
        />
      )}
    </div>
  );
};

export default App;