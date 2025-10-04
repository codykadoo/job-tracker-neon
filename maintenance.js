// Maintenance Management JavaScript

// Reports and Analytics System
let reportsData = {
    currentPeriod: 30,
    startDate: null,
    endDate: null,
    filteredRequests: [],
    previousPeriodData: null
};

let maintenanceRequests = [];
let filteredRequests = [];
let equipment = [];
let workers = [];
let currentView = 'grid';
let currentDate = new Date();
let expandedRequests = new Set();

// Initialize the page
async function initializePage() {
    console.log('Initializing page...');
    await loadMaintenanceRequests();
    console.log('After loading requests:', maintenanceRequests.length, 'requests');
    await loadEquipment();
    await loadWorkers();
    
    // Initialize filteredRequests with all requests
    filteredRequests = [...maintenanceRequests];
    console.log('Filtered requests initialized:', filteredRequests.length, 'requests');
    
    updateStats();
    populateFilters();
    renderRequests();
    setupEventListeners();
    setupViewToggle();
    setupRecurringOptions();
    initializeCalendar();
    initializeNotificationSystem();
    initializeReportsSystem();
    setupEnhancedControls();
}

// Export maintenance data to CSV
function exportMaintenanceData() {
    const headers = ['ID', 'Title', 'Equipment', 'Priority', 'Status', 'Assigned Worker', 'Created Date', 'Due Date', 'Cost', 'Description'];
    const csvContent = [
        headers.join(','),
        ...filteredRequests.map(request => [
            request.id,
            `"${request.title}"`,
            `"${getEquipmentName(request.equipmentId)}"`,
            request.priority,
            request.status,
            `"${request.assignedWorker || 'Unassigned'}"`,
            new Date(request.createdAt).toLocaleDateString(),
            request.dueDate ? new Date(request.dueDate).toLocaleDateString() : 'Not set',
            request.cost || '0',
            `"${request.description || ''}"`
        ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maintenance-requests-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showNotification('Maintenance data exported successfully', 'success');
}

// Clear search input
function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
        filterRequests();
        showNotification('Search cleared', 'info');
    }
}

// Clear all filters
function clearAllFilters() {
    // Clear search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    
    // Clear status filter
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) statusFilter.value = '';
    
    // Clear priority filter
    const priorityFilter = document.getElementById('priorityFilter');
    if (priorityFilter) priorityFilter.value = '';
    
    // Clear equipment filter
    const equipmentFilter = document.getElementById('equipmentFilter');
    if (equipmentFilter) equipmentFilter.value = '';
    
    // Clear worker filter
    const workerFilter = document.getElementById('workerFilter');
    if (workerFilter) workerFilter.value = '';
    
    // Clear date range filters
    const startDateFilter = document.getElementById('startDate');
    if (startDateFilter) startDateFilter.value = '';
    
    const endDateFilter = document.getElementById('endDate');
    if (endDateFilter) endDateFilter.value = '';
    
    // Apply filters
    filterRequests();
    showNotification('All filters cleared', 'info');
}

// Set view mode (called from HTML buttons)
function setView(viewType) {
    currentView = viewType;
    
    // Update active button
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`[data-view="${viewType}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    
    // Update grid container class
    const grid = document.getElementById('maintenanceGrid');
    if (grid) {
        grid.className = viewType === 'grid' ? 'maintenance-grid' : 'maintenance-list';
    }
    
    // Re-render requests with new view
    renderRequests();
    showNotification(`Switched to ${viewType} view`, 'info');
}

// Toggle between grid and list views
function toggleView(viewType) {
    currentView = viewType;
    
    // Update button states
    const gridBtn = document.querySelector('.view-toggle .btn:first-child');
    const listBtn = document.querySelector('.view-toggle .btn:last-child');
    
    if (gridBtn && listBtn) {
        gridBtn.classList.toggle('active', viewType === 'grid');
        listBtn.classList.toggle('active', viewType === 'list');
    }
    
    // Update grid container class
    const grid = document.getElementById('maintenanceGrid');
    if (grid) {
        grid.className = viewType === 'grid' ? 'maintenance-grid' : 'maintenance-list';
    }
    
    // Re-render requests with new view
    renderRequests();
    showNotification(`Switched to ${viewType} view`, 'info');
}

// Setup enhanced controls event listeners
function setupEnhancedControls() {
    // Export button
    const exportBtn = document.querySelector('.btn-export');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportMaintenanceData);
    }
    
    // Clear search button
    const clearSearchBtn = document.querySelector('.clear-search');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', clearSearch);
    }
    
    // Clear filters button
    const clearFiltersBtn = document.querySelector('.clear-filters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearAllFilters);
    }
    
    // View toggle buttons
    const viewToggleBtns = document.querySelectorAll('.view-toggle .btn');
    viewToggleBtns.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            toggleView(index === 0 ? 'grid' : 'list');
        });
    });
}

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

    initializePage();
});

// Load initial data
async function loadInitialData() {
    try {
        await Promise.all([
            loadMaintenanceRequests(),
            loadEquipment(),
            loadWorkers()
        ]);
        
        updateStats();
        renderRequests();
        populateFilters();
    } catch (error) {
        console.error('Error loading initial data:', error);
        showNotification('Error loading data', 'error');
    }
}

// Load maintenance requests
async function loadMaintenanceRequests() {
    try {
        const apiUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:8001/api/maintenance-requests' 
            : '/api/maintenance-requests';
        const response = await fetch(apiUrl, {
            credentials: 'include'
        });
        if (response.ok) {
            maintenanceRequests = await response.json();
            console.log('Loaded from API:', maintenanceRequests.length, 'requests');
        } else {
            maintenanceRequests = [];
            showNotification('Failed to load maintenance requests from server', 'error');
        }
        
        filteredRequests = [...maintenanceRequests];
    } catch (error) {
        console.error('Error loading maintenance requests:', error);
        throw error;
    }
}

// Load equipment
async function loadEquipment() {
    try {
        const apiUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:8001/api/equipment' 
            : '/api/equipment';
        const response = await fetch(apiUrl, {
            credentials: 'include'
        });
        if (response.ok) {
            equipment = await response.json();
        } else {
            equipment = [];
            showNotification('Failed to load equipment from server', 'error');
        }
    } catch (error) {
        console.error('Error loading equipment:', error);
        throw error;
    }
}

// Load workers
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
            showNotification('Failed to load workers from server', 'error');
        }
    } catch (error) {
        console.error('Error loading workers:', error);
        throw error;
    }
}

// Update statistics
function updateStats() {
    const pending = maintenanceRequests.filter(r => r.status === 'pending').length;
    const inProgress = maintenanceRequests.filter(r => r.status === 'in_progress').length;
    const urgent = maintenanceRequests.filter(r => r.priority === 'urgent' && r.status !== 'completed').length;
    
    // Completed this month
    const thisMonth = new Date();
    const completed = maintenanceRequests.filter(r => {
        if (r.status !== 'completed' || !r.completed_at) return false;
        const completedDate = new Date(r.completed_at);
        return completedDate.getMonth() === thisMonth.getMonth() && 
               completedDate.getFullYear() === thisMonth.getFullYear();
    }).length;
    
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('inProgressCount').textContent = inProgress;
    document.getElementById('urgentCount').textContent = urgent;
    document.getElementById('completedCount').textContent = completed;
}

// Populate filter dropdowns
function populateFilters() {
    // Populate worker filter
    const workerFilter = document.getElementById('workerFilter');
    workerFilter.innerHTML = '<option value="">All Workers</option>';
    workers.forEach(worker => {
        const option = document.createElement('option');
        option.value = worker.id;
        option.textContent = worker.name;
        workerFilter.appendChild(option);
    });
    
    // Populate equipment dropdown in new request modal
    const equipmentSelect = document.getElementById('requestEquipment');
    equipmentSelect.innerHTML = '<option value="">Select Equipment</option>';
    equipment.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        equipmentSelect.appendChild(option);
    });
    
    // Populate assigned worker dropdown in new request modal
    const assignedWorkerSelect = document.getElementById('requestAssignedWorker');
    assignedWorkerSelect.innerHTML = '<option value="">Select Worker (Optional)</option>';
    workers.forEach(worker => {
        const option = document.createElement('option');
        option.value = worker.id;
        // Handle roles array - get the first role or default to 'Worker'
        const role = worker.roles && Array.isArray(worker.roles) && worker.roles.length > 0 
            ? worker.roles[0] 
            : 'Worker';
        option.textContent = `${worker.name} (${role})`;
        assignedWorkerSelect.appendChild(option);
    });
}

// Filter requests
function filterRequests() {
    const statusFilter = document.getElementById('statusFilter').value;
    const priorityFilter = document.getElementById('priorityFilter').value;
    const typeFilter = document.getElementById('typeFilter').value;
    const workerFilter = document.getElementById('workerFilter').value;
    const searchFilter = document.getElementById('searchFilter').value.toLowerCase();
    
    filteredRequests = maintenanceRequests.filter(request => {
        if (statusFilter && request.status !== statusFilter) return false;
        if (priorityFilter && request.priority !== priorityFilter) return false;
        if (typeFilter && request.request_type !== typeFilter) return false;
        if (workerFilter && request.assigned_to_worker_id != workerFilter) return false;
        if (searchFilter && !request.title.toLowerCase().includes(searchFilter) && 
            !request.description.toLowerCase().includes(searchFilter)) return false;
        
        return true;
    });
    
    renderRequests();
}

// Sort requests
function sortRequests() {
    const sortBy = document.getElementById('sortBy').value;
    
    filteredRequests.sort((a, b) => {
        switch (sortBy) {
            case 'created_at':
                return new Date(b.created_at) - new Date(a.created_at);
            case 'due_date':
                if (!a.due_date && !b.due_date) return 0;
                if (!a.due_date) return 1;
                if (!b.due_date) return -1;
                return new Date(a.due_date) - new Date(b.due_date);
            case 'priority':
                const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            case 'status':
                const statusOrder = { pending: 0, in_progress: 1, completed: 2, cancelled: 3 };
                return statusOrder[a.status] - statusOrder[b.status];
            default:
                return 0;
        }
    });
    
    renderRequests();
}

// Render requests list
function renderRequests() {
    const requestsList = document.getElementById('maintenanceGrid');
    
    if (!requestsList) {
        console.error('maintenanceGrid element not found');
        return;
    }
    
    console.log('Rendering requests:', filteredRequests.length, 'requests');
    console.log('First request:', filteredRequests[0]);
    
    if (filteredRequests.length === 0) {
        requestsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-list"></i>
                <h3>No maintenance requests found</h3>
                <p>Try adjusting your filters or create a new request</p>
            </div>
        `;
        return;
    }
    
    requestsList.innerHTML = filteredRequests.map(request => {
        console.log('Rendering request:', request.id, request.title);
        return `
        <div class="request-card ${request.status} ${request.priority === 'high' ? 'high-priority' : ''} ${request.is_overdue ? 'overdue' : ''} ${request.is_recurring ? 'recurring' : ''} ${expandedRequests.has(request.id) ? 'expanded' : ''}" onclick="showRequestDetails(${request.id})">
            <div class="request-header">
                <div class="request-title">
                    <h3>${request.title}</h3>
                    <div class="request-badges">
                        <span class="badge status-${request.status}">${STATUS_LABELS[request.status] || request.status}</span>
                        <span class="badge priority-${request.priority}">${request.priority}</span>
                        ${request.request_type ? `<span class="badge type">${request.request_type}</span>` : ''}
                    </div>
                </div>
                <div class="request-actions">
                    <button class="expand-btn" onclick="event.stopPropagation(); toggleRequestExpanded(${request.id})" title="Toggle details">
                        <i class="fas fa-chevron-${expandedRequests.has(request.id) ? 'up' : 'down'}"></i>
                    </button>
                    <button class="delete-btn" onclick="event.stopPropagation(); deleteMaintenanceRequest(${request.id})" title="Delete Request">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="request-description">
                ${request.description || 'No description provided'}
            </div>
            <div class="request-meta">
                <div class="request-meta-item">
                    <i class="fas fa-cog"></i>
                    <span>${request.equipment_name || 'No equipment'}</span>
                </div>
                <div class="request-meta-item">
                    <i class="fas fa-calendar"></i>
                    <span>Due: ${request.due_date ? formatDate(request.due_date) : 'Not set'}</span>
                </div>
                <div class="request-meta-item">
                    <i class="fas fa-user"></i>
                    <span>${request.assigned_to_name || 'Unassigned'}</span>
                </div>
            </div>
            <div class="request-footer">
                <div class="request-cost">
                    <i class="fas fa-dollar-sign"></i>
                    <span>$${request.estimated_cost || '0.00'}</span>
                </div>
                <div class="request-date">${formatDate(request.created_at)}</div>
            </div>
        </div>
    `;
    }).join('');
}

