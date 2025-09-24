# Job Tracker with Neon PostgreSQL

A comprehensive job tracking application with equipment management, maintenance scheduling, and worker administration.

## Features

- **Job Management**: Create, track, and manage jobs with detailed information
- **Equipment Tracking**: Monitor equipment status, location, and maintenance history
- **Maintenance System**: Schedule and track maintenance requests and completions
- **Worker Administration**: Manage worker profiles, roles, and assignments
- **File Uploads**: Support for photos and documents
- **Analytics & Reports**: Generate maintenance reports and performance analytics

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- PostgreSQL database (Neon recommended)

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd newappdgu
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Environment Configuration:
   - Copy `.env.example` to `.env`
   - Update the environment variables with your actual values:
     ```
     GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
     DATABASE_URL=your_postgresql_connection_string_here
     PORT=8001
     ```

4. Start the server:
   ```bash
   npm start
   ```

   For development with auto-reload:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:8001`

## Project Structure

- `server.js` - Main server file with API endpoints
- `index.html` - Main dashboard page
- `jobs.html` - Job management interface
- `equipment.html` - Equipment tracking interface
- `maintenance.html` - Maintenance management interface
- `admin.html` - Worker administration interface
- `uploads/` - Directory for uploaded files (not tracked in git)

## API Endpoints

### Jobs
- `GET /api/jobs` - Get all jobs
- `POST /api/jobs` - Create new job
- `PUT /api/jobs/:id` - Update job
- `DELETE /api/jobs/:id` - Delete job

### Equipment
- `GET /api/equipment` - Get all equipment
- `POST /api/equipment` - Create new equipment
- `PUT /api/equipment/:id` - Update equipment
- `DELETE /api/equipment/:id` - Delete equipment

### Maintenance
- `GET /api/maintenance-requests` - Get maintenance requests
- `POST /api/maintenance-requests` - Create maintenance request
- `PUT /api/maintenance-requests/:id` - Update maintenance request

### Workers
- `GET /api/workers` - Get all workers
- `POST /api/workers` - Create new worker
- `PUT /api/workers/:id` - Update worker
- `DELETE /api/workers/:id` - Delete worker

## Security Notes

- Environment variables are used for sensitive configuration
- The `.env` file is not tracked in version control
- Database credentials and API keys should never be committed to the repository
- Use the `.env.example` file as a template for required environment variables

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC License