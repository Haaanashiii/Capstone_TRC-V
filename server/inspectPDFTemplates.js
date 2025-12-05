/**
 * PDF Field Inspector Script
 * Run this script to inspect all PDF template fields
 * Usage: node inspectPDFTemplates.js
 */

const { inspectPDFFields } = require('./utils/pdfFieldMapper');
const path = require('path');

async function inspectAllTemplates() {
    const templates = [
        { name: 'Certificate of Approval', file: 'C.001 - CERT APPROVED - FILLABLE.pdf' },
        { name: 'Certificate of Cancellation', file: 'C.001 - CERT CANCELLED - FILLABLE.pdf' },
        { name: 'Certificate of Existing Franchise', file: 'F.008 - CERT EXISTING - FILLABLE.pdf' }
    ];

    console.log('========================================');
    console.log('PDF TEMPLATE FIELD INSPECTOR');
    console.log('========================================\n');

    for (const template of templates) {
        const templatePath = path.join(__dirname, 'templates', template.file);
        
        try {
            console.log(`📄 ${template.name}`);
            console.log(`   File: ${template.file}`);
            console.log(`   Path: ${templatePath}`);
            
            const fieldInfo = await inspectPDFFields(templatePath);
            console.log(`   Total Fields: ${fieldInfo.totalFields}\n`);
            
            if (fieldInfo.totalFields > 0) {
                console.log('   Form Fields:');
                fieldInfo.fields.forEach((field, index) => {
                    console.log(`   ${index + 1}. ${field.name} (${field.type})`);
                });
            } else {
                console.log('   [WARN] No form fields found - this might not be a fillable PDF');
            }
            
            console.log('\n' + '─'.repeat(80) + '\n');
            
        } catch (error) {
            console.error(`   [ERROR] ${error.message}\n`);
        }
    }
    
    console.log('========================================');
    console.log('Inspection Complete');
    console.log('========================================\n');
}

// Run the inspection
inspectAllTemplates().catch(console.error);
