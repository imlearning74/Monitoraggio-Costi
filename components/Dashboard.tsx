
import React, { useState } from 'react';
import { AppData, Supplier, PurchaseOrder } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { analyzeProcurementData } from '../services/geminiService';
import { Bot, RefreshCcw, Loader2, Filter, Calendar } from 'lucide-react';

interface DashboardProps {
  data: AppData;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [loadingAi, setLoadingAi] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  
  // Date Range Filter State
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Filter logic:
  // 1. Filter by Supplier Selection
  // 2. Filter by Date Range (Check if Supplier Contract overlaps with the range)
  const filteredSuppliers = data.suppliers.filter(s => {
    // Check ID Selection
    if (selectedSupplierId && s.id !== selectedSupplierId) return false;

    // Check Date Overlap
    // Overlap logic: (StartA <= EndB) and (EndA >= StartB)
    if (startDate && endDate) {
        if (!s.contractStart || !s.contractEnd) return false; // Can't determine overlap without dates
        const filterStart = new Date(startDate);
        const filterEnd = new Date(endDate);
        const contractStart = new Date(s.contractStart);
        const contractEnd = new Date(s.contractEnd);

        // Ensure validity
        return contractStart <= filterEnd && contractEnd >= filterStart;
    }

    return true;
  });

  // Prepare Data for Charts based on filtered suppliers
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

  // Calculate Aggregates for Cards
  const totalBudget = supplierStats.reduce((a,b) => a + b.Budget, 0);
  const totalPlanned = supplierStats.reduce((a,b) => a + b.Pianificato, 0);
  const totalActual = supplierStats.reduce((a,b) => a + b.Consuntivato, 0);
  const totalResidual = supplierStats.reduce((a,b) => a + b.Residuo, 0);

  const handleAiAnalysis = async () => {
    setLoadingAi(true);
    // Pass only filtered data to AI if filter is active, otherwise full data
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
             <div>
               <h2 className="text-2xl font-bold text-gray-800">Dashboard Finanziaria</h2>
               <p className="text-sm text-gray-500">Monitoraggio budget e stato avanzamento lavori</p>
             </div>
             
             <button 
              onClick={handleAiAnalysis}
              disabled={loadingAi}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:opacity-90 transition-all disabled:opacity-50 shadow-md whitespace-nowrap"
            >
              {loadingAi ? <Loader2 className="animate-spin h-5 w-5"/> : <Bot className="h-5 w-5" />}
              {loadingAi ? 'Analisi in corso...' : 'Chiedi all\'AI'}
            </button>
         </div>

         {/* Global Filters */}
         <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
             {/* Supplier Filter */}
             <div className="flex flex-col">
                <label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Filter size={12}/> Filtra Fornitore</label>
                <select 
                  className="bg-gray-50 border border-gray-300 text-sm font-medium rounded-md p-2 text-gray-700"
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                >
                  <option value="">-- Tutti i Fornitori --</option>
                  {data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.contractNumber})</option>)}
                </select>
             </div>

             {/* Date Filter (Start) */}
             <div className="flex flex-col">
                 <label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Calendar size={12}/> Data Inizio Periodo</label>
                 <input 
                    type="date" 
                    className="bg-gray-50 border border-gray-300 rounded-md p-2 text-sm"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                 />
             </div>

             {/* Date Filter (End) */}
             <div className="flex flex-col">
                 <label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Calendar size={12}/> Data Fine Periodo</label>
                 <input 
                    type="date" 
                    className="bg-gray-50 border border-gray-300 rounded-md p-2 text-sm"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                 />
             </div>
         </div>
         {startDate && endDate && (
             <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded w-full">
                 Visualizzazione Fornitori con contratti validi tra il {new Date(startDate).toLocaleDateString()} e il {new Date(endDate).toLocaleDateString()}
             </div>
         )}
      </div>

      {aiAnalysis && (
        <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-purple-500">
          <h3 className="font-semibold text-lg mb-2 flex items-center gap-2 text-purple-700">
            <Bot className="h-5 w-5" /> Insight Finanziari Gemini {selectedSupplierId ? '(Filtrato)' : ''}
          </h3>
          <div className="prose text-gray-700 whitespace-pre-line">
            {aiAnalysis}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-gray-500">
          <p className="text-gray-500 text-sm font-semibold uppercase">Budget Totale</p>
          <p className="text-2xl font-bold text-gray-800">€ {totalBudget.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-gray-500 text-sm font-semibold uppercase">Impegnato (Pianif.)</p>
          <p className="text-2xl font-bold text-blue-600">€ {totalPlanned.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-gray-500 text-sm font-semibold uppercase">Speso (Consunt.)</p>
          <p className="text-2xl font-bold text-green-600">€ {totalActual.toLocaleString()}</p>
        </div>
         <div className="bg-white p-4 rounded-lg shadow border-l-4 border-indigo-500">
          <p className="text-gray-500 text-sm font-semibold uppercase">Residuo Contrattuale</p>
          <p className={`text-2xl font-bold ${totalResidual < 0 ? 'text-red-600' : 'text-indigo-600'}`}>€ {totalResidual.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Budget vs Actual vs Planned */}
        <div className="bg-white p-6 rounded-xl shadow-md h-96">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">Analisi Dettaglio Fornitori</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={supplierStats} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" hide/>
              <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
              <Tooltip 
                formatter={(value) => `€ ${Number(value).toLocaleString()}`}
                labelFormatter={(label) => {
                     const item = supplierStats.find(s => s.name === label);
                     return `${label} [${item?.contractNum}]`;
                }}
              />
              <Legend />
              <Bar dataKey="Budget" fill="#94a3b8" stackId="a" />
              <Bar dataKey="Pianificato" fill="#3b82f6" />
              <Bar dataKey="Consuntivato" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Residual Pie Chart (Aggregate) */}
        <div className="bg-white p-6 rounded-xl shadow-md h-96">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">Allocazione Budget {selectedSupplierId ? '(Selezionato)' : '(Globale)'}</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: 'Consuntivato', value: totalActual },
                  { name: 'Residuo Libero', value: Math.max(0, totalResidual) },
                  { name: 'Impegnato (Diff)', value: Math.max(0, totalPlanned - totalActual) }
                ]}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
                label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {supplierStats.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : index === 1 ? '#e2e8f0' : '#3b82f6'} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `€ ${Number(value).toLocaleString()}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};