// Equipment Management JavaScript

let equipmentData = [];
let filteredEquipment = [];
let currentEquipment = null;
let editingEquipment = null;
let maintenanceHistory = [];
let currentMaintenanceEquipment = null;
let currentView = 'grid';

// Export equipment data to CSV
function exportEquipment() {
    if (equipmentData.length === 0) {
        showNotification('No equipment data to export', 'error');
        return;
    }
    
    const csv = generateEquipmentCSV(equipmentData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `equipment_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    showNotification('Equipment data exported successfully', 'success');
}

// Generate CSV content for equipment
function generateEquipmentCSV(equipment) {
    const headers = ['ID', 'Name', 'Type', 'Status', 'Serial Number', 'Model', 'Year', 'Hours', 'Last Maintenance', 'Location'];
    const rows = equipment.map(eq => [
        eq.id,
        eq.name,
        eq.type,
        eq.status,
        eq.serialNumber || '',
        eq.model || '',
        eq.year || '',
        eq.hours || '',
        eq.lastMaintenance || '',
        eq.location || ''
    ]);
    
    return [headers, ...rows].map(row => 
        row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
}

// Clear search input
function clearSearch() {
    document.getElementById('searchInput').value = '';
    filterEquipment();
}

// Clear all filters
function clearAllFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('typeFilter').value = '';
    document.getElementById('statusFilter').value = '';
    setActiveCategory('all');
    filterEquipment();
    showNotification('All filters cleared', 'success');
}

// Set view type (grid or list)
function setView(viewType) {
    currentView = viewType;
    
    // Update view buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === viewType) {
            btn.classList.add('active');
        }
    });
    
    // Update grid class
    const grid = document.getElementById('equipmentGrid');
    if (viewType === 'list') {
        grid.classList.add('list-view');
    } else {
        grid.classList.remove('list-view');
    }
    
    renderEquipment();
}

// Equipment type icons mapping
const equipmentIcons = {
    skidsteer: 'fas fa-tractor',
    excavator: 'fas fa-truck-monster',
    backhoe: 'fas fa-tractor',
    truck: 'fas fa-truck',
    vac_truck: 'fas fa-truck-pickup',
    trailer: 'fas fa-trailer',
    attachment: 'fas fa-wrench',
    small_engine: 'fas fa-cog',
    other: 'fas fa-tools'
};

// Equipment type labels
const equipmentLabels = {
    skidsteer: 'Skid Steer',
    excavator: 'Excavator',
    backhoe: 'Backhoe',
    truck: 'Truck',
    vac_truck: 'Vac Truck',
    trailer: 'Trailer',
    attachment: 'Attachment',
    small_engine: 'Small Engine',
    other: 'Other'
};

// Maintenance type icons
const maintenanceIcons = {
    repair: 'fas fa-wrench',
    maintenance: 'fas fa-cog',
    inspection: 'fas fa-search',
    service: 'fas fa-oil-can'
};

// Initialize the page
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Ensure user is authenticated before initializing to avoid aborted/unauthorized requests
        if (window.AuthUtils && typeof window.AuthUtils.requireAuth === 'function') {
            const user = await window.AuthUtils.requireAuth();
            if (!user) return; // requireAuth will redirect if unauthenticated
        }
    } catch (e) {
        console.warn('Auth check failed, redirecting to login');
        window.location.href = '/login.html';
        return;
    }

    loadEquipment();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterEquipment);
    }
    
    // Filter functionality
    const typeFilter = document.getElementById('typeFilter');
    if (typeFilter) {
        typeFilter.addEventListener('change', filterEquipment);
    }
    
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', filterEquipment);
    }
    
    // Category tabs
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            setActiveCategory(this.dataset.category);
        });
    });
    
    // Add equipment button
    const addEquipmentBtn = document.getElementById('addEquipmentBtn');
    if (addEquipmentBtn) {
        addEquipmentBtn.addEventListener('click', openAddEquipmentModal);
    }
    
    // Equipment form submission
    const equipmentForm = document.getElementById('equipmentForm');
    if (equipmentForm) {
        equipmentForm.addEventListener('submit', handleEquipmentSubmit);
    }
    
    // Modal close events
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeEquipmentModal();
            closeDetailsModal();
        }
    });
    
    // Maintenance modal event listeners
    setupMaintenanceEventListeners();
}

// Load equipment data
async function loadEquipment() {
    try {
        const apiUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:8001/api/equipment' 
            : '/api/equipment';
        const response = await fetch(apiUrl, {
            credentials: 'include',
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        if (response.ok) {
            equipmentData = await response.json();
            filteredEquipment = [...equipmentData];
            renderEquipment();
            updateStats();
        } else {
            console.error('Failed to load equipment');
        }
    } catch (error) {
        console.error('Error loading equipment:', error);
    }
}

// Update statistics
function updateStats() {
    const total = equipmentData.length;
    const available = equipmentData.filter(eq => eq.status === 'available').length;
    const inUse = equipmentData.filter(eq => eq.status === 'in_use').length;
    const maintenance = equipmentData.filter(eq => eq.status === 'maintenance').length;

    // Add null checks for stat elements
    const totalElement = document.getElementById('totalEquipment');
    const availableElement = document.getElementById('availableEquipment');
    const inUseElement = document.getElementById('inUseEquipment');
    const maintenanceElement = document.getElementById('maintenanceEquipment');
    
    if (totalElement) totalElement.textContent = total;
    if (availableElement) availableElement.textContent = available;
    if (inUseElement) inUseElement.textContent = inUse;
    if (maintenanceElement) maintenanceElement.textContent = maintenance;
}

// Set active category
function setActiveCategory(category) {
    // Update active tab
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-category="${category}"]`).classList.add('active');
    
    // Update type filter
    const typeFilter = document.getElementById('typeFilter');
    if (category === 'all') {
        typeFilter.value = '';
    } else {
        typeFilter.value = category;
    }
    
    filterEquipment();
}

