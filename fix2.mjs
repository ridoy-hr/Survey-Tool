import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Filter everywhere qMap is set
content = content.replace(/qMap\[doc\.id\] = data\.questions;/g, "qMap[doc.id] = (data.questions || []).filter(Boolean);");

// Filter in RespondentFlow
content = content.replace(/setSurvey\(\{ \.\.\.data, id: docSnap\.id \} as Survey\);/g, "setSurvey({ ...data, id: docSnap.id, questions: (data.questions || []).filter(Boolean), links: (data.links || []).filter(Boolean) } as Survey);");

fs.writeFileSync('src/App.tsx', content);
