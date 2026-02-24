document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on the register page
    const registerForm = document.querySelector('form[action="index.html"]');
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const usernameInput = document.getElementById('username');
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            const confirmPasswordInput = document.getElementById('confirm-password');

            const username = usernameInput.value;
            const email = emailInput.value;
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            if (password !== confirmPassword) {
                alert('Passwords do not match!');
                return;
            }

            // Create user object
            const user = {
                username: username,
                email: email,
                password: password
            };

            // Retrieve existing users or initialize empty array
            let users = JSON.parse(localStorage.getItem('users')) || [];
            
            // Check if user already exists
            const existingUser = users.find(u => u.username === username || u.email === email);
            if (existingUser) {
                alert('User with this username or email already exists!');
                return;
            }

            // Add new user
            users.push(user);
            
            // Save to localStorage (mimicking DB)
            localStorage.setItem('users', JSON.stringify(users));
            
            // Log to console as requested
            console.log('User registered:', user);
            console.log('All users:', users);

            alert('Registration successful! Redirecting to login...');
            window.location.href = 'index.html';
        });
    }

    // Check if we are on the login page
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');

            const username = usernameInput.value;
            const password = passwordInput.value;

            // Retrieve users from localStorage
            let users = JSON.parse(localStorage.getItem('users')) || [];

            // Find user
            const user = users.find(u => u.username === username && u.password === password);

            if (user) {
                console.log('Login successful:', user);
                sessionStorage.setItem('userToken', user.username); // Create session token
                window.location.href = 'home.html';
            } else {
                console.log('Login failed: Invalid credentials');
                alert('Invalid username or password');
            }
        });
    }
});
