// Global variables
let map;
let jobs = [];
let equipment = [];
let selectedLocation = null;
let jobMarkers = [];
let equipmentMarkers = [];
let drawingManager = null;
let currentDrawingMode = null;
let currentJobId = null;
let jobAnnotations = {}
let annotationFetchPromises = {}; // Deduplicate per-job annotation fetches
// Debug logging control for main app
const DEBUG_LOGS = (typeof window !== 'undefined' && window.localStorage && localStorage.getItem('debugLogs') === 'true');
const debugLog = (...args) => { if (DEBUG_LOGS) console.log(...args); };

// Load worker info for display in info window
// Load worker info for job list items (simplified version without DOM manipulation)
async function getWorkerInfoForJobList(workerId) {
    if (!workerId) {
        return 'Not assigned';
    }
    
    try {
        const apiUrl = `/api/workers/${workerId}`;
            
        const response = await fetch(apiUrl, {
            credentials: 'include'
        });
        
        if (response.status === 401) {
            return 'Login required';
        }
        
        if (!response.ok) {
            return 'Error loading worker';
        }
        
        const worker = await response.json();
        const primaryRole = Array.isArray(worker.roles) && worker.roles.length > 0 
            ? worker.roles[0] 
            : 'Worker';
        
        return `${worker.name} (${primaryRole})`;
    } catch (error) {
        console.error('Error loading worker info for job list:', error);
        return 'Error loading worker';
    }
}

async function loadWorkerInfo(workerId, jobId) {
    // Check if workerId is valid
    if (!workerId || workerId === 'null' || workerId === 'undefined') {
        console.log('loadWorkerInfo: Invalid workerId:', workerId);
        return;
    }
    
    console.log(`loadWorkerInfo: Loading worker ${workerId} for job ${jobId}`);
    
    try {
        const apiUrl = `/api/workers/${workerId}`;
        
        console.log('loadWorkerInfo: Making request to:', apiUrl);
        
        const response = await fetch(apiUrl, {
            credentials: 'include'
        });
        
        console.log('loadWorkerInfo: Response status:', response.status);
        
        if (response.ok) {
            const worker = await response.json();
            console.log('loadWorkerInfo: Worker data received:', worker);
            
            const workerElement = document.getElementById(`worker-${jobId}`);
            
            if (workerElement) {
                // Handle roles array - get the first role or default to 'Worker'
                const role = worker.roles && Array.isArray(worker.roles) && worker.roles.length > 0 
                    ? worker.roles[0] 
                    : 'Worker';
                workerElement.textContent = `${worker.name} (${role})`;
                workerElement.style.color = '#28a745';
                workerElement.style.fontWeight = '600';
                console.log('loadWorkerInfo: Worker info updated successfully');
            } else {
                console.log('loadWorkerInfo: Worker element not found:', `worker-${jobId}`);
            }
        } else if (response.status === 401) {
            console.log('loadWorkerInfo: Authentication required');
            const workerElement = document.getElementById(`worker-${jobId}`);
            if (workerElement) {
                workerElement.textContent = 'Login required to view worker';
                workerElement.style.color = '#6c757d';
                workerElement.style.fontStyle = 'italic';
            }
        } else {
            console.log('loadWorkerInfo: Worker not found or other error, status:', response.status);
            const errorText = await response.text();
            console.log('loadWorkerInfo: Error response:', errorText);
            const workerElement = document.getElementById(`worker-${jobId}`);
            if (workerElement) {
                workerElement.textContent = 'Worker not found';
                workerElement.style.color = '#dc3545';
            }
        }
    } catch (error) {
        console.error('Error loading worker info for job list: TypeError: Failed to fetch', error);
        console.error('loadWorkerInfo: Full error details:', error);
        const workerElement = document.getElementById(`worker-${jobId}`);
        if (workerElement) {
            workerElement.textContent = 'Error loading worker';
            workerElement.style.color = '#dc3545';
        }
    }
}

// Show worker assignment modal
async function showWorkerAssignmentModal(jobId) {
    const job = jobs.find(j => j.id == jobId);
    if (!job) return;
    
    // Create modal HTML
    const modalHTML = `
        <div id="workerAssignmentModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 20px; border-radius: 8px; max-width: 400px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                <h3 style="margin: 0 0 15px 0; color: #333;">Assign Worker to Job</h3>
                <p style="margin: 0 0 15px 0; color: #666;"><strong>Job:</strong> ${job.title}</p>
                
                <div style="margin-bottom: 15px;">
                    <label for="workerSelect" style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">Select Worker:</label>
                    <select id="workerSelect" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                        <option value="">No worker assigned</option>
                    </select>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="closeWorkerAssignmentModal()" style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Cancel
                    </button>
                    <button onclick="assignWorkerToJob(${jobId})" style="padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        Assign Worker
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Load workers into dropdown
    try {
    const apiUrl = '/api/workers';
        const response = await fetch(apiUrl, {
            credentials: 'include'
        });
        if (response.ok) {
            const workers = await response.json();
            const select = document.getElementById('workerSelect');
            
            workers.forEach(worker => {
                const option = document.createElement('option');
                option.value = worker.id;
                // Extract role from roles array or default to 'Worker'
                const role = Array.isArray(worker.roles) && worker.roles.length > 0 
                    ? worker.roles[0] 
                    : 'Worker';
                option.textContent = `${worker.name} (${role})`;
                if (job.assignedWorkerId && job.assignedWorkerId == worker.id) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading workers:', error);
        showNotification('Error loading workers');
    }
}

// Close worker assignment modal
function closeWorkerAssignmentModal() {
    const modal = document.getElementById('workerAssignmentModal');
    if (modal) {
        modal.remove();
    }
}

// Assign worker to job
async function assignWorkerToJob(jobId) {
    const select = document.getElementById('workerSelect');
    const workerId = select.value || null;
    
    try {
    const apiUrl = `/api/jobs/${jobId}`;
        
        const formData = new FormData();
        formData.append('assignedWorkerId', workerId || '');
        
        const response = await fetch(apiUrl, {
            method: 'PUT',
            credentials: 'include',
            body: formData
        });
        
        if (response.ok) {
            // Update local job data
            const job = jobs.find(j => j.id == jobId);
            if (job) {
                job.assignedWorkerId = workerId;
            }
            
            // Close modal
            closeWorkerAssignmentModal();
            
            // Refresh the info window to show updated assignment
            refreshJobInfoWindow(jobId);
            
            // Show success notification
            const workerText = workerId ? 'assigned' : 'unassigned';
            showNotification(`Worker ${workerText} successfully`);
        } else {
            throw new Error('Failed to update job assignment');
        }
    } catch (error) {
        console.error('Error assigning worker:', error);
        showNotification('Error updating worker assignment');
    }
}; // Store annotations by job ID
let isJobEditMode = false; // Track if we're in job edit mode
let modifiedAnnotations = new Set(); // Track annotations that have been modified
let annotationEditStates = {}; // Track edit state for each annotation
let connectionLines = {}; // Store connection lines between job markers and annotations
let currentDraggingJobId = null; // Track which job is currently being dragged
let originalJobPositions = {}; // Store original positions for reset functionality

// Show professional annotation edit modal
function showAnnotationEditModal(annotation, currentColor, defaultColor, onSave, onCancel) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 3000;
        display: flex;
        justify-content: center;
        align-items: center;
    `;
    
    // Create modal dialog
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 30px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        max-width: 450px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
    `;
    
    modal.innerHTML = `
        <h3 style="margin: 0 0 20px 0; color: #333; font-size: 1.4rem; text-align: center;">
            Edit ${annotation.annotation_type.charAt(0).toUpperCase() + annotation.annotation_type.slice(1)}
        </h3>
        
        <div style="margin-bottom: 20px;">
            <span class="detail-label" style="display: block; margin-bottom: 8px; color: #555; font-weight: 500;">Name:</span>
            <input type="text" id="annotationName" value="${annotation.name}" style="
                width: 100%;
                padding: 12px;
                border: 2px solid #e1e5e9;
                border-radius: 8px;
                font-size: 14px;
                box-sizing: border-box;
                transition: border-color 0.2s;
            " placeholder="Enter annotation name">
        </div>
        
        <div style="margin-bottom: 20px;">
            <span class="detail-label" style="display: block; margin-bottom: 8px; color: #555; font-weight: 500;">Description:</span>
            <textarea id="annotationDescription" style="
                width: 100%;
                padding: 12px;
                border: 2px solid #e1e5e9;
                border-radius: 8px;
                font-size: 14px;
                box-sizing: border-box;
                resize: vertical;
                min-height: 80px;
                transition: border-color 0.2s;
            " placeholder="Enter description (optional)">${annotation.description || ''}</textarea>
        </div>
        
        <div style="margin-bottom: 25px;">
            <span class="detail-label" style="display: block; margin-bottom: 8px; color: #555; font-weight: 500;">Color:</span>
            <div style="display: flex; align-items: center; gap: 12px;">
                <input type="color" id="annotationColor" value="${currentColor}" style="
                    width: 50px;
                    height: 40px;
                    border: 2px solid #e1e5e9;
                    border-radius: 8px;
                    cursor: pointer;
                    background: none;
                ">
                <button type="button" id="resetColorBtn" style="
                    padding: 8px 12px;
                    background: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: background-color 0.2s;
                ">Reset to Job Color</button>
            </div>
            <small style="color: #666; font-size: 12px; margin-top: 4px; display: block;">
                Job default color: <span style="display: inline-block; width: 16px; height: 16px; background: ${defaultColor}; border: 1px solid #ccc; border-radius: 3px; vertical-align: middle; margin-left: 4px;"></span>
            </small>
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button id="cancelBtn" style="
                padding: 12px 20px;
                border: 2px solid #6c757d;
                background: transparent;
                color: #6c757d;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            ">Cancel</button>
            <button id="saveBtn" style="
                padding: 12px 20px;
                border: none;
                background: #007bff;
                color: white;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: background-color 0.2s;
            ">Save Changes</button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Add focus styles
    const nameInput = modal.querySelector('#annotationName');
    const descInput = modal.querySelector('#annotationDescription');
    const colorInput = modal.querySelector('#annotationColor');
    
    [nameInput, descInput].forEach(input => {
        input.addEventListener('focus', () => {
            input.style.borderColor = '#007bff';
        });
        input.addEventListener('blur', () => {
            input.style.borderColor = '#e1e5e9';
        });
    });
    
    // Reset color button functionality
    modal.querySelector('#resetColorBtn').addEventListener('click', () => {
        colorInput.value = defaultColor;
    });
    
    // Save button functionality
    modal.querySelector('#saveBtn').addEventListener('click', () => {
        const updatedData = {
            name: nameInput.value.trim(),
            description: descInput.value.trim(),
            color: colorInput.value
        };
        
        if (!updatedData.name) {
            nameInput.style.borderColor = '#dc3545';
            nameInput.focus();
            return;
        }
        
        document.body.removeChild(overlay);
        onSave(updatedData);
    });
    
    // Cancel button functionality
    modal.querySelector('#cancelBtn').addEventListener('click', () => {
        document.body.removeChild(overlay);
        onCancel();
    });
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
            onCancel();
        }
    });
    
    // Focus on name input
    setTimeout(() => nameInput.focus(), 100);
}