// Switch view between list and calendar
function setupViewToggle() {
    const toggleBtns = document.querySelectorAll('.toggle-btn');
    
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const view = this.dataset.view;
            switchView(view);
        });
    });
}

function switchView(view) {
    currentView = view;
    
    // Update toggle buttons
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-view="${view}"]`).classList.add('active');
    
    // Update view containers
    document.querySelectorAll('.view-container').forEach(container => {
        container.classList.remove('active');
    });
    document.getElementById(`${view}-view`).classList.add('active');
    
    if (view === 'calendar') {
        generateCalendar();
        displayCalendarEvents();
    }
}

// Render calendar
function renderCalendar() {
    const calendar = document.getElementById('calendar');
    const calendarTitle = document.getElementById('calendarTitle');
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    calendarTitle.textContent = new Date(year, month).toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric' 
    });
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // Generate calendar HTML
    let calendarHTML = '';
    
    // Day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        calendarHTML += `<div class="calendar-day-header">${day}</div>`;
    });
    
    // Previous month days
    const prevMonth = new Date(year, month - 1, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        const day = prevMonthDays - i;
        calendarHTML += `<div class="calendar-day other-month">
            <div class="calendar-day-number">${day}</div>
        </div>`;
    }
    
    // Current month days
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDay = new Date(year, month, day);
        const isToday = currentDay.toDateString() === today.toDateString();
        
        // Get requests for this day
        const dayRequests = filteredRequests.filter(request => {
            if (!request.due_date) return false;
            const dueDate = new Date(request.due_date);
            return dueDate.toDateString() === currentDay.toDateString();
        });
        
        const eventsHTML = dayRequests.map(request => 
            `<div class="calendar-event ${request.priority}" onclick="showRequestDetails(${request.id})" title="${request.title}">
                ${request.title}
            </div>`
        ).join('');
        
        calendarHTML += `<div class="calendar-day ${isToday ? 'today' : ''}">
            <div class="calendar-day-number">${day}</div>
            ${eventsHTML}
        </div>`;
    }
    
    // Next month days
    const remainingCells = 42 - (startingDayOfWeek + daysInMonth);
    for (let day = 1; day <= remainingCells; day++) {
        calendarHTML += `<div class="calendar-day other-month">
            <div class="calendar-day-number">${day}</div>
        </div>`;
    }
    
    calendar.innerHTML = calendarHTML;
}

// Calendar navigation
function previousMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
}

function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
}

// Show new request modal
function showNewRequestModal() {
    document.getElementById('newRequestModal').style.display = 'block';
    
    // Populate dropdowns with latest data
    populateFilters();
    
    // Set default due date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('requestDueDate').value = tomorrow.toISOString().split('T')[0];
}

// Hide new request modal
function hideNewRequestModal() {
    document.getElementById('newRequestModal').style.display = 'none';
    document.getElementById('newRequestForm').reset();
}

// Hide request details modal
function hideRequestDetailsModal() {
    document.getElementById('requestDetailsModal').style.display = 'none';
}

// Recurring maintenance functionality
function setupRecurringOptions() {
    const isRecurringCheckbox = document.getElementById('isRecurring');
    const recurringOptions = document.getElementById('recurringOptions');
    const recurrenceType = document.getElementById('recurrenceType');
    const hoursThreshold = document.getElementById('hoursThreshold');
    const mileageThreshold = document.getElementById('mileageThreshold');
    
    if (isRecurringCheckbox) {
        isRecurringCheckbox.addEventListener('change', function() {
            if (this.checked) {
                recurringOptions.style.display = 'block';
            } else {
                recurringOptions.style.display = 'none';
            }
        });
    }
    
    if (recurrenceType) {
        recurrenceType.addEventListener('change', function() {
            const value = this.value;
            
            // Hide all threshold fields first
            hoursThreshold.style.display = 'none';
            mileageThreshold.style.display = 'none';
            
            // Show relevant threshold field
            if (value === 'hours') {
                hoursThreshold.style.display = 'block';
            } else if (value === 'mileage') {
                mileageThreshold.style.display = 'block';
            }
        });
    }
}

// Calculate next occurrence date for recurring maintenance
function calculateNextOccurrence(lastDate, recurrenceType, interval) {
    const date = new Date(lastDate);
    
    switch (recurrenceType) {
        case 'daily':
            date.setDate(date.getDate() + interval);
            break;
        case 'weekly':
            date.setDate(date.getDate() + (interval * 7));
            break;
        case 'monthly':
            date.setMonth(date.getMonth() + interval);
            break;
        case 'quarterly':
            date.setMonth(date.getMonth() + (interval * 3));
            break;
        case 'yearly':
            date.setFullYear(date.getFullYear() + interval);
            break;
        default:
            return null;
    }
    
    return date;
}

// Check if recurring maintenance is due based on equipment usage
function checkRecurringMaintenanceDue(request, equipment) {
    if (!request.is_recurring || !equipment) return false;
    
    const recurrenceType = request.recurrence_type;
    const threshold = request.hours_threshold || request.mileage_threshold;
    
    if (recurrenceType === 'hours' && request.hours_threshold) {
        const currentHours = equipment.hours_used || 0;
        const lastServiceHours = request.last_service_hours || 0;
        return (currentHours - lastServiceHours) >= request.hours_threshold;
    }
    
    if (recurrenceType === 'mileage' && request.mileage_threshold) {
        const currentMileage = equipment.mileage || 0;
        const lastServiceMileage = request.last_service_mileage || 0;
        return (currentMileage - lastServiceMileage) >= request.mileage_threshold;
    }
    
    return false;
}

// Create next recurring maintenance request
async function createRecurringRequest(originalRequest) {
    try {
        const nextDueDate = calculateNextOccurrence(
            originalRequest.due_date,
            originalRequest.recurrence_type,
            originalRequest.recurrence_interval
        );
        
        if (!nextDueDate) return;
        
        // Check if we've reached the end date or max occurrences
        if (originalRequest.end_date && nextDueDate > new Date(originalRequest.end_date)) {
            return;
        }
        
        if (originalRequest.max_occurrences && originalRequest.occurrence_count >= originalRequest.max_occurrences) {
            return;
        }
        
        const newRequest = {
            equipment_id: originalRequest.equipment_id,
            type: originalRequest.type,
            priority: originalRequest.priority,
            title: originalRequest.title,
            description: originalRequest.description,
            assigned_worker_id: originalRequest.assigned_worker_id,
            due_date: nextDueDate.toISOString().split('T')[0],
            estimated_cost: originalRequest.estimated_cost,
            estimated_hours: originalRequest.estimated_hours,
            parts_needed: originalRequest.parts_needed,
            is_recurring: true,
            recurrence_type: originalRequest.recurrence_type,
            recurrence_interval: originalRequest.recurrence_interval,
            hours_threshold: originalRequest.hours_threshold,
            mileage_threshold: originalRequest.mileage_threshold,
            end_date: originalRequest.end_date,
            max_occurrences: originalRequest.max_occurrences,
            parent_request_id: originalRequest.parent_request_id || originalRequest.id,
            occurrence_count: (originalRequest.occurrence_count || 0) + 1,
            status: 'pending'
        };
        
        const apiUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:8001/api/maintenance-requests' 
            : '/api/maintenance-requests';
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newRequest)
        });
        
        if (response.ok) {
            console.log('Next recurring maintenance request created');
            addNotification({
                type: 'info',
                title: 'Recurring Maintenance Scheduled',
                message: `Next ${originalRequest.title} scheduled for ${formatDate(nextDueDate)}`,
                timestamp: new Date().toISOString(),
                read: false
            });
        }
    } catch (error) {
        console.error('Error creating recurring request:', error);
    }
}

// Enhanced submit function to handle recurring maintenance
async function submitNewRequest(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const requestData = {
        equipment_id: formData.get('equipment'),
        type: formData.get('type'),
        priority: formData.get('priority'),
        title: formData.get('title'),
        description: formData.get('description'),
        assigned_worker_id: formData.get('assignedWorker') || null,
        due_date: formData.get('dueDate'),
        estimated_cost: parseFloat(formData.get('estimatedCost')) || null,
        estimated_hours: parseFloat(formData.get('estimatedHours')) || null,
        parts_needed: formData.get('partsNeeded') || null,
        current_hours: parseFloat(formData.get('currentHours')) || null,
        current_miles: parseFloat(formData.get('currentMiles')) || null,
        status: 'pending'
    };
    
    // Add recurring maintenance fields if enabled
    const isRecurring = formData.get('isRecurring');
    if (isRecurring) {
        requestData.is_recurring = true;
        requestData.recurrence_type = formData.get('recurrenceType');
        requestData.recurrence_interval = parseInt(formData.get('recurrenceInterval'));
        requestData.end_date = formData.get('endDate') || null;
        requestData.max_occurrences = parseInt(formData.get('maxOccurrences')) || null;
        requestData.occurrence_count = 1;
        
        if (requestData.recurrence_type === 'hours') {
            requestData.hours_threshold = parseInt(formData.get('hoursThreshold'));
        } else if (requestData.recurrence_type === 'mileage') {
            requestData.mileage_threshold = parseInt(formData.get('mileageThreshold'));
        }
    }
    
    try {
        const apiUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:8001/api/maintenance-requests' 
            : '/api/maintenance-requests';
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData),
            credentials: 'include'
        });
        
        if (response.ok) {
            // If hours or miles were provided, update the equipment record
            if (requestData.current_hours !== null || requestData.current_miles !== null) {
                await updateEquipmentUsage(requestData.equipment_id, requestData.current_hours, requestData.current_miles);
            }
            
            showNotification('Maintenance request created successfully!', 'success');
            hideNewRequestModal();
            event.target.reset();
            
            // Hide recurring options when form is reset
            const recurringOptions = document.getElementById('recurringOptions');
            if (recurringOptions) {
                recurringOptions.style.display = 'none';
            }
            
            await loadMaintenanceRequests();
            updateStats();
            renderRequests();
            
            // If recurring, schedule the next occurrence
            if (isRecurring) {
                const newRequest = await response.json();
                setTimeout(() => createRecurringRequest(newRequest), 1000);
            }
        } else {
            throw new Error('Failed to create maintenance request');
        }
    } catch (error) {
        console.error('Error creating maintenance request:', error);
        showNotification('Error creating maintenance request', 'error');
    }
}

// Enhanced request completion to handle recurring maintenance
async function completeRequestWithDetails(requestId, notes, cost) {
    try {
        const request = maintenanceRequests.find(r => r.id === requestId);
        
        const updateData = {
            status: 'completed',
            completed_at: new Date().toISOString(),
            completion_notes: notes,
            actual_cost: parseFloat(cost) || null
        };
        
        // Update equipment usage for recurring maintenance tracking
        if (request && request.is_recurring) {
            const equipment = equipment.find(e => e.id === request.equipment_id);
            if (equipment) {
                updateData.last_service_hours = equipment.hours_used;
                updateData.last_service_mileage = equipment.mileage;
            }
        }
        
        const apiUrl = window.location.hostname === 'localhost' 
            ? `http://localhost:8001/api/maintenance-requests/${requestId}` 
            : `/api/maintenance-requests/${requestId}`;
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (response.ok) {
            showNotification('Request completed successfully', 'success');
            hideRequestDetailsModal();
            
            // Create next recurring request if applicable
            if (request && request.is_recurring) {
                await createRecurringRequest(request);
            }
            
            await loadMaintenanceRequests();
            updateStats();
            renderRequests();
            
            // Refresh notifications
            checkOverdueRequests();
            checkUpcomingDueDates();
        } else {
            throw new Error('Failed to complete request');
        }
    } catch (error) {
        console.error('Error completing request:', error);
        showNotification('Error completing request', 'error');
    }
}

