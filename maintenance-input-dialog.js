// Input Dialog Modal Functions
let inputDialogCallback = null;

function showInputDialog(title, label, placeholder = '', callback) {
    const modal = document.getElementById('inputDialogModal');
    const titleElement = document.getElementById('inputDialogTitle');
    const labelElement = document.getElementById('inputDialogLabel');
    const inputField = document.getElementById('inputDialogField');
    
    titleElement.textContent = title;
    labelElement.textContent = label;
    inputField.placeholder = placeholder;
    inputField.value = '';
    
    inputDialogCallback = callback;
    modal.style.display = 'block';
    inputField.focus();
}

function hideInputDialog() {
    const modal = document.getElementById('inputDialogModal');
    modal.style.display = 'none';
    inputDialogCallback = null;
}

function confirmInputDialog() {
    const inputField = document.getElementById('inputDialogField');
    const value = inputField.value.trim();
    
    if (inputDialogCallback) {
        inputDialogCallback(value);
    }
    
    hideInputDialog();
}

// Handle Enter key in input dialog
document.addEventListener('DOMContentLoaded', function() {
    const inputField = document.getElementById('inputDialogField');
    if (inputField) {
        inputField.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                confirmInputDialog();
            }
        });
    }
});