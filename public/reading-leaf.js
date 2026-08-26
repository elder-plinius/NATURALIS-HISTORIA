(() => {
  const trigger = document.querySelector('.leaf-plate-trigger');
  const dialog = document.querySelector('.leaf-lightbox');
  if (!(trigger instanceof HTMLAnchorElement) || !(dialog instanceof HTMLDialogElement)) return;

  trigger.addEventListener('click', (event) => {
    if (typeof dialog.showModal !== 'function') return;
    event.preventDefault();
    dialog.showModal();
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.addEventListener('close', () => trigger.focus());
})();