// Filter equipment
function filterEquipment() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const typeFilter = document.getElementById('typeFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    
    filteredEquipment = equipmentData.filter(equipment => {
        const matchesSearch = !searchTerm || 
            equipment.name.toLowerCase().includes(searchTerm) ||
            equipment.make?.toLowerCase().includes(searchTerm) ||
            equipment.model?.toLowerCase().includes(searchTerm) ||
            equipment.serial_number?.toLowerCase().includes(searchTerm);
        
        const matchesType = !typeFilter || equipment.equipment_type === typeFilter;
        const matchesStatus = !statusFilter || equipment.status === statusFilter;
        
        return matchesSearch && matchesType && matchesStatus;
    });
    
    renderEquipment();
}

// Render equipment grid
function renderEquipment() {
    const grid = document.getElementById('equipmentGrid');
    const emptyState = document.getElementById('emptyState');
    
    // Add null checks to prevent errors
    if (!grid) {
        console.warn('equipmentGrid element not found');
        return;
    }
    
    if (filteredEquipment.length === 0) {
        grid.style.display = 'none';
        if (emptyState) {
            emptyState.style.display = 'block';
        }
        return;
    }
    
    grid.style.display = 'grid';
    if (emptyState) {
        emptyState.style.display = 'none';
    }
    
    grid.innerHTML = filteredEquipment.map(equipment => createEquipmentCard(equipment)).join('');
}

// Create equipment card HTML
function createEquipmentCard(equipment) {
    const icon = equipmentIcons[equipment.equipment_type] || 'fas fa-tools';
    const typeLabel = equipmentLabels[equipment.equipment_type] || 'Other';
    const statusClass = `status-${equipment.status}`;
    const statusLabel = equipment.status.replace('_', ' ').toUpperCase();
    
    return `
        <div class="equipment-card" onclick="showEquipmentDetails(${equipment.id})">
            <div class="equipment-card-header">
                <div class="equipment-title">
                    <h3 class="equipment-name">${equipment.name}</h3>
                    <span class="equipment-status ${statusClass}">${statusLabel}</span>
                </div>
                <div class="equipment-type">
                    <i class="${icon}"></i>
                    <span>${typeLabel}</span>
                </div>
            </div>
            <div class="equipment-card-body">
                <div class="equipment-details-grid">
                    ${equipment.make ? `
                        <div class="equipment-detail">
                            <span class="detail-label">Make</span>
                            <span class="detail-value">${equipment.make}</span>
                        </div>
                    ` : ''}
                    ${equipment.model ? `
                        <div class="equipment-detail">
                            <span class="detail-label">Model</span>
                            <span class="detail-value">${equipment.model}</span>
                        </div>
                    ` : ''}
                    ${equipment.year ? `
                        <div class="equipment-detail">
                            <span class="detail-label">Year</span>
                            <span class="detail-value">${equipment.year}</span>
                        </div>
                    ` : ''}
                    ${equipment.serial_number ? `
                        <div class="equipment-detail">
                            <span class="detail-label">Serial</span>
                            <span class="detail-value">${equipment.serial_number}</span>
                        </div>
                    ` : ''}
                    ${equipment.hours_used ? `
                        <div class="equipment-detail">
                            <span class="detail-label">Hours</span>
                            <span class="detail-value">${equipment.hours_used.toLocaleString()}</span>
                        </div>
                    ` : ''}
                    ${equipment.assigned_worker_name ? `
                        <div class="equipment-detail">
                            <span class="detail-label">Assigned To</span>
                            <span class="detail-value">${equipment.assigned_worker_name}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            ${equipment.location_address || equipment.assigned_job_id ? `
            <div class="equipment-card-footer">
                <div class="equipment-location">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${equipment.location_address || 
                        (equipment.assigned_job_id ? 
                            (equipment.assigned_job_title ? 
                                `at ${equipment.assigned_job_title}${equipment.assigned_job_location ? ` (${equipment.assigned_job_location})` : ''}` : 
                                'on map') : '')}</span>
                </div>
            </div>
            ` : ''}
        </div>
    `;
}

// Show equipment details modal
async function showEquipmentDetails(equipmentId) {
    try {
        const apiUrl = window.location.hostname === 'localhost' 
            ? `http://localhost:8001/api/equipment/${equipmentId}` 
            : `/api/equipment/${equipmentId}`;
        const response = await fetch(apiUrl, {
            credentials: 'include'
        });
        if (response.ok) {
            currentEquipment = await response.json();
            renderEquipmentDetails();
            document.getElementById('equipmentDetailsModal').style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading equipment details:', error);
    }
}

