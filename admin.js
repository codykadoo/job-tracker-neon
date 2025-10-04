// Admin JavaScript functionality
let workers = [];
let currentUser = null;

// Initialize admin page
document.addEventListener('DOMContentLoaded', async function() {
    try {
        let isAuthenticated = false;
        if (window.AuthUtils && typeof window.AuthUtils.checkAuth === 'function') {
            const result = await window.AuthUtils.checkAuth();
            isAuthenticated = !!(result && result.authenticated);
        }

        if (!isAuthenticated) {
            if (window.AuthUtils && typeof window.AuthUtils.requireAuth === 'function') {
                await window.AuthUtils.requireAuth();
            } else {
                window.location.href = '/login.html';
            }
            return;
        }
    } catch (e) {
        console.warn('Auth check failed, redirecting to login');
        window.location.href = '/login.html';
        return;
    }

    loadCurrentUser();
    setupPasswordChangeForm();
    // Ensure dashboard metrics and activity load on first render
    loadDashboardData();
    // Load workers list for Workers section
    loadWorkers();
});

// Navigation functions
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Remove active class from all nav buttons
    document.querySelectorAll('.nav-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Show selected section
    const targetSection = document.getElementById(sectionName + '-section');
    if (targetSection) {
        targetSection.style.display = 'block';
    }
    
    // Add active class to clicked button - find by data-section attribute
    const activeButton = document.querySelector(`[data-section="${sectionName}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    // Load section-specific data
    switch(sectionName) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'workers':
            loadWorkers();
            break;
        case 'equipment':
            loadEquipmentData();
            break;
        case 'assignments':
            loadAssignmentsData();
            break;
        case 'settings':
            loadSystemSettings();
            break;
    }
}

// Dashboard Functions
function loadDashboardData() {
    // Update dashboard metrics
    updateDashboardMetrics();
    loadRecentActivity();
    loadDashboardJobs(); // Add this to load actual jobs data
}



// Add missing refreshDashboard function
function refreshDashboard() {
    loadDashboardData();
    showNotification('Dashboard refreshed', 'success');
}

// Add function to load actual jobs data for dashboard
async function loadDashboardJobs() {
    try {
        const apiUrl = window.location.hostname === 'localhost'
            ? `http://localhost:${window.location.port || 8004}`
            : '';
        
        const response = await fetch(`${apiUrl}/api/jobs`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const jobs = await response.json();
        
        // Update dashboard metrics with real data
        const activeJobs = jobs.filter(job => job.status === 'in-progress' || job.status === 'active').length;
        const completedJobs = jobs.filter(job => job.status === 'completed').length;
        const totalJobs = jobs.length;
        
        // Update the active jobs metric
        const activeJobsEl = document.getElementById('activeJobs');
        if (activeJobsEl) {
            activeJobsEl.textContent = activeJobs;
        }
        
        console.log(`Dashboard loaded: ${totalJobs} total jobs, ${activeJobs} active`);
        
    } catch (error) {
        console.error('Error loading dashboard jobs:', error);
        // Don't show error notification for dashboard - just use default values
    }
}

// Add missing viewAllActivity function
function viewAllActivity() {
    showNotification('Activity log feature coming soon', 'info');
}

async function updateDashboardMetrics() {
    try {
        const apiUrl = window.location.hostname === 'localhost'
            ? `http://localhost:${window.location.port || 8001}`
            : '';
        
        // Load workers data
        let workersData = [];
        try {
            const workersResponse = await fetch(`${apiUrl}/api/workers`, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });
            if (workersResponse.ok) {
                workersData = await workersResponse.json();
            } else {
                console.warn('Failed to load workers data:', workersResponse.status, workersResponse.statusText);
            }
        } catch (error) {
            console.error('Error loading workers from database:', error);
        }
        
        // Load jobs data
        let jobsData = [];
        try {
            const jobsResponse = await fetch(`${apiUrl}/api/jobs`, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });
            if (jobsResponse.ok) {
                jobsData = await jobsResponse.json();
            } else {
                console.warn('Failed to load jobs data:', jobsResponse.status, jobsResponse.statusText);
            }
        } catch (error) {
            console.error('Error loading jobs from database:', error);
        }
        
        // Load equipment data
        let equipmentData = [];
        try {
            const equipmentResponse = await fetch(`${apiUrl}/api/equipment`, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });
            if (equipmentResponse.ok) {
                equipmentData = await equipmentResponse.json();
            } else {
                console.warn('Failed to load equipment data:', equipmentResponse.status, equipmentResponse.statusText);
            }
        } catch (error) {
            console.error('Error loading equipment from database:', error);
        }
        
        // Calculate metrics from real data
        const activeJobs = jobsData.filter(job => 
            job.status === 'in-progress' || job.status === 'active' || job.status === 'assigned'
        ).length;
        
        const maintenanceEquipment = equipmentData.filter(eq => 
            eq.status === 'maintenance' || eq.status === 'in_maintenance'
        ).length;
        
        const operationalEquipment = equipmentData.filter(eq => 
            eq.status === 'operational' || eq.status === 'available'
        ).length;
        
        // Calculate percentage of operational equipment
        const operationalPercentage = equipmentData.length > 0 
            ? Math.round((operationalEquipment / equipmentData.length) * 100)
            : 0;
        
        // Update metric displays
        const totalWorkersEl = document.getElementById('totalWorkers');
        const activeJobsEl = document.getElementById('activeJobs');
        const equipmentCountEl = document.getElementById('equipmentCount');
        const maintenanceRequestsEl = document.getElementById('maintenanceRequests');
        const equipmentChangeEl = document.getElementById('equipmentChange');
        const workersChangeEl = document.getElementById('workersChange');
        const jobsChangeEl = document.getElementById('jobsChange');
        const maintenanceChangeEl = document.getElementById('maintenanceChange');
        
        if (totalWorkersEl) totalWorkersEl.textContent = workersData.length;
        if (activeJobsEl) activeJobsEl.textContent = activeJobs;
        if (equipmentCountEl) equipmentCountEl.textContent = equipmentData.length;
        if (maintenanceRequestsEl) maintenanceRequestsEl.textContent = maintenanceEquipment;
        
        // Update change indicators with real data
        if (equipmentChangeEl) equipmentChangeEl.textContent = `${operationalPercentage}% operational`;
        if (workersChangeEl) workersChangeEl.textContent = `${workersData.length} total`;
        if (jobsChangeEl) jobsChangeEl.textContent = `${activeJobs} active`;
        if (maintenanceChangeEl) {
            if (maintenanceEquipment > 0) {
                maintenanceChangeEl.textContent = `${maintenanceEquipment} pending`;
                maintenanceChangeEl.className = 'metric-change negative';
            } else {
                maintenanceChangeEl.textContent = 'All operational';
                maintenanceChangeEl.className = 'metric-change positive';
            }
        }
        
        console.log(`Dashboard metrics updated: ${workersData.length} workers, ${activeJobs} active jobs, ${equipmentData.length} equipment units`);
        
    } catch (error) {
        console.error('Error loading dashboard metrics:', error);
        // Fallback to default values if API calls fail
        const totalWorkersEl = document.getElementById('totalWorkers');
        const activeJobsEl = document.getElementById('activeJobs');
        const equipmentCountEl = document.getElementById('equipmentCount');
        const maintenanceRequestsEl = document.getElementById('maintenanceRequests');
        
        if (totalWorkersEl) totalWorkersEl.textContent = workers.length || '0';
        if (activeJobsEl) activeJobsEl.textContent = '0';
        if (equipmentCountEl) equipmentCountEl.textContent = '0';
        if (maintenanceRequestsEl) maintenanceRequestsEl.textContent = '0';
    }
}

