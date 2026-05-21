/* ===========================================================================
   Vertex Roster — shared roster picker chip grid
   Renders the 12-athlete picker used by every multi-athlete test page.
   Usage:
     VertexRoster.mount({
       container: document.getElementById('rosterGrid'),
       athletes:  BoxerData.athletes,
       selected:  new Set(),
       onChange:  (selectedSet) => { ... },
     });
   Returns: { selectAll(), clear(), getSelected() }
   =========================================================================== */
(() => {
  'use strict';
  if (window.VertexRoster) return;

  function mount({ container, athletes, selected = new Set(), onChange = () => {} }) {
    container.innerHTML = '';
    athletes.forEach(a => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'roster-chip';
      chip.dataset.id = a.id;
      chip.style.setProperty('--accent', a.accent || '#9bd2ff');
      const init = a.initials || a.name.split(' ').map(s => s[0]).join('').slice(0, 2);
      chip.innerHTML = `
        <span class="rc-mono" aria-hidden="true">${init}</span>
        <span class="rc-name">${a.name}</span>
        <span class="rc-meta">${a.ageGroup || a.level}</span>
      `;
      if (selected.has(a.id)) chip.classList.add('on');
      chip.addEventListener('click', () => {
        if (selected.has(a.id)) { selected.delete(a.id); chip.classList.remove('on'); }
        else { selected.add(a.id); chip.classList.add('on'); }
        onChange(selected);
      });
      container.appendChild(chip);
    });

    function selectAll() {
      container.querySelectorAll('.roster-chip').forEach(c => {
        c.classList.add('on'); selected.add(c.dataset.id);
      });
      onChange(selected);
    }
    function clear() {
      container.querySelectorAll('.roster-chip').forEach(c => c.classList.remove('on'));
      selected.clear();
      onChange(selected);
    }
    function getSelected() { return selected; }

    return { selectAll, clear, getSelected };
  }

  window.VertexRoster = { mount };
})();
