# Backup and Recovery System Guide

## Overview

This document describes the complete Backup and Recovery System implemented for the TRC-V Tricycle Franchise Management System.

---

## System Components

### 1. Files Created

| File | Purpose |
|------|---------|
| `models/backupModel.js` | MongoDB schema for backup metadata |
| `services/backupService.js` | Core backup operations (create, restore, verify, archive) |
| `services/backupScheduler.js` | Automatic backup scheduling (cron-based) |
| `services/healthMonitorService.js` | Health monitoring with auto-recovery |
| `controllers/backupController.js` | API request handlers |
| `routes/backupRoutes.js` | REST API route definitions |
| `repositories/backupRepository.js` | Database operations for backup records |

---

## Features

### ✅ Automatic Backups
- **Schedule**: Daily at 2:00 AM (configurable)
- **Retention**: 7 days (automatic cleanup)
- **How it works**: Cron job exports all MongoDB collections to compressed GZIP files

### ✅ Manual Backups
- **Trigger**: Via API endpoint
- **Retention**: 30 days
- **Use case**: Before major changes, testing, or on-demand

### ✅ Emergency Backups
- **Trigger**: Via API endpoint
- **Retention**: 90 days
- **Use case**: When issues detected, before critical operations

### ✅ Pre-Update Backups
- **Trigger**: Via API endpoint with description
- **Retention**: 60 days
- **Use case**: Before system updates or migrations

### ✅ Backup Verification
- **Checksum**: SHA256 hash computed during backup
- **Verification**: Compare stored checksum with recalculated hash
- **Purpose**: Ensure backup integrity before restoration

### ✅ Restore from Backup
- **Dry Run Mode**: Preview what will be restored without making changes
- **Full Restore**: Replace database content with backup data
- **Selective Restore**: Restore specific collections only

### ✅ Data Archival (10+ Year Old Data)
- **Preview**: See what data would be archived
- **Extract**: Export old data to separate archive files
- **Cutoff**: Configurable (default: 10 years)

### ✅ Health Monitoring & Auto-Recovery
- **Schedule**: Every hour
- **Checks**: Database connectivity, data integrity
- **Auto-Recovery**: When corruption detected, automatically restore from last valid backup

---

## API Endpoints

All endpoints require authentication and Super Admin role.

### Backup Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/backup/create` | Create manual backup |
| POST | `/api/backup/emergency` | Create emergency backup |
| POST | `/api/backup/pre-update` | Create pre-update backup |
| GET | `/api/backup/history` | Get backup history |
| GET | `/api/backup/status` | Get latest backup status |
| GET | `/api/backup/:id` | Get specific backup details |
| POST | `/api/backup/:id/restore` | Restore from backup |
| POST | `/api/backup/:id/verify` | Verify backup integrity |
| DELETE | `/api/backup/:id` | Delete a backup |
| GET | `/api/backup/:id/download` | Download backup file |

### Archive Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/backup/archive/preview` | Preview archivable data |
| POST | `/api/backup/archive/create` | Create archive of old data |

### Health & Stats

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/backup/health/status` | Get system health status |
| POST | `/api/backup/health/recovery` | Trigger manual recovery |
| GET | `/api/backup/stats` | Get database statistics |

---

## Directory Structure

```
server/
├── backups/
│   ├── automatic/        # Daily automatic backups
│   ├── manual/           # User-triggered manual backups
│   ├── emergency/        # Emergency backups
│   ├── pre-update/       # Pre-update backups
│   └── archive/          # Archived old data
```

---

## Backup File Format

Each backup creates a `.gz` compressed JSON file containing:

```json
{
  "metadata": {
    "backupId": "backup_1704067200000_abc123",
    "createdAt": "2024-01-01T02:00:00.000Z",
    "backupType": "automatic",
    "mongoDBVersion": "7.0",
    "collections": ["users", "franchises", "..."]
  },
  "data": {
    "collectionName": [
      { "document1": "..." },
      { "document2": "..." }
    ]
  }
}
```

---

## Configuration

Add these to your `.env` file:

```env
# Backup Configuration
BACKUP_STORAGE_PATH=./backups
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=7
BACKUP_AUTO_ENABLED=true
HEALTH_CHECK_INTERVAL=0 * * * *
AUTO_RECOVERY_ENABLED=true
```

---

## How Auto-Recovery Works

1. **Health Check** runs every hour (configurable)
2. Checks database connectivity
3. Verifies data integrity using checksums
4. If corruption detected:
   - Creates emergency backup of current state
   - Finds last verified good backup
   - Restores from that backup
   - Logs recovery event

### Recovery Detection Criteria
- MongoDB connection failure
- Data integrity mismatch (checksum verification)
- Critical collection corruption

---

## MongoDB Collection Detection

The system automatically detects all collections in your MongoDB database:

```javascript
// Gets all collection names dynamically
const collections = await mongoose.connection.db.listCollections().toArray();
```

This means:
- No hardcoded collection names
- Automatically includes new collections
- Full database backup every time

---

## Usage Examples

### Create Manual Backup (via API)
```http
POST /api/backup/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "description": "Backup before monthly report"
}
```

### Restore from Backup
```http
POST /api/backup/backup_1704067200000_abc123/restore
Authorization: Bearer <token>
Content-Type: application/json

{
  "dryRun": false,
  "collections": ["franchises", "users"]
}
```

### Preview Archive (10+ year old data)
```http
GET /api/backup/archive/preview?yearsOld=10
Authorization: Bearer <token>
```

### Check System Health
```http
GET /api/backup/health/status
Authorization: Bearer <token>
```

---

## Retention Policies

| Backup Type | Retention Period |
|------------|------------------|
| Automatic | 7 days |
| Manual | 30 days |
| Emergency | 90 days |
| Pre-Update | 60 days |
| Archive | 365 days |

Old backups are automatically cleaned up based on these policies.

---

## Troubleshooting

### Backup Failed
1. Check disk space: `df -h` (Linux) or check drive properties (Windows)
2. Verify MongoDB connection
3. Check backup directory permissions

### Restore Failed
1. Verify backup file exists
2. Check backup integrity with verify endpoint
3. Ensure sufficient disk space

### Health Check Failing
1. Check MongoDB connection string
2. Verify database accessibility
3. Check server logs for specific errors

---

## Security Notes

- All backup endpoints require Super Admin role
- Backup files are stored server-side only
- Checksums verify file integrity
- No backup data transmitted to external services

---

## Logs

Backup operations log to console with prefixes:
- `[BackupService]` - Core backup operations
- `[BackupScheduler]` - Automatic backup scheduling
- `[HealthMonitor]` - Health checks and auto-recovery

---

## Testing the System

After server starts, you should see:
```
[BackupScheduler] ✅ Initialized - Daily backups at 2:00 AM
[HealthMonitor] ✅ Initialized - Hourly health checks enabled
```

Test manually:
1. Create a backup: `POST /api/backup/create`
2. Verify it: `POST /api/backup/<id>/verify`
3. Check status: `GET /api/backup/status`
4. View health: `GET /api/backup/health/status`