// Update annotation visual color
function updateAnnotationVisualColor(annotation, newColor) {
    if (!annotation.overlay) return;
    
    try {
        if (annotation.annotation_type === 'polygon') {
            annotation.overlay.setOptions({
                fillColor: newColor,
                strokeColor: newColor
            });
        } else if (annotation.annotation_type === 'line') {
            annotation.overlay.setOptions({
                strokeColor: newColor
            });
        } else if (annotation.annotation_type === 'pin') {
            // For AdvancedMarkerElement, update the content instead of using setIcon
            annotation.overlay.content = createMarkerContent(newColor);
        }
    } catch (error) {
        console.error('Error updating annotation color:', error);
    }
}

// Initialize Google Maps with async loading
async function initMap() {
    // Import the required libraries
    const { Map } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");
    const { DrawingManager } = await google.maps.importLibrary("drawing");
    const { PlacesService } = await google.maps.importLibrary("places");
    
    // Store the imported classes globally for use in other functions
    window.AdvancedMarkerElement = AdvancedMarkerElement;
    window.PinElement = PinElement;
    window.DrawingManager = DrawingManager;
    window.PlacesService = PlacesService;
    
    // Default location centered on Joplin, Missouri
    const defaultLocation = { lat: 37.0842, lng: -94.5133 }; // Joplin, MO
    
    map = new Map(document.getElementById('map'), {
        zoom: 10,
        center: defaultLocation,
        mapId: "DEMO_MAP_ID", // Required for advanced markers
        mapTypeId: 'roadmap',
        tilt: 0, // Disable map tilt when zooming in
        gestureHandling: 'greedy', // Allow direct zoom/pan without modifier keys
        zoomControl: true, // Enable zoom controls (+ and - buttons)
        mapTypeControl: false, // Disable default map type controls - using custom draggable bar instead
        fullscreenControl: true, // Enable fullscreen control
        fullscreenControlOptions: {
            position: google.maps.ControlPosition.RIGHT_CENTER
        },
        styles: [
            {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
            }
        ]
    });

    // Initialize Google Places Autocomplete
    await initializeAddressSearch();

    // Initialize drawing manager
    drawingManager = new DrawingManager({
        drawingMode: null,
        drawingControl: false, // We'll use custom controls
        drawingControlOptions: {
            position: google.maps.ControlPosition.TOP_CENTER,
            drawingModes: [
                google.maps.drawing.OverlayType.POLYGON,
                google.maps.drawing.OverlayType.POLYLINE,
                google.maps.drawing.OverlayType.MARKER
            ]
        },
        polygonOptions: {
            fillColor: '#FF0000',
            fillOpacity: 0.35,
            strokeWeight: 2,
            strokeColor: '#FF0000',
            clickable: true,
            editable: true,
            zIndex: 1
        },
        polylineOptions: {
            strokeColor: '#0000FF',
            strokeOpacity: 1.0,
            strokeWeight: 3,
            clickable: true,
            editable: true
        },
        markerOptions: {
            draggable: true,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#FF0000',
                fillOpacity: 1,
                strokeColor: '#FFFFFF',
                strokeWeight: 2
            }
        }
    });

    drawingManager.setMap(map);

    // Add drawing event listeners
    drawingManager.addListener('overlaycomplete', handleDrawingComplete);

    // Add click listener to map
    map.addListener('click', function(event) {
        handleMapClick(event.latLng);
    });

    // Load existing jobs from Neon database
    await loadJobs();
}

// Initialize Google Places Autocomplete for address search
async function initializeAddressSearch() {
    try {
        const input = document.getElementById('addressSearchInput');
        const clearBtn = document.getElementById('clearSearchBtn');
        
        if (!input) {
            console.warn('Address search input not found');
            return;
        }

        // Create autocomplete instance
        const autocomplete = new google.maps.places.Autocomplete(input, {
            types: ['geocode'], // Use geocode instead of mixing address with other types
            componentRestrictions: { country: 'us' }, // Restrict to US addresses
            fields: ['place_id', 'geometry', 'name', 'formatted_address']
        });

        // Store autocomplete instance globally
        window.addressAutocomplete = autocomplete;

        // Handle place selection
        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            
            if (!place.geometry || !place.geometry.location) {
                showNotification('No location data available for this address');
                return;
            }

            // Center map on selected location
            const location = place.geometry.location;
            map.setCenter(location);
            
            // Adjust zoom based on place type
            let zoom = 16;
            if (place.types && place.types.includes && place.types.includes('locality') || 
                place.types && place.types.includes && place.types.includes('administrative_area_level_1')) {
                zoom = 12;
            } else if (place.types && place.types.includes && place.types.includes('country')) {
                zoom = 6;
            }
            map.setZoom(zoom);

            // Show clear button
            clearBtn.style.display = 'flex';
            
            // Optional: Add a temporary marker at the searched location
            createTemporarySearchMarker(location, place.name || place.formatted_address);
            
            showNotification(`Navigated to: ${place.formatted_address || place.name}`);
        });

        // Handle clear button
        clearBtn.addEventListener('click', () => {
            input.value = '';
            clearBtn.style.display = 'none';
            clearTemporarySearchMarker();
            input.focus();
        });

        // Show/hide clear button based on input content
        input.addEventListener('input', () => {
            if (input.value.trim() === '') {
                clearBtn.style.display = 'none';
                clearTemporarySearchMarker();
            }
        });

        // Handle keyboard shortcuts
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                input.blur();
                clearBtn.style.display = 'none';
                clearTemporarySearchMarker();
            }
        });

    } catch (error) {
        console.error('Error initializing address search:', error);
        showNotification('Address search unavailable');
    }
}

// Global variable to store temporary search marker
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

let temporarySearchMarker = null;

// Create a temporary marker for searched location
function createTemporarySearchMarker(location, title) {
    // Clear any existing temporary marker
    clearTemporarySearchMarker();
    
    try {
        // Create a distinctive marker for search results
        temporarySearchMarker = new google.maps.marker.AdvancedMarkerElement({
            position: location,
            map: map,
            title: title,
            content: createMarkerContent('#4285f4')
        });

        // Auto-remove the marker after 10 seconds
        setTimeout(() => {
            clearTemporarySearchMarker();
        }, 10000);
        
    } catch (error) {
        console.error('Error creating temporary search marker:', error);
    }
}

// Clear temporary search marker
function clearTemporarySearchMarker() {
    if (temporarySearchMarker) {
        temporarySearchMarker.setMap(null);
        temporarySearchMarker = null;
    }
}

// Start drawing mode for annotations
function startDrawing(type, jobId) {
    currentJobId = jobId;
    currentDrawingMode = type;
    
    // Find the job to get its color
    const job = jobs.find(j => j.id === jobId);
    const jobColor = job ? (job.markerColor || job.marker_color || getMarkerColor(job.type)) : '#FF0000';
    
    // Close any open info windows
    jobMarkers.forEach(markerData => {
        if (markerData.infoWindow) {
            markerData.infoWindow.close();
        }
    });
    
    // Set drawing mode and update colors based on type
    switch(type) {
        case 'polygon':
            drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
            drawingManager.setOptions({
                polygonOptions: {
                    fillColor: jobColor,
                    fillOpacity: 0.35,
                    strokeWeight: 2,
                    strokeColor: jobColor,
                    clickable: true,
                    editable: true,
                    zIndex: 1
                }
            });
            break;
        case 'line':
            drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYLINE);
            drawingManager.setOptions({
                polylineOptions: {
                    strokeColor: jobColor,
                    strokeOpacity: 1.0,
                    strokeWeight: 3,
                    clickable: true,
                    editable: true
                }
            });
            break;
        case 'pin':
            drawingManager.setDrawingMode(google.maps.drawing.OverlayType.MARKER);
            drawingManager.setOptions({
                markerOptions: {
                    draggable: true,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: jobColor,
                        fillOpacity: 1,
                        strokeColor: '#FFFFFF',
                        strokeWeight: 2
                    }
                }
            });
            break;
    }
    
    showNotification(`Click on the map to start drawing a ${type}. Click 'Escape' to cancel.`);
}

// Handle completed drawings
async function handleDrawingComplete(event) {
    const overlay = event.overlay;
    const type = event.type;
    
    // Stop drawing mode
    drawingManager.setDrawingMode(null);
    
    if (!currentJobId) {
        showNotification('Error: No job selected for annotation');
        overlay.setMap(null);
        return;
    }
    
    // Extract coordinates based on type
    let coordinates = [];
    let annotationType = '';
    
    switch(type) {
        case google.maps.drawing.OverlayType.POLYGON:
            annotationType = 'polygon';
            const polygonPath = overlay.getPath();
            for (let i = 0; i < polygonPath.getLength(); i++) {
                const point = polygonPath.getAt(i);
                coordinates.push({ lat: point.lat(), lng: point.lng() });
            }
            break;
            
        case google.maps.drawing.OverlayType.POLYLINE:
            annotationType = 'line';
            const polylinePath = overlay.getPath();
            for (let i = 0; i < polylinePath.getLength(); i++) {
                const point = polylinePath.getAt(i);
                coordinates.push({ lat: point.lat(), lng: point.lng() });
            }
            break;
            
        case google.maps.drawing.OverlayType.MARKER:
            annotationType = 'pin';
            const position = overlay.getPosition();
            coordinates = [{ lat: position.lat(), lng: position.lng() }];
            break;
    }
    
    // Prompt for annotation details
    const name = await showInputDialog(`Enter a name for this ${annotationType}:`, 'Name:', 'Enter name...');
    if (!name) {
        overlay.setMap(null);
        return;
    }
    
    const description = await showInputDialog(`Enter a description for this ${annotationType} (optional):`, 'Description:', 'Enter description...');
    
    try {
        // Save annotation to database
        const annotation = {
            annotationType: type,
            name: name,
            description: description || '',
            coordinates: coordinates,
            styleOptions: getStyleOptions(overlay, type)
        };
        
        try {
    const apiUrl = `/api/jobs/${currentJobId}/annotations`;
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(annotation)
            });
            
            if (!response.ok) {
                throw new Error('Failed to create annotation');
            }
            
            const savedAnnotation = await response.json();
        } catch (error) {
            console.error('Error creating annotation:', error);
            showNotification('Failed to create annotation');
            return;
        }
        
        // Store annotation locally
        if (!jobAnnotations[currentJobId]) {
            jobAnnotations[currentJobId] = [];
        }
        jobAnnotations[currentJobId].push({
            ...savedAnnotation,
            overlay: overlay
        });
        
        // Add click listener to overlay for editing/deleting
        addAnnotationListeners(overlay, savedAnnotation);
        
        // Make sure the newly created annotation is not immediately editable
        // even if we're in edit mode - user needs to explicitly click to edit
        if (overlay.setEditable) {
            overlay.setEditable(false);
        }
        
        showNotification(`${annotationType.charAt(0).toUpperCase() + annotationType.slice(1)} "${name}" created successfully!`);
        
    } catch (error) {
        console.error('Error saving annotation:', error);
        console.error('Error details:', error.message);
        console.error('Current job ID:', currentJobId);
        console.error('Annotation data:', {
            annotationType: annotationType,
            name: name,
            description: description || '',
            coordinates: coordinates,
            styleOptions: getStyleOptions(overlay, type)
        });
        showNotification(`Error saving annotation: ${error.message}. Please try again.`);
        overlay.setMap(null);
    }
    
    // Reset drawing state (but keep currentJobId for continued editing)
    currentDrawingMode = null;
}

