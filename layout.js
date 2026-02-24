document.addEventListener('DOMContentLoaded', () => {
    // Session Guard Logic
    let currentPage = window.location.pathname.split('/').pop();
    if (!currentPage) currentPage = 'index.html'; // Default to index for root
    
    const isAuthPage = currentPage === 'index.html' || currentPage === 'register.html';
    const userToken = sessionStorage.getItem('userToken');

    if (!userToken && !isAuthPage) {
        // Not logged in and trying to access interior page
        window.location.href = 'index.html';
        return; // Stop execution
    }

    if (userToken && isAuthPage) {
        // Logged in and trying to access auth page
        window.location.href = 'home.html';
        return; // Stop execution
    }

    // Layout Injector
    const headerHTML = `
        <header>
            <a href="home.html" class="logo">Mi Test Web</a>
            <nav>
                <a href="home.html" ${currentPage === 'home.html' ? 'class="active"' : ''}>Home</a>
                <a href="about.html" ${currentPage === 'about.html' ? 'class="active"' : ''}>About</a>
                <a href="services.html" ${currentPage === 'services.html' ? 'class="active"' : ''}>Services</a>
                <a href="contact.html" ${currentPage === 'contact.html' ? 'class="active"' : ''}>Contact</a>
                ${!userToken ? `
                    <a href="index.html" ${currentPage === 'index.html' ? 'class="active"' : ''}>Login</a>
                    <a href="register.html" ${currentPage === 'register.html' ? 'class="active"' : ''}>Register</a>
                ` : `
                    <a href="#" id="logoutLink">Logout</a>
                `}
            </nav>
        </header>
    `;

    const footerHTML = `
        <footer>
            &copy; 2026 Mi Test Web. All rights reserved.
        </footer>
    `;

    // Inject header at the beginning of the body
    document.body.insertAdjacentHTML('afterbegin', headerHTML);
    // Inject footer before the scripts at the end
    document.body.insertAdjacentHTML('beforeend', footerHTML);

    // Logout logic
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            sessionStorage.removeItem('userToken');
            window.location.href = 'index.html';
        });
    }
});
