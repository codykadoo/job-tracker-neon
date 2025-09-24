// Neon Database Configuration
const API_BASE_URL = 'http://localhost:8001/api';

// Database operations
window.neonDB = {
    // Create a new job
    async createJob(job) {
        try {
            const response = await fetch(`${API_BASE_URL}/jobs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(job)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error creating job:', error);
            throw error;
        }
    },

    // Get all jobs
    async getJobs() {
        try {
            const response = await fetch(`${API_BASE_URL}/jobs`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const jobs = await response.json();
            return jobs;
        } catch (error) {
            console.error('Error fetching jobs:', error);
            throw error;
        }
    },

    // Update a job
    async updateJob(jobId, updates) {
        try {
            const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error updating job:', error);
            throw error;
        }
    },

    // Delete a job
    async deleteJob(jobId) {
        try {
            const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error deleting job:', error);
            throw error;
        }
    },

    // Annotation operations
    
    // Get annotations for a job
    async getJobAnnotations(jobId) {
        try {
            const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/annotations`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const annotations = await response.json();
            return annotations;
        } catch (error) {
            console.error('Error fetching annotations:', error);
            throw error;
        }
    },

    // Create a new annotation
    async createAnnotation(jobId, annotation) {
        try {
            const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/annotations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(annotation)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error creating annotation:', error);
            throw error;
        }
    },

    // Update an annotation
    async updateAnnotation(annotationId, updates) {
        try {
            const response = await fetch(`${API_BASE_URL}/annotations/${annotationId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error updating annotation:', error);
            throw error;
        }
    },

    // Delete an annotation
    async deleteAnnotation(annotationId) {
        try {
            const response = await fetch(`${API_BASE_URL}/annotations/${annotationId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error deleting annotation:', error);
            throw error;
        }
    }
};

console.log('Neon database client initialized');