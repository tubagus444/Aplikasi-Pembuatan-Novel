/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, ShieldAlert, Zap, Book, Target, Sparkles, BookOpen, Fingerprint } from 'lucide-react';
import { StoryBibleRule } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface BiblePanelProps {
  projectId: number;
}

export function BiblePanel({ projectId }: BiblePanelProps) {
  const allRules = useLiveQuery(() => 
    db.bible.where('projectId').equals(projectId).toArray()
  , [projectId]);

  const [activeTab, setActiveTab] = useState<'directives' | 'themes' | 'premise'>('premise');
  
  // Premise state
  const premiseRule = allRules?.find(r => r.key === '__CORE_PREMISE__');
  const [premiseText, setPremiseText] = useState('');
  const [isEditingPremise, setIsEditingPremise] = useState(false);

  useEffect(() => {
    if (premiseRule && !isEditingPremise) {
      setPremiseText(premiseRule.instruction);
    }
  }, [premiseRule, isEditingPremise]);

  const savePremise = async () => {
    if (premiseRule) {
      await db.bible.update(premiseRule.id!, { instruction: premiseText });
    } else {
      await db.bible.add({ projectId, key: '__CORE_PREMISE__', instruction: premiseText });
    }
    setIsEditingPremise(false);
  };

  // Directives & Themes filtering
  const directives = allRules?.filter(r => r.key !== '__CORE_PREMISE__' && !r.key.startsWith('__THEME__')) || [];
  const themes = allRules?.filter(r => r.key.startsWith('__THEME__')) || [];

  const [isAdding, setIsAdding] = useState(false);
  const [newRule, setNewRule] = useState({ key: '', instruction: '' });

  const addRule = async () => {
    if (!newRule.key || !newRule.instruction) return;
    
    let key = newRule.key;
    if (activeTab === 'themes') {
      key = `__THEME__${newRule.key}`;
    }

    await db.bible.add({
      projectId,
      key,
      instruction: newRule.instruction
    });
    setIsAdding(false);
    setNewRule({ key: '', instruction: '' });
  };

  const deleteRule = async (id: number) => {
    await db.bible.delete(id);
  };

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <div className="mb-8 border-b border-slate-200 dark:border-slate-800 pb-6">
        <h2 className="text-3xl font-serif font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
          <Book className="text-indigo-600 dark:text-indigo-400" />
          Story Bible
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          The foundational truths, themes, and narrative constraints of your world. 
          The AI will deeply integrate these principles into every generation.
        </p>
      </div>

      <div className="flex gap-4 mb-8 border-b border-slate-200 dark:border-slate-800">
        <TabButton 
          active={activeTab === 'premise'} 
          onClick={() => setActiveTab('premise')}
          icon={<BookOpen size={16} />}
          label="Core Premise"
        />
        <TabButton 
          active={activeTab === 'themes'} 
          onClick={() => setActiveTab('themes')}
          icon={<Sparkles size={16} />}
          label="Thematic Pillars"
        />
        <TabButton 
          active={activeTab === 'directives'} 
          onClick={() => setActiveTab('directives')}
          icon={<Target size={16} />}
          label="Narrative Directives"
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
           key={activeTab}
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           exit={{ opacity: 0, y: -10 }}
           transition={{ duration: 0.2 }}
        >
          {activeTab === 'premise' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest text-[11px]">Core Concept & Synopsis</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">What is this story fundamentally about?</p>
                  </div>
                  {!isEditingPremise && (
                    <button 
                      onClick={() => setIsEditingPremise(true)}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    >
                      Edit Premise
                    </button>
                  )}
                </div>

                {isEditingPremise ? (
                  <div className="space-y-4">
                    <textarea 
                      className="w-full h-64 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-5 text-sm font-serif leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-200"
                      placeholder="Once upon a time..."
                      value={premiseText}
                      onChange={e => setPremiseText(e.target.value)}
                    />
                    <div className="flex justify-end gap-3">
                      <button 
                        onClick={() => {
                          setIsEditingPremise(false);
                          setPremiseText(premiseRule?.instruction || '');
                        }}
                        className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={savePremise}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-indigo-700"
                      >
                        Save Concept
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-slate dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 font-serif leading-loose">
                    {premiseRule?.instruction ? (
                      <div className="whitespace-pre-wrap">{premiseRule.instruction}</div>
                    ) : (
                      <div className="text-center py-12 text-slate-400 italic border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                        No premise defined. Write the foundational logline or synopsis to guide the AI.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'themes' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Philosophical questions, moral dilemmas, or recurring motifs.
                </p>
                {!isAdding && (
                  <button 
                    onClick={() => {
                      setNewRule({ key: '', instruction: '' });
                      setIsAdding(true);
                    }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 transition"
                  >
                    <Plus size={14} /> Add Theme
                  </button>
                )}
              </div>

              {isAdding && (
                <RuleForm 
                  type="Theme" 
                  rule={newRule} 
                  setRule={setNewRule} 
                  onSave={addRule} 
                  onCancel={() => setIsAdding(false)} 
                />
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {themes.map(rule => (
                  <RuleCard 
                    key={rule.id} 
                    rule={{...rule, key: rule.key.replace('__THEME__', '')}} 
                    onDelete={() => deleteRule(rule.id!)} 
                    icon={<Sparkles className="text-amber-500" size={16} />}
                  />
                ))}
                
                {themes.length === 0 && !isAdding && (
                  <EmptyState icon={<Sparkles size={32} />} message="No themes defined. Add elements like 'Betrayal vs Loyalty' or 'Man vs Nature'." />
                )}
              </div>
            </div>
          )}

          {activeTab === 'directives' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Strict rules for Tone, Point of View, Style, and formatting.
                </p>
                {!isAdding && (
                  <button 
                    onClick={() => {
                      setNewRule({ key: '', instruction: '' });
                      setIsAdding(true);
                    }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 transition"
                  >
                    <Plus size={14} /> Add Directive
                  </button>
                )}
              </div>

              {isAdding && (
                <RuleForm 
                  type="Constraint" 
                  rule={newRule} 
                  setRule={setNewRule} 
                  onSave={addRule} 
                  onCancel={() => setIsAdding(false)} 
                />
              )}

              <div className="grid grid-cols-1 gap-4">
                {directives.map(rule => (
                  <RuleCard 
                    key={rule.id} 
                    rule={rule} 
                    onDelete={() => deleteRule(rule.id!)} 
                    icon={<Fingerprint className="text-indigo-500" size={16} />}
                    isFullWidth
                  />
                ))}

                {directives.length === 0 && !isAdding && (
                  <EmptyState icon={<Fingerprint size={32} />} message="No directives defined. Add rules like 'Tone', 'POV', or 'Ban Adverbs'." />
                )}
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
      
      <div className="mt-16 p-8 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl flex gap-6 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100/50 dark:bg-indigo-800/20 rounded-full -mr-16 -mt-16" />
        <ShieldAlert className="text-indigo-500 dark:text-indigo-400 shrink-0" size={24} />
        <div className="relative z-10 flex-1">
          <h4 className="font-bold text-indigo-900 dark:text-indigo-200 text-sm uppercase tracking-tight">System Prompt Integration</h4>
          <p className="text-sm text-indigo-800 dark:text-indigo-300/80 leading-relaxed mt-2 max-w-3xl">
            Everything defined in the Story Bible is heavily weighted by the AI's Context Engine. The Premise grounds the overall plot, Themes guide semantic choices, and Directives impose strict stylistic parameters on generated text.
          </p>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 pb-3 px-2 text-sm font-bold uppercase tracking-wider relative transition-colors",
        active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
      )}
    >
      {icon}
      {label}
      {active && (
        <motion.div 
          layoutId="bibleTab"
          className="absolute -bottom-px left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400" 
        />
      )}
    </button>
  );
}

interface RuleFormProps {
  type: string;
  rule: { key: string; instruction: string };
  setRule: (rule: { key: string; instruction: string }) => void;
  onSave: () => void;
  onCancel: () => void;
}

function RuleForm({ type, rule, setRule, onSave, onCancel }: RuleFormProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-6"
    >
      <div className="md:col-span-1 border-r border-transparent md:border-slate-100 dark:border-slate-800 md:pr-6">
        <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 mb-2 block">{type} Name</label>
        <input 
          autoFocus
          className="w-full text-sm font-bold p-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100 placeholder:text-slate-400"
          placeholder={type === 'Theme' ? "e.g. Sacrifice" : "e.g. Tone, POV"}
          value={rule.key}
          onChange={e => setRule({...rule, key: e.target.value})}
        />
      </div>
      <div className="md:col-span-2">
        <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 mb-2 block">Instruction / Details</label>
        <textarea 
          className="w-full text-sm p-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100 placeholder:text-slate-400 min-h-[80px]"
          placeholder={type === 'Theme' ? "Describe how this theme manifests..." : "Provide specific creative constraint..."}
          value={rule.instruction}
          onChange={e => setRule({...rule, instruction: e.target.value})}
        />
      </div>
      <div className="md:col-span-3 flex justify-end gap-3 pt-2">
         <button 
          onClick={onCancel}
          className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          Cancel
        </button>
        <button 
          onClick={onSave}
          disabled={!rule.key || !rule.instruction}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Save {type}
        </button>
      </div>
    </motion.div>
  );
}

interface RuleCardProps {
  rule: { id?: number; key: string; instruction: string };
  onDelete: () => void;
  icon: React.ReactNode;
  isFullWidth?: boolean;
}

function RuleCard({ rule, onDelete, icon, isFullWidth = false }: RuleCardProps) {
  return (
    <div className={cn("group flex p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all", isFullWidth ? "items-center justify-between" : "flex-col")}>
      <div className={cn("flex gap-6", isFullWidth ? "items-center" : "flex-col")}>
        <div className={cn("shrink-0", isFullWidth ? "w-40" : "")}>
          <div className="flex items-center gap-2 mb-2">
            {icon}
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">{rule.key.startsWith('__THEME__') ? 'Theme' : 'Directive'}</span>
          </div>
          <span className={cn("font-bold text-slate-900 dark:text-slate-100", isFullWidth ? "text-sm" : "text-base")}>{rule.key}</span>
        </div>
        <div className={cn("flex-1", isFullWidth ? "border-l border-slate-100 dark:border-slate-800 pl-6" : "pt-4 border-t border-slate-100 dark:border-slate-800 mt-2")}>
          <span className="text-sm text-slate-600 dark:text-slate-300 font-serif leading-relaxed line-clamp-4">{rule.instruction}</span>
        </div>
      </div>
      <button 
        onClick={onDelete}
        className={cn("opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20", isFullWidth ? "" : "absolute top-4 right-4")}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode, message: string }) {
  return (
    <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30">
      <div className="text-slate-300 dark:text-slate-600 mx-auto w-fit mb-4">{icon}</div>
      <p className="text-slate-400 dark:text-slate-500 font-serif italic text-sm">{message}</p>
    </div>
  );
}