// Get style options from overlay
function getStyleOptions(overlay, type) {
    const options = {};
    
    switch(type) {
        case google.maps.drawing.OverlayType.POLYGON:
            options.fillColor = overlay.get('fillColor');
            options.fillOpacity = overlay.get('fillOpacity');
            options.strokeColor = overlay.get('strokeColor');
            options.strokeWeight = overlay.get('strokeWeight');
            break;
            
        case google.maps.drawing.OverlayType.POLYLINE:
            options.strokeColor = overlay.get('strokeColor');
            options.strokeOpacity = overlay.get('strokeOpacity');
            options.strokeWeight = overlay.get('strokeWeight');
            break;
            
        case google.maps.drawing.OverlayType.MARKER:
            // Marker options are handled differently
            break;
    }
    
    return options;
}

// Add listeners to annotations for interaction
function addAnnotationListeners(overlay, annotation) {
    overlay.addListener('click', function() {
        showAnnotationInfoWindow(overlay, annotation);
    });
}

// Show annotation info window with edit/delete options
function showAnnotationInfoWindow(overlay, annotation) {
    // Check if annotation is in edit state
    const isInEditState = annotationEditStates[annotation.id] === 'editing';
    const hasUnsavedChanges = modifiedAnnotations.has(annotation.id);
    
    // Determine button style and text based on state
    let editButtonStyle, editButtonText, editButtonAction;
    
    if (isInEditState && hasUnsavedChanges) {
        // Show save button (green)
        editButtonStyle = "padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;";
        editButtonText = "💾 Save Changes";
        editButtonAction = `saveAnnotationChanges(${annotation.id})`;
    } else if (isInEditState) {
        // Show editing state (orange)
        editButtonStyle = "padding: 6px 12px; background: #fd7e14; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;";
        editButtonText = "✏️ Editing...";
        editButtonAction = `finishEditingAnnotation(${annotation.id})`;
    } else {
        // Show normal edit button (blue)
        editButtonStyle = "padding: 6px 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;";
        editButtonText = "✏️ Edit";
        editButtonAction = `editAnnotation(${annotation.id})`;
    }
    
    // Create info window content
    const content = `
        <div style="max-width: 250px; padding: 10px;">
            <h4 style="margin: 0 0 8px 0; color: #333;">${annotation.name}</h4>
            <p style="margin: 0 0 12px 0; color: #666; font-size: 14px;">${annotation.description || 'No description'}</p>
            <div style="display: flex; gap: 8px;">
                <button onclick="${editButtonAction}" style="${editButtonStyle}">
                    ${editButtonText}
                </button>
                <button onclick="confirmDeleteAnnotation(${annotation.id}, '${annotation.name}')" style="padding: 6px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    🗑️ Delete
                </button>
            </div>
            ${hasUnsavedChanges ? '<p style="margin: 8px 0 0 0; color: #fd7e14; font-size: 11px; font-style: italic;">⚠️ Unsaved changes</p>' : ''}
        </div>
    `;
    
    // Create and show info window
    const infoWindow = new google.maps.InfoWindow({
        content: content
    });
    
    // Position the info window
    let position;
    if (overlay.getPosition) {
        // For markers
        position = overlay.getPosition();
    } else if (overlay.getPath) {
        // For polylines - use first point
        const path = overlay.getPath();
        position = path.getAt(0);
    } else if (overlay.getPaths) {
        // For polygons - use first point of first path
        const paths = overlay.getPaths();
        const firstPath = paths.getAt(0);
        position = firstPath.getAt(0);
    }
    
    infoWindow.setPosition(position);
    infoWindow.open(map);
}

// Edit annotation function
function editAnnotation(annotationId) {
    const annotation = findAnnotationById(annotationId);
    if (!annotation) {
        showNotification('Annotation not found');
        return;
    }
    
    // Get the job to determine default color
    const job = jobs.find(j => j.id === annotation.job_id);
    const defaultColor = job ? (job.markerColor || job.marker_color || getMarkerColor(job.type)) : '#FF0000';
    
    // Get current annotation color from style options
    const currentColor = annotation.style_options?.fillColor || annotation.style_options?.strokeColor || defaultColor;
    
    // Set annotation to editing state
    annotationEditStates[annotationId] = 'editing';
    
    showAnnotationEditModal(annotation, currentColor, defaultColor, (updatedData) => {
        // Check if values actually changed
        const nameChanged = updatedData.name !== annotation.name;
        const descriptionChanged = updatedData.description !== (annotation.description || '');
        const colorChanged = updatedData.color !== currentColor;
        
        if (nameChanged || descriptionChanged || colorChanged) {
            // Mark as modified but don't save yet
            modifiedAnnotations.add(annotationId);
            
            // Update local annotation temporarily
            annotation.name = updatedData.name;
            annotation.description = updatedData.description;
            
            // Update color in style options
            if (!annotation.style_options) {
                annotation.style_options = {};
            }
            
            // Update color based on annotation type
            if (annotation.annotation_type === 'polygon') {
                annotation.style_options.fillColor = updatedData.color;
                annotation.style_options.strokeColor = updatedData.color;
            } else if (annotation.annotation_type === 'line') {
                annotation.style_options.strokeColor = updatedData.color;
            } else if (annotation.annotation_type === 'pin') {
                annotation.style_options.fillColor = updatedData.color;
            }
            
            // Update the visual appearance immediately
            updateAnnotationVisualColor(annotation, updatedData.color);
            
            showNotification('Changes made - click "Save Changes" to save to database');
        } else {
            // No changes made
            delete annotationEditStates[annotationId];
            showNotification('No changes made');
        }
    }, () => {
        // User cancelled - remove editing state
        delete annotationEditStates[annotationId];
    });
}

// Save annotation changes to database
async function saveAnnotationChanges(annotationId) {
    const annotation = findAnnotationById(annotationId);
    if (!annotation) {
        showNotification('Annotation not found');
        return;
    }
    
    try {
        // Get current color from style options
        const currentColor = annotation.style_options?.fillColor || annotation.style_options?.strokeColor || '#FF0000';
        
        await updateAnnotation(annotationId, annotation.name, annotation.description, currentColor);
        
        // Clear modification tracking
        modifiedAnnotations.delete(annotationId);
        delete annotationEditStates[annotationId];
        
        showNotification('Annotation saved successfully!');
    } catch (error) {
        console.error('Error saving annotation:', error);
        showNotification('Error saving annotation. Please try again.');
    }
}

// Finish editing annotation without saving
function finishEditingAnnotation(annotationId) {
    const annotation = findAnnotationById(annotationId);
    if (!annotation) {
        showNotification('Annotation not found');
        return;
    }
    
    // If there are unsaved changes, ask user what to do
    if (modifiedAnnotations.has(annotationId)) {
        const shouldSave = confirm('You have unsaved changes. Do you want to save them?');
        if (shouldSave) {
            saveAnnotationChanges(annotationId);
        } else {
            // Revert changes - reload from database
            revertAnnotationChanges(annotationId);
        }
    } else {
        // No changes to save, just exit editing mode
        delete annotationEditStates[annotationId];
        showNotification('Editing finished');
    }
}

// Revert annotation changes
async function revertAnnotationChanges(annotationId) {
    try {
        // Reload annotation from database
        const jobId = currentJobId;
        if (jobId) {
            // Clear local state
            modifiedAnnotations.delete(annotationId);
            delete annotationEditStates[annotationId];
            
            // Reload annotations for this job
            await loadJobAnnotations(jobId);
            showNotification('Changes reverted');
        }
    } catch (error) {
        console.error('Error reverting annotation:', error);
        showNotification('Error reverting changes');
    }
}

// Confirm delete annotation with safer dialog
function confirmDeleteAnnotation(annotationId, annotationName) {
    const confirmed = confirm(`Are you sure you want to delete the annotation "${annotationName}"?\n\nThis action cannot be undone.`);
    if (confirmed) {
        const annotation = findAnnotationById(annotationId);
        if (annotation) {
            deleteAnnotation(annotationId, annotation.overlay);
        }
    }
}

// Find annotation by ID
function findAnnotationById(annotationId) {
    for (const jobId in jobAnnotations) {
        const annotation = jobAnnotations[jobId].find(ann => ann.id === annotationId);
        if (annotation) return annotation;
    }
    return null;
}

// Update annotation
async function updateAnnotation(annotationId, name, description, color) {
    try {
        // Get current annotation to update style options with new color
        const annotation = findAnnotationById(annotationId);
        if (!annotation) {
            throw new Error('Annotation not found');
        }
        
        // Update style options with new color
        const updatedStyleOptions = {
            ...annotation.style_options,
            fillColor: color,
            strokeColor: color
        };
        
        const apiUrl = `/api/annotations/${annotationId}`;
        
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ 
                name, 
                description, 
                coordinates: annotation.coordinates,
                styleOptions: updatedStyleOptions 
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update annotation');
        }
        
        const updatedAnnotation = await response.json();
        
        // Update local annotation
        annotation.name = name;
        annotation.description = description;
        annotation.style_options = updatedStyleOptions;
        
        // Update visual appearance
        updateAnnotationVisualColor(annotation, color);
        
        showNotification('Annotation updated successfully!');
    } catch (error) {
        console.error('Error updating annotation:', error);
        showNotification('Error updating annotation. Please try again.');
    }
}

// Delete annotation
async function deleteAnnotation(annotationId, overlay) {
    try {
        const apiUrl = `/api/annotations/${annotationId}`;
        
        const response = await fetch(apiUrl, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete annotation');
        }
        
        overlay.setMap(null);
        
        // Remove from local storage
        for (const jobId in jobAnnotations) {
            jobAnnotations[jobId] = jobAnnotations[jobId].filter(ann => ann.id !== annotationId);
        }
        
        showNotification('Annotation deleted successfully!');
    } catch (error) {
        console.error('Error deleting annotation:', error);
        showNotification('Error deleting annotation. Please try again.');
    }
}

