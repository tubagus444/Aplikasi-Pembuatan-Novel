import React from 'react';
import { SemanticCacheSection } from '@/src/components/panels/settings/sections/SemanticCacheSection';
import { ManualBackupSection } from '@/src/components/panels/settings/sections/ManualBackupSection';
import { AutoBackupSection } from '@/src/components/panels/settings/sections/AutoBackupSection';

export function BackupTab() {
  return (
    <>
      <SemanticCacheSection />
      <ManualBackupSection />
      <AutoBackupSection />
    </>
  );
}
