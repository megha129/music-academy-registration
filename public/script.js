document.getElementById('registrationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = submitBtn.querySelector('.spinner');
    const messageBox = document.getElementById('messageBox');
    
    // Detect if testing on wrong local port
    if (window.location.port === '3001') {
        messageBox.textContent = '⚠️ You are on the DESIGN PREVIEW link. The "Register" button ONLY works on your Live Render Site. Please use the Render link I gave you!';
        messageBox.className = 'message-box error';
        submitBtn.disabled = false;
        btnText.textContent = 'Register Now';
        spinner.classList.add('hidden');
        return;
    }
    
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
    
    // --- EMAILJS CONFIG ---
    const EMAILJS_SERVICE_ID = "service_2x98zwz";
    const EMAILJS_TEMPLATE_ID = "template_olpvqws";

    try {
        console.log('Sending registration request...');

        // --- 1. Send Email via EmailJS (Frontend) ---
        if (typeof emailjs !== 'undefined') {
            console.log("Attempting to send email via EmailJS...");
            emailjs.sendForm(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, '#registrationForm')
                .then((result) => {
                    console.log('EmailJS SUCCESS!', result.status, result.text);
                }, (error) => {
                    console.error('EmailJS FAILED...', error);
                });
        } else {
            console.error("EmailJS library not loaded yet.");
        }

        // --- 2. Save to Database (Backend) ---
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        console.log('Response received from server:', response.status);
        const data = await response.json();
        
        if (response.ok) {
            messageBox.textContent = 'Registration successful! Check your email.';
            messageBox.className = 'message-box success';
            form.reset();
        } else {
            messageBox.textContent = data.message || 'An error occurred during registration.';
            messageBox.className = 'message-box error';
        }
    } catch (error) {
        console.error('Fetch Error:', error);
        messageBox.textContent = `Error: ${error.message}. Please check if you are on the Live Render site.`;
        messageBox.className = 'message-box error';
    } finally {
        submitBtn.disabled = false;
        btnText.textContent = 'Register Now';
        spinner.classList.add('hidden');
    }
});
