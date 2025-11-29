const fs = require('fs').promises;
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

async function inspectWordTemplate(templateName) {
    const templatePath = path.join(__dirname, 'templates', templateName);
    
    try {
        const content = await fs.readFile(templatePath, 'binary');
        const zip = new PizZip(content);
        
        // Extract document.xml to see the raw template tags
        const docXml = zip.file('word/document.xml')?.asText();
        
        if (!docXml) {
            console.log('Could not extract document.xml');
            return;
        }
        
        // Clean up the XML by removing all tags to get plain text
        const plainText = docXml
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        // Find all template tags {tag} or {#tag} or {/tag}
        const tagRegex = /\{[#\/]?([^}]+)\}/g;
        const tags = [];
        let match;
        
        while ((match = tagRegex.exec(plainText)) !== null) {
            tags.push(match[0]);
        }
        
        console.log('\n========================================');
        console.log(`WORD TEMPLATE: ${templateName}`);
        console.log('========================================\n');
        
        if (tags.length === 0) {
            console.log('⚠️  No template tags found!');
            console.log('   Add placeholders like {fieldName} to the Word document.\n');
            return;
        }
        
        console.log('Found template tags:');
        
        const uniqueTags = [...new Set(tags)];
        uniqueTags.forEach((tag, idx) => {
            console.log(`${idx + 1}. ${tag}`);
        });
        
        console.log(`\nTotal unique tags: ${uniqueTags.length}`);
        console.log('\n========================================\n');
        
        // Try to detect loops and their content
        const loopStarts = uniqueTags.filter(t => t.startsWith('{#'));
        const loopEnds = uniqueTags.filter(t => t.startsWith('{/'));
        
        if (loopStarts.length > 0) {
            console.log('Loop structures detected:');
            loopStarts.forEach(start => {
                const varName = start.replace('{#', '').replace('}', '');
                const end = `{/${varName}}`;
                if (loopEnds.includes(end)) {
                    console.log(`  ✓ ${start} ... ${end}`);
                    
                    // Find fields between loop tags
                    const startIdx = tags.indexOf(start);
                    const endIdx = tags.indexOf(end);
                    if (startIdx >= 0 && endIdx > startIdx) {
                        const fieldsInLoop = tags.slice(startIdx + 1, endIdx)
                            .filter(t => !t.startsWith('{#') && !t.startsWith('{/'));
                        if (fieldsInLoop.length > 0) {
                            console.log(`    Fields: ${fieldsInLoop.join(', ')}`);
                        }
                    }
                } else {
                    console.log(`  ⚠️  ${start} (missing closing tag {/${varName}})`);
                }
            });
            console.log('\n========================================\n');
        }
        
    } catch (error) {
        console.error('Error inspecting template:', error.message);
    }
}

// Get template name from command line
const templateName = process.argv[2] || 'F.008 - MTOF - DATE.docx';
inspectWordTemplate(templateName);