// Load and display existing annotations for a job (deduplicated per job)
async function loadJobAnnotations(jobId) {
    // If a fetch for this job is already in flight, reuse it
    if (annotationFetchPromises[jobId]) {
        return annotationFetchPromises[jobId];
    }

    const fetchPromise = (async () => {
        try {
            const apiUrl = `/api/jobs/${jobId}/annotations`;
            const response = await fetch(apiUrl, { credentials: 'include' });

            if (!response.ok) {
                throw new Error(`Failed to load annotations (status ${response.status})`);
            }

            const annotations = await response.json();

            // Clear any existing overlays to avoid duplicates
            clearJobAnnotations(jobId);

            if (!jobAnnotations[jobId]) {
                jobAnnotations[jobId] = [];
            }

            annotations.forEach(annotation => {
                const coordinates = annotation.coordinates;
                const styleOptions = annotation.style_options || {};
                let overlay;

                switch (annotation.annotation_type) {
                    case 'polygon':
                        overlay = new google.maps.Polygon({
                            paths: coordinates,
                            fillColor: styleOptions.fillColor || '#FF0000',
                            fillOpacity: styleOptions.fillOpacity || 0.35,
                            strokeColor: styleOptions.strokeColor || '#FF0000',
                            strokeWeight: styleOptions.strokeWeight || 2,
                            map: map,
                            editable: false
                        });
                        break;
                    case 'line':
                        overlay = new google.maps.Polyline({
                            path: coordinates,
                            strokeColor: styleOptions.strokeColor || '#FF0000',
                            strokeOpacity: styleOptions.strokeOpacity || 1.0,
                            strokeWeight: styleOptions.strokeWeight || 2,
                            map: map,
                            editable: false
                        });
                        break;
                    case 'pin':
                        overlay = new google.maps.marker.AdvancedMarkerElement({
                            position: coordinates[0],
                            map: map,
                            title: annotation.name,
                            content: createMarkerContent(styleOptions.fillColor || '#FF0000')
                        });
                        break;
                    default:
                        break;
                }

                if (overlay) {
                    jobAnnotations[jobId].push({ ...annotation, overlay });
                    addAnnotationListeners(overlay, annotation);
                }
            });

            // Create connection lines after all annotations are loaded
            if (jobAnnotations[jobId] && jobAnnotations[jobId].length > 0) {
                createConnectionLines(jobId);
            }
        } catch (error) {
            // Swallow abort-related errors quietly to reduce console noise
            if (error && error.name === 'AbortError') {
                return;
            }
            console.error('Error loading annotations:', error);
        } finally {
            // Clear the in-flight promise reference
            delete annotationFetchPromises[jobId];
        }
    })();

    annotationFetchPromises[jobId] = fetchPromise;
    return fetchPromise;
}

// Enable editing mode for annotations
function enableAnnotationEditing(jobId) {
    isJobEditMode = true;
    
    // Enable dragging for the current job marker
    const jobMarkerData = jobMarkers.find(markerData => markerData.jobId === jobId);
    if (jobMarkerData && jobMarkerData.marker) {
        jobMarkerData.marker.gmpDraggable = true;
    }
    
    // Clear any existing edit states when entering edit mode
    modifiedAnnotations.clear();
    annotationEditStates = {};
    
    if (jobAnnotations[jobId]) {
        jobAnnotations[jobId].forEach(annotation => {
            if (annotation.overlay) {
                if (annotation.annotation_type === 'line' && annotation.overlay.setEditable) {
                    annotation.overlay.setEditable(true);
                    
                    // Add listener for geometry changes
                    annotation.overlay.addListener('path_changed', function() {
                        modifiedAnnotations.add(annotation.id);
                        annotationEditStates[annotation.id] = 'editing';
                        refreshJobInfoWindow(jobId); // Refresh the info window to show changes
                    });
                } else if (annotation.annotation_type === 'polygon' && annotation.overlay.setEditable) {
                    annotation.overlay.setEditable(true);
                    
                    // Add listener for geometry changes
                    annotation.overlay.addListener('paths_changed', function() {
                        modifiedAnnotations.add(annotation.id);
                        annotationEditStates[annotation.id] = 'editing';
                        refreshJobInfoWindow(jobId); // Refresh the info window to show changes
                    });
                }
            }
        });
    }
}

// Disable editing mode for annotations
function disableAnnotationEditing(jobId) {
    isJobEditMode = false;
    
    // Check for unsaved changes before disabling
    if (modifiedAnnotations.size > 0) {
        const shouldSave = confirm(`You have ${modifiedAnnotations.size} unsaved annotation changes. Do you want to save them before exiting edit mode?`);
        if (shouldSave) {
            // Save all modified annotations
            const savePromises = Array.from(modifiedAnnotations).map(annotationId => {
                return saveAnnotationChanges(annotationId);
            });
            
            Promise.all(savePromises).then(() => {
                finishDisablingEditMode(jobId);
            }).catch(error => {
                console.error('Error saving annotations:', error);
                showNotification('Error saving some annotations. Please try again.');
            });
            return;
        } else {
            // Revert all changes
            modifiedAnnotations.clear();
            annotationEditStates = {};
            // Reload annotations to revert any local changes
            loadJobAnnotations(jobId);
        }
    }
    
    finishDisablingEditMode(jobId);
}

// Helper function to complete disabling edit mode
function finishDisablingEditMode(jobId) {
    // Disable dragging for the current job marker
    const jobMarkerData = jobMarkers.find(markerData => markerData.jobId === jobId);
    if (jobMarkerData && jobMarkerData.marker) {
        jobMarkerData.marker.gmpDraggable = false;
    }
    
    if (jobAnnotations[jobId]) {
        jobAnnotations[jobId].forEach(annotation => {
            if (annotation.overlay) {
                if (annotation.annotation_type === 'line' && annotation.overlay.setEditable) {
                    annotation.overlay.setEditable(false);
                } else if (annotation.annotation_type === 'polygon' && annotation.overlay.setEditable) {
                    annotation.overlay.setEditable(false);
                }
            }
        });
    }
    
    // Clear edit states
    modifiedAnnotations.clear();
    annotationEditStates = {};
}

// Clear annotations for a specific job
function clearJobAnnotations(jobId) {
    if (jobAnnotations[jobId]) {
        jobAnnotations[jobId].forEach(annotation => {
            if (annotation.overlay) {
                annotation.overlay.setMap(null);
            }
        });
        jobAnnotations[jobId] = [];
    }
}

// Clear all annotations from map
function clearAllAnnotations() {
    for (const jobId in jobAnnotations) {
        clearJobAnnotations(jobId);
    }
}

// Safely compute a representative position for any overlay type
function getOverlayRepresentativePosition(overlay) {
    try {
        // Marker-like overlays
        if (overlay.getPosition && typeof overlay.getPosition === 'function') {
            const pos = overlay.getPosition();
            if (pos && typeof pos.lat === 'function' && typeof pos.lng === 'function') {
                return pos;
            }
        }

        // Polyline: use midpoint
        if (overlay.getPath && typeof overlay.getPath === 'function') {
            const path = overlay.getPath();
            if (path && typeof path.getLength === 'function' && path.getLength() > 0) {
                const midIndex = Math.floor(path.getLength() / 2);
                return path.getAt(midIndex);
            }
        }

        // Polygon: use bounds center of first path
        if (overlay.getPaths && typeof overlay.getPaths === 'function') {
            const paths = overlay.getPaths();
            if (paths && typeof paths.getLength === 'function' && paths.getLength() > 0) {
                const firstPath = paths.getAt(0);
                const bounds = new google.maps.LatLngBounds();
                for (let i = 0; i < firstPath.getLength(); i++) {
                    bounds.extend(firstPath.getAt(i));
                }
                return bounds.getCenter();
            }
        }
    } catch (e) {
        // Swallow and fall through; caller will skip when null
        if (typeof debugLog === 'function') {
            debugLog('getOverlayRepresentativePosition failed:', e);
        }
    }
    return null;
}

// Create connection lines between job marker and annotations
function createConnectionLines(jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (!job || !jobAnnotations[jobId]) return;
    
    // Find the job marker data
    const jobMarkerData = jobMarkers.find(markerData => markerData.jobId === jobId);
    if (!jobMarkerData || !jobMarkerData.marker) return;
    
    const jobPosition = jobMarkerData.marker.position;
    
    // Clear existing connection lines for this job
    clearConnectionLines(jobId);
    
    if (!connectionLines[jobId]) {
        connectionLines[jobId] = [];
    }
    
    // Create connection lines to each annotation
    jobAnnotations[jobId].forEach(annotation => {
        if (!annotation.overlay) return;

        const annotationPosition = getOverlayRepresentativePosition(annotation.overlay);
        if (!annotationPosition) return;

        // Create a darker dotted connection line
        const connectionLine = new google.maps.Polyline({
            path: [jobPosition, annotationPosition],
            strokeColor: '#333333',
            strokeOpacity: 0.7,
            strokeWeight: 2,
            map: map,
            zIndex: 1, // Keep lines behind other elements
            geodesic: true, // Use geodesic lines to take the shortest path
            icons: [{
                icon: {
                    path: 'M 0,-1 0,1',
                    strokeOpacity: 1,
                    strokeColor: '#333333',
                    scale: 2
                },
                offset: '0',
                repeat: '8px'
            }]
        });

        connectionLines[jobId].push(connectionLine);
    });
}

// Clear connection lines for a specific job
function clearConnectionLines(jobId) {
    if (connectionLines[jobId]) {
        connectionLines[jobId].forEach(line => {
            line.setMap(null);
        });
        connectionLines[jobId] = [];
    }
}

// Clear all connection lines
function clearAllConnectionLines() {
    if (connectionLines && typeof connectionLines === 'object' && connectionLines !== null) {
        try {
            Object.keys(connectionLines).forEach(jobId => {
                clearConnectionLines(jobId);
            });
        } catch (error) {
            console.error('Error clearing connection lines:', error);
        }
    }
}

// Show connection lines for a specific job (when focused or in edit mode)
function showConnectionLines(jobId) {
    createConnectionLines(jobId);
}

// Hide connection lines for a specific job
function hideConnectionLines(jobId) {
    clearConnectionLines(jobId);
}

// Reset job marker to its original position
function resetJobPosition(jobId) {
    const markerData = jobMarkers.find(m => m.jobId === jobId);
    const originalPosition = originalJobPositions[jobId];
    
    if (markerData && originalPosition) {
        // Update marker position
        markerData.marker.position = originalPosition;
        
        // Update job data
        markerData.job.location = { ...originalPosition };
        
        // Update connection lines
        clearConnectionLines(jobId);
        createConnectionLines(jobId);
        
        // Save the reset position
        saveJobs();
        
        // Clear current dragging state if this was the dragging job
        if (currentDraggingJobId === jobId) {
            currentDraggingJobId = null;
        }
    }
}