// Enhanced render function to show recurring indicators
function renderRequestsList() {
    const container = document.getElementById('requestsList');
    
    if (filteredRequests.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-list"></i>
                <h3>No maintenance requests found</h3>
                <p>Create your first maintenance request to get started.</p>
                <button class="btn btn-primary" onclick="showNewRequestModal()">
                    <i class="fas fa-plus"></i> New Request
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredRequests.map(request => {
        const equipment = equipment.find(e => e.id === request.equipment_id);
        const worker = workers.find(w => w.id === request.assigned_worker_id);
        const isOverdue = new Date(request.due_date) < new Date() && request.status !== 'completed';
        
        return `
            <div class="request-card ${request.is_recurring ? 'recurring' : ''} ${isOverdue ? 'overdue' : ''}" onclick="showRequestDetails(${request.id})">
                <div class="request-header">
                    <div class="request-title">
                        ${request.title}
                        ${request.is_recurring ? '<span class="recurring-badge">Recurring</span>' : ''}
                    </div>
                    <div class="request-status ${request.status}">${STATUS_LABELS[request.status]}</div>
                </div>
                <div class="request-info">
                    <div class="info-item">
                        <i class="fas fa-cog"></i>
                        <span>${equipment ? equipment.name : 'Unknown Equipment'}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-calendar"></i>
                        <span>Due: ${formatDate(request.due_date)}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-flag"></i>
                        <span class="priority-${request.priority}">${request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}</span>
                    </div>
                    ${worker ? `
                        <div class="info-item">
                            <i class="fas fa-user"></i>
                            <span>${worker.name}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="request-description">
                    ${request.description}
                </div>
            </div>
        `;
    }).join('');
}

// Toggle compact filters panel
function toggleFilters() {
    const controls = document.querySelector('.maintenance-controls');
    if (controls) {
        controls.classList.toggle('collapsed');
        showNotification(controls.classList.contains('collapsed') ? 'Filters hidden' : 'Filters shown', 'info');
    }
}

// Toggle per-request expansion in compact list
function toggleRequestExpanded(requestId) {
    if (expandedRequests.has(requestId)) {
        expandedRequests.delete(requestId);
    } else {
        expandedRequests.add(requestId);
    }
    renderRequests();
}

// Get action configuration for workflow buttons
function getActionConfig(action) {
    const configs = {
        'approved': {
            class: 'approve',
            icon: 'fas fa-check-circle',
            label: 'Approve',
            handler: 'approveRequest'
        },
        'rejected': {
            class: 'reject',
            icon: 'fas fa-times-circle',
            label: 'Reject',
            handler: 'rejectRequest'
        },
        'in_progress': {
            class: 'start',
            icon: 'fas fa-play-circle',
            label: 'Start Work',
            handler: 'startWork'
        },
        'on_hold': {
            class: 'hold',
            icon: 'fas fa-pause-circle',
            label: 'Put On Hold',
            handler: 'putOnHold'
        },
        'completed': {
            class: 'complete',
            icon: 'fas fa-check-double',
            label: 'Complete',
            handler: 'completeRequest'
        },
        'cancelled': {
            class: 'cancel',
            icon: 'fas fa-ban',
            label: 'Cancel',
            handler: 'cancelRequest'
        },
        'pending': {
            class: 'reopen',
            icon: 'fas fa-redo-alt',
            label: 'Reopen',
            handler: 'reopenRequest'
        }
    };
    
    return configs[action] || {
        class: 'default',
        icon: 'fas fa-cog',
        label: action,
        handler: 'updateRequestStatus'
    };
}

// Enhanced workflow action handlers
async function approveRequest(requestId) {
    showInputDialog(
        'Approve Request',
        'Approval notes (optional):',
        'Enter any approval notes...',
        async (notes) => {
            await updateRequestStatusWithNotes(requestId, 'approved', notes, 'approved_at');
        }
    );
}

async function rejectRequest(requestId) {
    showInputDialog(
        'Reject Request',
        'Rejection reason (required):',
        'Please provide a reason for rejection...',
        async (reason) => {
            if (!reason.trim()) {
                showNotification('Rejection reason is required', 'error');
                return;
            }
            await updateRequestStatusWithNotes(requestId, 'rejected', reason, 'rejected_at', 'rejection_reason');
        }
    );
}

async function startWork(requestId) {
    await updateRequestStatusWithNotes(requestId, 'in_progress', null, 'started_at');
}

async function putOnHold(requestId) {
    showInputDialog(
        'Put Request On Hold',
        'Reason for putting on hold:',
        'Please provide a reason...',
        async (reason) => {
            await updateRequestStatusWithNotes(requestId, 'on_hold', reason, 'hold_at', 'hold_reason');
        }
    );
}

async function cancelRequest(requestId) {
    showInputDialog(
        'Cancel Request',
        'Cancellation reason:',
        'Please provide a reason for cancellation...',
        async (reason) => {
            await updateRequestStatusWithNotes(requestId, 'cancelled', reason, 'cancelled_at', 'cancellation_reason');
        }
    );
}

async function deleteMaintenanceRequest(requestId) {
    if (!confirm('Are you sure you want to delete this maintenance request? This action cannot be undone.')) {
        return;
    }
    
    try {
        const apiUrl = window.location.hostname === 'localhost' 
            ? `http://localhost:8001/api/maintenance-requests/${requestId}` 
            : `/api/maintenance-requests/${requestId}`;
        const response = await fetch(apiUrl, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Maintenance request deleted successfully', 'success');
            await loadMaintenanceRequests();
        } else {
            const error = await response.json();
            showNotification(error.error || 'Failed to delete maintenance request', 'error');
        }
    } catch (error) {
        console.error('Error deleting maintenance request:', error);
        showNotification('Failed to delete maintenance request', 'error');
    }
}

async function reopenRequest(requestId) {
    await updateRequestStatusWithNotes(requestId, 'pending', null, 'reopened_at');
}

// Enhanced status update with notes and timestamps
async function updateRequestStatusWithNotes(requestId, status, notes, timestampField, notesField) {
    try {
        const request = maintenanceRequests.find(r => r.id === requestId);
        const oldStatus = request ? request.status : null;
        
        const updateData = {
            status: status,
            [timestampField]: new Date().toISOString()
        };
        
        if (notes && notesField) {
            updateData[notesField] = notes;
        }
        
        const apiUrl = window.location.hostname === 'localhost' 
            ? `http://localhost:8001/api/maintenance-requests/${requestId}` 
            : `/api/maintenance-requests/${requestId}`;
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (response.ok) {
            showNotification(`Request ${STATUS_LABELS[status].toLowerCase()} successfully`, 'success');
            
            // Add status change notification
            if (oldStatus && oldStatus !== status) {
                addStatusChangeNotification(requestId, oldStatus, status);
            }
            
            hideRequestDetailsModal();
            await loadMaintenanceRequests();
            updateStats();
            renderRequests();
            
            // Refresh notifications after status change
            checkOverdueRequests();
            checkUpcomingDueDates();
        } else {
            throw new Error('Failed to update request status');
        }
    } catch (error) {
        console.error('Error updating request status:', error);
        showNotification('Error updating request status', 'error');
    }
}

// Complete request with notes and cost
function completeRequest(requestId) {
    showInputDialog(
        'Complete Request',
        'Enter completion notes:',
        'Describe the work completed...',
        (notes) => {
            if (notes === null || notes.trim() === '') {
                showNotification('Completion notes are required', 'error');
                return;
            }
            
            showInputDialog(
                'Complete Request - Cost',
                'Enter actual cost (optional):',
                'Enter cost in dollars (e.g., 150.00)',
                (cost) => {
                    const actualCost = cost && cost.trim() ? parseFloat(cost) : null;
                    if (cost && cost.trim() && (isNaN(actualCost) || actualCost < 0)) {
                        showNotification('Please enter a valid cost amount', 'error');
                        return;
                    }
                    completeRequestWithDetails(requestId, notes, actualCost);
                }
            );
        }
    );
}

// Complete request with details
async function completeRequestWithDetails(requestId, notes, cost) {
    try {
        const apiUrl = window.location.hostname === 'localhost' 
            ? `http://localhost:8001/api/maintenance/${requestId}/complete` 
            : `/api/maintenance/${requestId}/complete`;
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ notes, cost })
        });
        
        if (response.ok) {
            showNotification('Request completed successfully', 'success');
            hideRequestDetailsModal();
            await loadMaintenanceRequests();
            updateStats();
            renderRequests();
        } else {
            throw new Error('Failed to complete request');
        }
    } catch (error) {
        console.error('Error completing request:', error);
        showNotification('Error completing request', 'error');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Modal close events
    window.addEventListener('click', function(event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // Escape key to close modals
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
        }
    });
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format duration from milliseconds to human readable format
function formatDuration(milliseconds) {
    if (!milliseconds || milliseconds === 0) return '0 days';
    
    const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
    const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
        return `${days} day${days !== 1 ? 's' : ''}${hours > 0 ? ` ${hours}h` : ''}`;
    } else if (hours > 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''}${minutes > 0 ? ` ${minutes}m` : ''}`;
    } else if (minutes > 0) {
        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
        return 'Less than 1 minute';
    }
}

// Get equipment name by ID
function getEquipmentName(equipmentId) {
    if (!equipmentId) return 'Unknown Equipment';
    
    const equipmentItem = equipment.find(eq => eq.id == equipmentId);
    return equipmentItem ? equipmentItem.name : `Equipment #${equipmentId}`;
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Remove notification
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add notification styles
const notificationStyles = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 0.5rem;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        z-index: 10000;
        max-width: 400px;
    }
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification.success {
        border-left: 4px solid #27ae60;
        color: #27ae60;
    }
    
    .notification.error {
        border-left: 4px solid #e74c3c;
        color: #e74c3c;
    }
    
    .notification.info {
        border-left: 4px solid #3498db;
        color: #3498db;
    }
