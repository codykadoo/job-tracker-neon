// Jobs page functionality
let jobs = [];
let filteredJobs = [];
let currentView = 'grid';
let jobCardAnnotationsInFlight = new Set(); // Prevent overlapping annotation loads per job card
let jobCardAnnotationsLoaded = {}; // Track if a job card's annotations have been drawn
// Debug logging control for jobs page
const DEBUG_LOGS = (typeof window !== 'undefined' && window.localStorage && localStorage.getItem('debugLogs') === 'true');
const debugLog = (...args) => { if (DEBUG_LOGS) console.log(...args); };

// Export jobs functionality
function exportJobs() {
    const csvContent = generateCSV(filteredJobs);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jobs_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Generate CSV content
function generateCSV(jobs) {
    const headers = ['Title', 'Description', 'Status', 'Type', 'Address', 'Contact Name', 'Contact Phone', 'Created Date'];
    const csvRows = [headers.join(',')];
    
    jobs.forEach(job => {
        const row = [
            `"${job.title || ''}"`,
            `"${job.description || ''}"`,
            `"${job.status || ''}"`,
            `"${job.type || ''}"`,
            `"${job.locationAddress || ''}"`,
            `"${job.contactName || ''}"`,
            `"${job.contactPhone || ''}"`,
            `"${job.createdAt ? new Date(job.createdAt).toLocaleDateString() : ''}"`
        ];
        csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
}

// Clear all filters
function clearAllFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('typeFilter').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('sortBy').value = 'newest';
    const clearSearch = document.getElementById('clearSearch');
    if (clearSearch) clearSearch.style.display = 'none';
    applyFilters();
}

// Set view mode
function setView(viewType) {
    currentView = viewType;
    
    // Update active button
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`[data-view="${viewType}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    
    // Update grid class
    const jobsGrid = document.getElementById('jobsGrid');
    if (jobsGrid) {
        if (viewType === 'list') {
            jobsGrid.classList.add('list-view');
        } else {
            jobsGrid.classList.remove('list-view');
        }
    }
    
    renderJobs();
}

// Equipment location management functions
async function loadJobEquipment(jobId) {
    try {
        const apiUrl = `/api/jobs/${jobId}/equipment`;
        const response = await (window.AuthUtils && typeof window.AuthUtils.authFetch === 'function'
            ? window.AuthUtils.authFetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            : fetch(apiUrl, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
        );
        
        if (!response.ok) {
            throw new Error('Failed to fetch job equipment');
        }
        
        const equipment = await response.json();
        renderJobEquipment(equipment);
        
        // Load equipment markers on the job location map if it exists
        if (window.jobLocationMap) {
            await loadEquipmentMarkersForJob(jobId, window.jobLocationMap);
        }
        
    } catch (error) {
        console.error('Error loading job equipment:', error);
        // Fallback to empty equipment list
        renderJobEquipment([]);
    }
}

// Load equipment markers for the job
async function loadEquipmentMarkersForJob(jobId, map) {
    try {
        const apiUrl = `/api/jobs/${jobId}/equipment`;
        const response = await fetch(apiUrl, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) return;
        
        const equipment = await response.json();
        
        // Clear existing equipment markers
        if (window.equipmentMarkers) {
            window.equipmentMarkers.forEach(marker => marker.setMap(null));
        }
        window.equipmentMarkers = [];
        
        // Add equipment markers to the map
        equipment.forEach(item => {
            if (item.location && item.location.lat && item.location.lng) {
                const equipmentMarker = new google.maps.marker.AdvancedMarkerElement({
                    position: { lat: item.location.lat, lng: item.location.lng },
                    map: map,
                    title: item.name,
                    content: createMarkerContent('#28a745')
                });
                
                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div style="padding: 10px;">
                            <h4 style="margin: 0 0 8px 0; color: #333;">${item.name}</h4>
                            <p style="margin: 0 0 5px 0; color: #666; font-size: 14px;">Type: ${item.type}</p>
                            <p style="margin: 0; color: #666; font-size: 14px;">Status: ${item.status}</p>
                        </div>
                    `
                });
                
                equipmentMarker.addListener('click', () => {
                    infoWindow.open(map, equipmentMarker);
                });
                
                window.equipmentMarkers.push(equipmentMarker);
            }
        });
        
    } catch (error) {
        console.error('Error loading equipment markers:', error);
    }
}

// Initialize Google Map for job location in modal
async function initializeJobLocationMap(job) {
    try {
        const mapContainer = document.getElementById('jobLocationMap');
        if (!mapContainer) return;
        
        // Import Google Maps libraries
        const { Map } = await google.maps.importLibrary("maps");
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
        
        // Create map centered on job location
        const jobMap = new Map(mapContainer, {
            zoom: 15,
            center: { lat: job.location.lat, lng: job.location.lng },
            mapId: "job-location-map",
            gestureHandling: 'greedy',
            zoomControl: true,
            streetViewControl: false,
            fullscreenControl: false,
            mapTypeControl: false
        });
        
        // Add job location marker
        const jobMarker = new google.maps.marker.AdvancedMarkerElement({
            position: { lat: job.location.lat, lng: job.location.lng },
            map: jobMap,
            title: job.title,
            content: createMarkerContent('#667eea')
        });
        
        // Store map reference globally for equipment location setting
        window.jobLocationMap = jobMap;
        
        // Load and display equipment locations for this job
        await loadEquipmentMarkersForJob(job.id, jobMap);
        
    } catch (error) {
        console.error('Error initializing job location map:', error);
        // Fallback: show a message in the map container
        const mapContainer = document.getElementById('jobLocationMap');
        if (mapContainer) {
            mapContainer.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666; flex-direction: column;">
                    <i class="fas fa-map-marker-alt" style="font-size: 24px; margin-bottom: 10px;"></i>
                    <p>Map unavailable. Click "View on Map" to see full map.</p>
                </div>
            `;
        }
    }
}

// Load equipment markers for the job
async function loadEquipmentMarkersForJob(jobId, map) {
    try {
        const apiUrl = `/api/jobs/${jobId}/equipment`;
        const response = await fetch(apiUrl, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) return;
        
        const equipment = await response.json();
        
        equipment.forEach(item => {
            if (item.jobLocation && item.jobLocation.lat && item.jobLocation.lng) {
                const equipmentMarker = new google.maps.marker.AdvancedMarkerElement({
                    position: { lat: item.jobLocation.lat, lng: item.jobLocation.lng },
                    map: map,
                    title: item.name,
                    content: createMarkerContent('#28a745')
                });
                
                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div class="equipment-info">
                            <h4>${item.name}</h4>
                            <p><strong>Type:</strong> ${item.type}</p>
                            <p><strong>Location:</strong> ${item.jobLocation.address || 'Custom location'}</p>
                        </div>
                    `
                });
                
                equipmentMarker.addListener('click', () => {
                    infoWindow.open(map, equipmentMarker);
                });
            }
        });
        
    } catch (error) {
        console.error('Error loading equipment markers:', error);
    }
}

