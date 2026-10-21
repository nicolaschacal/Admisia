(() => {
  const profile = document.getElementById('business-profile');
  if (!profile) return;

  const actions = profile.querySelector('.profile-actions');
  const shareButton = document.getElementById('business-share');
  const mapLink = document.getElementById('business-map-link');
  const bookingHeader = document.getElementById('booking-header');
  const profileBack = document.getElementById('business-profile-back');
  const heroSubtitle = profile.querySelector('.profile-hero > p');

  const icon = (path) => `<span class="profile-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${path}"/></svg></span>`;

  function startBooking() {
    profileBack?.click();
    window.setTimeout(() => bookingHeader?.click(), 220);
  }

  function replaceShareWithLocation() {
    if (!shareButton || !actions) return;
    const location = document.createElement('a');
    location.id = 'business-location-action';
    location.className = 'profile-action';
    location.href = mapLink?.href || 'https://www.google.com/maps/search/?api=1&query=Av.%20Agraciada%202850%20Montevideo';
    location.target = '_blank';
    location.rel = 'noreferrer';
    location.title = 'Ver ubicación';
    location.innerHTML = `${icon('M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z M12 10a2.5 2.5 0 1 0 0 .01')}<span>Ubicación</span>`;
    shareButton.replaceWith(location);
  }

  function addBookingAction() {
    if (!actions || document.getElementById('business-booking-action')) return;
    const booking = document.createElement('button');
    booking.id = 'business-booking-action';
    booking.type = 'button';
    booking.className = 'profile-action profile-action--booking';
    booking.title = 'Agendar una visita';
    booking.innerHTML = `${icon('M7 2v3M17 2v3M3.5 9h17M5 4.5h14A1.5 1.5 0 0 1 20.5 6v13A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V6A1.5 1.5 0 0 1 5 4.5Z')}<span>Agendar</span>`;
    booking.addEventListener('click', startBooking);
    actions.appendChild(booking);
  }

  function addFixedCta() {
    const shell = profile.querySelector('.business-profile-shell');
    if (!shell || shell.querySelector('.profile-cta')) return;
    const cta = document.createElement('div');
    cta.className = 'profile-cta';
    cta.innerHTML = '<button type="button" aria-label="Agendar una visita">Agendar una visita</button>';
    cta.querySelector('button').addEventListener('click', startBooking);
    shell.appendChild(cta);
  }

  function polishHero() {
    if (!heroSubtitle) return;
    const description = document.getElementById('business-description-text')?.textContent?.trim() || '';
    const cleaned = description.replace(/^Colegio Nubarian\s*[·•|-]\s*/i, '').trim();
    heroSubtitle.textContent = `${cleaned || 'Inicial y Primaria'} · Perfil institucional`;
  }

  replaceShareWithLocation();
  addBookingAction();
  addFixedCta();
  polishHero();

  const sync = () => {
    const location = document.getElementById('business-location-action');
    if (location && mapLink) location.href = mapLink.href;
    polishHero();
  };
  const observer = new MutationObserver(sync);
  const description = document.getElementById('business-description-text');
  if (description) observer.observe(description, { childList: true, characterData: true, subtree: true });
  if (mapLink) observer.observe(mapLink, { attributes: true, attributeFilter: ['href'] });
})();