`;

// Add styles to head
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);

// Enhanced status workflow with approval process
const STATUS_WORKFLOW = {
    'pending': ['approved', 'rejected', 'cancelled'],
    'approved': ['in_progress', 'cancelled'],
    'in_progress': ['completed', 'on_hold', 'cancelled'],
    'on_hold': ['in_progress', 'cancelled'],
    'completed': [],
    'rejected': ['pending'],
    'cancelled': ['pending']
};

const STATUS_LABELS = {
    'pending': 'Pending Approval',
    'approved': 'Approved',
    'rejected': 'Rejected',
    'in_progress': 'In Progress',
    'on_hold': 'On Hold',
    'completed': 'Completed',
    'cancelled': 'Cancelled'
};

const STATUS_COLORS = {
    'pending': '#f39c12',
    'approved': '#27ae60',
    'rejected': '#e74c3c',
    'in_progress': '#3498db',
    'on_hold': '#9b59b6',
    'completed': '#2ecc71',
    'cancelled': '#95a5a6'
};

// Show request details modal
function showRequestDetails(requestId) {
    console.log('=== DEBUG: showRequestDetails called ===');
    console.log('Request ID:', requestId);
    
    const request = maintenanceRequests.find(r => r.id === requestId);
    if (!request) {
        console.log('ERROR: Request not found!');
        return;
    }
    
    console.log('Found request:', request);
    
    const modal = document.getElementById('requestDetailsModal');
    const content = modal.querySelector('.modal-content');
    
    console.log('Modal element:', modal);
    console.log('Content element:', content);
    
    const statusBadgeColor = STATUS_COLORS[request.status] || '#6c757d';
    const availableActions = STATUS_WORKFLOW[request.status] || [];
    
    console.log('Request status:', request.status);
    console.log('Available actions:', availableActions);
    console.log('STATUS_WORKFLOW:', STATUS_WORKFLOW);
    
    content.innerHTML = `
        <div class="modal-header">
            <h2><i class="fas fa-wrench"></i> ${request.title}</h2>
            <span class="close" onclick="hideRequestDetailsModal()">&times;</span>
        </div>
        <div class="modal-body">
            <div class="request-status-badge" style="background-color: ${statusBadgeColor}">
                <i class="fas fa-circle"></i> ${STATUS_LABELS[request.status]}
            </div>
            
            <!-- Edit Button Section -->
            <div class="edit-button-section" style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #28a745;">
                <div style="margin-bottom: 10px; font-weight: 600; color: #495057;">
                    <i class="fas fa-edit"></i> Request Management
                </div>
                <div class="edit-actions">
                    <button class="btn btn-success" onclick="showEditRequestModal(${request.id})" style="margin-right: 10px; margin-bottom: 5px;">
                        <i class="fas fa-edit"></i> Edit Request
                    </button>
                    <button class="btn btn-info" onclick="showUploadReceiptModal(${request.id})" style="margin-right: 10px; margin-bottom: 5px;">
                        <i class="fas fa-receipt"></i> Upload Receipt
                    </button>
                </div>
            </div>

            ${availableActions.length > 0 ? `
            <div class="action-buttons-top" style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #007bff;">
                <div style="margin-bottom: 10px; font-weight: 600; color: #495057;">
                    <i class="fas fa-tools"></i> Available Actions
                </div>
                <div class="action-buttons">
                    ${availableActions.map(action => {
                        console.log('Creating button for action:', action);
                        const actionConfig = getActionConfig(action);
                        console.log('Action config:', actionConfig);
                        return `<button class="status-btn ${actionConfig.class}" onclick="${actionConfig.handler}(${request.id})" style="margin-right: 10px; margin-bottom: 5px;">
                            <i class="${actionConfig.icon}"></i> ${actionConfig.label}
                        </button>`;
                    }).join('')}
                </div>
            </div>
            ` : `
            <div class="no-actions-message" style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #6c757d;">
                <i class="fas fa-info-circle"></i>
                <span>No actions available for this request (Status: ${STATUS_LABELS[request.status]})</span>
            </div>
            `}
            
            <div class="request-details-grid">
                <div class="detail-item">
                    <span class="detail-label">Equipment:</span>
                    <span>${request.equipment_name}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Type:</span>
                    <span class="type-badge ${request.request_type}">${request.request_type}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Priority:</span>
                    <span class="priority-badge ${request.priority}">${request.priority}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Requested By:</span>
                    <span>${request.requested_by_name || 'Unknown'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Assigned To:</span>
                    <span>${request.assigned_to_name || 'Unassigned'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Created:</span>
                    <span>${formatDate(request.created_at)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Due Date:</span>
                    <span>${formatDate(request.due_date)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Estimated Cost:</span>
                    <span>$${request.estimated_cost || 0}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Estimated Hours:</span>
                    <span>${request.estimated_hours || 0} hours</span>
                </div>
                ${request.parts_needed ? `
                <div class="detail-item full-width">
                    <span class="detail-label">Parts Needed:</span>
                    <span>${request.parts_needed}</span>
                </div>
                ` : ''}
                <div class="detail-item full-width">
                    <span class="detail-label">Description:</span>
                    <p>${request.description}</p>
                </div>
                ${request.completion_notes ? `
                <div class="detail-item full-width">
                    <span class="detail-label">Completion Notes:</span>
                    <p>${request.completion_notes}</p>
                </div>
                ` : ''}
                ${request.rejection_reason ? `
                <div class="detail-item full-width">
                    <span class="detail-label">Rejection Reason:</span>
                    <p class="rejection-reason">${request.rejection_reason}</p>
                </div>
                ` : ''}
            </div>
            
            <!-- Workflow Timeline -->
            <div class="workflow-timeline">
                <h3>Request Timeline</h3>
                <div class="timeline">
                    <div class="timeline-item ${request.created_at ? 'completed' : ''}">
                        <div class="timeline-marker"></div>
                        <div class="timeline-content">
                            <h4>Request Created</h4>
                            <p>${formatDate(request.created_at)}</p>
                        </div>
                    </div>
                    <div class="timeline-item ${['approved', 'in_progress', 'completed'].includes(request.status) ? 'completed' : request.status === 'rejected' ? 'rejected' : ''}">
                        <div class="timeline-marker"></div>
                        <div class="timeline-content">
                            <h4>Approval</h4>
                            <p>${request.approved_at ? formatDate(request.approved_at) : 'Pending approval'}</p>
                        </div>
                    </div>
                    <div class="timeline-item ${['in_progress', 'completed'].includes(request.status) ? 'completed' : ''}">
                        <div class="timeline-marker"></div>
                        <div class="timeline-content">
                            <h4>Work Started</h4>
                            <p>${request.started_at ? formatDate(request.started_at) : 'Not started'}</p>
                        </div>
                    </div>
                    <div class="timeline-item ${request.status === 'completed' ? 'completed' : ''}">
                        <div class="timeline-marker"></div>
                        <div class="timeline-content">
                            <h4>Completed</h4>
                            <p>${request.completed_at ? formatDate(request.completed_at) : 'Not completed'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    console.log('Final content HTML length:', content.innerHTML.length);
    console.log('Setting modal display to block...');
    modal.style.display = 'block';
    console.log('=== DEBUG: showRequestDetails complete ===');
}

// Calendar functionality - Initialize calendar when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeCalendar();
    setupViewToggle();
});

function initializeCalendar() {
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');
    
    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            generateCalendar();
            displayCalendarEvents();
        });
        
        nextBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            generateCalendar();
            displayCalendarEvents();
        });
        
        generateCalendar();
    }
}

