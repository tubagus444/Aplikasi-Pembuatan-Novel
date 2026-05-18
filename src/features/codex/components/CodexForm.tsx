import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Edit2, Plus, X, Wand2, Check } from 'lucide-react';
import { CodexEntry, CodexCategory } from '@/src/types';
import { cn } from '@/src/lib/utils';
import { expandCodexEntry } from '@/src/services/ai';
import { useToast } from '@/src/hooks/useToast';
import { useNavigation } from '@/src/contexts/NavigationContext';

interface CodexFormProps {
  initialData?: Partial<CodexEntry>;
  editingId: number | null;
  bibleRules: any[];
  onSave: (data: Partial<CodexEntry>) => Promise<void>;
  onCancel: () => void;
}

export function CodexForm({ initialData, editingId, bibleRules, onSave, onCancel }: CodexFormProps) {
  const { toast } = useToast();
  const { setViewMode } = useNavigation();
  const [formData, setFormData] = useState<Partial<CodexEntry>>({
    name: '',
    category: 'character',
    description: '',
    aliases: [],
    tags: [],
    ...initialData
  });
  const [isExpanding, setIsExpanding] = useState(false);

  useEffect(() => {
    setFormData({
      name: '',
      category: 'character',
      description: '',
      aliases: [],
      tags: [],
      ...initialData
    });
  }, [initialData]);

  const handleExpand = async () => {
    if (!formData.name) return;
    setIsExpanding(true);
    try {
      const expandedDesc = await expandCodexEntry(
        formData.name,
        formData.category || 'character',
        formData.description || '',
        bibleRules || []
      );
      setFormData(prev => ({ ...prev, description: expandedDesc }));
    } catch (e: any) {
      if (e.code === 'INVALID_KEY' || e.code === 'QUOTA_EXCEEDED') {
        toast.error(e.message, {
          action: {
            label: 'Buka Pengaturan',
            onClick: () => setViewMode('settings')
          }
        });
      } else {
        toast.error('Failed to expand: ' + e.message);
      }
    } finally {
      setIsExpanding(false);
    }
  };

  return (
    <motion.div 
      data-codex-form
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg col-span-full overflow-hidden"
    >
      <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          {editingId ? <Edit2 size={18} className="text-indigo-500" /> : <Plus size={18} className="text-indigo-500" />}
          {editingId ? 'Edit Entry' : 'New Codex Entry'}
        </h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          <X size={20} />
        </button>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Entry Name *</label>
              <input 
                autoFocus
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow dark:text-slate-100"
                placeholder="e.g. The Grand City"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
              <select 
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow dark:text-slate-100"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value as CodexCategory})}
              >
                <option value="character">Character</option>
                <option value="location">Location</option>
                <option value="magic">Magic System</option>
                <option value="item">Item/Artifact</option>
                <option value="other">Other Lore</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Aliases</label>
              <input 
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow dark:text-slate-100"
                placeholder="Comma separated (e.g. City of Lights)"
                value={formData.aliases?.join(', ')}
                onChange={e => setFormData({...formData, aliases: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
              />
            </div>
          </div>

          <div className="md:col-span-2 flex flex-col h-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Description (Markdown Supported) *</label>
              <button
                onClick={handleExpand}
                disabled={isExpanding || !formData.name}
                className={cn(
                  "flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full transition-all border",
                  isExpanding 
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-500 border-transparent animate-pulse" 
                    : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                title={!formData.name ? "Enter a name first to expand" : "Generate detailed lore using AI based on Name and Category"}
              >
                <Wand2 size={12} className={isExpanding ? "animate-spin" : ""} />
                {isExpanding ? "Expanding..." : "Expand with AI"}
              </button>
            </div>
            <textarea 
              className="w-full flex-1 min-h-[160px] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow dark:text-slate-100 resize-y font-serif leading-relaxed"
              placeholder="Describe their appearance, history, or unique traits to provide context for the AI..."
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave(formData)}
            disabled={!formData.name?.trim() || !formData.description?.trim()}
            className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            <Check size={16} /> {editingId ? 'Save Changes' : 'Create Entry'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
