import React, { useState } from 'react';
import { AppData, Supplier, ServiceItem } from '../types';
import { Plus, Trash, Filter, Edit, Check, X, Copy, Search, ArrowUpDown, FileText, Power, Upload } from 'lucide-react';
import { api } from '../services/apiService';
import * as XLSX from 'xlsx';

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
}

const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
};

export const SuppliersAndData: React.FC<Props> = ({ data, setData }) => {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'catalog'>('suppliers');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof Supplier | 'name'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({ isActive: true });
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  
  const [serviceForm, setServiceForm] = useState<Partial<ServiceItem>>({});
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('');
  
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySourceId, setCopySourceId] = useState<string>('');
  const [servicesToCopy, setServicesToCopy] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const handleSort = (field: any) => {
      if (sortField === field) {
          setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
          setSortField(field);
          setSortDirection('asc');
      }
  };

  const handleSaveSupplier = async () => {
    if(!newSupplier.name) return;

    let supplierToSave: Supplier;

    if (editingSupplierId) {
        const existing = data.suppliers.find(s => s.id === editingSupplierId);
        if (!existing) return;
        supplierToSave = {
            ...existing,
            name: newSupplier.name || '',
            contractNumber: newSupplier.contractNumber || '',
            isActive: newSupplier.isActive ?? true,
            contractValue: Number(newSupplier.contractValue) || 0,
            contractStart: newSupplier.contractStart || '',
            contractEnd: newSupplier.contractEnd || ''
        };
        
        setData(prev => ({
            ...prev,
            suppliers: prev.suppliers.map(s => s.id === editingSupplierId ? supplierToSave : s)
        }));
        setEditingSupplierId(null);
    } else {
        supplierToSave = {
            id: crypto.randomUUID(),
            name: newSupplier.name || '',
            contractNumber: newSupplier.contractNumber || '',
            isActive: true,
            contractValue: Number(newSupplier.contractValue) || 0,
            contractStart: newSupplier.contractStart || '',
            contractEnd: newSupplier.contractEnd || '' 
        };
        setData(prev => ({...prev, suppliers: [...prev.suppliers, supplierToSave]}));
    }

    await api.mutate('UPSERT_SUPPLIER', supplierToSave);
    setNewSupplier({ isActive: true, name: '', contractNumber: '', contractValue: 0, contractStart: '', contractEnd: '' });
  };

  const startEditingSupplier = (s: Supplier) => {
      setEditingSupplierId(s.id);
      setNewSupplier({
          name: s.name,
          contractNumber: s.contractNumber,
          contractValue: s.contractValue,
          contractStart: s.contractStart,
          contractEnd: s.contractEnd,
          isActive: s.isActive
      });
  };

  const cancelEditingSupplier = () => {
      setEditingSupplierId(null);
      setNewSupplier({ isActive: true, name: '', contractNumber: '', contractValue: 0, contractStart: '', contractEnd: '' });
  };

  const deleteSupplier = async (e: React.MouseEvent, supplierId: string) => {
    e.preventDefault();
    e.stopPropagation(); 
    
    if(window.confirm("Sei sicuro? Cancellare un fornitore rimuoverà anche i servizi, i corsi e le edizioni associati.")){
       setData(prev => {
           const newSuppliers = prev.suppliers.filter(s => s.id !== supplierId);
           const newServices = prev.services.filter(s => s.supplierId !== supplierId);
           const newCourses = prev.courses.filter(c => c.supplierId !== supplierId);
           const deletedCourseIds = prev.courses.filter(c => c.supplierId === supplierId).map(c => c.id);
           const newEditions = prev.editions.filter(e => !deletedCourseIds.includes(e.courseId));
           return { ...prev, suppliers: newSuppliers, services: newServices, courses: newCourses, editions: newEditions };
       });
       await api.mutate('DELETE_SUPPLIER', { id: supplierId });
       if (editingSupplierId === supplierId) cancelEditingSupplier();
    }
  };

  const handleSaveService = async () => {
    if(!serviceForm.name) return;
    const supplierId = selectedSupplierFilter || serviceForm.supplierId;
    if (!supplierId) {
        alert("Seleziona un fornitore per associare questo servizio.");
        return;
    }

    let serviceToSave: ServiceItem;
    if (editingServiceId) {
        const existing = data.services.find(s => s.id === editingServiceId);
        if(!existing) return;
        serviceToSave = {
            ...existing,
            name: serviceForm.name || '',
            unitPrice: Number(serviceForm.unitPrice) || 0,
            unitType: serviceForm.unitType || 'unit',
            courseId: serviceForm.courseId || undefined
        };
        setData(prev => ({
            ...prev,
            services: prev.services.map(s => s.id === editingServiceId ? serviceToSave : s)
        }));
        setEditingServiceId(null);
    } else {
        serviceToSave = {
            id: crypto.randomUUID(),
            supplierId: supplierId,
            name: serviceForm.name || '',
            unitPrice: Number(serviceForm.unitPrice) || 0,
            unitType: serviceForm.unitType || 'unit',
            courseId: serviceForm.courseId || undefined
        };
        setData(prev => ({...prev, services: [...prev.services, serviceToSave]}));
    }
    await api.mutate('UPSERT_SERVICE', serviceToSave);
    setServiceForm({ name: '', unitPrice: 0, unitType: '', courseId: '' });
  };

  const startEditingService = (service: ServiceItem) => {
      setEditingServiceId(service.id);
      setServiceForm({
          name: service.name,
          unitPrice: service.unitPrice,
          unitType: service.unitType,
          supplierId: service.supplierId,
          courseId: service.courseId
      });
  };

  const cancelEditingService = () => {
      setEditingServiceId(null);
      setServiceForm({ name: '', unitPrice: 0, unitType: '', courseId: '' });
  };

  const deleteService = async (id: string) => {
    setData(prev => ({...prev, services: prev.services.filter(s => s.id !== id)}));
    await api.mutate('DELETE_SERVICE', { id });
  };

  const handleCopySelection = (serviceId: string) => {
      if (servicesToCopy.includes(serviceId)) {
          setServicesToCopy(prev => prev.filter(id => id !== serviceId));
      } else {
          setServicesToCopy(prev => [...prev, serviceId]);
      }
  };

  const executeCopyServices = async () => {
      if (!selectedSupplierFilter) return;
      const services = data.services.filter(s => servicesToCopy.includes(s.id));
      const newServices = services.map(s => ({
          ...s,
          id: crypto.randomUUID(),
          supplierId: selectedSupplierFilter,
          courseId: undefined
      }));
      setData(prev => ({...prev, services: [...prev.services, ...newServices]}));
      for (const s of newServices) await api.mutate('UPSERT_SERVICE', s);
      setServicesToCopy([]);
      setShowCopyModal(false);
      alert(`${newServices.length} servizi copiati correttamente.`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'suppliers' | 'catalog') => {
      const file = e.target.files?.[0];
      if (!file) return;
      setImporting(true);

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
            
            // Rimuoviamo l'header (prima riga)
            const dataRows = rows.slice(1).filter(r => r.length > 0 && r[0]);

            if (type === 'suppliers') {
                const newSuppliers = dataRows.map(cols => {
                    return {
                        id: crypto.randomUUID(),
                        name: String(cols[0] || '').trim(),
                        contractNumber: String(cols[1] || '').trim(),
                        isActive: true,
                        contractValue: Number(cols[2]) || 0,
                        contractStart: cols[3] ? new Date(cols[3]).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                        contractEnd: cols[4] ? new Date(cols[4]).toISOString().split('T')[0] : new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
                    } as Supplier;
                });
                setData(prev => ({...prev, suppliers: [...prev.suppliers, ...newSuppliers]}));
                for(const s of newSuppliers) await api.mutate('UPSERT_SUPPLIER', s);
                alert(`${newSuppliers.length} fornitori importati.`);
            } else {
                if (!selectedSupplierFilter) {
                    alert("Per favore, seleziona un fornitore prima di importare il catalogo.");
                    setImporting(false);
                    return;
                }
                const newServices = dataRows.map(cols => {
                    return {
                        id: crypto.randomUUID(),
                        supplierId: selectedSupplierFilter,
                        name: String(cols[0] || '').trim(),
                        unitPrice: Number(cols[1]) || 0,
                        unitType: String(cols[2] || 'unit').trim()
                    } as ServiceItem;
                });
                setData(prev => ({...prev, services: [...prev.services, ...newServices]}));
                for(const s of newServices) await api.mutate('UPSERT_SERVICE', s);
                alert(`${newServices.length} voci di catalogo importate.`);
            }
        } catch (err) {
            console.error("Errore importazione:", err);
            alert("Errore durante l'importazione del file. Verifica il formato.");
        } finally {
            setImporting(false);
            e.target.value = '';
        }
      };
      reader.readAsBinaryString(file);
    };

  const filteredSuppliers = data.suppliers
    .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.contractNumber.includes(searchTerm))
    .sort((a, b) => {
        const aVal = a[sortField as keyof Supplier];
        const bVal = b[sortField as keyof Supplier];
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

  const filteredServices = (selectedSupplierFilter 
    ? data.services.filter(s => s.supplierId === selectedSupplierFilter)
    : data.services)
    .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a,b) => {
        if (a.courseId && !b.courseId) return 1;
        if (!a.courseId && b.courseId) return -1;
        return a.name.localeCompare(b.name);
    });
  
  const sourceServicesForCopy = copySourceId 
    ? data.services.filter(s => s.supplierId === copySourceId)
    : [];
  
  const availableCoursesForSupplier = selectedSupplierFilter 
    ? data.courses.filter(c => c.supplierId === selectedSupplierFilter)
    : [];

  return (
    <div className="bg-white rounded-lg shadow animate-fade-in p-6">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-2">
        <div className="flex gap-4">
            <button 
            className={`pb-2 px-4 font-semibold ${activeTab === 'suppliers' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}
            onClick={() => {setActiveTab('suppliers'); setSearchTerm('');}}
            >
            Anagrafica Fornitori
            </button>
            <button 
            className={`pb-2 px-4 font-semibold ${activeTab === 'catalog' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}
            onClick={() => {setActiveTab('catalog'); setSearchTerm('');}}
            >
            Catalogo Prezzi
            </button>
        </div>
        <div className="relative w-full md:w-64">
            <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
            <input 
                type="text" 
                className="pl-8 pr-4 py-2 border rounded-lg w-full text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder={`Cerca...`}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      {activeTab === 'suppliers' && (
        <div>
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
             <div>
                 <h4 className="font-bold text-sm text-gray-700">Importa Fornitori</h4>
                 <p className="text-xs text-gray-500">Supporta .xlsx, .xls, .csv</p>
             </div>
             <label className="flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors shadow-sm">
                 <Upload size={16} className="text-indigo-600"/>
                 <span className="text-sm font-medium">{importing ? 'Importazione...' : 'Scegli File'}</span>
                 <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleFileUpload(e, 'suppliers')} className="hidden" disabled={importing}/>
             </label>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-7 gap-2 mb-4 items-end p-4 rounded-lg border border-indigo-100 ${editingSupplierId ? 'bg-yellow-50 border-yellow-200' : 'bg-indigo-50'}`}>
             <div className="md:col-span-2">
                 <label className="text-xs font-bold text-gray-600">Fornitore</label>
                 <input className="w-full border p-2 rounded" value={newSupplier.name || ''} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} placeholder="Es. Rossi Formazione" />
             </div>
             <div>
                 <label className="text-xs font-bold text-gray-600">N. Contratto</label>
                 <input className="w-full border p-2 rounded" value={newSupplier.contractNumber || ''} onChange={e => setNewSupplier({...newSupplier, contractNumber: e.target.value})} placeholder="CNT-2024-01" />
             </div>
             <div>
                 <label className="text-xs font-bold text-gray-600">Valore (€)</label>
                 <input type="number" className="w-full border p-2 rounded" value={newSupplier.contractValue || ''} onChange={e => setNewSupplier({...newSupplier, contractValue: Number(e.target.value)})} placeholder="0.00" />
             </div>
             <div className="grid grid-cols-2 gap-1 md:col-span-2">
                 <div>
                    <label className="text-[10px] font-bold text-gray-600">Inizio</label>
                    <input type="date" className="w-full border p-2 rounded text-xs" value={newSupplier.contractStart || ''} onChange={e => setNewSupplier({...newSupplier, contractStart: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-[10px] font-bold text-gray-600">Fine</label>
                    <input type="date" className="w-full border p-2 rounded text-xs" value={newSupplier.contractEnd || ''} onChange={e => setNewSupplier({...newSupplier, contractEnd: e.target.value})} />
                 </div>
             </div>
             <div className="flex gap-1 items-end h-[42px]">
                {editingSupplierId && (
                    <div className="flex flex-col items-center justify-center h-full pb-2 px-2">
                        <label className="text-[10px] font-bold text-gray-600 mb-1">Attivo</label>
                        <button 
                            onClick={() => setNewSupplier({...newSupplier, isActive: !newSupplier.isActive})}
                            className={`w-10 h-5 rounded-full relative transition-colors ${newSupplier.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${newSupplier.isActive ? 'left-6' : 'left-1'}`}></div>
                        </button>
                    </div>
                )}
                
                <button onClick={handleSaveSupplier} className={`${editingSupplierId ? 'bg-yellow-500' : 'bg-primary'} text-white p-2 rounded hover:opacity-90 h-full flex-1 flex justify-center items-center`}>
                    {editingSupplierId ? <Check size={20}/> : <Plus size={20}/>}
                </button>
                {editingSupplierId && (
                    <button onClick={cancelEditingSupplier} className="bg-gray-300 text-gray-700 p-2 rounded hover:bg-gray-400 h-full">
                        <X size={20}/>
                    </button>
                )}
             </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('isActive')}>Stato</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('name')}>Fornitore</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('contractNumber')}>Contratto</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('contractValue')}>Budget</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Validità</th>
                    <th className="px-3 py-2"></th>
                </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                {filteredSuppliers.map(s => (
                    <tr key={s.id} className={`${!s.isActive ? 'bg-gray-50 opacity-70' : ''} ${editingSupplierId === s.id ? 'bg-yellow-50' : ''}`}>
                    <td className="px-3 py-2"><span className={`text-[10px] font-bold px-2 py-1 rounded-full ${s.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>{s.isActive ? 'ATT' : 'INA'}</span></td>
                    <td className="px-3 py-2 font-medium text-gray-900">{s.name}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{s.contractNumber}</td>
                    <td className="px-3 py-2 font-mono text-blue-600 text-xs">€ {s.contractValue.toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{formatDate(s.contractStart)} - {formatDate(s.contractEnd)}</td>
                    <td className="px-3 py-2 text-right flex justify-end gap-2">
                        <button className="p-1 text-blue-500" onClick={() => startEditingSupplier(s)}><Edit size={16} /></button>
                        <button type="button" className="p-1 text-red-500" onClick={(e) => deleteSupplier(e, s.id)}><Trash size={16} /></button>
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'catalog' && (
        <div>
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
             <div className="flex-1 flex flex-col gap-1">
                 <label className="text-xs font-bold text-indigo-700">Seleziona Fornitore</label>
                 <select className="border-indigo-200 rounded-md p-2 bg-white" value={selectedSupplierFilter} onChange={(e) => setSelectedSupplierFilter(e.target.value)}>
                    <option value="">-- Seleziona per gestire/importare --</option>
                    {data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                 </select>
             </div>
             {selectedSupplierFilter && (
                 <div className="flex gap-2">
                    <label className="bg-white border border-indigo-300 text-indigo-700 px-4 py-2 rounded flex items-center gap-2 font-bold text-sm cursor-pointer hover:bg-indigo-50 transition-colors">
                        <Upload size={16} /> {importing ? '...' : 'Importa Catalogo'}
                        <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleFileUpload(e, 'catalog')} className="hidden" disabled={importing}/>
                    </label>
                    <button onClick={() => setShowCopyModal(!showCopyModal)} className="bg-white border border-indigo-300 text-indigo-700 px-4 py-2 rounded flex items-center gap-2 font-bold text-sm hover:bg-indigo-50 transition-colors">
                        <Copy size={16} /> Copia da altro
                    </button>
                 </div>
             )}
          </div>
          
           {showCopyModal && selectedSupplierFilter && (
              <div className="mb-6 p-4 border border-blue-200 bg-blue-50 rounded-lg relative">
                  <button onClick={() => setShowCopyModal(false)} className="absolute top-2 right-2 text-gray-400"><X size={16}/></button>
                  <h4 className="font-bold text-sm mb-3">Copia servizi da un altro fornitore</h4>
                  <div className="flex items-center gap-4 mb-4">
                      <select className="border p-2 rounded text-sm min-w-[200px]" value={copySourceId} onChange={e => setCopySourceId(e.target.value)}>
                          <option value="">-- Seleziona Fornitore Sorgente --</option>
                          {data.suppliers.filter(s => s.id !== selectedSupplierFilter).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                  </div>
                  {copySourceId && (
                      <div className="bg-white p-3 rounded border max-h-60 overflow-y-auto mb-4">
                          {sourceServicesForCopy.length === 0 ? <p className="text-xs text-gray-500">Nessun servizio trovato.</p> : sourceServicesForCopy.map(s => (
                              <label key={s.id} className="flex items-center gap-2 py-1 hover:bg-gray-50 cursor-pointer">
                                  <input type="checkbox" checked={servicesToCopy.includes(s.id)} onChange={() => handleCopySelection(s.id)}/>
                                  <span className="text-sm font-medium">{s.name}</span>
                                  <span className="text-xs text-gray-400">€ {s.unitPrice}</span>
                              </label>
                          ))}
                      </div>
                  )}
                  <button onClick={executeCopyServices} disabled={servicesToCopy.length === 0} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold disabled:opacity-50">Copia Selezionati</button>
              </div>
          )}

           <div className={`grid grid-cols-1 md:grid-cols-6 gap-2 mb-4 items-end border-t pt-4 ${editingServiceId ? 'bg-yellow-50 p-2 rounded border border-yellow-200' : ''}`}>
             {!selectedSupplierFilter && !editingServiceId ? (
               <div className="md:col-span-1">
                  <label className="text-xs">Fornitore</label>
                  <select className="w-full border p-2 rounded text-sm" value={serviceForm.supplierId || ''} onChange={e => setServiceForm({...serviceForm, supplierId: e.target.value})}>
                    <option value="">Scegli...</option>
                    {data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
               </div>
             ) : (
                <div className="md:col-span-1">
                    <label className="text-xs text-blue-700 font-bold">Corso (Opz)</label>
                    <select className="w-full border p-2 rounded text-sm bg-blue-50" value={serviceForm.courseId || ''} onChange={e => setServiceForm({...serviceForm, courseId: e.target.value})}>
                        <option value="">-- Generico --</option>
                        {(selectedSupplierFilter ? availableCoursesForSupplier : data.courses.filter(c => c.supplierId === serviceForm.supplierId)).map(c => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                    </select>
                </div>
             )}
             <div className={selectedSupplierFilter || editingServiceId ? "md:col-span-2" : "md:col-span-1"}>
                 <label className="text-xs font-bold text-gray-600">Servizio</label>
                 <input className="w-full border p-2 rounded" value={serviceForm.name || ''} onChange={e => setServiceForm({...serviceForm, name: e.target.value})} placeholder="Es. Docenza Junior" />
             </div>
             <div>
                 <label className="text-xs font-bold text-gray-600">Prezzo (€)</label>
                 <input type="number" className="w-full border p-2 rounded" value={serviceForm.unitPrice || ''} onChange={e => setServiceForm({...serviceForm, unitPrice: Number(e.target.value)})} placeholder="0.00" />
             </div>
             <div>
                 <label className="text-xs font-bold text-gray-600">Unità</label>
                 <input className="w-full border p-2 rounded" value={serviceForm.unitType || ''} onChange={e => setServiceForm({...serviceForm, unitType: e.target.value})} placeholder="ora/gg/flat" />
             </div>
             <div className="flex gap-1">
                <button onClick={handleSaveService} className={`${editingServiceId ? 'bg-yellow-500' : 'bg-primary'} text-white p-2 rounded flex-1 flex justify-center items-center h-[42px]`}>
                    {editingServiceId ? <Check size={20}/> : <Plus size={20}/>}
                </button>
                {editingServiceId && <button onClick={cancelEditingService} className="bg-gray-300 text-gray-700 p-2 rounded h-[42px]"><X size={20}/></button>}
             </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <tbody className="divide-y divide-gray-200">
                {filteredServices.length === 0 ? <tr><td colSpan={5} className="py-10 text-center text-gray-400">Nessun servizio presente.</td></tr> : filteredServices.map(s => (
                    <tr key={s.id} className={editingServiceId === s.id ? 'bg-yellow-50' : ''}>
                      <td className="px-3 py-2 text-xs text-gray-500">{data.suppliers.find(sup => sup.id === s.supplierId)?.name}</td>
                      <td className="px-3 py-2 font-medium">
                          {s.name} {s.courseId && <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded ml-1">Specifica</span>}
                      </td>
                      <td className="px-3 py-2 font-mono">€ {s.unitPrice}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">{s.unitType}</td>
                      <td className="px-3 py-2 flex justify-end gap-2">
                        <button className="text-blue-500 p-1 hover:bg-blue-50 rounded" onClick={() => startEditingService(s)}><Edit size={16} /></button>
                        <button className="text-red-500 p-1 hover:bg-red-50 rounded" onClick={() => deleteService(s.id)}><Trash size={16} /></button>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
