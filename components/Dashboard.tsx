
import React, { useState } from 'react';
import { AppData, Supplier, PurchaseOrder } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { analyzeProcurementData } from '../services/geminiService';
import { Bot, RefreshCcw, Loader2, Filter, Calendar, ShieldCheck, Lock, Info, ListOrdered, GraduationCap, ChevronRight } from 'lucide-react';

interface DashboardProps {
  data: AppData;
}

// Colori standardizzati per tutta la dashboard
const STATUS_COLORS = {
  actual: '#10b981',   // Verde: Consuntivato
  planned: '#3b82f6',  // Blu: Impegnato non speso
  available: '#f59e0b' // Giallo: Residuo Libero
};

export const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [loadingAi, setLoadingAi] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [showSecurityInfo, setShowSecurityInfo] = useState(false);
  
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const filteredSuppliers = data.suppliers.filter(s => {
    if (selectedSupplierId && s.id !== selectedSupplierId) return false;
    if (startDate && endDate) {
        if (!s.contractStart || !s.contractEnd) return false;
        const filterStart = new Date(startDate);
        const filterEnd = new Date(endDate);
        const contractStart = new Date(s.contractStart);
        const contractEnd = new Date(s.contractEnd);
        return contractStart <= filterEnd && contractEnd >= filterStart;
    }
    return true;
  });

  const supplierStats = filteredSuppliers.map(s => {
    const orders = data.orders.filter(o => o.supplierId === s.id);
    const planned = orders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.plannedCost, 0), 0);
    const actual = orders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.actualCost, 0), 0);
    
    // Logica di calcolo per stacking coerente
    const impegnatoResiduo = Math.max(0, planned - actual);
    const residuoLibero = Math.max(0, s.contractValue - Math.max(planned, actual));

    return {
      name: s.name,
      contractNum: s.contractNumber,
      Consuntivato: actual,
      "Impegnato Residuo": impegnatoResiduo,
      "Disponibile": residuoLibero,
      BudgetTotale: s.contractValue
    };
  });

  // Filtro per la tabella analitica ordini
  const filteredOrders = data.orders.filter(o => {
    const matchesSupplier = !selectedSupplierId || o.supplierId === selectedSupplierId;
    const matchesDate = !startDate || !endDate || (o.createdAt >= startDate && o.createdAt <= endDate);
    return matchesSupplier && matchesDate;
  });

  const getCoursesForOrder = (order: PurchaseOrder) => {
    const editionIds = [...new Set(order.items.map(i => i.editionId))];
    const courseIds = [...new Set(editionIds.map(eid => data.editions.find(e => e.id === eid)?.courseId).filter(Boolean))];
    return courseIds.map(cid => data.courses.find(c => c.id === cid)?.title).filter(Boolean);
  };

  const totalBudget = filteredSuppliers.reduce((a, b) => a + b.contractValue, 0);
  const totalPlanned = data.orders.filter(o => !selectedSupplierId || o.supplierId === selectedSupplierId).reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.plannedCost, 0), 0);
  const totalActual = data.orders.filter(o => !selectedSupplierId || o.supplierId === selectedSupplierId).reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.actualCost, 0), 0);
  const totalResidual = Math.max(0, totalBudget - Math.max(totalPlanned, totalActual));

  const handleAiAnalysis = async () => {
    setLoadingAi(true);
    const dataToAnalyze = selectedSupplierId 
        ? { ...data, suppliers: filteredSuppliers, orders: data.orders.filter(o => o.supplierId === selectedSupplierId) }
        : data;
    const result = await analyzeProcurementData(dataToAnalyze);
    setAiAnalysis(result);
    setLoadingAi(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col justify-between items-start gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
         <div className="w-full flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="flex items-center gap-3">
               <div className="bg-blue-50 p-2 rounded-lg">
                 <ShieldCheck className="text-blue-600 h-6 w-6" />
               </div>
               <div>
                 <h2 className="text-2xl font-bold text-gray-800">Dashboard Finanziaria</h2>
                 <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1 text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                       <Lock size={10}/> Database Protetto RLS
                    </span>
                    <button onClick={() => setShowSecurityInfo(!showSecurityInfo)} className="text-gray-400 hover:text-blue-600 transition-colors">
                        <Info size={14}/>
                    </button>
                 </div>
               </div>
             </div>
             
             <button 
              onClick={handleAiAnalysis}
              disabled={loadingAi}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:opacity-90 transition-all disabled:opacity-50 shadow-md whitespace-nowrap font-bold text-sm"
            >
              {loadingAi ? <Loader2 className="animate-spin h-5 w-5"/> : <Bot className="h-5 w-5" />}
              {loadingAi ? 'Analisi in corso...' : 'Chiedi all\'AI'}
            </button>
         </div>

         {showSecurityInfo && (
             <div className="w-full bg-blue-50 border border-blue-200 p-3 rounded-lg text-xs text-blue-800 animate-in fade-in slide-in-from-top-2">
                 <p className="font-bold mb-1 flex items-center gap-1"><ShieldCheck size={14}/> Sicurezza Row Level attivi</p>
                 I dati visualizzati sono filtrati a livello di database. Ogni richiesta API include il tuo token di identità cifrato. Accessi non autorizzati o tentativi di manipolazione diretta via URL sono bloccati dal firewall Supabase.
             </div>
         )}

         {/* Global Filters */}
         <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
             <div className="flex flex-col">
                <label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Filter size={12}/> Filtra Fornitore</label>
                <select 
                  className="bg-gray-50 border border-gray-300 text-sm font-medium rounded-md p-2 text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                >
                  <option value="">-- Tutti i Fornitori --</option>
                  {data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.contractNumber})</option>)}
                </select>
             </div>

             <div className="flex flex-col">
                 <label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Calendar size={12}/> Data Inizio Periodo</label>
                 <input 
                    type="date" 
                    className="bg-gray-50 border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                 />
             </div>

             <div className="flex flex-col">
                 <label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Calendar size={12}/> Data Fine Periodo</label>
                 <input 
                    type="date" 
                    className="bg-gray-50 border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                 />
             </div>
         </div>
      </div>

      {aiAnalysis && (
        <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-purple-500 animate-in zoom-in-95 duration-300">
          <h3 className="font-semibold text-lg mb-2 flex items-center gap-2 text-purple-700">
            <Bot className="h-5 w-5" /> Insight Finanziari Gemini {selectedSupplierId ? '(Filtrato)' : ''}
          </h3>
          <div className="prose text-gray-700 whitespace-pre-line leading-relaxed italic">
            {aiAnalysis}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Budget Totale</p>
          <p className="text-2xl font-bold text-gray-800">€ {totalBudget.toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest mb-1">Pianificato</p>
          <p className="text-2xl font-bold text-blue-600">€ {totalPlanned.toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <p className="text-green-400 text-[10px] font-bold uppercase tracking-widest mb-1">Speso (Consuntivato)</p>
          <p className="text-2xl font-bold text-green-600">€ {totalActual.toLocaleString()}</p>
        </div>
         <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <p className="text-amber-400 text-[10px] font-bold uppercase tracking-widest mb-1">Disponibile (Residuo)</p>
          <p className={`text-2xl font-bold ${totalResidual < 0 ? 'text-red-600' : 'text-amber-600'}`}>€ {totalResidual.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-md h-96 border border-gray-100">
          <h3 className="text-lg font-bold mb-4 text-gray-700 flex items-center gap-2">
              <RefreshCcw size={18} className="text-blue-500"/> Composizione Budget per Fornitore
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={supplierStats} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis type="number" hide/>
              <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 'bold'}} />
              <Tooltip 
                cursor={{fill: '#f8fafc'}}
                formatter={(value) => `€ ${Number(value).toLocaleString()}`}
                labelFormatter={(label) => {
                     const item = supplierStats.find(s => s.name === label);
                     return `${label} [${item?.contractNum}]`;
                }}
                contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
              />
              <Legend />
              {/* Istogramma a barre impilate per allineamento coerenza */}
              <Bar dataKey="Consuntivato" fill={STATUS_COLORS.actual} stackId="budget" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Impegnato Residuo" fill={STATUS_COLORS.planned} stackId="budget" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Disponibile" fill={STATUS_COLORS.available} stackId="budget" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md h-96 border border-gray-100">
          <h3 className="text-lg font-bold mb-4 text-gray-700">Ripartizione Budget {selectedSupplierId ? '(Selezionato)' : '(Totale)'}</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: 'Consuntivato', value: totalActual },
                  { name: 'Impegnato (Non Speso)', value: Math.max(0, totalPlanned - totalActual) },
                  { name: 'Disponibile', value: Math.max(0, totalBudget - Math.max(totalPlanned, totalActual)) }
                ]}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={100}
                fill="#8884d8"
                paddingAngle={8}
                dataKey="value"
                label={({name, percent}) => `${(percent * 100).toFixed(0)}%`}
              >
                <Cell fill={STATUS_COLORS.actual} />
                <Cell fill={STATUS_COLORS.planned} />
                <Cell fill={STATUS_COLORS.available} />
              </Pie>
              <Tooltip formatter={(value) => `€ ${Number(value).toLocaleString()}`} contentStyle={{borderRadius: '12px'}} />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabella Riepilogo Analitico */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="p-5 border-b flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <ListOrdered size={18} className="text-indigo-500"/> Riepilogo Analitico Ordini & Corsi
              </h3>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-white border px-2 py-1 rounded">
                  {filteredOrders.length} Schede trovate
              </span>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="text-[10px] font-bold text-gray-400 uppercase bg-white border-b">
                      <tr>
                          <th className="px-6 py-3">Fornitore</th>
                          <th className="px-6 py-3">Scheda / Ordine</th>
                          <th className="px-6 py-3">Corsi Associati</th>
                          <th className="px-6 py-3 text-right">Budget Pianificato</th>
                          <th className="px-6 py-3 text-right">Importo Consuntivato</th>
                          <th className="px-6 py-3 text-center">Status</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y">
                      {filteredOrders.map(order => {
                          const supplier = data.suppliers.find(s => s.id === order.supplierId);
                          const courses = getCoursesForOrder(order);
                          const totalPlan = order.isGeneric ? Math.max(order.plannedAmount || 0, order.items.reduce((s,i) => s+i.plannedCost, 0)) : order.items.reduce((s,i) => s+i.plannedCost, 0);
                          const totalAct = order.isGeneric ? (order.items.reduce((s,i) => s+i.actualCost, 0) > 0 ? order.items.reduce((s,i) => s+i.actualCost, 0) : order.actualAmount) : order.items.reduce((s,i) => s+i.actualCost, 0);

                          return (
                              <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-6 py-4 font-semibold text-gray-600">{supplier?.name || 'N/A'}</td>
                                  <td className="px-6 py-4">
                                      <div className="flex flex-col">
                                          <span className="font-bold text-gray-800">{order.title}</span>
                                          <span className="text-[10px] text-gray-400 font-mono">{new Date(order.createdAt).toLocaleDateString()}</span>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4">
                                      <div className="flex flex-wrap gap-1">
                                          {courses.length > 0 ? courses.map((c, idx) => (
                                              <span key={idx} className="inline-flex items-center gap-1 text-[9px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 font-bold whitespace-nowrap">
                                                  <GraduationCap size={10}/> {c}
                                              </span>
                                          )) : <span className="text-gray-300 italic text-[10px]">Nessun corso</span>}
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 text-right font-mono font-bold text-gray-600">€ {totalPlan.toLocaleString()}</td>
                                  <td className="px-6 py-4 text-right font-mono font-bold text-green-600">€ {totalAct.toLocaleString()}</td>
                                  <td className="px-6 py-4 text-center">
                                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${order.status === 'Chiuso/EM' ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'}`}>
                                          {order.status}
                                      </span>
                                  </td>
                              </tr>
                          );
                      })}
                      {filteredOrders.length === 0 && (
                          <tr>
                              <td colSpan={6} className="px-6 py-20 text-center text-gray-400 italic">
                                  Nessun ordine trovato per i criteri selezionati.
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};
