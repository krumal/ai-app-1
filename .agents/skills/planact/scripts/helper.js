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
      submit: 'Submit answer',
      submitted: 'Submitted',
      pending: 'Not submitted yet',
      progress: 'Progress',
      complete: 'All required questions answered. You can return to the chat.',
      incomplete: 'Answer all required questions to complete this visual step.',
      errorPrefix: 'Error'
    },
    ru: {
      eyebrow: 'PlanAct Visual Companion',
      required: 'Обязательный',
      optional: 'Необязательный',
      optionalNote: 'Комментарий',
      submit: 'Сохранить ответ',
      submitted: 'Ответ сохранён',
      pending: 'Ответ ещё не сохранён',
      progress: 'Прогресс',
      complete: 'На все обязательные вопросы ответили. Можно возвращаться в чат.',
      incomplete: 'Ответьте на все обязательные вопросы, чтобы завершить визуальный этап.',
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

  function getQuestionById(questionId) {
    return state.session.questions.find((question) => question.id === questionId);
  }

  function ensureDraft(question) {
    if (!state.drafts[question.id]) {
      const saved = state.answers[question.id] || {};
      state.drafts[question.id] = {
        selected_option_ids: Array.isArray(saved.selected_option_ids) ? saved.selected_option_ids.slice() : [],
        note: typeof saved.note === 'string' ? saved.note : ''
      };
    }
    return state.drafts[question.id];
  }

  function answerIsMeaningful(question, answer) {
    const selected = Array.isArray(answer.selected_option_ids) ? answer.selected_option_ids : [];
    const note = String(answer.note || '').trim();
    if (question.type === 'text_only') {
      return note.length > 0;
    }
    if (selected.length > 0) {
      return true;
    }
    return note.length > 0;
  }

  function isSubmitted(question) {
    const answer = state.answers[question.id];
    return Boolean(answer && answerIsMeaningful(question, answer));
  }

  function completionStatus() {
    const requiredQuestions = state.session.questions.filter((question) => question.required !== false);
    const submittedRequiredCount = requiredQuestions.filter((question) => isSubmitted(question)).length;
    return {
      requiredCount: requiredQuestions.length,
      submittedRequiredCount,
      completed: submittedRequiredCount === requiredQuestions.length
    };
  }

  function optionSelected(questionId, optionId) {
    const draft = ensureDraft(getQuestionById(questionId));
    return draft.selected_option_ids.includes(optionId);
  }

  function toggleOption(questionId, optionId) {
    const question = getQuestionById(questionId);
    const draft = ensureDraft(question);

    if (question.type === 'multi_choice') {
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

  function updateNote(questionId, value) {
    const draft = ensureDraft(getQuestionById(questionId));
    draft.note = value;
  }

  async function submitQuestion(questionId) {
    const question = getQuestionById(questionId);
    const draft = ensureDraft(question);

    const response = await fetch('/api/submit-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question_id: questionId,
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

  function renderQuestion(question) {
    const draft = ensureDraft(question);
    const submitted = isSubmitted(question);

    const optionsHtml = (question.options || []).map((option) => {
      const selected = optionSelected(question.id, option.id);
      return [
        '<button type="button" class="option' + (selected ? ' selected' : '') + '" onclick="PlanActVC.toggleOption(\'' + escapeHtml(question.id) + '\', \'' + escapeHtml(option.id) + '\')">',
        '<div class="option-label">' + escapeHtml(option.label) + '</div>',
        option.description ? '<p class="option-description">' + escapeHtml(option.description) + '</p>' : '',
        '</button>'
      ].join('');
    }).join('');

    return [
      '<section class="question">',
      '<div class="question-head">',
      '<div>',
      '<h2 class="question-title">' + escapeHtml(question.title) + '</h2>',
      question.description ? '<p class="question-description">' + escapeHtml(question.description) + '</p>' : '',
      '</div>',
      '<span class="badge' + (question.required === false ? ' optional' : '') + '">' + (question.required === false ? t('optional') : t('required')) + '</span>',
      '</div>',
      optionsHtml ? '<div class="options">' + optionsHtml + '</div>' : '',
      question.allow_free_text ? [
        '<div class="note-wrap">',
        '<label class="note-label" for="note-' + escapeHtml(question.id) + '">' + t('optionalNote') + '</label>',
        '<textarea id="note-' + escapeHtml(question.id) + '" class="note-input" oninput="PlanActVC.updateNote(\'' + escapeHtml(question.id) + '\', this.value)">' + escapeHtml(draft.note) + '</textarea>',
        '</div>'
      ].join('') : '',
      '<div class="question-actions">',
      '<span class="answer-state' + (submitted ? ' saved' : '') + '">' + (submitted ? t('submitted') : t('pending')) + '</span>',
      '<button type="button" class="submit-btn" onclick="PlanActVC.submitQuestion(\'' + escapeHtml(question.id) + '\')">' + t('submit') + '</button>',
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
      state.session.questions.map(renderQuestion).join(''),
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
    submitQuestion
  };

  bootstrap().catch((error) => {
    root.innerHTML = '<div class="footer-banner">' + escapeHtml(String(error)) + '</div>';
  });
})();
