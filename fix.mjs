import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Filter questions and links to remove nulls before processing arrays
content = content.replace(/questions = sData\.questions \|\| \[\];/g, "questions = (sData.questions || []).filter(Boolean);");
content = content.replace(/ setQuestions\(sData\.questions \|\| \[\]\);/g, " setQuestions((sData.questions || []).filter(Boolean));");
content = content.replace(/const questions = survey\.questions \|\| \[\];/g, "const questions = (survey.questions || []).filter(Boolean);");

content = content.replace(/q => q\.id/g, "q => q && q.id");
content = content.replace(/s => s\.id/g, "s => s && s.id");
content = content.replace(/l => l\.id/g, "l => l && l.id");
content = content.replace(/t => t\.id/g, "t => t && t.id");

content = content.replace(/q\.type/g, "q?.type");
content = content.replace(/q\.text/g, "q?.text");
content = content.replace(/q\.desc/g, "q?.desc");
content = content.replace(/q\.alias/g, "q?.alias");
content = content.replace(/q\.required/g, "q?.required");

fs.writeFileSync('src/App.tsx', content);
