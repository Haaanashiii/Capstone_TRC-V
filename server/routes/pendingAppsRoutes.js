const express = require('express')
const router = express.Router()

const fs = require('fs')
const path = require('path')

// Simple file-backed store so pending/approved applications persist across restarts.
// Data file lives under server/data/pendingApps.json
const DATA_DIR = path.join(__dirname, '..', 'data')
const DATA_FILE = path.join(DATA_DIR, 'pendingApps.json')

let pending = []
let approved = []

// Ensure data directory exists
try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
} catch (err) {
  console.error('[Routes] Directory error', err.message)
}

// Load persisted data if available
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw || '{}')
    pending = Array.isArray(parsed.pending) ? parsed.pending : []
    approved = Array.isArray(parsed.approved) ? parsed.approved : []
  }
} catch (err) {
  console.warn('[Routes] Failed to load pendingApps.json', err.message)
}

const persist = () => {
  try {
    const payload = { pending, approved }
    fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8')
  } catch (err) {
    console.error('[Routes] Persist error', err.message)
  }
}

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
  persist()

  res.status(201).json(app)
  } catch (err) {
    console.error('[Routes] Create error', err.message)
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
  persist()
  res.json(app)
  } catch (err) {
    console.error('[Routes] Approve error', err.message)
    res.status(500).json({ error: 'Failed to approve application' })
  }
})

module.exports = router

module.exports = router

// DELETE a pending application by id
router.delete('/:id', (req, res) => {
  try {
    const id = req.params.id
    const idx = pending.findIndex(p => String(p.id) === String(id))
    if (idx === -1) return res.status(404).json({ error: 'Pending application not found' })
    const removed = pending.splice(idx, 1)[0]
    persist()
    res.json(removed)
  } catch (err) {
    console.error('[Routes] Delete error', err.message)
    res.status(500).json({ error: 'Failed to delete pending application' })
  }
})
