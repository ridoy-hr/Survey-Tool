import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');
content = content.replace(/\{questions\.map\(/g, "{questions.filter(Boolean).map(");
content = content.replace(/\{toasts\.map\(/g, "{toasts.filter(Boolean).map(");
content = content.replace(/\{filteredSurveys\.map\(/g, "{filteredSurveys.filter(Boolean).map(");
content = content.replace(/\{responses\.map\(/g, "{responses.filter(Boolean).map(");
content = content.replace(/\{responses\.slice\(0, 5\)\.map\(/g, "{responses.filter(Boolean).slice(0, 5).map(");
content = content.replace(/\{questions\.slice\(0, 4\)\.map\(/g, "{questions.filter(Boolean).slice(0, 4).map(");
fs.writeFileSync('src/App.tsx', content);
