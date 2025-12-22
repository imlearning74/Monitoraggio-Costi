
import React, { useState, useEffect } from 'react';
import { ViewState, AppData } from './types';
import { Dashboard } from './components/Dashboard';
import { SuppliersAndData } from './components/SuppliersAndData';
import { Courses } from './components/Courses';
import { Purchasing } from './components/Purchasing';
import { Login } from './components/Login';
import { LayoutDashboard, Users, BookOpen, ShoppingCart, BarChart3, Menu, Loader2, LogOut, ShieldCheck, Lock } from 'lucide-react';
import { api, supabase } from './services/apiService';

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const session = await api.auth.getSession();
      setIsAuthenticated(!!session);
      setUserEmail(session?.user?.email || null);
      
      if (session) {
        await fetchData();
      } else {
        setLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setUserEmail(session?.user?.email || null);
      if (session) {
        fetchData();
      } else {
        setLoading(false);
        setData(INITIAL_DATA);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const dbData = await api.loadData();
    if (dbData) {
      setData(dbData);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await api.auth.signOut();
  };

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState, icon: any, label: string }) => (
    <button
      onClick={() => setCurrentView(view)}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
        currentView === view 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 translate-x-1' 
          : 'text-gray-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      <Icon size={20} />
      {sidebarOpen && <span className="font-medium">{label}</span>}
    </button>
  );

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center flex-col gap-4 text-gray-500 bg-primary">
        <div className="relative">
          <Loader2 className="animate-spin h-12 w-12 text-blue-500"/>
          <Lock className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 text-white opacity-50" />
        </div>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Verifica Crittografia Sessione...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-primary text-white transition-all duration-300 flex flex-col shadow-2xl z-20`}>
        <div className="p-6 flex items-center justify-between border-b border-white/5">
           {sidebarOpen ? (
             <h1 className="text-xl font-bold tracking-tight">Monitoraggio<span className="text-blue-500">Costi</span></h1>
           ) : (
             <h1 className="text-xl font-bold text-blue-500 text-center w-full">MC</h1>
           )}
        </div>
        <nav className="flex-1 mt-6 px-3 space-y-1">
          <NavItem view={ViewState.DASHBOARD} icon={LayoutDashboard} label="Dashboard" />
          <NavItem view={ViewState.SUPPLIERS} icon={Users} label="Anagrafiche" />
          <NavItem view={ViewState.COURSES} icon={BookOpen} label="Catalogo" />
          <NavItem view={ViewState.PURCHASING} icon={ShoppingCart} label="Ordini" />
          <NavItem view={ViewState.RECONCILIATION} icon={BarChart3} label="Consuntivi" />
        </nav>
        
        <div className="p-4 border-t border-white/5">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-400 hover:bg-red-500/10 transition-colors rounded-xl font-bold text-sm mb-4"
          >
            <LogOut size={20} />
            {sidebarOpen && <span>Esci dal sistema</span>}
          </button>
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center p-2 bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <Menu size={20}/>
          </button>
          {sidebarOpen && <p className="mt-4 text-[9px] text-gray-600 text-center uppercase font-bold tracking-[0.2em]">Procurement System 1.1</p>}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col">
        <header className="bg-white/80 backdrop-blur-md border-b p-4 px-8 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-800 tracking-tight">
              {currentView === ViewState.DASHBOARD && 'Dashboard Finanziaria'}
              {currentView === ViewState.SUPPLIERS && 'Fornitori & Servizi'}
              {currentView === ViewState.COURSES && 'Offerta Formativa'}
              {currentView === ViewState.PURCHASING && 'Gestione Acquisti'}
              {currentView === ViewState.RECONCILIATION && 'Consuntivazione Merci'}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-gray-800">{userEmail?.split('@')[0] || 'Amministratore'}</p>
                <div className="flex items-center justify-end gap-1.5">
                   <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                   </span>
                   <p className="text-[9px] text-green-600 font-black uppercase tracking-widest flex items-center gap-1">
                     <ShieldCheck size={10} /> Connessione Cifrata
                   </p>
                </div>
             </div>
             <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
                {userEmail?.[0].toUpperCase() || 'A'}
             </div>
          </div>
        </header>

        <div className="p-8 flex-1">
          <div className="max-w-7xl mx-auto">
            {currentView === ViewState.DASHBOARD && <Dashboard data={data} />}
            {currentView === ViewState.SUPPLIERS && <SuppliersAndData data={data} setData={setData} />}
            {currentView === ViewState.COURSES && <Courses data={data} setData={setData} />}
            {currentView === ViewState.PURCHASING && <Purchasing data={data} setData={setData} mode="workflow" />}
            {currentView === ViewState.RECONCILIATION && <Purchasing data={data} setData={setData} mode="reconciliation" />}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