// Remove job marker and associated data from the map
function removeJobMarker(jobId) {
    // Find the marker data
    const markerIndex = jobMarkers.findIndex(m => m.jobId === jobId);
    if (markerIndex !== -1) {
        const markerData = jobMarkers[markerIndex];
        
        // Close info window if open
        if (markerData.infoWindow) {
            markerData.infoWindow.close();
        }
        
        // Remove marker from map
        if (markerData.marker && markerData.marker.map) {
            markerData.marker.map = null;
        }
        
        // Remove from jobMarkers array
        jobMarkers.splice(markerIndex, 1);
    }
    
    // Clear connection lines for this job
    clearConnectionLines(jobId);
    
    // Clear annotations for this job
    clearJobAnnotations(jobId);
    
    // Remove from original positions tracking
    if (originalJobPositions[jobId]) {
        delete originalJobPositions[jobId];
    }
    
    // Clear current dragging state if this was the dragging job
    if (currentDraggingJobId === jobId) {
        currentDraggingJobId = null;
    }
}

// Show annotation type selection dialog
function showAnnotationTypeDialog(latLng) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 3000;
        display: flex;
        justify-content: center;
        align-items: center;
    `;
    
    // Create dialog
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 30px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        max-width: 400px;
        width: 90%;
        text-align: center;
    `;
    
    dialog.innerHTML = `
        <h3 style="margin: 0 0 20px 0; color: #333; font-size: 1.4rem;">Choose Annotation Type</h3>
        <p style="margin: 0 0 25px 0; color: #666; font-size: 0.95rem;">What type of annotation would you like to add?</p>
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <button id="addPin" style="
                padding: 15px 20px;
                border: 2px solid #007bff;
                background: #007bff;
                color: white;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            ">📍 Add Pin</button>
            <button id="addPolygon" style="
                padding: 15px 20px;
                border: 2px solid #28a745;
                background: #28a745;
                color: white;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            ">🔷 Add Polygon</button>
            <button id="addLine" style="
                padding: 15px 20px;
                border: 2px solid #ffc107;
                background: #ffc107;
                color: #333;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            ">📏 Add Line</button>
            <button id="cancelAnnotation" style="
                padding: 12px 20px;
                border: 2px solid #6c757d;
                background: transparent;
                color: #6c757d;
                border-radius: 8px;
                font-size: 0.95rem;
                cursor: pointer;
                margin-top: 10px;
                transition: all 0.2s;
            ">Cancel</button>
        </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // Add event listeners
    document.getElementById('addPin').addEventListener('click', () => {
        closeAnnotationDialog(overlay);
        createPinAnnotation(latLng);
    });
    
    document.getElementById('addPolygon').addEventListener('click', () => {
        closeAnnotationDialog(overlay);
        startDrawing('polygon', currentJobId);
    });
    
    document.getElementById('addLine').addEventListener('click', () => {
        closeAnnotationDialog(overlay);
        startDrawing('line', currentJobId);
    });
    
    document.getElementById('cancelAnnotation').addEventListener('click', () => {
        closeAnnotationDialog(overlay);
    });
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeAnnotationDialog(overlay);
        }
    });
}

// Close annotation type dialog
function closeAnnotationDialog(overlay) {
    if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
    }
}

// Create pin annotation at clicked location
async function createPinAnnotation(latLng) {
    const name = await showInputDialog('Enter pin name:', 'Pin Name:', 'Enter pin name...');
    if (!name) return;
    
    const description = await showInputDialog('Enter pin description (optional):', 'Pin Description:', 'Enter description...') || '';
    
    const annotation = {
        annotationType: 'pin', // Fixed: was 'type', should be 'annotationType'
        name: name,
        description: description,
        coordinates: [{
            lat: latLng.lat(),
            lng: latLng.lng()
        }],
        styleOptions: {
            fillColor: '#ff0000',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 8
        }
    };
    
    try {
        // Save annotation to database using the same pattern as other annotations
    const apiUrl = `/api/jobs/${currentJobId}/annotations`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(annotation)
        });
        
        if (!response.ok) {
            throw new Error('Failed to create annotation');
        }
        
        const savedAnnotation = await response.json();
        
        // Create marker
        const marker = new google.maps.marker.AdvancedMarkerElement({
            position: latLng,
            map: map,
            title: name,
            content: createMarkerContent('#ff0000')
        });
        
        // Store annotation with overlay
        const annotationWithOverlay = {
            ...savedAnnotation,
            overlay: marker
        };
        
        if (!jobAnnotations[currentJobId]) {
            jobAnnotations[currentJobId] = [];
        }
        jobAnnotations[currentJobId].push(annotationWithOverlay);
        
        // Add listeners
        addAnnotationListeners(marker, annotationWithOverlay);
        
        showNotification(`Pin "${name}" created successfully!`);
    } catch (error) {
        console.error('Error saving pin annotation:', error);
        showNotification(`Error saving pin: ${error.message}. Please try again.`);
    }
}

// Handle map click events
function handleMapClick(latLng) {
    // Check if we're in job edit mode and have a current job selected
    if (isJobEditMode && currentJobId) {
        // Ask user if they want to save changes and create a new job
        const createNewJob = confirm('You are currently in annotation editing mode. Do you want to save your changes and create a new job at this location?');
        
        if (createNewJob) {
            // Save any pending annotation changes and exit edit mode
            saveAllJobChanges(currentJobId).then(() => {
                // Disable annotation editing mode
                disableAnnotationEditing(currentJobId);
                currentJobId = null;
                isJobEditMode = false;
                
                // Now create the new job
                selectedLocation = {
                    lat: latLng.lat(),
                    lng: latLng.lng()
                };
                
                // Update location display in modal
                const locationDisplay = document.getElementById('selectedLocation');
                locationDisplay.textContent = `Lat: ${selectedLocation.lat.toFixed(6)}, Lng: ${selectedLocation.lng.toFixed(6)}`;
                locationDisplay.style.fontStyle = 'normal';
                locationDisplay.style.color = '#333';
                
                // Show job creation modal
                showJobModal();
                showNotification('Annotation editing saved and disabled. Ready to create new job.');
            }).catch((error) => {
                console.error('Error saving annotation changes:', error);
                showNotification('Error saving changes. Please try again.');
            });
        } else {
            // Continue with annotation editing - show annotation type dialog
            showAnnotationTypeDialog(latLng);
        }
        return;
    }
    
    selectedLocation = {
        lat: latLng.lat(),
        lng: latLng.lng()
    };
    
    // Update location display in modal
    const locationDisplay = document.getElementById('selectedLocation');
    locationDisplay.textContent = `Lat: ${selectedLocation.lat.toFixed(6)}, Lng: ${selectedLocation.lng.toFixed(6)}`;
    locationDisplay.style.fontStyle = 'normal';
    locationDisplay.style.color = '#333';
    
    // Show job creation modal
    showJobModal();
}

// Initialize event listeners
function initializeEventListeners() {
    const modal = document.getElementById('jobModal');
    const closeBtn = document.querySelector('.close');
    const cancelBtn = document.getElementById('cancelBtn');
    const jobForm = document.getElementById('jobForm');
    const togglePanel = document.getElementById('togglePanel');
    const jobPanel = document.querySelector('.job-panel');

    // Add null checks for all elements
    if (!modal || !closeBtn || !cancelBtn || !jobForm || !togglePanel || !jobPanel) {
        console.warn('Some DOM elements not found in initializeEventListeners');
        return;
    }

    // Close modal events
    closeBtn.addEventListener('click', hideJobModal);
    cancelBtn.addEventListener('click', hideJobModal);
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            hideJobModal();
        }
    });

    // Form submission
    jobForm.addEventListener('submit', function(event) {
        event.preventDefault();
        createJob();
    });

    // Toggle job panel
    togglePanel.addEventListener('click', function() {
        jobPanel.classList.toggle('collapsed');
    });
    
    // Load workers for dropdown
    loadWorkersForDropdown();
}

// Load workers for dropdown
async function loadWorkersForDropdown() {
    try {
        const apiUrl = '/api/workers';
        const response = await fetch(apiUrl, {
            credentials: 'include' // Include session cookies
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                const assignedWorkerSelect = document.getElementById('assignedWorker');
                if (assignedWorkerSelect) {
                    assignedWorkerSelect.innerHTML = '<option value="">Login required to view workers</option>';
                    assignedWorkerSelect.disabled = true;
                }
                console.warn('Authentication required to load workers');
                return;
            }
            console.warn('Failed to load workers:', response.status, response.statusText);
            return;
        }
        
        const workers = await response.json();
        
        // Ensure workers is an array
        if (!Array.isArray(workers)) {
            console.error('Workers response is not an array:', workers);
            return;
        }
        
        const assignedWorkerSelect = document.getElementById('assignedWorker');
        if (assignedWorkerSelect) {
            // Clear existing options except the first one
            assignedWorkerSelect.innerHTML = '<option value="">Select Worker</option>';
            
            // Add worker options
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
    } catch (error) {
        console.error('Error loading workers:', error);
    }
}

// Show job creation modal
function showJobModal() {
    const modal = document.getElementById('jobModal');
    modal.style.display = 'block';
    
    // Focus on first input
    document.getElementById('jobNumber').focus();
}

// Hide job creation modal
function hideJobModal() {
    const modal = document.getElementById('jobModal');
    modal.style.display = 'none';
    
    // Reset form and selected location
    document.getElementById('jobForm').reset();
    selectedLocation = null;
    
    const locationDisplay = document.getElementById('selectedLocation');
    locationDisplay.textContent = 'Click on the map to select location';
    locationDisplay.style.fontStyle = 'italic';
    locationDisplay.style.color = '#666';
}

// Create a new job
async function createJob() {
    if (!selectedLocation) {
        showNotification('Please select a location on the map first.');
        return;
    }

    const form = document.getElementById('jobForm');
    const formData = new FormData(form);
    
    // Validate required fields
    const title = formData.get('jobTitle');
    const type = formData.get('jobType');
    const description = formData.get('jobDescription');
    
    if (!title || !type || !description) {
        showNotification('Please fill in all required fields.');
        return;
    }

    try {
        // Create FormData for API call (includes photos)
        const apiFormData = new FormData();
        apiFormData.append('jobNumber', formData.get('jobNumber'));
        apiFormData.append('title', title);
        apiFormData.append('description', description);
        apiFormData.append('jobType', type);
        apiFormData.append('location', JSON.stringify(selectedLocation));
        apiFormData.append('locationAddress', formData.get('locationAddress') || '');
        apiFormData.append('contactName', formData.get('contactName'));
        apiFormData.append('contactPhone', formData.get('contactPhone'));
        apiFormData.append('assignedWorkerId', formData.get('assignedWorker') || null);
        
        // Add photos to FormData
        const photoFiles = formData.getAll('jobPhotos');
        
        // Validate file sizes (4MB limit per file)
        const maxFileSize = 4 * 1024 * 1024; // 4MB in bytes
        let totalSize = 0;
        
        for (const file of photoFiles) {
            if (file.size > 0) { // Only check non-empty files
                if (file.size > maxFileSize) {
                    showNotification(`File "${file.name}" is too large. Maximum file size is 4MB.`, 'error');
                    return;
                }
                totalSize += file.size;
            }
        }
        
        // Check total upload size (limit to 4MB total to be safe)
        if (totalSize > maxFileSize) {
            showNotification('Total file size exceeds 4MB limit. Please reduce the number or size of photos.', 'error');
            return;
        }
        
        photoFiles.forEach(file => {
            if (file.size > 0) { // Only add non-empty files
                apiFormData.append('photos', file);
            }
        });

        // Send to API
        const response = await fetch('/api/jobs', {
            method: 'POST',
            body: apiFormData,
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const savedJob = await response.json();
        
        // Create job object for local use
        const job = {
            id: savedJob.id.toString(),
            jobNumber: savedJob.job_number,
            title: savedJob.title,
            type: savedJob.job_type,
            description: savedJob.description,
            location: selectedLocation,
            locationAddress: savedJob.location_address,
            contactName: savedJob.contact_name,
            contactPhone: savedJob.contact_phone,
            assignedWorkerId: savedJob.assigned_worker_id,
            status: savedJob.status || 'pending',
            createdAt: savedJob.created_at,
            // Handle photos whether returned as array or JSON string
            photos: Array.isArray(savedJob.photos)
                ? savedJob.photos
                : (typeof savedJob.photos === 'string' && savedJob.photos.length
                    ? JSON.parse(savedJob.photos)
                    : [])
        };
        
        // Add to local array
        jobs.push(job);
        
        // Save to localStorage as backup
        saveJobs();
        
        // Create marker on map
        createJobMarker(job);
        
        // Update job list display
        updateJobList();
        
        // Hide modal
        hideJobModal();
        
        // Show success message
        showNotification(`Job "${job.title}" created successfully!`);
        
    } catch (error) {
        console.error('Error creating job:', error);
        showNotification('Failed to create job. Please try again.');
    }
}

// Create marker for job on map using AdvancedMarkerElement
async function createJobMarker(job) {
    // Use job type color instead of custom marker color
    const markerColor = getMarkerColor(job.type);
    
    // Store original position for reset functionality
    originalJobPositions[job.id] = { ...job.location };
    
    // Create a custom pin element with job type styling
    const pinElement = new window.PinElement({
        background: markerColor,
        borderColor: "#FFFFFF",
        glyphColor: "#FFFFFF",
        glyph: getMarkerGlyph(job.type),
        scale: 1.2
    });

    // Create the advanced marker with conditional draggable functionality
    const marker = new window.AdvancedMarkerElement({
        position: job.location,
        map: map,
        title: `${job.jobNumber}: ${job.title}`,
        content: pinElement.element,
        gmpDraggable: false // Initially not draggable, will be enabled in edit mode
    });

    // Load annotations for this job first
    await loadJobAnnotations(job.id);

    // Create info window with updated annotation count
    const infoWindow = new google.maps.InfoWindow({
        content: createInfoWindowContent(job)
    });

    // Add click listener to marker
    marker.addListener('click', function() {
        // Reset previous dragging job if different job is clicked
        if (currentDraggingJobId && currentDraggingJobId !== job.id) {
            resetJobPosition(currentDraggingJobId);
        }
        
        // Set current dragging job
        currentDraggingJobId = job.id;
        
        // Close other info windows
        jobMarkers.forEach(markerData => {
            if (markerData.infoWindow) {
                markerData.infoWindow.close();
            }
        });
        
        infoWindow.open({
            anchor: marker,
            map: map
        });
        
        // Load worker info after the info window is opened and DOM is ready
        if (job.assignedWorkerId) {
            setTimeout(() => {
                loadWorkerInfo(job.assignedWorkerId, job.id);
            }, 100);
        }
    });

    // Add drag listeners
    marker.addListener('dragstart', function() {
        // Hide connection lines while dragging
        hideConnectionLines(job.id);
    });

    marker.addListener('drag', function() {
        // Update connection lines during drag
        clearConnectionLines(job.id);
        createConnectionLines(job.id);
    });

    marker.addListener('dragend', function() {
        // Update job location and show connection lines
        job.location = marker.position;
        showConnectionLines(job.id);
        
        // Save the updated job position
        saveJobs();
    });

    // Store marker and info window
    jobMarkers.push({
        jobId: job.id,
        job: job,
        marker: marker,
        infoWindow: infoWindow
    });
}

// Get marker color based on job type for AdvancedMarkerElement
function getMarkerColor(jobType) {
    const colors = {
        'CleanUps': '#007bff',      // Blue
        'Crew Work': '#dc3545',     // Red
        'General': '#ffc107',       // Yellow
        'Plumbing': '#dc3545',      // Red
        'Electrical': '#fd7e14',    // Orange
        'HVAC': '#6f42c1',          // Purple
        'Landscaping': '#20c997',   // Teal
        'Roofing': '#6c757d',       // Gray
        'Painting': '#e83e8c',      // Pink
        'Flooring': '#795548'       // Brown
    };
    
    return colors[jobType] || '#6c757d'; // Default gray
}

// Get marker glyph based on job type for AdvancedMarkerElement
function getMarkerGlyph(jobType) {
    const glyphs = {
        'CleanUps': 'C',
        'Crew Work': 'W',
        'General': 'G',
        'Plumbing': 'P',
        'Electrical': 'E',
        'HVAC': 'H',
        'Landscaping': 'L',
        'Roofing': 'R',
        'Painting': 'T',
        'Flooring': 'F'
    };
    
    return glyphs[jobType] || 'J'; // Default 'J' for Job
}

// Create info window content
function createInfoWindowContent(job) {
    // Check if this job is currently being edited
    const isCurrentJobInEditMode = isJobEditMode && currentJobId === job.id;
    
    // Check for unsaved changes for this job
    const hasUnsavedChanges = Array.from(modifiedAnnotations).some(annotationId => {
        const annotation = findAnnotationById(annotationId);
        return annotation && annotation.job_id === job.id;
    });
    
    // Count annotations for this job
    const annotationCount = jobAnnotations[job.id] ? jobAnnotations[job.id].length : 0;
    
    // Get assigned worker info
    const assignedWorkerInfo = job.assignedWorkerId ? 
        `<span id="worker-${job.id}" style="color: #28a745; font-weight: 600;">Loading...</span>` :
        `<span style="color: #dc3545;">Not assigned</span>`;
    
    // Edit mode status indicator
    const editModeStatus = isCurrentJobInEditMode 
        ? `<div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 4px 8px; margin-bottom: 8px; font-size: 11px;">
             <span style="color: #856404;">🟡 <strong>Edit Mode Active</strong></span>
           </div>`
        : '';
    
    // Unsaved changes warning
    const unsavedWarning = hasUnsavedChanges 
        ? `<div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 4px 8px; margin-bottom: 8px; font-size: 11px;">
             <span style="color: #721c24;">⚠️ <strong>Unsaved Changes</strong></span>
           </div>`
        : '';
    
    // Save/Revert buttons (only show when there are unsaved changes)
    const saveRevertButtons = hasUnsavedChanges 
        ? `<div style="display: flex; gap: 4px; margin-bottom: 8px;">
             <button onclick="saveAllJobChanges(${job.id})" style="flex: 1; padding: 4px 6px; font-size: 10px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;">
                 💾 Save
             </button>
             <button onclick="revertAllJobChanges(${job.id})" style="flex: 1; padding: 4px 6px; font-size: 10px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer;">
                 ↶ Revert
             </button>
           </div>`
        : '';
    
    // Toggle Edit Mode button styling
    const toggleButtonStyle = isCurrentJobInEditMode 
        ? "background: #fd7e14; color: white;" // Orange when active
        : "background: #17a2b8; color: white;"; // Teal when inactive
    
    const toggleButtonText = isCurrentJobInEditMode ? "🔒 Exit Edit" : "✏️ Edit";
    
    // Navigation URLs for Google Maps and Apple Maps
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${job.location.lat},${job.location.lng}`;
    const appleMapsUrl = `http://maps.apple.com/?daddr=${job.location.lat},${job.location.lng}`;
    
    // Note: loadWorkerInfo will be called after the content is rendered
    
    return `
        <div style="max-width: 280px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: white; border-radius: 8px; padding: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.15); border: 1px solid #e1e5e9;">
            ${editModeStatus}
            ${unsavedWarning}
            
            <!-- Header Section -->
            <div style="display: flex; align-items: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #f0f0f0;">
                <div style="width: 4px; height: 32px; background: ${getMarkerColor(job.type)}; border-radius: 2px; margin-right: 10px;"></div>
                <div style="flex: 1;">
                    <h3 style="margin: 0; color: #1a1a1a; font-size: 16px; font-weight: 700; line-height: 1.2;">${job.title}</h3>
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
                        <span style="color: #6c757d; font-size: 12px; font-weight: 500;">Job #${job.jobNumber || 'N/A'}</span>
                        <span style="background: ${getMarkerColor(job.type)}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;">${job.type}</span>
                    </div>
                </div>
            </div>
            
            <!-- Key Info Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; font-size: 12px;">
                <div>
                    <span style="color: #6c757d; font-weight: 500;">Worker:</span>
                    <div style="margin-top: 2px;">${assignedWorkerInfo}</div>
                </div>
                <div>
                    <span style="color: #6c757d; font-weight: 500;">Annotations:</span>
                    <div style="color: #495057; font-weight: 600; margin-top: 2px;">${annotationCount}</div>
                </div>
            </div>
            
            <!-- Navigation Buttons -->
            <div style="display: flex; gap: 6px; margin-bottom: 10px;">
                <a href="${googleMapsUrl}" target="_blank" style="flex: 1; padding: 8px; background: #4285f4; color: white; text-decoration: none; border-radius: 6px; text-align: center; font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 4px;">
                    🗺️ Google Maps
                </a>
                <a href="${appleMapsUrl}" target="_blank" style="flex: 1; padding: 8px; background: #007aff; color: white; text-decoration: none; border-radius: 6px; text-align: center; font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 4px;">
                    🍎 Apple Maps
                </a>
            </div>
            
            <!-- Action Buttons -->
            <div style="margin-bottom: 8px;">
                <button onclick="showWorkerAssignmentModal(${job.id})" style="padding: 8px 12px; font-size: 12px; background: #6f42c1; color: white; border: none; border-radius: 6px; cursor: pointer; width: 100%; font-weight: 600; margin-bottom: 6px;">
                    👤 Assign Worker
                </button>
                
                ${saveRevertButtons}
                
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; margin-bottom: 6px;">
                    <button onclick="startDrawing('polygon', ${job.id})" style="padding: 5px 6px; font-size: 10px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                        📐 Area
                    </button>
                    <button onclick="startDrawing('pin', ${job.id})" style="padding: 5px 6px; font-size: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                        📍 Pin
                    </button>
                    <button onclick="startDrawing('line', ${job.id})" style="padding: 5px 6px; font-size: 10px; background: #ffc107; color: black; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                        📏 Line
                    </button>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                    <button onclick="loadJobAnnotations(${job.id})" style="padding: 6px 8px; font-size: 11px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                        📋 View All
                    </button>
                    <button onclick="toggleAnnotationEditing(${job.id})" style="padding: 6px 8px; font-size: 11px; ${toggleButtonStyle} border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">
                        ${toggleButtonText}
                    </button>
                </div>
            </div>
            
            <!-- Description (Collapsible) -->
            <div style="border-top: 1px solid #e1e5e9; padding-top: 8px;">
                <details style="cursor: pointer;">
                    <summary style="color: #6c757d; font-weight: 500; font-size: 11px; margin-bottom: 4px; list-style: none; display: flex; align-items: center; gap: 4px;">
                        <span style="transform: rotate(0deg); transition: transform 0.2s;">▶</span>
                        Description
                    </summary>
                    <div style="color: #495057; font-size: 12px; line-height: 1.4; margin-top: 4px; padding: 6px; background: #f8f9fa; border-radius: 4px;">${job.description}</div>
                </details>
            </div>
        </div>
        
        <style>
            details[open] summary span {
                transform: rotate(90deg);
            }
        </style>
    `;
}

