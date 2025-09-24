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

// Load worker info for display in info window
async function loadWorkerInfo(workerId, jobId) {
    try {
        const response = await fetch(`http://localhost:8001/api/workers/${workerId}`);
        if (response.ok) {
            const worker = await response.json();
            const workerElement = document.getElementById(`worker-${jobId}`);
            if (workerElement) {
                workerElement.textContent = `${worker.name} (${worker.role})`;
                workerElement.style.color = '#333';
            }
        } else {
            const workerElement = document.getElementById(`worker-${jobId}`);
            if (workerElement) {
                workerElement.textContent = 'Worker not found';
                workerElement.style.color = '#dc3545';
            }
        }
    } catch (error) {
        console.error('Error loading worker info:', error);
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
        const response = await fetch('http://localhost:8001/api/workers');
        if (response.ok) {
            const workers = await response.json();
            const select = document.getElementById('workerSelect');
            
            workers.forEach(worker => {
                const option = document.createElement('option');
                option.value = worker.id;
                option.textContent = `${worker.name} (${worker.role})`;
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
        const response = await fetch(`http://localhost:8001/api/jobs/${jobId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                assignedWorkerId: workerId
            })
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
            const currentIcon = annotation.overlay.getIcon();
            annotation.overlay.setIcon({
                ...currentIcon,
                fillColor: newColor
            });
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
    
    // Store the imported classes globally for use in other functions
    window.AdvancedMarkerElement = AdvancedMarkerElement;
    window.PinElement = PinElement;
    window.DrawingManager = DrawingManager;
    
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
        styles: [
            {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
            }
        ]
    });

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
    
    console.log('Map initialized successfully');
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
    const name = prompt(`Enter a name for this ${annotationType}:`);
    if (!name) {
        overlay.setMap(null);
        return;
    }
    
    const description = prompt(`Enter a description for this ${annotationType} (optional):`);
    
    try {
        // Save annotation to database
        const annotation = {
            annotationType: annotationType,
            name: name,
            description: description || '',
            coordinates: coordinates,
            styleOptions: getStyleOptions(overlay, type)
        };
        
        console.log('Saving annotation:', annotation);
        console.log('Current job ID:', currentJobId);
        
        const savedAnnotation = await window.neonDB.createAnnotation(currentJobId, annotation);
        
        console.log('Annotation saved successfully:', savedAnnotation);
        
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
        
        await window.neonDB.updateAnnotation(annotationId, { 
            name, 
            description, 
            styleOptions: updatedStyleOptions 
        });
        
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
        await window.neonDB.deleteAnnotation(annotationId);
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

// Load and display existing annotations for a job
async function loadJobAnnotations(jobId) {
    try {
        const annotations = await window.neonDB.getJobAnnotations(jobId);
        
        if (!jobAnnotations[jobId]) {
            jobAnnotations[jobId] = [];
        }
        
        annotations.forEach(annotation => {
            // PostgreSQL JSON columns are automatically parsed, no need to JSON.parse
            const coordinates = annotation.coordinates;
            const styleOptions = annotation.style_options || {};
            let overlay;
            
            switch(annotation.annotation_type) {
                case 'polygon':
                    overlay = new google.maps.Polygon({
                        paths: coordinates,
                        fillColor: styleOptions.fillColor || '#FF0000',
                        fillOpacity: styleOptions.fillOpacity || 0.35,
                        strokeColor: styleOptions.strokeColor || '#FF0000',
                        strokeWeight: styleOptions.strokeWeight || 2,
                        map: map,
                        editable: false // Polygons are not editable by default
                    });
                    break;
                    
                case 'line':
                    overlay = new google.maps.Polyline({
                        path: coordinates,
                        strokeColor: styleOptions.strokeColor || '#FF0000',
                        strokeOpacity: styleOptions.strokeOpacity || 1.0,
                        strokeWeight: styleOptions.strokeWeight || 2,
                        map: map,
                        editable: false // Lines are not editable by default
                    });
                    break;
                    
                case 'pin':
                    overlay = new google.maps.Marker({
                        position: coordinates[0],
                        map: map,
                        title: annotation.name,
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 8,
                            fillColor: styleOptions.fillColor || '#FF0000',
                            fillOpacity: 1,
                            strokeColor: '#FFFFFF',
                            strokeWeight: 2
                        }
                    });
                    break;
            }
            
            if (overlay) {
                // Store annotation with overlay
                jobAnnotations[jobId].push({
                    ...annotation,
                    overlay: overlay
                });
                
                // Add click listener for interaction
                addAnnotationListeners(overlay, annotation);
            }
        });
        
        // Create connection lines after all annotations are loaded
        if (jobAnnotations[jobId] && jobAnnotations[jobId].length > 0) {
            createConnectionLines(jobId);
        }
        
    } catch (error) {
        console.error('Error loading annotations:', error);
    }
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
        if (annotation.overlay) {
            let annotationPosition;
            
            // Get position based on annotation type
            switch(annotation.annotation_type) {
                case 'pin':
                    annotationPosition = annotation.overlay.getPosition();
                    break;
                case 'polygon':
                    // Use the center of the polygon
                    const bounds = new google.maps.LatLngBounds();
                    annotation.overlay.getPath().forEach(point => bounds.extend(point));
                    annotationPosition = bounds.getCenter();
                    break;
                case 'line':
                    // Use the midpoint of the line
                    const path = annotation.overlay.getPath();
                    const midIndex = Math.floor(path.getLength() / 2);
                    annotationPosition = path.getAt(midIndex);
                    break;
            }
            
            if (annotationPosition) {
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
            }
        }
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
    const name = prompt('Enter pin name:');
    if (!name) return;
    
    const description = prompt('Enter pin description (optional):') || '';
    
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
        const savedAnnotation = await window.neonDB.createAnnotation(currentJobId, annotation);
        
        // Create marker
        const marker = new google.maps.Marker({
            position: latLng,
            map: map,
            title: name,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: '#ff0000',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                scale: 8
            }
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
        const response = await fetch('http://localhost:8001/api/workers');
        const workers = await response.json();
        
        const assignedWorkerSelect = document.getElementById('assignedWorker');
        if (assignedWorkerSelect) {
            // Clear existing options except the first one
            assignedWorkerSelect.innerHTML = '<option value="">Select Worker</option>';
            
            // Add worker options
            workers.forEach(worker => {
                const option = document.createElement('option');
                option.value = worker.id;
                option.textContent = `${worker.name} (${worker.role})`;
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
// Create a new job
async function createJob() {
    if (!selectedLocation) {
        showNotification('Please select a location on the map first.');
        return;
    }

    const formData = new FormData(document.getElementById('jobForm'));
    const job = {
        jobNumber: formData.get('jobNumber'),
        title: formData.get('jobTitle'),
        type: formData.get('jobType'),
        description: formData.get('jobDescription'),
        contactName: formData.get('contactName'),
        contactPhone: formData.get('contactPhone'),
        assignedWorkerId: formData.get('assignedWorker') || null,
        location: selectedLocation,
        locationAddress: '', // Will be filled by reverse geocoding if needed
        status: 'pending'
    };

    // Validate required fields
    if (!job.jobNumber || !job.title || !job.type || !job.description) {
        showNotification('Please fill in all required fields.');
        return;
    }

    try {
        // Save to Neon database
        const savedJob = await window.neonDB.createJob({
            title: job.title,
            description: job.description,
            jobType: job.type,
            location: job.location,
            locationAddress: job.locationAddress,
            contactName: job.contactName,
            contactPhone: job.contactPhone,
            assignedWorkerId: job.assignedWorkerId
        });
        
        // Update job with database ID and add to local array
        job.id = savedJob.id.toString();
        job.createdAt = savedJob.created_at;
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
        
        console.log('Job created and saved to Neon database:', job);
    } catch (error) {
        console.error('Error creating job:', error);
        
        // Fallback to localStorage only
        job.id = Date.now().toString();
        job.createdAt = new Date().toISOString();
        jobs.push(job);
        saveJobs();
        createJobMarker(job);
        updateJobList();
        hideJobModal();
        showNotification(`Job "${job.title}" created (saved locally only)`);
        console.log('Job created with localStorage fallback:', job);
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
        `<p style="margin: 5px 0; color: #666;"><strong>Assigned Worker:</strong> <span id="worker-${job.id}">Loading...</span></p>` :
        `<p style="margin: 5px 0; color: #666;"><strong>Assigned Worker:</strong> <span style="color: #999;">Not assigned</span></p>`;
    
    // Edit mode status indicator
    const editModeStatus = isCurrentJobInEditMode 
        ? `<div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 6px; margin-bottom: 10px; font-size: 12px;">
             <span style="color: #856404;">🟡 <strong>Edit Mode Active</strong> - Click annotations to edit them</span>
           </div>`
        : '';
    
    // Unsaved changes warning
    const unsavedWarning = hasUnsavedChanges 
        ? `<div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 6px; margin-bottom: 10px; font-size: 12px;">
             <span style="color: #721c24;">⚠️ <strong>Unsaved Changes</strong> - Don't forget to save your edits!</span>
           </div>`
        : '';
    
    // Save/Revert buttons (only show when there are unsaved changes)
    const saveRevertButtons = hasUnsavedChanges 
        ? `<div style="display: flex; gap: 5px; margin-bottom: 8px;">
             <button onclick="saveAllJobChanges(${job.id})" style="flex: 1; padding: 6px 8px; font-size: 12px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;">
                 💾 Save All Changes
             </button>
             <button onclick="revertAllJobChanges(${job.id})" style="flex: 1; padding: 6px 8px; font-size: 12px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer;">
                 ↶ Revert All
             </button>
           </div>`
        : '';
    
    // Toggle Edit Mode button styling
    const toggleButtonStyle = isCurrentJobInEditMode 
        ? "background: #fd7e14; color: white;" // Orange when active
        : "background: #17a2b8; color: white;"; // Teal when inactive
    
    const toggleButtonText = isCurrentJobInEditMode ? "🔒 Exit Edit Mode" : "✏️ Enter Edit Mode";
    
    // Load worker info if assigned
    if (job.assignedWorkerId) {
        loadWorkerInfo(job.assignedWorkerId, job.id);
    }
    
    return `
        <div style="max-width: 320px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-radius: 12px; padding: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border: 1px solid rgba(0,0,0,0.05);">
            ${editModeStatus}
            ${unsavedWarning}
            
            <div style="display: flex; align-items: center; margin-bottom: 12px;">
                <div style="width: 8px; height: 40px; background: ${getMarkerColor(job.type)}; border-radius: 4px; margin-right: 12px;"></div>
                <div>
                    <h3 style="margin: 0; color: #1a1a1a; font-size: 18px; font-weight: 700; line-height: 1.2;">${job.title}</h3>
                    <p style="margin: 2px 0 0 0; color: #6c757d; font-size: 13px; font-weight: 500;">Job #${job.jobNumber || 'N/A'}</p>
                </div>
            </div>
            
            <div style="background: rgba(255,255,255,0.7); border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; margin-bottom: 10px;">
                    <div>
                        <span style="color: #6c757d; font-weight: 500;">Type:</span>
                        <div style="background: ${getMarkerColor(job.type)}; color: white; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; margin-top: 2px; display: inline-block;">${job.type}</div>
                    </div>
                    <div>
                        <span style="color: #6c757d; font-weight: 500;">Annotations:</span>
                        <div style="color: #495057; font-weight: 600; margin-top: 2px;">${annotationCount}</div>
                    </div>
                </div>
                
                <div style="padding-top: 10px; border-top: 1px solid rgba(0,0,0,0.1);">
                    ${assignedWorkerInfo}
                    <div style="margin-bottom: 6px;">
                        <span style="color: #6c757d; font-weight: 500; font-size: 12px;">Created:</span>
                        <div style="color: #495057; font-size: 13px; margin-top: 1px;">${new Date(job.createdAt).toLocaleDateString()}</div>
                    </div>
                </div>
            </div>
            
            <div style="background: rgba(248,249,250,0.8); border-radius: 8px; padding: 10px; margin-bottom: 12px;">
                <span style="color: #6c757d; font-weight: 500; font-size: 12px;">Description:</span>
                <div style="color: #495057; font-size: 13px; line-height: 1.4; margin-top: 4px;">${job.description}</div>
            </div>
            
            <div style="margin-bottom: 12px;">
                <button onclick="showWorkerAssignmentModal(${job.id})" style="padding: 10px 14px; font-size: 13px; background: linear-gradient(135deg, #6f42c1, #8e44ad); color: white; border: none; border-radius: 8px; cursor: pointer; width: 100%; font-weight: 600; margin-bottom: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    👤 Assign Worker
                </button>
                
                ${saveRevertButtons}
                
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-bottom: 8px;">
                    <button onclick="startDrawing('polygon', ${job.id})" style="padding: 6px 8px; font-size: 11px; background: linear-gradient(135deg, #28a745, #20c997); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
                        📐 Polygon
                    </button>
                    <button onclick="startDrawing('pin', ${job.id})" style="padding: 6px 8px; font-size: 11px; background: linear-gradient(135deg, #007bff, #17a2b8); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
                        📍 Pin
                    </button>
                    <button onclick="startDrawing('line', ${job.id})" style="padding: 6px 8px; font-size: 11px; background: linear-gradient(135deg, #ffc107, #fd7e14); color: black; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
                        📏 Line
                    </button>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                    <button onclick="loadJobAnnotations(${job.id})" style="padding: 8px 10px; font-size: 12px; background: linear-gradient(135deg, #6c757d, #5a6268); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
                        📋 View All
                    </button>
                    <button onclick="console.log('Toggle button clicked for job:', ${job.id}); toggleAnnotationEditing(${job.id})" style="padding: 8px 10px; font-size: 12px; ${toggleButtonStyle} border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        ${toggleButtonText}
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Update job list in panel
function updateJobList() {
    const jobList = document.getElementById('jobList');
    
    if (jobs.length === 0) {
        jobList.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No jobs created yet</p>';
        return;
    }
    
    jobList.innerHTML = jobs.map(job => `
        <div class="job-item job-type-${job.type.replace(' ', '')}" onclick="focusOnJob('${job.id}')">
            <h4>${job.title}</h4>
            <p><strong>Job #:</strong> ${job.jobNumber}</p>
            <p><strong>Type:</strong> ${job.type}</p>
            <p><strong>Created:</strong> ${new Date(job.createdAt).toLocaleDateString()}</p>
        </div>
    `).join('');
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
    console.log('toggleAnnotationEditing called with jobId:', jobId);
    console.log('Current isJobEditMode:', isJobEditMode);
    console.log('Current currentJobId:', currentJobId);
    
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
    
    console.log('After toggle - isJobEditMode:', isJobEditMode);
    console.log('After toggle - currentJobId:', currentJobId);
    
    // Refresh the info window to show the updated button state
    refreshJobInfoWindow(jobId);
}

// Load jobs from Neon database
async function loadJobs() {
    try {
        const jobsData = await window.neonDB.getJobs();
        
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
                jobNumber: jobData.title, // Map title to jobNumber for compatibility
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
                createdAt: jobData.created_at
            };
            jobs.push(job);
            
            // Create marker for each job (now async to load annotations)
            await createJobMarker(job);
        }
        
        // Update UI
        updateJobList();
        saveJobs(); // Backup to localStorage
        
        // Load equipment after jobs are loaded
        await loadEquipment();
        
        console.log(`Loaded ${jobs.length} jobs from Neon database`);
    } catch (error) {
        console.error('Error loading jobs from Neon database:', error);
        // Fallback to localStorage
        loadJobsFromLocalStorage();
        showNotification('Unable to connect to database - showing cached jobs');
    }
}

// Fallback function to load from localStorage
function loadJobsFromLocalStorage() {
    const savedJobs = localStorage.getItem('jobManagementJobs');
    if (savedJobs) {
        jobs = JSON.parse(savedJobs);
        
        // Recreate markers for loaded jobs
        jobs.forEach(job => {
            createJobMarker(job);
        });
        
        updateJobList();
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
    console.log('refreshJobInfoWindow called for jobId:', jobId, 'type:', typeof jobId);
    
    // Find the job - handle both string and number IDs
    const job = jobs.find(j => j.id == jobId || j.id === jobId.toString() || j.id === parseInt(jobId));
    if (!job) {
        console.log('Job not found for id:', jobId);
        console.log('Available job IDs:', jobs.map(j => j.id));
        return;
    }
    
    // Find the job marker
    const jobMarker = jobMarkers.find(marker => marker.jobId === jobId);
    if (!jobMarker) {
        console.log('Job marker not found for jobId:', jobId);
        return;
    }
    
    console.log('Refreshing info window for job:', job.title);
    
    // Close and reopen the info window with updated content
    if (jobMarker.infoWindow) {
        jobMarker.infoWindow.close();
        const newContent = createInfoWindowContent(job);
        console.log('New info window content created');
        jobMarker.infoWindow.setContent(newContent);
        jobMarker.infoWindow.open(map, jobMarker);
        console.log('Info window reopened with new content');
    } else {
        console.log('No info window found on job marker');
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
document.addEventListener('DOMContentLoaded', function() {
    // Initialize event listeners and check URL parameters
    initializeEventListeners();
    checkUrlParameters();
    console.log('Job Management Map application loaded');
});

// Equipment management functions
async function loadEquipment() {
    try {
        const response = await fetch('http://localhost:8001/api/equipment');
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
            
            console.log(`Loaded ${equipment.length} equipment items, ${equipmentMarkers.length} with location`);
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
    
    const marker = new google.maps.Marker({
        position: position,
        map: map,
        title: `${equipmentItem.name} (${equipmentItem.category})`,
        icon: {
            path: iconInfo.path,
            fillColor: iconInfo.color,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 1.2,
            anchor: new google.maps.Point(12, 12)
        },
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
        const response = await fetch('http://localhost:8001/api/equipment/maintenance-requests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
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