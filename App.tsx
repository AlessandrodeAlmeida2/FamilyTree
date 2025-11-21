import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TreeVisualization, TreeHandle } from './components/TreeVisualization';
import { PersonSidebar } from './components/PersonSidebar';
import { Controls } from './components/Controls';
import { parseGedcom, MOCK_GEDCOM_FILE, findFirstPersonId, findShortestPath } from './utils/gedcom';
import { GedcomData } from './types';

const App: React.FC = () => {
  const [gedcomData, setGedcomData] = useState<GedcomData | null>(null);
  const [rootPersonId, setRootPersonId] = useState<string | null>(null);
  const [originalRootId, setOriginalRootId] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [generations, setGenerations] = useState<number>(3);
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);

  // Reference to the Tree Component to control zoom/pan
  const treeRef = useRef<TreeHandle>(null);

  // Load Initial Data (Mock)
  useEffect(() => {
    // Simulate loading the "Gedcom_nov2025.ged" file
    const data = parseGedcom(MOCK_GEDCOM_FILE);
    setGedcomData(data);
    const startId = findFirstPersonId(data);
    setRootPersonId(startId);
    setOriginalRootId(startId);
  }, []);

  // Handlers
  const handlePersonClick = useCallback((id: string) => {
    setSelectedPersonId(id);
    setHighlightedPath([]); // Clear path when clicking a new person unless explicitly tracing
  }, []);

  const handleSetRoot = (id: string) => {
    setRootPersonId(id);
    setHighlightedPath([]);
    // Reset zoom to center on new tree
    setTimeout(() => treeRef.current?.reset(), 100);
  };
  
  const handleGoHome = () => {
    if (originalRootId) {
        handleSetRoot(originalRootId);
        setSelectedPersonId(originalRootId);
    }
  };

  const handleTracePath = (targetId: string) => {
    if (gedcomData && rootPersonId && targetId) {
        const path = findShortestPath(gedcomData, rootPersonId, targetId);
        setHighlightedPath(path);
        // Keep the target person selected so the sidebar stays open
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

        {/* Top Header (Simple) */}
        <div className="absolute top-0 left-0 w-full p-6 pointer-events-none z-10">
           <div className="inline-block bg-white/50 backdrop-blur-sm p-2 rounded-lg">
             <h1 className="text-xl font-bold text-gray-800 pointer-events-auto">
                Minha Árvore
             </h1>
             <p className="text-xs text-gray-600">GEDCOM Viewer</p>
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
        />
      )}
    </div>
  );
};

export default App;