// Update job list in panel
async function updateJobList() {
    const jobList = document.getElementById('jobList');
    
    // Add null check for jobList element
    if (!jobList) {
        console.warn('jobList element not found');
        return;
    }
    
    if (jobs.length === 0) {
        jobList.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No jobs created yet</p>';
        return;
    }
    
    // Create job items with worker information
    const jobItems = await Promise.all(jobs.map(async (job) => {
        const workerInfo = await getWorkerInfoForJobList(job.assignedWorkerId);
        
        // Determine CSS class for worker info
        let workerClass = 'worker-info';
        if (workerInfo === 'Not assigned') {
            workerClass += ' not-assigned';
        } else if (workerInfo.includes('Error') || workerInfo.includes('Login required')) {
            workerClass += ' error';
        }
        
        return `
            <div class="job-item job-type-${job.type.replace(' ', '')}" onclick="focusOnJob('${job.id}')">
                <h4>${job.title}</h4>
                <p><strong>Job #:</strong> ${job.jobNumber}</p>
                <p><strong>Type:</strong> ${job.type}</p>
                <p><strong>Worker:</strong> <span class="${workerClass}">${workerInfo}</span></p>
                <p><strong>Created:</strong> ${new Date(job.createdAt).toLocaleDateString()}</p>
            </div>
        `;
    }));
    
    jobList.innerHTML = jobItems.join('');
}

