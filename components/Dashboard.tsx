
import React, { useState } from 'react';
import { AppData, Supplier, PurchaseOrder } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { analyzeProcurementData } from '../services/geminiService';
import { Bot, RefreshCcw, Loader2, Filter, Calendar, ShieldCheck, Lock, Info } from 'lucide-react';

interface DashboardProps {
  data: AppData;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

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
    
    return {
      name: s.name,
      contractNum: s.contractNumber,
      Budget: s.contractValue,
      Pianificato: planned,
      Consuntivato: actual,
      Residuo: s.contractValue - actual
    };
  });

  const totalBudget = supplierStats.reduce((a,b) => a + b.Budget, 0);
  const totalPlanned = supplierStats.reduce((a,b) => a + b.Pianificato, 0);
  const totalActual = supplierStats.reduce((a,b) => a + b.Consuntivato, 0);
  const totalResidual = supplierStats.reduce((a,b) => a + b.Residuo, 0);

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
          <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest mb-1">Impegnato</p>
          <p className="text-2xl font-bold text-blue-600">€ {totalPlanned.toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <p className="text-green-400 text-[10px] font-bold uppercase tracking-widest mb-1">Speso</p>
          <p className="text-2xl font-bold text-green-600">€ {totalActual.toLocaleString()}</p>
        </div>
         <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest mb-1">Residuo</p>
          <p className={`text-2xl font-bold ${totalResidual < 0 ? 'text-red-600' : 'text-indigo-600'}`}>€ {totalResidual.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-md h-96 border border-gray-100">
          <h3 className="text-lg font-bold mb-4 text-gray-700 flex items-center gap-2">
              <RefreshCcw size={18} className="text-blue-500"/> Dettaglio per Fornitore
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
              <Bar dataKey="Budget" fill="#e2e8f0" stackId="a" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Pianificato" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Consuntivato" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md h-96 border border-gray-100">
          <h3 className="text-lg font-bold mb-4 text-gray-700">Allocazione Budget {selectedSupplierId ? '(Fornitore)' : '(Globale)'}</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: 'Consuntivato', value: totalActual },
                  { name: 'Residuo Libero', value: Math.max(0, totalResidual) },
                  { name: 'Impegnato (Non Consunt.)', value: Math.max(0, totalPlanned - totalActual) }
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
                <Cell fill="#10b981" />
                <Cell fill="#f1f5f9" />
                <Cell fill="#3b82f6" />
              </Pie>
              <Tooltip formatter={(value) => `€ ${Number(value).toLocaleString()}`} contentStyle={{borderRadius: '12px'}} />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
