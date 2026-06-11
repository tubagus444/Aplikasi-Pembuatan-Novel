import { create, insert, search, Orama, remove } from '@orama/orama';
import { CodexEntry } from '@/src/types';
import { db } from '@/src/db';

export class OramaStore {
  private db: Orama<any> | null = null;
  private currentProjectId: number | null = null;
  private idMap: Map<number, string> = new Map(); // Map Dexie ID to Orama Document ID

  async init(projectId: number) {
    if (this.currentProjectId === projectId && this.db) {
      return; // Already initialized
    }

    this.currentProjectId = projectId;
    this.idMap.clear();
    
    // Create new Orama instance
    this.db = await create({
      schema: {
        dexieId: 'number',
        name: 'string',
        aliases: 'string[]',
        category: 'string',
        description: 'string',
        tags: 'string[]',
      }
    });

    // Populate with existing codex entries
    const entries = await db.codex.where('projectId').equals(projectId).toArray();
    for (const entry of entries) {
      await this.indexEntry(entry);
    }
    
    console.log(`[RAG] Orama initialized with ${entries.length} entries for project ${projectId}.`);
  }

  async indexEntry(entry: CodexEntry) {
    if (!this.db || !entry.id) return;
    try {
      const oramaId = await insert(this.db, {
        dexieId: entry.id,
        name: entry.name,
        aliases: entry.aliases || [],
        category: entry.category,
        description: entry.description || '',
        tags: entry.tags || [],
      });
      this.idMap.set(entry.id, oramaId);
    } catch (e) {
      console.error('Failed to index codex entry in Orama', e);
    }
  }

  async updateEntry(entry: CodexEntry) {
    if (!entry.id) return;
    await this.removeEntry(entry.id);
    await this.indexEntry(entry);
  }

  async removeEntry(dexieId: number) {
    if (!this.db) return;
    const oramaId = this.idMap.get(dexieId);
    if (oramaId) {
      try {
        await remove(this.db, oramaId);
        this.idMap.delete(dexieId);
      } catch (e) {
        console.error('Failed to remove entry from Orama', e);
      }
    }
  }

  async search(query: string, limit: number = 5): Promise<CodexEntry[]> {
    if (!this.db || !query.trim()) return [];

    try {
      const results = await search(this.db, {
        term: query,
        properties: ['name', 'aliases', 'category', 'description', 'tags'],
        limit,
      });

      const ids = results.hits
        .map(hit => hit.document.dexieId as number)
        .filter(id => id !== undefined);
      
      if (ids.length === 0) return [];

      // Fetch full records from Dexie to get complete up-to-date data
      const entries = await db.codex.where('id').anyOf(ids).toArray();
      
      // Keep search relevance order
      const entryMap = new Map(entries.map(e => [e.id, e]));
      return ids.map(id => entryMap.get(id)!).filter(Boolean);
    } catch (e) {
      console.error('Orama search failed', e);
      return [];
    }
  }
}

export const oramaStore = new OramaStore();
