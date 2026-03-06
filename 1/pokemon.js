// Arreglo global para guardar todos los Pokémon que obtenemos de la API.
// Esto nos sirve para poder filtrar sobre ellos después sin hacer más peticiones a la API.
let allPokemon = []; 

// Cuando el documento HTML ("DOM") termine de cargar completamente, ejecutamos esta función.
document.addEventListener('DOMContentLoaded', () => {
  fetchPokemonList(); // Llamamos a la función principal que inicia todo el proceso
});

// Función asíncrona para descargar los Pokémon de la API. (async permite usar 'await')
async function fetchPokemonList() {
  // Referencias a elementos del HTML que vamos a manipular
  const loading = document.getElementById('loading');
  const grid = document.getElementById('pokemon-grid');
  
  try {
    // 1. Obtenemos la lista general con el nombre y URL.
    // Usamos límite de 151 (primera generación) para no tardar mucho cargando la página.
    const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=151');
    const data = await response.json(); // Convertimos la respuesta a objeto de JS
    
    // 2. data.results tiene un array de las URL de los 151 pokemons.
    // Mapeamos para crear un array de promesas (peticiones en paralelo) para obtener los detalles de cada uno.
    const promises = data.results.map(pokemon => fetch(pokemon.url).then(res => res.json()));
    
    // 3. Promise.all() espera a que TODAS las peticiones terminen. 'results' tendrá 151 objetos con todos los datos.
    const results = await Promise.all(promises);
    
    // 4. Limpiamos y guardamos únicamente la información que necesitamos para la tarjeta en nuestro arreglo global
    allPokemon = results.map(data => {
      return {
        id: data.id, 
        name: data.name, // El nombre base del pokemon
        // Usamos la imagen de arte oficial porque tiene más calidad. Si no existe, usamos el sprite por defecto.
        image: data.sprites.other?.['official-artwork']?.front_default || data.sprites.front_default,
        // Extraemos solo el string del 'nombre' del tipo (ej: 'fire', 'water')
        types: data.types.map(t => t.type.name),
        experience: data.base_experience
      };
    });

    // Ocultamos el mensaje de "Cargando..."
    loading.style.display = 'none';
    // Mostramos nuestra estructura "grid" (que por defecto en HTML estaba en 'none')
    grid.style.display = 'grid';
    
    // Llamamos a la función render para mostrar visualmente todos los pokemon en pantalla
    renderPokemon(allPokemon);
    
  } catch (error) {
    // Si algo falla con la red o con PokeAPI
    console.error('Error fetching Pokémon:', error);
    loading.innerHTML = '<p>Hubo un error al cargar los Pokémon. Intenta nuevamente.</p>';
  }
}

// Función que toma un arreglo de pokemones e inyecta las tarjetas (HTML) dentro del DOM.
function renderPokemon(pokemonList) {
  const grid = document.getElementById('pokemon-grid');
  grid.innerHTML = ''; // Primero limpiamos todo para que no se dupliquen resultados falsos
  
  // Si filtramos algo que no existe, enviamos un mensaje
  if (pokemonList.length === 0) {
    grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #64748b;">No se encontraron Pokémon con esos filtros.</p>';
    return;
  }

  // Recorremos la lista de pokemon e inyectamos su HTML
  pokemonList.forEach(pokemon => {
    // Creamos el div de capa principal de la tarjeta
    const card = document.createElement('div');
    card.className = 'pokemon-card';
    
    // Convertimos los tipos a HTML. Cada tipo recibe una clase CSS igual a su nombre para colorearlo
    const typesHTML = pokemon.types.map(t => `<span class="type-badge ${t}">${t}</span>`).join('');
    
    // Interpolamos variables para pintar las tarjetas con id, imagen, nombre y los badges de los tipos.
    // El id lo rellenamos a la izquierda con ceros de ser necesario (.padStart(3, '0')) para que se vea como #001
    card.innerHTML = `
      <div class="pokemon-id">#${pokemon.id.toString().padStart(3, '0')}</div>
      <img src="${pokemon.image}" alt="${pokemon.name}">
      <h2>${pokemon.name}</h2>
      <div class="types">
        ${typesHTML}
      </div>
    `;
    
    // Anexamos el hijo (la tarjeta creada) a la cuadrícula.
    grid.appendChild(card);
  });
}

// Función que lee los valores de entrada de los filtros y genera una lista filtrada.
// Está conectada desde el HTML con 'oninput' y 'onchange'
function filterPokemon() {
  // Tomamos los valores elegidos (en pasamos buscador a .toLowerCase() porque los nombres pokemon tienen minúsculas)
  const searchInput = document.getElementById('searchInput').value.toLowerCase();
  const typeSelect = document.getElementById('typeSelect').value;
  
  // Usamos el método de array '.filter()' que regresa aquellos elementos que cumplan las condiciones.
  const filtered = allPokemon.filter(pokemon => {
    
    // 1. Condición del buscador: ¿El texto de búsqueda está en el ID *O* en el nombre del pokemon? 
    const matchesSearch = pokemon.name.toLowerCase().includes(searchInput) || pokemon.id.toString().includes(searchInput);
    
    // 2. Condición del tipo: ¿El dropdown es "todos" *O* el tipo exacto escogido se encuentra dentro de sus tipos?
    const matchesType = typeSelect === 'all' || pokemon.types.includes(typeSelect);
    
    // Retornamos true (para que pasen el filtro) solo si ambas condiciones de filtros aplicadas sirven
    return matchesSearch && matchesType;
  });
  
  // Re-dibujamos pasándole únicamente aquellos que pasaron los filtros.
  renderPokemon(filtered);
}
