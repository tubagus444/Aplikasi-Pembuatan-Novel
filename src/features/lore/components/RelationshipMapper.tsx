import React, { useMemo } from 'react';
import { Trash2, Edit2, Link as LinkIcon, Users, Heart, Sword, ShieldAlert, ArrowRight, Search, UserCircle2, UserPlus, Activity, AlignLeft, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRelationshipMapper } from '@/src/features/lore/hooks/useRelationshipMapper';

interface RelationshipMapperProps {
  projectId: number;
}

// Generate color based on character name hash
const getColorForName = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 70%, 50%)`;
};

const RELATION_TYPES = [
  { label: 'Friend', icon: Users, color: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400', activeClass: 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/50 dark:bg-blue-500/20', border: 'border-blue-200 dark:border-blue-900/50', hex: '#3b82f6' },
  { label: 'Lover', icon: Heart, color: 'text-pink-600 bg-pink-50 dark:bg-pink-500/10 dark:text-pink-400', activeClass: 'border-pink-500 ring-1 ring-pink-500 bg-pink-50/50 dark:bg-pink-500/20', border: 'border-pink-200 dark:border-pink-900/50', hex: '#ec4899' },
  { label: 'Enemy', icon: Sword, color: 'text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400', activeClass: 'border-red-500 ring-1 ring-red-500 bg-red-50/50 dark:bg-red-500/20', border: 'border-red-200 dark:border-red-900/50', hex: '#ef4444' },
  { label: 'Ally', icon: ShieldAlert, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400', activeClass: 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/20', border: 'border-emerald-200 dark:border-emerald-900/50', hex: '#10b981' },
  { label: 'Other', icon: LinkIcon, color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400', activeClass: 'border-slate-500 ring-1 ring-slate-500 bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-800', hex: '#94a3b8' },
];

export function RelationshipMapper({ projectId }: RelationshipMapperProps) {
  const {
    characters,
    relationships,
    selectedCharacterId,
    setSelectedCharacterId,
    isAdding,
    setIsAdding,
    editingId,
    targetId,
    setTargetId,
    type,
    setType,
    description,
    setDescription,
    searchQuery,
    setSearchQuery,
    selectedCharacter,
    filteredCharacters,
    groupedRelationships,
    hasAnyRelationships,
    saveRelationship,
    startEditing,
    cancelAdding,
    deleteRelationship,
    getCharacterName
  } = useRelationshipMapper(projectId);

  const getCharacterConnectionCount = (charId: number) => {
    return relationships?.filter(r => r.sourceId === charId || r.targetId === charId).length || 0;
  };

  const renderConnectionWeb = () => {
    if (!selectedCharacter || !relationships || relationships.length === 0) return null;
    
    // Get all relations for the selected character
    const charRels = relationships.filter(r => r.sourceId === selectedCharacter.id || r.targetId === selectedCharacter.id);
    if (charRels.length === 0) return null;

    const size = 360;
    const center = size / 2;
    const radius = 120;

    return (
      <div className="w-full flex justify-center items-center py-6 mb-8 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden relative">
        {/* Subtle background decoration */}
        <div className="absolute inset-0 max-w-full max-h-full opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, #000 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
        
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
          {/* Background web rings */}
          <circle cx={center} cy={center} r={radius * 1.3} fill="none" stroke="currentColor" strokeWidth="1" className="text-slate-200 dark:text-slate-800/60" strokeDasharray="4 6" />
          <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeWidth="1" className="text-slate-200 dark:text-slate-800" />
          <circle cx={center} cy={center} r={radius * 0.6} fill="none" stroke="currentColor" strokeWidth="1" className="text-slate-200 dark:text-slate-800/60" strokeDasharray="2 4" />

          {/* Draw Lines */}
          <AnimatePresence>
            {charRels.map((rel, i) => {
              const angle = (i / charRels.length) * 2 * Math.PI - Math.PI / 2;
              const x = center + radius * Math.cos(angle);
              const y = center + radius * Math.sin(angle);
              
              // Create an elegant curved path instead of a stiff straight line
              const midX = (center + x) / 2;
              const midY = (center + y) / 2;
              const cpX = midX + Math.cos(angle + Math.PI / 4) * 20;
              const cpY = midY + Math.sin(angle + Math.PI / 4) * 20;
              
              const pathData = `M ${center} ${center} Q ${cpX} ${cpY} ${x} ${y}`;
              
              const typeObj = RELATION_TYPES.find(t => t.label === rel.type) || RELATION_TYPES[4];
              
              return (
                <motion.path 
                  key={`line-${rel.id}`}
                  d={pathData}
                  fill="none"
                  stroke={typeObj.hex} 
                  strokeWidth="2.5" 
                  strokeOpacity="0.4"
                  strokeDasharray={rel.type === 'Other' ? "4 4" : "none"}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.1 }}
                />
              );
            })}
          </AnimatePresence>
          
          {/* Draw Surrounding Nodes */}
          {charRels.map((rel, i) => {
            const angle = (i / charRels.length) * 2 * Math.PI - Math.PI / 2;
            const x = center + radius * Math.cos(angle);
            const y = center + radius * Math.sin(angle);
            const otherCharId = rel.sourceId === selectedCharacter.id ? rel.targetId : rel.sourceId;
            const otherCharName = getCharacterName(otherCharId);
            const typeObj = RELATION_TYPES.find(t => t.label === rel.type) || RELATION_TYPES[4];
            
            return (
              <motion.g 
                key={`node-${rel.id}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.4 + (i * 0.1), ease: "easeOut" }}
              >
                <circle cx={x} cy={y} r="20" fill={getColorForName(otherCharName)} stroke="currentColor" strokeWidth="3" className="text-white dark:text-slate-900 shadow-sm" />
                <text 
                  x={x} 
                  y={y} 
                  textAnchor="middle" 
                  alignmentBaseline="central" 
                  fill="white" 
                  fontSize="12" 
                  fontWeight="bold"
                >
                  {otherCharName.substring(0, 2).toUpperCase()}
                </text>
                
                {/* Background pill for text to improve readability */}
                <rect 
                  x={x - 40} 
                  y={y + 19} 
                  width="80" 
                  height="36" 
                  rx="6" 
                  fill="currentColor" 
                  className="text-white/80 dark:text-slate-900/80" 
                />
                
                <text 
                  x={x} 
                  y={y + 32} 
                  textAnchor="middle" 
                  fill="currentColor" 
                  className="fill-slate-800 dark:fill-slate-200"
                  fontSize="12" 
                  fontWeight="600"
                >
                  {otherCharName}
                </text>
                <text 
                  x={x} 
                  y={y + 46} 
                  textAnchor="middle" 
                  fill={typeObj.hex}
                  fontSize="10" 
                  fontWeight="bold"
                  letterSpacing="0.05em"
                  className="uppercase"
                >
                  {typeObj.label}
                </text>
              </motion.g>
            );
          })}

          {/* Draw Center Node */}
          <motion.g
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            {/* Soft glow for center node */}
            <circle cx={center} cy={center} r="38" fill={getColorForName(selectedCharacter.name)} opacity="0.15" className="blur-md" />
            
            <circle cx={center} cy={center} r="32" fill={getColorForName(selectedCharacter.name)} stroke="currentColor" strokeWidth="4" className="text-white dark:text-slate-900 shadow-xl" />
            <text 
              x={center} 
              y={center} 
              textAnchor="middle" 
              alignmentBaseline="central" 
              fill="white" 
              fontSize="20" 
              fontWeight="bold"
            >
              {selectedCharacter.name.substring(0, 2).toUpperCase()}
            </text>
          </motion.g>
        </svg>
      </div>
    );
  };

  const renderRelationshipCards = (typeObj: typeof RELATION_TYPES[0], rels: typeof relationships) => {
    if (!rels || rels.length === 0) return null;
    const TypeIcon = typeObj.icon;
    
    return (
      <div key={typeObj.label} className="mb-8">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-4">
          <div className={`p-1.5 rounded-md ${typeObj.color}`}>
            <TypeIcon size={16} />
          </div>
          {typeObj.label}
          <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 py-0.5 px-2 rounded-full text-[10px] font-bold ml-2">
            {rels.length}
          </span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {rels.map(rel => {
            const isSource = rel.sourceId === selectedCharacterId;
            const otherCharId = isSource ? rel.targetId : rel.sourceId;
            const otherCharName = getCharacterName(otherCharId);
            
            return (
              <div 
                key={rel.id} 
                className={`group flex flex-col justify-between p-4 bg-white dark:bg-slate-900 border ${typeObj.border} rounded-2xl hover:shadow-md transition-all`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-950 flex items-center justify-center shadow-sm shrink-0"
                      style={{ backgroundColor: getColorForName(otherCharName), color: 'white' }}
                    >
                      <span className="font-bold text-sm">
                        {otherCharName.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm line-clamp-1">
                        {otherCharName}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                        {!isSource && <ArrowRight size={10} className="rotate-180" />}
                        {typeObj.label}
                        {isSource && <ArrowRight size={10} />}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEditing(rel)} className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded transition-all"><Edit2 size={14} /></button>
                    <button onClick={() => {
                      if (window.confirm('Delete this relationship?')) {
                        deleteRelationship(rel.id!);
                      }
                    }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded transition-all"><Trash2 size={14} /></button>
                  </div>
                </div>
                {rel.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 italic bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800 line-clamp-2">
                    "{rel.description}"
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="mb-4 p-1 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users className="text-indigo-600" size={20} />
            Karakter & Hubungan
          </h2>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <UserCircle2 size={14} className="text-indigo-500" />
            <span className="font-medium text-slate-700 dark:text-slate-300">{characters?.length || 0}</span> Karakter
          </div>
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <Activity size={14} className="text-pink-500" />
            <span className="font-medium text-slate-700 dark:text-slate-300">{relationships?.length || 0}</span> Hubungan
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        
        {/* Left Column: Character List */}
        <div className="lg:col-span-1 flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search characters..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {filteredCharacters?.map(char => (
              <button
                key={char.id}
                onClick={() => {
                  setSelectedCharacterId(char.id!);
                  cancelAdding();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group ${
                  selectedCharacterId === char.id
                    ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 border shadow-sm'
                    : 'border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm"
                  style={{ backgroundColor: getColorForName(char.name), color: 'white' }}
                >
                   <span className="font-bold text-xs">
                     {char.name.substring(0, 2).toUpperCase()}
                   </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`text-sm truncate font-medium ${selectedCharacterId === char.id ? 'text-indigo-900 dark:text-indigo-300 font-semibold' : 'text-slate-700 dark:text-slate-300'}`}>
                    {char.name}
                  </h4>
                </div>
                <div className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  selectedCharacterId === char.id 
                    ? 'bg-indigo-200 dark:bg-indigo-500/30 text-indigo-700 dark:text-indigo-300' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'
                }`}>
                  {getCharacterConnectionCount(char.id!)}
                </div>
              </button>
            ))}
            
            {filteredCharacters?.length === 0 && (
              <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">
                No characters found.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Main Profile Panel */}
        <div className="lg:col-span-3 flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden shadow-inner">
          {selectedCharacter ? (
            <AnimatePresence mode="wait">
              <motion.div 
                key={selectedCharacter.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col h-full overflow-y-auto custom-scrollbar"
              >
                {/* Header */}
                <div className="relative p-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                  <div className="absolute top-0 left-0 w-full h-32 bg-slate-50 dark:bg-slate-800/30" />
                  <div className="relative z-10 flex items-end gap-6 pt-12">
                    <div 
                      className="w-24 h-24 rounded-2xl border-4 border-white dark:border-slate-900 shadow-xl flex items-center justify-center shrink-0 text-white"
                      style={{ backgroundColor: getColorForName(selectedCharacter.name) }}
                    >
                       <span className="text-4xl font-bold">{selectedCharacter.name.substring(0, 2).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 pb-2">
                       <h2 className="text-3xl font-serif font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
                         {selectedCharacter.name}
                       </h2>
                       <p className="text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 font-medium">
                         <LinkIcon size={14} className="text-indigo-500" />
                         {relationships?.filter(r => r.sourceId === selectedCharacter.id || r.targetId === selectedCharacter.id).length || 0} Koneksi
                       </p>
                    </div>
                    <div className="pb-2">
                      <button 
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg active:scale-95"
                      >
                        <UserPlus size={16} />
                        Koneksi Baru
                      </button>
                    </div>
                  </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 p-8">
                  {/* Add Bond Form */}
                  <AnimatePresence>
                    {isAdding && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0, scale: 0.95 }}
                        animate={{ opacity: 1, height: 'auto', scale: 1 }}
                        exit={{ opacity: 0, height: 0, scale: 0.95 }}
                        className="overflow-hidden mb-8"
                      >
                        <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-6 shadow-md space-y-6">
                          <h3 className="font-bold text-slate-800 dark:text-slate-200 text-lg border-b border-border pb-3">
                            {editingId ? 'Edit Connection' : `Create connection for ${selectedCharacter.name}`}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* Target Character Dropdown */}
                            <div className="space-y-2">
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Connect With</label>
                              <select 
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-slate-200 outline-none transition-shadow"
                                value={targetId || ''}
                                onChange={e => setTargetId(Number(e.target.value))}
                              >
                                <option value="">Select Character...</option>
                                {characters?.filter(c => c.id !== selectedCharacter?.id).map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </div>

                            {/* Relationship Type Map */}
                            <div className="space-y-2">
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Bond Type</label>
                              <div className="grid grid-cols-5 gap-2">
                                {RELATION_TYPES.map(r => (
                                  <button
                                    key={r.label}
                                    onClick={() => setType(r.label)}
                                    className={`flex flex-col flex-1 items-center justify-center p-3 rounded-xl transition-all border ${
                                      type === r.label 
                                        ? r.activeClass
                                        : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                    }`}
                                    title={r.label}
                                  >
                                    <r.icon size={18} className="mb-1" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider truncate w-full text-center">{r.label}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                            
                            {/* Description Input */}
                            <div className="space-y-2 md:col-span-2">
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1"><AlignLeft size={12}/> Description (Optional)</label>
                              <textarea 
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-slate-200 outline-none transition-shadow min-h-[80px] resize-none"
                                placeholder="Describe their dynamic..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                            <button 
                              onClick={cancelAdding}
                              className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={saveRelationship}
                              disabled={!targetId}
                              className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                              {editingId ? 'Save Changes' : 'Create Bond'}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Relationship Sections */}
                  {hasAnyRelationships ? (
                    <div>
                      {renderConnectionWeb()}
                      {RELATION_TYPES.map(rt => renderRelationshipCards(rt, groupedRelationships[rt.label]))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-6 text-slate-300 dark:text-slate-600 border-4 border-white dark:border-slate-900 border-dashed">
                        <Users size={40} />
                      </div>
                      <h4 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No connections documented</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">Create the first bond for {selectedCharacter.name} to map out their place in the story.</p>
                      {!isAdding && (
                         <button 
                           onClick={() => setIsAdding(true)}
                           className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm"
                         >
                           <UserPlus size={16} />
                           Add a Bond
                         </button>
                      )}
                    </div>
                  )}

                </div>
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
               <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 text-slate-300 dark:text-slate-600">
                 <Users size={48} />
               </div>
               <h4 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">Character Hub</h4>
               <p className="text-slate-500 dark:text-slate-400 max-w-sm">Select a character from the list to view and manage their relationships.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
