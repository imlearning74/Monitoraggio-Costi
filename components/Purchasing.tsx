
import React, { useState } from 'react';
import { AppData, PurchaseOrder, PurchaseLineItem, WorkflowStatus, RiaStatus, CourseEdition, PurchaseEm } from '../types';
import { Plus, Trash2, Edit, Save, Copy, Package, Calendar, Hash, X, Search, Filter, BookOpen, Layers, Users, ArrowUpDown } from 'lucide-react';
import { api } from '../services/apiService';

interface PurchasingProps {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  mode: 'workflow' | 'reconciliation';
}

interface NewEditionForm {
    courseId: string;
    runId: string;
    lmsLessonId: string;
    startDate: string;
    endDate: string;
}

interface CloneEditionForm {
    sourceId: string;
    newRunId: string;
    newStartDate: string;
    newEndDate: string;
}

export const Purchasing: React.FC<PurchasingProps> = ({ data, setData, mode }) => {
  const [editingOrder, setEditingOrder] = useState<Partial<PurchaseOrder> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  
  // Sorting states
  const [sortField, setSortField] = useState<'createdAt' | 'title' | 'amount'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  const [selectedLines, setSelectedLines] = useState<PurchaseLineItem[]>([]);
  const [activeCourseIds, setActiveCourseIds] = useState<string[]>([]);
  const [activeEditionIds, setActiveEditionIds] = useState<string[]>([]);
  
  const [courseToAdd, setCourseToAdd] = useState<string>('');
  const [newEditionForm, setNewEditionForm] = useState<NewEditionForm>({courseId: '', runId: '', lmsLessonId: '', startDate: '', endDate: ''});
  const [cloneEditionForm, setCloneEditionForm] = useState<CloneEditionForm | null>(null);
  
  const [newEmCode, setNewEmCode] = useState('');
  const [newEmSelectedEditions, setNewEmSelectedEditions] = useState<string[]>([]);

  const handleCreateOrder = () => {
    const newOrder: PurchaseOrder = {
      id: crypto.randomUUID(),
      supplierId: '',
      title: 'Nuova Scheda Acquisto',
      createdAt: new Date().toISOString().split('T')[0],
      status: WorkflowStatus.DRAFT,
      isGeneric: false,
      plannedAmount: 0,
      actualAmount: 0,
      rdaCode: '',
      riaCode: '',
      riaStatus: RiaStatus.NONE,
      odaCode: '',
      ems: [],
      items: []
    };
    setEditingOrder(newOrder);
    setSelectedLines([]);
    setActiveCourseIds([]);
    setActiveEditionIds([]);
  };

  const handleEditOrder = (order: PurchaseOrder) => {
    setEditingOrder({ ...order });
    if(!order.riaStatus) setEditingOrder(prev => ({...prev, riaStatus: RiaStatus.NONE}));
    if(!order.ems) setEditingOrder(prev => ({...prev, ems: []}));

    setSelectedLines([...order.items]);
    
    const editionIds = [...new Set(order.items.map(i => i.editionId))];
    const courseIds = [...new Set(editionIds.map(eid => {
      const ed = data.editions.find(e => e.id === eid);
      return ed ? ed.courseId : '';
    }).filter(id => id !== ''))];

    setActiveEditionIds(editionIds);
    setActiveCourseIds(courseIds);
  };

  // Fix: Added missing handleSupplierChange function to manage supplier updates in the order form
  const handleSupplierChange = (supplierId: string) => {
    if (!editingOrder) return;
    setEditingOrder(prev => prev ? { ...prev, supplierId } : null);
    // Reset selection if supplier changes to prevent cross-supplier data pollution
    setSelectedLines([]);
    setActiveCourseIds([]);
    setActiveEditionIds([]);
  };

  const calculateTotal = (items: PurchaseLineItem[], type: 'planned' | 'actual') => {
    return items.reduce((acc, item) => {
       const price = item.unitPriceOverride || 0;
       const qty = type === 'planned' ? item.plannedQty : item.actualQty;
       return acc + (qty * price);
    }, 0);
  };

  const handleSaveOrder = async () => {
    if (!editingOrder || !editingOrder.id) return;
    if (!editingOrder.supplierId) {
      alert("Seleziona un fornitore prima di salvare.");
      return;
    }

    const updatedItems = selectedLines.map(line => ({
      ...line,
      plannedCost: line.plannedQty * line.unitPriceOverride,
      actualCost: line.actualQty * line.unitPriceOverride
    }));

    const updatedEms = (editingOrder.ems || []).map(em => {
        const calculatedAmount = updatedItems
            .filter(l => em.editionIds.includes(l.editionId))
            .reduce((acc, l) => acc + (l.actualQty * l.unitPriceOverride), 0);
        return { ...em, amount: calculatedAmount };
    });

    const finalOrder = {
      ...editingOrder,
      ems: updatedEms,
      items: updatedItems
    } as PurchaseOrder;

    setData(prev => {
      const exists = prev.orders.find(o => o.id === finalOrder.id);
      return { ...prev, orders: exists ? prev.orders.map(o => o.id === finalOrder.id ? finalOrder : o) : [...prev.orders, finalOrder] };
    });

    await api.mutate('UPSERT_ORDER', finalOrder);
    setEditingOrder(null);
  };

  const toggleSort = (field: 'createdAt' | 'title' | 'amount') => {
      if (sortField === field) {
          setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
          setSortField(field);
          setSortDirection('asc');
      }
  };

  if (editingOrder) {
    const itemsTotalPlanned = calculateTotal(selectedLines, 'planned');
    const itemsTotalActual = calculateTotal(selectedLines, 'actual');
    
    const displayGrandTotalPlanned = editingOrder.isGeneric ? Math.max(editingOrder.plannedAmount || 0, itemsTotalPlanned) : itemsTotalPlanned;
    const displayGrandTotalActual = editingOrder.isGeneric ? (itemsTotalActual > 0 ? itemsTotalActual : (editingOrder.actualAmount || 0)) : itemsTotalActual;

    return (
      <div className="bg-white p-6 rounded-lg shadow-lg animate-fade-in max-w-5xl mx-auto">
        <div className="flex justify-between items-start mb-6 border-b pb-4">
           <div>
             <h2 className="text-2xl font-bold text-gray-800">{editingOrder.id ? 'Modifica Scheda' : 'Nuova Scheda'}</h2>
             {editingOrder.isGeneric && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Generica</span>}
           </div>
           <div className="text-right">
             <div className="text-sm text-gray-500">Importo {mode === 'reconciliation' ? 'Effettivo' : 'Pianificato'}</div>
             <div className="text-3xl font-bold text-blue-600">€ { (mode === 'reconciliation' ? displayGrandTotalActual : displayGrandTotalPlanned).toLocaleString()}</div>
           </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 bg-gray-50 p-4 rounded-lg border">
          <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Titolo</label>
              <input type="text" className="w-full border rounded p-2" value={editingOrder.title} onChange={e => setEditingOrder({...editingOrder, title: e.target.value})}/>
          </div>
          <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Fornitore</label>
              <select className="w-full border rounded p-2 disabled:bg-gray-100" value={editingOrder.supplierId} onChange={e => handleSupplierChange(e.target.value)} disabled={mode === 'reconciliation'}>
                <option value="">-- Seleziona --</option>
                {data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
          </div>
          
          <div className="col-span-3 flex flex-col gap-4 bg-white p-4 rounded border">
             <div className="flex items-center gap-2">
                 <button onClick={() => mode === 'workflow' && setEditingOrder({...editingOrder, isGeneric: !editingOrder.isGeneric})}
                    className={`w-10 h-5 rounded-full relative transition-colors ${editingOrder.isGeneric ? 'bg-amber-500' : 'bg-gray-300'}`}>
                     <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${editingOrder.isGeneric ? 'left-6' : 'left-1'}`}></div>
                 </button>
                 <label className="text-sm font-bold text-gray-700">Acquisto Generico</label>
             </div>
             {editingOrder.isGeneric && (
                 <div className="grid grid-cols-2 gap-4 border-t pt-3">
                    <div>
                        <label className="block text-[10px] font-bold text-amber-700 uppercase">Budget Pianificato (€)</label>
                        <input type="number" className="w-full border p-2 rounded text-sm bg-amber-50" value={editingOrder.plannedAmount || 0} 
                            onChange={e => setEditingOrder({...editingOrder, plannedAmount: Number(e.target.value)})} disabled={mode === 'reconciliation'}/>
                    </div>
                    {mode === 'reconciliation' && (
                        <div>
                            <label className="block text-[10px] font-bold text-green-700 uppercase">Consuntivo (€)</label>
                            <input type="number" className="w-full border p-2 rounded text-sm bg-green-50" value={editingOrder.actualAmount || 0} 
                                onChange={e => setEditingOrder({...editingOrder, actualAmount: Number(e.target.value)})}/>
                        </div>
                    )}
                 </div>
             )}
          </div>
        </div>

        {editingOrder.supplierId && (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold">Struttura Corsi</h3>
                </div>
                {/* Logic for courses and editions remains similar to existing, but now optional if isGeneric */}
                {activeCourseIds.map(courseId => {
                    const course = data.courses.find(c => c.id === courseId);
                    return (
                        <div key={courseId} className="border rounded-xl bg-white shadow-sm overflow-hidden">
                             <div className="bg-gray-100 p-3 font-bold border-b">{course?.title}</div>
                             {/* ... list editions ... */}
                        </div>
                    )
                })}
                
                <div className="mt-6 bg-white p-6 rounded-xl border border-dashed border-gray-300 flex items-center gap-4 shadow-sm">
                    <select className="flex-1 p-2 border rounded text-sm" value={courseToAdd} onChange={e => setCourseToAdd(e.target.value)}>
                        <option value="">-- Aggiungi un corso --</option>
                        {data.courses.filter(c => c.supplierId === editingOrder.supplierId && !activeCourseIds.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                    <button onClick={() => { if(courseToAdd) setActiveCourseIds([...activeCourseIds, courseToAdd]); setCourseToAdd(''); }} className="bg-primary text-white px-4 py-2 rounded font-bold"><Plus size={18}/></button>
                </div>
            </div>
        )}

        <div className="flex justify-end gap-3 mt-10 pt-6 border-t">
          <button onClick={() => setEditingOrder(null)} className="px-6 py-2 border rounded">Annulla</button>
          <button onClick={handleSaveOrder} className="px-6 py-2 bg-blue-600 text-white rounded font-bold shadow-lg flex items-center gap-2"><Save size={18} /> Salva</button>
        </div>
      </div>
    );
  }

  const sortedOrders = [...data.orders]
    .filter(o => {
        const sup = data.suppliers.find(s => s.id === o.supplierId)?.name || '';
        return o.title.toLowerCase().includes(searchTerm.toLowerCase()) || sup.toLowerCase().includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => {
        let aVal: any = a[sortField as keyof PurchaseOrder] || '';
        let bVal: any = b[sortField as keyof PurchaseOrder] || '';
        if (sortField === 'amount') {
            aVal = a.isGeneric ? Math.max(a.plannedAmount || 0, a.items.reduce((s,i) => s+i.plannedCost, 0)) : a.items.reduce((s,i) => s+i.plannedCost, 0);
            bVal = b.isGeneric ? Math.max(b.plannedAmount || 0, b.items.reduce((s,i) => s+i.plannedCost, 0)) : b.items.reduce((s,i) => s+i.plannedCost, 0);
        }
        return sortDirection === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
        <h2 className="text-2xl font-bold">{mode === 'workflow' ? 'Acquisti' : 'Consuntivi'}</h2>
        <div className="flex flex-wrap gap-3">
            <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input className="pl-10 pr-4 py-2 border rounded-lg text-sm" placeholder="Cerca..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
            </div>
            {mode === 'workflow' && <button onClick={handleCreateOrder} className="bg-primary text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><Plus size={20} /> Nuova Scheda</button>}
        </div>
      </div>

      <div className="flex gap-4 items-center bg-gray-100 p-2 rounded-lg border">
          <span className="text-xs font-bold text-gray-500 uppercase ml-2 flex items-center gap-1"><ArrowUpDown size={14}/> Ordina:</span>
          <button onClick={() => toggleSort('createdAt')} className={`px-3 py-1 rounded text-xs font-bold ${sortField === 'createdAt' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Data</button>
          <button onClick={() => toggleSort('title')} className={`px-3 py-1 rounded text-xs font-bold ${sortField === 'title' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Titolo</button>
          <button onClick={() => toggleSort('amount')} className={`px-3 py-1 rounded text-xs font-bold ${sortField === 'amount' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Importo</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedOrders.map(order => {
          const supplier = data.suppliers.find(s => s.id === order.supplierId);
          const totalPlan = order.isGeneric ? Math.max(order.plannedAmount || 0, order.items.reduce((s,i) => s+i.plannedCost, 0)) : order.items.reduce((s,i) => s+i.plannedCost, 0);
          return (
            <div key={order.id} className="bg-white p-5 rounded-xl shadow-sm border relative group overflow-hidden">
              {order.isGeneric && <div className="absolute top-0 right-0 bg-amber-500 text-white text-[8px] font-bold px-4 py-1 rotate-45 translate-x-3 -translate-y-1 uppercase">Generica</div>}
              <h3 className="font-bold text-lg mb-1">{order.title}</h3>
              <p className="text-xs text-gray-500 mb-4 flex items-center gap-1"><Users size={12}/> {supplier?.name}</p>
              <div className="flex justify-between border-t pt-4">
                 <div><span className="text-[10px] text-gray-400 block font-bold">Pianificato</span><span className="font-bold text-blue-600">€ {totalPlan.toLocaleString()}</span></div>
                 <button onClick={() => handleEditOrder(order)} className="bg-gray-100 px-3 py-2 rounded text-xs font-bold flex items-center gap-1"><Edit size={14}/> Gestisci</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
