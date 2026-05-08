import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { CodexEntry, Relationship } from '../types';
import { Plus, Trash2, Link as LinkIcon, Users, Heart, Sword, ShieldAlert, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ForceGraph2D from 'react-force-graph-2d';

interface ReactForceGraph2dNode {
  id?: string | number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  name?: string;
  [key: string]: any;
}

interface ReactForceGraph2dLink {
  source?: string | number | ReactForceGraph2dNode;
  target?: string | number | ReactForceGraph2dNode;
  color?: string;
  [key: string]: any;
}

interface RelationshipMapperProps {
  projectId: number;
}

export function RelationshipMapper({ projectId }: RelationshipMapperProps) {
  const characters = useLiveQuery(() => 
    db.codex.where('projectId').equals(projectId).and(item => item.category === 'character').toArray()
  , [projectId]);

  const relationships = useLiveQuery(() => 
    db.relationships.where('projectId').equals(projectId).toArray()
  , [projectId]);

  const [isAdding, setIsAdding] = useState(false);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [type, setType] = useState('Friend');

  const addRelationship = async () => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    await db.relationships.add({
      projectId,
      sourceId,
      targetId,
      type
    });
    setIsAdding(false);
    setSourceId(null);
    setTargetId(null);
  };

  const deleteRelationship = async (id: number) => {
    await db.relationships.delete(id);
  };

  const getCharacterName = (id: number) => characters?.find(c => c.id === id)?.name || 'Unknown';

  const RELATION_TYPES = [
    { label: 'Friend', icon: Users, color: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400', activeClass: 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/50 dark:bg-blue-500/20', hex: '#3b82f6' },
    { label: 'Lover', icon: Heart, color: 'text-pink-600 bg-pink-50 dark:bg-pink-500/10 dark:text-pink-400', activeClass: 'border-pink-500 ring-1 ring-pink-500 bg-pink-50/50 dark:bg-pink-500/20', hex: '#ec4899' },
    { label: 'Enemy', icon: Sword, color: 'text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400', activeClass: 'border-red-500 ring-1 ring-red-500 bg-red-50/50 dark:bg-red-500/20', hex: '#ef4444' },
    { label: 'Ally', icon: ShieldAlert, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400', activeClass: 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/20', hex: '#10b981' },
    { label: 'Other', icon: LinkIcon, color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400', activeClass: 'border-slate-500 ring-1 ring-slate-500 bg-slate-100 dark:bg-slate-800', hex: '#94a3b8' },
  ];

  const graphData = useMemo(() => {
    const nodes = characters?.map(c => ({ id: c.id, name: c.name, val: 10 })) || [];
    const links = relationships?.map(r => ({
      source: r.sourceId,
      target: r.targetId,
      type: r.type,
      color: RELATION_TYPES.find(t => t.label === r.type)?.hex || '#94a3b8'
    })) || [];
    return { nodes, links };
  }, [characters, relationships]);

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-foreground">Relationship Mapper</h2>
          <p className="text-sm text-muted-foreground mt-1 tracking-wide">Visualize Character Bonds</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm ${
            isAdding 
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700' 
              : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md'
          }`}
        >
          <Plus size={16} className={isAdding ? 'rotate-45 transition-transform' : 'transition-transform'} />
          {isAdding ? 'Cancel' : 'New Bond'}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Relations List Panel */}
        <div className="lg:col-span-4 flex flex-col h-full bg-white/50 dark:bg-slate-900/20 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50">
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <LinkIcon size={16} className="text-indigo-500" />
              Active Connections
              <span className="ml-auto bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-0.5 px-2 rounded-full text-xs font-bold">
                {relationships?.length || 0}
              </span>
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
            <AnimatePresence mode="popLayout">
              {isAdding && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, scale: 0.95 }}
                  animate={{ opacity: 1, height: 'auto', scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.95 }}
                  className="overflow-hidden"
                >
                  <div className="bg-white dark:bg-slate-900 border lg:border border-indigo-200 dark:border-indigo-900 rounded-2xl p-4 shadow-sm mb-4 space-y-5">
                    <div className="space-y-4">
                      
                      {/* From */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Source</label>
                        <select 
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-slate-200 outline-none transition-shadow"
                          value={sourceId || ''}
                          onChange={e => setSourceId(Number(e.target.value))}
                        >
                          <option value="">Select Character...</option>
                          {characters?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>

                      {/* To */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Target</label>
                        <select 
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-slate-200 outline-none transition-shadow"
                          value={targetId || ''}
                          onChange={e => setTargetId(Number(e.target.value))}
                        >
                          <option value="">Select Character...</option>
                          {characters?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Bond Type */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bond Type</label>
                      <div className="grid grid-cols-5 gap-2">
                        {RELATION_TYPES.map(r => (
                          <button
                            key={r.label}
                            onClick={() => setType(r.label)}
                            className={`flex flex-col flex-1 items-center justify-center p-2 rounded-xl transition-all border ${
                              type === r.label 
                                ? r.activeClass
                                : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                            title={r.label}
                          >
                            <r.icon size={16} className="mb-1" />
                            <span className="text-[9px] font-bold uppercase tracking-wider truncate w-full text-center">{r.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={addRelationship}
                      disabled={!sourceId || !targetId || sourceId === targetId}
                      className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                      Create Connection
                    </button>
                  </div>
                </motion.div>
              )}

              {relationships?.map((rel) => {
                const relType = RELATION_TYPES.find(r => r.label === rel.type) || RELATION_TYPES[4];
                const TypeIcon = relType.icon;
                
                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={rel.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-3 flex items-center justify-between group shadow-sm hover:shadow hover:border-indigo-500/30 dark:hover:border-indigo-400/30 transition-all"
                  >
                    <div className="flex items-center gap-3 w-full pr-2">
                      {/* Source */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                          {getCharacterName(rel.sourceId)}
                        </p>
                      </div>
                      
                      {/* Relation Badge */}
                      <div className={`px-2.5 py-1 rounded-lg flex flex-col items-center justify-center shrink-0 min-w-[64px] ${relType.color}`}>
                        <TypeIcon size={14} className="mb-0.5" />
                        <span className="text-[9px] font-bold uppercase tracking-widest">{rel.type}</span>
                      </div>

                      {/* Target */}
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                          {getCharacterName(rel.targetId)}
                        </p>
                      </div>
                    </div>

                    <button 
                      onClick={() => deleteRelationship(rel.id!)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-all shrink-0 ml-1"
                      title="Delete connection"
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {relationships?.length === 0 && !isAdding && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-300 dark:text-slate-600">
                  <Users size={32} />
                </div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">No connections yet</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px]">Create your first bond to start mapping character relationships.</p>
                <button 
                  onClick={() => setIsAdding(true)}
                  className="mt-4 px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Add a Bond
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Visualizer Canvas */}
        <div className="lg:col-span-8 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden relative shadow-inner" ref={containerRef}>
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" 
               style={{ backgroundImage: 'radial-gradient(circle, #000 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }} />
          
          <div className="h-full w-full relative z-10">
            {characters && characters.length > 0 ? (
              <ForceGraph2D
                width={dimensions.width}
                height={dimensions.height}
                graphData={graphData}
                nodeRelSize={6}
                nodeColor={() => '#6366f1'}
                linkColor={(link: ReactForceGraph2dLink) => link.color || '#cbd5e1'}
                linkWidth={3}
                linkDirectionalArrowLength={4}
                linkDirectionalArrowRelPos={1}
                nodeCanvasObject={(node: ReactForceGraph2dNode, ctx, globalScale) => {
                  const label = node.name;
                  const fontSize = Math.max(12 / globalScale, 4);
                  const isDark = document.documentElement.classList.contains('dark');
                  ctx.font = `600 ${fontSize}px Inter, sans-serif`;
                  
                  // Draw Node outline & fill
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI, false);
                  ctx.fillStyle = isDark ? '#1e293b' : '#ffffff';
                  ctx.fill();
                  ctx.lineWidth = isDark ? 2 : 1.5;
                  ctx.strokeStyle = '#6366f1';
                  ctx.stroke();

                  // Optional Text Background for better contrast
                  const textWidth = ctx.measureText(label).width;
                  const bgWidth = textWidth + (8 / globalScale);
                  const bgHeight = fontSize + (4 / globalScale);
                  const textY = node.y + (14 / Math.sqrt(globalScale));
                  
                  ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.7)';
                  ctx.beginPath();
                  if(ctx.roundRect) {
                     ctx.roundRect(node.x - bgWidth / 2, textY - bgHeight / 2, bgWidth, bgHeight, 2 / globalScale);
                     ctx.fill();
                  }

                  // Label Text
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillStyle = isDark ? '#f1f5f9' : '#334155';
                  ctx.fillText(label, node.x, textY);
                }}
                cooldownTicks={100}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400 dark:text-slate-600">
                <Users size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-medium">Add characters in the Codex</p>
                <p className="text-xs mt-1 opacity-60">to visualize their relationships here.</p>
              </div>
            )}
            
            {/* Legend Overlay */}
            {relationships && relationships.length > 0 && characters && characters.length > 0 && (
              <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 p-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm transition-opacity">
                <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Legend</h4>
                {RELATION_TYPES.filter(type => relationships.some(r => r.type === type.label)).map(type => (
                  <div key={type.label} className="flex items-center gap-2">
                    <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: type.hex }} />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{type.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