function generateCalendar() {
    const monthYear = document.getElementById('calendar-month-year');
    const calendarDays = document.getElementById('calendar-days');
    
    if (!monthYear || !calendarDays) return;
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Set month/year header
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    monthYear.textContent = `${monthNames[month]} ${year}`;
    
    // Clear previous days
    calendarDays.innerHTML = '';
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    // Add previous month's trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
        const dayDiv = createCalendarDay(daysInPrevMonth - i, true, false);
        calendarDays.appendChild(dayDiv);
    }
    
    // Add current month's days
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = today.getFullYear() === year && 
                       today.getMonth() === month && 
                       today.getDate() === day;
        const dayDiv = createCalendarDay(day, false, isToday);
        calendarDays.appendChild(dayDiv);
    }
    
    // Add next month's leading days
    const totalCells = calendarDays.children.length;
    const remainingCells = 42 - totalCells; // 6 rows × 7 days
    for (let day = 1; day <= remainingCells; day++) {
        const dayDiv = createCalendarDay(day, true, false);
        calendarDays.appendChild(dayDiv);
    }
}

function createCalendarDay(dayNumber, isOtherMonth, isToday) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'calendar-day';
    
    if (isOtherMonth) {
        dayDiv.classList.add('other-month');
    }
    if (isToday) {
        dayDiv.classList.add('today');
    }
    
    dayDiv.innerHTML = `
        <div class="day-number">${dayNumber}</div>
        <div class="day-events" data-date="${dayNumber}"></div>
    `;
    
    return dayDiv;
}

function displayCalendarEvents() {
    if (!maintenanceRequests || maintenanceRequests.length === 0) return;
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Clear existing events
    document.querySelectorAll('.day-events').forEach(container => {
        container.innerHTML = '';
    });
    
    maintenanceRequests.forEach(request => {
        const requestDate = new Date(request.requested_date || request.created_at);
        const dueDate = request.due_date ? new Date(request.due_date) : null;
        
        // Show request on requested date
        if (requestDate.getFullYear() === year && requestDate.getMonth() === month) {
            addEventToCalendar(requestDate.getDate(), request, 'requested');
        }
        
        // Show request on due date if different
        if (dueDate && dueDate.getFullYear() === year && dueDate.getMonth() === month) {
            const dayOfMonth = dueDate.getDate();
            if (dayOfMonth !== requestDate.getDate()) {
                addEventToCalendar(dayOfMonth, request, 'due');
            }
        }
    });
}

function addEventToCalendar(day, request, eventType) {
    const dayEvents = document.querySelector(`[data-date="${day}"]`);
    if (!dayEvents) return;
    
    const eventDiv = document.createElement('div');
    eventDiv.className = `calendar-event ${request.status}`;
    
    // Check if overdue
    const now = new Date();
    const dueDate = request.due_date ? new Date(request.due_date) : null;
    if (dueDate && dueDate < now && request.status !== 'completed') {
        eventDiv.classList.add('overdue');
        eventDiv.classList.remove(request.status);
    }
    
    const title = eventType === 'due' ? `Due: ${request.equipment_name}` : request.equipment_name;
    eventDiv.textContent = title;
    eventDiv.title = `${request.issue_description} - ${request.status}`;
    
    eventDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        showRequestDetails(request.id);
    });
    
    dayEvents.appendChild(eventDiv);
}

// Notification System
let notifications = [];
let notificationSettings = {
    overdueEnabled: true,
    urgentEnabled: true,
    statusChangeEnabled: true,
    reminderDays: 3 // Days before due date to show reminder
};

// Initialize notification system
function initializeNotificationSystem() {
    loadNotifications();
    clearOldNotifications();
    checkOverdueRequests();
    checkUpcomingDueDates();
    updateNotificationBadge();
    
    // Check for notifications every 5 minutes
    setInterval(() => {
        checkOverdueRequests();
        checkUpcomingDueDates();
        updateNotificationBadge();
    }, 5 * 60 * 1000);
}

// Check for overdue maintenance requests
function checkOverdueRequests() {
    if (!notificationSettings.overdueEnabled) return;
    
    const now = new Date();
    const overdueRequests = maintenanceRequests.filter(request => {
        const dueDate = request.due_date ? new Date(request.due_date) : null;
        return dueDate && dueDate < now && 
               !['completed', 'cancelled'].includes(request.status);
    });
    
    overdueRequests.forEach(request => {
        const existingNotification = notifications.find(n => 
            n.type === 'overdue' && n.requestId === request.id
        );
        
        if (!existingNotification) {
            addNotification({
                id: `overdue_${request.id}`,
                type: 'overdue',
                requestId: request.id,
                title: 'Overdue Maintenance',
                message: `${request.equipment_name} maintenance is overdue`,
                timestamp: new Date(),
                read: false,
                urgent: true
            });
        }
    });
    
    // Show alert banner for overdue requests
    if (overdueRequests.length > 0) {
        showAlertBanner(
            'Overdue Maintenance Alert',
            `${overdueRequests.length} maintenance request${overdueRequests.length > 1 ? 's are' : ' is'} overdue`,
            'overdue'
        );
    }
}

// Check for upcoming due dates
function checkUpcomingDueDates() {
    if (!notificationSettings.urgentEnabled) return;
    
    const now = new Date();
    const reminderDate = new Date(now.getTime() + (notificationSettings.reminderDays * 24 * 60 * 60 * 1000));
    
    const upcomingRequests = maintenanceRequests.filter(request => {
        const dueDate = request.due_date ? new Date(request.due_date) : null;
        return dueDate && dueDate > now && dueDate <= reminderDate &&
               !['completed', 'cancelled'].includes(request.status);
    });
    
    upcomingRequests.forEach(request => {
        const existingNotification = notifications.find(n => 
            n.type === 'upcoming' && n.requestId === request.id
        );
        
        if (!existingNotification) {
            const daysUntilDue = Math.ceil((new Date(request.due_date) - now) / (24 * 60 * 60 * 1000));
            addNotification({
                id: `upcoming_${request.id}`,
                type: 'upcoming',
                requestId: request.id,
                title: 'Maintenance Due Soon',
                message: `${request.equipment_name} maintenance due in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''}`,
                timestamp: new Date(),
                read: false,
                urgent: daysUntilDue <= 1
            });
        }
    });
}

