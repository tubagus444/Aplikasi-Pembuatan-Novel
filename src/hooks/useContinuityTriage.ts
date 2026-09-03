/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/db';
import { ContinuityTriage, TriageStatus } from '@/src/types';

export function useContinuityTriage(projectId: number) {
  // Query all triage records for the current project
  const triageRecords = useLiveQuery(
    () => db.continuityTriage.where('projectId').equals(projectId).toArray(),
    [projectId]
  );

  // Convert to a Map for O(1) lookups by findingId
  const triageMap = new Map<string, ContinuityTriage>();
  if (triageRecords) {
    for (const record of triageRecords) {
      triageMap.set(record.findingId, record);
    }
  }

  const setTriage = useCallback(async (findingId: string, status: TriageStatus) => {
    // Avoid dependency on triageMap by querying directly before update
    // Alternatively, use triageMap if we are confident it's up to date.
    // Let's query to be safe against race conditions.
    const existing = await db.continuityTriage
      .where('[projectId+findingId]')
      .equals([projectId, findingId])
      .first();
      
    // Wait, we don't have [projectId+findingId] index. We only have ++id, projectId, findingId.
    // Let's use triageMap to find the ID.
    const existingFromMap = triageMap.get(findingId);
    
    if (existingFromMap?.id) {
      await db.continuityTriage.update(existingFromMap.id, { status, timestamp: Date.now() });
    } else {
      // Need to query just in case it wasn't in map yet due to React render cycle
      const allForProject = await db.continuityTriage.where('projectId').equals(projectId).toArray();
      const dbExisting = allForProject.find(t => t.findingId === findingId);
      if (dbExisting?.id) {
        await db.continuityTriage.update(dbExisting.id, { status, timestamp: Date.now() });
      } else {
        await db.continuityTriage.add({
          projectId,
          findingId,
          status,
          timestamp: Date.now(),
        });
      }
    }
  }, [projectId, triageMap]);

  const clearTriage = useCallback(async (findingId: string) => {
    const existingFromMap = triageMap.get(findingId);
    if (existingFromMap?.id) {
      await db.continuityTriage.delete(existingFromMap.id);
    } else {
      const allForProject = await db.continuityTriage.where('projectId').equals(projectId).toArray();
      const dbExisting = allForProject.find(t => t.findingId === findingId);
      if (dbExisting?.id) {
        await db.continuityTriage.delete(dbExisting.id);
      }
    }
  }, [projectId, triageMap]);

  return {
    triageMap,
    setTriage,
    clearTriage,
  };
}
