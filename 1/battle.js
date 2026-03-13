// === Variables Globales ===
// Arreglo global para guardar todos los Pokémon que obtenemos de la API y mostrarlos en los selectores.
let pokemonList = [];
// Objeto que guardará el estado actual de la batalla (turno, atributos y vida actual).
let battleState = null;
// Variable para controlar el ciclo de tiempo que se repetirá paso a paso ('setInterval') durante la pelea.
let battleInterval = null;

// === Referencias al DOM (HTML) ===
// Capturamos los elementos visuales de la interfaz para poder cambiarlos dinámicamente:
const select1 = document.getElementById('pokemon1Select');
const select2 = document.getElementById('pokemon2Select');
const startBtn = document.getElementById('start-battle-btn');
const selectionPhase = document.getElementById('selection-phase');
const battleArena = document.getElementById('battle-arena');
const logContainer = document.getElementById('battle-log');
const winnerModal = document.getElementById('winner-modal');

// === Inicialización de la Página ===
// Cuando el documento HTML se cargue por completo, ejecutamos esta función de preparación.
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Obtenemos los 151 Pokémon de la PokeAPI tal como lo hacíamos en la Pokédex
        const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=151');
        const data = await res.json();
        pokemonList = data.results; // Guarda la lista simplificada.

        // Llamamos a la función que pinta las opciones en las listas desplegables.
        populateSelects();
    } catch (e) {
        logContainer.innerHTML = '<p class="log-system">Error al cargar la Pokédex.</p>';
    }
});

// Función para inyectar todas las opciones (<option>) dentro de los elementos <select>
function populateSelects() {
    let optionsHTML = '<option value="">-- Selecciona un Pokémon --</option>';
    
    // Recorremos la lista para capitalizar el primer nombre de cada Pokémon y crear su <option>
    pokemonList.forEach((p, index) => {
        const id = index + 1; // La API asocia los id's en su orden natural (1 a 151)
        const nameCaps = p.name.charAt(0).toUpperCase() + p.name.slice(1);
        optionsHTML += `<option value="${id}">${id} - ${nameCaps}</option>`;
    });

    // Anexamos este listado a nuestras dos zonas "select" del documento.
    select1.innerHTML = optionsHTML;
    select2.innerHTML = optionsHTML;
    
    // Agregamos eventos para que cuando el usuario seleccione, revisemos si ya es posible iniciar el juego.
    select1.addEventListener('change', checkReady);
    select2.addEventListener('change', checkReady);
    startBtn.addEventListener('click', startBattle);
}

// Función que revisa que los dos Pokémon hayan sido elegidos correctamente
function checkReady() {
    // Si ambos tienen un valor, el botón se activa
    if (select1.value && select2.value) {
        startBtn.disabled = false;
    } else {
        startBtn.disabled = true;
    }
    
    // Evitamos (para más simpleza en los registros) que el usuario elija exactamente el mismo Pokémon
    if (select1.value && select2.value && select1.value === select2.value) {
        alert("¡Por favor elige dos Pokémon diferentes para la batalla!");
        select2.value = ""; // Reseteamos la opción 2 e inhabilitamos el botón.
        startBtn.disabled = true;
    }
}

// === Motor Principal de Batalla ===
// Se manda llamar cuando le damos clic al botón 'Comenzar Batalla'
async function startBattle() {
    startBtn.disabled = true;
    startBtn.textContent = 'Cargando datos...';

    try {
        // Pedimos paralelamente a la API toda la información de los **dos** Pokémon enfrentándose.
        const [p1Response, p2Response] = await Promise.all([
            fetch(`https://pokeapi.co/api/v2/pokemon/${select1.value}`),
            fetch(`https://pokeapi.co/api/v2/pokemon/${select2.value}`)
        ]);

        const p1Data = await p1Response.json();
        const p2Data = await p2Response.json();

        // 1. Configuramos el Estado Base del combate
        battleState = {
            turn: 1, // El paso inicial
            activeAttacker: 1, // Indica de quién es el turno. (1 o 2)
            p1: setupCombatant(p1Data, 1), // Limpiamos a p1 guardando unicamente sus atributos
            p2: setupCombatant(p2Data, 2)  // Limpiamos a p2 guardando unicamente sus atributos
        };

        // 2. Transición Visual de la Página: ocultamos los selectores y mostramos la Arena
        selectionPhase.style.display = 'none';
        battleArena.style.display = 'flex';
        battleArena.style.flexDirection = 'column';
        
        // Ejecutamos updateUI para actualizar y mostrar todos los textos correctos una vez inicia el juego
        updateUI();

        // Mandamos a imprimir nuestro primer registro a la bitácora
        addLog(`¡La batalla entre ${battleState.p1.name} y ${battleState.p2.name} va a comenzar!`, 'system');
        
        // 3. Comenzamos el cronómetro ('setInterval'): cada turno de combate durará 2.5 segundos (paso por paso)
        setTimeout(() => {
            battleInterval = setInterval(executeTurn, 2500); 
        }, 1500); // Ponemos un retraso inicial de 1.5s visual

    } catch (e) {
        alert("Hubo un error cargando a los Pokémon desde la API.");
        startBtn.disabled = false;
        startBtn.textContent = 'Comenzar Batalla';
    }
}

