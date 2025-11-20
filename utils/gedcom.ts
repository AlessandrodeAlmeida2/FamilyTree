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
1 NAME João /Silva/
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
    maxDepth: number
): TreeNodeDatum | null => {
    const person = data.people[personId];
    if (!person || currentDepth > maxDepth) return null;

    const node: TreeNodeDatum = {
        id: person.id,
        name: `${person.name} ${person.surname}`,
        data: person,
        children: []
    };

    if (person.famc) {
        const family = data.families[person.famc];
        if (family) {
            if (family.husb) {
                const father = buildAncestryTree(family.husb, data, currentDepth + 1, maxDepth);
                if (father) node.children?.push(father);
            }
            if (family.wife) {
                const mother = buildAncestryTree(family.wife, data, currentDepth + 1, maxDepth);
                if (mother) node.children?.push(mother);
            }
        }
    }

    return node;
};

// Build Descendants Tree (Going Down: Children)
export const buildDescendantsTree = (
    personId: string,
    data: GedcomData,
    currentDepth: number,
    maxDepth: number
): TreeNodeDatum | null => {
    const person = data.people[personId];
    if (!person || currentDepth > maxDepth) return null;

    const node: TreeNodeDatum = {
        id: person.id,
        name: `${person.name} ${person.surname}`,
        data: person,
        children: []
    };

    // Iterate over all families where this person is a spouse (parent)
    if (person.fams && person.fams.length > 0) {
        person.fams.forEach(famId => {
            const family = data.families[famId];
            if (family && family.children) {
                family.children.forEach(childId => {
                    const childNode = buildDescendantsTree(childId, data, currentDepth + 1, maxDepth);
                    if (childNode) {
                        node.children?.push(childNode);
                    }
                });
            }
        });
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
