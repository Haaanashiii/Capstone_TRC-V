const express = require('express')
const router = express.Router()

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

module.exports = router

module.exports = router
