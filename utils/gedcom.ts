import { GedcomData, Person, Family, TreeNodeDatum } from '../types';

// MOCK GEDCOM CONTENT mimicking 'Gedcom_nov2025.ged'
export const MOCK_GEDCOM_FILE = `
0 HEAD
1 SOUR FAMILY_SEARCH
1 GEDC
2 VERS 5.5.1
2 FORM LINEAGE-LINKED
1 CHAR UTF-8
0 @I1@ INDI
1 NAME Valter Alessandro de Almeida /D'Alvia Agostini/
1 SEX M
1 BIRT
2 DATE 10 JAN 1980
2 PLAC São Paulo, Brasil
1 FAMS @F1@
1 FAMC @F2@
1 OBJE
2 FILE https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?fit=crop&w=200&h=200
0 @I2@ INDI
1 NAME Maria /Santos/
1 SEX F
1 BIRT
2 DATE 15 MAR 1982
2 PLAC Rio de Janeiro, Brasil
1 FAMS @F1@
1 OBJE
2 FILE https://images.unsplash.com/photo-1438761681033-6461ffad8d80?fit=crop&w=200&h=200
0 @I3@ INDI
1 NAME Pedro /Silva/
1 SEX M
1 BIRT
2 DATE 20 MAY 2010
2 PLAC Curitiba, Brasil
1 FAMC @F1@
0 @I4@ INDI
1 NAME Antônio /Silva/
1 SEX M
1 BIRT
2 DATE 05 JUN 1950
2 PLAC Lisboa, Portugal
1 DEAT
2 DATE 12 DEC 2020
2 PLAC São Paulo, Brasil
1 FAMS @F2@
0 @I5@ INDI
1 NAME Ana /Oliveira/
1 SEX F
1 BIRT
2 DATE 22 AUG 1955
2 PLAC Porto, Portugal
1 FAMS @F2@
0 @I6@ INDI
1 NAME Manuel /Silva/
1 SEX M
1 BIRT
2 DATE 1920
1 DEAT
2 DATE 1990
1 FAMS @F3@
0 @I7@ INDI
1 NAME Rosa /Pereira/
1 SEX F
1 BIRT
2 DATE 1925
1 DEAT
2 DATE 2000
1 FAMS @F3@
0 @I8@ INDI
1 NAME Carlos /Silva/
1 SEX M
1 BIRT
2 DATE 1978
1 FAMC @F2@
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
0 @F2@ FAM
1 HUSB @I4@
1 WIFE @I5@
1 CHIL @I1@
1 CHIL @I8@
0 @F3@ FAM
1 HUSB @I6@
1 WIFE @I7@
1 CHIL @I4@
0 TRLR
`;