// Add notification
function addNotification(notification) {
    notifications.unshift(notification);
    
    // Limit to 50 notifications
    if (notifications.length > 50) {
        notifications = notifications.slice(0, 50);
    }
    
    updateNotificationBadge();
    renderNotifications();
    saveNotifications();
    
    // Show toast notification for urgent items
    if (notification.urgent) {
        showNotification(notification.message, 'warning');
    }
}

// Update notification badge
function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    const unreadCount = notifications.filter(n => !n.read).length;
    
    if (badge) {
        badge.textContent = unreadCount;
        badge.classList.toggle('hidden', unreadCount === 0);
    }
}

// Toggle notification dropdown
function toggleNotifications() {
    const dropdown = document.getElementById('notificationDropdown');
    dropdown.classList.toggle('show');
    
    if (dropdown.classList.contains('show')) {
        renderNotifications();
    }
}

// Render notifications in dropdown
function renderNotifications() {
    const container = document.getElementById('notificationList');
    if (!container) return;
    
    if (notifications.length === 0) {
        container.innerHTML = `
            <div class="notification-empty">
                <i class="fas fa-bell-slash"></i>
                <p>No notifications</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = notifications.map(notification => `
        <div class="notification-item ${notification.read ? '' : 'unread'} ${notification.urgent ? 'urgent' : ''}"
             onclick="handleNotificationClick('${notification.id}')">
            <div class="notification-content">
                <div class="notification-icon ${notification.type}">
                    <i class="fas fa-${getNotificationIcon(notification.type)}"></i>
                </div>
                <div class="notification-text">
                    <div class="notification-title">${notification.title}</div>
                    <div class="notification-message">${notification.message}</div>
                    <div class="notification-time">${formatTimeAgo(notification.timestamp)}</div>
                </div>
            </div>
        </div>
    `).join('');
}

// Get notification icon based on type
function getNotificationIcon(type) {
    const icons = {
        'overdue': 'exclamation-triangle',
        'upcoming': 'clock',
        'status_change': 'info-circle',
        'urgent': 'exclamation-circle'
    };
    return icons[type] || 'bell';
}

// Handle notification click
function handleNotificationClick(notificationId) {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) return;
    
    // Mark as read
    notification.read = true;
    updateNotificationBadge();
    renderNotifications();
    saveNotifications();
    
    // Navigate to related request if applicable
    if (notification.requestId) {
        showRequestDetails(notification.requestId);
    }
    
    // Close dropdown
    document.getElementById('notificationDropdown').classList.remove('show');
}

// Mark all notifications as read
function markAllNotificationsRead() {
    notifications.forEach(n => n.read = true);
    updateNotificationBadge();
    renderNotifications();
    saveNotifications();
    
    // Show confirmation
    showNotification('All notifications marked as read', 'success');
}

// Show alert banner
function showAlertBanner(title, message, type) {
    // Remove existing banner
    const existingBanner = document.querySelector('.alert-banner');
    if (existingBanner) {
        existingBanner.remove();
    }
    
    const banner = document.createElement('div');
    banner.className = `alert-banner ${type}`;
    banner.innerHTML = `
        <i class="fas fa-${type === 'overdue' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <div class="alert-content">
            <div class="alert-title">${title}</div>
            <div class="alert-message">${message}</div>
        </div>
        <button class="alert-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Insert after page header
    const pageHeader = document.querySelector('.page-header');
    if (pageHeader) {
        pageHeader.insertAdjacentElement('afterend', banner);
    }
}

// Format time ago
function formatTimeAgo(timestamp) {
    const now = new Date();
    const diff = now - new Date(timestamp);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
}

// Add status change notification
function addStatusChangeNotification(requestId, oldStatus, newStatus) {
    if (!notificationSettings.statusChangeEnabled) return;
    
    const request = maintenanceRequests.find(r => r.id === requestId);
    if (!request) return;
    
    addNotification({
        id: `status_${requestId}_${Date.now()}`,
        type: 'status_change',
        requestId: requestId,
        title: 'Status Updated',
        message: `${request.equipment_name} status changed from ${STATUS_LABELS[oldStatus]} to ${STATUS_LABELS[newStatus]}`,
        timestamp: new Date(),
        read: false,
        urgent: newStatus === 'completed' || newStatus === 'rejected'
    });
}

// Load notifications from localStorage
function loadNotifications() {
    try {
        const saved = localStorage.getItem('maintenanceNotifications');
        if (saved) {
            notifications = JSON.parse(saved).map(n => ({
                ...n,
                timestamp: new Date(n.timestamp)
            }));
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
        notifications = [];
    }
}

// Save notifications to localStorage
function saveNotifications() {
    try {
        localStorage.setItem('maintenanceNotifications', JSON.stringify(notifications));
    } catch (error) {
        console.error('Error saving notifications:', error);
    }
}

// Enhanced notification system with persistence
function addNotificationWithPersistence(notification) {
    addNotification(notification);
    saveNotifications();
}

// Clear old notifications (older than 30 days)
function clearOldNotifications() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const originalLength = notifications.length;
    notifications = notifications.filter(n => new Date(n.timestamp) > thirtyDaysAgo);
    
    if (notifications.length !== originalLength) {
        saveNotifications();
        updateNotificationBadge();
    }
}

// Close notification dropdown when clicking outside
document.addEventListener('click', function(event) {
    const notificationCenter = document.querySelector('.notification-center');
    const dropdown = document.getElementById('notificationDropdown');
    
    if (notificationCenter && !notificationCenter.contains(event.target)) {
        dropdown?.classList.remove('show');
    }
});

// Initialize reports system
function initializeReportsSystem() {
    setupReportControls();
    generateInitialReport();
}

// Setup report controls and event listeners
function setupReportControls() {
    const reportPeriod = document.getElementById('report-period');
    const customDateRange = document.getElementById('custom-date-range');
    const generateBtn = document.getElementById('generate-report');
    const exportBtn = document.getElementById('export-report');
    const reportSearch = document.getElementById('report-search');
    const reportFilter = document.getElementById('report-filter');

    if (reportPeriod) {
        reportPeriod.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                customDateRange.style.display = 'flex';
            } else {
                customDateRange.style.display = 'none';
                reportsData.currentPeriod = parseInt(e.target.value);
                generateReport();
            }
        });
    }

    if (generateBtn) {
        generateBtn.addEventListener('click', generateReport);
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', exportReportToPDF);
    }

    if (reportSearch) {
        reportSearch.addEventListener('input', filterReportTable);
    }

    if (reportFilter) {
        reportFilter.addEventListener('change', filterReportTable);
    }

    // Custom date range inputs
    const startDate = document.getElementById('start-date');
    const endDate = document.getElementById('end-date');
    
    if (startDate && endDate) {
        [startDate, endDate].forEach(input => {
            input.addEventListener('change', () => {
                if (startDate.value && endDate.value) {
                    reportsData.startDate = new Date(startDate.value);
                    reportsData.endDate = new Date(endDate.value);
                    generateReport();
                }
            });
        });
    }
}

// Generate initial report
function generateInitialReport() {
    generateReport();
}

// Main report generation function
function generateReport() {
    showLoadingState();
    
    // Calculate date range
    const dateRange = calculateDateRange();
    reportsData.startDate = dateRange.start;
    reportsData.endDate = dateRange.end;
    
    // Filter requests for the period
    reportsData.filteredRequests = filterRequestsByDateRange(maintenanceRequests, dateRange.start, dateRange.end);
    
    // Calculate previous period for comparison
    const previousRange = calculatePreviousPeriodRange(dateRange);
    const previousRequests = filterRequestsByDateRange(maintenanceRequests, previousRange.start, previousRange.end);
    
    // Generate all report components
    updateMetricsCards(reportsData.filteredRequests, previousRequests);
    updateCharts(reportsData.filteredRequests);
    updateReportTable(reportsData.filteredRequests);
    updateEquipmentPerformance(reportsData.filteredRequests);
    
    hideLoadingState();
}

// Calculate date range based on selected period
function calculateDateRange() {
    const end = new Date();
    let start = new Date();
    
    if (reportsData.startDate && reportsData.endDate) {
        return { start: reportsData.startDate, end: reportsData.endDate };
    }
    
    switch (reportsData.currentPeriod) {
        case 7:
            start.setDate(end.getDate() - 7);
            break;
        case 30:
            start.setDate(end.getDate() - 30);
            break;
        case 90:
            start.setDate(end.getDate() - 90);
            break;
        case 365:
            start.setDate(end.getDate() - 365);
            break;
        default:
            start.setDate(end.getDate() - 30);
    }
    
    return { start, end };
}

// Calculate previous period range for comparison
function calculatePreviousPeriodRange(currentRange) {
    const duration = currentRange.end - currentRange.start;
    const end = new Date(currentRange.start);
    const start = new Date(currentRange.start - duration);
    
    return { start, end };
}

// Filter requests by date range
function filterRequestsByDateRange(requests, startDate, endDate) {
    return requests.filter(request => {
        const requestDate = new Date(request.created_at || request.date_created);
        return requestDate >= startDate && requestDate <= endDate;
    });
}