function renderJobEquipment(equipmentList) {
    const equipmentListContainer = document.getElementById('jobEquipmentList');
    if (!equipmentListContainer) return;
    
    if (equipmentList.length === 0) {
        equipmentListContainer.innerHTML = '<p class="no-equipment">No equipment assigned to this job site.</p>';
        return;
    }
    
    equipmentListContainer.innerHTML = equipmentList.map(equipment => `
        <div class="job-equipment-item">
            <div class="equipment-info">
                <i class="fas fa-${getEquipmentIcon(equipment.equipment_type)}"></i>
                <div class="equipment-details">
                    <span class="equipment-name">${equipment.name}</span>
                    <span class="equipment-type">${equipment.equipment_type}</span>
                </div>
            </div>
            <div class="equipment-actions">
                <button class="btn-icon" onclick="updateEquipmentLocation('${equipment.id}')" title="Update Location">
                    <i class="fas fa-map-marker-alt"></i>
                </button>
                <button class="btn-icon" onclick="removeEquipmentFromJob('${equipment.id}')" title="Remove from Job">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function getEquipmentIcon(type) {
    const icons = {
        'skidsteer': 'tractor',
        'excavator': 'truck-monster',
        'backhoe': 'tractor',
        'truck': 'truck',
        'vac_truck': 'truck-pickup',
        'trailer': 'trailer',
        'attachment': 'wrench',
        'small_engine': 'cog',
        'other': 'tools'
    };
    return icons[type] || 'tools';
}

async function showEquipmentSelector(jobId) {
    try {
        const apiUrl = '/api/equipment';
        const response = await fetch(apiUrl, {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to load equipment');
        
        const allEquipment = await response.json();
        const availableEquipment = allEquipment.filter(eq => eq.status === 'available');
        
        const modal = document.createElement('div');
        modal.className = 'modal equipment-selector-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Select Equipment for Job Site</h3>
                    <button class="modal-close" onclick="closeEquipmentSelector()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="equipment-selector-list">
                        ${availableEquipment.map(equipment => `
                            <div class="equipment-selector-item" data-equipment-id="${equipment.id}">
                                <div class="equipment-info">
                                    <i class="fas fa-${getEquipmentIcon(equipment.equipment_type)}"></i>
                                    <div class="equipment-details">
                                        <span class="equipment-name">${equipment.name}</span>
                                        <span class="equipment-type">${equipment.equipment_type}</span>
                                        <span class="equipment-status">${equipment.status}</span>
                                    </div>
                                </div>
                                <button class="btn-primary" onclick="assignEquipmentToJob('${equipment.id}', '${jobId}')">
                                    Assign to Job
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'flex';
        
    } catch (error) {
        console.error('Error loading equipment:', error);
        showNotification('Failed to load equipment list');
    }
}

function closeEquipmentSelector() {
    const modal = document.querySelector('.equipment-selector-modal');
    if (modal) {
        modal.remove();
    }
}

async function assignEquipmentToJob(equipmentId, jobId) {
    try {
        const apiUrl = `/api/jobs/${jobId}/equipment`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ equipmentId })
        });
        
        if (response.ok) {
            showNotification('Equipment assigned to job successfully');
            closeEquipmentSelector();
            loadJobEquipment(jobId); // Refresh the equipment list
        } else {
            throw new Error('Failed to assign equipment');
        }
    } catch (error) {
        console.error('Error assigning equipment:', error);
        showNotification('Failed to assign equipment to job');
    }
}

async function removeEquipmentFromJob(equipmentId) {
    const modal = document.getElementById('jobModal');
    const jobId = modal.dataset.currentJobId;
    
    try {
        const apiUrl = `/api/jobs/${jobId}/equipment/${equipmentId}`;
        const response = await fetch(apiUrl, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Equipment removed from job');
            loadJobEquipment(jobId); // Refresh the equipment list
        } else {
            throw new Error('Failed to remove equipment');
        }
    } catch (error) {
        console.error('Error removing equipment:', error);
        showNotification('Failed to remove equipment from job');
    }
}

async function updateEquipmentLocation(equipmentId) {
    const modal = document.getElementById('jobModal');
    const jobId = modal.dataset.currentJobId;
    
    // Find equipment name for display
    const equipmentElement = document.querySelector(`[data-equipment-id="${equipmentId}"]`);
    const equipmentName = equipmentElement ? equipmentElement.querySelector('.equipment-name').textContent : 'Equipment';
    
    // Enable location setting mode
    enableEquipmentLocationSetting(equipmentId, equipmentName);
}

