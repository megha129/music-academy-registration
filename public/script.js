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
    
    console.log('Sending registration request to /api/register...');
    
    // --- EMAILJS CONFIG ---
    const EMAILJS_PUBLIC_KEY = "4hh-HDCpw_jMw5Dar"; 
    const EMAILJS_SERVICE_ID = "service_2x98zwz";
    const EMAILJS_TEMPLATE_ID = "template_olpvqws";

    try {
        // 1. Send Email via EmailJS (Frontend)
        if (EMAILJS_PUBLIC_KEY !== "YOUR_PUBLIC_KEY") {
            emailjs.init(EMAILJS_PUBLIC_KEY);
            emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
                from_name: formData.name,
                from_email: formData.email,
                phone: formData.phone,
                instrument: formData.instrument,
                to_email: "meghashreenandish14@gmail.com"
            }).then(() => console.log('EmailJS: Success!'))
              .catch(err => console.error('EmailJS Error:', err));
        }

        // 2. Save to Database (Backend)
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        console.log('Response received from server:', response.status);
        
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
        console.error('Fetch Error:', error);
        messageBox.textContent = `Error: ${error.message}. Please check if you are on the Live Render site and not the Preview link.`;
        messageBox.className = 'message-box error';
    } finally {
        // Reset loading state
        submitBtn.disabled = false;
        btnText.textContent = 'Register Now';
        spinner.classList.add('hidden');
    }
});
