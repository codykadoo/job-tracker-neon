// Equipment Management JavaScript

let equipmentData = [];
let filteredEquipment = [];
let currentEquipment = null;
let editingEquipment = null;
let maintenanceHistory = [];
let currentMaintenanceEquipment = null;

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
document.addEventListener('DOMContentLoaded', function() {
    loadEquipment();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    document.getElementById('searchInput').addEventListener('input', filterEquipment);
    
    // Filter functionality
    document.getElementById('typeFilter').addEventListener('change', filterEquipment);
    document.getElementById('statusFilter').addEventListener('change', filterEquipment);
    
    // Category tabs
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            setActiveCategory(this.dataset.category);
        });
    });
    
    // Add equipment button
    document.getElementById('addEquipmentBtn').addEventListener('click', openAddEquipmentModal);
    
    // Equipment form submission
    document.getElementById('equipmentForm').addEventListener('submit', handleEquipmentSubmit);
    
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
        const response = await fetch('http://localhost:8001/api/equipment');
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
    
    document.getElementById('totalEquipment').textContent = total;
    document.getElementById('availableEquipment').textContent = available;
    document.getElementById('inUseEquipment').textContent = inUse;
    document.getElementById('maintenanceEquipment').textContent = maintenance;
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
    
    if (filteredEquipment.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    grid.style.display = 'grid';
    emptyState.style.display = 'none';
    
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
            <div class="equipment-card-footer">
                <div class="equipment-location">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${equipment.location_address || 
                        (equipment.assigned_job_id ? 
                            (equipment.assigned_job_title ? 
                                `at ${equipment.assigned_job_title}${equipment.assigned_job_location ? ` (${equipment.assigned_job_location})` : ''}` : 
                                'on map') : 
                            'No location set')}</span>
                </div>
                <div class="equipment-actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); editEquipmentById(${equipment.id})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="event.stopPropagation(); deleteEquipment(${equipment.id})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Show equipment details modal
async function showEquipmentDetails(equipmentId) {
    try {
        const response = await fetch(`http://localhost:8001/api/equipment/${equipmentId}`);
        if (response.ok) {
            currentEquipment = await response.json();
            renderEquipmentDetails();
            document.getElementById('equipmentDetailsModal').classList.add('show');
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
        const response = await fetch(`http://localhost:8001/api/equipment/${equipmentId}`);
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
            response = await fetch(`http://localhost:8001/api/equipment/${editingEquipment.id}`, {
                method: 'PUT',
                body: formData // Send FormData directly for file uploads
            });
        } else {
            response = await fetch('http://localhost:8001/api/equipment', {
                method: 'POST',
                body: formData // Send FormData directly for file uploads
            });
        }
        
        if (response.ok) {
            showNotification(editingEquipment ? 'Equipment updated successfully!' : 'Equipment created successfully!');
            closeEquipmentModal();
            loadEquipment();
        } else {
            const error = await response.json();
            showNotification('Error saving equipment: ' + error.error, 'error');
        }
    } catch (error) {
        console.error('Error saving equipment:', error);
        showNotification('Error saving equipment. Please try again.', 'error');
    }
}

// Delete equipment
async function deleteEquipment(equipmentId) {
    if (!confirm('Are you sure you want to delete this equipment? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`http://localhost:8001/api/equipment/${equipmentId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadEquipment();
        } else {
            const error = await response.json();
            alert('Error deleting equipment: ' + error.error);
        }
    } catch (error) {
        console.error('Error deleting equipment:', error);
        alert('Error deleting equipment. Please try again.');
    }
}

// Close equipment modal
function closeEquipmentModal() {
    document.getElementById('equipmentModal').classList.remove('show');
    editingEquipment = null;
}

// Close details modal
function closeDetailsModal() {
    document.getElementById('equipmentDetailsModal').classList.remove('show');
    currentEquipment = null;
}

// Show maintenance request modal
async function showMaintenanceModal(equipmentId) {
    const equipment = equipmentData.find(e => e.id === equipmentId);
    if (!equipment) return;

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
        const response = await fetch('http://localhost:8001/api/workers');
        const workers = await response.json();
        
        const assignedWorkerSelect = document.getElementById('maintenanceAssignedWorker');
        if (assignedWorkerSelect) {
            // Clear existing options
            assignedWorkerSelect.innerHTML = '<option value="">Select Worker (Optional)</option>';
            
            // Add worker options - filter for maintenance-capable roles
            workers.forEach(worker => {
                const workerRoles = Array.isArray(worker.roles) ? worker.roles : (worker.role ? [worker.role] : ['Apprentice']);
                const canDoMaintenance = workerRoles.some(role => 
                    ['Mechanic', 'Technician', 'Supervisor', 'Foreman', 'Lead'].includes(role)
                );
                
                if (canDoMaintenance || workerRoles.includes('Apprentice')) {
                    const option = document.createElement('option');
                    option.value = worker.id;
                    option.textContent = `${worker.name} (${workerRoles.join(', ')})`;
                    assignedWorkerSelect.appendChild(option);
                }
            });
        }
    } catch (error) {
        console.error('Error loading workers for maintenance:', error);
    }
}

