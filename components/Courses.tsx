
import React, { useState } from 'react';
import { AppData, Course } from '../types';
import { Plus, Filter, Upload, Trash2, Edit, Check, X, Search, ArrowUpDown } from 'lucide-react';
import { api } from '../services/apiService';

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
            lmsElementId: courseForm.lmsElementId || ''
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
          lmsElementId: courseForm.lmsElementId || ''
        };
        setData(prev => ({...prev, courses: [...prev.courses, courseToSave]}));
    }
    
    // API SYNC
    await api.mutate('UPSERT_COURSE', courseToSave);

    setCourseForm({ title: '', lmsElementId: '' });
  };

  const startEditing = (c: Course) => {
      setEditingCourseId(c.id);
      setCourseForm({ title: c.title, lmsElementId: c.lmsElementId, supplierId: c.supplierId });
  };

  const cancelEditing = () => {
      setEditingCourseId(null);
      setCourseForm({ title: '', lmsElementId: '' });
  };

  const removeCourse = async (e: React.MouseEvent, id: string) => {
     e.preventDefault();
     e.stopPropagation(); 
     if(window.confirm("Eliminare questo corso?")){
         setData(prev => ({...prev, courses: prev.courses.filter(c => c.id !== id)}));
         // API SYNC
         await api.mutate('DELETE_COURSE', { id });
     }
  };

  // ... (Keep existing filtering and UI structure)
  const filteredCourses = data.courses
    .filter(c => {
        const matchesSupplier = selectedSupplierFilter ? c.supplierId === selectedSupplierFilter : true;
        const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase()) || c.lmsElementId.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSupplier && matchesSearch;
    })
    .sort((a, b) => {
        return sortOrder === 'asc' 
            ? a.title.localeCompare(b.title) 
            : b.title.localeCompare(a.title);
    });

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
           <div><h2 className="text-xl font-bold">Catalogo Corsi</h2></div>
           <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
               <div className="relative"><Search className="absolute left-2 top-2.5 text-gray-400" size={16} /><input type="text" className="pl-8 pr-4 py-2 border rounded-lg text-sm w-full" placeholder="Cerca..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
               <div className="flex items-center gap-2 bg-indigo-50 p-2 rounded border border-indigo-100"><Filter className="text-indigo-600" size={18} /><select className="bg-transparent border-none text-sm font-medium" value={selectedSupplierFilter} onChange={(e) => setSelectedSupplierFilter(e.target.value)}><option value="">-- Seleziona Fornitore --</option>{data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
               <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="p-2 border rounded"><ArrowUpDown size={20} className="text-gray-600" /></button>
           </div>
        </div>

        {/* Form */}
        <div className={`flex gap-2 mb-6 items-end bg-white p-4 rounded border border-gray-200 shadow-sm ${editingCourseId ? 'bg-yellow-50 border-yellow-300' : ''}`}>
           {!selectedSupplierFilter && !editingCourseId && (
             <div className="w-1/4"><label className="text-xs text-gray-500 font-bold">Fornitore</label><select className="w-full border p-2 rounded text-sm" value={courseForm.supplierId || ''} onChange={e => setCourseForm({...courseForm, supplierId: e.target.value})}><option value="">Seleziona...</option>{data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
           )}
           <div className="flex-grow"><label className="text-xs text-gray-500 font-bold">Titolo</label><input className="w-full border p-2 rounded text-sm" value={courseForm.title || ''} onChange={e => setCourseForm({...courseForm, title: e.target.value})} /></div>
           <div className="w-48"><label className="text-xs text-gray-500 font-bold">ID LMS</label><input className="w-full border p-2 rounded text-sm" value={courseForm.lmsElementId || ''} onChange={e => setCourseForm({...courseForm, lmsElementId: e.target.value})} /></div>
           <div className="flex gap-2">
               <button onClick={handleSaveCourse} className={`${editingCourseId ? 'bg-yellow-500' : 'bg-accent'} text-white px-4 py-2 rounded h-10 font-semibold flex items-center gap-1`}>{editingCourseId ? <Check size={16} /> : <Plus size={16} />} {editingCourseId ? 'Aggiorna' : 'Aggiungi'}</button>
               {editingCourseId && <button onClick={cancelEditing} className="bg-gray-300 text-gray-700 px-3 py-2 rounded h-10"><X size={16} /></button>}
           </div>
        </div>

        {/* List */}
        <div className="grid gap-3">
          {filteredCourses.map(course => (
              <div key={course.id} className={`flex items-center justify-between bg-white p-4 rounded-lg border hover:shadow-md ${editingCourseId === course.id ? 'border-yellow-400' : ''}`}>
                  <div>
                      <div className="flex items-center gap-2"><span className="font-semibold">{course.title}</span><span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">LMS: {course.lmsElementId}</span></div>
                      {!selectedSupplierFilter && <div className="text-xs text-gray-400 mt-1">Fornitore: {data.suppliers.find(s => s.id === course.supplierId)?.name}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEditing(course)} className="text-blue-500 p-2"><Edit size={18} /></button>
                    <button onClick={(e) => removeCourse(e, course.id)} className="text-gray-400 hover:text-red-600 p-2"><Trash2 size={18} /></button>
                  </div>
              </div>
          ))}
        </div>
      </div>
    </div>
  );
};