// Función encargada de normalizar la base de datos de cada contrincante
function setupCombatant(data, playerNum) {
    // Almacenamos temporalmente las estadísticas
    const stats = {};
    data.stats.forEach(s => {
        stats[s.stat.name] = s.base_stat;
    });

    return {
        num: playerNum,
        name: data.name.toUpperCase(),
        image: data.sprites.other?.['official-artwork']?.front_default || data.sprites.front_default,
        
        hp: 100, // Vida en la interfaz visual: Se mantendrá normalizada como 100% como lo solicitó
        
        // Los stats verdaderos que usarán la matemática de los ataques
        baseHp: stats.hp || 50,
        baseAtk: stats.attack || 50,
        baseDef: stats.defense || 50,
        baseSpAtk: stats['special-attack'] || 50,
        baseSpDef: stats['special-defense'] || 50,
        
        // 'Cooldowns' o Enfriamientos: turnos restantes para usar sus acciones especiales.
        // Al llegar a 0, significa que están disponibles ("Listos"). Inician en los máximos solicitados.
        cooldowns: {
            spAtk: 3, // Ataque Especial: se requieren por lo menos 3 turnos
            spDef: 2, // Defensa Especial: se requieren por lo menos 2 turnos
        },
        hasSpecialDefenseActive: false // Etiqueta (Bandera) temporal para atenuar daño del rival en el siguiente movimiento
    };
}

