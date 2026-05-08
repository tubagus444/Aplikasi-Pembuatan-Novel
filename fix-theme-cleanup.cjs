const fs = require('fs');
const path = require('path');

const dirs = ['./src/components', './src'];
for (const dir of dirs) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

  for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // cleanup duplicated dark colors
    content = content.replace(/dark:text-slate-500 dark:text-slate-400/g, 'dark:text-slate-400');
    content = content.replace(/dark:text-slate-400 dark:text-slate-500/g, 'dark:text-slate-400');
    content = content.replace(/dark:text-slate-500 dark:text-slate-[456]00/g, 'dark:text-slate-400');
    content = content.replace(/dark:text-slate-400 dark:text-slate-[456]00/g, 'dark:text-slate-400');
    content = content.replace(/dark:text-slate-200 dark:text-slate-[123]00/g, 'dark:text-slate-200');
    content = content.replace(/dark:text-slate-[12]00 dark:text-slate-200/g, 'dark:text-slate-200');
    content = content.replace(/dark:text-slate-100 dark:text-slate-100/g, 'dark:text-slate-100');
    content = content.replace(/dark:bg-slate-900 dark:bg-slate-[89]00/g, 'dark:bg-slate-900');
    content = content.replace(/dark:bg-slate-800\/50 dark:bg-slate-[89]00(\/50)?/g, 'dark:bg-slate-800/50');

    // fix hover:bg-slate-50 dark:bg-slate-800/50
    content = content.replace(/hover:bg-slate-50 dark:bg-slate-800\/50/g, 'hover:bg-slate-50 dark:hover:bg-slate-800/50');
    content = content.replace(/hover:bg-white dark:bg-slate-900/g, 'hover:bg-white dark:hover:bg-slate-900');
    content = content.replace(/hover:border-slate-200 dark:border-slate-800/g, 'hover:border-slate-200 dark:hover:border-slate-800');

    // Fix the case where text-slate-XYZ got duplicated
    content = content.replace(/dark:text-slate-\d00(?:\s+dark:text-slate-\d00)+/g, (match) => {
      // just extract the first one
      const m = match.match(/dark:text-slate-\d00/);
      return m ? m[0] : match;
    });

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`Cleaned up ${file}`);
    }
  }
}