// Focus on specific job on map
function focusOnJob(jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    // Hide all connection lines first
    clearAllConnectionLines();
    
    // Center map on job location with maximum zoom
    map.setCenter(job.location);
    map.setZoom(20); // Maximum zoom level for detailed view
    
    // Show connection lines for the focused job
    showConnectionLines(jobId);
    
    // Find and open the marker's info window
    const markerData = jobMarkers.find(m => m.job.id === jobId);
    if (markerData) {
        // Close other info windows
        jobMarkers.forEach(md => {
            if (md.infoWindow) {
                md.infoWindow.close();
            }
        });
        
        markerData.infoWindow.open({
            anchor: markerData.marker,
            map: map
        });
    }
}

// Toggle annotation editing mode
function toggleAnnotationEditing(jobId) {
    if (isJobEditMode) {
        disableAnnotationEditing(jobId);
        currentJobId = null; // Clear current job when disabling edit mode
        // Hide connection lines when exiting edit mode
        hideConnectionLines(jobId);
        showNotification('Annotation editing disabled');
    } else {
        enableAnnotationEditing(jobId);
        currentJobId = jobId; // Set current job when enabling edit mode
        // Show connection lines when entering edit mode
        showConnectionLines(jobId);
        showNotification('Annotation editing enabled - you can now edit lines and polygons, or click on the map to add new annotations');
    }
    
    // Refresh the info window to show the updated button state
    refreshJobInfoWindow(jobId);
}

// Load jobs from database
async function loadJobs() {
    try {
        const apiUrl = '/api/jobs';
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load jobs');
        }
        
        const jobsData = await response.json();
        
        jobs = [];
        
        // Clear existing markers and annotations
        jobMarkers.forEach(markerData => {
            if (markerData.marker && markerData.marker.map) {
                markerData.marker.map = null;
            }
            if (markerData.infoWindow) {
                markerData.infoWindow.close();
            }
        });
        jobMarkers = [];
        clearAllAnnotations();
        
        // Process jobs from database
        for (const jobData of jobsData) {
            const job = {
                id: jobData.id.toString(),
                jobNumber: jobData.job_number || `JOB-${jobData.id}`, // Use job_number or fallback to generated ID
                title: jobData.title,
                type: jobData.job_type,
                description: jobData.description,
                location: {
                    lat: parseFloat(jobData.location_lat),
                    lng: parseFloat(jobData.location_lng)
                },
                locationAddress: jobData.location_address,
                contactName: jobData.contact_name,
                contactPhone: jobData.contact_phone,
                status: jobData.status,
                createdAt: jobData.created_at,
                assignedWorkerId: jobData.assigned_worker_id // Map assigned_worker_id to assignedWorkerId
            };
            jobs.push(job);
            
            // Create marker for each job (now async to load annotations)
            await createJobMarker(job);
        }
        
        // Update UI
        await updateJobList();
        saveJobs(); // Backup to localStorage
        
        // Load equipment after jobs are loaded
        await loadEquipment();
        
    } catch (error) {
        console.error('Error loading jobs from Neon database:', error);
        // Fallback to localStorage
        await loadJobsFromLocalStorage();
        showNotification('Unable to connect to database - showing cached jobs');
    }
}

// Fallback function to load from localStorage
async function loadJobsFromLocalStorage() {
    const savedJobs = localStorage.getItem('jobManagementJobs');
    if (savedJobs) {
        jobs = JSON.parse(savedJobs);
        
        // Recreate markers for loaded jobs
        jobs.forEach(job => {
            createJobMarker(job);
        });
        
        await updateJobList();
    } else {
        jobs = [];
    }
}

// Save jobs to localStorage (backup only)
async function saveJobs() {
    // Save to localStorage as backup
    localStorage.setItem('jobManagementJobs', JSON.stringify(jobs));
    console.log('Jobs backed up to localStorage');
}

// Show notification
// Save all changes for a specific job
async function saveAllJobChanges(jobId) {
    try {
        const jobAnnotations = Array.from(modifiedAnnotations).filter(annotationId => {
            const annotation = findAnnotationById(annotationId);
            return annotation && annotation.job_id === jobId;
        });
        
        if (jobAnnotations.length === 0) {
            showNotification('No changes to save for this job');
            return;
        }
        
        let savedCount = 0;
        for (const annotationId of jobAnnotations) {
            try {
                await saveAnnotationChanges(annotationId);
                savedCount++;
            } catch (error) {
                console.error(`Error saving annotation ${annotationId}:`, error);
            }
        }
        
        showNotification(`Successfully saved ${savedCount} annotation changes for this job!`);
        
        // Refresh the info window to update the display
        refreshJobInfoWindow(jobId);
        
    } catch (error) {
        console.error('Error saving job changes:', error);
        showNotification(`Error saving changes: ${error.message}`);
    }
}

// Revert all changes for a specific job
async function revertAllJobChanges(jobId) {
    try {
        const jobAnnotations = Array.from(modifiedAnnotations).filter(annotationId => {
            const annotation = findAnnotationById(annotationId);
            return annotation && annotation.job_id === jobId;
        });
        
        if (jobAnnotations.length === 0) {
            showNotification('No changes to revert for this job');
            return;
        }
        
        const confirmRevert = confirm(`Are you sure you want to revert all ${jobAnnotations.length} unsaved changes for this job? This cannot be undone.`);
        if (!confirmRevert) return;
        
        let revertedCount = 0;
        for (const annotationId of jobAnnotations) {
            try {
                await revertAnnotationChanges(annotationId);
                revertedCount++;
            } catch (error) {
                console.error(`Error reverting annotation ${annotationId}:`, error);
            }
        }
        
        showNotification(`Successfully reverted ${revertedCount} annotation changes for this job`);
        
        // Refresh the info window to update the display
        refreshJobInfoWindow(jobId);
        
    } catch (error) {
        console.error('Error reverting job changes:', error);
        showNotification(`Error reverting changes: ${error.message}`);
    }
}

function refreshJobInfoWindow(jobId) {
    debugLog('refreshJobInfoWindow called for jobId:', jobId, 'type:', typeof jobId);
    
    // Find the job - handle both string and number IDs
    const job = jobs.find(j => j.id == jobId || j.id === jobId.toString() || j.id === parseInt(jobId));
    if (!job) {
        debugLog('Job not found for id:', jobId);
        debugLog('Available job IDs:', jobs.map(j => j.id));
        return;
    }
    
    // Find the job marker
    const jobMarker = jobMarkers.find(marker => marker.jobId === jobId);
    if (!jobMarker) {
        debugLog('Job marker not found for jobId:', jobId);
        return;
    }
    
    debugLog('Refreshing info window for job:', job.title);
    
    // Close and reopen the info window with updated content
    if (jobMarker.infoWindow) {
        jobMarker.infoWindow.close();
        const newContent = createInfoWindowContent(job);
        debugLog('New info window content created');
        jobMarker.infoWindow.setContent(newContent);
        jobMarker.infoWindow.open(map, jobMarker);
        debugLog('Info window reopened with new content');
        
        // Load worker info after the info window is updated
        if (job.assignedWorkerId) {
            // Use setTimeout to ensure the DOM element exists
            setTimeout(() => {
                loadWorkerInfo(job.assignedWorkerId, job.id);
            }, 100);
        }
    } else {
        debugLog('No info window found on job marker');
    }
}

function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #28a745;
        color: white;
        padding: 15px 20px;
        border-radius: 4px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 2000;
        font-weight: 500;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Error handling for Google Maps
window.gm_authFailure = function() {
    showNotification('Google Maps authentication failed. Please check your API key.');
};

// Check URL parameters for job focusing
function checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const jobId = urlParams.get('job');
    
    if (jobId) {
        // Wait a bit for jobs to load, then focus on the specified job
        setTimeout(() => {
            focusOnJob(jobId);
        }, 500);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    // Ensure user is authenticated before initializing app (single call)
    try {
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

    // Initialize event listeners and check URL parameters
    initializeEventListeners();
    checkUrlParameters();
    
    // Initialize drag functionality and map types
    initializeDragFunctionality();
    initializeMapTypes();
    
    console.log('Job Management Map application loaded');
});

// Equipment management functions
async function loadEquipment() {
    try {
        const response = await fetch('/api/equipment', {
            credentials: 'include'
        });
        if (response.ok) {
            const equipmentData = await response.json();
            
            // Clear existing equipment markers
            equipmentMarkers.forEach(markerData => {
                if (markerData.marker && markerData.marker.map) {
                    markerData.marker.map = null;
                }
                if (markerData.infoWindow) {
                    markerData.infoWindow.close();
                }
            });
            equipmentMarkers = [];
            
            equipment = equipmentData;
            
            // Create markers for equipment with location
            for (const equipmentItem of equipment) {
                if (equipmentItem.location_lat && equipmentItem.location_lng) {
                    await createEquipmentMarker(equipmentItem);
                }
            }
            
        }
    } catch (error) {
        console.error('Error loading equipment:', error);
    }
}

