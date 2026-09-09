import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');
content = content.replace(/links\.map\(link => \(/g, "links.filter(Boolean).map(link => (");
content = content.replace(/data\.links\.map\(l => \{/g, "(data.links||[]).filter(Boolean).map(l => {");
fs.writeFileSync('src/App.tsx', content);
