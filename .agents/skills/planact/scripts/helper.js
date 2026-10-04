(function () {
  const root = document.getElementById('app');
  const state = {
    session: null,
    answers: {},
    drafts: {}
  };

  const STRINGS = {
    en: {
      eyebrow: 'PlanAct Visual Companion',
      required: 'Required',
      optional: 'Optional',
      optionalNote: 'Optional note',
      select: 'Select this variant',
      selected: 'Selected',
      submit: 'Submit decision',
      submitted: 'Decision submitted',
      pending: 'Not submitted yet',
      progress: 'Progress',
      complete: 'All required visual decisions are submitted. You can return to the chat.',
      incomplete: 'Submit every required visual decision to complete this step.',
      errorPrefix: 'Error'
    },
    ru: {
      eyebrow: 'PlanAct Visual Companion',
      required: 'Обязательное решение',
      optional: 'Необязательное решение',
      optionalNote: 'Комментарий',
      select: 'Выбрать этот вариант',
      selected: 'Вариант выбран',
      submit: 'Сохранить решение',
      submitted: 'Решение сохранено',
      pending: 'Решение ещё не сохранено',
      progress: 'Прогресс',
      complete: 'Все обязательные визуальные решения сохранены. Можно возвращаться в чат.',
      incomplete: 'Сохраните все обязательные визуальные решения, чтобы завершить этот этап.',
      errorPrefix: 'Ошибка'
    }
  };

  function languageCode() {
    if (!state.session || !state.session.ui_language) return 'en';
    return String(state.session.ui_language).toLowerCase().startsWith('ru') ? 'ru' : 'en';
  }

  function t(key) {
    return STRINGS[languageCode()][key] || STRINGS.en[key] || key;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getDecisionById(decisionId) {
    return state.session.decisions.find((decision) => decision.id === decisionId);
  }

  function ensureDraft(decision) {
    if (!state.drafts[decision.id]) {
      const saved = state.answers[decision.id] || {};
      state.drafts[decision.id] = {
        selected_option_ids: Array.isArray(saved.selected_option_ids) ? saved.selected_option_ids.slice() : [],
        note: typeof saved.note === 'string' ? saved.note : ''
      };
    }
    return state.drafts[decision.id];
  }

  function answerIsMeaningful(answer) {
    const selected = Array.isArray(answer.selected_option_ids) ? answer.selected_option_ids : [];
    return selected.length > 0;
  }

  function isSubmitted(decision) {
    const answer = state.answers[decision.id];
    return Boolean(answer && answerIsMeaningful(answer));
  }

  function completionStatus() {
    const requiredDecisions = state.session.decisions.filter((decision) => decision.required !== false);
    const submittedRequiredCount = requiredDecisions.filter((decision) => isSubmitted(decision)).length;
    return {
      requiredCount: requiredDecisions.length,
      submittedRequiredCount,
      completed: submittedRequiredCount === requiredDecisions.length
    };
  }

  function optionSelected(decisionId, optionId) {
    return ensureDraft(getDecisionById(decisionId)).selected_option_ids.includes(optionId);
  }

  function toggleOption(decisionId, optionId) {
    const decision = getDecisionById(decisionId);
    const draft = ensureDraft(decision);

    if (decision.type === 'multi_choice') {
      if (draft.selected_option_ids.includes(optionId)) {
        draft.selected_option_ids = draft.selected_option_ids.filter((item) => item !== optionId);
      } else {
        draft.selected_option_ids = draft.selected_option_ids.concat(optionId);
      }
    } else {
      draft.selected_option_ids = draft.selected_option_ids[0] === optionId ? [] : [optionId];
    }

    render();
  }

  function updateNote(decisionId, value) {
    ensureDraft(getDecisionById(decisionId)).note = value;
  }

  async function submitDecision(decisionId) {
    const decision = getDecisionById(decisionId);
    const draft = ensureDraft(decision);
    const response = await fetch('/api/submit-decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision_id: decisionId,
        selected_option_ids: draft.selected_option_ids,
        note: draft.note
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      window.alert(t('errorPrefix') + ': ' + (payload.error || 'Unknown error'));
      return;
    }

    state.answers = payload.answers || {};
    render();
  }

  function renderOption(decision, option) {
    const selected = optionSelected(decision.id, option.id);
    const previewUrl = '/content/' + encodeURIComponent(option.preview_file);
    return [
      '<article class="option-card' + (selected ? ' selected' : '') + '">',
      '<div class="mockup-wrap">',
      '<iframe class="mockup-frame" src="' + previewUrl + '" title="' + escapeHtml(option.label) + '" loading="lazy" sandbox></iframe>',
      '</div>',
      '<button type="button" class="option-select" aria-pressed="' + String(selected) + '" onclick="PlanActVC.toggleOption(\'' + escapeHtml(decision.id) + '\', \'' + escapeHtml(option.id) + '\')">',
      '<span class="option-label">' + escapeHtml(option.label) + '</span>',
      option.description ? '<span class="option-description">' + escapeHtml(option.description) + '</span>' : '',
      '<span class="option-action">' + escapeHtml(selected ? t('selected') : t('select')) + '</span>',
      '</button>',
      '</article>'
    ].join('');
  }

  function renderDecision(decision) {
    const draft = ensureDraft(decision);
    const submitted = isSubmitted(decision);
    const canSubmit = draft.selected_option_ids.length > 0;
    const optionsHtml = (decision.options || []).map((option) => renderOption(decision, option)).join('');

    return [
      '<section class="decision">',
      '<div class="decision-head">',
      '<div>',
      '<h2 class="decision-title">' + escapeHtml(decision.title) + '</h2>',
      decision.description ? '<p class="decision-description">' + escapeHtml(decision.description) + '</p>' : '',
      '</div>',
      '<span class="badge' + (decision.required === false ? ' optional' : '') + '">' + (decision.required === false ? t('optional') : t('required')) + '</span>',
      '</div>',
      '<div class="options">' + optionsHtml + '</div>',
      decision.allow_free_text ? [
        '<div class="note-wrap">',
        '<label class="note-label" for="note-' + escapeHtml(decision.id) + '">' + t('optionalNote') + '</label>',
        '<textarea id="note-' + escapeHtml(decision.id) + '" class="note-input" oninput="PlanActVC.updateNote(\'' + escapeHtml(decision.id) + '\', this.value)">' + escapeHtml(draft.note) + '</textarea>',
        '</div>'
      ].join('') : '',
      '<div class="decision-actions">',
      '<span class="answer-state' + (submitted ? ' saved' : '') + '">' + (submitted ? t('submitted') : t('pending')) + '</span>',
      '<button type="button" class="submit-btn"' + (canSubmit ? '' : ' disabled') + ' onclick="PlanActVC.submitDecision(\'' + escapeHtml(decision.id) + '\')">' + t('submit') + '</button>',
      '</div>',
      '</section>'
    ].join('');
  }

  function render() {
    const summary = completionStatus();
    root.innerHTML = [
      '<section class="hero">',
      '<div class="eyebrow">' + escapeHtml(t('eyebrow')) + '</div>',
      '<h1>' + escapeHtml(state.session.session_title || 'Visual Companion') + '</h1>',
      state.session.session_intro ? '<p class="intro">' + escapeHtml(state.session.session_intro) + '</p>' : '',
      '<div class="status-bar">',
      '<span class="pill">' + escapeHtml(t('progress')) + ': ' + summary.submittedRequiredCount + '/' + summary.requiredCount + '</span>',
      summary.completed ? '<span class="pill complete">' + escapeHtml(t('complete')) + '</span>' : '',
      '</div>',
      '</section>',
      '<div class="grid">',
      state.session.decisions.map(renderDecision).join(''),
      '</div>',
      '<div class="footer-banner' + (summary.completed ? ' complete' : '') + '">' + escapeHtml(summary.completed ? t('complete') : t('incomplete')) + '</div>'
    ].join('');
  }

  async function bootstrap() {
    const sessionResponse = await fetch('/api/session');
    state.session = await sessionResponse.json();
    const answersResponse = await fetch('/api/answers');
    state.answers = await answersResponse.json();
    render();
  }

  window.PlanActVC = {
    toggleOption,
    updateNote,
    submitDecision
  };

  bootstrap().catch((error) => {
    root.innerHTML = '<div class="footer-banner">' + escapeHtml(String(error)) + '</div>';
  });
})();
