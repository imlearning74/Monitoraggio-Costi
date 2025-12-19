import React, { useState } from 'react';
import { AppData, Course } from '../types';
import { Plus, Filter, Upload, Trash2, Edit, Check, X, Search, ArrowUpDown } from 'lucide-react';
import { api } from '../services/apiService';
import * as XLSX from 'xlsx';

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
}

export const Courses: React.FC<Props> = ({ data, setData }) => {
  const [courseForm, setCourseForm] = useState<Partial<Course>>({});
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [importing, setImporting] = useState(false);

  const handleSaveCourse = async () => {
    if (!courseForm.title) return;
    
    const supplierId = selectedSupplierFilter || courseForm.supplierId;
    if (!supplierId) {
        alert("Seleziona un fornitore per associare questo corso.");
        return;
    }

    let courseToSave: Course;

    if (editingCourseId) {
        const existing = data.courses.find(c => c.id === editingCourseId);
        if(!existing) return;
        courseToSave = {
            ...existing,
            title: courseForm.title || '',
            lmsElementId: courseForm.lmsElementId || '',
            sifCode: courseForm.sifCode || ''
        };
        setData(prev => ({
            ...prev,
            courses: prev.courses.map(c => c.id === editingCourseId ? courseToSave : c)
        }));
        setEditingCourseId(null);
    } else {
        courseToSave = {
          id: crypto.randomUUID(),
          supplierId,
          title: courseForm.title || '',
          lmsElementId: courseForm.lmsElementId || '',
          sifCode: courseForm.sifCode || ''
        };
        setData(prev => ({...prev, courses: [...prev.courses, courseToSave]}));
    }
    
    await api.mutate('UPSERT_COURSE', courseToSave);
    setCourseForm({ title: '', lmsElementId: '', sifCode: '' });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSupplierFilter) {
        if (!selectedSupplierFilter) alert("Seleziona prima un fornitore!");
        return;
    }
    setImporting(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
          
          const dataRows = rows.slice(1).filter(r => r.length > 0 && r[0]);

          const newCourses = dataRows.map(cols => ({
              id: crypto.randomUUID(),
              supplierId: selectedSupplierFilter,
              title: String(cols[0] || '').trim(),
              lmsElementId: String(cols[1] || '').trim(),
              sifCode: String(cols[2] || '').trim()
          } as Course));

          setData(prev => ({...prev, courses: [...prev.courses, ...newCourses]}));
          for(const c of newCourses) await api.mutate('UPSERT_COURSE', c);
          alert(`${newCourses.length} corsi importati correttamente.`);
      } catch (err) {
          console.error(err);
          alert("Errore durante l'importazione.");
      } finally {
          setImporting(false);
          e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const startEditing = (c: Course) => {
      setEditingCourseId(c.id);
      setCourseForm({ title: c.title, lmsElementId: c.lmsElementId, supplierId: c.supplierId, sifCode: c.sifCode });
  };

  const cancelEditing = () => {
      setEditingCourseId(null);
      setCourseForm({ title: '', lmsElementId: '', sifCode: '' });
  };

  const removeCourse = async (e: React.MouseEvent, id: string) => {
     e.preventDefault();
     e.stopPropagation(); 
     if(window.confirm("Eliminare questo corso?")){
         setData(prev => ({...prev, courses: prev.courses.filter(c => c.id !== id)}));
         await api.mutate('DELETE_COURSE', { id });
     }
  };

  const filteredCourses = data.courses
    .filter(c => {
        const matchesSupplier = selectedSupplierFilter ? c.supplierId === selectedSupplierFilter : true;
        const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (c.lmsElementId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                             (c.sifCode || '').toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSupplier && matchesSearch;
    })
    .sort((a, b) => sortOrder === 'asc' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title));

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
           <div><h2 className="text-xl font-bold text-gray-800">Catalogo Corsi</h2></div>
           <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
               <div className="relative"><Search className="absolute left-2 top-2.5 text-gray-400" size={16} /><input type="text" className="pl-8 pr-4 py-2 border rounded-lg text-sm w-full" placeholder="Cerca..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
               <div className="flex items-center gap-2 bg-indigo-50 p-2 rounded border border-indigo-100"><Filter className="text-indigo-600" size={18} /><select className="bg-transparent border-none text-sm font-medium" value={selectedSupplierFilter} onChange={(e) => setSelectedSupplierFilter(e.target.value)}><option value="">-- Seleziona Fornitore --</option>{data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
               {selectedSupplierFilter && (
                   <label className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg cursor-pointer hover:opacity-90 text-sm font-bold shadow-sm">
                       <Upload size={16}/> {importing ? '...' : 'Importa'}
                       <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} disabled={importing}/>
                   </label>
               )}
               <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="p-2 border rounded bg-gray-50"><ArrowUpDown size={20} className="text-gray-600" /></button>
           </div>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-4 gap-2 mb-6 items-end bg-gray-50 p-4 rounded border border-gray-200 shadow-sm ${editingCourseId ? 'bg-yellow-50 border-yellow-300' : ''}`}>
           <div className="md:col-span-1"><label className="text-[10px] text-gray-500 font-bold uppercase">Titolo Corso</label><input className="w-full border p-2 rounded text-sm bg-white" value={courseForm.title || ''} onChange={e => setCourseForm({...courseForm, title: e.target.value})} placeholder="Es. Excel Avanzato" /></div>
           <div><label className="text-[10px] text-gray-500 font-bold uppercase">ID LMS</label><input className="w-full border p-2 rounded text-sm bg-white" value={courseForm.lmsElementId || ''} onChange={e => setCourseForm({...courseForm, lmsElementId: e.target.value})} placeholder="ID-001" /></div>
           <div><label className="text-[10px] text-gray-500 font-bold uppercase">Sigla SIF</label><input className="w-full border p-2 rounded text-sm bg-white" value={courseForm.sifCode || ''} onChange={e => setCourseForm({...courseForm, sifCode: e.target.value})} placeholder="ABC-123" /></div>
           <div className="flex gap-2">
               <button onClick={handleSaveCourse} className={`${editingCourseId ? 'bg-yellow-500' : 'bg-accent'} text-white px-4 py-2 rounded h-[38px] font-bold flex-1 flex items-center justify-center gap-1`}>{editingCourseId ? <Check size={16} /> : <Plus size={16} />} {editingCourseId ? 'Salva' : 'Aggiungi'}</button>
               {editingCourseId && <button onClick={cancelEditing} className="bg-gray-300 text-gray-700 px-3 py-2 rounded h-[38px]"><X size={16} /></button>}
           </div>
        </div>

        <div className="grid gap-3">
          {filteredCourses.map(course => (
              <div key={course.id} className={`flex items-center justify-between bg-white p-4 rounded-lg border hover:shadow-md transition-shadow ${editingCourseId === course.id ? 'border-yellow-400 bg-yellow-50' : ''}`}>
                  <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-800">{course.title}</span>
                          <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">LMS: {course.lmsElementId || '-'}</span>
                          {course.sifCode && <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-bold">SIF: {course.sifCode}</span>}
                      </div>
                      {!selectedSupplierFilter && <div className="text-[10px] text-gray-400 mt-1 uppercase font-semibold">Fornitore: {data.suppliers.find(s => s.id === course.supplierId)?.name}</div>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEditing(course)} className="text-blue-500 p-2 hover:bg-blue-50 rounded-full transition-colors"><Edit size={18} /></button>
                    <button onClick={(e) => removeCourse(e, course.id)} className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition-colors"><Trash2 size={18} /></button>
                  </div>
              </div>
          ))}
          {filteredCourses.length === 0 && <div className="py-10 text-center text-gray-400 text-sm italic">Nessun corso trovato.</div>}
        </div>
      </div>
    </div>
  );
};