// Render equipment details
function renderEquipmentDetails() {
    if (!currentEquipment) return;
    
    const equipment = currentEquipment;
    const typeLabel = equipmentLabels[equipment.equipment_type] || 'Other';
    const statusLabel = equipment.status.replace('_', ' ').toUpperCase();
    
    // Set the title with equipment icon
    const equipmentIcon = equipmentIcons[equipment.equipment_type] || 'fas fa-tools';
    document.getElementById('detailsTitle').innerHTML = `<i class="${equipmentIcon}"></i> ${equipment.name}`;
    
    const detailsContainer = document.getElementById('equipmentDetails');
    detailsContainer.innerHTML = `
        <!-- Status Header -->
        <div class="equipment-status-header">
            <div class="status-badge ${equipment.status}">
                <i class="fas fa-circle"></i>
                ${statusLabel}
            </div>
            <div class="equipment-meta">
                <span class="equipment-type">${typeLabel}</span>
                ${equipment.make && equipment.model ? `<span class="equipment-model">${equipment.make} ${equipment.model}</span>` : ''}
            </div>
        </div>

        <!-- Main Content Grid -->
        <div class="equipment-detail-grid">
            <!-- Left Column -->
            <div class="detail-column">
                <!-- Basic Information -->
                <div class="detail-section">
                    <h3><i class="fas fa-info-circle"></i> Equipment Information</h3>
                    <div class="detail-rows">
                        <div class="detail-row">
                            <span class="detail-label">Equipment:</span>
                            <span class="detail-value">${equipment.name}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Type:</span>
                            <span class="detail-value">${typeLabel}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Status:</span>
                            <span class="detail-value">${statusLabel}</span>
                        </div>
                        ${equipment.make ? `
                            <div class="detail-row">
                                <span class="detail-label">Make:</span>
                                <span class="detail-value">${equipment.make}</span>
                            </div>
                        ` : ''}
                        ${equipment.model ? `
                            <div class="detail-row">
                                <span class="detail-label">Model:</span>
                                <span class="detail-value">${equipment.model}</span>
                            </div>
                        ` : ''}
                        ${equipment.year ? `
                            <div class="detail-row">
                                <span class="detail-label">Year:</span>
                                <span class="detail-value">${equipment.year}</span>
                            </div>
                        ` : ''}
                        ${equipment.serial_number ? `
                            <div class="detail-row">
                                <span class="detail-label">Serial Number:</span>
                                <span class="detail-value">${equipment.serial_number}</span>
                            </div>
                        ` : ''}
                        ${equipment.license_plate ? `
                            <div class="detail-row">
                                <span class="detail-label">License Plate:</span>
                                <span class="detail-value">${equipment.license_plate}</span>
                            </div>
                        ` : ''}
                        ${equipment.fuel_type ? `
                            <div class="detail-row">
                                <span class="detail-label">Fuel Type:</span>
                                <span class="detail-value">${equipment.fuel_type.charAt(0).toUpperCase() + equipment.fuel_type.slice(1)}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Usage Information -->
                <div class="detail-section">
                    <h3><i class="fas fa-tachometer-alt"></i> Usage & Performance</h3>
                    <div class="detail-rows">
                        ${equipment.hours_used ? `
                            <div class="detail-row">
                                <span class="detail-label">Hours Used:</span>
                                <span class="detail-value">${equipment.hours_used.toLocaleString()} hours</span>
                            </div>
                        ` : `
                            <div class="detail-row">
                                <span class="detail-label">Hours Used:</span>
                                <span class="detail-value">0 hours</span>
                            </div>
                        `}
                        ${equipment.mileage ? `
                            <div class="detail-row">
                                <span class="detail-label">Mileage:</span>
                                <span class="detail-value">${equipment.mileage.toLocaleString()} miles</span>
                            </div>
                        ` : `
                            <div class="detail-row">
                                <span class="detail-label">Mileage:</span>
                                <span class="detail-value">0 miles</span>
                            </div>
                        `}
                        ${equipment.purchase_price ? `
                            <div class="detail-row">
                                <span class="detail-label">Purchase Price:</span>
                                <span class="detail-value">$${equipment.purchase_price.toLocaleString()}</span>
                            </div>
                        ` : `
                            <div class="detail-row">
                                <span class="detail-label">Purchase Price:</span>
                                <span class="detail-value">$0</span>
                            </div>
                        `}
                    </div>
                </div>

                ${equipment.location_address ? `
                    <div class="detail-section">
                        <h3><i class="fas fa-map-marker-alt"></i> Location</h3>
                        <div class="detail-rows">
                            <div class="detail-row">
                                <span class="detail-label">Address:</span>
                                <span class="detail-value">${equipment.location_address}</span>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>

            <!-- Right Column -->
            <div class="detail-column">
                <!-- Maintenance Timeline -->
                <div class="detail-section">
                    <h3><i class="fas fa-history"></i> Equipment Timeline</h3>
                    <div class="timeline">
                        <div class="timeline-item">
                            <div class="timeline-marker created"></div>
                            <div class="timeline-content">
                                <div class="timeline-title">Equipment Created</div>
                                <div class="timeline-date">${equipment.created_at ? formatDate(equipment.created_at) : 'Unknown'}</div>
                            </div>
                        </div>
                        ${equipment.status === 'maintenance' ? `
                            <div class="timeline-item">
                                <div class="timeline-marker maintenance"></div>
                                <div class="timeline-content">
                                    <div class="timeline-title">Under Maintenance</div>
                                    <div class="timeline-date">Current Status</div>
                                </div>
                            </div>
                        ` : ''}
                        ${equipment.status === 'in_use' ? `
                            <div class="timeline-item">
                                <div class="timeline-marker in-use"></div>
                                <div class="timeline-content">
                                    <div class="timeline-title">Currently In Use</div>
                                    <div class="timeline-date">Active</div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>

                ${equipment.maintenance_notes ? `
                    <div class="detail-section">
                        <h3><i class="fas fa-sticky-note"></i> Maintenance Notes</h3>
                        <div class="notes-content">
                            <p>${equipment.maintenance_notes}</p>
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>

        <!-- Photos and Documents Section -->
        <div class="equipment-detail-grid">
            <!-- Photos Section -->
            <div class="detail-column">
                <div class="detail-section">
                    <h3><i class="fas fa-images"></i> Photos</h3>
                    <div class="photo-gallery">
                        ${equipment.photos && equipment.photos.length > 0 ? 
                            equipment.photos.map(photo => `
                                <div class="photo-item">
                                    <img src="/uploads/${photo.filename}" alt="${photo.originalname}" onclick="openPhotoModal('/uploads/${photo.filename}')">
                                </div>
                            `).join('') : 
                            '<p class="no-items">No photos uploaded</p>'
                        }
                    </div>
                </div>
            </div>

            <!-- Documents Section -->
            <div class="detail-column">
                <div class="detail-section">
                    <h3><i class="fas fa-file-alt"></i> Documents</h3>
                    <div class="document-list">
                        ${equipment.documents && equipment.documents.length > 0 ? 
                            equipment.documents.map(doc => `
                                <div class="document-item">
                                    <i class="${getFileIcon(doc.originalname)}"></i>
                                    <a href="/uploads/${doc.filename}" target="_blank" class="document-link">
                                        ${doc.originalname}
                                    </a>
                                    <span class="document-size">${formatFileSize(doc.size)}</span>
                                </div>
                            `).join('') : 
                            '<p class="no-items">No documents uploaded</p>'
                        }
                    </div>
                </div>
            </div>
        </div>

        <!-- Action Buttons -->
        <div class="equipment-actions">
            <button class="btn btn-primary" onclick="editEquipment()">
                <i class="fas fa-edit"></i>
                Edit Equipment
            </button>
            <button class="btn btn-warning" onclick="showMaintenanceModal(${equipment.id})">
                <i class="fas fa-wrench"></i>
                Request Maintenance
            </button>
            <button class="btn btn-info" onclick="showMaintenanceHistoryModal(${equipment.id})">
                <i class="fas fa-history"></i>
                View History
            </button>
        </div>
    `;
}

// Open add equipment modal
function openAddEquipmentModal() {
    editingEquipment = null;
    document.getElementById('modalTitle').textContent = 'Add Equipment';
    document.getElementById('equipmentForm').reset();
    document.getElementById('equipmentModal').classList.add('show');
}

// Edit equipment
function editEquipment() {
    if (currentEquipment) {
        editEquipmentById(currentEquipment.id);
        closeDetailsModal();
    }
}

// Edit equipment by ID
async function editEquipmentById(equipmentId) {
    try {
        const apiUrl = window.location.hostname === 'localhost' 
            ? `http://localhost:8001/api/equipment/${equipmentId}` 
            : `/api/equipment/${equipmentId}`;
        const response = await fetch(apiUrl, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (response.ok) {
            editingEquipment = await response.json();
            populateEquipmentForm(editingEquipment);
            document.getElementById('modalTitle').textContent = 'Edit Equipment';
            document.getElementById('equipmentModal').classList.add('show');
        }
    } catch (error) {
        console.error('Error loading equipment for editing:', error);
    }
}

// Populate equipment form
function populateEquipmentForm(equipment) {
    const form = document.getElementById('equipmentForm');
    if (equipment && typeof equipment === 'object' && equipment !== null) {
        try {
            Object.keys(equipment).forEach(key => {
                const input = form.querySelector(`[name="${key}"]`);
                if (input && equipment[key] !== null && equipment[key] !== undefined) {
                    input.value = equipment[key];
                }
            });
        } catch (error) {
            console.error('Error populating equipment form:', error);
        }
    }
}

// Handle equipment form submission
async function handleEquipmentSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    try {
        let response;
        if (editingEquipment) {
            const apiUrl = window.location.hostname === 'localhost' 
                ? `http://localhost:8001/api/equipment/${editingEquipment.id}` 
                : `/api/equipment/${editingEquipment.id}`;
            response = await fetch(apiUrl, {
                method: 'PUT',
                body: formData,
                credentials: 'include'
            });
        } else {
            const apiUrl = window.location.hostname === 'localhost' 
                ? 'http://localhost:8001/api/equipment' 
                : '/api/equipment';
            response = await fetch(apiUrl, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
        }
        
        if (response.ok) {
            closeEquipmentModal();
            loadEquipment();
            showNotification(editingEquipment ? 'Equipment updated successfully!' : 'Equipment added successfully!');
        } else {
            showNotification('Error saving equipment', 'error');
        }
    } catch (error) {
        console.error('Error saving equipment:', error);
        showNotification('Error saving equipment', 'error');
    }
}

// Delete equipment
async function deleteEquipment(equipmentId) {
    if (confirm('Are you sure you want to delete this equipment?')) {
        try {
            const apiUrl = window.location.hostname === 'localhost' 
                ? `http://localhost:8001/api/equipment/${equipmentId}` 
                : `/api/equipment/${equipmentId}`;
            const response = await fetch(apiUrl, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            if (response.ok) {
                loadEquipment();
                closeDetailsModal();
                showNotification('Equipment deleted successfully!');
            } else {
                showNotification('Error deleting equipment', 'error');
            }
        } catch (error) {
            console.error('Error deleting equipment:', error);
            showNotification('Error deleting equipment', 'error');
        }
    }
}

// Close equipment modal
function closeEquipmentModal() {
    document.getElementById('equipmentModal').classList.remove('show');
    editingEquipment = null;
}

// Close details modal
function closeDetailsModal() {
    document.getElementById('equipmentDetailsModal').style.display = 'none';
    currentEquipment = null;
}

// Show maintenance request modal
async function showMaintenanceModal(equipmentId) {
    const equipment = equipmentData.find(e => e.id === equipmentId);
    if (!equipment) return;

    // Set the current maintenance equipment for use in submitMaintenanceRequest
    currentMaintenanceEquipment = equipment;

    const modal = document.getElementById('maintenanceModal');
    const form = document.getElementById('maintenanceForm');
    
    // Reset form
    form.reset();
    
    // Set equipment info
    document.getElementById('maintenanceEquipmentName').textContent = equipment.name;
    document.getElementById('maintenanceEquipmentId').value = equipmentId;
    
    // Load workers for assignment dropdown
    await loadWorkersForMaintenance();
    
    modal.style.display = 'block';
}

// Load workers for maintenance assignment
async function loadWorkersForMaintenance() {
    try {
        const apiUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:8001/api/workers' 
            : '/api/workers';
        const response = await fetch(apiUrl, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (response.ok) {
            const workers = await response.json();
            const workerSelect = document.getElementById('assignedWorker');
            
            if (!workerSelect) {
                console.warn('Worker select element not found');
                return;
            }
            
            workerSelect.innerHTML = '<option value="">Select Worker</option>';
            
            workers.forEach(worker => {
                    const option = document.createElement('option');
                    option.value = worker.id;
                    // Handle roles array - get the first role or default to 'Worker'
                    const role = worker.roles && Array.isArray(worker.roles) && worker.roles.length > 0 
                        ? worker.roles[0] 
                        : 'Worker';
                    option.textContent = `${worker.name} - ${role}`;
                    workerSelect.appendChild(option);
                });
        }
    } catch (error) {
        console.error('Error loading workers:', error);
    }
}

// Submit maintenance request
async function submitMaintenanceRequest() {
    const form = document.getElementById('maintenanceForm');
    const formData = new FormData(form);
    
    if (!currentMaintenanceEquipment || !currentMaintenanceEquipment.id) {
        console.error('No equipment selected for maintenance');
        showNotification('Error: No equipment selected for maintenance', 'error');
        return;
    }
    
    const maintenanceData = {
        equipment_id: currentMaintenanceEquipment.id,
        type: formData.get('type'),
        priority: formData.get('priority'),
        title: formData.get('description') ? formData.get('description').substring(0, 100) : 'Maintenance Request',
        description: formData.get('description'),
        assigned_worker_id: formData.get('assignedWorker') || null,
        due_date: formData.get('scheduledDate') || null
    };
    
    try {
        const apiUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:8001/api/maintenance-requests' 
            : '/api/maintenance-requests';
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(maintenanceData),
            credentials: 'include'
        });
        
        if (response.ok) {
            hideMaintenanceModal();
            showNotification('Maintenance request submitted successfully!');
            loadEquipment(); // Refresh equipment data
        } else {
            const error = await response.text();
            showNotification(`Error submitting maintenance request: ${error}`, 'error');
        }
    } catch (error) {
        console.error('Error submitting maintenance request:', error);
        showNotification('Error submitting maintenance request', 'error');
    }
}

// Update equipment status
async function updateEquipmentStatus(equipmentId, status) {
    try {
        const apiUrl = window.location.hostname === 'localhost' 
            ? `http://localhost:8001/api/equipment/${equipmentId}` 
            : `/api/equipment/${equipmentId}`;
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status }),
            credentials: 'include'
        });
        
        if (response.ok) {
            loadEquipment();
            showNotification('Equipment status updated successfully!');
        } else {
            showNotification('Error updating equipment status', 'error');
        }
    } catch (error) {
        console.error('Error updating equipment status:', error);
        showNotification('Error updating equipment status', 'error');
    }
}

