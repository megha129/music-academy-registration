document.getElementById('registrationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = submitBtn.querySelector('.spinner');
    const messageBox = document.getElementById('messageBox');
    
    // Reset message box
    messageBox.className = 'message-box hidden';
    messageBox.textContent = '';
    
    // Get values
    const formData = {
        name: form.name.value,
        email: form.email.value,
        phone: form.phone.value,
        instrument: form.instrument.value
    };
    
    // Set loading state
    submitBtn.disabled = true;
    btnText.textContent = 'Processing...';
    spinner.classList.remove('hidden');
    
    // Add a 10-second timeout to the fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const data = await response.json();
        
        if (response.ok) {
            // Success
            messageBox.textContent = data.message || 'Registration successful! Check your email.';
            messageBox.className = 'message-box success';
            form.reset();
        } else {
            // Error from server
            messageBox.textContent = data.message || 'An error occurred during registration.';
            messageBox.className = 'message-box error';
        }
    } catch (error) {
        // Network or other error
        messageBox.textContent = 'Failed to connect to the server. Please try again later.';
        messageBox.className = 'message-box error';
    } finally {
        // Reset loading state
        submitBtn.disabled = false;
        btnText.textContent = 'Register Now';
        spinner.classList.add('hidden');
    }
});