// Simple GEDCOM Parsing Logic
export const parseGedcom = (content: string): GedcomData => {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const people: Record<string, Person> = {};
  const families: Record<string, Family> = {};
  
  let currentId = '';
  let currentType = ''; // INDI or FAM
  let currentTag = ''; // BIRT, DEAT, etc

  lines.forEach((line) => {
    const parts = line.split(' ');
    const level = parts[0];
    const tagOrId = parts[1];
    const value = parts.slice(2).join(' ');

    if (level === '0') {
      if (value === 'INDI') {
        currentId = tagOrId;
        currentType = 'INDI';
        people[currentId] = {
          id: currentId,
          name: 'Unknown',
          surname: '',
          sex: 'U',
          fams: [],
          imageUrl: ''
        };
      } else if (value === 'FAM') {
        currentId = tagOrId;
        currentType = 'FAM';
        families[currentId] = {
          id: currentId,
          children: []
        };
      } else {
        currentType = '';
      }
    } else if (currentType === 'INDI') {
      const person = people[currentId];
      if (level === '1') {
        currentTag = tagOrId;
        if (tagOrId === 'NAME') {
            const nameParts = value.split('/');
            person.name = nameParts[0]?.trim() || '';
            person.surname = nameParts[1]?.trim() || '';
        }
        if (tagOrId === 'SEX') person.sex = value as 'M'|'F'|'U';
        if (tagOrId === 'FAMC') person.famc = value;
        if (tagOrId === 'FAMS') person.fams?.push(value);
        if (tagOrId === 'BIRT') person.birth = { type: 'BIRT' };
        if (tagOrId === 'DEAT') person.death = { type: 'DEAT' };
        if (tagOrId === 'OBJE') currentTag = 'OBJE';
      } else if (level === '2') {
         if (currentTag === 'BIRT' && person.birth) {
            if (tagOrId === 'DATE') person.birth.date = value;
            if (tagOrId === 'PLAC') person.birth.place = value;
         }
         if (currentTag === 'DEAT' && person.death) {
            if (tagOrId === 'DATE') person.death.date = value;
            if (tagOrId === 'PLAC') person.death.place = value;
         }
         if (currentTag === 'OBJE' && tagOrId === 'FILE') {
            person.imageUrl = value;
         }
      }
    } else if (currentType === 'FAM') {
        const family = families[currentId];
        if (level === '1') {
            if (tagOrId === 'HUSB') family.husb = value;
            if (tagOrId === 'WIFE') family.wife = value;
            if (tagOrId === 'CHIL') family.children.push(value);
        }
    }
  });

  return { people, families };
};

// Helper to find the root person (usually the first person or specifically requested)
export const findFirstPersonId = (data: GedcomData): string => {
  const ids = Object.keys(data.people);
  return ids.length > 0 ? ids[0] : '';
};

// Build Ancestry Tree (Going Up: Parents)
export const buildAncestryTree = (
    personId: string, 
    data: GedcomData, 
    currentDepth: number, 
    maxDepth: number,
    highlightedPath: string[] = [] // New Param
): TreeNodeDatum | null => {
    const person = data.people[personId];
    if (!person || currentDepth > maxDepth) return null;

    const node: TreeNodeDatum = {
        id: person.id,
        name: `${person.name} ${person.surname}`,
        data: person,
        children: []
    };

    // Standard Parent Logic
    if (person.famc) {
        const family = data.families[person.famc];
        if (family) {
            if (family.husb) {
                const father = buildAncestryTree(family.husb, data, currentDepth + 1, maxDepth, highlightedPath);
                if (father) node.children?.push(father);
            }
            if (family.wife) {
                const mother = buildAncestryTree(family.wife, data, currentDepth + 1, maxDepth, highlightedPath);
                if (mother) node.children?.push(mother);
            }
        }
    }

    return node;
};

// Build Descendants Tree (Going Down: Children AND Spouses in Path)
export const buildDescendantsTree = (
    personId: string,
    data: GedcomData,
    currentDepth: number,
    maxDepth: number,
    highlightedPath: string[] = [] // New Param
): TreeNodeDatum | null => {
    const person = data.people[personId];
    if (!person || currentDepth > maxDepth) return null;

    const node: TreeNodeDatum = {
        id: person.id,
        name: `${person.name} ${person.surname}`,
        data: person,
        children: []
    };

    const addedIds = new Set<string>();

    // 1. Standard Children Logic
    if (person.fams && person.fams.length > 0) {
        person.fams.forEach(famId => {
            const family = data.families[famId];
            if (family && family.children) {
                family.children.forEach(childId => {
                    if (addedIds.has(childId)) return;
                    const childNode = buildDescendantsTree(childId, data, currentDepth + 1, maxDepth, highlightedPath);
                    if (childNode) {
                        node.children?.push(childNode);
                        addedIds.add(childId);
                    }
                });
            }
        });
    }

    // 2. PATH TRACING HACK: Inject Spouse/Partner if they are next in the path
    // This allows "crossing over" marriage lines in the visual tree
    if (highlightedPath.length > 0) {
        const pathIndex = highlightedPath.indexOf(personId);
        if (pathIndex !== -1) {
            const nextInPath = highlightedPath[pathIndex + 1];
            const prevInPath = highlightedPath[pathIndex - 1];
            const targetNeighbors = [nextInPath, prevInPath].filter(Boolean);

            targetNeighbors.forEach(targetId => {
                if (addedIds.has(targetId)) return; // Already added as child
                
                // Check if this target is a spouse
                const isSpouse = person.fams?.some(famId => {
                    const fam = data.families[famId];
                    return (fam && (fam.husb === targetId || fam.wife === targetId));
                });

                if (isSpouse) {
                    // Inject spouse as a "Visual Child" to maintain continuity in the D3 Tree layout
                    const spouseNode = buildDescendantsTree(targetId, data, currentDepth + 1, maxDepth, highlightedPath);
                    if (spouseNode) {
                        spouseNode.isSpouse = true; // Mark visual distinction
                        node.children?.push(spouseNode);
                        addedIds.add(targetId);
                    }
                }
            });
        }
    }

    return node;
};