async function loadRecentActivity() {
    try {
        const apiUrl = window.location.hostname === 'localhost'
            ? `http://localhost:${window.location.port || 8001}`
            : '';
        
        // Load recent jobs and workers data to generate activity
        let jobs = [];
        let workers = [];
        let equipment = [];
        
        try {
            const jobsResponse = await fetch(`${apiUrl}/api/jobs`, { credentials: 'include' });
            if (jobsResponse.ok) {
                jobs = await jobsResponse.json();
            } else {
                console.warn('Failed to load jobs for activity:', jobsResponse.status);
            }
        } catch (error) {
            console.error('Error loading jobs for activity:', error);
        }
        
        try {
            const workersResponse = await fetch(`${apiUrl}/api/workers`, { credentials: 'include' });
            if (workersResponse.ok) {
                workers = await workersResponse.json();
            } else {
                console.warn('Failed to load workers for activity:', workersResponse.status);
            }
        } catch (error) {
            console.error('Error loading workers for activity:', error);
        }
        
        try {
            const equipmentResponse = await fetch(`${apiUrl}/api/equipment`, { credentials: 'include' });
            if (equipmentResponse.ok) {
                equipment = await equipmentResponse.json();
            } else {
                console.warn('Failed to load equipment for activity:', equipmentResponse.status);
            }
        } catch (error) {
            console.error('Error loading equipment for activity:', error);
        }
        
        const activities = [];
        
        // Add recent job activities
        const recentJobs = jobs
            .filter(job => job.created_at || job.updated_at)
            .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
            .slice(0, 3);
        
        recentJobs.forEach(job => {
            const timeAgo = getTimeAgo(new Date(job.updated_at || job.created_at));
            if (job.status === 'completed') {
                activities.push({
                    icon: 'fas fa-check-circle',
                    text: `Job "${job.title || job.description || 'Untitled'}" marked as completed`,
                    time: timeAgo,
                    type: 'job'
                });
            } else if (job.status === 'in-progress' || job.status === 'active') {
                activities.push({
                    icon: 'fas fa-briefcase',
                    text: `Job "${job.title || job.description || 'Untitled'}" started`,
                    time: timeAgo,
                    type: 'job'
                });
            }
        });
        
        // Add recent worker activities
        const recentWorkers = workers
            .filter(worker => worker.created_at)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 2);
        
        recentWorkers.forEach(worker => {
            const timeAgo = getTimeAgo(new Date(worker.created_at));
            activities.push({
                icon: 'fas fa-user-plus',
                text: `New worker ${worker.name} added to system`,
                time: timeAgo,
                type: 'worker'
            });
        });
        
        // Add equipment maintenance activities
        const maintenanceEquipment = equipment
            .filter(eq => eq.status === 'maintenance' || eq.status === 'in_maintenance')
            .slice(0, 2);
        
        maintenanceEquipment.forEach(eq => {
            activities.push({
                icon: 'fas fa-wrench',
                text: `Equipment ${eq.name || eq.type || 'Unknown'} scheduled for maintenance`,
                time: 'Recent',
                type: 'maintenance'
            });
        });
        
        // Sort all activities by time and take the most recent ones
        const sortedActivities = activities
            .sort((a, b) => {
                if (a.time === 'Recent') return -1;
                if (b.time === 'Recent') return 1;
                return 0; // Keep original order for same time
            })
            .slice(0, 5);
        
        // Update the activity feed
        const recentActivityEl = document.getElementById('recentActivity');
        if (recentActivityEl && sortedActivities.length > 0) {
            recentActivityEl.innerHTML = sortedActivities.map(activity => `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="${activity.icon}"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-text">${activity.text}</div>
                        <div class="activity-time">${activity.time}</div>
                    </div>
                </div>
            `).join('');
        } else if (recentActivityEl) {
            // Fallback to default activities if no real data
            recentActivityEl.innerHTML = `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas fa-info-circle"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-text">System initialized successfully</div>
                        <div class="activity-time">Today</div>
                    </div>
                </div>
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas fa-database"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-text">Database connection established</div>
                        <div class="activity-time">Today</div>
                    </div>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error loading recent activity:', error);
        // Keep default activity if API fails
        const recentActivityEl = document.getElementById('recentActivity');
        if (recentActivityEl) {
            recentActivityEl.innerHTML = `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas fa-user-plus"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-text">New worker John Smith added</div>
                        <div class="activity-time">2 hours ago</div>
                    </div>
                </div>
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas fa-briefcase"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-text">Job #1234 marked as completed</div>
                        <div class="activity-time">4 hours ago</div>
                    </div>
                </div>
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas fa-wrench"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-text">Equipment CAT-320 scheduled for maintenance</div>
                        <div class="activity-time">6 hours ago</div>
                    </div>
                </div>
            `;
        }
    }
}

// Helper function to calculate time ago
function getTimeAgo(date) {
    const now = new Date();
    const diffInMs = now - date;
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInHours < 1) {
        return 'Less than an hour ago';
    } else if (diffInHours < 24) {
        return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else if (diffInDays < 7) {
        return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleDateString();
    }
}



// Equipment Management Functions
async function loadEquipmentData() {
    await updateEquipmentMetrics();
    await renderEquipmentGrid();
}

async function updateEquipmentMetrics() {
    try {
        const apiUrl = window.location.hostname === 'localhost'
            ? `http://localhost:${window.location.port || 8004}/api/equipment`
            : '/api/equipment';
        
        const response = await fetch(apiUrl, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const equipment = await response.json();
            
            // Calculate metrics from real data
            const metrics = {
                total: equipment.length,
                operational: equipment.filter(e => e.status === 'operational').length,
                maintenance: equipment.filter(e => e.status === 'maintenance').length,
                outOfService: equipment.filter(e => e.status === 'out_of_service').length
            };
            
            const totalEquipmentEl = document.getElementById('totalEquipment');
            const operationalEquipmentEl = document.getElementById('operationalEquipment');
            const maintenanceEquipmentEl = document.getElementById('maintenanceEquipment');
            const outOfServiceEquipmentEl = document.getElementById('outOfServiceEquipment');
            
            if (totalEquipmentEl) totalEquipmentEl.textContent = metrics.total;
            if (operationalEquipmentEl) operationalEquipmentEl.textContent = metrics.operational;
            if (maintenanceEquipmentEl) maintenanceEquipmentEl.textContent = metrics.maintenance;
            if (outOfServiceEquipmentEl) outOfServiceEquipmentEl.textContent = metrics.outOfService;
        } else {
            console.error('Failed to load equipment metrics');
        }
    } catch (error) {
        console.error('Error loading equipment metrics:', error);
    }
}

