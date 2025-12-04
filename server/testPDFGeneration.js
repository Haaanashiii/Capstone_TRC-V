/**
 * Test PDF Certificate Generation
 * Run this script to test filling a certificate PDF
 * Usage: node testPDFGeneration.js
 */

const { fillPDFForm } = require('./utils/pdfFieldMapper');
const path = require('path');
const fs = require('fs').promises;

async function testCertificateGeneration() {
    console.log('========================================');
    console.log('PDF CERTIFICATE GENERATION TEST');
    console.log('========================================\n');

    // Sample franchise data
    const sampleFranchiseData = {
        franchiseNumber: 'FR-2025-001',
        operatorName: 'Juan Dela Cruz',
        operatorAddress: 'Brgy. Poblacion, Solano, Nueva Vizcaya',
        barangay: 'Poblacion',
        mvPlateNo: 'ABC-1234',
        unitModel: 'Honda TMX 155',
        sbResolutionNumber: 'SR-2025-01',
        sbApprovedAt: '2025-01-15',
        dateApproved: '2025-01-15',
        engineNumber: 'ENG123456789',
        motorEngineNo: 'ENG123456789',
        chassisNumber: 'CHS987654321',
        chasisNo: 'CHS987654321',
        officialReceiptNumber: 'OR-2025-001',
        generatedBy: 'Maria Santos',
        generatedByRole: 'Municipal Administrator',
        municipalityName: 'Municipality of Solano, Nueva Vizcaya',
        dateGenerated: new Date().toISOString()
    };

    const templates = [
        { 
            name: 'Certificate of Approval', 
            file: 'C.001 - CERT APPROVED - FILLABLE.pdf',
            output: 'TEST_APPROVAL_FILLED.pdf'
        },
        { 
            name: 'Certificate of Cancellation', 
            file: 'C.001 - CERT CANCELLED - FILLABLE.pdf',
            output: 'TEST_CANCELLATION_FILLED.pdf'
        },
        { 
            name: 'Certificate of Existing Franchise', 
            file: 'F.008 - CERT EXISTING - FILLABLE.pdf',
            output: 'TEST_EXISTING_FILLED.pdf'
        }
    ];

    for (const template of templates) {
        console.log(`\n📄 Testing: ${template.name}`);
        console.log(`   Template: ${template.file}`);
        
        const templatePath = path.join(__dirname, 'templates', template.file);
        const outputPath = path.join(__dirname, 'uploads', template.output);
        
        try {
            // Fill the PDF
            const pdfBytes = await fillPDFForm(templatePath, sampleFranchiseData);
            
            // Save the filled PDF
            await fs.writeFile(outputPath, pdfBytes);
            
            console.log(`   [OK] Successfully generated: ${template.output}`);
            console.log(`   [FILE] Saved to: ${outputPath}`);
            
        } catch (error) {
            console.error(`   [ERROR] ${error.message}`);
        }
    }
    
    console.log('\n========================================');
    console.log('Test Complete');
    console.log('Check the uploads/ folder for generated PDFs');
    console.log('========================================\n');
}

// Run the test
testCertificateGeneration().catch(console.error);
