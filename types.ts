
export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  SUPPLIERS = 'SUPPLIERS',
  CATALOG = 'CATALOG',
  COURSES = 'COURSES',
  PURCHASING = 'PURCHASING',
  RECONCILIATION = 'RECONCILIATION' // Consuntivazione
}

export interface Supplier {
  id: string;
  name: string;
  contractNumber: string; // Ex Vat Number
  isActive: boolean; // Stato Attivo/Inattivo
  contractValue: number; // Budget totale contrattualizzato
  contractStart: string;
  contractEnd: string;
}

export interface ServiceItem {
  id: string;
  supplierId: string; // Link to specific Supplier
  courseId?: string; // Optional: Link to specific Course (Price List Override)
  name: string; // e.g., "Docenza Senior", "Tutoraggio"
  unitPrice: number;
  unitType: string; // e.g., "hour", "day", "flat"
}

export interface Course {
  id: string;
  supplierId: string; // Link to specific Supplier
  title: string;
  lmsElementId: string; // ID Elemento LMS
}

export interface CourseEdition {
  id: string;
  courseId: string;
  lmsLessonId: string; // ID Lezione LMS
  runId: string; // ID RUN
  startDate: string;
  endDate: string;
}

export enum WorkflowStatus {
  DRAFT = 'Bozza',
  IN_PROGRESS = 'In Lavorazione',
  CLOSED = 'Chiuso/EM'
}

export enum RiaStatus {
  CREATED = 'Creato',
  TO_REGISTER = 'Da Rubricare',
  SIGNING = 'In sottoscrizione',
  PERFECTED = 'Perfezionato',
  NONE = ''
}

export interface PurchaseLineItem {
  id: string;
  editionId: string; // Link to specific edition
  serviceItemId: string; // Link to price catalog
  plannedQty: number;
  actualQty: number; // For consuntivazione
  unitPriceOverride: number; // Allows specific rate per course/edition
  plannedCost: number; // Snapshot of cost at time of order
  actualCost: number; 
}

export interface PurchaseEm {
  id: string;
  code: string;
  amount: number;
  editionIds: string[]; // Linked editions
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  title: string; // Nome della scheda acquisto
  createdAt: string;
  status: WorkflowStatus;
  
  // Workflow Codes
  rdaCode: string; // Richiesta d'Acquisto
  riaCode: string; // Richiesta Impegno
  riaStatus: RiaStatus; // Specific RIA lifecycle
  odaCode: string; // Ordine d'Acquisto
  
  ems: PurchaseEm[]; // Changed from simple string[] to object array

  items: PurchaseLineItem[];
}

export interface AppData {
  suppliers: Supplier[];
  services: ServiceItem[];
  courses: Course[];
  editions: CourseEdition[];
  orders: PurchaseOrder[];
}