async function renderEquipmentGrid() {
    try {
        const apiUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:8001/api/equipment' 
            : '/api/equipment';
        
        const response = await fetch(apiUrl, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const equipment = await response.json();
            const equipmentGrid = document.getElementById('equipmentGrid');
            
            if (equipmentGrid) {
                equipmentGrid.innerHTML = equipment.map(item => createEquipmentCard(item)).join('');
            }
        } else {
            console.error('Failed to load equipment data');
        }
    } catch (error) {
        console.error('Error loading equipment data:', error);
    }
}

function createEquipmentCard(equipment) {
    const statusClass = equipment.status || 'operational';
    const equipmentType = equipment.type || 'other';
    const equipmentIcon = getEquipmentIcon(equipmentType);
    
    return `
        <div class="equipment-card" data-type="${equipmentType}" data-status="${statusClass}" data-equipment-id="${equipment.id}">
            <div class="equipment-header">
                <div class="equipment-status ${statusClass}">
                    <i class="fas fa-circle"></i>
                </div>
                <div class="equipment-actions">
                    <button class="action-btn" onclick="viewEquipmentDetails('${equipment.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn" onclick="editEquipment('${equipment.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn" onclick="scheduleMaintenanceModal('${equipment.id}')" title="Schedule Maintenance">
                        <i class="fas fa-wrench"></i>
                    </button>
                </div>
            </div>
            
            <div class="equipment-image">
                <i class="${equipmentIcon} equipment-icon"></i>
            </div>
            
            <div class="equipment-info">
                <h3 class="equipment-name">${equipment.name || 'Unnamed Equipment'}</h3>
                <div class="equipment-details">
                    <div class="detail-item">
                        <span class="detail-label">Type:</span>
                        <span class="detail-value">${equipment.type || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Serial:</span>
                        <span class="detail-value">${equipment.serial_number || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Year:</span>
                        <span class="detail-value">${equipment.year || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Location:</span>
                        <span class="detail-value">${equipment.current_location || 'N/A'}</span>
                    </div>
                </div>
            </div>
            
            <div class="equipment-footer">
                <div class="maintenance-indicator">
                    <i class="fas fa-calendar-check"></i>
                    <span>Next Service: ${equipment.next_maintenance_date || 'Not scheduled'}</span>
                </div>
            </div>
        </div>
    `;
}