// Add equipment location setting functionality
function enableEquipmentLocationSetting(equipmentId, equipmentName) {
    const modal = document.getElementById('jobModal');
    const mapContainer = modal.querySelector('.job-location');
    
    // Create location setting overlay
    const overlay = document.createElement('div');
    overlay.className = 'equipment-location-overlay';
    overlay.innerHTML = `
        <div class="location-setting-header">
            <h4>Set Location for ${equipmentName}</h4>
            <p>Click on the map to set the equipment location</p>
            <div class="location-setting-actions">
                <button class="btn-cancel-location">Cancel</button>
                <button class="btn-confirm-location" disabled>Confirm Location</button>
            </div>
        </div>
    `;
    
    mapContainer.appendChild(overlay);
    
    let tempMarker = null;
    let selectedLocation = null;
    let mapClickListenerRef = null;
    
    // Add click listener to map
        const mapClickListener = (event) => {
            const lat = event.latLng.lat();
            const lng = event.latLng.lng();
            
            // Remove previous temp marker
            if (tempMarker) {
                tempMarker.setMap(null);
            }
            
            // Create temporary marker
            tempMarker = new google.maps.marker.AdvancedMarkerElement({
                position: { lat, lng },
                map: window.jobLocationMap,
                title: `Temporary location for ${equipmentName}`,
                content: createMarkerContent('#ff6b35')
            });
            
            selectedLocation = { lat, lng };
            overlay.querySelector('.btn-confirm-location').disabled = false;
        };
        
        mapClickListenerRef = window.jobLocationMap.addListener('click', mapClickListener);
    
    // Cancel button
        overlay.querySelector('.btn-cancel-location').addEventListener('click', () => {
            if (tempMarker) {
                tempMarker.setMap(null);
            }
            if (mapClickListenerRef) {
                google.maps.event.removeListener(mapClickListenerRef);
            }
            overlay.remove();
        });
    
    // Confirm button
    overlay.querySelector('.btn-confirm-location').addEventListener('click', async () => {
        if (selectedLocation) {
            try {
                // Use coordinates directly instead of geocoding to avoid API authorization issues
                const address = `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`;
                
                // Update equipment location via API
                const apiUrl = `/api/equipment/${equipmentId}/job-location`;
        const response = await fetch(apiUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        latitude: selectedLocation.lat, 
                        longitude: selectedLocation.lng, 
                        address: address 
                    })
                });
                
                if (!response.ok) {
                    throw new Error('Failed to update equipment location');
                }
                
                // Remove temp marker and create permanent marker
                if (tempMarker) {
                    tempMarker.setMap(null);
                }
                
                // Create permanent equipment marker
                const equipmentMarker = new google.maps.marker.AdvancedMarkerElement({
                    position: selectedLocation,
                    map: window.jobLocationMap,
                    title: equipmentName,
                    content: createMarkerContent('#4CAF50')
                });
                
                // Add info window
                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div class="equipment-info">
                            <h4>${equipmentName}</h4>
                            <p><strong>Location:</strong> ${address}</p>
                            <button onclick="removeEquipmentFromJob('${equipmentId}')" class="btn-remove-location">Remove from Job</button>
                        </div>
                    `
                });
                
                equipmentMarker.addListener('click', () => {
                    infoWindow.open(window.map, equipmentMarker);
                });
                
                // Refresh equipment list
                const jobId = document.getElementById('jobModal').dataset.currentJobId;
                await loadJobEquipment(jobId);
                
                // Clean up
                if (mapClickListenerRef) {
                    google.maps.event.removeListener(mapClickListenerRef);
                }
                overlay.remove();
                
                showNotification('Equipment location set successfully');
                
            } catch (error) {
                console.error('Error setting equipment location:', error);
                showNotification('Failed to set equipment location. Please try again.');
            }
        }
    });
}

// Initialize the jobs page with authentication gating
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Single auth gate to reduce duplicate /api/auth/me requests
        if (window.AuthUtils && typeof window.AuthUtils.requireAuth === 'function') {
            const user = await window.AuthUtils.requireAuth();
            if (!user) return; // Redirect handled by requireAuth
        } else {
            window.location.href = '/login.html';
            return;
        }
    } catch (e) {
        console.warn('Auth required; redirecting to login');
        window.location.href = '/login.html';
        return;
    }

    initializePage();
});

function initializePage() {
    // Load jobs from Neon database
    loadJobs();
    setupEventListeners();
    updateStats();
}

// Load jobs from Neon database
async function loadJobs() {
    console.log('loadJobs function called');
    try {
        console.log('Attempting to load jobs from database...');
        
        const apiUrl = '/api/jobs';
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const jobsData = await response.json();
        console.log('Raw jobs data from database:', jobsData);
        
        jobs = [];
        
        // Process jobs from database
        jobsData.forEach((jobData, index) => {
            console.log(`Processing job ${index + 1}:`, jobData);
            const job = {
                id: jobData.id.toString(),
                jobNumber: jobData.job_number || jobData.title, // Use job_number if available, fallback to title
                title: jobData.title,
                type: jobData.job_type,
                description: jobData.description,
                location: {
                    lat: parseFloat(jobData.location_lat) || 0,
                    lng: parseFloat(jobData.location_lng) || 0
                },
                locationAddress: jobData.location_address,
                contactName: jobData.contact_name,
                contactPhone: jobData.contact_phone,
                status: jobData.status || 'pending',
                assignedWorkerId: jobData.assigned_worker_id,
                createdAt: jobData.created_at,
                photos: (() => {
                    try {
                        // Handle different possible formats of photos field
                        if (!jobData.photos) {
                            return [];
                        }
                        
                        // If it's already an array, return it
                        if (Array.isArray(jobData.photos)) {
                            return jobData.photos;
                        }
                        
                        // If it's a string, try to parse it
                        if (typeof jobData.photos === 'string') {
                            // Handle empty string or whitespace
                            const trimmed = jobData.photos.trim();
                            if (!trimmed || trimmed === '[]') {
                                return [];
                            }
                            return JSON.parse(trimmed);
                        }
                        
                        // Fallback to empty array
                        return [];
                    } catch (parseError) {
                        console.warn(`Failed to parse photos for job ${jobData.id}:`, parseError, 'Raw photos value:', jobData.photos);
                        return [];
                    }
                })()
            };
            console.log(`Processed job ${index + 1}:`, job);
            jobs.push(job);
        });
        
        // Update UI
        filteredJobs = [...jobs];
        console.log('About to render jobs, jobs array:', jobs);
        renderJobs();
        updateStats();
        
        console.log(`Loaded ${jobs.length} jobs from database`);
    } catch (error) {
        console.error('Error loading jobs from database:', error);
        // Fallback to localStorage
        loadJobsFromLocalStorage();
        showNotification('Unable to connect to database - showing cached jobs', 'error');
    }
}

// Fallback function to load from localStorage
function loadJobsFromLocalStorage() {
    const savedJobs = localStorage.getItem('jobManagementJobs');
    if (savedJobs) {
        jobs = JSON.parse(savedJobs);
    } else {
        jobs = [];
    }
    
    filteredJobs = [...jobs];
    renderJobs();
    updateStats();
}

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
    
    // Filter functionality
    const typeFilter = document.getElementById('typeFilter');
    const statusFilter = document.getElementById('statusFilter');
    const sortBy = document.getElementById('sortBy');
    
    if (typeFilter) {
        typeFilter.addEventListener('change', applyFilters);
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', applyFilters);
    }
    if (sortBy) {
        sortBy.addEventListener('change', applyFilters);
    }
    
    // Job card click delegation - attach to parent container
    const jobsGrid = document.getElementById('jobsGrid');
    if (jobsGrid) {
        jobsGrid.addEventListener('click', (e) => {
            const jobCard = e.target.closest('.job-card');
            if (jobCard) {
                const jobId = jobCard.dataset.jobId;
                console.log('Job card clicked via delegation, jobId:', jobId);
                showJobModal(jobId);
            }
        });
    }
    
    // Modal functionality
    const modal = document.getElementById('jobModal');
    const closeModal = document.getElementById('closeModal');
    const deleteJobBtn = document.getElementById('deleteJobBtn');
    const editJobBtn = document.getElementById('editJobBtn');
    
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            if (modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    if (deleteJobBtn) {
        deleteJobBtn.addEventListener('click', handleDeleteJob);
    }
    editJobBtn.addEventListener('click', handleEditJob);
    
    // Edit modal functionality
    const editModal = document.getElementById('editJobModal');
    const closeEditModal = document.getElementById('closeEditModal');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const editJobForm = document.getElementById('editJobForm');
    
    closeEditModal.addEventListener('click', () => {
        editModal.style.display = 'none';
    });
    
    cancelEditBtn.addEventListener('click', () => {
        editModal.style.display = 'none';
    });
    
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) {
            editModal.style.display = 'none';
        }
    });
    
    editJobForm.addEventListener('submit', handleEditJobSubmit);
}

// Handle search
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    
    if (searchTerm === '') {
        filteredJobs = [...jobs];
    } else {
        filteredJobs = jobs.filter(job => 
            job.title.toLowerCase().includes(searchTerm) ||
            job.description.toLowerCase().includes(searchTerm) ||
            job.address.toLowerCase().includes(searchTerm) ||
            job.type.toLowerCase().includes(searchTerm)
        );
    }
    
    applyFilters();
}

// Apply filters and sorting
function applyFilters() {
    const typeFilter = document.getElementById('typeFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const sortBy = document.getElementById('sortBy').value;
    
    let filtered = [...filteredJobs];
    
    // Apply type filter
    if (typeFilter) {
        filtered = filtered.filter(job => job.type === typeFilter);
    }
    
    // Apply status filter
    if (statusFilter) {
        filtered = filtered.filter(job => job.status === statusFilter);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'newest':
                return new Date(b.createdAt) - new Date(a.createdAt);
            case 'oldest':
                return new Date(a.createdAt) - new Date(b.createdAt);
            case 'title':
                return a.title.localeCompare(b.title);
            case 'type':
                return a.type.localeCompare(b.type);
            default:
                return 0;
        }
    });
    
    renderJobs(filtered);
}

// Render jobs
function renderJobs(jobsToRender = filteredJobs) {
    const jobsGrid = document.getElementById('jobsGrid');
    const emptyState = document.getElementById('emptyState');
    
    // Add null checks to prevent errors
    if (!jobsGrid) {
        console.warn('jobsGrid element not found');
        return;
    }
    
    if (jobsToRender.length === 0) {
        jobsGrid.style.display = 'none';
        if (emptyState) {
            emptyState.style.display = 'block';
        }
        return;
    }
    
    jobsGrid.style.display = 'grid';
    if (emptyState) {
        emptyState.style.display = 'none';
    }
    
    jobsGrid.innerHTML = jobsToRender.map(job => createJobCard(job)).join('');
    
    // Initialize map previews for each job card
    jobsToRender.forEach(job => {
        initializeJobCardMapPreview(job);
    });
    
    console.log(`Rendered ${jobsToRender.length} job cards`);
}

// Create job card HTML
function createJobCard(job) {
    const createdDate = new Date(job.createdAt).toLocaleDateString();
    const status = job.status || 'pending';
    
    return `
        <div class="job-card" data-job-id="${job.id}">
            <div class="job-card-header">
                <h3 class="job-title">${job.title}</h3>
                <span class="job-type-badge ${job.type}">${job.type}</span>
            </div>
            
            <p class="job-description">${job.description}</p>
            
            <!-- Map Preview Section -->
            <div class="job-map-preview" id="job-map-preview-${job.id}">
                <div class="map-preview-container">
                    <div class="map-preview-placeholder">
                        <i class="fas fa-map"></i>
                        <span>Loading map...</span>
                    </div>
                </div>
            </div>
            
            <div class="job-meta">
                <div class="job-meta-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${job.locationAddress || 'No address provided'}</span>
                </div>
                ${job.contactPhone ? `
                <div class="job-meta-item">
                    <i class="fas fa-phone"></i>
                    <span>${job.contactPhone}</span>
                </div>
                ` : ''}
                ${job.contactName ? `
                <div class="job-meta-item">
                    <i class="fas fa-user"></i>
                    <span>${job.contactName}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="job-footer">
                <span class="job-status ${status}">${status.replace('-', ' ')}</span>
                <span class="job-date">${createdDate}</span>
            </div>
        </div>
    `;
}

// Initialize map preview for job card
async function initializeJobCardMapPreview(job) {
    try {
        const mapContainer = document.getElementById(`job-map-preview-${job.id}`);
        if (!mapContainer) return;
        
        const mapPreviewContainer = mapContainer.querySelector('.map-preview-container');
        if (!mapPreviewContainer) return;

        // Import Google Maps libraries including the marker library
        const { Map } = await google.maps.importLibrary("maps");
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
        
        // Create a small map for the preview
        const previewMap = new Map(mapPreviewContainer, {
            zoom: 16,
            center: { lat: job.location.lat, lng: job.location.lng },
            mapId: "job-card-preview-map",
            gestureHandling: 'none', // Disable interaction for preview
            zoomControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            mapTypeControl: false,
            clickableIcons: false,
            disableDefaultUI: true
        });
        
        // Add job location marker using AdvancedMarkerElement
        const jobMarker = new AdvancedMarkerElement({
            position: { lat: job.location.lat, lng: job.location.lng },
            map: previewMap,
            title: job.title,
            content: createMarkerContent('#667eea') // Create custom marker content
        });
        
        // Load and display annotations for this job
        await loadJobCardAnnotations(job.id, previewMap);
        
        // Remove the placeholder
        const placeholder = mapPreviewContainer.querySelector('.map-preview-placeholder');
        if (placeholder) {
            placeholder.remove();
        }
        
        // Add click handler to open full map view
        mapPreviewContainer.addEventListener('click', () => {
            window.location.href = `index.html?job=${job.id}`;
        });
        
        // Add hover effect
        mapPreviewContainer.style.cursor = 'pointer';
        mapPreviewContainer.addEventListener('mouseenter', () => {
            mapContainer.style.transform = 'scale(1.02)';
            mapContainer.style.transition = 'transform 0.2s ease';
        });
        mapPreviewContainer.addEventListener('mouseleave', () => {
            mapContainer.style.transform = 'scale(1)';
        });
        
    } catch (error) {
        console.error('Error initializing job card map preview:', error);
        // Keep the placeholder if map fails to load
    }
}

// Load annotations for job card preview
async function loadJobCardAnnotations(jobId, previewMap) {
    // Skip duplicate loads for the same card
    if (jobCardAnnotationsLoaded[jobId]) {
        return;
    }
    if (jobCardAnnotationsInFlight.has(jobId)) {
        return;
    }

    jobCardAnnotationsInFlight.add(jobId);
    try {
        debugLog(`[DEBUG] Loading annotations for job ID: ${jobId}`);
        
        // Validate jobId
        if (!jobId) {
            console.error('[DEBUG] Invalid jobId provided to loadJobCardAnnotations:', jobId);
            return;
        }
        
        const apiUrl = `/api/jobs/${jobId}/annotations`;
        debugLog(`[DEBUG] Fetching annotations from: ${apiUrl}`);
        
        // Fetch annotations from the database
        const response = await fetch(apiUrl, {
            credentials: 'include'
        });
        
        debugLog(`[DEBUG] Response status: ${response.status}`);
        debugLog(`[DEBUG] Response ok: ${response.ok}`);
        
        if (!response.ok) {
            if (response.status === 401) {
                if (DEBUG_LOGS) console.warn(`[DEBUG] Authentication required for annotations - job ${jobId}`);
            } else {
                if (DEBUG_LOGS) console.warn(`[DEBUG] Failed to fetch annotations - Status: ${response.status}`);
            }
            return;
        }
        
        const annotations = await response.json();
        debugLog(`[DEBUG] Loaded ${annotations.length} annotations for job ${jobId}:`, annotations);
        
        annotations.forEach(annotation => {
            const coordinates = annotation.coordinates;
            const styleOptions = annotation.style_options || {};
            
            switch(annotation.annotation_type) {
                case 'polygon':
                    new google.maps.Polygon({
                        paths: coordinates,
                        fillColor: styleOptions.fillColor || '#FF0000',
                        fillOpacity: (styleOptions.fillOpacity || 0.35) * 0.7, // Make slightly more transparent for preview
                        strokeColor: styleOptions.strokeColor || '#FF0000',
                        strokeWeight: Math.max(1, (styleOptions.strokeWeight || 2) - 1), // Thinner lines for preview
                        map: previewMap,
                        clickable: false
                    });
                    break;
                    
                case 'line':
                    new google.maps.Polyline({
                        path: coordinates,
                        strokeColor: styleOptions.strokeColor || '#FF0000',
                        strokeOpacity: (styleOptions.strokeOpacity || 1.0) * 0.8, // Slightly more transparent
                        strokeWeight: Math.max(1, (styleOptions.strokeWeight || 2) - 1), // Thinner for preview
                        map: previewMap,
                        clickable: false
                    });
                    break;
                    
                case 'pin':
                    new google.maps.marker.AdvancedMarkerElement({
                        position: coordinates[0],
                        map: previewMap,
                        title: annotation.name,
                        content: createMarkerContent(styleOptions.fillColor || '#FF0000')
                    });
                    break;
            }
        });

        // Mark as loaded to avoid redrawing duplicates
        jobCardAnnotationsLoaded[jobId] = true;

    } catch (error) {
        if (error && error.name === 'AbortError') {
            // Swallow aborts quietly to reduce console noise in previews
            return;
        }
        // Only log non-abort errors in debug mode for previews
        if (DEBUG_LOGS) console.error(`[DEBUG] Error loading annotations for job ${jobId}:`, error);
    } finally {
        jobCardAnnotationsInFlight.delete(jobId);
    }
}

// Show job modal
function showJobModal(jobId) {
    console.log('showJobModal called with jobId:', jobId);
    const job = jobs.find(j => j.id === jobId);
    console.log('Found job:', job);
    if (!job) {
        console.error('Job not found for id:', jobId);
        return;
    }
    
    const modal = document.getElementById('jobModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.textContent = job.title;
    
    const status = job.status || 'pending';
    const createdDate = new Date(job.createdAt).toLocaleDateString();
    
    modalBody.innerHTML = `
        <div class="job-detail">
            <div class="detail-section">
                <h4>Job Information</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Type:</span>
                        <span class="job-type">${job.type}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Status:</span>
                        <select id="jobStatusSelect" class="status-select">
                            <option value="pending" ${job.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="in-progress" ${job.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                            <option value="completed" ${job.status === 'completed' ? 'selected' : ''}>Completed</option>
                        </select>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Created:</span>
                        <span>${createdDate}</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4>Description</h4>
                <p>${job.description}</p>
            </div>
            
            <div class="detail-section">
                <h4>Contact Information</h4>
                <div class="contact-info">
                    <div class="contact-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${job.locationAddress || 'No address provided'}</span>
                    </div>
                    ${job.contactName ? `
                    <div class="contact-item">
                        <i class="fas fa-user"></i>
                        <span>${job.contactName}</span>
                    </div>
                    ` : ''}
                    ${job.contactPhone ? `
                    <div class="contact-item">
                        <i class="fas fa-phone"></i>
                        <span>${job.contactPhone}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="detail-section">
                <h4>Location</h4>
                <p>Latitude: ${job.location.lat}, Longitude: ${job.location.lng}</p>
                <div class="job-location" id="jobLocationMap" style="position: relative; height: 300px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; margin: 10px 0;">
                    <!-- Google Map will be initialized here -->
                </div>
                <a href="index.html?job=${job.id}" class="btn-secondary">
                    <i class="fas fa-map"></i>
                    View on Map
                </a>
            </div>
            
            <div class="detail-section">
                <h4>Equipment at Job Site</h4>
                <div id="jobEquipmentSection">
                    <div class="equipment-controls">
                        <button id="addEquipmentBtn" class="btn-primary" onclick="showEquipmentSelector('${job.id}')">
                            <i class="fas fa-plus"></i>
                            Add Equipment to Job
                        </button>
                    </div>
                    <div id="jobEquipmentList" class="job-equipment-list">
                        <!-- Equipment list will be populated here -->
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Store current job ID for modal actions
    modal.dataset.currentJobId = jobId;
    
    // Setup status change listener
    const statusSelect = document.getElementById('jobStatusSelect');
    if (statusSelect) {
        statusSelect.addEventListener('change', (e) => {
            updateJobStatus(jobId, e.target.value);
        });
    } else {
        console.error('jobStatusSelect element not found in modal');
    }
    
    // Load equipment for this job
    loadJobEquipment(jobId);
    
    // Initialize Google Map for job location
    initializeJobLocationMap(job);
    
    modal.style.display = 'flex';
}

// Update job status with database integration
async function updateJobStatus(jobId, newStatus) {
    try {
        // Determine API URL based on environment
        const apiUrl = `/api/jobs/${jobId}`;
        
        const response = await fetch(apiUrl, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: newStatus,
                updated_at: new Date().toISOString()
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        console.log(`Job ${jobId} status updated to ${newStatus} in database`);
        showNotification(`Job status updated to ${newStatus.replace('-', ' ')}`);
        
        // Update local jobs array
        updateJobStatusLocally(jobId, newStatus);
        
    } catch (error) {
        console.error('Error updating job status in database:', error);
        // Fallback to localStorage update
        updateJobStatusLocally(jobId, newStatus);
        showNotification('Status updated locally - will sync when connection is restored', 'error');
    }
}

// Local fallback for updating job status
function updateJobStatusLocally(jobId, newStatus) {
    const jobIndex = jobs.findIndex(j => j.id === jobId);
    if (jobIndex !== -1) {
        jobs[jobIndex].status = newStatus;
        jobs[jobIndex].updatedAt = new Date().toISOString();
        
        // Save to localStorage
        localStorage.setItem('jobManagementJobs', JSON.stringify(jobs));
        
        // Re-render jobs and update stats
        renderJobs();
        updateStats();
        
        // Show notification
        showNotification(`Job status updated to ${newStatus.replace('-', ' ')}`);
    }
}

// Handle delete job
async function handleDeleteJob() {
    const modal = document.getElementById('jobModal');
    const jobId = modal.dataset.currentJobId;
    
    if (confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
        try {
            // Delete from database via API (relative path for Hosting rewrites)
            const response = await fetch(`/api/jobs/${jobId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Remove from local array
            const jobIndex = jobs.findIndex(j => j.id === jobId);
            if (jobIndex !== -1) {
                jobs.splice(jobIndex, 1);
            }
            
            // Save to localStorage as fallback
            localStorage.setItem('jobManagementJobs', JSON.stringify(jobs));
            
            // Remove job marker from map (if app.js is loaded)
            if (typeof removeJobMarker === 'function') {
                removeJobMarker(jobId);
            }
            
            // Close modal and refresh
            modal.style.display = 'none';
            loadJobs();
            
            showNotification('Job deleted successfully');
        } catch (error) {
            console.error('Error deleting job from database:', error);
            
            // Fallback: try to delete locally
            try {
                const jobIndex = jobs.findIndex(j => j.id === jobId);
                if (jobIndex !== -1) {
                    jobs.splice(jobIndex, 1);
                    localStorage.setItem('jobManagementJobs', JSON.stringify(jobs));
                    
                    // Remove job marker from map
                    if (typeof removeJobMarker === 'function') {
                        removeJobMarker(jobId);
                    }
                    
                    modal.style.display = 'none';
                    loadJobs();
                    
                    showNotification('Job deleted locally (database connection failed)');
                }
            } catch (localError) {
                console.error('Error deleting job locally:', localError);
                showNotification('Error deleting job. Please try again.');
            }
        }
    }
}

// Handle edit job (placeholder for future implementation)
function handleEditJob() {
    const modal = document.getElementById('jobModal');
    const jobId = modal.dataset.currentJobId;
    
    // Find the job data
    const job = jobs.find(j => j.id === jobId);
    if (!job) {
        showNotification('Job not found', 'error');
        return;
    }
    
    // Close the detail modal
    modal.style.display = 'none';
    
    // Show the edit modal and populate with job data
    showEditJobModal(job);
}

// Update statistics
function updateStats() {
    const totalJobs = jobs.length;
    const activeJobs = jobs.filter(job => job.status === 'in-progress').length;
    const completedJobs = jobs.filter(job => job.status === 'completed').length;
    const pendingJobs = jobs.filter(job => job.status === 'pending').length;
    
    document.getElementById('totalJobs').textContent = totalJobs;
    document.getElementById('activeJobs').textContent = activeJobs;
    document.getElementById('completedJobs').textContent = completedJobs;
    const pendingElement = document.getElementById('pendingJobs');
    if (pendingElement) pendingElement.textContent = pendingJobs;
}

// Show edit job modal
function showEditJobModal(job) {
    const editModal = document.getElementById('editJobModal');
    
    // Populate form fields with job data
    document.getElementById('editJobTitle').value = job.title || '';
    document.getElementById('editJobDescription').value = job.description || '';
    document.getElementById('editJobAddress').value = job.locationAddress || '';
    document.getElementById('editJobContactName').value = job.contactName || '';
    document.getElementById('editJobContactPhone').value = job.contactPhone || '';
    document.getElementById('editJobStatus').value = job.status || 'pending';
    document.getElementById('editJobLat').value = job.location?.lat || '';
    document.getElementById('editJobLng').value = job.location?.lng || '';
    
    // Load workers and set assigned worker
    loadWorkersForEditModal(job.assignedWorkerId);
    
    // Store job ID for saving
    editModal.dataset.currentJobId = job.id;
    
    // Show the modal
    editModal.style.display = 'flex';
}

// Load workers for edit modal dropdown
async function loadWorkersForEditModal(selectedWorkerId) {
    try {
        const apiUrl = '/api/workers';
        const response = await fetch(apiUrl, {
            credentials: 'include'
        });
        const workers = await response.json();
        
        const editAssignedWorkerSelect = document.getElementById('editAssignedWorker');
        if (editAssignedWorkerSelect) {
            // Clear existing options
            editAssignedWorkerSelect.innerHTML = '<option value="">Select Worker</option>';
            
            // Add worker options
            workers.forEach(worker => {
                const option = document.createElement('option');
                option.value = worker.id;
                const role = worker.roles && Array.isArray(worker.roles) && worker.roles.length > 0
                    ? worker.roles[0]
                    : worker.role || 'Worker';
                option.textContent = `${worker.name} (${role})`;
                if (worker.id == selectedWorkerId) {
                    option.selected = true;
                }
                editAssignedWorkerSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading workers for edit modal:', error);
    }
}

// Handle edit job form submission
async function handleEditJobSubmit(e) {
    e.preventDefault();
    
    const editModal = document.getElementById('editJobModal');
    const jobId = editModal.dataset.currentJobId;
    
    // Get form data
    const formData = new FormData(e.target);
    const updatedJob = {
        id: jobId,
        title: formData.get('title'),
        description: formData.get('description'),
        location_address: formData.get('locationAddress'),
        contact_name: formData.get('contactName'),
        contact_phone: formData.get('contactPhone'),
        status: formData.get('status'),
        assigned_worker_id: formData.get('assignedWorkerId') || null,
        location_lat: parseFloat(formData.get('lat')),
        location_lng: parseFloat(formData.get('lng'))
    };
    
    try {
        // Update job via API
        const response = await fetch(`/api/jobs/${jobId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedJob)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const updatedJobData = await response.json();
        
        // Update local jobs array with the response data
        const jobIndex = jobs.findIndex(j => j.id === jobId);
        if (jobIndex !== -1) {
            // Map database fields back to local job object format
            jobs[jobIndex] = {
                ...jobs[jobIndex],
                id: updatedJobData.id,
                title: updatedJobData.title,
                description: updatedJobData.description,
                locationAddress: updatedJobData.location_address,
                contactName: updatedJobData.contact_name,
                contactPhone: updatedJobData.contact_phone,
                status: updatedJobData.status,
                assignedWorkerId: updatedJobData.assigned_worker_id,
                location: {
                    lat: updatedJobData.location_lat,
                    lng: updatedJobData.location_lng
                }
            };
        }
        
        // Update localStorage as backup
        localStorage.setItem('jobManagementJobs', JSON.stringify(jobs));
        
        // Re-render jobs and update stats
        renderJobs();
        updateStats();
        
        // Close modal and show success message
        editModal.style.display = 'none';
        showNotification('Job updated successfully!', 'success');
        
    } catch (error) {
        console.error('Error updating job:', error);
        
        // Fallback: try to update locally
        try {
            const jobIndex = jobs.findIndex(j => j.id === jobId);
            if (jobIndex !== -1) {
                jobs[jobIndex] = {
                    ...jobs[jobIndex],
                    title: formData.get('title'),
                    description: formData.get('description'),
                    locationAddress: formData.get('locationAddress'),
                    contactName: formData.get('contactName'),
                    contactPhone: formData.get('contactPhone'),
                    status: formData.get('status'),
                    assignedWorkerId: formData.get('assignedWorkerId') || null,
                    location: {
                        lat: parseFloat(formData.get('lat')),
                        lng: parseFloat(formData.get('lng'))
                    }
                };
                
                localStorage.setItem('jobManagementJobs', JSON.stringify(jobs));
                renderJobs();
                updateStats();
                editModal.style.display = 'none';
                showNotification('Job updated locally (database connection failed)', 'success');
            }
        } catch (localError) {
            console.error('Error updating job locally:', localError);
            showNotification('Failed to update job. Please try again.', 'error');
        }
    }
}

// Show notification helper function
function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Add styles for modal content
const modalStyles = `
<style>
.job-detail {
    font-family: 'Inter', sans-serif;
}

.detail-section {
    margin-bottom: 25px;
}

.detail-section h4 {
    margin: 0 0 15px 0;
    color: #333;
    font-size: 1.1rem;
    font-weight: 600;
    border-bottom: 2px solid #f0f0f0;
    padding-bottom: 8px;
}

.detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
}

.detail-item {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.detail-item label {
    font-weight: 600;
    color: #666;
    font-size: 0.9rem;
}

.status-select {
    padding: 8px 12px;
    border: 2px solid #e1e5e9;
    border-radius: 6px;
    background: white;
    font-size: 0.9rem;
    cursor: pointer;
}

.status-select:focus {
    outline: none;
    border-color: #667eea;
}

.contact-info {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.contact-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.95rem;
}

.contact-item i {
    width: 16px;
    color: #667eea;
}

/* Equipment location styles */
.job-equipment-list {
    margin-top: 1rem;
}

.no-equipment {
    color: #666;
    font-style: italic;
    text-align: center;
    padding: 1rem;
}

.job-equipment-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    border: 1px solid #e1e5e9;
    border-radius: 6px;
    margin-bottom: 0.5rem;
    background: #f8f9fa;
}

.equipment-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.equipment-info i {
    font-size: 1.2rem;
    color: #667eea;
    width: 20px;
    text-align: center;
}

.equipment-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.equipment-name {
    font-weight: 600;
    color: #333;
}

.equipment-type {
    font-size: 0.85rem;
    color: #666;
    text-transform: capitalize;
}

.equipment-actions {
    display: flex;
    gap: 0.5rem;
}

.btn-icon {
    padding: 0.5rem;
    border: none;
    border-radius: 4px;
    background: #667eea;
    color: white;
    cursor: pointer;
    transition: background-color 0.2s;
}

.btn-icon:hover {
    background: #5a67d8;
}

.btn-primary {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    background: #667eea;
    color: white;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s;
}

.btn-primary:hover {
    background: #5a67d8;
}

.equipment-selector-modal {
    z-index: 2500;
}

.equipment-selector-modal .modal-content {
    max-width: 600px;
    width: 90%;
}

.equipment-selector-list {
    max-height: 400px;
    overflow-y: auto;
}

.equipment-selector-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border: 1px solid #e1e5e9;
    border-radius: 6px;
    margin-bottom: 0.75rem;
    background: white;
}

.equipment-status {
    font-size: 0.8rem;
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    background: #e8f5e8;
    color: #2d5a2d;
    text-transform: uppercase;
    font-weight: 500;
}

.equipment-location-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 15px;
    border-radius: 8px;
    z-index: 1000;
}

.location-setting-header h4 {
    margin: 0 0 5px 0;
    font-size: 16px;
}

.location-setting-header p {
    margin: 0 0 15px 0;
    font-size: 14px;
    opacity: 0.9;
}

.location-setting-actions {
    display: flex;
    gap: 10px;
}

.btn-cancel-location,
.btn-confirm-location {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
}

.btn-cancel-location {
    background: #666;
    color: white;
}

.btn-cancel-location:hover {
    background: #555;
}

.btn-confirm-location {
    background: #007bff;
    color: white;
}

.btn-confirm-location:hover:not(:disabled) {
    background: #0056b3;
}

.btn-confirm-location:disabled {
    background: #ccc;
    cursor: not-allowed;
}

.equipment-info {
    max-width: 200px;
}

.equipment-info h4 {
    margin: 0 0 8px 0;
    font-size: 14px;
}

.equipment-info p {
    margin: 0 0 10px 0;
    font-size: 12px;
}

.btn-remove-location {
    background: #dc3545;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
}

.btn-remove-location:hover {
    background: #c82333;
}

        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 3000;
            font-size: 14px;
            font-weight: 500;
            color: white;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            animation: slideIn 0.3s ease forwards;
        }

        .notification-success {
            background: #28a745;
        }

        .notification-error {
            background: #dc3545;
        }

        @keyframes slideIn {
            to {
                transform: translateX(0);
            }
        }
</style>
`;

// Inject modal styles
document.head.insertAdjacentHTML('beforeend', modalStyles);

// Helper function to create marker content for AdvancedMarkerElement
function createMarkerContent(color = '#667eea') {
    const markerElement = document.createElement('div');
    markerElement.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${color}"/>
        </svg>
    `;
    return markerElement;
}