// Get Siblings
export const getSiblings = (personId: string, data: GedcomData): Person[] => {
    const person = data.people[personId];
    if (!person || !person.famc) return [];
    
    const family = data.families[person.famc];
    if (!family || !family.children) return [];

    return family.children
        .filter(childId => childId !== personId)
        .map(childId => data.people[childId])
        .filter(p => !!p);
};

// Find shortest path between two people using BFS
export const findShortestPath = (data: GedcomData, startId: string, targetId: string): string[] => {
    if (startId === targetId) return [startId];

    const queue: { id: string; path: string[] }[] = [{ id: startId, path: [startId] }];
    const visited = new Set<string>();
    visited.add(startId);

    while (queue.length > 0) {
        const { id, path } = queue.shift()!;
        const person = data.people[id];
        if (!person) continue;

        const neighbors: string[] = [];

        // 1. Parents (via FAMC)
        if (person.famc) {
            const fam = data.families[person.famc];
            if (fam) {
                if (fam.husb) neighbors.push(fam.husb);
                if (fam.wife) neighbors.push(fam.wife);
                if (fam.children) neighbors.push(...fam.children);
            }
        }

        // 2. Spouses and Children (via FAMS)
        if (person.fams) {
            person.fams.forEach(famId => {
                const fam = data.families[famId];
                if (fam) {
                    if (fam.husb && fam.husb !== id) neighbors.push(fam.husb);
                    if (fam.wife && fam.wife !== id) neighbors.push(fam.wife);
                    if (fam.children) neighbors.push(...fam.children);
                }
            });
        }

        for (const neighborId of neighbors) {
            if (neighborId === targetId) {
                return [...path, neighborId];
            }
            if (!visited.has(neighborId)) {
                visited.add(neighborId);
                queue.push({ id: neighborId, path: [...path, neighborId] });
            }
        }
    }

    return [];
};

export const getPathPeak = (data: GedcomData, path: string[]): string => {
    if (!path || path.length === 0) return '';
    
    for (let i = 0; i < path.length; i++) {
        const currId = path[i];
        const prevId = path[i-1];
        const nextId = path[i+1];
        
        const curr = data.people[currId];
        if (!curr) continue;
        
        let isParentToPrev = false;
        let isParentToNext = false;
        
        if (prevId) {
             const prev = data.people[prevId];
             if (prev?.famc) {
                 const fam = data.families[prev.famc];
                 if (fam && (fam.husb === currId || fam.wife === currId)) isParentToPrev = true;
             }
        }
        
        if (nextId) {
             const next = data.people[nextId];
             if (next?.famc) {
                 const fam = data.families[next.famc];
                 if (fam && (fam.husb === currId || fam.wife === currId)) isParentToNext = true;
             }
        }
        
        if (prevId && nextId && isParentToPrev && isParentToNext) return currId;
    }
    
    for (let i = 0; i < path.length - 1; i++) {
        const current = data.people[path[i]];
        const next = data.people[path[i+1]];
        if (current.famc) {
            const fam = data.families[current.famc];
            if (fam && (fam.husb === next?.id || fam.wife === next?.id)) {
                continue;
            }
        }
        return current.id;
    }
    
    return path[0];
};

