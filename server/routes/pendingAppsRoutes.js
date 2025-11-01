const express = require('express')
const router = express.Router()
const notificationService = require('../services/notificationService')

// In-memory store for pending and approved applications (dev-only)
const pending = []
const approved = []

// GET all pending applications
router.get('/', (req, res) => {
  res.json(pending)
})

// GET approved applications
router.get('/approved', (req, res) => {
  res.json(approved)
})

// POST a new pending application
router.post('/', (req, res) => {
  try {
    const payload = req.body || {}
    const id = payload.id || Date.now()
    const app = {
      id,
      franchiseNumber: payload.franchiseNumber || `P${String(id).slice(-4)}`,
      name: payload.name || '',
      make: payload.make || '',
      plateNumber: payload.plateNumber || '',
      applicationType: payload.applicationType || 'New',
      address: payload.address || '',
      contactNumber: payload.contactNumber || '',
      sidecarPlateNumber: payload.sidecarPlateNumber || '',
      birthPlace: payload.birthPlace || '',
      birthDate: payload.birthDate || '',
      civilStatus: payload.civilStatus || '',
      citizenship: payload.citizenship || '',
      todaMembership: payload.todaMembership || '',
      unitModel: payload.unitModel || '',
      colorMotor: payload.colorMotor || '',
      colorSidecar: payload.colorSidecar || '',
      mvPlate: payload.mvPlate || '',
      motorEngineNumber: payload.motorEngineNumber || '',
      chassisNumber: payload.chassisNumber || '',
      driverName: payload.driverName || '',
      driverAddress: payload.driverAddress || '',
      documentRegistration: payload.documentRegistration || null,
      documentBarangayClearance: payload.documentBarangayClearance || null,
      documentCedula: payload.documentCedula || null,
      documentDriversLicense: payload.documentDriversLicense || null,
      documentVotersAffidavit: payload.documentVotersAffidavit || null,
      documentPicture: payload.documentPicture || null,
      submittedAt: new Date().toISOString(),
      status: 'PENDING'
    }

    pending.push(app)

    res.status(201).json(app)
  } catch (err) {
    console.error('Failed to create pending app', err)
    res.status(500).json({ error: 'Failed to create pending application' })
  }
})

// Approve a pending application by id (moves it to approved list)
router.put('/:id/approve', (req, res) => {
  try {
    const id = req.params.id
    const idx = pending.findIndex(p => String(p.id) === String(id))
    if (idx === -1) return res.status(404).json({ error: 'Pending application not found' })
    const app = pending.splice(idx, 1)[0]
    app.status = 'APPROVED'
    app.approvedAt = new Date().toISOString()
    approved.push(app)
    res.json(app)
  } catch (err) {
    console.error('Failed to approve application', err)
    res.status(500).json({ error: 'Failed to approve application' })
  }
})

// Reject a pending application by id (removes it from pending list and notifies applicant)
router.put('/:id/reject', async (req, res) => {
  try {
    const id = req.params.id
    const { reason } = req.body
    const idx = pending.findIndex(p => String(p.id) === String(id))
    if (idx === -1) return res.status(404).json({ error: 'Pending application not found' })
    const app = pending.splice(idx, 1)[0]
    app.status = 'REJECTED'
    app.rejectedAt = new Date().toISOString()
    app.rejectionReason = reason || 'No reason provided'
    
    // Send rejection notification email to applicant
    if (app.email || app.contactEmail) {
      const recipientEmail = app.email || app.contactEmail
      const subject = 'Franchise Application Rejected'
      const text = `Dear ${app.name},\n\nWe regret to inform you that your franchise application (${app.franchiseNumber}) has been rejected.\n\nReason: ${app.rejectionReason}\n\nIf you have any questions, please contact the administration.\n\nBest regards,\nFranchise Management Team`
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
            body {
              font-family: 'Poppins', Arial, sans-serif;
              margin: 0;
              padding: 0;
              background-color: #f4f4f4;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
              background-color: #0A356B;
              color: white;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            .content {
              padding: 40px 30px;
            }
            .content p {
              color: #333;
              line-height: 1.6;
              margin-bottom: 20px;
            }
            .rejection-box {
              background-color: #fef2f2;
              border-left: 4px solid #ef4444;
              padding: 20px;
              margin: 25px 0;
              border-radius: 4px;
            }
            .rejection-box h3 {
              margin: 0 0 10px 0;
              color: #dc2626;
              font-size: 16px;
              font-weight: 600;
            }
            .rejection-box p {
              margin: 0;
              color: #7f1d1d;
              font-size: 14px;
            }
            .info-box {
              background-color: #f0f9ff;
              border-left: 4px solid #3b82f6;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .info-box p {
              margin: 0;
              color: #1e40af;
              font-size: 14px;
            }
            .footer {
              background-color: #f9fafb;
              padding: 20px 30px;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Franchise Application Status</h1>
            </div>
            <div class="content">
              <p>Dear <strong>${app.name}</strong>,</p>
              <p>We regret to inform you that your franchise application has been reviewed and unfortunately has not been approved at this time.</p>
              
              <div class="info-box">
                <p><strong>Application Number:</strong> ${app.franchiseNumber}</p>
              </div>
              
              <div class="rejection-box">
                <h3>Reason for Rejection</h3>
                <p>${app.rejectionReason}</p>
              </div>
              
              <p>If you would like to discuss this decision or need clarification on the rejection reason, please feel free to contact our administration office.</p>
              
              <p>You may reapply in the future once the concerns have been addressed.</p>
              
              <p>Thank you for your interest in our franchise program.</p>
              
              <p style="margin-top: 30px;">Best regards,<br><strong>Franchise Management Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} Franchise Management System. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
      
      try {
        await notificationService.sendEmail(recipientEmail, subject, text, html)
        console.log(`Rejection notification sent to ${recipientEmail}`)
      } catch (emailError) {
        console.error('Failed to send rejection email:', emailError)
        // Continue with rejection even if email fails
      }
    }
    
    res.json(app)
  } catch (err) {
    console.error('Failed to reject application', err)
    res.status(500).json({ error: 'Failed to reject application' })
  }
})

module.exports = router
