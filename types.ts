
export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  SUPPLIERS = 'SUPPLIERS',
  CATALOG = 'CATALOG',
  COURSES = 'COURSES',
  PURCHASING = 'PURCHASING',
  RECONCILIATION = 'RECONCILIATION'
}

export interface Supplier {
  id: string;
  name: string;
  contractNumber: string;
  isActive: boolean;
  contractValue: number;
  contractStart: string;
  contractEnd: string;
}

export interface ServiceItem {
  id: string;
  supplierId: string;
  courseId?: string;
  name: string;
  unitPrice: number;
  unitType: string;
}

export interface Course {
  id: string;
  supplierId: string;
  title: string;
  lmsElementId: string;
  sifCode?: string;
}

export interface CourseEdition {
  id: string;
  courseId: string;
  lmsLessonId: string;
  runId: string;
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
  editionId: string;
  serviceItemId: string;
  plannedQty: number;
  actualQty: number;
  unitPriceOverride: number;
  plannedCost: number;
  actualCost: number; 
}

export interface PurchaseEm {
  id: string;
  code: string;
  amount: number;
  editionIds: string[];
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  title: string;
  createdAt: string;
  status: WorkflowStatus;
  isGeneric: boolean;
  plannedAmount: number; 
  actualAmount: number;  
  rdaCode: string;
  riaCode: string;
  riaStatus: RiaStatus;
  odaCode: string;
  ems: PurchaseEm[];
  items: PurchaseLineItem[];
}

export interface AppData {
  suppliers: Supplier[];
  services: ServiceItem[];
  courses: Course[];
  editions: CourseEdition[];
  orders: PurchaseOrder[];
}
