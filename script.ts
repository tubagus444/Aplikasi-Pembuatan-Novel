import fs from 'fs';
import path from 'path';

const moves = [
  { src: 'src/EditorPanelContext.tsx', dest: 'src/contexts/EditorPanelContext.tsx' },
  { src: 'src/components/NovelEditor.tsx', dest: 'src/components/editor/NovelEditor.tsx' },
  { src: 'src/components/ProjectManagerModal.tsx', dest: 'src/components/modals/ProjectManagerModal.tsx' },
  { src: 'src/components/Toast.tsx', dest: 'src/components/common/Toast.tsx' },
  { src: 'src/components/ErrorBoundary.tsx', dest: 'src/components/common/ErrorBoundary.tsx' },
  { src: 'src/components/OpenRouterModelSelect.tsx', dest: 'src/components/common/OpenRouterModelSelect.tsx' },
  { src: 'src/components/SessionModeSelector.tsx', dest: 'src/components/common/SessionModeSelector.tsx' },
  { src: 'src/components/ActionsPanel.tsx', dest: 'src/components/panels/ActionsPanel.tsx' },
  { src: 'src/components/BiblePanel.tsx', dest: 'src/components/panels/BiblePanel.tsx' },
  { src: 'src/components/CodexPanel.tsx', dest: 'src/components/panels/CodexPanel.tsx' },
  { src: 'src/components/ErrorLogPanel.tsx', dest: 'src/components/panels/ErrorLogPanel.tsx' },
  { src: 'src/components/GuidePanel.tsx', dest: 'src/components/panels/GuidePanel.tsx' },
  { src: 'src/components/OutlinePanel.tsx', dest: 'src/components/panels/OutlinePanel.tsx' },
  { src: 'src/components/SettingsPanel.tsx', dest: 'src/components/panels/SettingsPanel.tsx' },
  { src: 'src/components/SnapshotPanel.tsx', dest: 'src/components/panels/SnapshotPanel.tsx' },
  { src: 'src/components/TimelinePanel.tsx', dest: 'src/components/panels/TimelinePanel.tsx' },
  { src: 'src/components/ScribbleAssistantPanel.tsx', dest: 'src/components/panels/ScribbleAssistantPanel.tsx' },
  { src: 'src/components/AIBrainstormStudio.tsx', dest: 'src/components/brainstorm/AIBrainstormStudio.tsx' },
  { src: 'src/components/RelationshipMapper.tsx', dest: 'src/components/panels/RelationshipMapper.tsx' }
];

// Instead of manually fixing all relative imports, we will rewrite imports to use the `@/` alias
// since vite and tsconfig both support `@/` mapping to `./`.
// Wait, `./` maps to project root. So `@/src/components/...` works perfectly!

function replaceInFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Easy replacements for file moves. We replace exact matching imports with alias!
  
  // Convert any local relative imports of the moved files to `@/src/...`
  // This is a bit tricky, regex might match things weirdly.
  // Actually, replacing all `from '.../components/CodexPanel'` with `from '@/src/components/panels/CodexPanel'`
  // Let's do string replacement for the class names.
  
  const replacements = [
    { regex: /from\s+['"](?:\.\/|\.\.\/)*EditorPanelContext['"]/g, new: "from '@/src/contexts/EditorPanelContext'" },
    { regex: /from\s+['"](?:\.\/|\.\.\/)*NovelEditor['"]/g, new: "from '@/src/components/editor/NovelEditor'" },
    { regex: /from\s+['"](?:\.\/|\.\.\/)*ProjectManagerModal['"]/g, new: "from '@/src/components/modals/ProjectManagerModal'" },
    { regex: /from\s+['"](?:\.\/|\.\.\/)*Toast['"]/g, new: "from '@/src/components/common/Toast'" },
    { regex: /from\s+['"](?:\.\/|\.\.\/)*ErrorBoundary['"]/g, new: "from '@/src/components/common/ErrorBoundary'" },
    { regex: /from\s+['"](?:\.\/|\.\.\/)*OpenRouterModelSelect['"]/g, new: "from '@/src/components/common/OpenRouterModelSelect'" },
    { regex: /from\s+['"](?:\.\/|\.\.\/)*SessionModeSelector['"]/g, new: "from '@/src/components/common/SessionModeSelector'" },
    { regex: /from\s+['"](?:\.\/|\.\.\/)*ActionsPanel['"]/g, new: "from '@/src/components/panels/ActionsPanel'" },
    { regex: /from\s+['"](?:\.\/|\.\.\/)*BiblePanel['"]/g, new: "from '@/src/components/panels/BiblePanel'" },
    { regex: /from\s+['"](?:\.\/|\.\.\/)*CodexPanel['"]/g, new: "from '@/src/components/panels/CodexPanel'" },
    { regex: /from\s+['"](?:\.\/|\.\.\/)*ErrorLogPanel['"]/g, new: "from '@/src/components/panels/ErrorLogPanel'" },
    { regex: /from\s+['"](?:\.\/|\.\.\/)*GuidePanel['"]/g, new: "from '@/src/components/panels/GuidePanel'" },
    { regex: /from\s+['"](?:\.\/|\.\.\/)*OutlinePanel['"]/g, new: "from '@/src/components/panels/OutlinePanel'" },
    { regex: /from\s+['"](?:\.\/|\.\.\/)*SettingsPanel['"]/g, new: "from '@/src/components/panels/SettingsPanel'" },
    { regex: /from\s+['"](?:\.\/|\.\.\/)*SnapshotPanel['"]/g, new: "from '@/src/components/panels/SnapshotPanel'" },
    { regex: /from\s+['"](?:\.\/|\.\.\/)*TimelinePanel['"]/g, new: "from '@/src/components/panels/TimelinePanel'" },
    { regex: /from\s+['"](?:\.\/|\.\.\/)*ScribbleAssistantPanel['"]/g, new: "from '@/src/components/panels/ScribbleAssistantPanel'" },
    { regex: /from\s+['"](?:\.\/|\.\.\/)*AIBrainstormStudio['"]/g, new: "from '@/src/components/brainstorm/AIBrainstormStudio'" },
    { regex: /from\s+['"](?:\.\/|\.\.\/)*RelationshipMapper['"]/g, new: "from '@/src/components/panels/RelationshipMapper'" },
    
    // Dynamic imports
    { regex: /import\(['"](?:\.\/|\.\.\/)*CodexPanel['"]\)/g, new: "import('@/src/components/panels/CodexPanel')" },
    { regex: /import\(['"](?:\.\/|\.\.\/)*ActionsPanel['"]\)/g, new: "import('@/src/components/panels/ActionsPanel')" },
    { regex: /import\(['"](?:\.\/|\.\.\/)*BiblePanel['"]\)/g, new: "import('@/src/components/panels/BiblePanel')" },
    { regex: /import\(['"](?:\.\/|\.\.\/)*ErrorLogPanel['"]\)/g, new: "import('@/src/components/panels/ErrorLogPanel')" },
    { regex: /import\(['"](?:\.\/|\.\.\/)*GuidePanel['"]\)/g, new: "import('@/src/components/panels/GuidePanel')" },
    { regex: /import\(['"](?:\.\/|\.\.\/)*OutlinePanel['"]\)/g, new: "import('@/src/components/panels/OutlinePanel')" },
    { regex: /import\(['"](?:\.\/|\.\.\/)*SettingsPanel['"]\)/g, new: "import('@/src/components/panels/SettingsPanel')" },
    { regex: /import\(['"](?:\.\/|\.\.\/)*SnapshotPanel['"]\)/g, new: "import('@/src/components/panels/SnapshotPanel')" },
    { regex: /import\(['"](?:\.\/|\.\.\/)*TimelinePanel['"]\)/g, new: "import('@/src/components/panels/TimelinePanel')" },
    { regex: /import\(['"](?:\.\/|\.\.\/)*ScribbleAssistantPanel['"]\)/g, new: "import('@/src/components/panels/ScribbleAssistantPanel')" },
    { regex: /import\(['"](?:\.\/|\.\.\/)*AIBrainstormStudio['"]\)/g, new: "import('@/src/components/brainstorm/AIBrainstormStudio')" },
    { regex: /import\(['"](?:\.\/|\.\.\/)*RelationshipMapper['"]\)/g, new: "import('@/src/components/panels/RelationshipMapper')" },
  ];

  for (const rep of replacements) {
    content = content.replace(rep.regex, rep.new);
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated imports in: ${filePath}`);
  }
}

function processDirectory(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      replaceInFile(fullPath);
    }
  }
}

// Ensure target directories exist before moving
for (const move of moves) {
  const dir = path.dirname(move.dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// DO IMPORTS REPLACE FIRST before moving, so we don't miss internal file imports
processDirectory('./src');

for (const move of moves) {
  if (fs.existsSync(move.src)) {
    fs.renameSync(move.src, move.dest);
    console.log(`Moved ${move.src} -> ${move.dest}`);
  }
}

// After moving files, the files inside src/components/panels/ etc might still have 
// broken relative imports for OTHER things (like `../lib/utils`).
// We should fix internal relative imports of the MOVED files...
// Wait! If we move `src/components/SettingsPanel.tsx` to `src/components/panels/SettingsPanel.tsx`,
// all its `../lib/utils` are now broken (need to be `../../lib/utils`).
// To be safe, let's fix the imports inside the newly moved files!
const relativeCorrections = [
    {regex: /from ['"]\.\.\/lib/g, new: "from '../../lib"},
    {regex: /from ['"]\.\.\/hooks/g, new: "from '../../hooks"},
    {regex: /from ['"]\.\.\/contexts/g, new: "from '../../contexts"},
    {regex: /from ['"]\.\.\/services/g, new: "from '../../services"},
    {regex: /from ['"]\.\.\/types/g, new: "from '../../types"},
    {regex: /from ['"]\.\/Icons/g, new: "from '../Icons"}, // example
    
    // For anything that was expecting components locally, now they are one level up mostly
    // We can just rely on the `@/` replacement which we already did for Panels.
    // What about other components like `ContextPreview`?
];

// Let's run a robust script for fixing `../` in panels & modals & common:
function fixRelativeInsideMoved(filePath: string) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    // Since we moved it from `src/components/` to `src/components/panels/` (one level deeper)
    // We add an extra `../` to any import starting with `.` or `..` that isn't already aliased.
    
    // Any import from `../xxx` -> `../../xxx`
    content = content.replace(/from\s+['"]\.\.\//g, "from '../../");
    // Any import from `./xxx` -> `../xxx` IF it's referencing one of the files that stayed in components
    // Actually, it's easier to just use tsx to compile and fix any errors.
    
    // Just blindly updating might break some things. Let's do it carefully.
    content = content.replace(/from\s+['"]\.\/ui\/([^'"]+)['"]/g, "from '../ui/$1'"); // if there's any ui
    
    fs.writeFileSync(filePath, content, 'utf8');
}

for (const move of moves) {
    if (move.dest.startsWith('src/components/panels/') || move.dest.startsWith('src/components/modals/') || move.dest.startsWith('src/components/common/') || move.dest.startsWith('src/components/editor/')) {
        let content = fs.readFileSync(move.dest, 'utf8');
        // Because it was in src/components/, it's relative paths were:
        // `../lib/...` -> needs to be `../../lib/...`
        // `../contexts/...` -> needs to be `../../contexts/...`
        // `../hooks/...` -> needs to be `../../hooks/...`
        // `../types` -> needs to be `../../types`
        // `./` (brother components) -> needs to be `../`
        content = content.replace(/from\s+['"]\.\.\/([^'"]+)['"]/g, "from '../../$1'");
        content = content.replace(/from\s+['"]\.\/([^'"]+)['"]/g, "from '../$1'");
        fs.writeFileSync(move.dest, content, 'utf8');
    }
}