// Lógica Principal (Ejecutada repetidamente por cada turno paso por paso)
function executeTurn() {
    // Tomamos toda la referencia del turno actual. ('destructuración' del objeto)
    const { p1, p2, activeAttacker, turn } = battleState;
    // Definimos los roles de ambos combatientes esta ronda
    const attacker = activeAttacker === 1 ? p1 : p2;
    const defender = activeAttacker === 1 ? p2 : p1;

    // Marcamos sistemáticamente qué turno estamos observando en el "log" (Bitácora textual de combate).
    addLog(`--- Turno ${turn} ---`, 'system');

    // === Enfriamientos de tiempo ===
    // Reducimos las recargas en 1 (cada que avanza el turno del atacante actual) para hacerlo eventualmente usable.
    if (attacker.cooldowns.spAtk > 0) attacker.cooldowns.spAtk--;
    if (attacker.cooldowns.spDef > 0) attacker.cooldowns.spDef--;
    // Si tenía una protección activa de su turno anterior (escudo), ya espira ahora que le vuelve a tocar
    attacker.hasSpecialDefenseActive = false; 

    // === Decision Inteligente Asíncrona (AI Básica) ===
    // Escogemos su accionar y tomamos en cuenta sus habilidades si están Listas ("0").
    let action = decideAction(attacker);

    // === Ejecución del Daño o Defensa y su Aleatoriedad (Cálculos matemáticos) ===
    let damage = 0;
    const missChance = Math.random(); 
    let missed = false;

    // Determinamos si su jugada FALLÓ aleatoriamente basándonos en un pequeño porcentaje ("missChance").
    // - Ataques especiales fallan 15% de las veces. Los ataques normales 10% y las Defesas el 10%.
    if (action === 'special_attack' && missChance < 0.15) missed = true;
    if (action === 'normal_attack' && missChance < 0.10) missed = true;
    if (action === 'special_defense' && missChance < 0.10) missed = true; 

    // Reacción si la jugada falla temporalmente:
    if (missed) {
        if (action === 'special_defense') {
            addLog(`¡El turno es de ${attacker.name}! Intentó usar Defensa Especial pero ¡FALLÓ!`, 'miss');
            attacker.cooldowns.spDef = 2; // Fracasó, entonces volvemos a poner su contador en espera 2 turnos (solicitados)
        } else {
            addLog(`¡El turno es de ${attacker.name}! Usó un ataque pero ¡FALLÓ!`, 'miss');
            if (action === 'special_attack') attacker.cooldowns.spAtk = 3; // Fracasó su ataque especial, de vuelta 3 turnos a esperar.
        }
    } 
    else { 
        // ¡Jugada éxitosa, no falló! Procedemos según la jugada.
        if (action === 'special_defense') {
            addLog(`¡El turno es de ${attacker.name}! Decidió usar DEFENSA ESPECIAL. Bloqueará eficazmente el daño actual del rival.`, 'action');
            attacker.hasSpecialDefenseActive = true; 
            attacker.cooldowns.spDef = 2; // Reestablece la espera de 2 turnos tras usar la acción exitosamente.
        } 
        else if (action === 'special_attack') {
            // Mandamos a llamar una fórmula abstracta que toma la estadística atacante-defensor ("SpAtk" contra "SpDef") 
            damage = calculateDamage(attacker.baseSpAtk, defender.baseSpDef, 'special', defender.hasSpecialDefenseActive);
            addLog(`¡El turno es de ${attacker.name}! Utilizó ATAQUE ESPECIAL causando ${damage}% de daño al oponente.`, 'action_special');
            attacker.cooldowns.spAtk = 3; // Reestablece 3 turnos tras utilizar el especial.
        } 
        else if (action === 'normal_attack') {
            // Un ataque ordinario toma estatus físico (Fuerza normal contra Defensa).
            damage = calculateDamage(attacker.baseAtk, defender.baseDef, 'normal', defender.hasSpecialDefenseActive);
            addLog(`¡El turno es de ${attacker.name}! Utilizó Ataque Normal causando ${damage}% de daño.`, 'action');
        }

        // Si causó daño al oponente...
        if (damage > 0) {
            defender.hp -= damage; // Desminuimos porcentaje directo de los 100% HP máximos pedidos por requerimiento.
            if (defender.hp < 0) defender.hp = 0; // Topamos en 0 el fondo (Sin estatus de vida negativos)
            
            // Reflejamos al usuario en la bitácora
            addLog(`A ${defender.name} le queda ${defender.hp}% de vida de su 100%.`, 'status');
        }
    }

    // Tras el paso lógico actual, enviamos a actualizar a la interfaz gráfica del usuario (Barras de Vida).
    updateUI();

    // === CONDICIÓN DE VICTORIA ("Win Condition") ===
    // Si la salud del defensor llega a 0 rompe las reglas. Declaramos el ganador.
    if (defender.hp <= 0) {
        clearInterval(battleInterval); // Detenemos el cronómetro "paso a paso" permanentemente.
        addLog(`La salud de ${defender.name} llegó a 0%. ¡${attacker.name} ha ganado!`, 'winner');
        showWinner(attacker); // Ejecutamos la gráfica final del ganador con su estatus y foto.
        return; // Detiene la programación de abajo.
    }

    // Intercambiamos los turnos asincrónos para repetirlo con el contrincante.
    battleState.activeAttacker = battleState.activeAttacker === 1 ? 2 : 1;
    battleState.turn++; // Vamos sumándole un round a todo el juego global.
}

// Función que emula la "inteligengia competitiva" (IA del pokemon), 
// elige entre atacar, defensa especial u ataque especial si es posible:
function decideAction(combatant) {
    // Revisa si las demoras volvieron a cero para saber si las habilita o no.
    const canSpAtk = combatant.cooldowns.spAtk <= 0;
    const canSpDef = combatant.cooldowns.spDef <= 0;

    // Si tiene el ataque magico (especial) listo, se usará sí o sí un 70% de las veces en este turno.
    if (canSpAtk && Math.random() < 0.7) {
        return 'special_attack';
    }
    
    // Si la proteccion al desgaste está lista, se inclinará un 40% a evadir ataques
    if (canSpDef && Math.random() < 0.4) {
        return 'special_defense';
    }

    // La mayoria del tiempo el ataque basico no tiene limites, se elige al final por defecto.
    return 'normal_attack';
}

// Función matemática básica de daño basada en PokeAPI (reduciéndolas a porcentaje "RNG Base 100%")
function calculateDamage(atk, def, type, defenderHasSpDef) {
    // Daño calculado normal: el especial saca entre 20%-35% del HP; y normal saca unos 10%-20%.
    let base = type === 'special' ? (Math.random() * 15 + 20) : (Math.random() * 10 + 10);
    
    // Escalamiento si hay mucha diferencia base de estatus en PokeAPI (Para no matar de un solo golpe si alguien es muy débil)
    let multiplier = atk / def;
    if (multiplier > 1.5) multiplier = 1.5;
    if (multiplier < 0.5) multiplier = 0.5;

    let total = Math.floor(base * multiplier); // Redondeo sin decimales

    // En caso que la banderapositiva "hasSpecialDefense" esté en este pokemon defensor (usó escudo un paso anterior)...
    if (defenderHasSpDef) {
        // ... Bloqueará exitosamente hasta un 70% del daño final entrante.
        total = Math.floor(total * 0.3);
    }

    // Aseguramos que los ataques exitosos siempre cobren por lo menos 1HP (No se estancan haciendo 0 daños tras escudos)
    if (total < 1) total = 1;
    return total;
}

