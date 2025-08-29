/**
 * 헤더 인증 상태 관리 JavaScript
 * 로그인 상태에 따라 헤더 링크를 동적으로 변경
 */

class HeaderAuthManager {
    constructor() {
        this.isLoggedIn = false;
        this.user = null;
        this.init();
    }

    async init() {
        await this.checkAuthStatus();
        this.updateHeaderLinks();
        this.setupEventListeners();
    }

    async checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/me', {
                credentials: 'include'
            });
            const data = await response.json();
            
            if (data.loggedIn && data.user) {
                this.isLoggedIn = true;
                this.user = data.user;
                console.log('로그인 상태:', this.user);
            } else {
                this.isLoggedIn = false;
                this.user = null;
                console.log('비로그인 상태');
            }
        } catch (error) {
            console.error('인증 상태 확인 오류:', error);
            this.isLoggedIn = false;
            this.user = null;
        }
    }

    updateHeaderLinks() {
        const headerLinksElements = document.querySelectorAll('.header-links');
        
        headerLinksElements.forEach(headerLinks => {
            if (this.isLoggedIn) {
                // 로그인된 상태: 로그아웃, 고객센터만 표시
                headerLinks.innerHTML = `
                    <a href="#" class="header-link" id="logout-link">로그아웃</a>
                    <a href="#support" class="header-link">고객센터</a>
                `;
            } else {
                // 비로그인 상태: 로그인, 회원가입, 고객센터 표시
                headerLinks.innerHTML = `
                    <a href="login.html" class="header-link">로그인</a>
                    <a href="signup.html" class="header-link">회원가입</a>
                    <a href="#support" class="header-link">고객센터</a>
                `;
            }
        });

        // 로그아웃 링크에 이벤트 리스너 추가
        if (this.isLoggedIn) {
            const logoutLinks = document.querySelectorAll('#logout-link');
            logoutLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleLogout();
                });
            });
        }
    }

    async handleLogout() {
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                // 로컬 스토리지 정리
                localStorage.removeItem('user');
                localStorage.removeItem('pendingProfile');
                
                // 상태 업데이트
                this.isLoggedIn = false;
                this.user = null;
                
                // 헤더 링크 업데이트
                this.updateHeaderLinks();
                
                // 메시지 표시 (선택사항)
                this.showMessage('로그아웃되었습니다.', 'success');
                
                // 메인 페이지로 이동 (현재 페이지가 로그인이 필요한 페이지인 경우)
                if (this.isAuthRequiredPage()) {
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1000);
                } else if (window.location.pathname.includes('store.html')) {
                    // 스토어 페이지에서는 페이지를 새로고침하여 비로그인 상태로 업데이트
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                }
            } else {
                this.showMessage('로그아웃 실패: ' + (data.error || '알 수 없는 오류'), 'error');
            }
        } catch (error) {
            console.error('로그아웃 오류:', error);
            this.showMessage('로그아웃 중 오류가 발생했습니다.', 'error');
        }
    }

    isAuthRequiredPage() {
        const currentPage = window.location.pathname;
        const authRequiredPages = ['/profile.html', '/mypage.html'];
        return authRequiredPages.some(page => currentPage.includes(page));
    }

    showMessage(message, type = 'info') {
        // 기존 메시지 제거
        const existingMessage = document.querySelector('.auth-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // 새 메시지 생성
        const messageDiv = document.createElement('div');
        messageDiv.className = `auth-message auth-message-${type}`;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
        `;

        // 타입별 색상 설정
        switch (type) {
            case 'success':
                messageDiv.style.backgroundColor = '#10b981';
                break;
            case 'error':
                messageDiv.style.backgroundColor = '#ef4444';
                break;
            default:
                messageDiv.style.backgroundColor = '#3b82f6';
        }

        messageDiv.textContent = message;
        document.body.appendChild(messageDiv);

        // 3초 후 자동 제거
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (messageDiv.parentNode) {
                        messageDiv.remove();
                    }
                }, 300);
            }
        }, 3000);
    }

    setupEventListeners() {
        // 페이지 포커스 시 인증 상태 재확인
        window.addEventListener('focus', () => {
            this.checkAuthStatus().then(() => {
                this.updateHeaderLinks();
            });
        });

        // 로그인 성공 메시지 수신 (소셜 로그인 팝업에서)
        window.addEventListener('message', (event) => {
            if (event.data === 'social_login_success') {
                setTimeout(() => {
                    this.checkAuthStatus().then(() => {
                        this.updateHeaderLinks();
                    });
                }, 500);
            }
        });
    }

    // 외부에서 인증 상태 변경을 알릴 때 사용
    async refreshAuthStatus() {
        await this.checkAuthStatus();
        this.updateHeaderLinks();
    }
}

// CSS 애니메이션 추가
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// 전역 인스턴스 생성
let headerAuthManager;

// DOM 로드 완료 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    headerAuthManager = new HeaderAuthManager();
});

// 전역 접근을 위한 export
window.HeaderAuthManager = HeaderAuthManager;
window.headerAuthManager = headerAuthManager;