// Submit maintenance request
async function submitMaintenanceRequest() {
    const form = document.getElementById('maintenanceForm');
    const formData = new FormData(form);
    
    const maintenanceData = {
        equipmentId: parseInt(formData.get('equipmentId')),
        request_type: formData.get('type'),
        priority: formData.get('priority'),
        title: `${formData.get('type')} Request`,
        description: formData.get('description'),
        requested_by_worker_id: null,
        assigned_to_worker_id: formData.get('assignedWorker') || null,
        status: 'pending',
        requestedDate: new Date().toISOString()
    };

    try {
        const response = await fetch(`http://localhost:8001/api/equipment/${maintenanceData.equipmentId}/maintenance-requests`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(maintenanceData)
        });

        if (response.ok) {
            const result = await response.json();
            showNotification('Maintenance request submitted successfully');
            hideMaintenanceModal();
            
            // Update equipment status if it's a repair request
            if (maintenanceData.type === 'repair') {
                await updateEquipmentStatus(maintenanceData.equipmentId, 'maintenance');
            }
            
            // Refresh equipment data
            await loadEquipment();
        } else {
            throw new Error('Failed to submit maintenance request');
        }
    } catch (error) {
        console.error('Error submitting maintenance request:', error);
        showNotification('Error submitting maintenance request', 'error');
    }
}

// Update equipment status
async function updateEquipmentStatus(equipmentId, status) {
    try {
        const response = await fetch(`http://localhost:8001/api/equipment/${equipmentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });

        if (!response.ok) {
            throw new Error('Failed to update equipment status');
        }
    } catch (error) {
        console.error('Error updating equipment status:', error);
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
        const response = await fetch(`/api/equipment/${equipmentId}/maintenance`);
        if (response.ok) {
            maintenanceHistory = await response.json();
        } else {
            // Mock data for demonstration
            maintenanceHistory = [
                {
                    id: 1,
                    type: 'maintenance',
                    title: 'Routine Oil Change',
                    description: 'Changed engine oil and filter. Checked fluid levels.',
                    status: 'completed',
                    priority: 'medium',
                    assignedWorker: 'John Smith',
                    requestDate: '2024-01-15',
                    completedDate: '2024-01-16',
                    cost: 150.00,
                    notes: 'All systems running normally'
                },
                {
                    id: 2,
                    type: 'repair',
                    title: 'Hydraulic Leak Repair',
                    description: 'Fixed hydraulic line leak on left arm cylinder.',
                    status: 'completed',
                    priority: 'high',
                    assignedWorker: 'Mike Johnson',
                    requestDate: '2024-01-10',
                    completedDate: '2024-01-12',
                    cost: 450.00,
                    notes: 'Replaced damaged hydraulic line and seals'
                },
                {
                    id: 3,
                    type: 'inspection',
                    title: 'Monthly Safety Inspection',
                    description: 'Comprehensive safety and operational inspection.',
                    status: 'pending',
                    priority: 'medium',
                    assignedWorker: 'Sarah Davis',
                    requestDate: '2024-01-20',
                    scheduledDate: '2024-01-25'
                }
            ];
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
                        <button class="btn btn-sm btn-success" onclick="completeMaintenanceWork(${entry.id})">
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
async function completeMaintenanceWork(maintenanceId) {
    const notes = prompt('Enter completion notes (optional):');
    const cost = prompt('Enter actual cost (optional):');
    
    const updateData = {
        status: 'completed',
        completedDate: new Date().toISOString().split('T')[0],
        notes: notes || '',
        cost: cost ? parseFloat(cost) : undefined
    };
    
    try {
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