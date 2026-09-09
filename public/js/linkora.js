(function () {
  'use strict';

  // Character counter for compose
  var textarea = document.getElementById('tweet-text');
  var counter = document.getElementById('char-count');
  var submit = document.getElementById('tweet-submit');

  if (textarea && counter && submit) {
    function update() {
      var len = textarea.value.length;
      var remaining = 140 - len;
      counter.textContent = remaining;
      counter.classList.remove('warn', 'over');
      if (remaining < 0) {
        counter.classList.add('over');
        submit.disabled = true;
      } else if (remaining <= 20) {
        counter.classList.add('warn');
        submit.disabled = len === 0;
      } else {
        submit.disabled = len === 0;
      }
    }
    textarea.addEventListener('input', update);
    update();
  }

  // Focus compose from #compose hash
  if (window.location.hash === '#compose' && textarea) {
    textarea.focus();
  }
})();