// Helper for Relationship Calculation
export const getAncestors = (data: GedcomData, startId: string): Map<string, number> => {
    const ancestors = new Map<string, number>();
    const queue: { id: string; dist: number }[] = [{ id: startId, dist: 0 }];
    
    while (queue.length > 0) {
        const { id, dist } = queue.shift()!;
        if (ancestors.has(id)) continue;
        ancestors.set(id, dist);
        
        const person = data.people[id];
        if (person?.famc) {
            const fam = data.families[person.famc];
            if (fam) {
                if (fam.husb) queue.push({ id: fam.husb, dist: dist + 1 });
                if (fam.wife) queue.push({ id: fam.wife, dist: dist + 1 });
            }
        }
    }
    return ancestors;
};

// Calculate Relationship Name (Portuguese)
export const getRelationshipName = (data: GedcomData, baseId: string, targetId: string): string => {
    if (baseId === targetId) return "Você (Pessoa Principal)";
    
    // 1. Direct Spouse Check
    const base = data.people[baseId];
    if (base?.fams) {
        for (const famId of base.fams) {
            const fam = data.families[famId];
            if (fam && (fam.husb === targetId || fam.wife === targetId)) return "Esposo(a)";
        }
    }

    // 2. Blood Relationship (Lowest Common Ancestor - LCA)
    const ancestorsBase = getAncestors(data, baseId);
    const ancestorsTarget = getAncestors(data, targetId);
    
    let lcaId: string | null = null;
    let minSum = Infinity;
    
    for (const [id, distBase] of ancestorsBase.entries()) {
        if (ancestorsTarget.has(id)) {
            const distTarget = ancestorsTarget.get(id)!;
            if (distBase + distTarget < minSum) {
                minSum = distBase + distTarget;
                lcaId = id;
            }
        }
    }
    
    if (lcaId) {
        const dUp = ancestorsBase.get(lcaId)!;    // Steps up from Base to LCA
        const dDown = ancestorsTarget.get(lcaId)!; // Steps down from LCA to Target
        
        if (dUp === 0 && dDown === 1) return "Filho(a)";
        if (dUp === 0 && dDown === 2) return "Neto(a)";
        if (dUp === 0 && dDown === 3) return "Bisneto(a)";
        if (dUp === 0 && dDown > 3) return `${dDown - 2}º Neto(a)`;

        if (dUp === 1 && dDown === 0) return "Pai/Mãe";
        if (dUp === 2 && dDown === 0) return "Avô/Avó";
        if (dUp === 3 && dDown === 0) return "Bisavô/Bisavó";
        if (dUp > 3 && dDown === 0) return `${dUp - 2}º Avô/Avó`;

        if (dUp === 1 && dDown === 1) return "Irmão/Irmã";
        
        if (dUp === 2 && dDown === 1) return "Tio(a)";
        if (dUp === 1 && dDown === 2) return "Sobrinho(a)";
        
        if (dUp === 3 && dDown === 1) return "Tio-avô/Tia-avó";
        if (dUp === 1 && dDown === 3) return "Sobrinho-neto(a)";
        
        if (dUp === 2 && dDown === 2) return "Primo(a)";
        if (dUp === 3 && dDown === 3) return "Primo(a) de 2º Grau";
        
        if (dUp > 2 && dDown > 2) return "Primo(a) Distante";
        
        return "Parente Consanguíneo";
    }
    
    // 3. Fallback: Check if path exists but strictly by marriage
    const path = findShortestPath(data, baseId, targetId);
    if (path.length > 0) return "Parente por Casamento";

    return "Sem relação direta";
};