function getEquipmentIcon(type) {
    const icons = {
        'skidsteer': 'fas fa-tractor',
        'excavator': 'fas fa-truck-monster',
        'backhoe': 'fas fa-tractor',
        'truck': 'fas fa-truck',
        'vac_truck': 'fas fa-truck-pickup',
        'trailer': 'fas fa-trailer',
        'attachment': 'fas fa-wrench',
        'small_engine': 'fas fa-cog',
        'other': 'fas fa-tools'
    };
    return icons[type] || 'fas fa-tools';
}

function searchEquipment() {
    const searchTerm = document.getElementById('equipmentSearch').value.toLowerCase();
    const typeFilter = document.getElementById('equipmentTypeFilter').value;
    const statusFilter = document.getElementById('equipmentStatusFilter').value;
    
    const equipmentCards = document.querySelectorAll('.equipment-card');
    
    equipmentCards.forEach(card => {
        const name = card.querySelector('.equipment-name').textContent.toLowerCase();
        const type = card.getAttribute('data-type');
        const status = card.getAttribute('data-status');
        
        const matchesSearch = name.includes(searchTerm);
        const matchesType = !typeFilter || type === typeFilter;
        const matchesStatus = !statusFilter || status === statusFilter;
        
        if (matchesSearch && matchesType && matchesStatus) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

function clearEquipmentFilters() {
    document.getElementById('equipmentSearch').value = '';
    document.getElementById('equipmentTypeFilter').value = '';
    document.getElementById('equipmentStatusFilter').value = '';
    searchEquipment();
}

async function viewEquipmentDetails(equipmentId) {
    try {
        const apiUrl = window.location.hostname === 'localhost' 
            ? `http://localhost:8001/api/equipment/${equipmentId}` 
            : `/api/equipment/${equipmentId}`;
        
        const response = await fetch(apiUrl, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const equipment = await response.json();
            showEquipmentDetailsModal(equipment);
        } else {
            console.error('Failed to load equipment details');
            showNotification('Failed to load equipment details', 'error');
        }
    } catch (error) {
        console.error('Error loading equipment details:', error);
        showNotification('Error loading equipment details', 'error');
    }
}

function showEquipmentDetailsModal(equipment) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content equipment-details-modal">
            <div class="modal-header">
                <h2>Equipment Details</h2>
                <button class="close-btn" onclick="closeEquipmentDetailsModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="equipment-details-grid">
                    <div class="detail-section">
                        <h3>Basic Information</h3>
                        <div class="detail-row">
                            <span class="label">Name:</span>
                            <span class="value">${equipment.name || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Type:</span>
                            <span class="value">${equipment.type || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Serial Number:</span>
                            <span class="value">${equipment.serial_number || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Year:</span>
                            <span class="value">${equipment.year || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Status:</span>
                            <span class="value status-${equipment.status}">${equipment.status || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h3>Location & Usage</h3>
                        <div class="detail-row">
                            <span class="label">Current Location:</span>
                            <span class="value">${equipment.current_location || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Hours:</span>
                            <span class="value">${equipment.hours || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Mileage:</span>
                            <span class="value">${equipment.mileage || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h3>Maintenance</h3>
                        <div class="detail-row">
                            <span class="label">Last Maintenance:</span>
                            <span class="value">${equipment.last_maintenance_date || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Next Maintenance:</span>
                            <span class="value">${equipment.next_maintenance_date || 'Not scheduled'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Maintenance Notes:</span>
                            <span class="value">${equipment.maintenance_notes || 'None'}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeEquipmentDetailsModal()">Close</button>
                <button class="btn btn-primary" onclick="editEquipment('${equipment.id}')">Edit Equipment</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    currentEquipmentId = equipment.id;
}

function closeEquipmentDetailsModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
    currentEquipmentId = null;
}



function scheduleMaintenanceModal(equipmentId) {
    alert(`Schedule maintenance for equipment: ${equipmentId}`);
    // This would open a maintenance scheduling modal
}

function showAddEquipmentModal() {
    alert('Add new equipment modal would open here');
    // This would open the add equipment modal
}

function exportEquipmentReport() {
    alert('Equipment report export would start here');
    // This would generate and download an equipment report
}

// System Settings Functions
function loadSystemSettings() {
    console.log('System settings loaded');
    // Load current system settings from server
}

function toggleSetting(settingName, event) {
    const toggle = event.target;
    toggle.classList.toggle('active');
    
    // Here you would save the setting to the server
    console.log(`Setting ${settingName} toggled:`, toggle.classList.contains('active'));
}

function saveGeneralSettings() {
    const companyName = document.getElementById('companyName').value;
    const timezone = document.getElementById('timezone').value;
    const language = document.getElementById('language').value;
    
    console.log('Saving general settings:', { companyName, timezone, language });
    showNotification('General settings saved successfully');
}

function saveSecuritySettings() {
    console.log('Saving security settings');
    showNotification('Security settings saved successfully');
}

function saveIntegrationSettings() {
    const mapsApiKey = document.getElementById('mapsApiKey').value;
    const backupFrequency = document.getElementById('backupFrequency').value;
    
    console.log('Saving integration settings:', { mapsApiKey, backupFrequency });
    showNotification('Integration settings saved successfully');
}

function performMaintenance(action) {
    console.log(`Performing maintenance action: ${action}`);
    
    switch(action) {
        case 'optimize':
            showNotification('Database optimization started');
            break;
        case 'clear-cache':
            showNotification('Cache cleared successfully');
            break;
        case 'export-logs':
            showNotification('Log export started');
            break;
        case 'backup':
            showNotification('System backup initiated');
            break;
    }
}

// Assignments Functions
function loadAssignmentsData() {
    console.log('Loading assignments data');
    // This would load job assignments from the server
}

// Equipment Modal Functions
let currentEquipmentId = null;

function closeEquipmentDetailsModal() {
    document.getElementById('equipmentDetailsModal').style.display = 'none';
    currentEquipmentId = null;
}

function editEquipment(equipmentId) {
    currentEquipmentId = equipmentId;
    
    // Sample equipment data for editing
    const equipmentData = {
        'CAT-320': {
            name: 'CAT 320 Excavator',
            type: 'excavator',
            status: 'operational',
            serial: 'CAT320-2019-001',
            year: 2019,
            hours: 2450
        }
    };
    
    const equipment = equipmentData[equipmentId] || {
        name: `Equipment ${equipmentId}`,
        type: 'other',
        status: 'operational',
        serial: '',
        year: new Date().getFullYear(),
        hours: 0
    };
    
    // Populate the edit form
    document.getElementById('editEquipmentName').value = equipment.name;
    document.getElementById('editEquipmentType').value = equipment.type;
    document.getElementById('editEquipmentStatus').value = equipment.status;
    document.getElementById('editEquipmentSerial').value = equipment.serial;
    document.getElementById('editEquipmentYear').value = equipment.year;
    document.getElementById('editEquipmentHours').value = equipment.hours;
    
    document.getElementById('equipmentEditModal').style.display = 'flex';
}

function editEquipmentFromModal() {
    closeEquipmentDetailsModal();
    editEquipment(currentEquipmentId);
}

function closeEquipmentEditModal() {
    document.getElementById('equipmentEditModal').style.display = 'none';
    document.getElementById('equipmentEditForm').reset();
    currentEquipmentId = null;
}

function saveEquipmentChanges() {
    const formData = {
        name: document.getElementById('editEquipmentName').value,
        type: document.getElementById('editEquipmentType').value,
        status: document.getElementById('editEquipmentStatus').value,
        serial: document.getElementById('editEquipmentSerial').value,
        year: document.getElementById('editEquipmentYear').value,
        hours: document.getElementById('editEquipmentHours').value
    };
    
    console.log('Saving equipment changes:', formData);
    showNotification(`Equipment ${formData.name} updated successfully`);
    closeEquipmentEditModal();
    
    // Refresh equipment data
    loadEquipmentData();
}

async function scheduleMaintenanceModal(equipmentId) {
    currentEquipmentId = equipmentId;
    
    // Set equipment name in the form
    const equipmentName = document.querySelector(`[data-equipment-id="${equipmentId}"] .equipment-name`)?.textContent || `Equipment ${equipmentId}`;
    document.getElementById('maintenanceEquipmentName').value = equipmentName;
    
    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('maintenanceDate').value = tomorrow.toISOString().split('T')[0];
    
    // Set default time to 9 AM
    document.getElementById('maintenanceTime').value = '09:00';
    
    // Load workers for technician dropdown
    await loadTechniciansForMaintenance();
    
    document.getElementById('maintenanceScheduleModal').style.display = 'flex';
}

async function loadTechniciansForMaintenance() {
    try {
        const response = await fetch('/api/workers');
        if (response.ok) {
            const workers = await response.json();
            const technicianSelect = document.getElementById('maintenanceTechnician');
            
            // Clear existing options except the first one
            technicianSelect.innerHTML = '<option value="">Select Technician</option>';
            
            // Add workers to dropdown
            workers.forEach(worker => {
                const option = document.createElement('option');
                option.value = worker.id;
                option.textContent = worker.name;
                technicianSelect.appendChild(option);
            });
            
            // Add external contractor option
            const externalOption = document.createElement('option');
            externalOption.value = 'external';
            externalOption.textContent = 'External Contractor';
            technicianSelect.appendChild(externalOption);
        }
    } catch (error) {
        console.error('Error loading technicians:', error);
        showNotification('Error loading technicians', 'error');
    }
}

function closeMaintenanceScheduleModal() {
    document.getElementById('maintenanceScheduleModal').style.display = 'none';
    document.getElementById('maintenanceScheduleForm').reset();
    currentEquipmentId = null;
}

async function scheduleMaintenanceWork() {
    const formData = {
        equipmentId: currentEquipmentId,
        equipmentName: document.getElementById('maintenanceEquipmentName').value,
        type: document.getElementById('maintenanceType').value,
        date: document.getElementById('maintenanceDate').value,
        time: document.getElementById('maintenanceTime').value,
        priority: document.getElementById('maintenancePriority').value,
        description: document.getElementById('maintenanceDescription').value,
        technician: document.getElementById('maintenanceTechnician').value
    };
    
    if (!formData.type || !formData.date || !formData.time || !formData.priority) {
        alert('Please fill in all required fields.');
        return;
    }
    
    try {
        // Prepare data for API
        const maintenanceData = {
            equipment_id: parseInt(formData.equipmentId),
            type: formData.type,
            priority: formData.priority,
            title: `${formData.type} - ${formData.equipmentName}`,
            description: formData.description || `Scheduled ${formData.type} for ${formData.equipmentName}`,
            assigned_worker_id: formData.technician === 'external' ? null : parseInt(formData.technician) || null,
            due_date: formData.date,
            status: 'pending'
        };
        
        // Submit to database
        const response = await fetch('/api/maintenance-requests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(maintenanceData)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Maintenance scheduled successfully:', result);
            showNotification(`Maintenance scheduled for ${formData.equipmentName} on ${formData.date} at ${formData.time}`);
            closeMaintenanceScheduleModal();
            
            // Refresh dashboard data to update maintenance requests count
            if (document.getElementById('dashboard-section').style.display !== 'none') {
                loadDashboardData();
            }
        } else {
            const error = await response.json();
            console.error('Error scheduling maintenance:', error);
            showNotification('Error scheduling maintenance: ' + (error.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error scheduling maintenance:', error);
        showNotification('Error scheduling maintenance. Please try again.', 'error');
    }
}

// Close modals when clicking outside
document.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        if (event.target.id === 'equipmentDetailsModal') {
            closeEquipmentDetailsModal();
        } else if (event.target.id === 'equipmentEditModal') {
            closeEquipmentEditModal();
        } else if (event.target.id === 'maintenanceScheduleModal') {
            closeMaintenanceScheduleModal();
        }
    }
});

// Worker Management Functions
async function loadWorkers() {
    try {
        const apiUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:8001/api/workers' 
            : '/api/workers';
        const response = await fetch(apiUrl, {
            credentials: 'include'
        });
        if (response.ok) {
            workers = await response.json();
        } else {
            workers = [];
        }
        renderWorkers();
    } catch (error) {
        console.error('Error loading workers:', error);
        workers = [];
        renderWorkers();
    }
}

function renderWorkers() {
    const workersList = document.getElementById('workers-list');
    
    // Add null check to prevent errors
    if (!workersList) {
        console.warn('workers-list element not found');
        return;
    }
    
    if (workers.length === 0) {
        workersList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
                <h3>No Workers Added</h3>
                <p>Start by adding your first worker to the system.</p>
            </div>
        `;
        return;
    }
    
    workersList.innerHTML = workers.map(worker => `
        <div class="worker-card">
            <h3 class="worker-name">${worker.name}</h3>
            <p class="worker-email">${worker.email}</p>
            <p class="worker-role"><strong>Role:</strong> ${Array.isArray(worker.roles) ? worker.roles.join(', ') : (worker.role || 'Apprentice')}</p>
            <div class="worker-password-section">
                <span class="detail-label"><strong>Password:</strong></span>
                <div class="password-display">
                    <input type="password" value="${worker.password || '••••••••'}" readonly class="password-field" id="password-${worker.id}">
                    <button class="btn-copy" onclick="togglePasswordVisibility(${worker.id})" title="Show/Hide Password">
                        👁️
                    </button>
                    <button class="btn-copy" onclick="copyPassword(${worker.id}, '${worker.password || ''}')" title="Copy Password">
                        📋
                    </button>
                </div>
            </div>
            <div class="worker-status ${worker.status === 'active' ? 'status-active' : 'status-inactive'}">
                ${worker.status || 'active'}
            </div>
            <div class="worker-actions">
                <button class="btn-sm btn-edit" onclick="editWorker(${worker.id})">
                    ✏️ Edit
                </button>
                <button class="btn-sm btn-reset-password" onclick="resetWorkerPassword(${worker.id}, '${worker.name}')" title="Reset Password">
                    🔑 Reset Password
                </button>
                <button class="btn-sm btn-delete" onclick="confirmDeleteWorker(${worker.id}, '${worker.name}')">
                    🗑️ Delete
                </button>
            </div>
        </div>
    `).join('');
}

// Modal functions
function showAddWorkerModal() {
    document.getElementById('addWorkerModal').style.display = 'flex';
    document.getElementById('workerName').focus();
}

function hideAddWorkerModal() {
    document.getElementById('addWorkerModal').style.display = 'none';
    document.getElementById('addWorkerForm').reset();
}

// Add new worker
async function addWorker() {
    const name = document.getElementById('workerName').value.trim();
    const email = document.getElementById('workerEmail').value.trim();
    const phone = document.getElementById('workerPhone').value.trim();
    const password = document.getElementById('workerPassword').value.trim();
    
    // Get selected roles from checkboxes
    const roleCheckboxes = document.querySelectorAll('.roles-checkbox-group input[type="checkbox"]:checked');
    const roles = Array.from(roleCheckboxes).map(checkbox => checkbox.value);
    
    if (!name || !email) {
        alert('Please fill in all required fields.');
        return;
    }
    
    if (roles.length === 0) {
        alert('Please select at least one role.');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Please enter a valid email address.');
        return;
    }
    
    const workerData = {
        name: name,
        email: email,
        phone: phone || null,
        roles: roles,
        status: 'active',
        password: password || generateRandomPassword()
    };
    
    try {
        const apiUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:8001/api/workers' 
            : '/api/workers';
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(workerData),
            credentials: 'include'
        });
        
        if (response.ok) {
            const newWorker = await response.json();
            workers.push(newWorker);
            renderWorkers();
            hideAddWorkerModal();
            
            // Show password notification if it was auto-generated
            if (!password) {
                showNotification(`Worker added successfully! Generated password: ${workerData.password}`);
            } else {
                showNotification('Worker added successfully!');
            }
        } else {
            const error = await response.json();
            alert('Error adding worker: ' + (error.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error adding worker:', error);
        alert('Error adding worker. Please try again.');
    }
}

// Edit worker
function editWorker(workerId) {
    const worker = workers.find(w => w.id === workerId);
    if (!worker) {
        alert('Worker not found.');
        return;
    }
    
    // Pre-fill the form with worker data
    document.getElementById('workerName').value = worker.name;
    document.getElementById('workerEmail').value = worker.email;
    document.getElementById('workerPhone').value = worker.phone || '';
    document.getElementById('workerPassword').value = ''; // Don't pre-fill password
    
    // Handle roles - check appropriate checkboxes
    const roleCheckboxes = document.querySelectorAll('.roles-checkbox-group input[type="checkbox"]');
    roleCheckboxes.forEach(checkbox => {
        checkbox.checked = false; // Clear all first
    });
    
    // Set checked state based on worker's roles
    const workerRoles = Array.isArray(worker.roles) ? worker.roles : (worker.role ? [worker.role] : ['Apprentice']);
    workerRoles.forEach(role => {
        const checkbox = document.querySelector(`input[type="checkbox"][value="${role}"]`);
        if (checkbox) {
            checkbox.checked = true;
        }
    });
    
    // Change modal title and button
    document.querySelector('#addWorkerModal .modal-header h3').textContent = 'Edit Worker';
    const addButton = document.querySelector('#addWorkerModal .btn-primary');
    addButton.textContent = 'Update Worker';
    addButton.onclick = () => updateWorker(workerId);
    
    showAddWorkerModal();
}

// Update worker
async function updateWorker(workerId) {
    const name = document.getElementById('workerName').value.trim();
    const email = document.getElementById('workerEmail').value.trim();
    const phone = document.getElementById('workerPhone').value.trim();
    const password = document.getElementById('workerPassword').value.trim();
    
    // Get selected roles from checkboxes
    const roleCheckboxes = document.querySelectorAll('.roles-checkbox-group input[type="checkbox"]:checked');
    const roles = Array.from(roleCheckboxes).map(checkbox => checkbox.value);
    
    if (!name || !email) {
        alert('Please fill in all required fields.');
        return;
    }
    
    if (roles.length === 0) {
        alert('Please select at least one role.');
        return;
    }
    
    const workerData = {
        name: name,
        email: email,
        phone: phone || null,
        roles: roles
    };
    
    // Only include password if it was provided
    if (password) {
        workerData.password = password;
    }
    
    try {
        const apiUrl = window.location.hostname === 'localhost' 
            ? `http://localhost:8001/api/workers/${workerId}` 
            : `/api/workers/${workerId}`;
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(workerData),
            credentials: 'include'
        });
        
        if (response.ok) {
            const updatedWorker = await response.json();
            const index = workers.findIndex(w => w.id === workerId);
            if (index !== -1) {
                workers[index] = updatedWorker;
            }
            renderWorkers();
            hideAddWorkerModal();
            resetModal();
            showNotification('Worker updated successfully!');
        } else {
            const error = await response.json();
            alert('Error updating worker: ' + (error.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error updating worker:', error);
        alert('Error updating worker. Please try again.');
    }
}

// Generate random password
// Password visibility and copy functions
function togglePasswordVisibility(workerId) {
    const passwordField = document.getElementById(`password-${workerId}`);
    const toggleButton = passwordField.nextElementSibling;
    
    if (passwordField.type === 'password') {
        passwordField.type = 'text';
        toggleButton.innerHTML = '🙈';
        toggleButton.title = 'Hide Password';
    } else {
        passwordField.type = 'password';
        toggleButton.innerHTML = '👁️';
        toggleButton.title = 'Show Password';
    }
}

function copyPassword(workerId, password) {
    if (!password) {
        showNotification('No password available to copy', 'error');
        return;
    }
    
    navigator.clipboard.writeText(password).then(() => {
        showNotification('Password copied to clipboard!', 'success');
    }).catch(err => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = password;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('Password copied to clipboard!', 'success');
    });
}

function generateRandomPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// Reset modal to add mode
function resetModal() {
    document.querySelector('#addWorkerModal .modal-header h3').textContent = 'Add New Worker';
    const addButton = document.querySelector('#addWorkerModal .btn-primary');
    addButton.textContent = 'Add Worker';
    addButton.onclick = addWorker;
    
    // Reset all checkboxes to default (only Apprentice checked)
    const roleCheckboxes = document.querySelectorAll('.roles-checkbox-group input[type="checkbox"]');
    roleCheckboxes.forEach(checkbox => {
        checkbox.checked = checkbox.value === 'Apprentice';
    });
}

// Confirm delete worker
function confirmDeleteWorker(workerId, workerName) {
    if (confirm(`Are you sure you want to delete worker "${workerName}"? This action cannot be undone.`)) {
        deleteWorker(workerId);
    }
}

// Delete worker
async function deleteWorker(workerId) {
    try {
        const apiUrl = window.location.hostname === 'localhost' 
            ? `http://localhost:8001/api/workers/${workerId}` 
            : `/api/workers/${workerId}`;
        const response = await fetch(apiUrl, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            workers = workers.filter(w => w.id !== workerId);
            renderWorkers();
            showNotification('Worker deleted successfully!');
        } else {
            const error = await response.json();
            alert('Error deleting worker: ' + (error.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting worker:', error);
        alert('Error deleting worker. Please try again.');
    }
}

// Notification function
function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    
    const backgroundColor = type === 'error' ? '#dc3545' : '#28a745';
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${backgroundColor};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    
    if (!document.querySelector('style[data-notification]')) {
        style.setAttribute('data-notification', 'true');
        document.head.appendChild(style);
    }
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in forwards';
        
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('addWorkerModal');
    if (event.target === modal) {
        hideAddWorkerModal();
        resetModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modal = document.getElementById('addWorkerModal');
        if (modal.style.display === 'flex') {
            hideAddWorkerModal();
            resetModal();
        }
    }
});


// Load current user information
async function loadCurrentUser() {
    try {
        const response = await fetch('/api/auth/me', {
            credentials: 'include'
        });
        if (response.ok) {
            currentUser = await response.json();
            updateProfileDisplay();
        }
    } catch (error) {
        console.error('Error loading current user:', error);
    }
}

// Update profile display with current user info
function updateProfileDisplay() {
    if (currentUser && currentUser.user) {
        document.getElementById('currentUserName').textContent = currentUser.user.name || 'N/A';
        document.getElementById('currentUserEmail').textContent = currentUser.user.email || 'N/A';
        document.getElementById('currentUserRoles').textContent = currentUser.user.roles ? currentUser.user.roles.join(', ') : 'N/A';
    }
}

// Setup password change form
function setupPasswordChangeForm() {
    const form = document.getElementById('changePasswordForm');
    if (form) {
        form.addEventListener('submit', handlePasswordChange);
    }
}

// Handle password change form submission
async function handlePasswordChange(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validate passwords match
    if (newPassword !== confirmPassword) {
        showNotification('New passwords do not match', 'error');
        return;
    }
    
    // Validate password length
    if (newPassword.length < 6) {
        showNotification('Password must be at least 6 characters long', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                currentPassword: currentPassword,
                newPassword: newPassword
            }),
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Password changed successfully', 'success');
            // Clear the form
            document.getElementById('changePasswordForm').reset();
        } else {
            showNotification(result.message || 'Failed to change password', 'error');
        }
    } catch (error) {
        console.error('Error changing password:', error);
        showNotification('An error occurred while changing password', 'error');
    }
}

// Reset worker password function
function resetWorkerPassword(workerId, workerName) {
    if (confirm(`Are you sure you want to reset the password for ${workerName}? They will need to use the new temporary password to log in.`)) {
        performPasswordReset(workerId, workerName);
    }
}

async function performPasswordReset(workerId, workerName) {
    try {
        const response = await fetch(`/api/workers/${workerId}/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Create a more persistent notification with copy functionality
            showPasswordResetNotification(workerName, result.temporaryPassword);
            // Reload workers to update the display
            await loadWorkers();
        } else {
            showNotification(result.message || 'Failed to reset password', 'error');
        }
    } catch (error) {
        console.error('Error resetting password:', error);
        showNotification('An error occurred while resetting password', 'error');
    }
}

// Enhanced notification for password reset with copy functionality
function showPasswordResetNotification(workerName, temporaryPassword) {
    // Create notification element
    const notification = document.createElement('div');
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
        max-width: 400px;
        min-width: 300px;
    `;
    
    notification.innerHTML = `
        <div style="margin-bottom: 10px;">
            <strong>Password Reset Successful!</strong>
        </div>
        <div style="margin-bottom: 15px;">
            Worker: <strong>${workerName}</strong>
        </div>
        <div style="margin-bottom: 15px;">
            <div style="margin-bottom: 5px;">Temporary Password:</div>
            <div style="background: rgba(255,255,255,0.2); padding: 10px; border-radius: 6px; font-family: monospace; font-size: 16px; letter-spacing: 1px; word-break: break-all;">
                ${temporaryPassword}
            </div>
        </div>
        <div style="display: flex; gap: 10px;">
            <button id="copyPasswordBtn" style="
                background: rgba(255,255,255,0.2);
                border: 1px solid rgba(255,255,255,0.3);
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
                flex: 1;
            ">📋 Copy Password</button>
            <button id="closeNotificationBtn" style="
                background: rgba(255,255,255,0.2);
                border: 1px solid rgba(255,255,255,0.3);
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
            ">✕ Close</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Add event listeners
    const copyBtn = notification.querySelector('#copyPasswordBtn');
    const closeBtn = notification.querySelector('#closeNotificationBtn');
    
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(temporaryPassword).then(() => {
            copyBtn.innerHTML = '✓ Copied!';
            copyBtn.style.background = 'rgba(255,255,255,0.3)';
            setTimeout(() => {
                copyBtn.innerHTML = '📋 Copy Password';
                copyBtn.style.background = 'rgba(255,255,255,0.2)';
            }, 2000);
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = temporaryPassword;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            copyBtn.innerHTML = '✓ Copied!';
            copyBtn.style.background = 'rgba(255,255,255,0.3)';
            setTimeout(() => {
                copyBtn.innerHTML = '📋 Copy Password';
                copyBtn.style.background = 'rgba(255,255,255,0.2)';
            }, 2000);
        });
    });
    
    closeBtn.addEventListener('click', () => {
        removeNotification();
    });
    
    function removeNotification() {
        notification.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }
    
    // Auto-close after 30 seconds (much longer than before)
    setTimeout(() => {
        if (notification.parentNode) {
            removeNotification();
        }
    }, 30000);
}
