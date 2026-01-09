
import React, { useState, useEffect } from 'react';
import { AppData, PurchaseOrder } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { analyzeProcurementData } from '../services/geminiService';
import { Bot, RefreshCcw, Loader2, Filter, Calendar, ShieldCheck, Lock, Info, Key, AlertTriangle } from 'lucide-react';

interface DashboardProps {
  data: AppData;
}

const STATUS_COLORS = {
  actual: '#10b981',    
  planned: '#3b82f6',   
  budget: '#f59e0b'     
};

// Removed the manual global declaration of window.aistudio because it conflicts with 
// the existing AIStudio type provided by the environment.

export const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [loadingAi, setLoadingAi] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [hasKey, setHasKey] = useState<boolean>(true);
  
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

  const handleOpenKeySelector = async () => {
    // @ts-ignore
    if (window.aistudio) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      // Assumiamo successo dopo l'apertura come da linee guida per evitare race conditions
      setHasKey(true);
      setAiAnalysis(""); // Resetta errori precedenti
    }
  };

  const filteredSuppliers = data.suppliers.filter(s => {
    if (selectedSupplierId && s.id !== selectedSupplierId) return false;
    return true;
  });

  const supplierStats = filteredSuppliers.map(s => {
    const orders = data.orders.filter(o => o.supplierId === s.id);
    const planned = orders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.plannedCost, 0), 0);
    const actual = orders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.actualCost, 0), 0);
    const residuo = Math.max(0, s.contractValue - Math.max(planned, actual));

    return {
      name: s.name,
      "Consuntivato": actual,
      "Impegnato": Math.max(0, planned - actual),
      "Budget": residuo
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
  const currentOrders = data.orders.filter(o => !selectedSupplierId || o.supplierId === selectedSupplierId);
  const totalPlanned = currentOrders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.plannedCost, 0), 0);
  const totalActual = currentOrders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.actualCost, 0), 0);
  const totalResidual = Math.max(0, totalBudget - Math.max(totalPlanned, totalActual));

  return (
    <div className="space-y-6 animate-fade-in">
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
                 <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">Da data</label>
                 <input type="date" className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm" value={startDate} onChange={e => setStartDate(e.target.value)}/>
             </div>
             <div className="flex flex-col">
                 <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">A data</label>
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
                <p className="mt-2 text-[10px] text-red-600">
                  Nota: Assicurati di selezionare una API key da un progetto GCP con fatturazione attiva (paid project) e consulta la documentazione billing di Gemini API.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Budget Contrattuale', val: totalBudget, color: 'text-gray-800' },
          { label: 'Impegnato', val: totalPlanned, color: 'text-blue-600' },
          { label: 'Consuntivato', val: totalActual, color: 'text-green-600' },
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
              <RefreshCcw size={18} className="text-blue-500"/> Analisi Fornitori (€)
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
    </div>
  );
};
