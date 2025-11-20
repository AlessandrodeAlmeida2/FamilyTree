export interface GedcomEvent {
  date?: string;
  place?: string;
  type: 'BIRT' | 'DEAT' | 'MARR' | 'OTHER';
}

export interface Person {
  id: string;
  name: string;
  surname: string;
  sex: 'M' | 'F' | 'U';
  birth?: GedcomEvent;
  death?: GedcomEvent;
  famc?: string; // Family ID where this person is a child
  fams?: string[]; // Family IDs where this person is a spouse/parent
  notes?: string;
  imageUrl?: string;
}

export interface Family {
  id: string;
  husb?: string;
  wife?: string;
  children: string[];
  marr?: GedcomEvent;
}

export interface GedcomData {
  people: Record<string, Person>;
  families: Record<string, Family>;
  head?: any;
}

export interface TreeNodeDatum {
  id: string;
  name: string;
  data: Person;
  children?: TreeNodeDatum[];
  isSpouse?: boolean; // Visual marker
}