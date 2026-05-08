const fs = require('fs');
const path = require('path');

const dirs = ['./src/components', './src'];
for (const dir of dirs) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

  const replacements = [
    { p: /bg-white(?! dark:bg-slate-[89]00)/g, r: 'bg-white dark:bg-slate-900' },
    { p: /border-slate-200(?! dark:border-slate-[78]00)/g, r: 'border-slate-200 dark:border-slate-800' },
    { p: /bg-slate-50(?![\/a-z0-9-]* dark:bg-slate-[89]00)/g, r: 'bg-slate-50 dark:bg-slate-800/50' },
    { p: /bg-slate-100(?! dark:bg-slate-[89]00)/g, r: 'bg-slate-100 dark:bg-slate-800' },
    { p: /border-slate-100(?! dark:border-slate-[78]00)/g, r: 'border-slate-100 dark:border-slate-800' },
    { p: /text-slate-900(?! dark:text-slate-[12]00)/g, r: 'text-slate-900 dark:text-slate-100' },
    { p: /text-slate-800(?! dark:text-slate-[23]00)/g, r: 'text-slate-800 dark:text-slate-200' },
    { p: /text-slate-700(?! dark:text-slate-[23]00)/g, r: 'text-slate-700 dark:text-slate-200' },
    { p: /text-slate-600(?! dark:text-slate-[45]00)/g, r: 'text-slate-600 dark:text-slate-400' },
    { p: /text-slate-500(?! dark:text-slate-[45]00)/g, r: 'text-slate-500 dark:text-slate-400' },
    { p: /text-slate-400(?! dark:text-[a-z]+-[56]00)/g, r: 'text-slate-400 dark:text-slate-500' },
  ];

  for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    for (const { p, r } of replacements) {
      content = content.replace(p, r);
    }

    // specific layout fixes
    content = content.replace(/dark:bg-slate-900 dark:bg-slate-900/g, 'dark:bg-slate-900');
    content = content.replace(/dark:border-slate-800 dark:border-slate-800/g, 'dark:border-slate-800');
    content = content.replace(/dark:bg-slate-800\/50\/50/g, 'dark:bg-slate-800/50');
    content = content.replace(/dark:bg-slate-800 dark:bg-slate-800\/50/g, 'dark:bg-slate-800');
    content = content.replace(/dark:bg-slate-800\/50 dark:bg-slate-800\/50/g, 'dark:bg-slate-800/50');
    content = content.replace(/dark:bg-slate-800\/50\/80/g, 'dark:bg-slate-800/50');
    content = content.replace(/dark:bg-slate-800\/50\/30/g, 'dark:bg-slate-800/50');

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`Updated ${file}`);
    }
  }
}
