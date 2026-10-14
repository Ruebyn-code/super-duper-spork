// Preview the real authentication page without submitting sign-in/setup forms.
for(const form of document.querySelectorAll('form'))form.addEventListener('submit',event=>event.preventDefault());
