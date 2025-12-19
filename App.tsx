
import React, { useState, useEffect } from 'react';
import { ViewState, AppData } from './types';
import { Dashboard } from './components/Dashboard';
import { SuppliersAndData } from './components/SuppliersAndData';
import { Courses } from './components/Courses';
import { Purchasing } from './components/Purchasing';
import { LayoutDashboard, Users, BookOpen, ShoppingCart, BarChart3, Menu, Loader2 } from 'lucide-react';
import { api } from './services/apiService';

const INITIAL_DATA: AppData = {
  suppliers: [],
  services: [],
  courses: [],
  editions: [],
  orders: []
};

function App() {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Load Data from Database on Mount
  useEffect(() => {
    const fetchData = async () => {
      const dbData = await api.loadData();
      if (dbData) {
        setData(dbData);
      } else {
        console.log("Using Empty State or Fallback");
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState, icon: any, label: string }) => (
    <button
      onClick={() => setCurrentView(view)}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
        currentView === view ? 'bg-accent text-white' : 'text-gray-300 hover:bg-secondary'
      }`}
    >
      <Icon size={20} />
      {sidebarOpen && <span>{label}</span>}
    </button>
  );

  if (loading) {
      return <div className="h-screen w-full flex items-center justify-center flex-col gap-4 text-gray-500">
          <Loader2 className="animate-spin h-8 w-8 text-blue-600"/>
          <p>Caricamento dati dal Database...</p>
      </div>;
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-primary text-white transition-all duration-300 flex flex-col shadow-xl z-10`}>
        <div className="p-4 flex items-center justify-between border-b border-gray-700">
           {sidebarOpen ? <h1 className="text-xl font-bold tracking-tight">Monitoraggio<span className="text-accent">Costi</span></h1> : <h1 className="text-xl font-bold">MC</h1>}
           <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white"><Menu size={20}/></button>
        </div>
        <nav className="flex-1 mt-6 space-y-1">
          <NavItem view={ViewState.DASHBOARD} icon={LayoutDashboard} label="Dashboard" />
          <NavItem view={ViewState.SUPPLIERS} icon={Users} label="Fornitori & Catalogo" />
          <NavItem view={ViewState.COURSES} icon={BookOpen} label="Corsi & Edizioni" />
          <NavItem view={ViewState.PURCHASING} icon={ShoppingCart} label="Acquisti & Workflow" />
          <NavItem view={ViewState.RECONCILIATION} icon={BarChart3} label="Consuntivazione" />
        </nav>
        <div className="p-4 border-t border-gray-700 text-xs text-gray-400">
          {sidebarOpen && <p>&copy; 2023 Monitoraggio Costi</p>}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-0">
          <h2 className="text-lg font-semibold text-gray-800">
            {currentView === ViewState.DASHBOARD && 'Panoramica'}
            {currentView === ViewState.SUPPLIERS && 'Gestione Dati'}
            {currentView === ViewState.COURSES && 'Offerta Formativa'}
            {currentView === ViewState.PURCHASING && 'Gestione Ordini'}
            {currentView === ViewState.RECONCILIATION && 'Consuntivi & Chiusure'}
          </h2>
          <div className="flex items-center gap-3">
             <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold">U</div>
          </div>
        </header>

        <div className="p-6 max-w-7xl mx-auto">
          {currentView === ViewState.DASHBOARD && <Dashboard data={data} />}
          {currentView === ViewState.SUPPLIERS && <SuppliersAndData data={data} setData={setData} />}
          {currentView === ViewState.COURSES && <Courses data={data} setData={setData} />}
          {currentView === ViewState.PURCHASING && <Purchasing data={data} setData={setData} mode="workflow" />}
          {currentView === ViewState.RECONCILIATION && <Purchasing data={data} setData={setData} mode="reconciliation" />}
        </div>
      </main>
    </div>
  );
}

export default App;
