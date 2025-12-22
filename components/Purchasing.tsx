import React, { useState, useEffect } from 'react';
import { AppData, PurchaseOrder, PurchaseLineItem, WorkflowStatus, RiaStatus, CourseEdition, PurchaseEm } from '../types';
// Fixed: Added 'Users' to the lucide-react import list
import { Plus, Trash2, Edit, Save, Copy, ChevronDown, ChevronRight, AlertCircle, Package, Calculator, Calendar, Hash, FileText, X, Search, CheckSquare, Square, DollarSign, Filter, BookOpen, Layers, Users } from 'lucide-react';
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
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); 
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  
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

  const handleDeleteOrder = async (id: string) => {
      if(window.confirm("Sei sicuro di voler eliminare questa scheda acquisto definitivamente?")) {
          setData(prev => ({ ...prev, orders: prev.orders.filter(o => o.id !== id) }));
          await api.mutate('DELETE_ORDER', { id });
      }
  };

  const handleSupplierChange = (supplierId: string) => {
    if (selectedLines.length > 0 || activeCourseIds.length > 0) {
      if (!window.confirm("Cambiare fornitore rimuoverà tutti i corsi e le voci inserite. Continuare?")) {
        return;
      }
    }
    setEditingOrder(prev => prev ? ({...prev, supplierId}) : null);
    setSelectedLines([]);
    setActiveCourseIds([]);
    setActiveEditionIds([]);
  };

  const handleSaveOrder = async () => {
    if (!editingOrder || !editingOrder.id) return;
    if (!editingOrder.supplierId) {
      alert("Seleziona un fornitore prima di salvare.");
      return;
    }

    const updatedItems = selectedLines.map(line => {
      const price = line.unitPriceOverride;
      return {
        ...line,
        plannedCost: line.plannedQty * price,
        actualCost: line.actualQty * price
      };
    });

    // Ricalcolo automatico importo EM prima del salvataggio
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
      if (exists) {
        return { ...prev, orders: prev.orders.map(o => o.id === finalOrder.id ? finalOrder : o) };
      }
      return { ...prev, orders: [...prev.orders, finalOrder] };
    });

    await api.mutate('UPSERT_ORDER', finalOrder);
    setEditingOrder(null);
  };

  const addCourseToOrder = () => {
    if (!courseToAdd) return;
    if (!activeCourseIds.includes(courseToAdd)) {
      setActiveCourseIds([...activeCourseIds, courseToAdd]);
    }
    setCourseToAdd('');
  };

  const removeCourseFromOrder = (courseId: string) => {
    if (mode === 'reconciliation' && !editingOrder?.isGeneric) return;
    const editionsToRemove = data.editions.filter(e => e.courseId === courseId && activeEditionIds.includes(e.id)).map(e => e.id);
    setActiveCourseIds(prev => prev.filter(id => id !== courseId));
    setActiveEditionIds(prev => prev.filter(id => !editionsToRemove.includes(id)));
    setSelectedLines(prev => prev.filter(line => !editionsToRemove.includes(line.editionId)));
  };

  const createEditionForCourse = async () => {
    const { courseId, runId, lmsLessonId, startDate, endDate } = newEditionForm;
    if (!courseId) return;
    const finalRunId = runId.trim() === '' ? `RUN-${Date.now().toString().slice(-4)}` : runId;
    const newEdition: CourseEdition = {
        id: crypto.randomUUID(),
        courseId,
        runId: finalRunId,
        lmsLessonId,
        startDate,
        endDate
    };
    setData(prev => ({...prev, editions: [...prev.editions, newEdition]}));
    await api.mutate('UPSERT_EDITION', newEdition);
    setActiveEditionIds(prev => [...prev, newEdition.id]);
    setNewEditionForm({courseId: '', runId: '', lmsLessonId: '', startDate: '', endDate: ''});
  };

  const updateEditionDetails = async (editionId: string, field: keyof CourseEdition, value: string) => {
      setData(prev => ({
          ...prev,
          editions: prev.editions.map(e => {
              if (e.id === editionId) {
                 const updated = { ...e, [field]: value };
                 api.mutate('UPSERT_EDITION', updated); 
                 return updated;
              }
              return e;
          })
      }));
  };

  const removeEditionFromOrder = (editionId: string) => {
    if (mode === 'reconciliation' && !editingOrder?.isGeneric) return;
    setActiveEditionIds(prev => prev.filter(id => id !== editionId));
    setSelectedLines(prev => prev.filter(line => line.editionId !== editionId));
  };

  const executeCloneEdition = async () => {
    if (!cloneEditionForm) return;
    const sourceEdition = data.editions.find(e => e.id === cloneEditionForm.sourceId);
    if (!sourceEdition) return;
    const finalRunId = cloneEditionForm.newRunId.trim() === '' ? `RUN-${Date.now().toString().slice(-4)}` : cloneEditionForm.newRunId;
    const newEdition: CourseEdition = {
        id: crypto.randomUUID(),
        courseId: sourceEdition.courseId,
        runId: finalRunId,
        lmsLessonId: sourceEdition.lmsLessonId, 
        startDate: cloneEditionForm.newStartDate,
        endDate: cloneEditionForm.newEndDate
    };
    setData(prev => ({...prev, editions: [...prev.editions, newEdition]}));
    await api.mutate('UPSERT_EDITION', newEdition);
    setActiveEditionIds(prev => [...prev, newEdition.id]);
    const sourceItems = selectedLines.filter(l => l.editionId === cloneEditionForm.sourceId);
    const newItems = sourceItems.map(item => ({
      ...item,
      id: crypto.randomUUID(),
      editionId: newEdition.id,
      actualQty: 0, 
      actualCost: 0
    }));
    setSelectedLines(prev => [...prev, ...newItems]);
    setCloneEditionForm(null);
  };

  const addLineItem = (editionId: string) => {
    const newItem: PurchaseLineItem = {
      id: crypto.randomUUID(),
      editionId: editionId,
      serviceItemId: '',
      plannedQty: 1,
      actualQty: 0,
      unitPriceOverride: 0,
      plannedCost: 0,
      actualCost: 0
    };
    setSelectedLines([...selectedLines, newItem]);
  };

  const handleServiceSelect = (itemId: string, serviceId: string) => {
      const service = data.services.find(s => s.id === serviceId);
      setSelectedLines(prev => prev.map(item => {
          if(item.id === itemId) {
              return { ...item, serviceItemId: serviceId, unitPriceOverride: service ? service.unitPrice : 0 };
          }
          return item;
      }));
  };

  const updateLineItem = (id: string, field: keyof PurchaseLineItem, value: any) => {
    setSelectedLines(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const removeLineItem = (id: string) => {
    setSelectedLines(prev => prev.filter(item => item.id !== id));
  };
  
  const handleAddEm = () => {
      if (!newEmCode) return;
      // L'importo viene calcolato automaticamente, inizializziamo a 0
      const newEm: PurchaseEm = {
          id: crypto.randomUUID(),
          code: newEmCode,
          amount: 0, 
          editionIds: newEmSelectedEditions
      };
      
      // Calcoliamo l'importo basandoci sulle edizioni selezionate
      const calculatedAmount = selectedLines
        .filter(l => newEmSelectedEditions.includes(l.editionId))
        .reduce((acc, l) => acc + (l.actualQty * l.unitPriceOverride), 0);
      
      newEm.amount = calculatedAmount;

      setEditingOrder(prev => prev ? ({ ...prev, ems: [...(prev.ems || []), newEm] }) : null);
      setNewEmCode(''); setNewEmSelectedEditions([]);
  };

  const handleRemoveEm = (emId: string) => {
      setEditingOrder(prev => prev ? ({ ...prev, ems: (prev.ems || []).filter(e => e.id !== emId) }) : null);
  };

  const toggleEditionForEm = (editionId: string) => {
      if (newEmSelectedEditions.includes(editionId)) {
          setNewEmSelectedEditions(prev => prev.filter(id => id !== editionId));
      } else {
          setNewEmSelectedEditions(prev => [...prev, editionId]);
      }
  };
  
  const calculateTotal = (items: PurchaseLineItem[], type: 'planned' | 'actual') => {
    return items.reduce((acc, item) => {
       const price = item.unitPriceOverride || 0;
       const qty = type === 'planned' ? item.plannedQty : item.actualQty;
       return acc + (qty * price);
    }, 0);
  };

  if (editingOrder) {
    const currentSupplier = data.suppliers.find(s => s.id === editingOrder.supplierId);
    const availableCourses = data.courses.filter(c => c.supplierId === editingOrder.supplierId);
    const genericServices = data.services.filter(s => s.supplierId === editingOrder.supplierId && !s.courseId);

    const grandTotalPlanned = calculateTotal(selectedLines, 'planned');
    const grandTotalActual = calculateTotal(selectedLines, 'actual');

    const allowCatalogManagement = mode === 'workflow' || editingOrder.isGeneric;

    return (
      <div className="bg-white p-6 rounded-lg shadow-lg animate-fade-in max-w-5xl mx-auto">
        <div className="flex justify-between items-start mb-6 border-b pb-4">
           <div>
             <h2 className="text-2xl font-bold text-gray-800">{editingOrder.id ? (mode === 'reconciliation' ? 'Consuntivazione' : 'Modifica Scheda') : 'Nuova Scheda Acquisto'}</h2>
             {editingOrder.isGeneric && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Acquisto Generico</span>}
           </div>
           <div className="text-right">
             <div className="text-sm text-gray-500">Importo {mode === 'reconciliation' ? 'Effettivo' : 'Pianificato'}</div>
             <div className="text-3xl font-bold text-blue-600">€ {(mode === 'reconciliation' ? grandTotalActual : grandTotalPlanned).toLocaleString()}</div>
           </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 bg-gray-50 p-4 rounded-lg border">
          <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Titolo Scheda</label>
              <input type="text" className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" value={editingOrder.title} onChange={e => setEditingOrder({...editingOrder, title: e.target.value})}/>
          </div>
          <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Fornitore</label>
              <select className="w-full border border-gray-300 rounded-md p-2 disabled:bg-gray-100" value={editingOrder.supplierId} onChange={e => handleSupplierChange(e.target.value)} disabled={mode === 'reconciliation'}>
                <option value="">-- Seleziona Fornitore --</option>
                {data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
          </div>
          
          <div className="col-span-1 md:col-span-3 flex items-center gap-4 bg-white p-3 rounded border shadow-sm">
             <div className="flex items-center gap-2">
                 <button 
                    onClick={() => mode === 'workflow' && setEditingOrder({...editingOrder, isGeneric: !editingOrder.isGeneric})}
                    className={`w-10 h-5 rounded-full relative transition-colors ${editingOrder.isGeneric ? 'bg-amber-500' : 'bg-gray-300'} ${mode === 'reconciliation' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                 >
                     <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${editingOrder.isGeneric ? 'left-6' : 'left-1'}`}></div>
                 </button>
                 <label className="text-sm font-bold text-gray-700 flex items-center gap-1"><Layers size={14}/> Acquisto Generico</label>
             </div>
             <p className="text-xs text-gray-500 italic">Se attivo, permette di impegnare budget senza definire corsi e sblocca la creazione edizioni in consuntivazione.</p>
          </div>

          <div className="col-span-1 md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4 border-t pt-4 mt-2">
             <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">RdA Code</label><input className="w-full p-2 border rounded text-sm bg-white" value={editingOrder.rdaCode} onChange={e => setEditingOrder({...editingOrder, rdaCode: e.target.value})} /></div>
             <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">RIA Code</label><input className="w-full p-2 border rounded text-sm bg-white" value={editingOrder.riaCode} onChange={e => setEditingOrder({...editingOrder, riaCode: e.target.value})} /></div>
             <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stato RIA</label><select className="w-full p-2 border rounded text-sm bg-white" value={editingOrder.riaStatus || RiaStatus.NONE} onChange={e => setEditingOrder({...editingOrder, riaStatus: e.target.value as RiaStatus})}>
                     <option value={RiaStatus.NONE}>--</option>{Object.values(RiaStatus).filter(s => s !== RiaStatus.NONE).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
             <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">OdA Code</label><input className="w-full p-2 border rounded text-sm bg-white" value={editingOrder.odaCode} onChange={e => setEditingOrder({...editingOrder, odaCode: e.target.value})} /></div>
          </div>
          <div className="col-span-1 md:col-span-3">
             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stato Generale</label>
             <select className="w-full p-2 border rounded text-sm bg-white" value={editingOrder.status} onChange={e => setEditingOrder({...editingOrder, status: e.target.value as WorkflowStatus})}>
               {Object.values(WorkflowStatus).map(s => <option key={s} value={s}>{s}</option>)}
             </select>
          </div>
        </div>

        {!editingOrder.supplierId ? (
            <div className="bg-blue-50 p-10 text-center rounded-xl border border-dashed border-blue-300">
                <p className="text-blue-600 font-medium">Seleziona un fornitore per iniziare a comporre la scheda d'acquisto.</p>
            </div>
        ) : (
          <div className="space-y-8">
            {mode === 'reconciliation' && (
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg shadow-sm">
                    <h3 className="text-lg font-bold text-green-800 mb-4 flex items-center gap-2"><Package size={20}/> Gestione Entrate Merci (EM)</h3>
                    <div className="space-y-3 mb-4">
                        {(editingOrder.ems || []).map(em => {
                            // Calcolo real-time dell'importo dell'EM basato sulle edizioni collegate
                            const calculatedEmValue = selectedLines
                                .filter(l => em.editionIds.includes(l.editionId))
                                .reduce((acc, l) => acc + (l.actualQty * l.unitPriceOverride), 0);
                                
                            return (
                                <div key={em.id} className="bg-white p-3 rounded border shadow-sm flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-green-100 text-green-800 px-3 py-1 rounded-md font-bold text-sm border border-green-200">{em.code}</div>
                                        <div className="text-sm">Valore Calcolato: <span className="font-bold text-green-700">€ {calculatedEmValue.toLocaleString()}</span></div>
                                        <div className="text-[10px] text-gray-400 uppercase font-bold">Edizioni: {em.editionIds.length}</div>
                                    </div>
                                    <button onClick={() => handleRemoveEm(em.id)} className="text-red-400 hover:text-red-600 p-1 transition-colors"><Trash2 size={16}/></button>
                                </div>
                            );
                        })}
                    </div>
                    
                    <div className="bg-white p-4 rounded border border-green-300 shadow-inner">
                        <div className="flex gap-2 mb-3">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Codice EM</label>
                                <input className="w-full border p-2 rounded text-sm focus:ring-1 focus:ring-green-500 outline-none" placeholder="Es. 500001234" value={newEmCode} onChange={e => setNewEmCode(e.target.value)}/>
                            </div>
                        </div>
                        <div className="mb-3">
                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Associa Edizioni all'EM</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 border rounded bg-gray-50">
                                {activeEditionIds.map(eid => {
                                    const ed = data.editions.find(e => e.id===eid);
                                    const course = data.courses.find(c => c.id === ed?.courseId);
                                    return (
                                        <label key={eid} className={`flex items-center gap-2 text-xs p-2 rounded border cursor-pointer transition-colors ${newEmSelectedEditions.includes(eid) ? 'bg-green-100 border-green-300' : 'bg-white hover:bg-gray-100'}`}>
                                            <input type="checkbox" className="accent-green-600" checked={newEmSelectedEditions.includes(eid)} onChange={() => toggleEditionForEm(eid)}/>
                                            <div className="flex flex-col">
                                                <span className="font-bold">{ed?.runId}</span>
                                                <span className="text-[10px] text-gray-500 truncate">{course?.title}</span>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                        <button onClick={handleAddEm} disabled={!newEmCode || newEmSelectedEditions.length === 0} className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded text-sm font-bold shadow-md transition-all disabled:opacity-50">Aggiungi EM</button>
                    </div>
                </div>
            )}
            
            <div>
               <div className="flex justify-between items-center mb-4">
                   <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Package size={20}/> Struttura dell'Ordine</h3>
                   {editingOrder.isGeneric && <span className="text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">Scheda Generica: Edizioni sbloccate</span>}
               </div>
               
               <div className="space-y-6">
                  {activeCourseIds.map(courseId => {
                    const course = data.courses.find(c => c.id === courseId);
                    const editionsForThisCourse = activeEditionIds.filter(eid => data.editions.find(e => e.id === eid)?.courseId === courseId);
                    const courseSpecificServices = data.services.filter(s => s.supplierId === editingOrder.supplierId && s.courseId === courseId);
                    const availableServicesForEdition = [...genericServices, ...courseSpecificServices];
                    
                    const courseItems = selectedLines.filter(l => editionsForThisCourse.includes(l.editionId));
                    const courseTotalPlanned = calculateTotal(courseItems, 'planned');
                    const courseTotalActual = calculateTotal(courseItems, 'actual');

                    return (
                      <div key={courseId} className="border border-gray-300 rounded-xl overflow-hidden bg-white shadow-sm hover:border-blue-400 transition-colors">
                        <div className="bg-gray-100 p-4 flex justify-between items-center border-b">
                          <div className="flex items-center gap-2">
                              <BookOpen size={18} className="text-gray-500"/>
                              <h4 className="font-bold text-lg">{course?.title}</h4>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] text-gray-500 uppercase font-bold">Valore Corso</span>
                                <span className="font-bold text-indigo-700">€ {(mode === 'reconciliation' ? courseTotalActual : courseTotalPlanned).toLocaleString()}</span>
                            </div>
                            {allowCatalogManagement && <button onClick={() => removeCourseFromOrder(courseId)} className="text-red-400 hover:text-red-600 transition-colors p-1"><Trash2 size={18} /></button>}
                          </div>
                        </div>

                        <div className="p-4 bg-gray-50 space-y-4">
                           {editionsForThisCourse.map(editionId => {
                              const edition = data.editions.find(e => e.id === editionId);
                              const items = selectedLines.filter(l => l.editionId === editionId);
                              if (!edition) return null;

                              return (
                                <div key={editionId} className="bg-white border rounded-lg p-4 shadow-sm border-l-4 border-l-blue-500">
                                  <div className="flex gap-4 justify-between items-center mb-4 pb-3 border-b">
                                     <div className="flex gap-3 items-center flex-wrap">
                                        <div className="flex items-center gap-1 bg-white border rounded px-2 py-1 shadow-inner"><Hash size={14} className="text-gray-400"/><input className="bg-transparent border-none text-sm font-bold w-32 focus:outline-none" value={edition.runId} onChange={e => updateEditionDetails(editionId, 'runId', e.target.value)}/></div>
                                        <div className="flex items-center gap-2 bg-white border rounded px-2 py-1 shadow-inner">
                                            <Calendar size={14} className="text-gray-400"/>
                                            <input type="date" className="text-xs border-none focus:outline-none" value={edition.startDate} onChange={e => updateEditionDetails(editionId, 'startDate', e.target.value)}/>
                                            <span className="text-gray-300">-</span>
                                            <input type="date" className="text-xs border-none focus:outline-none" value={edition.endDate} onChange={e => updateEditionDetails(editionId, 'endDate', e.target.value)}/>
                                        </div>
                                     </div>
                                     <div className="flex items-center gap-3">
                                        {allowCatalogManagement && (
                                            <>
                                              <button onClick={() => setCloneEditionForm({sourceId: editionId, newRunId: '', newStartDate: '', newEndDate: ''})} className="text-blue-600 text-xs flex items-center gap-1 font-bold bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors"><Copy size={14}/> Clona</button>
                                              {cloneEditionForm?.sourceId === editionId && (
                                                   <div className="absolute z-20 mt-8 bg-white border shadow-xl rounded-lg p-4 w-72 right-10 animate-in slide-in-from-top-2">
                                                      <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Nuovo Run ID</label>
                                                      <input className="w-full border p-2 text-xs rounded mb-3" placeholder="Nuovo Run ID" value={cloneEditionForm.newRunId} onChange={e => setCloneEditionForm({...cloneEditionForm, newRunId: e.target.value})}/>
                                                      <div className="flex gap-2">
                                                          <button onClick={() => setCloneEditionForm(null)} className="flex-1 text-xs border rounded p-2">Annulla</button>
                                                          <button onClick={executeCloneEdition} className="flex-1 text-xs bg-blue-600 text-white rounded p-2 font-bold shadow-md">Conferma</button>
                                                      </div>
                                                   </div>
                                              )}
                                              <button onClick={() => removeEditionFromOrder(editionId)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={16}/></button>
                                            </>
                                        )}
                                     </div>
                                  </div>
                                  
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold">
                                      <tr>
                                          <th className="text-left py-2 pl-2">Voce Servizio</th>
                                          <th className="text-left py-2 w-28">P. Unitario</th>
                                          <th className="text-left py-2 w-20">Q. Pian.</th>
                                          {mode === 'reconciliation' && <th className="text-left py-2 w-20">Q. Eff.</th>}
                                          <th className="text-right py-2 w-24 pr-2">Totale</th>
                                          {allowCatalogManagement && <th className="w-10"></th>}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {items.map(item => {
                                         const srv = data.services.find(s => s.id === item.serviceItemId);
                                         const lineTotal = mode === 'workflow' ? (item.plannedQty * item.unitPriceOverride) : (item.actualQty * item.unitPriceOverride);
                                         return (
                                           <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                             <td className="py-2 pr-2">
                                               {allowCatalogManagement ? (
                                                  <select className="w-full border rounded p-1 text-sm bg-white" value={item.serviceItemId} onChange={(e) => handleServiceSelect(item.id, e.target.value)}>
                                                    <option value="">-- Seleziona Voce Catalogo --</option>
                                                    {availableServicesForEdition.map(s => (<option key={s.id} value={s.id}>{s.name} {s.courseId ? `[Spec]` : ''} - € {s.unitPrice}</option>))}
                                                  </select>
                                               ) : <span className="font-medium text-gray-700">{srv?.name}</span>}
                                             </td>
                                             <td className="py-2">
                                                 {allowCatalogManagement ? <input type="number" className="w-24 border rounded p-1 text-sm bg-white" value={item.unitPriceOverride} onChange={e => updateLineItem(item.id, 'unitPriceOverride', Number(e.target.value))}/> : <span className="font-mono">€ {item.unitPriceOverride.toLocaleString()}</span>}
                                             </td>
                                             <td className="py-2">
                                                 {allowCatalogManagement ? <input type="number" className="w-16 border rounded p-1 text-sm bg-white" value={item.plannedQty} onChange={e => updateLineItem(item.id, 'plannedQty', Number(e.target.value))}/> : <span className="font-semibold">{item.plannedQty}</span>}
                                             </td>
                                             {mode === 'reconciliation' && <td className="py-2"><input type="number" className="w-16 border-green-300 border bg-green-50 rounded p-1 text-sm font-bold text-green-700 focus:ring-1 focus:ring-green-500" value={item.actualQty} onChange={e => updateLineItem(item.id, 'actualQty', Number(e.target.value))}/></td>}
                                             <td className="py-2 text-right pr-2 font-mono font-bold">€ {lineTotal.toLocaleString()}</td>
                                             <td className="py-2 text-center">{allowCatalogManagement && <button onClick={() => removeLineItem(item.id)} className="text-red-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>}</td>
                                           </tr>
                                         )
                                      })}
                                    </tbody>
                                  </table>
                                  {allowCatalogManagement && <button onClick={() => addLineItem(editionId)} className="mt-3 text-[11px] text-blue-600 flex items-center gap-1 font-bold hover:underline"><Plus size={12}/> Aggiungi Voce</button>}
                                </div>
                              );
                           })}
                           {allowCatalogManagement && (
                              <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg mt-4 flex flex-col sm:flex-row gap-4 items-end shadow-inner">
                                    <div className="flex-1 w-full"><label className="text-[10px] font-bold text-indigo-700 uppercase">Nuova Edizione - Run ID</label><input className="w-full text-xs border border-indigo-200 p-2 rounded bg-white shadow-sm" placeholder="Es. RUN-001" value={newEditionForm.courseId === courseId ? newEditionForm.runId : ''} onChange={e => setNewEditionForm({...newEditionForm, courseId, runId: e.target.value})}/></div>
                                    <div className="w-full sm:w-36"><label className="text-[10px] font-bold text-indigo-700 uppercase">Inizio</label><input type="date" className="w-full text-xs border border-indigo-200 p-2 rounded bg-white shadow-sm" value={newEditionForm.courseId === courseId ? newEditionForm.startDate : ''} onChange={e => setNewEditionForm({...newEditionForm, courseId, startDate: e.target.value})}/></div>
                                    <div className="w-full sm:w-36"><label className="text-[10px] font-bold text-indigo-700 uppercase">Fine</label><input type="date" className="w-full text-xs border border-indigo-200 p-2 rounded bg-white shadow-sm" value={newEditionForm.courseId === courseId ? newEditionForm.endDate : ''} onChange={e => setNewEditionForm({...newEditionForm, courseId, endDate: e.target.value})}/></div>
                                    <button onClick={createEditionForCourse} disabled={newEditionForm.courseId !== courseId} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded text-xs h-[38px] font-bold shadow-md transition-all disabled:opacity-50">Aggiungi Edizione</button>
                              </div>
                           )}
                        </div>
                      </div>
                    );
                  })}
               </div>
               
               {allowCatalogManagement && (
                   <div className="mt-6 bg-white p-6 rounded-xl border border-dashed border-gray-300 flex flex-col md:flex-row items-center gap-4 shadow-sm">
                      <div className="flex-1 w-full">
                          <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Associa Nuovo Corso all'Ordine</label>
                          <select className="w-full p-2 border rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors" value={courseToAdd} onChange={(e) => setCourseToAdd(e.target.value)}>
                            <option value="">-- Seleziona un corso dal catalogo del fornitore --</option>
                            {availableCourses.filter(c => !activeCourseIds.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.title} {c.sifCode ? `[${c.sifCode}]` : ''}</option>)}
                          </select>
                      </div>
                      <button onClick={addCourseToOrder} disabled={!courseToAdd} className="w-full md:w-auto bg-primary hover:bg-black text-white px-8 py-2 rounded-lg flex items-center justify-center gap-2 font-bold shadow-lg transition-all disabled:opacity-50">
                          <Plus size={18}/> Aggiungi Corso
                      </button>
                   </div>
               )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-10 pt-6 border-t">
          <button onClick={() => setEditingOrder(null)} className="px-8 py-2 border rounded-lg font-bold hover:bg-gray-50 transition-colors">Annulla</button>
          <button onClick={handleSaveOrder} className="px-8 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-lg flex items-center gap-2 hover:bg-blue-700 transition-all"><Save size={18} /> Salva Scheda</button>
        </div>
      </div>
    );
  }

  // List View (Filtered Orders)
  const filteredOrders = data.orders.filter(o => {
        const supplierName = data.suppliers.find(s => s.id === o.supplierId)?.name || '';
        const search = searchTerm.toLowerCase();
        const matchesSearch = o.title.toLowerCase().includes(search) || supplierName.toLowerCase().includes(search);
        const matchesStatus = statusFilter === 'ALL' ? true : statusFilter === 'ACTIVE' ? o.status !== WorkflowStatus.CLOSED : o.status === statusFilter;
        const matchesSupplier = supplierFilter === '' ? true : o.supplierId === supplierFilter;
        return matchesSearch && matchesStatus && matchesSupplier;
    }).sort((a, b) => sortOrder === 'asc' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">{mode === 'workflow' ? 'Workflow Acquisti' : 'Consuntivazione & Chiusura'}</h2>
        <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input className="pl-10 pr-4 py-2 border rounded-lg w-full text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Cerca titolo o fornitore..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
            </div>
            
            <div className="flex items-center gap-2 bg-white border px-3 rounded-lg shadow-sm">
                <Users size={16} className="text-gray-400"/>
                <select className="text-sm outline-none border-none py-2 font-medium bg-transparent max-w-[150px]" value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
                    <option value="">Tutti i Fornitori</option>
                    {data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            <div className="flex items-center gap-2 bg-white border px-3 rounded-lg shadow-sm">
                <Filter size={16} className="text-gray-400"/>
                <select className="text-sm outline-none border-none py-2 font-medium bg-transparent" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="ACTIVE">Schede Attive</option>
                    <option value="ALL">Tutte le Schede</option>
                    <option value={WorkflowStatus.CLOSED}>Solo Chiuse</option>
                </select>
            </div>
            {mode === 'workflow' && <button onClick={handleCreateOrder} className="bg-primary hover:bg-black text-white px-6 py-2 rounded-lg flex items-center justify-center gap-2 font-bold shadow-md transition-all"><Plus size={20} /> Nuova Scheda</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOrders.length === 0 ? (
            <div className="col-span-full py-20 text-center text-gray-400 italic bg-white rounded-xl border-2 border-dashed">Nessuna scheda acquisto trovata per i criteri selezionati.</div>
        ) : filteredOrders.map(order => {
          const supplier = data.suppliers.find(s => s.id === order.supplierId);
          const totalPlan = order.items.reduce((sum, i) => sum + i.plannedCost, 0);
          const totalActual = order.items.reduce((sum, i) => sum + i.actualCost, 0);
          const emCount = (order.ems || []).length;

          return (
            <div key={order.id} className="bg-white p-5 rounded-xl shadow-sm border hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden">
              {order.isGeneric && <div className="absolute top-0 right-0 bg-amber-500 text-white text-[8px] font-bold px-4 py-1 rotate-45 translate-x-3 -translate-y-1 shadow-sm uppercase tracking-tighter">Generica</div>}
              
              <div>
                <div className="flex justify-between items-start mb-2">
                   <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${order.status === WorkflowStatus.CLOSED ? 'bg-gray-100 text-gray-600' : order.status === WorkflowStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                      {order.status}
                   </span>
                   <span className="text-[10px] text-gray-400 font-mono">{order.createdAt}</span>
                </div>
                <h3 className="text-lg font-bold text-gray-800 line-clamp-1 group-hover:text-blue-600 transition-colors">{order.title}</h3>
                <p className="text-xs text-gray-500 font-semibold mb-4 uppercase tracking-tight flex items-center gap-1"><Users size={12}/> {supplier?.name || 'Fornitore non assegnato'}</p>
                
                <div className="grid grid-cols-2 gap-2 mt-auto mb-4 border-t pt-4">
                   <div className="flex flex-col">
                      <span className="text-[10px] text-gray-400 font-bold uppercase">Pianificato</span>
                      <span className="font-bold text-blue-600">€ {totalPlan.toLocaleString()}</span>
                   </div>
                   <div className="flex flex-col border-l pl-3">
                      <span className="text-[10px] text-gray-400 font-bold uppercase">Consuntivato</span>
                      <span className={`font-bold ${totalActual > 0 ? 'text-green-600' : 'text-gray-300'}`}>€ {totalActual.toLocaleString()}</span>
                   </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2 pt-3 border-t">
                <div className="flex items-center gap-2">
                   {emCount > 0 && <span className="text-[10px] bg-green-50 text-green-600 px-2 py-1 rounded-md border border-green-200 font-bold flex items-center gap-1"><Layers size={10}/> {emCount} EM</span>}
                   {order.riaCode && <span className="text-[10px] bg-gray-50 text-gray-500 px-2 py-1 rounded-md border border-gray-200 font-mono">{order.riaCode}</span>}
                </div>
                <div className="flex gap-1">
                   {mode === 'workflow' && <button onClick={() => handleDeleteOrder(order.id)} className="text-gray-400 hover:text-red-500 p-2 transition-colors"><Trash2 size={16}/></button>}
                   <button onClick={() => handleEditOrder(order)} className="bg-gray-100 hover:bg-blue-600 hover:text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all"><Edit size={14}/> {mode === 'reconciliation' ? 'Consuntiva' : 'Gestisci'}</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
