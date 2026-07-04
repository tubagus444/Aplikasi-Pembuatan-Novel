import React from 'react';
import { Trash2, Edit2, Link as LinkIcon, Users, Search, UserCircle2, UserPlus, Activity, AlignLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRelationshipMapper } from '@/src/features/lore/hooks/useRelationshipMapper';
import { RELATIONSHIP_TYPES, getRelationshipLabel } from '@/src/features/codex/relationshipTypes';
import { TYPE_STYLE, styleOf } from '@/src/features/lore/relationshipStyles';

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

export function RelationshipMapper({ projectId }: RelationshipMapperProps) {
  const {
    characters,
    allEntries,
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
    onlyConnected,
    setOnlyConnected,
    connectionCount,
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

  const getCharacterConnectionCount = (charId: number) => connectionCount.get(charId) || 0;

  const renderConnectionWeb = () => {
    if (!selectedCharacter || !relationships || relationships.length === 0) return null;

    // Get all relations for the selected character
    const charRels = relationships.filter(r => r.sourceId === selectedCharacter.id || r.targetId === selectedCharacter.id);
    // Diagram baru bermakna saat ada ≥2 koneksi untuk dipetakan; untuk 1 koneksi
    // cukup kartunya di bawah (hindari kanvas besar berisi satu garis).
    if (charRels.length < 2) return null;

    const count = charRels.length;

    // #4 Batasi jumlah node di lingkaran; sisanya diringkas jadi satu node "+N lainnya"
    // (semua koneksi tetap tampil lengkap di kartu di bawah diagram).
    const CAP = 11;
    const hasOverflow = count > CAP;
    const visibleRels = hasOverflow ? charRels.slice(0, CAP - 1) : charRels;
    const overflowCount = hasOverflow ? count - (CAP - 1) : 0;
    const nodeCount = visibleRels.length + (hasOverflow ? 1 : 0);

    // #3 Geometri adaptif: ring & node menyesuaikan jumlah node agar tetap lega.
    const radius = Math.min(170, 110 + Math.max(0, nodeCount - 4) * 9);
    const nodeR = nodeCount <= 6 ? 20 : nodeCount <= 9 ? 16 : 13;
    const nodeFont = Math.round(nodeR * 0.6);
    const labelRadius = radius + nodeR + 12;

    // #2 Margin viewBox supaya label radial tidak terpotong (sisi terlebar = label horizontal).
    const padX = 100;
    const padY = 30;
    const cx = labelRadius + padX;
    const cy = labelRadius + padY;
    const vbW = cx * 2;
    const vbH = cy * 2;

    const typeOf = (rel: typeof charRels[number]) => styleOf(rel.type);

    // Posisi node + label radial untuk indeks ke-i pada lingkaran.
    const posAt = (i: number) => {
      const angle = (i / nodeCount) * 2 * Math.PI - Math.PI / 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return {
        angle,
        x: cx + radius * cos,
        y: cy + radius * sin,
        lx: cx + labelRadius * cos,
        ly: cy + labelRadius * sin,
        anchor: (cos > 0.33 ? 'start' : cos < -0.33 ? 'end' : 'middle') as 'start' | 'end' | 'middle',
      };
    };

    const curvePath = (x: number, y: number, angle: number) => {
      const midX = (cx + x) / 2;
      const midY = (cy + y) / 2;
      const cpX = midX + Math.cos(angle + Math.PI / 4) * 20;
      const cpY = midY + Math.sin(angle + Math.PI / 4) * 20;
      return `M ${cx} ${cy} Q ${cpX} ${cpY} ${x} ${y}`;
    };

    // #1 Legenda warna tipe (menggantikan label tipe di tiap node yang redundan dengan warna garis).
    const usedTypes = new Set(charRels.map(r => r.type));
    const legend = RELATIONSHIP_TYPES.filter(t => usedTypes.has(t.value));

    return (
      <div className="w-full max-w-xl mx-auto flex justify-center items-center py-4 mb-6 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden relative">
        {/* Subtle background decoration */}
        <div className="absolute inset-0 max-w-full max-h-full opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, #000 1px, transparent 1px)', backgroundSize: '16px 16px' }} />

        {/* #1 Legenda tipe relasi */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-lg px-2.5 py-2 border border-slate-200/70 dark:border-slate-800/70 shadow-sm">
          {legend.map(t => (
            <div key={t.value} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: styleOf(t.value).hex }} />
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">{t.label}</span>
            </div>
          ))}
        </div>

        <svg viewBox={`0 0 ${vbW} ${vbH}`} width={vbW} height={vbH} className="max-w-full h-auto" style={{ maxWidth: Math.min(vbW, 440) }}>
          {/* Background web rings */}
          <circle cx={cx} cy={cy} r={radius * 1.3} fill="none" stroke="currentColor" strokeWidth="1" className="text-slate-200 dark:text-slate-800/60" strokeDasharray="4 6" />
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" strokeWidth="1" className="text-slate-200 dark:text-slate-800" />
          <circle cx={cx} cy={cy} r={radius * 0.6} fill="none" stroke="currentColor" strokeWidth="1" className="text-slate-200 dark:text-slate-800/60" strokeDasharray="2 4" />

          {/* Draw Lines */}
          <AnimatePresence>
            {visibleRels.map((rel, i) => {
              const { x, y, angle } = posAt(i);
              const typeObj = typeOf(rel);
              return (
                <motion.path
                  key={`line-${rel.id}`}
                  d={curvePath(x, y, angle)}
                  fill="none"
                  stroke={typeObj.hex}
                  strokeWidth="2.5"
                  strokeOpacity="0.4"
                  strokeDasharray={typeObj.dashed ? "4 4" : "none"}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.1 }}
                />
              );
            })}
            {hasOverflow && (() => {
              const { x, y, angle } = posAt(visibleRels.length);
              return (
                <motion.path
                  key="line-more"
                  d={curvePath(x, y, angle)}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2.5"
                  strokeOpacity="0.35"
                  strokeDasharray="2 4"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: visibleRels.length * 0.1 }}
                />
              );
            })()}
          </AnimatePresence>

          {/* Draw Surrounding Nodes */}
          {visibleRels.map((rel, i) => {
            const { x, y, lx, ly, anchor } = posAt(i);
            const otherCharId = rel.sourceId === selectedCharacter.id ? rel.targetId : rel.sourceId;
            const otherCharName = getCharacterName(otherCharId);
            const shortName = otherCharName.length > 14 ? otherCharName.slice(0, 13) + '…' : otherCharName;

            return (
              <motion.g
                key={`node-${rel.id}`}
                className="group"
                style={{ cursor: 'pointer' }}
                onClick={() => { setSelectedCharacterId(otherCharId); cancelAdding(); }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.4 + (i * 0.1), ease: "easeOut" }}
              >
                {/* #5 Tooltip + klik untuk pindah ke karakter tersebut */}
                <title>{`Lihat ${otherCharName}`}</title>
                <circle cx={x} cy={y} r={nodeR} fill={getColorForName(otherCharName)} strokeWidth="3" className="stroke-white dark:stroke-slate-900 transition-colors group-hover:stroke-indigo-400 dark:group-hover:stroke-indigo-500" />
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize={nodeFont}
                  fontWeight="bold"
                  className="pointer-events-none"
                >
                  {otherCharName.substring(0, 2).toUpperCase()}
                </text>

                {/* #2 Nama dengan halo (paint-order) agar terbaca tanpa pill yang menabrak */}
                <text
                  x={lx}
                  y={ly}
                  textAnchor={anchor}
                  dominantBaseline="central"
                  fontSize="12"
                  fontWeight="600"
                  strokeWidth="3"
                  className="fill-slate-800 dark:fill-slate-200 stroke-slate-50 dark:stroke-slate-900 [paint-order:stroke] transition-colors group-hover:fill-indigo-600 dark:group-hover:fill-indigo-400 pointer-events-none"
                >
                  {shortName}
                </text>
              </motion.g>
            );
          })}

          {/* #4 Node ringkasan untuk koneksi yang tak muat di lingkaran */}
          {hasOverflow && (() => {
            const { x, y, lx, ly, anchor } = posAt(visibleRels.length);
            return (
              <motion.g
                key="node-more"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.4 + (visibleRels.length * 0.1), ease: "easeOut" }}
              >
                <title>{`${overflowCount} koneksi lainnya — lihat daftar lengkap di bawah`}</title>
                <circle cx={x} cy={y} r={nodeR} strokeWidth="3" className="fill-slate-400 dark:fill-slate-600 stroke-white dark:stroke-slate-900" />
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize={nodeFont}
                  fontWeight="bold"
                >
                  {`+${overflowCount}`}
                </text>
                <text
                  x={lx}
                  y={ly}
                  textAnchor={anchor}
                  dominantBaseline="central"
                  fontSize="12"
                  fontWeight="600"
                  strokeWidth="3"
                  className="fill-slate-500 dark:fill-slate-400 stroke-slate-50 dark:stroke-slate-900 [paint-order:stroke]"
                >
                  lainnya
                </text>
              </motion.g>
            );
          })()}

          {/* Draw Center Node */}
          <motion.g
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            {/* Soft glow for center node */}
            <circle cx={cx} cy={cy} r="38" fill={getColorForName(selectedCharacter.name)} opacity="0.15" className="blur-md" />

            <circle cx={cx} cy={cy} r="32" fill={getColorForName(selectedCharacter.name)} stroke="currentColor" strokeWidth="4" className="text-white dark:text-slate-900 shadow-xl" />
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
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

  const renderRelationshipCards = (def: typeof RELATIONSHIP_TYPES[number], rels: typeof relationships) => {
    if (!rels || rels.length === 0) return null;
    const style = styleOf(def.value);
    const TypeIcon = style.icon;

    return (
      <div key={def.value} className="mb-8">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-4">
          <div className={`p-1.5 rounded-md ${style.color}`}>
            <TypeIcon size={16} />
          </div>
          {def.label}
          <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 py-0.5 px-2 rounded-full text-[10px] font-bold ml-2">
            {rels.length}
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {rels.map(rel => {
            const isSource = rel.sourceId === selectedCharacterId;
            const otherCharId = isSource ? rel.targetId : rel.sourceId;
            const otherCharName = getCharacterName(otherCharId);
            // Label sadar-arah: "Memiliki" vs "Dimiliki oleh".
            const dirLabel = getRelationshipLabel(rel.type, isSource);

            return (
              <div
                key={rel.id}
                className={`group flex flex-col justify-between p-4 bg-white dark:bg-slate-900 border ${style.border} rounded-2xl hover:shadow-md transition-all`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-950 flex items-center justify-center shadow-sm shrink-0"
                      style={{ backgroundColor: getColorForName(otherCharName), color: 'white' }}
                    >
                      <span className="font-bold text-sm">
                        {otherCharName.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm line-clamp-1">
                        {otherCharName}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mt-0.5 truncate">
                        {dirLabel}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button onClick={() => startEditing(rel)} title="Ubah hubungan" className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded transition-all"><Edit2 size={14} /></button>
                    <button onClick={() => {
                      if (window.confirm(`Hapus hubungan dengan ${otherCharName}?`)) {
                        deleteRelationship(rel.id!);
                      }
                    }} title="Hapus hubungan" className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded transition-all"><Trash2 size={14} /></button>
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
          <div className="p-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari karakter..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
            {/* Filter: sembunyikan karakter tanpa hubungan (diurut jumlah koneksi terbanyak dulu). */}
            <label className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyConnected}
                onChange={e => setOnlyConnected(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
              />
              Hanya yang terhubung
            </label>
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
                Tak ada karakter yang cocok.
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
                {/* Header — dipadatkan: tanpa banner, avatar & judul lebih kecil */}
                <div className="p-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-xl shadow-md flex items-center justify-center shrink-0 text-white"
                      style={{ backgroundColor: getColorForName(selectedCharacter.name) }}
                    >
                       <span className="text-xl font-bold">{selectedCharacter.name.substring(0, 2).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                       <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 truncate">
                         {selectedCharacter.name}
                       </h2>
                       <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 font-medium">
                         <LinkIcon size={13} className="text-indigo-500 shrink-0" />
                         {relationships?.filter(r => r.sourceId === selectedCharacter.id || r.targetId === selectedCharacter.id).length || 0} Hubungan
                       </p>
                    </div>
                    <div className="shrink-0">
                      <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg active:scale-95"
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
                            {editingId ? 'Ubah hubungan' : `Hubungan baru untuk ${selectedCharacter.name}`}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Target Character Dropdown */}
                            <div className="space-y-2">
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Hubungkan dengan</label>
                              <select
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-slate-200 outline-none transition-shadow"
                                value={targetId || ''}
                                onChange={e => setTargetId(Number(e.target.value))}
                              >
                                <option value="">Pilih entri…</option>
                                {allEntries?.filter(c => c.id !== selectedCharacter?.id).map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </div>

                            {/* Relationship Type Map */}
                            <div className="space-y-2">
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Jenis hubungan</label>
                              <div className="grid grid-cols-4 gap-2">
                                {RELATIONSHIP_TYPES.map(r => {
                                  const st = styleOf(r.value);
                                  const Icon = st.icon;
                                  return (
                                    <button
                                      key={r.value}
                                      onClick={() => setType(r.value)}
                                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl transition-all border ${
                                        type === r.value
                                          ? st.activeClass
                                          : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                      }`}
                                      title={r.label}
                                    >
                                      <Icon size={18} className="mb-1" />
                                      <span className="text-[10px] font-bold tracking-wide truncate w-full text-center">{r.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Description Input */}
                            <div className="space-y-2 md:col-span-2">
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1"><AlignLeft size={12}/> Deskripsi (opsional)</label>
                              <textarea
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-slate-200 outline-none transition-shadow min-h-[80px] resize-none"
                                placeholder="Gambarkan dinamika hubungan mereka…"
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
                              Batal
                            </button>
                            <button
                              onClick={saveRelationship}
                              disabled={!targetId}
                              className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                              {editingId ? 'Simpan perubahan' : 'Buat hubungan'}
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
                      {RELATIONSHIP_TYPES.map(def => renderRelationshipCards(def, groupedRelationships[def.value]))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-6 text-slate-300 dark:text-slate-600 border-4 border-white dark:border-slate-900 border-dashed">
                        <Users size={40} />
                      </div>
                      <h4 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">Belum ada hubungan</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">Buat hubungan pertama untuk {selectedCharacter.name} agar posisinya dalam cerita terpetakan.</p>
                      {!isAdding && (
                         <button
                           onClick={() => setIsAdding(true)}
                           className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm"
                         >
                           <UserPlus size={16} />
                           Tambah hubungan
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
               <h4 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">Pusat Karakter</h4>
               <p className="text-slate-500 dark:text-slate-400 max-w-sm">Pilih karakter dari daftar untuk melihat dan mengelola hubungannya.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
