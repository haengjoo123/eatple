(function (global) {
  'use strict';
  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const cleanLabel = label => label.replace(/^[^가-힣a-zA-Z0-9]+/u, '').trim();
  function showProfileError(section, message) {
    if (!section) return;
    let error = section.querySelector('.intake-profile-error');
    if (!error) { error = create('p', 'intake-profile-error'); error.setAttribute('role', 'alert'); section.querySelector('.section-guide')?.after(error); }
    error.textContent = message;
    const target = section.querySelector('input.invalid, input:invalid, .option-group.error .option, .option-group:not(:has(.selected)) .option');
    target?.focus();
  }
  function mount({ target, questions, answers, index = 0, onIndex, onComplete, onBack, title, submitLabel }) {
    const host = typeof target === 'string' ? document.querySelector(target) : target;
    let reviewing = false;
    let editing = false;
    const available = () => questions.filter(q => !q.when || q.when(answers));
    const notify = () => onIndex?.(questions.indexOf(available()[index]));
    const valueLabel = q => {
      const value = answers[q.key];
      const values = Array.isArray(value) ? value : value ? [value] : [];
      let text = values.map(v => q.options?.find(o => o.value === v)?.label || v).join(', ') || '선호 없음';
      if (q.hasOtherInput && values.includes(q.otherValue || 'other')) text += ': ' + (answers[q.otherKey || 'other_allergy_text'] || '');
      if (q.hasTextInput && value === 'yes') text += ': ' + (answers[q.textInputKey] || '');
      return text;
    };
    function errorFor(q) {
      const value = answers[q.key];
      if (!q.optional && (!value || (Array.isArray(value) && !value.length))) return q.type === 'multi' ? '하나 이상 선택해주세요.' : '답변을 선택해주세요.';
      if (q.hasOtherInput && (value || []).includes(q.otherValue || 'other') && !(answers[q.otherKey || 'other_allergy_text'] || '').trim()) return '직접 입력할 내용을 적어주세요.';
      if (q.hasTextInput && value === 'yes' && !(answers[q.textInputKey] || '').trim()) return '추천에 참고할 자세한 내용을 적어주세요.';
      return '';
    }
    function render() {
      const list = available();
      index = Math.max(0, Math.min(index, list.length - 1));
      const q = list[index];
      host.replaceChildren();
      host.classList.add('smart-intake');
      host.classList.toggle('is-reviewing', reviewing);
      document.body.classList.add('is-intake-question');
      const shell = create('section', 'intake-shell');
      const top = create('div', 'intake-top');
      top.append(create('span', '', title), create('span', 'intake-counter', reviewing ? '답변 확인' : `${index + 1} / ${list.length}`));
      const progress = create('div', 'intake-progress');
      progress.setAttribute('role', 'progressbar');
      progress.setAttribute('aria-label', '질문 진행');
      progress.setAttribute('aria-valuemin', '0');
      progress.setAttribute('aria-valuemax', String(list.length));
      progress.setAttribute('aria-valuenow', String(reviewing ? list.length : index));
      const fill = create('span'); fill.style.width = `${(reviewing ? 1 : index / list.length) * 100}%`; progress.append(fill);
      shell.append(top, progress);
      const heading = create('h2', 'intake-heading', reviewing ? '이 내용으로 추천받을까요?' : q.title || cleanLabel(q.label));
      heading.tabIndex = -1;
      shell.append(heading, create('p', 'intake-description', reviewing ? '답변을 확인하고, 바꾸고 싶은 항목은 수정해주세요.' : q.description || (q.type === 'multi' ? '원하는 항목을 모두 골라주세요.' : '나에게 맞는 항목을 하나 골라주세요.')));
      const actions = create('div', 'intake-actions');
      const back = create('button', 'intake-back', reviewing ? '이전 질문' : index ? '이전' : '프로필 수정'); back.type = 'button';
      back.onclick = () => { if (reviewing) { reviewing = false; editing = false; index = list.length - 1; } else if (editing) { reviewing = true; editing = false; } else if (index) index--; else { onBack?.(); return; } notify(); render(); };
      const next = create('button', 'intake-primary', reviewing ? submitLabel : editing ? '수정 완료' : index === list.length - 1 ? '답변 확인' : '다음'); next.type = 'button';
      if (reviewing) {
        const rows = create('dl', 'intake-review');
        list.forEach((item, itemIndex) => {
          const row = create('div', 'intake-review-row');
          row.append(create('dt', '', item.shortLabel || cleanLabel(item.label)), create('dd', '', valueLabel(item)));
          const edit = create('button', 'intake-edit', '수정'); edit.type = 'button'; edit.setAttribute('aria-label', `${item.shortLabel || cleanLabel(item.label)} 수정`);
          edit.onclick = () => { index = itemIndex; reviewing = false; editing = true; notify(); render(); }; row.append(edit); rows.append(row);
        });
        shell.append(rows);
        next.onclick = () => {
          const invalidIndex = list.findIndex(item => errorFor(item));
          if (invalidIndex >= 0) { index = invalidIndex; reviewing = false; editing = true; notify(); render(); return; }
          next.disabled = true;
          onComplete();
        };
      } else {
        const hint = create('p', 'intake-hint', q.optional ? '선택 사항 · 선호가 없으면 건너뛰어도 괜찮아요' : q.type === 'multi' ? '여러 개 선택할 수 있어요' : '하나를 선택해주세요');
        shell.append(hint);
        const options = create('div', 'intake-options' + (q.options.length > 7 ? ' intake-options--compact' : ''));
        options.setAttribute('role', 'group'); options.setAttribute('aria-label', heading.textContent);
        q.options.forEach(opt => {
          const selected = q.type === 'multi' ? (answers[q.key] || []).includes(opt.value) : answers[q.key] === opt.value;
          const btn = create('button', 'intake-option' + (selected ? ' is-selected' : ''));
          btn.type = 'button'; btn.dataset.value = opt.value; btn.setAttribute('aria-pressed', String(selected));
          btn.append(create('span', 'intake-option-label', opt.label));
          if (opt.description) btn.append(create('span', 'intake-option-description', opt.description));
          if (opt.disabled) { btn.disabled = true; btn.append(create('span', 'intake-option-description', '로그인 후 선택 가능')); }
          btn.onclick = () => {
            if (q.type === 'multi') {
              let values = answers[q.key] || [];
              if (opt.value === 'none') values = values.includes('none') ? [] : ['none'];
              else { values = values.filter(v => v !== 'none'); values = values.includes(opt.value) ? values.filter(v => v !== opt.value) : [...values, opt.value]; }
              answers[q.key] = values;
            } else {
              answers[q.key] = opt.value;
              if (q.hasTextInput && opt.value !== 'yes') answers[q.textInputKey] = '';
            }
            // Remove answers to questions that no longer apply (e.g. weekly meal time).
            questions.filter(item => item.when && !item.when(answers)).forEach(item => delete answers[item.key]);
            options.querySelectorAll('button').forEach(button => { const active = q.type === 'multi' ? (answers[q.key] || []).includes(button.dataset.value) : answers[q.key] === button.dataset.value; button.classList.toggle('is-selected', active); button.setAttribute('aria-pressed', String(active)); });
            updateDetail(); error.textContent = '';
          };
          options.append(btn);
        });
        shell.append(options);
        const detail = create('div', 'intake-detail');
        const detailKey = q.hasTextInput ? q.textInputKey : q.otherKey || 'other_allergy_text';
        const inputLabel = create('label', '', q.hasTextInput ? '자세한 내용을 알려주세요' : '사용할 재료를 적어주세요');
        const input = create('textarea', 'intake-input'); input.id = 'intake-detail-input'; inputLabel.htmlFor = input.id;
        input.rows = 3; input.placeholder = q.textInputPlaceholder || q.otherPlaceholder || '쉼표로 구분해 입력해주세요'; input.value = answers[detailKey] || '';
        input.oninput = () => { answers[detailKey] = input.value; error.textContent = ''; updateSelection(); };
        detail.append(inputLabel, input); shell.append(detail);
        function updateDetail() { detail.hidden = !(q.hasTextInput && answers[q.key] === 'yes' || q.hasOtherInput && (answers[q.key] || []).includes(q.otherValue || 'other')); }
        updateDetail();
        const error = create('p', 'intake-error'); error.id = 'intake-error'; error.setAttribute('role', 'alert');
        options.setAttribute('aria-describedby', error.id); input.setAttribute('aria-describedby', error.id); shell.append(error);
        const status = create('p', 'intake-selection'); status.setAttribute('role', 'status');
        const updateSelection = () => { status.textContent = answers[q.key]?.length ? `선택한 내용: ${valueLabel(q)}` : '아직 선택한 항목이 없어요'; };
        options.addEventListener('click', updateSelection); updateSelection(); shell.append(status);
        next.onclick = () => {
          const message = errorFor(q);
          if (message) { error.textContent = message; (detail.hidden ? options.querySelector('button:not(:disabled)') : input)?.focus(); return; }
          if (editing || index === available().length - 1) { reviewing = true; editing = false; } else index++;
          notify(); render();
        };
        if (q.optional) {
          const skip = create('button', 'intake-skip', '선호 없이 계속'); skip.type = 'button';
          skip.onclick = () => { answers[q.key] = []; if (q.hasOtherInput) answers[detailKey] = ''; next.click(); }; actions.append(skip);
        }
      }
      actions.append(back, next); shell.append(actions); host.append(shell);
      heading.focus({ preventScroll: true });
    }
    render();
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('dynamicMealForm') && !document.getElementById('supplementQuestionForm')) return;
    document.body.classList.add('smart-intake-page');
    const header = create('header', 'intake-app-header');
    const headerInner = create('div', 'intake-app-header-inner');
    const brand = document.querySelector('.site-brand-fixed');
    const accounts = document.querySelector('.auth-links');
    const navigation = create('nav', 'intake-app-navigation');
    navigation.setAttribute('aria-label', '주요 기능');
    const isMeal = !!document.getElementById('dynamicMealForm');
    [['/meal-plan', '뭐 해먹지?', isMeal], ['/supplements', '나만의 영양제', !isMeal], ['/restaurant-recommendation', '오늘의 맛집', false]].forEach(([href, label, current]) => {
      const link = create('a', '', label); link.href = href;
      if (current) link.setAttribute('aria-current', 'page');
      navigation.append(link);
    });
    const analysis = create('details', 'intake-app-submenu');
    const analysisLabel = create('summary', '', 'AI 성분 분석');
    const analysisLinks = create('div', 'intake-app-submenu-links');
    [['/ingredient-analyzer', '식재료 분석'], ['/food-nutrition-search', '음식 정보 검색']].forEach(([href, label]) => {
      const link = create('a', '', label); link.href = href; analysisLinks.append(link);
    });
    analysis.append(analysisLabel, analysisLinks); navigation.append(analysis);
    const insight = create('a', '', '잇플 인사이트'); insight.href = '/nutrition-info'; navigation.append(insight);
    document.addEventListener('click', event => { if (!analysis.contains(event.target)) analysis.open = false; });
    analysis.addEventListener('keydown', event => { if (event.key === 'Escape') { analysis.open = false; analysisLabel.focus(); } });
    if (brand) headerInner.append(brand);
    headerInner.append(navigation);
    if (accounts) headerInner.append(accounts);
    header.append(headerInner); document.body.prepend(header);
    const profileCopy = [
      ['나에게 맞추기 위한 기본 정보', '나이·키·체중과 생활 패턴을 알려주세요. 추천에 참고할 기본 정보예요.'],
      ['알레르기와 건강 상태', '해당하는 항목만 선택해주세요. 추가 정보가 없다면 다음으로 넘어갈 수 있어요.'],
      ['추가 정보는 아는 만큼만', '검진 수치와 복용 중인 영양제를 알고 있다면 입력해주세요. 모르는 수치는 비워두세요.'],
    ];
    document.querySelectorAll('.profile-section').forEach((section, index) => {
      if (!profileCopy[index]) return;
      const heading = create('h3', 'intake-profile-heading', profileCopy[index][0]);
      section.prepend(heading);
      const guide = section.querySelector('.section-guide');
      if (guide) guide.textContent = profileCopy[index][1];
      section.querySelectorAll('input[type="number"]').forEach(input => { input.inputMode = 'decimal'; });
      if (index === 2) {
        const save = section.querySelector('.save-button');
        if (save) save.textContent = '이 정보로 계속';
      }
    });
    // Existing profile and goal choices keep their handlers, with keyboard and screen-reader support.
    const selector = '.option[role="button"], .meal-type-card, .supplement-type-card';
    function sync() {
      const visibleQuestion = document.querySelector('#meal_form.active .smart-intake, .wizard-step[data-step="3"].active .smart-intake');
      document.body.classList.toggle('is-intake-question', !!visibleQuestion);
      document.querySelectorAll(selector).forEach(node => { node.setAttribute('role', 'button'); node.tabIndex = 0; node.setAttribute('aria-pressed', String(node.classList.contains('selected'))); });
    }
    sync();
    document.addEventListener('input', event => { event.target.closest('.profile-section')?.querySelector('.intake-profile-error')?.remove(); });
    document.addEventListener('click', event => { if (event.target.closest('.option')) event.target.closest('.profile-section')?.querySelector('.intake-profile-error')?.remove(); });
    document.addEventListener('keydown', event => { if (event.target.matches(selector) && ['Enter', ' '].includes(event.key)) { event.preventDefault(); event.target.click(); } });
    new MutationObserver(sync).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
  });
  global.EatpleIntake = { mount, showProfileError };
})(window);
