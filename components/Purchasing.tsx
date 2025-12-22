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
    setSelectedLines([...(order.items || [])]);
    
    const editionIds = [...new Set((order.items || []).map(i => i.editionId))];
    const courseIds = [...new Set(editionIds.map(eid => {
      const ed = data.editions.find(e => e.id === eid);
      return ed ? ed.courseId : '';
    }).filter(id => id !== ''))];

    setActiveEditionIds(editionIds);
    setActiveCourseIds(courseIds);
  };

  const handleSupplierChange = (supplierId: string) => {
    if (!editingOrder) return;
    setEditingOrder(prev => prev ? { ...prev, supplierId } : null);
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

  const updateEditionDetails = async (editionId: string, field: keyof CourseEdition, value: string) => {
      setData(prev => ({
          ...prev,
          editions: prev.editions.map(e => (e.id === editionId ? { ...e, [field]: value } : e))
      }));
      // Persist partial update if needed, but here we rely on full save
  };

  const addLineItem = (editionId: string) => {
    const newItem: PurchaseLineItem = {
      id: crypto.randomUUID(),
      editionId,
      serviceItemId: '',
      plannedQty: 1,
      actualQty: mode === 'reconciliation' ? 1 : 0,
      unitPriceOverride: 0,
      plannedCost: 0,
      actualCost: 0
    };
    setSelectedLines([...selectedLines, newItem]);
  };

  const updateLineItem = (id: string, field: keyof PurchaseLineItem, value: any) => {
    setSelectedLines(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const removeLineItem = (id: string) => {
    setSelectedLines(prev => prev.filter(item => item.id !== id));
  };

  const handleAddEm = () => {
      if (!newEmCode) return;
      const calculatedAmount = selectedLines
        .filter(l => newEmSelectedEditions.includes(l.editionId))
        .reduce((acc, l) => acc + (l.actualQty * l.unitPriceOverride), 0);
      
      const newEm: PurchaseEm = {
          id: crypto.randomUUID(),
          code: newEmCode,
          amount: calculatedAmount, 
          editionIds: newEmSelectedEditions
      };

      setEditingOrder(prev => prev ? ({ ...prev, ems: [...(prev.ems || []), newEm] }) : null);
      setNewEmCode(''); setNewEmSelectedEditions([]);
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

    const allowManagement = mode === 'workflow' || editingOrder.isGeneric;
    const genericServices = data.services.filter(s => s.supplierId === editingOrder.supplierId && !s.courseId);

    return (
      <div className="bg-white p-6 rounded-lg shadow-lg animate-fade-in max-w-5xl mx-auto">
        {/* Header Modale */}
        <div className="flex justify-between items-start mb-6 border-b pb-4">
           <div>
             <h2 className="text-2xl font-bold text-gray-800">{editingOrder.id ? (mode === 'reconciliation' ? 'Consuntivazione' : 'Gestione Scheda') : 'Nuova Scheda'}</h2>
             {editingOrder.isGeneric && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Acquisto Generico</span>}
           </div>
           <div className="text-right">
             <div className="text-sm text-gray-500">Totale {mode === 'reconciliation' ? 'Consuntivato' : 'Pianificato'}</div>
             <div className="text-3xl font-bold text-blue-600">€ {(mode === 'reconciliation' ? displayGrandTotalActual : displayGrandTotalPlanned).toLocaleString()}</div>
           </div>
        </div>
        
        {/* Form Dati Testata */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 bg-gray-50 p-4 rounded-lg border">
          <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Titolo Scheda</label>
              <input type="text" className="w-full border rounded p-2 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none" value={editingOrder.title} onChange={e => setEditingOrder({...editingOrder, title: e.target.value})}/>
          </div>
          <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Fornitore</label>
              <select className="w-full border rounded p-2 disabled:bg-gray-100" value={editingOrder.supplierId} onChange={e => handleSupplierChange(e.target.value)} disabled={mode === 'reconciliation'}>
                <option value="">-- Seleziona Fornitore --</option>
                {data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
          </div>
          
          <div className="col-span-3 flex flex-col gap-4 bg-white p-4 rounded border shadow-sm">
             <div className="flex items-center gap-2">
                 <button onClick={() => mode === 'workflow' && setEditingOrder({...editingOrder, isGeneric: !editingOrder.isGeneric})}
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
                            onChange={e => setEditingOrder({...editingOrder, plannedAmount: Number(e.target.value)})} disabled={mode === 'reconciliation'}/>
                    </div>
                    {mode === 'reconciliation' && (
                        <div>
                            <label className="block text-[10px] font-bold text-green-700 uppercase">Importo Forfettario Consuntivato (€)</label>
                            <input type="number" className="w-full border p-2 rounded text-sm bg-green-50 font-bold" value={editingOrder.actualAmount || 0} 
                                onChange={e => setEditingOrder({...editingOrder, actualAmount: Number(e.target.value)})}/>
                        </div>
                    )}
                 </div>
             )}
          </div>
        </div>

        {/* Struttura Dettaglio Corsi/Edizioni */}
        {editingOrder.supplierId && (
            <div className="space-y-8">
                {/* Sezione EM (solo in riconciliazione) */}
                {mode === 'reconciliation' && (
                    <div className="bg-green-50 border border-green-200 p-4 rounded-lg shadow-sm">
                        <h3 className="text-lg font-bold text-green-800 mb-4 flex items-center gap-2"><Package size={20}/> Entrate Merci (EM)</h3>
                        <div className="space-y-2 mb-4">
                            {(editingOrder.ems || []).map(em => (
                                <div key={em.id} className="bg-white p-3 rounded border flex justify-between items-center shadow-sm">
                                    <div className="flex gap-4">
                                        <span className="font-bold text-green-700">{em.code}</span>
                                        <span className="font-mono">€ {em.amount.toLocaleString()}</span>
                                    </div>
                                    <button onClick={() => setEditingOrder({...editingOrder, ems: (editingOrder.ems || []).filter(e => e.id !== em.id)})} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input className="flex-1 border p-2 rounded text-sm" placeholder="Codice EM..." value={newEmCode} onChange={e => setNewEmCode(e.target.value)}/>
                            <button onClick={handleAddEm} className="bg-green-600 text-white px-4 py-2 rounded font-bold text-sm shadow">Aggiungi EM</button>
                        </div>
                    </div>
                )}

                <h3 className="text-xl font-bold flex items-center gap-2 text-gray-700"><BookOpen size={24}/> Composizione Ordine</h3>
                <div className="space-y-6">
                    {activeCourseIds.map(courseId => {
                        const course = data.courses.find(c => c.id === courseId);
                        const editions = activeEditionIds.filter(eid => data.editions.find(e => e.id === eid)?.courseId === courseId);
                        
                        return (
                            <div key={courseId} className="border border-gray-300 rounded-xl overflow-hidden bg-white shadow-sm">
                                <div className="bg-gray-100 p-4 flex justify-between items-center border-b">
                                    <h4 className="font-bold text-lg text-gray-800">{course?.title}</h4>
                                    {allowManagement && (
                                        <button onClick={() => {
                                            setActiveCourseIds(prev => prev.filter(id => id !== courseId));
                                            setActiveEditionIds(prev => prev.filter(eid => data.editions.find(e => e.id === eid)?.courseId !== courseId));
                                            setSelectedLines(prev => prev.filter(l => !editions.includes(l.editionId)));
                                        }} className="text-red-400 hover:text-red-600"><Trash2 size={18} /></button>
                                    )}
                                </div>
                                <div className="p-4 space-y-4 bg-gray-50/50">
                                    {editions.map(editionId => {
                                        const edition = data.editions.find(e => e.id === editionId);
                                        const lines = selectedLines.filter(l => l.editionId === editionId);
                                        return (
                                            <div key={editionId} className="bg-white p-4 rounded-lg border shadow-sm border-l-4 border-l-blue-500">
                                                <div className="flex justify-between items-center mb-3 pb-2 border-b border-dashed">
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center gap-1 font-bold text-sm bg-gray-100 px-2 py-1 rounded">
                                                            <Hash size={14} className="text-gray-400"/>
                                                            <input className="bg-transparent border-none outline-none w-24" value={edition?.runId} onChange={e => updateEditionDetails(editionId, 'runId', e.target.value)} />
                                                        </div>
                                                        <div className="text-xs text-gray-500 flex gap-2">
                                                            <Calendar size={14}/> {edition?.startDate} - {edition?.endDate}
                                                        </div>
                                                    </div>
                                                    {allowManagement && (
                                                        <button onClick={() => {
                                                            setActiveEditionIds(prev => prev.filter(id => id !== editionId));
                                                            setSelectedLines(prev => prev.filter(l => l.editionId !== editionId));
                                                        }} className="text-red-300 hover:text-red-500"><X size={16}/></button>
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
                                                                                updateLineItem(line.id, 'serviceItemId', e.target.value);
                                                                                updateLineItem(line.id, 'unitPriceOverride', s?.unitPrice || 0);
                                                                            }}>
                                                                                <option value="">-- Seleziona --</option>
                                                                                {[...genericServices, ...data.services.filter(s => s.courseId === courseId)].map(s => (
                                                                                    <option key={s.id} value={s.id}>{s.name} - € {s.unitPrice}</option>
                                                                                ))}
                                                                            </select>
                                                                        ) : <span className="font-medium">{svc?.name}</span>}
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
                                                {allowManagement && <button onClick={() => addLineItem(editionId)} className="mt-2 text-[10px] text-blue-600 font-bold flex items-center gap-1 hover:underline"><Plus size={12}/> Aggiungi Voce</button>}
                                            </div>
                                        );
                                    })}
                                    {allowManagement && (
                                        <div className="bg-indigo-50 p-3 rounded border border-dashed border-indigo-200 flex items-center justify-between">
                                            <span className="text-xs font-bold text-indigo-700">Aggiungi una nuova edizione per questo corso</span>
                                            <button onClick={async () => {
                                                const newEd: CourseEdition = { id: crypto.randomUUID(), courseId: courseId!, runId: 'NEW-RUN', startDate: '', endDate: '', lmsLessonId: '' };
                                                setData(prev => ({...prev, editions: [...prev.editions, newEd]}));
                                                await api.mutate('UPSERT_EDITION', newEd);
                                                setActiveEditionIds(prev => [...prev, newEd.id]);
                                            }} className="bg-indigo-600 text-white text-[10px] px-3 py-1 rounded font-bold shadow-sm">CREA EDIZIONE</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
                
                {/* Selezione Corsi da Catalogo */}
                {allowManagement && (
                    <div className="mt-8 bg-blue-50 p-6 rounded-xl border border-dashed border-blue-300 flex items-center gap-4">
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-blue-700 uppercase mb-1 block">Catalogo Corsi Fornitore</label>
                            <select className="w-full p-2 border rounded-lg text-sm bg-white" value={courseToAdd} onChange={e => setCourseToAdd(e.target.value)}>
                                <option value="">-- Seleziona un corso da aggiungere all'ordine --</option>
                                {data.courses.filter(c => c.supplierId === editingOrder.supplierId && !activeCourseIds.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                            </select>
                        </div>
                        <button onClick={() => { if(courseToAdd) setActiveCourseIds([...activeCourseIds, courseToAdd]); setCourseToAdd(''); }} disabled={!courseToAdd} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-blue-700 transition-colors h-[42px] mt-5">Aggiungi Corso</button>
                    </div>
                )}
            </div>
        )}

        <div className="flex justify-end gap-3 mt-10 pt-6 border-t">
          <button onClick={() => setEditingOrder(null)} className="px-8 py-2 border rounded-lg font-bold hover:bg-gray-50 transition-colors">Annulla</button>
          <button onClick={handleSaveOrder} className="px-8 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-lg flex items-center gap-2 hover:bg-blue-700 transition-all"><Save size={18} /> Salva Scheda</button>
        </div>
      </div>
    );
  }

  const sortedOrders = [...data.orders]
    .filter(o => {
        const sup = data.suppliers.find(s => s.id === o.supplierId)?.name || '';
        const matchesSearch = o.title.toLowerCase().includes(searchTerm.toLowerCase()) || sup.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' ? true : statusFilter === 'ACTIVE' ? o.status !== WorkflowStatus.CLOSED : o.status === statusFilter;
        return matchesSearch && matchesStatus;
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
        <div className="flex flex-wrap gap-3">
            <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input className="pl-10 pr-4 py-2 border rounded-lg w-64 text-sm" placeholder="Cerca ordine o fornitore..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
            </div>
            <select className="border rounded-lg px-3 py-2 text-sm bg-white font-medium" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="ACTIVE">Schede Attive</option>
                <option value="ALL">Tutte le schede</option>
                <option value={WorkflowStatus.CLOSED}>Solo Chiuse</option>
            </select>
            {mode === 'workflow' && <button onClick={handleCreateOrder} className="bg-primary text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md hover:bg-black"><Plus size={20} /> Nuova Scheda</button>}
        </div>
      </div>

      <div className="flex gap-4 items-center bg-gray-100 p-2 rounded-lg border">
          <span className="text-xs font-bold text-gray-500 uppercase ml-2 flex items-center gap-1"><ArrowUpDown size={14}/> Ordina per:</span>
          <button onClick={() => toggleSort('createdAt')} className={`px-3 py-1 rounded text-xs font-bold transition-all ${sortField === 'createdAt' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 shadow-sm'}`}>Data</button>
          <button onClick={() => toggleSort('title')} className={`px-3 py-1 rounded text-xs font-bold transition-all ${sortField === 'title' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 shadow-sm'}`}>Titolo</button>
          <button onClick={() => toggleSort('amount')} className={`px-3 py-1 rounded text-xs font-bold transition-all ${sortField === 'amount' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 shadow-sm'}`}>Importo</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedOrders.map(order => {
          const supplier = data.suppliers.find(s => s.id === order.supplierId);
          const totalPlan = order.isGeneric ? Math.max(order.plannedAmount || 0, order.items.reduce((s,i) => s+i.plannedCost, 0)) : order.items.reduce((s,i) => s+i.plannedCost, 0);
          const totalAct = order.isGeneric ? (order.items.reduce((s,i) => s+i.actualCost, 0) > 0 ? order.items.reduce((s,i) => s+i.actualCost, 0) : order.actualAmount) : order.items.reduce((s,i) => s+i.actualCost, 0);

          return (
            <div key={order.id} className="bg-white p-5 rounded-xl shadow-sm border relative group overflow-hidden hover:shadow-md transition-shadow">
              {order.isGeneric && <div className="absolute top-0 right-0 bg-amber-500 text-white text-[8px] font-bold px-4 py-1 rotate-45 translate-x-3 -translate-y-1 uppercase tracking-tighter shadow-sm">Generica</div>}
              
              <div className="mb-4">
                 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${order.status === WorkflowStatus.CLOSED ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>{order.status}</span>
                 <h3 className="font-bold text-lg mt-1 text-gray-800 line-clamp-1">{order.title}</h3>
                 <p className="text-xs text-gray-500 font-semibold flex items-center gap-1 uppercase tracking-tight"><Users size={12}/> {supplier?.name || 'Fornitore non assegnato'}</p>
              </div>

              <div className="flex justify-between border-t pt-4 items-end">
                 <div className="space-y-1">
                    <span className="text-[10px] text-gray-400 block font-bold uppercase">Budget Pianificato</span>
                    <span className="font-bold text-blue-600">€ {totalPlan.toLocaleString()}</span>
                 </div>
                 {totalAct > 0 && (
                    <div className="space-y-1 text-right">
                        <span className="text-[10px] text-gray-400 block font-bold uppercase">Consuntivato</span>
                        <span className="font-bold text-green-600">€ {totalAct.toLocaleString()}</span>
                    </div>
                 )}
                 <button onClick={() => handleEditOrder(order)} className="bg-gray-50 hover:bg-blue-600 hover:text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-all border shadow-sm"><Edit size={14}/> {mode === 'reconciliation' ? 'Consuntiva' : 'Gestisci'}</button>
              </div>
            </div>
          );
        })}
        {sortedOrders.length === 0 && <div className="col-span-full py-12 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed italic">Nessun ordine trovato.</div>}
      </div>
    </div>
  );
};
