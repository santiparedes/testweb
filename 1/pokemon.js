let allPokemon = []; // Guaranteed to store the full array

document.addEventListener('DOMContentLoaded', () => {
  fetchPokemonList();
});

async function fetchPokemonList() {
  const loading = document.getElementById('loading');
  const grid = document.getElementById('pokemon-grid');
  
  try {
    // Fetch limits to first 151 gen 1 pokemon for performance, this can be increased.
    const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=151');
    const data = await response.json();
    
    // Fetch details for all in parallel
    const promises = data.results.map(pokemon => fetch(pokemon.url).then(res => res.json()));
    const results = await Promise.all(promises);
    
    allPokemon = results.map(data => {
      return {
        id: data.id,
        name: data.name,
        image: data.sprites.other?.['official-artwork']?.front_default || data.sprites.front_default,
        types: data.types.map(t => t.type.name),
        experience: data.base_experience
      };
    });

    loading.style.display = 'none';
    grid.style.display = 'grid';
    
    renderPokemon(allPokemon);
    
  } catch (error) {
    console.error('Error fetching Pokémon:', error);
    loading.innerHTML = '<p>Hubo un error al cargar los Pokémon. Intenta nuevamente.</p>';
  }
}

function renderPokemon(pokemonList) {
  const grid = document.getElementById('pokemon-grid');
  grid.innerHTML = '';
  
  if (pokemonList.length === 0) {
    grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #64748b;">No se encontraron Pokémon con esos filtros.</p>';
    return;
  }

  pokemonList.forEach(pokemon => {
    const card = document.createElement('div');
    card.className = 'pokemon-card';
    
    const typesHTML = pokemon.types.map(t => `<span class="type-badge ${t}">${t}</span>`).join('');
    
    card.innerHTML = `
      <div class="pokemon-id">#${pokemon.id.toString().padStart(3, '0')}</div>
      <img src="${pokemon.image}" alt="${pokemon.name}">
      <h2>${pokemon.name}</h2>
      <div class="types">
        ${typesHTML}
      </div>
    `;
    
    grid.appendChild(card);
  });
}

function filterPokemon() {
  const searchInput = document.getElementById('searchInput').value.toLowerCase();
  const typeSelect = document.getElementById('typeSelect').value;
  
  const filtered = allPokemon.filter(pokemon => {
    // Check search (by name or by id string)
    const matchesSearch = pokemon.name.toLowerCase().includes(searchInput) || pokemon.id.toString().includes(searchInput);
    
    // Check type
    const matchesType = typeSelect === 'all' || pokemon.types.includes(typeSelect);
    
    return matchesSearch && matchesType;
  });
  
  renderPokemon(filtered);
}
