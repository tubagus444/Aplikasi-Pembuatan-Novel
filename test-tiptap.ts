import StarterKit from '@tiptap/starter-kit';
console.log(StarterKit.configure({}).config.addExtensions.call({options:{}}).map(e => e.name));
