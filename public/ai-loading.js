(function (global) {
    'use strict';
    const instances = new WeakMap();
    const features = {
        meal: { title: '나에게 맞는 한 끼를\n차리고 있어요', description: '입력한 조건을 바탕으로 메뉴와 조리법을 준비해요.', chips: ['음식 취향', '영양 균형', '조리법'], note: '식단 구성에 따라 기다리는 시간이 달라질 수 있어요.' },
        ingredient: { title: '식재료에 담긴 정보를\n살펴보고 있어요', description: '영양 정보부터 보관법까지 한눈에 보기 좋게 정리해요.', chips: ['영양 정보', '활용법', '보관법'], note: '분석 결과가 도착하면 바로 보여드릴게요.' },
        supplement: { title: '내 건강에 맞는 선택을\n살펴보고 있어요', description: '건강 목표와 복용 정보를 바탕으로 추천을 준비해요.', chips: ['건강 목표', '복용 정보', '주의사항'], note: '추천과 제품 정보를 함께 준비해요.' },
        restaurant: { title: '내 조건에 맞는 식당을\n찾고 있어요', description: '주변 식당 정보와 선호 조건을 함께 살펴봐요.', chips: ['주변 식당', '음식 취향', '예산'], note: '주변 식당을 조회하는 데 시간이 걸릴 수 있어요.' },
    };
    // Original SVG: a plate with grain, a leaf and a tomato. No external animation dependency.
    const plate = `<svg class="eatple-ai-loading__plate" viewBox="0 0 220 220" fill="none" aria-hidden="true">
        <circle cx="110" cy="110" r="87" stroke="currentColor" stroke-width="1" opacity=".16"/>
        <g class="eatple-ai-loading__orbit"><path d="M110 23a87 87 0 0 1 75 43" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="35" cy="154" r="5" fill="#46A782"/><circle cx="165" cy="43" r="4" fill="#E4B657"/></g>
        <circle cx="110" cy="110" r="65" fill="white" stroke="#D8E1F2" stroke-width="2"/>
        <circle cx="110" cy="110" r="51" stroke="#E9EDF7" stroke-width="1.5"/>
        <path d="M78 106c-1-22 14-36 39-36 1 24-10 42-32 43" fill="#DCEEE4"/>
        <path d="m80 116 26-33" stroke="#348563" stroke-width="3" stroke-linecap="round"/>
        <path d="M114 106c15-10 32-5 32 10 0 13-9 21-22 20-13-1-18-20-10-30Z" fill="#D68068"/>
        <path d="m124 105 1-7m0 7-7-4m7 4 7-3" stroke="#348563" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M78 132c0-11 9-20 20-20 12 0 21 9 21 20v6H78v-6Z" fill="#EDE5CC"/>
        <path d="m86 127 3-2m8 1 2-3m7 6 3-2" stroke="#B29C63" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
    function mount(target, options = {}) {
        if (typeof target === 'string') target = document.querySelector(target);
        if (!target) throw new Error('AI loading container was not found');
        instances.get(target)?.destroy();
        const config = features[options.feature] || features.meal;
        const node = document.createElement('section');
        node.className = 'eatple-ai-loading';
        node.setAttribute('aria-label', 'AI 결과 준비');
        node.innerHTML = `<div class="eatple-ai-loading__identity"><img src="/images/eatplelogo.webp" alt="잇플" width="72" height="28"><span class="eatple-ai-loading__identity-line"></span></div>
            <div class="eatple-ai-loading__illustration">${plate}</div>
            <div class="eatple-ai-loading__copy"><h2 class="eatple-ai-loading__title"></h2><p class="eatple-ai-loading__description"></p></div>
            <div class="eatple-ai-loading__chips" aria-label="결과에 담을 내용"></div>
            <div class="eatple-ai-loading__activity" role="progressbar" aria-label="요청 처리 중"><span></span></div>
            <p class="eatple-ai-loading__status" role="status" aria-live="polite" aria-atomic="true">요청을 처리하고 있어요</p>
            <p class="eatple-ai-loading__note"></p>`;
        node.querySelector('h2').textContent = config.title;
        node.querySelector('.eatple-ai-loading__description').textContent = config.description;
        node.querySelector('.eatple-ai-loading__note').textContent = config.note;
        for (const label of (options.chips || config.chips).slice(0, 4)) {
            const chip = document.createElement('span');
            chip.className = 'eatple-ai-loading__chip'; chip.textContent = label;
            node.querySelector('.eatple-ai-loading__chips').append(chip);
        }
        const wasBusy = target.getAttribute('aria-busy');
        target.setAttribute('aria-busy', 'true');
        target.classList.add('eatple-ai-loading-host');
        target.replaceChildren(node);
        let destroyed = false;
        const timers = [
            setTimeout(() => { if (node.isConnected) node.querySelector('.eatple-ai-loading__status').textContent = '조금 더 시간이 걸리고 있어요'; }, 30000),
            setTimeout(() => { if (node.isConnected) node.querySelector('.eatple-ai-loading__note').textContent = '결과가 도착하면 바로 보여드릴게요. 잠시만 더 기다려주세요.'; }, 90000),
        ];
        const controller = {
            setStatus(message) { if (!destroyed) node.querySelector('.eatple-ai-loading__status').textContent = message; },
            destroy() {
                if (destroyed) return;
                destroyed = true; timers.forEach(clearTimeout);
                node.remove();
                target.classList.remove('eatple-ai-loading-host');
                if (wasBusy === null) target.removeAttribute('aria-busy'); else target.setAttribute('aria-busy', wasBusy);
                instances.delete(target);
            },
        };
        instances.set(target, controller);
        return controller;
    }
    global.EatpleAILoading = { mount };
})(window);
