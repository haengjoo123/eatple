// 문의하기 폼 제출 처리
document.addEventListener('DOMContentLoaded', function() {
  const contactForm = document.getElementById('contactForm');
  const contactModal = document.getElementById('contactModal');
  
  if (contactForm) {
    contactForm.addEventListener('submit', async function(event) {
      event.preventDefault();
      
      // 폼 데이터 수집
      const category = document.getElementById('contactCategory').value;
      const subject = document.getElementById('contactSubject').value;
      const message = document.getElementById('contactMessage').value;
      const email = document.getElementById('contactEmail').value;
      
      // 유효성 검사
      if (!category || !subject || !message) {
        showToast('모든 필수 항목을 입력해주세요.', 'error');
        return;
      }
      
      try {
        // API 호출
        const response = await fetch('/api/contact/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            category,
            subject,
            message,
            email
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          // 모달 닫기
          if (contactModal) {
            const closeModalBtn = contactModal.querySelector('.close-modal');
            if (closeModalBtn) {
              closeModalBtn.click();
            } else {
              contactModal.style.display = 'none';
            }
          }
          
          // 폼 초기화
          contactForm.reset();
          
          // 성공 메시지 표시
          showToast('문의가 성공적으로 접수되었습니다.', 'success');
        } else {
          showToast(data.message || '문의 접수 중 오류가 발생했습니다.', 'error');
        }
      } catch (error) {
        console.error('문의 제출 오류:', error);
        showToast('문의 접수 중 오류가 발생했습니다.', 'error');
      }
    });
  }
  
  // 토스트 메시지가 없는 경우를 대비한 함수 정의
  if (typeof showToast !== 'function') {
    window.showToast = function(message, type = 'success') {
      // 기존 토스트 제거
      const existingToast = document.querySelector('.toast-message');
      if (existingToast) {
        existingToast.remove();
      }
      
      // 새 토스트 생성
      const toast = document.createElement('div');
      toast.className = `toast-message toast-${type}`;
      toast.textContent = message;
      toast.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: ${type === 'error' ? '#dc3545' : '#28a745'};
          color: white;
          padding: 12px 20px;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 10000;
          font-size: 14px;
          font-weight: 500;
          opacity: 0;
          transform: translateX(100%);
          transition: all 0.3s ease;
      `;
      
      document.body.appendChild(toast);
      
      // 애니메이션 표시
      setTimeout(() => {
          toast.style.opacity = '1';
          toast.style.transform = 'translateX(0)';
      }, 100);
      
      // 3초 후 자동 제거
      setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.transform = 'translateX(100%)';
          setTimeout(() => {
              if (toast.parentNode) {
                  toast.remove();
              }
          }, 300);
      }, 3000);
    }
  }
});