// Actualiza en tiempo real las estadísticas (Texto, Barras de Vida, Cooldowns) reflejados en la pantalla
function updateUI() {
    const { p1, p2 } = battleState;

    // Colocar fotos y nombres tan pronto empiece el turno 1
    if (battleState.turn === 1) {
        document.getElementById('name-1').textContent = p1.name;
        document.getElementById('img-1').src = p1.image;
        document.getElementById('name-2').textContent = p2.name;
        document.getElementById('img-2').src = p2.image;
    }

    // Reflejar la barra del primer jugador P1
    document.getElementById('hp-bar-1').style.width = p1.hp + '%';
    document.getElementById('hp-text-1').textContent = p1.hp + '%';
    const hpBar1 = document.getElementById('hp-bar-1');
    hpBar1.style.backgroundColor = p1.hp > 50 ? '#22c55e' : (p1.hp > 20 ? '#eab308' : '#ef4444'); // Verde, Amarillo y Rojo

    // Reflejar la barra del jugador P2 
    document.getElementById('hp-bar-2').style.width = p2.hp + '%';
    document.getElementById('hp-text-2').textContent = p2.hp + '%';
    const hpBar2 = document.getElementById('hp-bar-2');
    hpBar2.style.backgroundColor = p2.hp > 50 ? '#22c55e' : (p2.hp > 20 ? '#eab308' : '#ef4444');

    // Cambiar las clases visuales de los identificadores de demora o "Cooldown" (Azul "Listo" vs Gris con número de "Turnos faltantes")
    // Jugador 1:
    document.getElementById('cd-sa-1').textContent = `Atk. Especial: ${p1.cooldowns.spAtk > 0 ? p1.cooldowns.spAtk + 't' : 'Listo'}`;
    document.getElementById('cd-sa-1').className = `cooldown-badge ${p1.cooldowns.spAtk > 0 ? 'inactive' : 'active'}`;
    
    document.getElementById('cd-sd-1').textContent = `Def. Especial: ${p1.cooldowns.spDef > 0 ? p1.cooldowns.spDef + 't' : 'Listo'}`;
    document.getElementById('cd-sd-1').className = `cooldown-badge ${p1.cooldowns.spDef > 0 ? 'inactive' : 'active'}`;

    // Jugador 2:
    document.getElementById('cd-sa-2').textContent = `Atk. Especial: ${p2.cooldowns.spAtk > 0 ? p2.cooldowns.spAtk + 't' : 'Listo'}`;
    document.getElementById('cd-sa-2').className = `cooldown-badge ${p2.cooldowns.spAtk > 0 ? 'inactive' : 'active'}`;
    
    document.getElementById('cd-sd-2').textContent = `Def. Especial: ${p2.cooldowns.spDef > 0 ? p2.cooldowns.spDef + 't' : 'Listo'}`;
    document.getElementById('cd-sd-2').className = `cooldown-badge ${p2.cooldowns.spDef > 0 ? 'inactive' : 'active'}`;
}

// Inyección e impresión de texto visualizado hacia la base de datos " Bitácora" local
function addLog(message, type) {
    const p = document.createElement('p');
    p.className = `log-entry log-${type}`; // Añadiendo css según contexto ('Systema', 'Estado', o 'Especial')
    p.textContent = message;
    logContainer.appendChild(p);

    // Obliga a "arrastrar hacia abajo" para que uno observe siempre los movimientos visualmente recientes de la acción.
    logContainer.scrollTop = logContainer.scrollHeight;
}

// Interfaz Final a desplegar en "Modal" cuando llega a terminar el tiempo con un Ganador claro.
function showWinner(winner) {
    setTimeout(() => {
        // Hace rebotar a estatus "flex" el panel inicialmente invisible
        winnerModal.style.display = 'flex';
        // Inyecta dinámicamente el trofeo de la persona
        document.getElementById('winner-img').src = winner.image;
        document.getElementById('winner-name').textContent = winner.name;
    }, 1000); // 1 segundo extra para disfrutar de ver la barra del último daño antes de aparecer el pop.
}
