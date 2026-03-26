# API Documentation

This project uses two separate servers:

1. **Local Server (localhost:3030)** - Handles data storage and management (analysis data and timestamps)
2. **External Processing Server (localhost:3005)** - Handles image processing and analysis

## Architecture Overview

When the "Capture Image" button is pressed:
1. The camera saves its image locally
2. The image is POSTed to the external server at `http://localhost:3005/images`
3. The system waits up to 10 seconds for the external server response
4. If after 10 seconds any fields are missing from the response, stock values are used for those specific fields only
5. The local server (localhost:3030) does NOT process images - it only stores data

## Starting the Local Server

```bash
npm run server
```

The local server runs on port 3030 by default and provides endpoints for data storage.

## API Endpoints

### 1. Update Analysis Data

**Endpoint:** `POST http://localhost:3030/api/update-analysis`

**Description:** Create or update analysis data.

**Request Body:**
```json
{
  "environment": "Indoor Office",
  "description": "Multiple people working at desks with computers",
  "number_of_people": 5,
  "threats": null,
  "is_anomaly": false,
  "anomaly_reason": null,
  "analysis_id": "optional-id-for-update"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "1707234567890",
    "environment": "Indoor Office",
    "description": "Multiple people working at desks with computers",
    "number_of_people": 5,
    "threats": null,
    "is_anomaly": false,
    "anomaly_reason": null,
    "created_at": "2024-02-06T12:00:00.000Z",
    "updated_at": "2024-02-06T12:00:00.000Z"
  }
}
```

### 2. Record Timestamp

**Endpoint:** `POST http://localhost:3030/api/record-timestamp`

**Description:** Record processing timestamps for various events.

**Event IDs:**
- `0` - Image Capture
- `1` - Capture Analysis Complete
- `2` - Recommendation Update
- `3` - Total Time

**Request Body:**
```json
{
  "id": 0,
  "time": 1707234567890,
  "analysis_id": "optional-analysis-id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "1707234567890",
    "event_id": 0,
    "timestamp_ms": 1707234567890,
    "analysis_id": null,
    "created_at": "2024-02-06T12:00:00.000Z"
  }
}
```

### 3. Capture and Process Images (External Server)

**Endpoint:** `POST http://localhost:3005/images`

**Description:** This endpoint is on a SEPARATE external processing server (not the local server). It receives the camera image as a base64-encoded JPEG data URL, processes it, and returns analysis results including timings and person/activity metadata.

**Request Body:**
```json
{
  "camera_image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA..."
}
```

**Response:**
```json
{
  "images_captured_time": 178,
  "analysis_complete_time": 1234,
  "processing_time": 567,
  "total_time": 1979,
  "environment": "Urban street",
  "activity": "People walking normally in an orderly fashion. Some individuals are checking their phones...",
  "people_count": 8,
  "threats": "None detected",
  "is_anomaly": false,
  "anomaly_reason": "Normal activity for this environment with expected patterns and behavior",
  "captured_at": "2024-02-06T12:00:00.000Z"
}
```

**Response Fields:**
- `images_captured_time` - Time taken to capture images (ms)
- `analysis_complete_time` - Time taken to finish the upstream capture analysis phase (ms)
- `processing_time` - Time taken for AI analysis (ms)
- `total_time` - Total processing time (ms)
- `environment` - Detected environment type
- `activity` - Detailed activity description
- `people_count` - Number of people detected
- `threats` - Identified threats or "None detected"
- `is_anomaly` - Boolean indicating if anomaly detected
- `anomaly_reason` - Explanation of anomaly status
- `captured_at` - Timestamp when processing completed

**Behavior:**
- The endpoint processes images and returns analysis results
- Frontend waits up to **10 seconds** for response
- **If response is not received within 10 seconds OR any fields are missing, stock values are used ONLY for the missing fields**
- Each missing field is individually replaced with a generated stock value
- The camera images are always saved locally regardless of the external server response

**Notes:**
- Images are captured as base64-encoded data URLs from the live camera feeds
- If camera access is unavailable, fallback stock images are used
- AI analysis powered by Qwen 7b edge model (simulated)
- The system gracefully handles partial responses by filling in only missing values

## GET Endpoints (for retrieving data)

### Get All Analyses
`GET http://localhost:3030/api/analyses`

### Get All Timestamps
`GET http://localhost:3030/api/timestamps`

### Health Check
`GET http://localhost:3030/health`

## Data Storage

All data is stored in JSON files in the `server/data/` directory:
- `analysis.json` - Analysis data
- `timestamps.json` - Processing timestamps

The directory is created automatically when the server starts.
