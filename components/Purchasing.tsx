
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppData, PurchaseOrder, PurchaseLineItem, WorkflowStatus, RiaStatus, CourseEdition, PurchaseEm } from '../types';
import { Plus, Trash2, Save, Package, Calendar, Hash, X, Search, BookOpen, Users, ArrowUpDown, CheckSquare, Square, ClipboardCheck, Activity, CloudCheck, CloudUpload, AlertCircle, Loader2, Calculator } from 'lucide-react';
import { api } from '../services/apiService';

interface PurchasingProps {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  mode: 'workflow' | 'reconciliation';
}

type SaveStatus = 'saved' | 'saving' | 'error' | 'idle';

export const Purchasing: React.FC<PurchasingProps> = ({ data, setData, mode }) => {
  const [editingOrder, setEditingOrder] = useState<Partial<PurchaseOrder> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  
  const [sortField, setSortField] = useState<'createdAt' | 'title' | 'amount'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  const [selectedLines, setSelectedLines] = useState<PurchaseLineItem[]>([]);
  const [activeCourseIds, setActiveCourseIds] = useState<string[]>([]);
  const [activeEditionIds, setActiveEditionIds] = useState<string[]>([]);
  
  const [courseToAdd, setCourseToAdd] = useState<string>('');
  const [newEmCode, setNewEmCode] = useState('');
  const [newEmSelectedEditions, setNewEmSelectedEditions] = useState<string[]>([]);

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to construct the full order object for saving
  const getFullOrderForSave = useCallback((order: Partial<PurchaseOrder>, lines: PurchaseLineItem[]) => {
    const itemsTotalPlanned = lines.reduce((acc, item) => acc + (item.plannedQty * (item.unitPriceOverride || 0)), 0);
    const itemsTotalActual = lines.reduce((acc, item) => acc + (item.actualQty * (item.unitPriceOverride || 0)), 0);

    const updatedItems = lines.map(line => ({
      ...line,
      plannedCost: line.plannedQty * line.unitPriceOverride,
      actualCost: line.actualQty * line.unitPriceOverride
    }));

    const updatedEms = (order.ems || []).map(em => {
        const calculatedAmount = updatedItems
            .filter(l => em.editionIds.includes(l.editionId))
            .reduce((acc, l) => acc + (l.actualQty * l.unitPriceOverride), 0);
        return { ...em, amount: calculatedAmount };
    });

    let finalActualAmount = order.actualAmount || 0;
    if (order.isGeneric && updatedEms.length > 0) {
        finalActualAmount = updatedEms.reduce((acc, em) => acc + em.amount, 0);
    }

    return {
      ...order,
      ems: updatedEms,
      items: updatedItems,
      actualAmount: finalActualAmount,
      plannedAmount: order.isGeneric ? (order.plannedAmount || 0) : itemsTotalPlanned
    } as PurchaseOrder;
  }, []);

  // Debounced save function
  const triggerAutoSave = useCallback((order: Partial<PurchaseOrder>, lines: PurchaseLineItem[]) => {
    if (!order.id || !order.supplierId) return;

    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const fullOrder = getFullOrderForSave(order, lines);
        
        // Update local state first to keep UI snappy
        setData(prev => ({
          ...prev,
          orders: prev.orders.map(o => o.id === fullOrder.id ? fullOrder : o)
        }));

        await api.mutate('UPSERT_ORDER', fullOrder);
        setSaveStatus('saved');
      } catch (error) {
        console.error("Auto-save failed:", error);
        setSaveStatus('error');
      }
    }, 1000); // 1 second debounce
  }, [setData, getFullOrderForSave]);

  const handleCreateOrder = async () => {
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
    setSaveStatus('idle');
  };

  const handleEditOrder = (order: PurchaseOrder) => {
    setEditingOrder({ ...order });
    setSelectedLines([...(order.items || [])]);
    
    const editionIds = [...new Set((order.items || []).map(i => i.editionId))];
    const courseIds = [...new Set(editionIds.map(eid => {
      const ed = data.editions.find(e => e.id === eid);
      return ed ? ed.courseId : '';
    }).filter(id => id !== ''))];

    setActiveEditionIds(editionIds);
    setActiveCourseIds(courseIds);
    setSaveStatus('saved');
  };

  const handleSupplierChange = (supplierId: string) => {
    if (!editingOrder) return;
    const updated = { ...editingOrder, supplierId };
    setEditingOrder(updated);
    setSelectedLines([]);
    setActiveCourseIds([]);
    setActiveEditionIds([]);
    
    if (supplierId) {
        const full = getFullOrderForSave(updated, []);
        setData(prev => ({...prev, orders: [...prev.orders, full]}));
        api.mutate('UPSERT_ORDER', full);
        setSaveStatus('saved');
    }
  };

  const updateOrderField = (field: keyof PurchaseOrder, value: any) => {
    if (!editingOrder) return;
    const updated = { ...editingOrder, [field]: value };
    setEditingOrder(updated);
    triggerAutoSave(updated, selectedLines);
  };

  const handleSaveOrderManual = async () => {
    if (!editingOrder || !editingOrder.id) return;
    if (!editingOrder.supplierId) {
      alert("Seleziona un fornitore prima di salvare.");
      return;
    }
    
    setSaveStatus('saving');
    const finalOrder = getFullOrderForSave(editingOrder, selectedLines);

    setData(prev => {
      const exists = prev.orders.find(o => o.id === finalOrder.id);
      return { ...prev, orders: exists ? prev.orders.map(o => o.id === finalOrder.id ? finalOrder : o) : [...prev.orders, finalOrder] };
    });

    await api.mutate('UPSERT_ORDER', finalOrder);
    setSaveStatus('saved');
    setEditingOrder(null);
  };

  const updateEditionDetails = async (editionId: string, field: keyof CourseEdition, value: string) => {
      setData(prev => {
          const updatedEditions = prev.editions.map(e => (e.id === editionId ? { ...e, [field]: value } : e));
          const updatedEd = updatedEditions.find(e => e.id === editionId);
          if (updatedEd) api.mutate('UPSERT_EDITION', updatedEd);
          return { ...prev, editions: updatedEditions };
      });
  };

  const addLineItem = (editionId: string) => {
    const newItem: PurchaseLineItem = {
      id: crypto.randomUUID(),
      editionId,
      serviceItemId: '',
      plannedQty: mode === 'reconciliation' ? 0 : 1,
      actualQty: mode === 'reconciliation' ? 1 : 0,
      unitPriceOverride: 0,
      plannedCost: 0,
      actualCost: 0
    };
    const updatedLines = [...selectedLines, newItem];
    setSelectedLines(updatedLines);
    if (editingOrder) triggerAutoSave(editingOrder, updatedLines);
  };

  const updateLineItem = (id: string, field: keyof PurchaseLineItem, value: any) => {
    const updatedLines = selectedLines.map(item => item.id === id ? { ...item, [field]: value } : item);
    setSelectedLines(updatedLines);
    if (editingOrder) triggerAutoSave(editingOrder, updatedLines);
  };

  const removeLineItem = (id: string) => {
    const updatedLines = selectedLines.filter(item => item.id !== id);
    setSelectedLines(updatedLines);
    if (editingOrder) triggerAutoSave(editingOrder, updatedLines);
  };

  const handleAddEm = () => {
      if (!newEmCode) {
          alert("Inserisci un codice EM");
          return;
      }
      if (newEmSelectedEditions.length === 0) {
          alert("Seleziona almeno un'edizione da associare all'EM");
          return;
      }
      
      const calculatedAmount = selectedLines
        .filter(l => newEmSelectedEditions.includes(l.editionId))
        .reduce((acc, l) => acc + (l.actualQty * l.unitPriceOverride), 0);
      
      const newEm: PurchaseEm = {
          id: crypto.randomUUID(),
          code: newEmCode,
          amount: calculatedAmount, 
          editionIds: [...newEmSelectedEditions]
      };

      const updatedEms = [...(editingOrder?.ems || []), newEm];
      const updatedOrder = editingOrder ? { ...editingOrder, ems: updatedEms } : null;
      
      if (updatedOrder) {
          setEditingOrder(updatedOrder);
          triggerAutoSave(updatedOrder, selectedLines);
      }
      
      setNewEmCode(''); 
      setNewEmSelectedEditions([]);
  };

  const removeEm = (emId: string) => {
    if (!editingOrder) return;
    const updatedEms = (editingOrder.ems || []).filter(e => e.id !== emId);
    const updatedOrder = { ...editingOrder, ems: updatedEms };
    setEditingOrder(updatedOrder);
    triggerAutoSave(updatedOrder, selectedLines);
  };

  const toggleEditionSelectionForEm = (editionId: string) => {
    setNewEmSelectedEditions(prev => 
      prev.includes(editionId) 
        ? prev.filter(id => id !== editionId) 
        : [...prev, editionId]
    );
  };

  const toggleSort = (field: 'createdAt' | 'title' | 'amount') => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
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
    const itemsTotalPlanned = calculateTotal(selectedLines, 'planned');
    const itemsTotalActual = calculateTotal(selectedLines, 'actual');
    
    const displayGrandTotalPlanned = editingOrder.isGeneric ? Math.max(editingOrder.plannedAmount || 0, itemsTotalPlanned) : itemsTotalPlanned;
    const displayGrandTotalActual = editingOrder.isGeneric ? (itemsTotalActual > 0 ? itemsTotalActual : (editingOrder.actualAmount || 0)) : itemsTotalActual;

    const allowManagement = mode === 'workflow' || editingOrder.isGeneric;
    const genericServices = data.services.filter(s => s.supplierId === editingOrder.supplierId && !s.courseId);

    return (
      <div className="bg-white p-6 rounded-lg shadow-lg animate-fade-in max-w-5xl mx-auto border border-gray-100">
        <div className="flex justify-between items-start mb-6 border-b pb-4">
           <div className="flex flex-col gap-1">
             <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-800">
                    {editingOrder.id ? (mode === 'reconciliation' ? 'Consuntivazione' : 'Gestione Scheda') : 'Nuova Scheda'}
                </h2>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 border rounded-full">
                    {saveStatus === 'saving' && (
                        <>
                            <Loader2 size={12} className="animate-spin text-amber-500" />
                            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-tighter">Salvataggio...</span>
                        </>
                    )}
                    {saveStatus === 'saved' && (
                        <>
                            <CloudCheck size={12} className="text-green-500" />
                            <span className="text-[10px] font-bold text-green-600 uppercase tracking-tighter">Sincronizzato</span>
                        </>
                    )}
                    {saveStatus === 'error' && (
                        <>
                            <AlertCircle size={12} className="text-red-500" />
                            <span className="text-[10px] font-bold text-red-600 uppercase tracking-tighter">Errore salvataggio</span>
                        </>
                    )}
                    {saveStatus === 'idle' && (
                        <>
                            <CloudUpload size={12} className="text-gray-400" />
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">In attesa</span>
                        </>
                    )}
                </div>
             </div>
             <div className="flex gap-2 mt-1">
                {editingOrder.isGeneric && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Acquisto Generico</span>}
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${editingOrder.status === WorkflowStatus.CLOSED ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>
                    {editingOrder.status}
                </span>
             </div>
           </div>
           <div className="text-right">
             <div className="text-sm text-gray-500">Totale {mode === 'reconciliation' ? 'Consuntivato' : 'Pianificato'}</div>
             <div className="text-3xl font-bold text-blue-600">€ {(mode === 'reconciliation' ? displayGrandTotalActual : displayGrandTotalPlanned).toLocaleString()}</div>
           </div>
        </div>
        
        {/* Form Dati Testata */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 bg-gray-50 p-4 rounded-lg border">
          <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Titolo Scheda</label>
              <input type="text" className="w-full border rounded p-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 outline-none" value={editingOrder.title} onChange={e => updateOrderField('title', e.target.value)}/>
          </div>
          <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fornitore</label>
              <select className="w-full border rounded p-2 text-sm disabled:bg-gray-200" value={editingOrder.supplierId} onChange={e => handleSupplierChange(e.target.value)} disabled={mode === 'reconciliation' || (!!editingOrder.id && !!editingOrder.supplierId)}>
                <option value="">-- Seleziona Fornitore --</option>
                {data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
          </div>
          <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stato Workflow</label>
              <select 
                className={`w-full border rounded p-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none ${editingOrder.status === WorkflowStatus.CLOSED ? 'bg-gray-200' : 'bg-blue-50 text-blue-800'}`}
                value={editingOrder.status} 
                onChange={e => updateOrderField('status', e.target.value as WorkflowStatus)}
              >
                {Object.values(WorkflowStatus).map(status => <option key={status} value={status}>{status}</option>)}
              </select>
          </div>

          <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Codice RDA</label>
              <input type="text" className="w-full border rounded p-2 text-sm" value={editingOrder.rdaCode || ''} onChange={e => updateOrderField('rdaCode', e.target.value)} placeholder="Es. RDA-1234"/>
          </div>
          <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stato RIA</label>
              <select className="w-full border rounded p-2 text-sm" value={editingOrder.riaStatus} onChange={e => updateOrderField('riaStatus', e.target.value as RiaStatus)}>
                {Object.values(RiaStatus).map(status => <option key={status} value={status}>{status || 'Nessuno'}</option>)}
              </select>
          </div>
          <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Codice RIA</label>
              <input type="text" className="w-full border rounded p-2 text-sm" value={editingOrder.riaCode || ''} onChange={e => updateOrderField('riaCode', e.target.value)} placeholder="Es. RIA-5678"/>
          </div>
          <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Codice ODA (SAP)</label>
              <input type="text" className="w-full border rounded p-2 text-sm font-mono" value={editingOrder.odaCode || ''} onChange={e => updateOrderField('odaCode', e.target.value)} placeholder="45000..."/>
          </div>
          
          <div className="col-span-1 md:col-span-4 flex flex-col gap-4 bg-white p-4 rounded border shadow-sm">
             <div className="flex items-center gap-2">
                 <button onClick={() => {
                     if (mode === 'workflow') {
                        const newVal = !editingOrder.isGeneric;
                        updateOrderField('isGeneric', newVal);
                     }
                 }}
                    className={`w-10 h-5 rounded-full relative transition-colors ${editingOrder.isGeneric ? 'bg-amber-500' : 'bg-gray-300'} ${mode === 'reconciliation' ? 'cursor-not-allowed opacity-50' : ''}`}>
                     <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${editingOrder.isGeneric ? 'left-6' : 'left-1'}`}></div>
                 </button>
                 <label className="text-sm font-bold text-gray-700">Abilita Struttura Analitica / Generica</label>
             </div>
             {editingOrder.isGeneric && (
                 <div className="grid grid-cols-2 gap-4 border-t pt-3 animate-in fade-in slide-in-from-top-1">
                    <div>
                        <label className="block text-[10px] font-bold text-amber-700 uppercase">Budget Forfettario Pianificato (€)</label>
                        <input type="number" className="w-full border p-2 rounded text-sm bg-amber-50 font-bold" value={editingOrder.plannedAmount || 0} 
                            onChange={e => updateOrderField('plannedAmount', Number(e.target.value))} disabled={mode === 'reconciliation'}/>
                    </div>
                    {mode === 'reconciliation' && (
                        <div>
                            <label className="block text-[10px] font-bold text-green-700 uppercase">Importo Forfettario Consuntivato (€)</label>
                            <input type="number" className="w-full border p-2 rounded text-sm bg-green-50 font-bold" value={editingOrder.actualAmount || 0} 
                                onChange={e => updateOrderField('actualAmount', Number(e.target.value))}/>
                        </div>
                    )}
                 </div>
             )}
          </div>
        </div>

        {editingOrder.supplierId ? (
            <div className="space-y-8">
                {/* Sezione EM */}
                {mode === 'reconciliation' && (
                    <div className="bg-green-50 border border-green-200 p-4 rounded-lg shadow-sm">
                        <h3 className="text-lg font-bold text-green-800 mb-4 flex items-center gap-2"><Package size={20}/> Entrate Merci (EM)</h3>
                        <div className="space-y-2 mb-4">
                            {(editingOrder.ems || []).map(em => {
                                const coveredEditions = em.editionIds.map(eid => data.editions.find(ed => ed.id === eid)?.runId).filter(Boolean).join(', ');
                                return (
                                    <div key={em.id} className="bg-white p-3 rounded border flex justify-between items-center shadow-sm">
                                        <div className="flex flex-col">
                                            <div className="flex gap-4 items-center">
                                                <span className="font-bold text-green-700">{em.code}</span>
                                                <span className="font-mono text-sm">€ {em.amount.toLocaleString()}</span>
                                            </div>
                                            <div className="text-[10px] text-gray-400 font-bold uppercase">Edizioni: {coveredEditions || 'Nessuna'}</div>
                                        </div>
                                        <button onClick={() => removeEm(em.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="bg-white p-3 rounded border border-green-200 mb-4">
                            <label className="block text-[10px] font-bold text-green-700 uppercase mb-2">1. Seleziona le edizioni da includere in questa EM</label>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {activeEditionIds.map(eid => {
                                    const ed = data.editions.find(e => e.id === eid);
                                    const isSelected = newEmSelectedEditions.includes(eid);
                                    return (
                                        <button 
                                            key={eid} 
                                            onClick={() => toggleEditionSelectionForEm(eid)}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${isSelected ? 'bg-green-600 text-white border-green-700 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}
                                        >
                                            {isSelected ? <CheckSquare size={14}/> : <Square size={14}/>}
                                            {ed?.runId || 'Senza ID'}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="flex gap-2">
                                <input className="flex-1 border p-2 rounded text-sm focus:ring-2 focus:ring-green-500 outline-none" placeholder="Codice EM..." value={newEmCode} onChange={e => setNewEmCode(e.target.value)}/>
                                <button onClick={handleAddEm} className="bg-green-600 text-white px-6 py-2 rounded font-bold text-sm shadow hover:bg-green-700 transition-colors">Aggiungi EM</button>
                            </div>
                        </div>
                    </div>
                )}

                <h3 className="text-xl font-bold flex items-center gap-2 text-gray-700"><BookOpen size={24}/> Composizione Ordine</h3>
                <div className="space-y-6">
                    {activeCourseIds.map(courseId => {
                        const course = data.courses.find(c => c.id === courseId);
                        const editions = activeEditionIds.filter(eid => data.editions.find(e => e.id === eid)?.courseId === courseId);
                        
                        // Calcolo subtotale dinamico per questo corso
                        const courseSubtotal = selectedLines
                            .filter(l => editions.includes(l.editionId))
                            .reduce((acc, l) => acc + (mode === 'reconciliation' ? l.actualQty * l.unitPriceOverride : l.plannedQty * l.unitPriceOverride), 0);

                        return (
                            <div key={courseId} className="border border-gray-300 rounded-xl overflow-hidden bg-white shadow-sm transition-all duration-300">
                                <div className="bg-gray-100 p-4 flex flex-col md:flex-row justify-between items-start md:items-center border-b gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-600 text-white rounded-lg shadow-inner">
                                            <Calculator size={18}/>
                                        </div>
                                        <h4 className="font-bold text-lg text-gray-800">{course?.title}</h4>
                                    </div>
                                    
                                    <div className="flex items-center gap-4 ml-auto md:ml-0">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[9px] font-black uppercase text-gray-400 leading-none mb-1">Subtotale {mode === 'reconciliation' ? 'Consuntivo' : 'Pianificato'}</span>
                                            <div className="bg-white border-2 border-blue-100 px-4 py-1 rounded-full shadow-sm">
                                                <span className="font-bold text-blue-700 text-base">€ {courseSubtotal.toLocaleString()}</span>
                                            </div>
                                        </div>
                                        {allowManagement && (
                                            <button onClick={() => {
                                                const updatedCourseIds = activeCourseIds.filter(id => id !== courseId);
                                                const editionsToRemove = activeEditionIds.filter(eid => data.editions.find(e => e.id === eid)?.courseId === courseId);
                                                const updatedEditionIds = activeEditionIds.filter(eid => !editionsToRemove.includes(eid));
                                                const updatedLines = selectedLines.filter(l => !editionsToRemove.includes(l.editionId));
                                                
                                                setActiveCourseIds(updatedCourseIds);
                                                setActiveEditionIds(updatedEditionIds);
                                                setSelectedLines(updatedLines);
                                                triggerAutoSave(editingOrder, updatedLines);
                                            }} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"><Trash2 size={18} /></button>
                                        )}
                                    </div>
                                </div>
                                <div className="p-4 space-y-4 bg-gray-50/50">
                                    {editions.map(editionId => {
                                        const edition = data.editions.find(e => e.id === editionId);
                                        const lines = selectedLines.filter(l => l.editionId === editionId);
                                        return (
                                            <div key={editionId} className="bg-white p-4 rounded-lg border shadow-sm border-l-4 border-l-blue-500">
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-3 border-b border-dashed">
                                                    <div className="flex items-center gap-4 flex-wrap">
                                                        <div className="flex items-center gap-1 font-bold text-sm bg-gray-100 px-2 py-1 rounded border">
                                                            <Hash size={14} className="text-gray-400"/>
                                                            <input 
                                                                className="bg-transparent border-none outline-none w-32 font-bold text-blue-700" 
                                                                value={edition?.runId} 
                                                                placeholder="ID Edizione"
                                                                onChange={e => updateEditionDetails(editionId, 'runId', e.target.value)} 
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                                                            <Calendar size={14} className="text-blue-500"/>
                                                            <input type="date" className="border rounded p-1" value={edition?.startDate} onChange={e => updateEditionDetails(editionId, 'startDate', e.target.value)} />
                                                            <span>al</span>
                                                            <input type="date" className="border rounded p-1" value={edition?.endDate} onChange={e => updateEditionDetails(editionId, 'endDate', e.target.value)} />
                                                        </div>
                                                    </div>
                                                    {allowManagement && (
                                                        <button onClick={() => {
                                                            const updatedEditionIds = activeEditionIds.filter(id => id !== editionId);
                                                            const updatedLines = selectedLines.filter(l => l.editionId !== editionId);
                                                            setActiveEditionIds(updatedEditionIds);
                                                            setSelectedLines(updatedLines);
                                                            triggerAutoSave(editingOrder, updatedLines);
                                                        }} className="text-red-300 hover:text-red-500"><X size={20}/></button>
                                                    )}
                                                </div>
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="text-[10px] text-gray-400 uppercase font-bold text-left">
                                                            <th className="pb-2">Servizio</th>
                                                            <th className="pb-2 w-24">P.Unit</th>
                                                            <th className="pb-2 w-16">Pian.</th>
                                                            {mode === 'reconciliation' && <th className="pb-2 w-16">Eff.</th>}
                                                            <th className="pb-2 w-24 text-right">Totale</th>
                                                            <th className="pb-2 w-8"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {lines.map(line => {
                                                            const svc = data.services.find(s => s.id === line.serviceItemId);
                                                            return (
                                                                <tr key={line.id}>
                                                                    <td className="py-2">
                                                                        {allowManagement ? (
                                                                            <select className="w-full border rounded text-xs p-1" value={line.serviceItemId} onChange={e => {
                                                                                const s = data.services.find(si => si.id === e.target.value);
                                                                                const updatedLines = selectedLines.map(item => item.id === line.id ? { 
                                                                                    ...item, 
                                                                                    serviceItemId: e.target.value,
                                                                                    unitPriceOverride: s?.unitPrice || 0
                                                                                } : item);
                                                                                setSelectedLines(updatedLines);
                                                                                triggerAutoSave(editingOrder, updatedLines);
                                                                            }}>
                                                                                <option value="">-- Seleziona --</option>
                                                                                {[...genericServices, ...data.services.filter(s => s.courseId === courseId)].map(s => (
                                                                                    <option key={s.id} value={s.id}>{s.name} - € {s.unitPrice}</option>
                                                                                ))}
                                                                            </select>
                                                                        ) : <span className="font-medium text-xs">{svc?.name}</span>}
                                                                    </td>
                                                                    <td><input type="number" className="w-20 border rounded text-xs p-1" value={line.unitPriceOverride} onChange={e => updateLineItem(line.id, 'unitPriceOverride', Number(e.target.value))} /></td>
                                                                    <td><input type="number" className="w-12 border rounded text-xs p-1" value={line.plannedQty} onChange={e => updateLineItem(line.id, 'plannedQty', Number(e.target.value))} /></td>
                                                                    {mode === 'reconciliation' && <td><input type="number" className="w-12 border-green-300 border bg-green-50 rounded text-xs p-1 font-bold" value={line.actualQty} onChange={e => updateLineItem(line.id, 'actualQty', Number(e.target.value))} /></td>}
                                                                    <td className="text-right font-bold text-blue-600">€ {(mode === 'reconciliation' ? line.actualQty * line.unitPriceOverride : line.plannedQty * line.unitPriceOverride).toLocaleString()}</td>
                                                                    <td className="text-right"><button onClick={() => removeLineItem(line.id)} className="text-red-200 hover:text-red-400"><Trash2 size={14}/></button></td>
                                                                </tr>
                                                            )
                                                        })}
                                                    </tbody>
                                                </table>
                                                {allowManagement && <button onClick={() => addLineItem(editionId)} className="mt-2 text-[10px] text-blue-600 font-bold flex items-center gap-1 hover:underline"><Plus size={12}/> Aggiungi Voce di Costo</button>}
                                            </div>
                                        );
                                    })}
                                    {allowManagement && (
                                        <div className="bg-indigo-50 p-3 rounded border border-dashed border-indigo-200 flex items-center justify-between">
                                            <span className="text-xs font-bold text-indigo-700">Aggiungi una nuova edizione per questo corso</span>
                                            <button onClick={async () => {
                                                const newEd: CourseEdition = { id: crypto.randomUUID(), courseId: courseId!, runId: 'NEW-RUN-' + (editions.length + 1), startDate: '', endDate: '', lmsLessonId: '' };
                                                setData(prev => ({...prev, editions: [...prev.editions, newEd]}));
                                                await api.mutate('UPSERT_EDITION', newEd);
                                                setActiveEditionIds(prev => [...prev, newEd.id]);
                                                triggerAutoSave(editingOrder, selectedLines);
                                            }} className="bg-indigo-600 text-white text-[10px] px-3 py-1 rounded font-bold shadow-sm hover:bg-indigo-700 transition-colors">CREA EDIZIONE</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
                
                {allowManagement && (
                    <div className="mt-8 bg-blue-50 p-6 rounded-xl border border-dashed border-blue-300 flex items-center gap-4">
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-blue-700 uppercase mb-1 block">Catalogo Corsi Fornitore</label>
                            <select className="w-full p-2 border rounded-lg text-sm bg-white" value={courseToAdd} onChange={e => setCourseToAdd(e.target.value)}>
                                <option value="">-- Seleziona un corso da aggiungere all'ordine --</option>
                                {data.courses.filter(c => c.supplierId === editingOrder.supplierId && !activeCourseIds.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                            </select>
                        </div>
                        <button 
                            onClick={() => { 
                                if(courseToAdd) {
                                    const updatedCourseIds = [...activeCourseIds, courseToAdd];
                                    setActiveCourseIds(updatedCourseIds);
                                    setCourseToAdd(''); 
                                }
                            }} 
                            disabled={!courseToAdd} 
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-blue-700 transition-colors h-[42px] mt-5 disabled:opacity-50"
                        >
                            Associa Corso
                        </button>
                    </div>
                )}
            </div>
        ) : (
            <div className="py-20 text-center bg-gray-50 rounded-xl border-2 border-dashed flex flex-col items-center gap-3">
                <Users size={48} className="text-gray-300" />
                <p className="text-gray-500 font-medium">Seleziona un fornitore per iniziare a comporre la scheda.</p>
            </div>
        )}

        <div className="flex justify-end gap-3 mt-10 pt-6 border-t">
          <button onClick={() => {
              if (saveStatus === 'saving') {
                  if (!window.confirm("C'è un salvataggio in corso. Sei sicuro di voler chiudere?")) return;
              }
              setEditingOrder(null);
          }} className="px-8 py-2 border rounded-lg font-bold hover:bg-gray-50 transition-colors">Chiudi</button>
          
          <button onClick={handleSaveOrderManual} className="px-8 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-lg flex items-center gap-2 hover:bg-blue-700 transition-all">
            {saveStatus === 'saving' ? <Loader2 size={18} className="animate-spin"/> : <Save size={18} />} 
            Finalizza e Esci
          </button>
        </div>
      </div>
    );
  }

  const sortedOrders = [...data.orders]
    .filter(o => {
        const sup = data.suppliers.find(s => s.id === o.supplierId)?.name || '';
        const matchesSearch = o.title.toLowerCase().includes(searchTerm.toLowerCase()) || sup.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' ? true : statusFilter === 'ACTIVE' ? o.status !== WorkflowStatus.CLOSED : o.status === statusFilter;
        const matchesSupplier = supplierFilter === '' ? true : o.supplierId === supplierFilter;
        return matchesSearch && matchesStatus && matchesSupplier;
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
        <h2 className="text-2xl font-bold text-gray-800">{mode === 'workflow' ? 'Gestione Acquisti' : 'Consuntivazione'}</h2>
        <div className="flex flex-wrap gap-3 items-center">
            <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input className="pl-10 pr-4 py-2 border rounded-lg w-64 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Cerca ordine..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
            </div>
            
            <div className="relative">
                <Users className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <select className="pl-10 pr-4 py-2 border rounded-lg text-sm bg-white font-medium min-w-[200px] shadow-sm focus:ring-2 focus:ring-blue-500 outline-none" value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}>
                    <option value="">Tutti i Fornitori</option>
                    {data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            <select className="border rounded-lg px-3 py-2 text-sm bg-white font-medium shadow-sm focus:ring-2 focus:ring-blue-500 outline-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="ACTIVE">Schede Attive</option>
                <option value="ALL">Tutte le schede</option>
                <option value={WorkflowStatus.CLOSED}>Solo Chiuse</option>
            </select>
            {mode === 'workflow' && <button onClick={handleCreateOrder} className="bg-primary text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md hover:bg-black transition-all transform hover:scale-105 active:scale-95"><Plus size={20} /> Nuova Scheda</button>}
        </div>
      </div>

      <div className="flex gap-4 items-center bg-gray-100 p-2 rounded-lg border">
          <span className="text-[10px] font-bold text-gray-500 uppercase ml-2 flex items-center gap-1"><ArrowUpDown size={14}/> Ordina per:</span>
          <button onClick={() => toggleSort('createdAt')} className={`px-3 py-1 rounded text-xs font-bold transition-all ${sortField === 'createdAt' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 shadow-sm'}`}>Data</button>
          <button onClick={() => toggleSort('title')} className={`px-3 py-1 rounded text-xs font-bold transition-all ${sortField === 'title' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 shadow-sm'}`}>Titolo</button>
          <button onClick={() => toggleSort('amount')} className={`px-3 py-1 rounded text-xs font-bold transition-all ${sortField === 'amount' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 shadow-sm'}`}>Importo</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedOrders.map(order => {
          const supplier = data.suppliers.find(s => s.id === order.supplierId);
          const totalPlan = order.isGeneric ? Math.max(order.plannedAmount || 0, order.items.reduce((s,i) => s+i.plannedCost, 0)) : order.items.reduce((s,i) => s+i.plannedCost, 0);
          const totalAct = order.isGeneric ? (order.items.reduce((s,i) => s+i.actualCost, 0) > 0 ? order.items.reduce((s,i) => s+i.actualCost, 0) : order.actualAmount) : order.items.reduce((s,i) => s+i.actualCost, 0);

          return (
            <div key={order.id} className={`bg-white p-5 rounded-2xl shadow-sm border-2 relative group overflow-hidden hover:shadow-xl transition-all duration-300 ${order.status === WorkflowStatus.CLOSED ? 'border-gray-100 grayscale-[0.5]' : 'border-transparent hover:border-blue-100'}`}>
              {order.isGeneric && <div className="absolute top-0 right-0 bg-amber-500 text-white text-[8px] font-bold px-4 py-1 rotate-45 translate-x-3 -translate-y-1 uppercase tracking-tighter shadow-sm">Generica</div>}
              
              <div className="mb-4">
                 <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${order.status === WorkflowStatus.CLOSED ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>
                        {order.status}
                    </span>
                    {order.riaStatus && (
                        <span className="text-[9px] font-black bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                            RIA: {order.riaStatus}
                        </span>
                    )}
                 </div>
                 <h3 className="font-bold text-lg text-gray-800 line-clamp-2 leading-tight mb-1">{order.title}</h3>
                 <p className="text-xs text-gray-500 font-semibold flex items-center gap-1.5 uppercase tracking-tight">
                    <Users size={12} className="text-blue-400"/> {supplier?.name || 'Fornitore non assegnato'}
                 </p>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                      <span className="text-[9px] text-gray-400 block font-bold uppercase mb-0.5">Budget Pianificato</span>
                      <span className="font-bold text-sm text-blue-600">€ {totalPlan.toLocaleString()}</span>
                  </div>
                  <div className={`p-2 rounded-lg border ${totalAct > 0 ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100 opacity-50'}`}>
                      <span className="text-[9px] text-gray-400 block font-bold uppercase mb-0.5">Consuntivato</span>
                      <span className={`font-bold text-sm ${totalAct > 0 ? 'text-green-600' : 'text-gray-400'}`}>€ {totalAct.toLocaleString()}</span>
                  </div>
              </div>

              <div className="flex justify-between items-center border-t pt-4">
                 <div className="flex flex-col">
                    <span className="text-[9px] text-gray-400 font-bold uppercase">Data Creazione</span>
                    <span className="text-xs font-medium text-gray-600">{new Date(order.createdAt).toLocaleDateString()}</span>
                 </div>
                 <button onClick={() => handleEditOrder(order)} className="bg-gray-900 text-white hover:bg-blue-600 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95">
                    {mode === 'reconciliation' ? <ClipboardCheck size={14}/> : <Activity size={14}/>}
                    {mode === 'reconciliation' ? 'Consuntiva' : 'Gestisci'}
                 </button>
              </div>
            </div>
          );
        })}
        {sortedOrders.length === 0 && <div className="col-span-full py-20 text-center text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed italic">Nessun ordine trovato con i filtri attuali.</div>}
      </div>
    </div>
  );
};
