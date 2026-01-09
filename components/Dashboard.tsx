
import React, { useState, useEffect } from 'react';
import { AppData, PurchaseOrder, WorkflowStatus } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { analyzeProcurementData } from '../services/geminiService';
import { 
  Bot, RefreshCcw, Loader2, ShieldCheck, Lock, Key, AlertTriangle, 
  List, TrendingUp, ChevronDown, ChevronRight, ExternalLink, BookOpen, ShoppingBag 
} from 'lucide-react';

interface DashboardProps {
  data: AppData;
}

const STATUS_COLORS = {
  actual: '#10b981',    
  planned: '#3b82f6',   
  budget: '#f59e0b'     
};

export const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [loadingAi, setLoadingAi] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [hasKey, setHasKey] = useState<boolean>(true);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({});
  
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore - window.aistudio is provided globally by the environment
      if (window.aistudio) {
        // @ts-ignore
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected || !!process.env.API_KEY);
      }
    };
    checkKey();
  }, []);

  const toggleSupplier = (id: string) => {
    setExpandedSuppliers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenKeySelector = async () => {
    // @ts-ignore
    if (window.aistudio) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setHasKey(true);
      setAiAnalysis(""); 
    }
  };

  const filteredSuppliers = data.suppliers.filter(s => {
    if (selectedSupplierId && s.id !== selectedSupplierId) return false;
    return true;
  });

  const supplierStats = filteredSuppliers.map(s => {
    const orders = data.orders.filter(o => {
        const matchesSupplier = o.supplierId === s.id;
        const matchesDate = (!startDate || o.createdAt >= startDate) && (!endDate || o.createdAt <= endDate);
        return matchesSupplier && matchesDate;
    });
    
    const planned = orders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.plannedCost, 0), 0);
    const actual = orders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.actualCost, 0), 0);
    const impegnatoNetto = Math.max(0, planned - actual);
    const residuo = Math.max(0, s.contractValue - Math.max(planned, actual));
    const consumoPercent = s.contractValue > 0 ? (Math.max(planned, actual) / s.contractValue) * 100 : 0;

    return {
      id: s.id,
      name: s.name,
      contractValue: s.contractValue,
      "Consuntivato": actual,
      "Impegnato": impegnatoNetto,
      "Budget": residuo,
      consumoPercent,
      orders // Passiamo gli ordini filtrati per il drill-down
    };
  });

  const handleAiAnalysis = async () => {
    setLoadingAi(true);
    setAiAnalysis(""); 
    try {
        const result = await analyzeProcurementData(data);
        if (result === "CONFIG_REQUIRED" || result === "KEY_DISABLED") {
            setHasKey(false);
            setAiAnalysis(result === "KEY_DISABLED" 
                ? "La chiave API attuale non è valida o è stata disabilitata. Clicca su 'Configura API Key' per selezionare una chiave valida da un progetto paid." 
                : "Configurazione API Key richiesta per procedere con l'analisi.");
        } else {
            setAiAnalysis(result);
        }
    } catch (err) {
        setAiAnalysis("Errore durante l'analisi.");
    } finally {
        setLoadingAi(false);
    }
  };

  const totalBudget = filteredSuppliers.reduce((a, b) => a + b.contractValue, 0);
  const totalPlanned = supplierStats.reduce((acc, s) => acc + s.Impegnato + s.Consuntivato, 0);
  const totalActual = supplierStats.reduce((acc, s) => acc + s.Consuntivato, 0);
  const totalResidual = supplierStats.reduce((acc, s) => acc + s.Budget, 0);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header & Controls */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
         <div className="flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="flex items-center gap-3">
               <div className="bg-blue-50 p-2 rounded-lg">
                 <ShieldCheck className="text-blue-600 h-6 w-6" />
               </div>
               <div>
                 <h2 className="text-2xl font-bold text-gray-800">Dashboard Monitoraggio</h2>
                 <div className="flex items-center gap-2 mt-0.5">
                    <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${hasKey ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                       <Lock size={10}/> {hasKey ? 'API Connessa' : 'API Non Configurata'}
                    </span>
                    {!hasKey && (
                      <button onClick={handleOpenKeySelector} className="flex items-center gap-1 text-[9px] bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full uppercase hover:bg-blue-700 transition-colors shadow-sm">
                        <Key size={10}/> Configura API Key
                      </button>
                    )}
                 </div>
               </div>
             </div>
             
             <div className="flex items-center gap-2">
                <button 
                  onClick={handleAiAnalysis}
                  disabled={loadingAi}
                  className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-2.5 rounded-xl hover:opacity-90 transition-all disabled:opacity-50 shadow-lg whitespace-nowrap font-bold text-sm"
                >
                  {loadingAi ? <Loader2 className="animate-spin h-5 w-5"/> : <Bot className="h-5 w-5" />}
                  Analisi Strategica AI
                </button>
             </div>
         </div>

         <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 mt-4 border-t">
             <div className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">Filtro Fornitore</label>
                <select className="bg-gray-50 border border-gray-200 text-sm font-medium rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}>
                  <option value="">Tutti i Fornitori</option>
                  {data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
             </div>
             <div className="flex flex-col">
                 <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">Periodo Ordini Da</label>
                 <input type="date" className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm" value={startDate} onChange={e => setStartDate(e.target.value)}/>
             </div>
             <div className="flex flex-col">
                 <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">Periodo Ordini A</label>
                 <input type="date" className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm" value={endDate} onChange={e => setEndDate(e.target.value)}/>
             </div>
         </div>
      </div>

      {aiAnalysis && (
        <div className={`p-6 rounded-xl shadow-md border-l-4 animate-in zoom-in-95 duration-300 ${!hasKey ? 'bg-red-50 border-red-500' : 'bg-white border-purple-500'}`}>
          <h3 className={`font-semibold text-lg mb-2 flex items-center gap-2 ${!hasKey ? 'text-red-700' : 'text-purple-700'}`}>
            {(!hasKey || aiAnalysis.includes("KEY_DISABLED")) ? <AlertTriangle className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
            {(!hasKey || aiAnalysis.includes("KEY_DISABLED")) ? 'Problema Configurazione API' : 'Insight Strategici AI'}
          </h3>
          <div className={`text-sm leading-relaxed ${!hasKey ? 'text-red-800' : 'text-gray-700 italic'}`}>
            {aiAnalysis}
            {(!hasKey || aiAnalysis.includes("KEY_DISABLED")) && (
              <div className="mt-4">
                <button onClick={handleOpenKeySelector} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-red-700 shadow-md">
                  Seleziona nuova chiave API
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Budget Contrattuale', val: totalBudget, color: 'text-gray-800' },
          { label: 'Impegnato Totale', val: totalPlanned, color: 'text-blue-600' },
          { label: 'Consuntivato Totale', val: totalActual, color: 'text-green-600' },
          { label: 'Budget (Residuo)', val: totalResidual, color: totalResidual < 0 ? 'text-red-600' : 'text-amber-600' },
        ].map((card, idx) => (
          <div key={idx} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>€ {card.val.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-md h-96 border border-gray-100">
          <h3 className="text-lg font-bold mb-4 text-gray-700 flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-500"/> Analisi Fornitori (€)
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={supplierStats} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis type="number" hide/>
              <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 'bold'}} />
              <Tooltip 
                cursor={{fill: '#f8fafc'}}
                formatter={(value) => `€ ${Number(value).toLocaleString()}`}
                contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
              />
              <Legend />
              <Bar dataKey="Consuntivato" fill={STATUS_COLORS.actual} stackId="a" />
              <Bar dataKey="Impegnato" fill={STATUS_COLORS.planned} stackId="a" />
              <Bar dataKey="Budget" fill={STATUS_COLORS.budget} stackId="a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md h-96 border border-gray-100">
          <h3 className="text-lg font-bold mb-4 text-gray-700 text-center">Ripartizione Complessiva</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: 'Consuntivato', value: totalActual },
                  { name: 'Impegnato', value: Math.max(0, totalPlanned - totalActual) },
                  { name: 'Budget', value: Math.max(0, totalBudget - Math.max(totalPlanned, totalActual)) }
                ]}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={100}
                paddingAngle={8}
                dataKey="value"
                label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                <Cell fill={STATUS_COLORS.actual} />
                <Cell fill={STATUS_COLORS.planned} />
                <Cell fill={STATUS_COLORS.budget} />
              </Pie>
              <Tooltip formatter={(value) => `€ ${Number(value).toLocaleString()}`} />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data Table Section with Drill-Down */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                <List size={18} className="text-primary"/> Analisi Analitica Fornitori & Ordini
            </h3>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Espandi riga per dettaglio ordini</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 w-10"></th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider">Fornitore</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider">Budget Contrattuale</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider text-blue-600">Impegnato</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider text-green-600">Consuntivato</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider text-amber-600">Residuo Libero</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider w-32">Utilizzo %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {supplierStats.map((s) => (
                <React.Fragment key={s.id}>
                  {/* Riga Principale Fornitore */}
                  <tr 
                    className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                    onClick={() => toggleSupplier(s.id)}
                  >
                    <td className="px-6 py-4">
                      {expandedSuppliers[s.id] ? <ChevronDown size={18} className="text-blue-500" /> : <ChevronRight size={18} className="text-gray-400" />}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800">{s.name}</span>
                        <span className="text-[9px] text-gray-400 font-bold uppercase">{s.orders.length} Schede Ordine</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-600">€ {s.contractValue.toLocaleString()}</td>
                    <td className="px-6 py-4 font-mono text-xs font-bold text-blue-600">€ {s.Impegnato.toLocaleString()}</td>
                    <td className="px-6 py-4 font-mono text-xs font-bold text-green-600">€ {s.Consuntivato.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`font-mono text-xs font-bold ${s.Budget <= 1000 ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50'} px-2 py-1 rounded`}>
                          € {s.Budget.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-[10px] font-bold text-gray-400">
                              <span>{s.consumoPercent.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                              <div 
                                  className={`h-full transition-all duration-500 ${s.consumoPercent > 90 ? 'bg-red-500' : s.consumoPercent > 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                                  style={{ width: `${Math.min(100, s.consumoPercent)}%` }}
                              ></div>
                          </div>
                      </div>
                    </td>
                  </tr>

                  {/* Riga Dettaglio Ordini (Drill-down) */}
                  {expandedSuppliers[s.id] && (
                    <tr className="bg-gray-50/50 animate-in slide-in-from-top-2 duration-300">
                      <td colSpan={7} className="px-12 py-6 border-l-4 border-blue-500">
                        <div className="flex items-center gap-2 mb-4 text-xs font-bold text-blue-700 uppercase tracking-widest">
                          <ShoppingBag size={14}/> Elenco Schede d'Acquisto Associate
                        </div>
                        
                        {s.orders.length === 0 ? (
                          <div className="text-gray-400 text-xs italic py-4">Nessun ordine presente per il periodo selezionato.</div>
                        ) : (
                          <div className="grid grid-cols-1 gap-4">
                            {s.orders.map((order: PurchaseOrder) => {
                              const orderPlanned = order.items.reduce((sum, i) => sum + i.plannedCost, 0);
                              const orderActual = order.items.reduce((sum, i) => sum + i.actualCost, 0);
                              
                              // Estrai i corsi unici in questo ordine
                              const courseIds = [...new Set(order.items.map(item => {
                                const ed = data.editions.find(e => e.id === item.editionId);
                                return ed?.courseId;
                              }).filter(Boolean))];
                              
                              const courseTitles = courseIds.map(cid => data.courses.find(c => c.id === cid)?.title).filter(Boolean);

                              return (
                                <div key={order.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-blue-200 transition-colors">
                                  <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-3">
                                      <span className="font-bold text-gray-800 text-sm">{order.title}</span>
                                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${order.status === WorkflowStatus.CLOSED ? 'bg-gray-200 text-gray-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {order.status}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {courseTitles.map((title, i) => (
                                        <span key={i} className="flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                                          <BookOpen size={10} /> {title}
                                        </span>
                                      ))}
                                      {courseTitles.length === 0 && <span className="text-[10px] text-gray-400 italic">Nessun corso specifico (Acquisto generico)</span>}
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-medium">
                                      Creato il: {new Date(order.createdAt).toLocaleDateString()} • RDA: {order.rdaCode || 'N/A'} • ODA: {order.odaCode || 'N/A'}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-6">
                                    <div className="text-right">
                                      <div className="text-[9px] text-gray-400 font-bold uppercase">Pianificato</div>
                                      <div className="text-xs font-mono font-bold text-blue-600">€ {orderPlanned.toLocaleString()}</div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-[9px] text-gray-400 font-bold uppercase">Consuntivato</div>
                                      <div className="text-xs font-mono font-bold text-green-600">€ {orderActual.toLocaleString()}</div>
                                    </div>
                                    <div className="pl-4 border-l border-gray-100">
                                      <button className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="Vai all'ordine">
                                        <ExternalLink size={16} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {supplierStats.length === 0 && (
                <tr>
                    <td colSpan={7} className="px-6 py-20 text-center text-gray-400 italic">Nessun dato corrispondente ai filtri.</td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-gray-50/50 font-bold border-t-2 border-gray-100">
                <tr>
                    <td className="px-6 py-4"></td>
                    <td className="px-6 py-4 text-gray-800">TOTALE COMPLESSIVO</td>
                    <td className="px-6 py-4 font-mono text-sm">€ {totalBudget.toLocaleString()}</td>
                    <td className="px-6 py-4 font-mono text-sm text-blue-600">€ {supplierStats.reduce((a,b) => a + b.Impegnato, 0).toLocaleString()}</td>
                    <td className="px-6 py-4 font-mono text-sm text-green-600">€ {totalActual.toLocaleString()}</td>
                    <td className="px-6 py-4 font-mono text-sm text-amber-600">€ {totalResidual.toLocaleString()}</td>
                    <td className="px-6 py-4"></td>
                </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
