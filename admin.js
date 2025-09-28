// Admin JavaScript functionality
let workers = [];
let currentUser = null;

// Initialize admin page
document.addEventListener('DOMContentLoaded', function() {
    loadWorkers();
    loadCurrentUser();
    setupPasswordChangeForm();
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
    document.getElementById(sectionName + '-section').style.display = 'block';
    
    // Add active class to clicked button
    event.target.classList.add('active');
}

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