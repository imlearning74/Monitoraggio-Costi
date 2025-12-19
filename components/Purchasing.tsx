
import React, { useState } from 'react';
import { AppData, PurchaseOrder, PurchaseLineItem, WorkflowStatus, RiaStatus, CourseEdition, PurchaseEm } from '../types';
import { Plus, Trash2, Edit, Save, Copy, ChevronDown, ChevronRight, AlertCircle, Package, Calculator, Calendar, Hash, FileText, X, Search, CheckSquare, Square, DollarSign, Filter, BookOpen } from 'lucide-react';
import { api } from '../services/apiService';

interface PurchasingProps {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  mode: 'workflow' | 'reconciliation';
}

// ... (Interfaces remain the same)
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
  
  const [selectedLines, setSelectedLines] = useState<PurchaseLineItem[]>([]);
  const [activeCourseIds, setActiveCourseIds] = useState<string[]>([]);
  const [activeEditionIds, setActiveEditionIds] = useState<string[]>([]);
  
  const [courseToAdd, setCourseToAdd] = useState<string>('');
  const [newEditionForm, setNewEditionForm] = useState<NewEditionForm>({courseId: '', runId: '', lmsLessonId: '', startDate: '', endDate: ''});
  const [cloneEditionForm, setCloneEditionForm] = useState<CloneEditionForm | null>(null);
  
  const [newEmCode, setNewEmCode] = useState('');
  const [newEmAmount, setNewEmAmount] = useState('');
  const [newEmSelectedEditions, setNewEmSelectedEditions] = useState<string[]>([]);

  const handleCreateOrder = () => {
    const newOrder: PurchaseOrder = {
      id: crypto.randomUUID(),
      supplierId: '',
      title: 'Nuova Scheda Acquisto',
      createdAt: new Date().toISOString().split('T')[0],
      status: WorkflowStatus.DRAFT,
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
          // API SYNC
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

    const finalOrder = {
      ...editingOrder,
      items: updatedItems
    } as PurchaseOrder;

    // Optimistic Update
    setData(prev => {
      const exists = prev.orders.find(o => o.id === finalOrder.id);
      if (exists) {
        return { ...prev, orders: prev.orders.map(o => o.id === finalOrder.id ? finalOrder : o) };
      }
      return { ...prev, orders: [...prev.orders, finalOrder] };
    });

    // API SYNC
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
    if (mode === 'reconciliation') return;
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
    
    // API SYNC: Save edition immediately (or wait for order save? Better immediately as it is a reference)
    await api.mutate('UPSERT_EDITION', newEdition);

    setActiveEditionIds(prev => [...prev, newEdition.id]);
    setNewEditionForm({courseId: '', runId: '', lmsLessonId: '', startDate: '', endDate: ''});
  };

  const updateEditionDetails = async (editionId: string, field: keyof CourseEdition, value: string) => {
      // Local update
      setData(prev => ({
          ...prev,
          editions: prev.editions.map(e => {
              if (e.id === editionId) {
                 const updated = { ...e, [field]: value };
                 // API SYNC (Debounce in real world, direct here)
                 api.mutate('UPSERT_EDITION', updated); 
                 return updated;
              }
              return e;
          })
      }));
  };

  const removeEditionFromOrder = (editionId: string) => {
    if (mode === 'reconciliation') return;
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
    // API SYNC
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

  // ... (Lines and EMs logic remains local until "Save Order" is clicked) ...
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
      if (!newEmCode || !newEmAmount) return;
      const newEm: PurchaseEm = {
          id: crypto.randomUUID(),
          code: newEmCode,
          amount: parseFloat(newEmAmount),
          editionIds: newEmSelectedEditions
      };
      setEditingOrder(prev => prev ? ({ ...prev, ems: [...(prev.ems || []), newEm] }) : null);
      setNewEmCode(''); setNewEmAmount(''); setNewEmSelectedEditions([]);
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

  // ... (Rendering logic remains virtually identical, just ensuring handlers are wired)
  if (editingOrder) {
    const currentSupplier = data.suppliers.find(s => s.id === editingOrder.supplierId);
    const availableCourses = data.courses.filter(c => c.supplierId === editingOrder.supplierId);
    const genericServices = data.services.filter(s => s.supplierId === editingOrder.supplierId && !s.courseId);

    const grandTotalPlanned = calculateTotal(selectedLines, 'planned');
    const grandTotalActual = calculateTotal(selectedLines, 'actual');
    const grandTotalEM = (editingOrder.ems || []).reduce((sum, em) => sum + em.amount, 0);

    return (
      <div className="bg-white p-6 rounded-lg shadow-lg animate-fade-in">
        <div className="flex justify-between items-start mb-6 border-b pb-4">
           <div>
             <h2 className="text-2xl font-bold text-gray-800">{editingOrder.id ? (mode === 'reconciliation' ? 'Consuntivazione' : 'Modifica Scheda') : 'Nuova Scheda Acquisto'}</h2>
           </div>
           <div className="text-right">
             <div className="text-sm text-gray-500">Totale Scheda</div>
             <div className="text-3xl font-bold text-blue-600">€ {grandTotalPlanned.toLocaleString()}</div>
           </div>
        </div>
        
        {/* (Form Fields remain same) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 bg-gray-50 p-4 rounded-lg">
          {/* ... Inputs for Title, Supplier, Codes ... */}
          <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Titolo Scheda</label>
                <input type="text" className="w-full border border-gray-300 rounded-md p-2" value={editingOrder.title} onChange={e => setEditingOrder({...editingOrder, title: e.target.value})}/>
            </div>
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Fornitore</label>
                <select className="w-full border border-gray-300 rounded-md p-2 disabled:bg-gray-200" value={editingOrder.supplierId} onChange={e => handleSupplierChange(e.target.value)} disabled={mode === 'reconciliation'}>
                  <option value="">-- Seleziona Fornitore --</option>
                  {data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>
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

        {!editingOrder.supplierId ? <div className="bg-yellow-50 p-6 text-center text-yellow-700">Seleziona un fornitore.</div> : (
          <div className="space-y-8">
            {mode === 'reconciliation' && (
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                    {/* (EM Management UI) */}
                    <h3 className="text-lg font-bold text-green-800 mb-4 flex items-center gap-2"><Package size={20}/> Gestione Entrate Merci (EM)</h3>
                    <div className="space-y-3 mb-4">
                        {(editingOrder.ems || []).map(em => {
                            const linkedCost = selectedLines.filter(l => em.editionIds.includes(l.editionId)).reduce((acc, l) => acc + (l.actualQty * l.unitPriceOverride), 0);
                            return (
                                <div key={em.id} className="bg-white p-3 rounded border shadow-sm flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-green-100 text-green-800 px-2 py-1 rounded font-bold text-sm">{em.code}</div>
                                        <div className="text-sm">Importo: <b>€ {em.amount}</b></div>
                                    </div>
                                    <button onClick={() => handleRemoveEm(em.id)} className="text-red-500"><Trash2 size={16}/></button>
                                </div>
                            );
                        })}
                    </div>
                    {/* New EM Form */}
                    <div className="bg-white p-3 rounded border border-green-300">
                        <div className="flex gap-2 mb-2">
                            <input className="border p-2 rounded text-sm flex-1" placeholder="Codice EM" value={newEmCode} onChange={e => setNewEmCode(e.target.value)}/>
                            <input type="number" className="border p-2 rounded text-sm w-full" placeholder="Importo" value={newEmAmount} onChange={e => setNewEmAmount(e.target.value)}/>
                        </div>
                        <div className="mb-2 grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">{activeEditionIds.map(eid => (<label key={eid} className="flex gap-2 text-xs"><input type="checkbox" checked={newEmSelectedEditions.includes(eid)} onChange={() => toggleEditionForEm(eid)}/>{data.editions.find(e => e.id===eid)?.runId}</label>))}</div>
                        <button onClick={handleAddEm} disabled={!newEmCode || !newEmAmount} className="w-full bg-green-600 text-white py-2 rounded text-sm font-bold">Aggiungi EM</button>
                    </div>
                </div>
            )}
            
            {/* Courses / Editions / Lines UI (Simplified for brevity as logic is same) */}
            <div>
               <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Package size={20}/> Struttura Ordine</h3>
               <div className="space-y-6">
                  {activeCourseIds.map(courseId => {
                    const course = data.courses.find(c => c.id === courseId);
                    const editionsForThisCourse = activeEditionIds.filter(eid => data.editions.find(e => e.id === eid)?.courseId === courseId);
                    const courseSpecificServices = data.services.filter(s => s.supplierId === editingOrder.supplierId && s.courseId === courseId);
                    const availableServicesForEdition = [...genericServices, ...courseSpecificServices];
                    const courseTotal = calculateTotal(selectedLines.filter(l => editionsForThisCourse.includes(l.editionId)), 'planned');

                    return (
                      <div key={courseId} className="border border-gray-300 rounded-xl overflow-hidden bg-white">
                        <div className="bg-gray-100 p-4 flex justify-between items-center border-b">
                          <h4 className="font-bold text-lg">{course?.title}</h4>
                          <div className="flex items-center gap-4">
                            <span className="font-bold text-indigo-700">€ {courseTotal.toLocaleString()}</span>
                            {mode === 'workflow' && <button onClick={() => removeCourseFromOrder(courseId)} className="text-red-500"><Trash2 size={18} /></button>}
                          </div>
                        </div>

                        <div className="p-4 bg-gray-50 space-y-4">
                           {editionsForThisCourse.map(editionId => {
                              const edition = data.editions.find(e => e.id === editionId);
                              const items = selectedLines.filter(l => l.editionId === editionId);
                              if (!edition) return null;

                              return (
                                <div key={editionId} className="bg-white border rounded-lg p-4 shadow-sm">
                                  <div className="flex gap-4 justify-between items-center mb-4 pb-3 border-b">
                                     <div className="flex gap-3 items-center">
                                        <div className="flex items-center gap-1 bg-gray-50 border rounded p-1"><Hash size={14}/><input className="bg-transparent border-none text-sm font-bold w-32" value={edition.runId} onChange={e => updateEditionDetails(editionId, 'runId', e.target.value)}/></div>
                                        <div className="flex items-center gap-2"><input type="date" className="text-xs border rounded p-1" value={edition.startDate} onChange={e => updateEditionDetails(editionId, 'startDate', e.target.value)}/><input type="date" className="text-xs border rounded p-1" value={edition.endDate} onChange={e => updateEditionDetails(editionId, 'endDate', e.target.value)}/></div>
                                     </div>
                                     <div className="flex items-center gap-3">
                                        {mode === 'workflow' && (
                                            <>
                                              <button onClick={() => setCloneEditionForm({sourceId: editionId, newRunId: '', newStartDate: '', newEndDate: ''})} className="text-blue-600 text-xs flex gap-1"><Copy size={14}/> Clona</button>
                                              {cloneEditionForm?.sourceId === editionId && (
                                                   <div className="absolute z-20 mt-8 bg-white border shadow-xl rounded-lg p-4 w-72 right-10">
                                                      <input className="w-full border p-1 text-xs rounded mb-2" placeholder="Nuovo Run ID" value={cloneEditionForm.newRunId} onChange={e => setCloneEditionForm({...cloneEditionForm, newRunId: e.target.value})}/>
                                                      <button onClick={executeCloneEdition} className="w-full text-xs bg-blue-600 text-white rounded p-1 font-bold">Conferma</button>
                                                   </div>
                                              )}
                                              <button onClick={() => removeEditionFromOrder(editionId)} className="text-red-400"><Trash2 size={16}/></button>
                                            </>
                                        )}
                                     </div>
                                  </div>
                                  
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-500">
                                      <tr><th className="text-left py-1">Voce</th><th className="text-left py-1 w-28">Prezzo</th><th className="text-left py-1 w-20">Q.Prev</th>{mode === 'reconciliation' && <th className="text-left py-1 w-20">Q.Eff</th>}<th className="text-left py-1 w-24">Tot</th><th></th></tr>
                                    </thead>
                                    <tbody>
                                      {items.map(item => {
                                         const srv = data.services.find(s => s.id === item.serviceItemId);
                                         const lineTotal = mode === 'workflow' ? (item.plannedQty * item.unitPriceOverride) : (item.actualQty * item.unitPriceOverride);
                                         return (
                                           <tr key={item.id} className="border-b last:border-0">
                                             <td className="py-2 pr-2">
                                               {mode === 'workflow' ? (
                                                  <select className="w-full border rounded p-1 text-sm" value={item.serviceItemId} onChange={(e) => handleServiceSelect(item.id, e.target.value)}>
                                                    <option value="">-- Seleziona --</option>
                                                    {availableServicesForEdition.map(s => (<option key={s.id} value={s.id}>{s.name} {s.courseId ? `[Spec]` : ''} - €{s.unitPrice}</option>))}
                                                  </select>
                                               ) : <span>{srv?.name}</span>}
                                             </td>
                                             <td className="py-2">{mode === 'workflow' ? <input type="number" className="w-20 border rounded p-1" value={item.unitPriceOverride} onChange={e => updateLineItem(item.id, 'unitPriceOverride', Number(e.target.value))}/> : <span>€ {item.unitPriceOverride}</span>}</td>
                                             <td className="py-2">{mode === 'workflow' ? <input type="number" className="w-16 border rounded p-1" value={item.plannedQty} onChange={e => updateLineItem(item.id, 'plannedQty', Number(e.target.value))}/> : item.plannedQty}</td>
                                             {mode === 'reconciliation' && <td className="py-2"><input type="number" className="w-16 border-green-300 border rounded p-1" value={item.actualQty} onChange={e => updateLineItem(item.id, 'actualQty', Number(e.target.value))}/></td>}
                                             <td className="py-2">€ {lineTotal.toLocaleString()}</td>
                                             <td className="py-2">{mode === 'workflow' && <button onClick={() => removeLineItem(item.id)} className="text-red-400"><Trash2 size={14}/></button>}</td>
                                           </tr>
                                         )
                                      })}
                                    </tbody>
                                  </table>
                                  {mode === 'workflow' && <button onClick={() => addLineItem(editionId)} className="mt-2 text-xs text-blue-600 flex gap-1"><Plus size={12}/> Aggiungi Voce</button>}
                                </div>
                              );
                           })}
                           {mode === 'workflow' && (
                              <div className="bg-green-50 border border-green-200 p-3 rounded-lg mt-4 flex gap-2 items-end">
                                    <div className="w-24"><label className="text-[10px] font-bold">Run ID</label><input className="w-full text-xs border p-1 rounded" value={newEditionForm.courseId === courseId ? newEditionForm.runId : ''} onChange={e => setNewEditionForm({...newEditionForm, courseId, runId: e.target.value})}/></div>
                                    <div className="w-32"><label className="text-[10px] font-bold">Inizio</label><input type="date" className="w-full text-xs border p-1 rounded" value={newEditionForm.courseId === courseId ? newEditionForm.startDate : ''} onChange={e => setNewEditionForm({...newEditionForm, courseId, startDate: e.target.value})}/></div>
                                    <div className="w-32"><label className="text-[10px] font-bold">Fine</label><input type="date" className="w-full text-xs border p-1 rounded" value={newEditionForm.courseId === courseId ? newEditionForm.endDate : ''} onChange={e => setNewEditionForm({...newEditionForm, courseId, endDate: e.target.value})}/></div>
                                    <button onClick={createEditionForCourse} disabled={newEditionForm.courseId !== courseId} className="bg-green-600 text-white px-3 py-1 rounded text-xs h-[26px] font-bold">Crea</button>
                              </div>
                           )}
                        </div>
                      </div>
                    );
                  })}
               </div>
               
               {mode === 'workflow' && (
                   <div className="mt-6 bg-indigo-50 p-4 rounded-lg flex items-center gap-4">
                      <select className="flex-grow p-2 border rounded text-sm" value={courseToAdd} onChange={(e) => setCourseToAdd(e.target.value)}>
                        <option value="">-- Seleziona Corso --</option>
                        {availableCourses.filter(c => !activeCourseIds.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                      <button onClick={addCourseToOrder} disabled={!courseToAdd} className="bg-indigo-600 text-white px-4 py-2 rounded flex gap-2"><Plus size={18}/> Aggiungi</button>
                   </div>
               )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-8 pt-4 border-t">
          <button onClick={() => setEditingOrder(null)} className="px-6 py-2 border rounded">Annulla</button>
          <button onClick={handleSaveOrder} className="px-6 py-2 bg-blue-600 text-white rounded font-bold shadow-lg flex items-center gap-2"><Save size={18} /> Salva Scheda</button>
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
        return matchesSearch && matchesStatus;
    }).sort((a, b) => sortOrder === 'asc' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ... List Header and Grid ... */}
      <div className="flex justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">{mode === 'workflow' ? 'Gestione Ordini' : 'Consuntivazione'}</h2>
        <div className="flex gap-3">
            <div className="relative"><Search className="absolute left-2 top-2.5 text-gray-400" size={16} /><input className="pl-8 pr-4 py-2 border rounded-lg" placeholder="Cerca..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
            <select className="border text-sm rounded px-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="ACTIVE">Attive</option><option value="ALL">Tutte</option><option value={WorkflowStatus.CLOSED}>Chiuse</option></select>
            {mode === 'workflow' && <button onClick={handleCreateOrder} className="bg-primary text-white px-4 py-2 rounded-lg flex gap-2"><Plus size={20} /> Nuova</button>}
        </div>
      </div>

      <div className="grid gap-4">
        {filteredOrders.map(order => {
          const supplier = data.suppliers.find(s => s.id === order.supplierId);
          const totalPlan = order.items.reduce((sum, i) => sum + i.plannedCost, 0);
          const totalActual = order.items.reduce((sum, i) => sum + i.actualCost, 0);
          return (
            <div key={order.id} className="bg-white p-5 rounded-lg shadow border-l-4 border-accent">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold flex gap-2">{order.title} <span className="text-xs px-2 py-0.5 rounded bg-gray-200">{order.status}</span></h3>
                  <p className="text-sm text-gray-500">{supplier?.name}</p>
                </div>
                <div className="text-right">
                  <div className="font-bold text-xl text-blue-600">€ {totalPlan.toLocaleString()}</div>
                  {mode === 'reconciliation' && <div className="text-green-700 font-bold">€ {totalActual.toLocaleString()}</div>}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t flex justify-end gap-2">
                {mode === 'workflow' && <button onClick={() => handleDeleteOrder(order.id)} className="text-red-500 p-2"><Trash2 size={16}/></button>}
                <button onClick={() => handleEditOrder(order)} className="bg-gray-100 px-4 py-2 rounded text-sm font-bold flex gap-2"><Edit size={16}/> {mode === 'reconciliation' ? 'Consuntiva' : 'Modifica'}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
