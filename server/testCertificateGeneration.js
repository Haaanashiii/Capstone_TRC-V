const fs = require('fs').promises;
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

async function testCertificateGeneration() {
    try {
        console.log('Testing F.008 - MTOF - DATE certificate generation...\n');
        
        const templatePath = path.join(__dirname, 'templates', 'F.008 - MTOF - DATE.docx');
        const content = await fs.readFile(templatePath, 'binary');
        const zip = new PizZip(content);
        
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            nullGetter: () => 'N/A',
            delimiters: {
                start: '{',
                end: '}'
            }
        });

        // Sample data matching backend structure
        const templateData = {
            municipalityName: 'Municipality of Solano, Nueva Vizcaya',
            generatedBy: 'Administrator',
            generatedByRole: 'Municipal Administrator',
            dateGenerated: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            year: new Date().getFullYear(),
            dateRangeStart: 'November 1, 2025',
            dateRangeEnd: 'November 30, 2025',
            newApplications: [
                { name: 'Juan Dela Cruz', franchiseNo: 'F-2025-001', address: 'Barangay 1' },
                { name: 'Maria Santos', franchiseNo: 'F-2025-002', address: 'Barangay 2' }
            ],
            renewalApplications: [
                { name: 'Pedro Reyes', franchiseNo: 'F-2024-100', address: 'Barangay 3' },
                { name: 'Ana Garcia', franchiseNo: 'F-2024-101', address: 'Barangay 4' }
            ],
            amendmentApplications: [
                { name: 'Roberto Cruz', franchiseNo: 'F-2023-050', address: 'Barangay 5' }
            ],
            newCount: 2,
            renewalCount: 2,
            amendmentCount: 1
        };

        console.log('Template data:');
        console.log(JSON.stringify(templateData, null, 2));
        console.log('\nRendering document...');

        doc.render(templateData);

        const buffer = doc.getZip().generate({
            type: 'nodebuffer',
            compression: 'DEFLATE'
        });

        const outputPath = path.join(__dirname, 'TEST_MTOF_DATE.docx');
        await fs.writeFile(outputPath, buffer);

        console.log(`\n✅ SUCCESS! Test document generated: ${outputPath}`);
        console.log('Open the file to verify the data is populated correctly.');

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        
        if (error.properties && error.properties.errors) {
            console.error('\nTemplate errors:');
            error.properties.errors.forEach((err, idx) => {
                console.error(`${idx + 1}. ${err.message}`);
                if (err.properties) {
                    console.error(`   Context: ${JSON.stringify(err.properties)}`);
                }
            });
        }
    }
}

testCertificateGeneration();