// Update metrics cards
function updateMetricsCards(currentRequests, previousRequests) {
    const currentMetrics = calculateMetrics(currentRequests);
    const previousMetrics = calculateMetrics(previousRequests);
    
    // Update total requests
    updateMetricCard('total-requests-metric', 'requests-change', 
        currentMetrics.total, previousMetrics.total);
    
    // Update completed requests
    updateMetricCard('completed-requests-metric', 'completed-change', 
        currentMetrics.completed, previousMetrics.completed);
    
    // Update average completion time
    const avgTimeElement = document.getElementById('avg-completion-time');
    if (avgTimeElement) {
        avgTimeElement.textContent = formatDuration(currentMetrics.avgCompletionTime);
    }
    updateChangeIndicator('time-change', currentMetrics.avgCompletionTime, previousMetrics.avgCompletionTime, true);
    
    // Update total cost
    updateMetricCard('total-cost-metric', 'cost-change', 
        `$${currentMetrics.totalCost.toLocaleString()}`, 
        previousMetrics.totalCost, true);
}

// Calculate metrics from requests
function calculateMetrics(requests) {
    const total = requests.length;
    const completed = requests.filter(r => r.status === 'completed').length;
    const totalCost = requests.reduce((sum, r) => sum + (parseFloat(r.actual_cost || r.estimated_cost || 0)), 0);
    
    // Calculate average completion time
    const completedRequests = requests.filter(r => r.status === 'completed' && r.completed_at);
    let avgCompletionTime = 0;
    
    if (completedRequests.length > 0) {
        const totalTime = completedRequests.reduce((sum, r) => {
            const created = new Date(r.created_at || r.date_created);
            const completed = new Date(r.completed_at);
            return sum + (completed - created);
        }, 0);
        avgCompletionTime = totalTime / completedRequests.length;
    }
    
    return { total, completed, totalCost, avgCompletionTime };
}

// Update individual metric card
function updateMetricCard(metricId, changeId, currentValue, previousValue, isCurrency = false) {
    const metricElement = document.getElementById(metricId);
    const changeElement = document.getElementById(changeId);
    
    if (metricElement) {
        metricElement.textContent = isCurrency ? currentValue : currentValue;
    }
    
    if (typeof previousValue === 'number') {
        updateChangeIndicator(changeId, currentValue, previousValue, isCurrency);
    }
}

// Update change indicator
function updateChangeIndicator(elementId, current, previous, isInverse = false) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const currentNum = typeof current === 'string' ? parseFloat(current.replace(/[$,]/g, '')) : current;
    const change = previous === 0 ? 0 : ((currentNum - previous) / previous) * 100;
    const isPositive = isInverse ? change < 0 : change > 0;
    
    element.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
    element.className = `metric-change ${isPositive ? 'positive' : 'negative'}`;
}

// Update charts
function updateCharts(requests) {
    // Only update charts if we're in reports view to avoid unnecessary canvas operations
    const reportsView = document.getElementById('reports-view');
    if (!reportsView || reportsView.style.display === 'none') {
        return;
    }
    
    updateStatusChart(requests);
    updateTimelineChart(requests);
    updateEquipmentChart(requests);
    updateCostChart(requests);
}

// Update status distribution chart
function updateStatusChart(requests) {
    const canvas = document.getElementById('status-chart');
    if (!canvas || canvas.offsetParent === null) return; // Check if canvas exists and is visible
    
    try {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const statusCounts = {};
        
        requests.forEach(request => {
            statusCounts[request.status] = (statusCounts[request.status] || 0) + 1;
        });
        
        // Simple pie chart implementation
        drawPieChart(ctx, statusCounts, {
            'pending': '#fbbf24',
            'in_progress': '#3b82f6',
            'completed': '#10b981',
            'cancelled': '#ef4444'
        });
    } catch (error) {
        console.warn('Error updating status chart:', error);
    }
}

// Update timeline chart
function updateTimelineChart(requests) {
    const canvas = document.getElementById('timeline-chart');
    if (!canvas || canvas.offsetParent === null) return; // Check if canvas exists and is visible
    
    try {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const timelineData = generateTimelineData(requests);
        
        drawLineChart(ctx, timelineData);
    } catch (error) {
        console.warn('Error updating timeline chart:', error);
    }
}

// Update equipment chart
function updateEquipmentChart(requests) {
    const canvas = document.getElementById('equipment-chart');
    if (!canvas || canvas.offsetParent === null) return; // Check if canvas exists and is visible
    
    try {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const equipmentCounts = {};
        
        requests.forEach(request => {
            const equipmentName = getEquipmentName(request.equipment_id);
            equipmentCounts[equipmentName] = (equipmentCounts[equipmentName] || 0) + 1;
        });
        
        drawBarChart(ctx, equipmentCounts);
    } catch (error) {
        console.warn('Error updating equipment chart:', error);
    }
}

// Update cost chart
function updateCostChart(requests) {
    const canvas = document.getElementById('cost-chart');
    if (!canvas || canvas.offsetParent === null) return; // Check if canvas exists and is visible
    
    try {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const costData = generateCostData(requests);
        
        drawLineChart(ctx, costData, '#10b981');
    } catch (error) {
        console.warn('Error updating cost chart:', error);
    }
}

// Simple pie chart drawing function
function drawPieChart(ctx, data, colors) {
    const canvas = ctx.canvas;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    let currentAngle = -Math.PI / 2;
    
    Object.entries(data).forEach(([status, count]) => {
        const sliceAngle = (count / total) * 2 * Math.PI;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        
        ctx.fillStyle = colors[status] || '#6b7280';
        ctx.fill();
        
        // Add label
        const labelAngle = currentAngle + sliceAngle / 2;
        const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
        const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);
        
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(count.toString(), labelX, labelY);
        
        currentAngle += sliceAngle;
    });
}

// Simple line chart drawing function
function drawLineChart(ctx, data, color = '#3b82f6') {
    const canvas = ctx.canvas;
    const padding = 40;
    const chartWidth = canvas.width - 2 * padding;
    const chartHeight = canvas.height - 2 * padding;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (data.length === 0) return;
    
    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = Math.min(...data.map(d => d.value));
    const valueRange = maxValue - minValue || 1;
    
    // Draw axes
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.stroke();
    
    // Draw line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    data.forEach((point, index) => {
        const x = padding + (index / (data.length - 1)) * chartWidth;
        const y = canvas.height - padding - ((point.value - minValue) / valueRange) * chartHeight;
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.stroke();
    
    // Draw points
    ctx.fillStyle = color;
    data.forEach((point, index) => {
        const x = padding + (index / (data.length - 1)) * chartWidth;
        const y = canvas.height - padding - ((point.value - minValue) / valueRange) * chartHeight;
        
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
    });
}

// Simple bar chart drawing function
function drawBarChart(ctx, data) {
    const canvas = ctx.canvas;
    const padding = 40;
    const chartWidth = canvas.width - 2 * padding;
    const chartHeight = canvas.height - 2 * padding;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const entries = Object.entries(data);
    if (entries.length === 0) return;
    
    const maxValue = Math.max(...Object.values(data));
    const barWidth = chartWidth / entries.length * 0.8;
    const barSpacing = chartWidth / entries.length * 0.2;
    
    entries.forEach(([label, value], index) => {
        const barHeight = (value / maxValue) * chartHeight;
        const x = padding + index * (barWidth + barSpacing);
        const y = canvas.height - padding - barHeight;
        
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Add value label
        ctx.fillStyle = '#374151';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(value.toString(), x + barWidth / 2, y - 5);
    });
}

