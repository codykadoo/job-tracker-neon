// Input Dialog Modal Functions for Equipment Page
let inputDialogResolve = null;

function showInputDialog(title, label, placeholder = '') {
    return new Promise((resolve) => {
        inputDialogResolve = resolve;
        
        // Set modal content
        document.getElementById('inputDialogTitle').textContent = title;
        document.getElementById('inputDialogLabel').textContent = label;
        document.getElementById('inputDialogField').placeholder = placeholder;
        document.getElementById('inputDialogField').value = '';
        
        // Show modal
        document.getElementById('inputDialogModal').style.display = 'block';
        
        // Focus on input field
        setTimeout(() => {
            document.getElementById('inputDialogField').focus();
        }, 100);
    });
}

function hideInputDialog() {
    document.getElementById('inputDialogModal').style.display = 'none';
    if (inputDialogResolve) {
        inputDialogResolve(null);
        inputDialogResolve = null;
    }
}

function confirmInputDialog() {
    const value = document.getElementById('inputDialogField').value.trim();
    document.getElementById('inputDialogModal').style.display = 'none';
    
    if (inputDialogResolve) {
        inputDialogResolve(value || null);
        inputDialogResolve = null;
    }
}

// Handle Enter key in input field
document.addEventListener('DOMContentLoaded', function() {
    const inputField = document.getElementById('inputDialogField');
    if (inputField) {
        inputField.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                confirmInputDialog();
            }
        });
    }
});