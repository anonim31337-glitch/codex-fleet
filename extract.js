const fs = require('fs');
const html = fs.readFileSync('C:/Users/anoni/Downloads/KapitanPlaneta/index.html', 'utf-8');
const startTag = '<script type="__bundler/template">';
const startIndex = html.indexOf(startTag) + startTag.length;
const endIndex = html.lastIndexOf('</script>');
let jsonStr = html.substring(startIndex, endIndex).trim();

try {
  const templateStr = JSON.parse(jsonStr);
  fs.writeFileSync('C:/Users/anoni/Downloads/KapitanPlaneta/template_dump.html', templateStr);
  console.log("Dumped to template_dump.html");
} catch (e) {
  console.error("Error parsing JSON:", e.message);
}