async function createEquipmentMarker(equipmentItem) {
    const position = {
        lat: parseFloat(equipmentItem.location_lat),
        lng: parseFloat(equipmentItem.location_lng)
    };
    
    // Get equipment icon based on category
    const iconInfo = getEquipmentIcon(equipmentItem.category);
    
    const marker = new google.maps.marker.AdvancedMarkerElement({
        position: position,
        map: map,
        title: `${equipmentItem.name} (${equipmentItem.category})`,
        content: createMarkerContent(iconInfo.color),
        zIndex: 100 // Lower than job markers
    });
    
    // Create info window content
    const infoWindowContent = createEquipmentInfoWindowContent(equipmentItem);
    const infoWindow = new google.maps.InfoWindow({
        content: infoWindowContent
    });
    
    // Add click listener
    marker.addListener('click', () => {
        // Close all other info windows
        jobMarkers.forEach(jobMarker => {
            if (jobMarker.infoWindow) {
                jobMarker.infoWindow.close();
            }
        });
        equipmentMarkers.forEach(equipMarker => {
            if (equipMarker.infoWindow && equipMarker.infoWindow !== infoWindow) {
                equipMarker.infoWindow.close();
            }
        });
        
        infoWindow.open(map, marker);
    });
    
    equipmentMarkers.push({
        marker: marker,
        infoWindow: infoWindow,
        equipment: equipmentItem
    });
}

function getEquipmentIcon(category) {
    const icons = {
        'skidsteers': {
            path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
            color: '#FF6B35'
        },
        'excavators': {
            path: 'M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.54 2.42 10 1.61 10 1.61 8.83 1.61 8 2.44 8 3.61c0 .35.07.69.18 1H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z',
            color: '#F7931E'
        },
        'trucks': {
            path: 'M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
            color: '#1E88E5'
        },
        'trailers': {
            path: 'M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4z',
            color: '#8E24AA'
        },
        'attachments': {
            path: 'M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z',
            color: '#43A047'
        },
        'small engines': {
            path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
            color: '#FB8C00'
        },
        'other': {
            path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
            color: '#757575'
        }
    };
    
    return icons[category] || icons['other'];
}

function createEquipmentInfoWindowContent(equipmentItem) {
    const statusColor = equipmentItem.status === 'available' ? '#28a745' : 
                       equipmentItem.status === 'in_use' ? '#ffc107' : 
                       equipmentItem.status === 'maintenance' ? '#dc3545' : '#6c757d';
    
    return `
        <div style="max-width: 300px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <div style="border-bottom: 2px solid #007bff; padding-bottom: 10px; margin-bottom: 15px;">
                <h3 style="margin: 0; color: #333; font-size: 18px; font-weight: 600;">
                    <i class="fas fa-tools" style="color: #007bff; margin-right: 8px;"></i>
                    ${equipmentItem.name}
                </h3>
                <p style="margin: 5px 0 0 0; color: #666; font-size: 14px; text-transform: capitalize;">
                    ${equipmentItem.category}
                </p>
            </div>
            
            <div style="margin-bottom: 15px;">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 600; color: #333; min-width: 60px;">Status:</span>
                    <span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; text-transform: capitalize; margin-left: 8px;">
                        ${equipmentItem.status.replace('_', ' ')}
                    </span>
                </div>
                
                ${equipmentItem.model ? `
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 600; color: #333; min-width: 60px;">Model:</span>
                    <span style="color: #666; margin-left: 8px;">${equipmentItem.model}</span>
                </div>
                ` : ''}
                
                ${equipmentItem.serial_number ? `
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 600; color: #333; min-width: 60px;">Serial:</span>
                    <span style="color: #666; margin-left: 8px;">${equipmentItem.serial_number}</span>
                </div>
                ` : ''}
                
                ${equipmentItem.year ? `
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 600; color: #333; min-width: 60px;">Year:</span>
                    <span style="color: #666; margin-left: 8px;">${equipmentItem.year}</span>
                </div>
                ` : ''}
            </div>
            
            ${equipmentItem.notes ? `
            <div style="margin-bottom: 15px;">
                <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.4;">
                    <strong>Notes:</strong> ${equipmentItem.notes}
                </p>
            </div>
            ` : ''}
            
            <div style="border-top: 1px solid #eee; padding-top: 10px; text-align: center;">
                <button onclick="viewEquipmentDetails(${equipmentItem.id})" 
                        style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; margin-right: 8px;">
                    <i class="fas fa-eye"></i> View Details
                </button>
                <button onclick="requestMaintenance(${equipmentItem.id})" 
                        style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    <i class="fas fa-wrench"></i> Request Service
                </button>
            </div>
        </div>
    `;
}

function viewEquipmentDetails(equipmentId) {
    // Open equipment page with specific equipment selected
    window.open(`equipment.html?id=${equipmentId}`, '_blank');
}

function requestMaintenance(equipmentId) {
    const equipmentItem = equipment.find(e => e.id === equipmentId);
    if (!equipmentItem) return;
    
    // Create maintenance request modal
    const modalHTML = `
        <div id="maintenanceRequestModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 20px; border-radius: 8px; max-width: 500px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                <h3 style="margin: 0 0 15px 0; color: #333;">Request Maintenance</h3>
                <p style="margin: 0 0 15px 0; color: #666;"><strong>Equipment:</strong> ${equipmentItem.name}</p>
                
                <div style="margin-bottom: 15px;">
                    <span class="detail-label" style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">Request Type:</span>
                    <select id="requestType" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        <option value="repair">Repair</option>
                        <option value="maintenance">Scheduled Maintenance</option>
                        <option value="inspection">Inspection</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <span class="detail-label" style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">Priority:</span>
                    <select id="requestPriority" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <span class="detail-label" style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">Description:</span>
                    <textarea id="requestDescription" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; height: 80px; resize: vertical;" placeholder="Describe the issue or maintenance needed..."></textarea>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="closeMaintenanceRequestModal()" style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Cancel
                    </button>
                    <button onclick="submitMaintenanceRequest(${equipmentId})" style="padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        Submit Request
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeMaintenanceRequestModal() {
    const modal = document.getElementById('maintenanceRequestModal');
    if (modal) {
        modal.remove();
    }
}

async function submitMaintenanceRequest(equipmentId) {
    const requestType = document.getElementById('requestType').value;
    const priority = document.getElementById('requestPriority').value;
    const description = document.getElementById('requestDescription').value;
    
    if (!description.trim()) {
        alert('Please provide a description for the maintenance request.');
        return;
    }
    
    try {
    const apiUrl = '/api/maintenance-requests';
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                equipment_id: equipmentId,
                request_type: requestType,
                priority: priority,
                description: description
            })
        });
        
        if (response.ok) {
            showNotification('Maintenance request submitted successfully');
            closeMaintenanceRequestModal();
        } else {
            throw new Error('Failed to submit maintenance request');
        }
    } catch (error) {
        console.error('Error submitting maintenance request:', error);
        showNotification('Error submitting maintenance request');
    }
}

// Drag functionality for panels
let isDragging = false;
let currentDragElement = null;
let dragOffset = { x: 0, y: 0 };

function initializeDragFunctionality() {
    // Make job panel draggable
    const jobPanel = document.getElementById('jobPanel');
    const jobPanelHeader = jobPanel.querySelector('.panel-header');
    
    // Make map types bar draggable
    const mapTypesBar = document.getElementById('mapTypesBar');
    
    // Make address search bar draggable
    const addressSearchContainer = document.getElementById('addressSearchContainer');
    const searchHeader = addressSearchContainer?.querySelector('.search-header');
    
    // Add drag functionality to job panel
    if (jobPanelHeader) {
        jobPanelHeader.addEventListener('mousedown', (e) => startDrag(e, jobPanel));
        jobPanelHeader.addEventListener('touchstart', (e) => startDrag(e, jobPanel), { passive: false });
    }
    
    // Add drag functionality to map types bar
    if (mapTypesBar) {
        mapTypesBar.addEventListener('mousedown', (e) => startDrag(e, mapTypesBar));
        mapTypesBar.addEventListener('touchstart', (e) => startDrag(e, mapTypesBar), { passive: false });
    }
    
    // Add drag functionality to address search bar
    if (searchHeader) {
        searchHeader.addEventListener('mousedown', (e) => startDrag(e, addressSearchContainer));
        searchHeader.addEventListener('touchstart', (e) => startDrag(e, addressSearchContainer), { passive: false });
    }
    
    // Global mouse/touch move and up events
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', handleDrag, { passive: false });
    document.addEventListener('touchend', stopDrag);
}

function startDrag(e, element) {
    // Prevent dragging if clicking on buttons or other interactive elements
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
        return;
    }
    
    isDragging = true;
    currentDragElement = element;
    element.classList.add('dragging');
    
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    
    const rect = element.getBoundingClientRect();
    dragOffset.x = clientX - rect.left;
    dragOffset.y = clientY - rect.top;
    
    e.preventDefault();
}

function handleDrag(e) {
    if (!isDragging || !currentDragElement) return;
    
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    
    const newX = clientX - dragOffset.x;
    const newY = clientY - dragOffset.y;
    
    // Constrain to viewport
    const maxX = window.innerWidth - currentDragElement.offsetWidth;
    const maxY = window.innerHeight - currentDragElement.offsetHeight;
    
    const constrainedX = Math.max(0, Math.min(newX, maxX));
    const constrainedY = Math.max(70, Math.min(newY, maxY)); // 70px to account for nav header
    
    // Special handling for address search container to maintain centering transform
    if (currentDragElement.id === 'addressSearchContainer') {
        currentDragElement.style.left = constrainedX + 'px';
        currentDragElement.style.top = constrainedY + 'px';
        currentDragElement.style.transform = 'none';
    } else {
        currentDragElement.style.left = constrainedX + 'px';
        currentDragElement.style.top = constrainedY + 'px';
        currentDragElement.style.right = 'auto';
    }
    
    e.preventDefault();
}

function stopDrag() {
    if (isDragging && currentDragElement) {
        currentDragElement.classList.remove('dragging');
        isDragging = false;
        currentDragElement = null;
    }
}

// Map type functionality
function initializeMapTypes() {
    const mapTypeButtons = document.querySelectorAll('.map-type-btn');
    
    mapTypeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Don't trigger if we're dragging
            if (isDragging) return;
            
            // Remove active class from all buttons
            mapTypeButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Change map type
            const mapType = button.dataset.type;
            if (map && google.maps.MapTypeId[mapType.toUpperCase()]) {
                map.setMapTypeId(google.maps.MapTypeId[mapType.toUpperCase()]);
            }
        });
    });
}