
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Gavel, 
  Calendar, 
  Briefcase, 
  LayoutDashboard, 
  Settings, 
  Plus, 
  Download, 
  Upload, 
  AlertCircle,
  X,
  Search,
  ChevronRight,
  Clock,
  History,
  Trash2,
  FilterX,
  RefreshCcw,
  Database,
  ArrowLeft
} from 'lucide-react';
import { DiaryData, LegalCase, View, CaseStatus, Hearing } from './types';
import { 
  loadDiaryData, 
  saveDiaryData, 
  exportToJson, 
  importFromJson, 
  shouldShowBackupReminder, 
  markBackupReminderAsShown 
} from './utils/storage';

// Helper for UI formatting
const formatDate = (dateStr: string) => {
  if (!dateStr) return 'TBD';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

type CaseFilter = 'all' | 'ongoing' | 'week';

const App: React.FC = () => {
  const [data, setData] = useState<DiaryData>(loadDiaryData());
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<CaseFilter>('all');
  const [showBackupAlert, setShowBackupAlert] = useState(false);
  const [editingCase, setEditingCase] = useState<LegalCase | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  
  // Custom Modals State
  const [caseToDelete, setCaseToDelete] = useState<LegalCase | null>(null);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<DiaryData | null>(null);

  // Persistence: Automatically saves to localStorage whenever 'data' changes
  useEffect(() => {
    saveDiaryData(data);
  }, [data]);

  // Backup Reminder Logic
  useEffect(() => {
    if (shouldShowBackupReminder() && data.cases.length > 0) {
      setShowBackupAlert(true);
    }
  }, [data.cases.length]);

  const handleBackupNow = () => {
    const newData = exportToJson(data);
    setData(newData);
    setShowBackupAlert(false);
    markBackupReminderAsShown();
  };

  const dismissBackup = () => {
    setShowBackupAlert(false);
    markBackupReminderAsShown();
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const imported = importFromJson(result);
      if (imported) {
        setPendingImportData(imported);
      } else {
        alert("Invalid diary file. Please ensure it is a valid JSON backup.");
      }
    };
    reader.onerror = () => alert("Failed to read file.");
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const executeImport = () => {
    if (!pendingImportData) return;
    
    setData(prev => {
      const mergedCases = [...prev.cases];
      pendingImportData.cases.forEach(importedCase => {
        if (!mergedCases.find(c => c.id === importedCase.id)) {
          mergedCases.push(importedCase);
        }
      });
      return { 
        ...prev, 
        cases: mergedCases,
        advocateName: pendingImportData.advocateName || prev.advocateName 
      };
    });
    
    setPendingImportData(null);
  };

  const executePurge = () => {
    const reset: DiaryData = { 
      cases: [], 
      lastBackupDate: null, 
      advocateName: 'Counsel' 
    };
    
    setData(reset);
    localStorage.removeItem('last_backup_prompt_ts');
    setShowPurgeModal(false);
    setSelectedCaseId(null);
    setActiveView('dashboard');
    setActiveFilter('all');
    setSearchQuery('');
  };

  const addOrUpdateCase = (c: LegalCase) => {
    setData(prev => {
      const existingIdx = prev.cases.findIndex(item => item.id === c.id);
      const newCases = [...prev.cases];
      if (existingIdx >= 0) {
        newCases[existingIdx] = c;
      } else {
        newCases.unshift(c);
      }
      return { ...prev, cases: newCases };
    });
    setIsFormOpen(false);
    setEditingCase(null);
  };

  const confirmDelete = () => {
    if (caseToDelete) {
      const idToDelete = caseToDelete.id;
      setData(prev => ({
        ...prev,
        cases: prev.cases.filter(c => c.id !== idToDelete)
      }));
      setSelectedCaseId(null);
      setCaseToDelete(null);
    }
  };

  const sortedCases = useMemo(() => {
    return [...data.cases].sort((a, b) => {
      if (!a.nextHearingDate) return 1;
      if (!b.nextHearingDate) return -1;
      return new Date(a.nextHearingDate).getTime() - new Date(b.nextHearingDate).getTime();
    });
  }, [data.cases]);

  const filteredCases = useMemo(() => {
    let result = sortedCases;

    if (activeFilter === 'ongoing') {
      result = result.filter(c => c.status === CaseStatus.ONGOING);
    } else if (activeFilter === 'week') {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const weekLater = new Date();
      weekLater.setDate(weekLater.getDate() + 7);
      result = result.filter(c => {
        if (!c.nextHearingDate) return false;
        const d = new Date(c.nextHearingDate);
        return d >= now && d <= weekLater;
      });
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.title.toLowerCase().includes(query) || 
        c.referenceNumber.toLowerCase().includes(query) ||
        c.courtName.toLowerCase().includes(query)
      );
    }

    return result;
  }, [sortedCases, searchQuery, activeFilter]);

  const upcomingHearings = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return sortedCases.filter(c => c.nextHearingDate && new Date(c.nextHearingDate) >= now && c.status === CaseStatus.ONGOING);
  }, [sortedCases]);

  const overdueHearings = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return sortedCases.filter(c => c.nextHearingDate && new Date(c.nextHearingDate) < now && c.status === CaseStatus.ONGOING);
  }, [sortedCases]);

  const selectedCase = useMemo(() => 
    data.cases.find(c => c.id === selectedCaseId), 
  [data.cases, selectedCaseId]);

  const navigateToCasesWithFilter = (filter: CaseFilter) => {
    setActiveFilter(filter);
    setActiveView('cases');
    setSearchQuery('');
    setSelectedCaseId(null);
  };

  return (
    <div className="h-screen w-full flex flex-col md:flex-row bg-slate-50 text-slate-900 overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white shrink-0 shadow-xl z-20">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Gavel size={24} />
          </div>
          <h1 className="font-bold text-lg leading-tight">Advocate's<br/>Diary</h1>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeView === 'dashboard'} 
            onClick={() => setActiveView('dashboard')} 
          />
          <NavItem 
            icon={<Briefcase size={20} />} 
            label="All Cases" 
            active={activeView === 'cases'} 
            onClick={() => {
              setActiveView('cases');
              setActiveFilter('all');
            }} 
          />
          <NavItem 
            icon={<Settings size={20} />} 
            label="Backup & Data" 
            active={activeView === 'settings'} 
            onClick={() => setActiveView('settings')} 
          />
        </nav>

        <div className="p-4 bg-slate-800/50 m-4 rounded-xl border border-slate-700/30">
          <p className="text-xs text-slate-400 mb-1">Welcome</p>
          <p className="font-medium text-sm truncate">{data.advocateName}</p>
        </div>
      </aside>

      {/* Main Content Container */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b bg-white flex items-center justify-between px-4 md:px-6 shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="md:hidden bg-blue-600 p-1.5 rounded-md text-white">
              <Gavel size={18} />
            </div>
            <h2 className="text-lg md:text-xl font-black text-slate-800 tracking-tight capitalize">{activeView}</h2>
          </div>
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={() => {
                setEditingCase(null);
                setIsFormOpen(true);
              }}
              className="hidden md:flex bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg items-center gap-2 text-sm font-semibold transition-all shadow-md active:scale-95"
            >
              <Plus size={18} />
              New Case
            </button>
            <div className="md:hidden">
               <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">Hello,</p>
               <p className="text-xs font-black text-slate-900 truncate max-w-[80px]">{data.advocateName.split(' ')[0]}</p>
            </div>
          </div>
        </header>

        {/* Content Area - Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth bg-slate-50 relative">
          {showBackupAlert && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-sm gap-4">
              <div className="flex items-center gap-3 text-blue-800">
                <AlertCircle size={20} className="shrink-0" />
                <div>
                  <p className="font-bold text-sm">Backup Reminder</p>
                  <p className="text-xs text-blue-600">Ensure your data stays safe by downloading a copy.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button 
                  onClick={handleBackupNow}
                  className="flex-1 sm:flex-none text-xs font-bold px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-sm"
                >
                  Download
                </button>
                <button 
                  onClick={dismissBackup}
                  className="p-2 hover:bg-blue-100 rounded-xl text-blue-400 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          )}

          {activeView === 'dashboard' && (
            <div className="space-y-6 md:space-y-8 max-w-6xl mx-auto pb-24 md:pb-8">
              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                <StatCard 
                  label="Total Cases" 
                  value={data.cases.length} 
                  icon={<Briefcase size={20} />} 
                  color="blue" 
                  onClick={() => navigateToCasesWithFilter('all')}
                />
                <StatCard 
                  label="Ongoing" 
                  value={data.cases.filter(c => c.status === CaseStatus.ONGOING).length} 
                  icon={<Clock size={20} />} 
                  color="amber" 
                  onClick={() => navigateToCasesWithFilter('ongoing')}
                />
                <StatCard 
                  label="Next 7 Days" 
                  value={upcomingHearings.filter(c => {
                    if (!c.nextHearingDate) return false;
                    const d = new Date(c.nextHearingDate);
                    const weekLater = new Date();
                    weekLater.setDate(weekLater.getDate() + 7);
                    return d <= weekLater;
                  }).length} 
                  icon={<Calendar size={20} />} 
                  color="emerald" 
                  onClick={() => navigateToCasesWithFilter('week')}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                {/* Overdue */}
                <section>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <AlertCircle size={16} className="text-red-500" />
                    Overdue Hearings
                  </h3>
                  {overdueHearings.length === 0 ? (
                    <EmptyState message="All clear! No overdue hearings." />
                  ) : (
                    <div className="space-y-3">
                      {overdueHearings.map(c => (
                        <CaseMiniCard 
                          key={c.id} 
                          legalCase={c} 
                          isOverdue 
                          onClick={() => {
                            setSelectedCaseId(c.id);
                            setActiveView('cases');
                            setActiveFilter('all');
                          }} 
                        />
                      ))}
                    </div>
                  )}
                </section>

                {/* Upcoming */}
                <section>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Calendar size={16} className="text-blue-500" />
                    Upcoming Hearings
                  </h3>
                  {upcomingHearings.length === 0 ? (
                    <EmptyState message="No upcoming hearings scheduled." />
                  ) : (
                    <div className="space-y-3">
                      {upcomingHearings.map(c => (
                        <CaseMiniCard 
                          key={c.id} 
                          legalCase={c} 
                          onClick={() => {
                            setSelectedCaseId(c.id);
                            setActiveView('cases');
                            setActiveFilter('all');
                          }} 
                        />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {activeView === 'cases' && (
            <div className="flex h-full gap-6">
              {/* List Pane */}
              <div className={`flex-1 flex flex-col ${selectedCaseId ? 'hidden md:flex' : 'flex'}`}>
                <div className="mb-4 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search title, ref or court..." 
                      className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  {activeFilter !== 'all' && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Filter:</span>
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold uppercase ring-1 ring-blue-200 shadow-sm">
                        {activeFilter === 'ongoing' ? 'Ongoing' : 'Next 7 Days'}
                        <button onClick={() => setActiveFilter('all')} className="hover:text-blue-900 ml-1 p-0.5 rounded-full hover:bg-blue-200 transition-colors">
                          <FilterX size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3 pb-32 overflow-y-auto pr-1">
                  {filteredCases.map(c => (
                    <div 
                      key={c.id}
                      onClick={() => setSelectedCaseId(c.id)}
                      className={`p-4 bg-white border rounded-2xl cursor-pointer hover:border-blue-300 transition-all flex items-center justify-between group ${selectedCaseId === c.id ? 'ring-2 ring-blue-500 border-transparent shadow-md bg-blue-50/20' : 'shadow-sm border-slate-200'}`}
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${c.status === CaseStatus.ONGOING ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {c.status}
                          </span>
                          <span className="text-xs text-slate-400 font-mono truncate">{c.referenceNumber}</span>
                        </div>
                        <h4 className="font-bold text-slate-800 truncate">{c.title}</h4>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1 truncate">
                          <Gavel size={12} /> {c.courtName}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Next Hearing</p>
                        <p className={`text-xs md:text-sm font-black ${!c.nextHearingDate ? 'text-slate-300' : (new Date(c.nextHearingDate) < new Date() ? 'text-red-500' : 'text-blue-600')}`}>
                          {formatDate(c.nextHearingDate)}
                        </p>
                      </div>
                      <ChevronRight size={18} className="text-slate-300 ml-3 group-hover:text-blue-400 transition-colors" />
                    </div>
                  ))}
                  {filteredCases.length === 0 && (
                    <EmptyState message={searchQuery || activeFilter !== 'all' ? "No matches found." : "Diary is empty."} />
                  )}
                </div>
              </div>

              {/* Detail Pane - Fixed mobile view logic */}
              {selectedCase ? (
                <div className="w-full lg:w-[450px] bg-white border border-slate-200 rounded-t-3xl md:rounded-3xl flex flex-col shadow-2xl overflow-hidden animate-fade-in z-30 fixed top-0 left-0 right-0 bottom-16 md:relative md:inset-auto h-[calc(100%-4rem)] md:h-auto">
                  <div className="p-5 md:p-6 border-b flex items-start justify-between bg-slate-50/80 shrink-0">
                    <div className="min-w-0 flex items-center gap-3">
                       <button onClick={() => setSelectedCaseId(null)} className="p-2 -ml-2 hover:bg-slate-200 rounded-full text-slate-500 md:hidden">
                          <ArrowLeft size={20} />
                       </button>
                       <div>
                          <h3 className="text-lg md:text-xl font-black text-slate-900 leading-tight mb-0.5 truncate">{selectedCase.title}</h3>
                          <p className="text-xs font-mono text-slate-400 uppercase tracking-tighter">{selectedCase.referenceNumber}</p>
                       </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setSelectedCaseId(null)}
                      className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors hidden md:block"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Court</p>
                        <p className="text-xs md:text-sm font-bold text-slate-800">{selectedCase.courtName}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Status</p>
                        <p className="text-xs md:text-sm font-bold text-slate-800">{selectedCase.status}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 px-1">Description</p>
                      <div className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 italic">
                        {selectedCase.description ? `"${selectedCase.description}"` : 'No details added yet.'}
                      </div>
                    </div>

                    <div className="pb-16 md:pb-6">
                      <div className="flex items-center justify-between mb-4 px-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                          <History size={14} /> Hearing History
                        </p>
                        <button 
                           type="button"
                           onClick={() => {
                             setEditingCase(selectedCase);
                             setIsFormOpen(true);
                           }}
                           className="text-[10px] font-black text-blue-600 uppercase hover:underline"
                        >
                          Reschedule
                        </button>
                      </div>
                      <div className="space-y-4 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                        <div className="pl-6 relative">
                          <div className="absolute left-0 top-1.5 w-[16px] h-[16px] bg-blue-600 rounded-full ring-4 ring-blue-50 border-2 border-white"></div>
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Next Session</p>
                          <p className="text-sm md:text-base font-black text-slate-900">{formatDate(selectedCase.nextHearingDate)}</p>
                        </div>
                        {selectedCase.history.slice().reverse().map((h) => (
                          <div key={h.id} className="pl-6 relative">
                            <div className="absolute left-[3px] top-1.5 w-[10px] h-[10px] bg-slate-300 rounded-full border-2 border-white"></div>
                            <p className="text-[10px] font-bold text-slate-400">{formatDate(h.date)}</p>
                            <p className="text-sm text-slate-600 mt-1 bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">{h.note || 'No notes saved.'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-5 md:p-6 border-t bg-white flex gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] shrink-0">
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingCase(selectedCase);
                        setIsFormOpen(true);
                      }}
                      className="flex-1 bg-blue-600 text-white py-3.5 rounded-2xl text-sm font-black transition-all shadow-lg shadow-blue-100 active:scale-95"
                    >
                      Edit Details
                    </button>
                    <button 
                      type="button"
                      onClick={() => setCaseToDelete(selectedCase)}
                      className="p-3.5 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-2xl transition-all border border-slate-200 hover:border-red-100 flex items-center justify-center bg-white shadow-sm active:scale-95"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="hidden md:flex flex-1 items-center justify-center bg-white border rounded-[2rem] border-dashed border-slate-200 shadow-inner p-10">
                  <div className="text-center">
                    <div className="bg-slate-50 p-8 rounded-full w-fit mx-auto mb-6 border border-slate-100 shadow-sm">
                      <Briefcase size={48} className="text-slate-200" />
                    </div>
                    <p className="text-slate-500 font-black text-lg">Case Viewer</p>
                    <p className="text-slate-400 text-sm mt-1">Select a record from the list to see full details.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeView === 'settings' && (
            <div className="max-w-3xl mx-auto space-y-6 md:space-y-8 pb-32 md:pb-12">
              <section className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-black mb-2 flex items-center gap-2 text-slate-800">
                  <Download size={22} className="text-blue-600" />
                  Backup & Export
                </h3>
                <p className="text-xs md:text-sm text-slate-500 mb-6 leading-relaxed">
                  Protect your legal records. Since this app is local, we recommend exporting your data regularly.
                </p>
                
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-slate-50/50 rounded-2xl border border-slate-100 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800">Export Diary</p>
                      <p className="text-[11px] text-slate-400">Save your records to a .json file</p>
                    </div>
                    <button 
                      type="button"
                      onClick={handleBackupNow}
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-100"
                    >
                      <Download size={18} /> Export Now
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-slate-50/50 rounded-2xl border border-slate-100 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800">Import Records</p>
                      <p className="text-[11px] text-slate-400">Restore from a previously saved backup</p>
                    </div>
                    <label className="w-full sm:w-auto bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm">
                      <Upload size={18} /> Choose File
                      <input type="file" accept=".json" onChange={handleFileSelection} className="hidden" />
                    </label>
                  </div>
                </div>
              </section>

              <section className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-black mb-4 text-slate-800">Profile & Security</h3>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Display Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Adv. John Smith"
                      value={data.advocateName}
                      onChange={(e) => setData({ ...data, advocateName: e.target.value })}
                      className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-slate-800"
                    />
                  </div>
                  <div className="pt-6 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Purge Data</p>
                      <p className="text-[11px] text-slate-400 leading-tight">Remove all local data from this device permanently.</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setShowPurgeModal(true)}
                      className="w-full sm:w-auto text-red-600 hover:bg-red-50 px-5 py-3 rounded-xl text-xs font-black transition-all border border-red-100"
                    >
                      Delete Everything
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Floating Action Button - Mobile */}
        <button 
          onClick={() => {
            setEditingCase(null);
            setIsFormOpen(true);
          }}
          className="md:hidden fixed bottom-20 right-5 w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-2xl z-40 active:scale-90 transition-transform ring-4 ring-white"
        >
          <Plus size={28} />
        </button>

        {/* Bottom Navigation - Mobile */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-md border-t flex items-center justify-around px-2 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
           <MobileNavTab 
              icon={<LayoutDashboard size={20} />} 
              label="Home" 
              active={activeView === 'dashboard'} 
              onClick={() => setActiveView('dashboard')} 
           />
           <MobileNavTab 
              icon={<Briefcase size={20} />} 
              label="Cases" 
              active={activeView === 'cases'} 
              onClick={() => {
                setActiveView('cases');
                setActiveFilter('all');
              }} 
           />
           <MobileNavTab 
              icon={<Settings size={20} />} 
              label="Settings" 
              active={activeView === 'settings'} 
              onClick={() => setActiveView('settings')} 
           />
        </nav>
      </main>

      {/* Case Form Modal - Responsive Padding */}
      {isFormOpen && (
        <CaseForm 
          initialData={editingCase}
          onSave={addOrUpdateCase}
          onClose={() => setIsFormOpen(false)}
        />
      )}

      {/* Confirmation Modals */}
      {caseToDelete && (
        <ConfirmationDialog
          title="Delete Case?"
          description={`Remove "${caseToDelete.title}"? This will erase all hearing history and is irreversible.`}
          confirmLabel="Delete"
          confirmColor="red"
          icon={<Trash2 size={32} className="text-red-500" />}
          onConfirm={confirmDelete}
          onCancel={() => setCaseToDelete(null)}
        />
      )}

      {showPurgeModal && (
        <ConfirmationDialog
          title="Reset Diary?"
          description="DANGER: This will permanently wipe ALL records from this device. Please ensure you have a backup."
          confirmLabel="Reset Now"
          confirmColor="red"
          icon={<RefreshCcw size={32} className="text-red-500" />}
          onConfirm={executePurge}
          onCancel={() => setShowPurgeModal(false)}
        />
      )}

      {pendingImportData && (
        <ConfirmationDialog
          title="Import Data?"
          description={`Merge ${pendingImportData.cases.length} case records into your current diary?`}
          confirmLabel="Import"
          confirmColor="blue"
          icon={<Database size={32} className="text-blue-500" />}
          onConfirm={executeImport}
          onCancel={() => setPendingImportData(null)}
        />
      )}
    </div>
  );
};

/**
 * Reusable Confirmation Dialog
 */
const ConfirmationDialog: React.FC<{
  title: string;
  description: string;
  confirmLabel: string;
  confirmColor: 'red' | 'blue';
  icon: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ title, description, confirmLabel, confirmColor, icon, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[110] flex items-center justify-center p-6 transition-opacity duration-300">
    <div className="bg-white rounded-[2.5rem] w-full max-sm p-8 shadow-2xl animate-fade-in transition-transform duration-300 scale-100">
      <div className={`${confirmColor === 'red' ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'} p-5 rounded-3xl w-fit mb-6 border`}>
        {icon}
      </div>
      <h2 className="text-2xl font-black text-slate-900 mb-2 leading-tight">{title}</h2>
      <p className="text-sm text-slate-500 mb-8 leading-relaxed font-medium">
        {description}
      </p>
      <div className="flex gap-3">
        <button 
          onClick={onCancel}
          className="flex-1 px-4 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all active:scale-95"
        >
          Cancel
        </button>
        <button 
          onClick={onConfirm}
          className={`flex-1 px-4 py-4 ${confirmColor === 'red' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'} text-white rounded-2xl font-black text-sm transition-all shadow-lg active:scale-95`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

// Navigation Components
const NavItem: React.FC<{ icon: React.ReactNode, label: string, active: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button 
    type="button"
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-black transition-all ${
      active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30 scale-[1.02]' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
    }`}
  >
    {icon}
    {label}
  </button>
);

const MobileNavTab: React.FC<{ icon: React.ReactNode, label: string, active: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-all ${
      active ? 'text-blue-600 font-black' : 'text-slate-400 font-bold'
    }`}
  >
    <div className={`p-1 rounded-lg transition-colors ${active ? 'bg-blue-50' : ''}`}>
      {icon}
    </div>
    <span className="text-[10px] uppercase tracking-widest">{label}</span>
  </button>
);

const StatCard: React.FC<{ 
  label: string, 
  value: number, 
  icon: React.ReactNode, 
  color: 'blue' | 'amber' | 'emerald',
  onClick: () => void 
}> = ({ label, value, icon, color, onClick }) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100'
  };
  return (
    <button 
      onClick={onClick}
      className={`p-5 md:p-6 rounded-[2rem] border border-slate-200 bg-white shadow-sm flex items-center gap-4 md:gap-5 transition-all hover:-translate-y-1 hover:shadow-md text-left w-full group active:scale-98`}
    >
      <div className={`p-3 md:p-4 rounded-2xl shrink-0 ${colors[color]} border transition-all group-hover:scale-110 shadow-sm`}>
        {icon}
      </div>
      <div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-2xl md:text-3xl font-black text-slate-900">{value}</p>
      </div>
    </button>
  );
};

const CaseMiniCard: React.FC<{ legalCase: LegalCase, isOverdue?: boolean, onClick: () => void }> = ({ legalCase, isOverdue, onClick }) => (
  <div 
    onClick={onClick}
    className={`p-4 bg-white border rounded-2xl flex items-center justify-between cursor-pointer hover:border-blue-200 transition-all shadow-sm group ${isOverdue ? 'border-red-100 bg-red-50/20' : 'border-slate-100'}`}
  >
    <div className="min-w-0 pr-2">
      <h4 className="font-bold text-slate-800 truncate text-sm group-hover:text-blue-600 transition-colors">{legalCase.title}</h4>
      <p className="text-[11px] text-slate-400 truncate font-bold">{legalCase.courtName}</p>
    </div>
    <div className="text-right shrink-0">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Next Hearing</p>
      <p className={`text-xs font-black ${isOverdue ? 'text-red-500' : 'text-blue-600'}`}>
        {formatDate(legalCase.nextHearingDate)}
      </p>
    </div>
  </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="py-12 md:py-16 text-center text-slate-400 bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 px-6 mb-10 md:mb-0">
    <AlertCircle size={32} className="mx-auto mb-3 opacity-20" />
    <p className="text-sm font-black text-slate-500">{message}</p>
    <p className="text-[11px] mt-1 font-medium">Use the "New Case" button to begin.</p>
  </div>
);

// Form Modal Sub-component
const CaseForm: React.FC<{ 
  initialData: LegalCase | null, 
  onSave: (c: LegalCase) => void, 
  onClose: () => void 
}> = ({ initialData, onSave, onClose }) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [refNum, setRefNum] = useState(initialData?.referenceNumber || '');
  const [court, setCourt] = useState(initialData?.courtName || '');
  const [desc, setDesc] = useState(initialData?.description || '');
  const [status, setStatus] = useState<CaseStatus>(initialData?.status || CaseStatus.ONGOING);
  const [nextDate, setNextDate] = useState(initialData?.nextHearingDate || '');
  const [hearingNote, setHearingNote] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !court) {
      alert("Please fill in the Case Title and Court.");
      return;
    }

    const history: Hearing[] = initialData ? [...initialData.history] : [];
    
    // Track rescheduling
    if (initialData && initialData.nextHearingDate && nextDate !== initialData.nextHearingDate) {
      history.push({
        id: crypto.randomUUID(),
        date: initialData.nextHearingDate,
        note: hearingNote || 'Hearing rescheduled to ' + formatDate(nextDate)
      });
    }

    onSave({
      id: initialData?.id || crypto.randomUUID(),
      title,
      referenceNumber: refNum,
      courtName: court,
      description: desc,
      status,
      nextHearingDate: nextDate,
      history,
      createdAt: initialData?.createdAt || new Date().toISOString()
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl animate-slide-up sm:animate-zoom-in">
        <div className="p-6 md:p-8 border-b sticky top-0 bg-white z-10 flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{initialData ? 'Update record' : 'Add legal record'}</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Case Title*</label>
              <input 
                required
                type="text" 
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="State vs John Doe"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Case ID / Ref</label>
              <input 
                type="text" 
                value={refNum}
                onChange={e => setRefNum(e.target.value)}
                placeholder="2024/APP/101"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Court Venue*</label>
              <input 
                required
                type="text" 
                value={court}
                onChange={e => setCourt(e.target.value)}
                placeholder="High Court, Bench..."
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Case Status</label>
              <select 
                value={status}
                onChange={e => setStatus(e.target.value as CaseStatus)}
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-black text-slate-700"
              >
                {Object.values(CaseStatus).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Case Summary</label>
            <textarea 
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Important details, client requirements, etc..."
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all h-24 resize-none font-medium text-sm text-slate-700"
            />
          </div>

          <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-5 shadow-inner">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest px-1">Next Scheduled Hearing</label>
              <input 
                type="date" 
                value={nextDate}
                onChange={e => setNextDate(e.target.value)}
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-black text-slate-800 shadow-sm"
              />
            </div>
            
            {initialData && nextDate !== initialData.nextHearingDate && (
              <div className="space-y-1.5 animate-slide-up">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest px-1">Today's Session Notes</label>
                <textarea 
                  value={hearingNote}
                  onChange={e => setHearingNote(e.target.value)}
                  placeholder="What was decided in the previous session?"
                  className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all h-24 resize-none font-medium text-sm text-slate-700 shadow-sm"
                />
              </div>
            )}
          </div>

          {/* Added extra padding for mobile form to ensure bottom nav/keyboard clearance */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 pb-24 sm:pb-0">
            <button 
              type="submit" 
              className="order-1 sm:order-2 flex-[2] px-6 py-4.5 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 active:scale-95"
            >
              {initialData ? 'Update Record' : 'Save Record'}
            </button>
            <button 
              type="button" 
              onClick={onClose}
              className="order-2 sm:order-1 flex-1 px-6 py-4.5 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all active:scale-95"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default App;
