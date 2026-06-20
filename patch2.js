const fs = require('fs');

let html = fs.readFileSync('C:/Users/anoni/Downloads/KapitanPlaneta/index.html', 'utf8');
const patchedTemplateStr = fs.readFileSync('C:/Users/anoni/Downloads/KapitanPlaneta/template_patched.txt', 'utf8');

// The original template was in index.html like <script type="__bundler/template">\n"<!DOCTYPE html>..."\n</script>
const scriptRegex = /(<script type="__bundler\/template">\n)([\s\S]*?)(\n  <\/script>)/;

const newHtml = html.replace(scriptRegex, '$1' + patchedTemplateStr + '$3');

fs.writeFileSync('C:/Users/anoni/Downloads/KapitanPlaneta/index.html', newHtml);
console.log('index.html updated successfully!');
