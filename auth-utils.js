// Shared authentication utilities
class AuthUtils {
    static async checkAuth() {
        try {
            const response = await fetch('/api/auth/me', {
        credentials: 'include'
    });
            if (response.ok) {
                const data = await response.json();
                return { authenticated: true, user: data };
            }
            return { authenticated: false, user: null };
        } catch (error) {
            // Suppress noisy errors that occur during navigation redirects
            return { authenticated: false, user: null };
        }
    }

    static async requireAuth(redirectUrl = '/login.html') {
        const authResult = await this.checkAuth();
        if (!authResult.authenticated) {
            window.location.href = redirectUrl;
            return false;
        }
        return authResult.user;
    }

    static async requireAdmin(redirectUrl = '/') {
        const user = await this.requireAuth();
        if (!user) return false;
        
        if (!user.roles || !user.roles.includes('Admin')) {
            alert('Access denied. Admin privileges required.');
            window.location.href = redirectUrl;
            return false;
        }
        return user;
    }

    static async logout() {
        try {
            const response = await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
            
            if (response.ok) {
                localStorage.removeItem('user');
                window.location.href = '/login.html';
                return true;
            } else {
                alert('Logout failed. Please try again.');
                return false;
            }
        } catch (error) {
            console.error('Logout error:', error);
            alert('Logout failed. Please try again.');
            return false;
        }
    }

    static updateNavForAuthenticatedUser(user) {
        const navLinks = document.querySelector('.nav-links');
        if (!navLinks) return;
        
        // Remove existing user info if any
        const existingUserInfo = navLinks.querySelector('.nav-user-info');
        if (existingUserInfo) {
            existingUserInfo.remove();
        }

        // Add user info and logout button
        const userInfo = document.createElement('div');
        userInfo.className = 'nav-user-info';
        userInfo.innerHTML = `
            <span class="user-name">Welcome, ${user.name}</span>
            <button onclick="AuthUtils.logout()" class="nav-link logout-btn">
                <i class="fas fa-sign-out-alt"></i>
                Logout
            </button>
        `;
        navLinks.appendChild(userInfo);

        // Show/hide admin link based on user role
        const adminLink = document.querySelector('a[href="admin.html"]');
        if (adminLink) {
            adminLink.style.display = user.role === 'admin' ? 'block' : 'none';
        }
    }

    static updateNavForUnauthenticatedUser() {
        const navLinks = document.querySelector('.nav-links');
        if (!navLinks) return;
        
        // Remove existing user info if any
        const existingUserInfo = navLinks.querySelector('.nav-user-info');
        if (existingUserInfo) {
            existingUserInfo.remove();
        }

        // Remove existing login link if any
        const existingLoginLink = navLinks.querySelector('.login-btn');
        if (existingLoginLink) {
            existingLoginLink.remove();
        }

        // Add login button
        const loginLink = document.createElement('a');
        loginLink.href = '/login.html';
        loginLink.className = 'nav-link login-btn';
        loginLink.innerHTML = `
            <i class="fas fa-sign-in-alt"></i>
            Login
        `;
        navLinks.appendChild(loginLink);

        // Hide admin link for unauthenticated users
        const adminLink = document.querySelector('a[href="admin.html"]');
        if (adminLink) {
            adminLink.style.display = 'none';
        }
    }

    static async initializeNavigation() {
        const authResult = await this.checkAuth();
        if (authResult.authenticated) {
            this.updateNavForAuthenticatedUser(authResult.user);
        } else {
            this.updateNavForUnauthenticatedUser();
        }
    }
}

// Make AuthUtils available globally
window.AuthUtils = AuthUtils;