// Hide maintenance modal
function hideMaintenanceModal() {
    const modal = document.getElementById('maintenanceModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        font-weight: 500;
        max-width: 400px;
        word-wrap: break-word;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 4000);
}

// File upload preview functions
function previewPhotos(input) {
    const preview = document.getElementById('photoPreview');
    preview.innerHTML = '';
    
    if (input.files) {
        Array.from(input.files).forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const photoItem = document.createElement('div');
                photoItem.className = 'photo-preview-item';
                photoItem.innerHTML = `
                    <img src="${e.target.result}" alt="Preview">
                    <button type="button" class="file-remove-btn" onclick="removeFile('equipmentPhotos', ${index})">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                preview.appendChild(photoItem);
            };
            reader.readAsDataURL(file);
        });
    }
}

function previewDocuments(input) {
    const preview = document.getElementById('documentPreview');
    preview.innerHTML = '';
    
    if (input.files) {
        Array.from(input.files).forEach((file, index) => {
            const docItem = document.createElement('div');
            docItem.className = 'document-preview-item';
            
            const icon = getFileIcon(file.name);
            docItem.innerHTML = `
                <i class="${icon}"></i>
                <span>${file.name}</span>
                <button type="button" class="file-remove-btn" onclick="removeFile('equipmentDocuments', ${index})" style="position: relative; top: 0; right: 0; margin-left: auto;">
                    <i class="fas fa-times"></i>
                </button>
            `;
            preview.appendChild(docItem);
        });
    }
}

function getFileIcon(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    switch (extension) {
        case 'pdf':
            return 'fas fa-file-pdf';
        case 'doc':
        case 'docx':
            return 'fas fa-file-word';
        case 'txt':
            return 'fas fa-file-alt';
        default:
            return 'fas fa-file';
    }
}

function removeFile(inputId, index) {
    const input = document.getElementById(inputId);
    const files = Array.from(input.files);
    
    // Create new FileList without the removed file
    const dt = new DataTransfer();
    files.forEach((file, i) => {
        if (i !== index) {
            dt.items.add(file);
        }
    });
    
    input.files = dt.files;
    
    // Update preview
    if (inputId === 'equipmentPhotos') {
        previewPhotos(input);
    } else if (inputId === 'equipmentDocuments') {
        previewDocuments(input);
    }
}

// Maintenance Event Listeners Setup
function setupMaintenanceEventListeners() {
    // Maintenance history modal close
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal') && e.target.id === 'maintenanceHistoryModal') {
            closeMaintenanceHistoryModal();
        }
    });
    
    // Maintenance log modal close
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal') && e.target.id === 'maintenanceLogModal') {
            closeMaintenanceLogModal();
        }
    });
}

// Show Maintenance History Modal
async function showMaintenanceHistoryModal(equipmentId) {
    currentMaintenanceEquipment = equipmentData.find(eq => eq.id === equipmentId);
    if (!currentMaintenanceEquipment) return;
    
    // Update equipment info in modal
    document.getElementById('maintenanceEquipmentName').textContent = currentMaintenanceEquipment.name;
    document.getElementById('maintenanceEquipmentType').textContent = equipmentLabels[currentMaintenanceEquipment.type] || currentMaintenanceEquipment.type;
    
    // Load maintenance history
    await loadMaintenanceHistory(equipmentId);
    
    // Show modal
    document.getElementById('maintenanceHistoryModal').style.display = 'block';
}

// Load Maintenance History
async function loadMaintenanceHistory(equipmentId) {
    try {
        const response = await fetch(`/api/equipment/${equipmentId}/maintenance`, {
            credentials: 'include'
        });
        if (response.ok) {
            maintenanceHistory = await response.json();
        } else {
            maintenanceHistory = [];
            showNotification('Failed to load maintenance history from server', 'error');
        }
        
        renderMaintenanceHistory();
        updateMaintenanceStats();
    } catch (error) {
        console.error('Error loading maintenance history:', error);
        showNotification('Error loading maintenance history', 'error');
    }
}

// Render Maintenance History
function renderMaintenanceHistory() {
    const timeline = document.getElementById('maintenanceTimeline');
    
    if (maintenanceHistory.length === 0) {
        timeline.innerHTML = `
            <div class="empty-timeline">
                <i class="fas fa-wrench"></i>
                <h3>No Maintenance History</h3>
                <p>No maintenance records found for this equipment.</p>
            </div>
        `;
        return;
    }
    
    // Sort by date (newest first)
    const sortedHistory = [...maintenanceHistory].sort((a, b) => 
        new Date(b.requestDate) - new Date(a.requestDate)
    );
    
    timeline.innerHTML = sortedHistory.map(entry => `
        <div class="timeline-entry ${entry.status}">
            <div class="timeline-icon ${entry.status}">
                <i class="${maintenanceIcons[entry.type] || 'fas fa-wrench'}"></i>
            </div>
            <div class="timeline-content">
                <div class="timeline-header">
                    <h4 class="timeline-title">${entry.title}</h4>
                    <span class="timeline-date">${formatDate(entry.requestDate)}</span>
                </div>
                <p class="timeline-description">${entry.description}</p>
                <div class="timeline-meta">
                    <span><i class="fas fa-user"></i> ${entry.assignedWorker}</span>
                    <span><i class="fas fa-flag"></i> ${entry.priority}</span>
                    <span class="status-badge ${entry.status}">${entry.status}</span>
                    ${entry.cost ? `<span><i class="fas fa-dollar-sign"></i> $${entry.cost.toFixed(2)}</span>` : ''}
                </div>
                ${entry.notes ? `<p class="timeline-description"><strong>Notes:</strong> ${entry.notes}</p>` : ''}
                <div class="timeline-actions">
                    <button class="btn btn-sm btn-secondary" onclick="viewMaintenanceDetails(${entry.id})">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                    ${entry.status === 'pending' ? `
                        <button class="btn btn-sm btn-primary" onclick="updateMaintenanceStatus(${entry.id}, 'in-progress')">
                            <i class="fas fa-play"></i> Start Work
                        </button>
                    ` : ''}
                    ${entry.status === 'in-progress' ? `
                        <button class="btn btn-sm btn-success" onclick="handleCompleteMaintenanceWork(${entry.id})">
                            <i class="fas fa-check"></i> Complete
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

// Update Maintenance Stats
function updateMaintenanceStats() {
    const stats = {
        total: maintenanceHistory.length,
        pending: maintenanceHistory.filter(m => m.status === 'pending').length,
        inProgress: maintenanceHistory.filter(m => m.status === 'in-progress').length,
        completed: maintenanceHistory.filter(m => m.status === 'completed').length,
        totalCost: maintenanceHistory.reduce((sum, m) => sum + (m.cost || 0), 0)
    };
    
    document.getElementById('maintenanceStats').innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${stats.total}</div>
            <div class="stat-label">Total Records</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.pending}</div>
            <div class="stat-label">Pending</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.inProgress}</div>
            <div class="stat-label">In Progress</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.completed}</div>
            <div class="stat-label">Completed</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">$${stats.totalCost.toFixed(2)}</div>
            <div class="stat-label">Total Cost</div>
        </div>
    `;
}

// Show Maintenance Log Modal
function showMaintenanceLogModal() {
    document.getElementById('maintenanceLogModal').style.display = 'block';
}

// Close Maintenance History Modal
function closeMaintenanceHistoryModal() {
    document.getElementById('maintenanceHistoryModal').style.display = 'none';
    currentMaintenanceEquipment = null;
}

// Close Maintenance Log Modal
function closeMaintenanceLogModal() {
    document.getElementById('maintenanceLogModal').style.display = 'none';
    document.getElementById('maintenanceLogForm').reset();
}

// Submit Maintenance Log
async function submitMaintenanceLog() {
    const form = document.getElementById('maintenanceLogForm');
    const formData = new FormData(form);
    
    const logData = {
        equipmentId: currentMaintenanceEquipment.id,
        type: formData.get('logType'),
        title: formData.get('logTitle'),
        description: formData.get('logDescription'),
        priority: formData.get('logPriority'),
        assignedWorker: formData.get('logAssignedWorker'),
        scheduledDate: formData.get('logScheduledDate'),
        estimatedCost: parseFloat(formData.get('logEstimatedCost')) || 0,
        status: 'pending',
        requestDate: new Date().toISOString().split('T')[0]
    };
    
    try {
        const response = await fetch('/api/maintenance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(logData)
        });
        
        if (response.ok) {
            showNotification('Maintenance log created successfully');
            closeMaintenanceLogModal();
            await loadMaintenanceHistory(currentMaintenanceEquipment.id);
        } else {
            throw new Error('Failed to create maintenance log');
        }
    } catch (error) {
        console.error('Error creating maintenance log:', error);
        showNotification('Error creating maintenance log', 'error');
    }
}

// Update Maintenance Status
async function updateMaintenanceStatus(maintenanceId, newStatus) {
    try {
        const response = await fetch(`/api/maintenance/${maintenanceId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.ok) {
            showNotification(`Maintenance status updated to ${newStatus}`);
            await loadMaintenanceHistory(currentMaintenanceEquipment.id);
        } else {
            throw new Error('Failed to update maintenance status');
        }
    } catch (error) {
        console.error('Error updating maintenance status:', error);
        showNotification('Error updating maintenance status', 'error');
    }
}

// Complete Maintenance Work
// Wrapper function for HTML onclick handlers
function handleCompleteMaintenanceWork(maintenanceId) {
    completeMaintenanceWork(maintenanceId).catch(error => {
        console.error('Error completing maintenance work:', error);
        showNotification('Failed to complete maintenance work. Please try again.', 'error');
    });
}

async function completeMaintenanceWork(maintenanceId) {
    try {
        const notes = await showInputDialog('Completion Notes', 'Enter completion notes (optional):', 'Describe the work completed...');
        if (notes === null) return; // User cancelled
        
        const costInput = await showInputDialog('Actual Cost', 'Enter actual cost (optional):', '0.00');
        if (costInput === null) return; // User cancelled
        
        const cost = costInput && costInput.trim() !== '' ? parseFloat(costInput) : undefined;
        
        const updateData = {
            status: 'completed',
            completedDate: new Date().toISOString().split('T')[0],
            notes: notes || '',
            cost: cost
        };
        
        const response = await fetch(`/api/maintenance/${maintenanceId}/complete`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (response.ok) {
            showNotification('Maintenance work completed successfully');
            await loadMaintenanceHistory(currentMaintenanceEquipment.id);
        } else {
            throw new Error('Failed to complete maintenance work');
        }
    } catch (error) {
        console.error('Error completing maintenance work:', error);
        showNotification('Error completing maintenance work', 'error');
    }
}

// View Maintenance Details
function viewMaintenanceDetails(maintenanceId) {
    const maintenance = maintenanceHistory.find(m => m.id === maintenanceId);
    if (!maintenance) return;
    
    alert(`Maintenance Details:\n\nTitle: ${maintenance.title}\nType: ${maintenance.type}\nStatus: ${maintenance.status}\nPriority: ${maintenance.priority}\nAssigned Worker: ${maintenance.assignedWorker}\nRequest Date: ${maintenance.requestDate}\n${maintenance.completedDate ? `Completed Date: ${maintenance.completedDate}\n` : ''}${maintenance.cost ? `Cost: $${maintenance.cost.toFixed(2)}\n` : ''}Description: ${maintenance.description}\n${maintenance.notes ? `Notes: ${maintenance.notes}` : ''}`);
}

// Format Date Helper
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format file size for display
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Open photo modal for full-size viewing
function openPhotoModal(photoUrl) {
    const modal = document.createElement('div');
    modal.className = 'photo-modal';
    modal.innerHTML = `
        <div class="photo-modal-content">
            <span class="photo-modal-close" onclick="closePhotoModal()">&times;</span>
            <img src="${photoUrl}" alt="Equipment Photo">
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
}

// Close photo modal
function closePhotoModal() {
    const modal = document.querySelector('.photo-modal');
    if (modal) {
        modal.remove();
    }
}