// Update report table
function updateReportTable(requests) {
    const tableBody = document.getElementById('reports-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    requests.forEach(request => {
        const row = document.createElement('tr');
        const equipmentName = getEquipmentName(request.equipment_id);
        const statusClass = `status-${request.status.replace('_', '-')}`;
        
        row.innerHTML = `
            <td>${request.id}</td>
            <td>${equipmentName}</td>
            <td>${request.type}</td>
            <td><span class="status-badge ${statusClass}">${request.status.replace('_', ' ')}</span></td>
            <td>${formatDate(request.created_at || request.date_created)}</td>
            <td>${request.completed_at ? formatDate(request.completed_at) : '-'}</td>
            <td>$${(request.actual_cost || request.estimated_cost || 0).toLocaleString()}</td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Update equipment performance
function updateEquipmentPerformance(requests) {
    const performanceList = document.getElementById('equipment-performance-list');
    if (!performanceList) return;
    
    const equipmentStats = {};
    
    requests.forEach(request => {
        const equipmentName = getEquipmentName(request.equipment_id);
        if (!equipmentStats[equipmentName]) {
            equipmentStats[equipmentName] = {
                total: 0,
                completed: 0,
                totalCost: 0,
                totalDowntime: 0
            };
        }
        
        equipmentStats[equipmentName].total++;
        if (request.status === 'completed') {
            equipmentStats[equipmentName].completed++;
        }
        equipmentStats[equipmentName].totalCost += parseFloat(request.actual_cost || request.estimated_cost || 0);
        
        // Calculate downtime if available
        if (request.downtime_hours) {
            equipmentStats[equipmentName].totalDowntime += parseFloat(request.downtime_hours);
        }
    });
    
    performanceList.innerHTML = '';
    
    Object.entries(equipmentStats).forEach(([equipmentName, stats]) => {
        const completionRate = stats.total > 0 ? (stats.completed / stats.total * 100).toFixed(1) : 0;
        const avgCost = stats.total > 0 ? (stats.totalCost / stats.total).toFixed(0) : 0;
        
        const item = document.createElement('div');
        item.className = 'equipment-performance-item';
        item.innerHTML = `
            <div class="equipment-name">${equipmentName}</div>
            <div class="equipment-stats">
                <div class="stat">
                    <span class="stat-label">Requests:</span>
                    <span class="stat-value">${stats.total}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Completion Rate:</span>
                    <span class="stat-value">${completionRate}%</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Avg Cost:</span>
                    <span class="stat-value">$${avgCost}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Downtime:</span>
                    <span class="stat-value">${stats.totalDowntime}h</span>
                </div>
            </div>
        `;
        
        performanceList.appendChild(item);
    });
}

// Filter report table
function filterReportTable() {
    const searchTerm = document.getElementById('report-search')?.value.toLowerCase() || '';
    const filterValue = document.getElementById('report-filter')?.value || 'all';
    
    const tableRows = document.querySelectorAll('#reports-table-body tr');
    
    tableRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const equipmentName = cells[1]?.textContent.toLowerCase() || '';
        const type = cells[2]?.textContent.toLowerCase() || '';
        const status = cells[3]?.textContent.toLowerCase() || '';
        
        const matchesSearch = equipmentName.includes(searchTerm) || 
                            type.includes(searchTerm) || 
                            status.includes(searchTerm);
        
        const matchesFilter = filterValue === 'all' || status.includes(filterValue);
        
        row.style.display = matchesSearch && matchesFilter ? '' : 'none';
    });
}

// Show loading state
function showLoadingState() {
    const loadingElements = document.querySelectorAll('.loading-placeholder');
    loadingElements.forEach(el => el.style.display = 'block');
    
    const contentElements = document.querySelectorAll('.report-content');
    contentElements.forEach(el => el.style.opacity = '0.5');
}

// Hide loading state
function hideLoadingState() {
    const loadingElements = document.querySelectorAll('.loading-placeholder');
    loadingElements.forEach(el => el.style.display = 'none');
    
    const contentElements = document.querySelectorAll('.report-content');
    contentElements.forEach(el => el.style.opacity = '1');
}

// Generate cost data for chart
function generateCostData(requests) {
    const costByDate = {};
    
    requests.forEach(request => {
        const date = new Date(request.created_at || request.date_created);
        const dateKey = date.toISOString().split('T')[0];
        const cost = parseFloat(request.actual_cost || request.estimated_cost || 0);
        
        if (!costByDate[dateKey]) {
            costByDate[dateKey] = 0;
        }
        costByDate[dateKey] += cost;
    });
    
    return Object.entries(costByDate)
        .sort(([a], [b]) => new Date(a) - new Date(b))
        .map(([date, cost]) => ({
            date: new Date(date),
            value: cost
        }));
}

// Export report to PDF
function exportReportToPDF() {
    // Simple implementation - in a real app, you'd use a library like jsPDF
    const reportContent = document.querySelector('.reports-view');
    if (!reportContent) return;
    
    // Create a new window with the report content
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Maintenance Report</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
                    .metric-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
                    .metric-value { font-size: 24px; font-weight: bold; color: #3b82f6; }
                    .metric-label { color: #6b7280; margin-top: 5px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f8f9fa; }
                    .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
                    .status-pending { background-color: #fef3c7; color: #92400e; }
                    .status-in-progress { background-color: #dbeafe; color: #1e40af; }
                    .status-completed { background-color: #d1fae5; color: #065f46; }
                    .status-cancelled { background-color: #fee2e2; color: #991b1b; }
                </style>
            </head>
            <body>
                <h1>Maintenance Report</h1>
                <p>Generated on: ${new Date().toLocaleDateString()}</p>
                ${reportContent.innerHTML}
            </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
}

// Generate timeline data
function generateTimelineData(requests) {
    const days = {};
    const now = new Date();
    
    // Initialize days
    for (let i = reportsData.currentPeriod - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        days[dateStr] = 0;
    }
    
    // Count requests per day
    requests.forEach(request => {
        const date = new Date(request.created_at || request.date_created);
        const dateStr = date.toISOString().split('T')[0];
        if (days.hasOwnProperty(dateStr)) {
            days[dateStr]++;
        }
    });
    
    return Object.entries(days).map(([date, count]) => ({
        date,
        value: count
    }));
}

// Edit Request Modal Functions
function showEditRequestModal(requestId) {
    const request = maintenanceRequests.find(r => r.id === requestId);
    if (!request) {
        showNotification('Request not found', 'error');
        return;
    }

    // Populate form fields
    document.getElementById('editRequestId').value = request.id;
    document.getElementById('editTitle').value = request.title || '';
    document.getElementById('editDescription').value = request.description || '';
    document.getElementById('editPriority').value = request.priority || 'medium';
    
    // Format date for input field
    if (request.due_date) {
        const dueDate = new Date(request.due_date);
        document.getElementById('editDueDate').value = dueDate.toISOString().split('T')[0];
    } else {
        document.getElementById('editDueDate').value = '';
    }
    
    document.getElementById('editEstimatedCost').value = request.estimated_cost || '';
    document.getElementById('editEstimatedHours').value = request.estimated_hours || '';
    document.getElementById('editPartsNeeded').value = request.parts_needed || '';

    // Show modal
    document.getElementById('editRequestModal').style.display = 'block';
}

function hideEditRequestModal() {
    document.getElementById('editRequestModal').style.display = 'none';
    document.getElementById('editRequestForm').reset();
}

async function submitEditRequest(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const requestId = formData.get('requestId');
    
    const updateData = {
        title: formData.get('title'),
        description: formData.get('description'),
        priority: formData.get('priority'),
        due_date: formData.get('dueDate') || null,
        estimated_cost: formData.get('estimatedCost') ? parseFloat(formData.get('estimatedCost')) : null,
        estimated_hours: formData.get('estimatedHours') ? parseFloat(formData.get('estimatedHours')) : null,
        parts_needed: formData.get('partsNeeded') || null
    };

    try {
        const response = await fetch(`/api/maintenance-requests/${requestId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });

        if (response.ok) {
            const updatedRequest = await response.json();
            showNotification('Request updated successfully', 'success');
            hideEditRequestModal();
            
            // Update the request in the local array
            const index = maintenanceRequests.findIndex(r => r.id === parseInt(requestId));
            if (index !== -1) {
                maintenanceRequests[index] = { ...maintenanceRequests[index], ...updatedRequest };
            }
            
            // Refresh the display
            filterRequests();
            
            // If details modal is open, refresh it
            const detailsModal = document.getElementById('requestDetailsModal');
            if (detailsModal.style.display === 'block') {
                showRequestDetails(requestId);
            }
        } else {
            const error = await response.text();
            showNotification(`Failed to update request: ${error}`, 'error');
        }
    } catch (error) {
        console.error('Error updating request:', error);
        showNotification('Error updating request', 'error');
    }
}

// Upload Receipt Modal Functions
function showUploadReceiptModal(requestId) {
    document.getElementById('receiptRequestId').value = requestId;
    document.getElementById('uploadReceiptModal').style.display = 'block';
}

function hideUploadReceiptModal() {
    document.getElementById('uploadReceiptModal').style.display = 'none';
    document.getElementById('uploadReceiptForm').reset();
    document.getElementById('receiptPreview').innerHTML = '';
}

function previewReceiptFiles(input) {
    const previewContainer = document.getElementById('receiptPreview');
    previewContainer.innerHTML = '';
    
    if (input.files && input.files.length > 0) {
        Array.from(input.files).forEach((file, index) => {
            const filePreview = document.createElement('div');
            filePreview.className = 'file-preview-item';
            filePreview.innerHTML = `
                <div class="file-info">
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">(${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
                <button type="button" class="remove-file-btn" onclick="removePreviewFile(${index})">×</button>
            `;
            previewContainer.appendChild(filePreview);
        });
    }
}

function removePreviewFile(index) {
    const fileInput = document.getElementById('receiptFiles');
    const dt = new DataTransfer();
    
    Array.from(fileInput.files).forEach((file, i) => {
        if (i !== index) {
            dt.items.add(file);
        }
    });
    
    fileInput.files = dt.files;
    previewReceiptFiles(fileInput);
}

async function submitReceiptUpload(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const requestId = formData.get('requestId');
    
    if (!formData.get('files') || formData.getAll('files').length === 0) {
        showNotification('Please select at least one file', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/maintenance-requests/${requestId}/upload`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            showNotification('Files uploaded successfully', 'success');
            hideUploadReceiptModal();
            
            // If details modal is open, refresh it to show new attachments
            const detailsModal = document.getElementById('requestDetailsModal');
            if (detailsModal.style.display === 'block') {
                showRequestDetails(requestId);
            }
        } else {
            const error = await response.text();
            showNotification(`Failed to upload files: ${error}`, 'error');
        }
    } catch (error) {
        console.error('Error uploading files:', error);
        showNotification('Error uploading files', 'error');
    }
}

// Function to update equipment usage (hours and miles)
async function updateEquipmentUsage(equipmentId, currentHours, currentMiles) {
    try {
        const updateData = {};
        
        if (currentHours && currentHours.trim() !== '') {
            updateData.current_hours = parseFloat(currentHours);
        }
        
        if (currentMiles && currentMiles.trim() !== '') {
            updateData.current_miles = parseFloat(currentMiles);
        }
        
        // Only make the API call if we have data to update
        if (Object.keys(updateData).length > 0) {
            const response = await fetch(`/api/equipment/${equipmentId}/usage`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });
            
            if (!response.ok) {
                console.warn('Failed to update equipment usage:', await response.text());
            }
        }
    } catch (error) {
        console.error('Error updating equipment usage:', error);
    }
}