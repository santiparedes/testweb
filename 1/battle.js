// === Globals ===
let pokemonList = [];
let battleState = null;
let battleInterval = null;

// DOM Elements
const select1 = document.getElementById('pokemon1Select');
const select2 = document.getElementById('pokemon2Select');
const startBtn = document.getElementById('start-battle-btn');
const selectionPhase = document.getElementById('selection-phase');
const battleArena = document.getElementById('battle-arena');
const logContainer = document.getElementById('battle-log');
const winnerModal = document.getElementById('winner-modal');

// === Initialization ===
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Fetch original 151 limit
        const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=151');
        const data = await res.json();
        pokemonList = data.results;

        populateSelects();
    } catch (e) {
        logContainer.innerHTML = '<p class="log-system">Error al cargar la Pokédex.</p>';
    }
});

function populateSelects() {
    let optionsHTML = '<option value="">-- Selecciona --</option>';
    pokemonList.forEach((p, index) => {
        const id = index + 1;
        const nameCaps = p.name.charAt(0).toUpperCase() + p.name.slice(1);
        optionsHTML += `<option value="${id}">${id} - ${nameCaps}</option>`;
    });

    select1.innerHTML = optionsHTML;
    select2.innerHTML = optionsHTML;
    
    // Listen for changes
    select1.addEventListener('change', checkReady);
    select2.addEventListener('change', checkReady);
    startBtn.addEventListener('click', startBattle);
}

function checkReady() {
    if (select1.value && select2.value) {
        startBtn.disabled = false;
    } else {
        startBtn.disabled = true;
    }
    
    // Ensure they don't pick the exact same ID for simplicity of logging (optional)
    if (select1.value && select2.value && select1.value === select2.value) {
        alert("¡Por favor elige dos Pokémon diferentes para la batalla!");
        select2.value = "";
        startBtn.disabled = true;
    }
}

// === Battle Engine ===
async function startBattle() {
    startBtn.disabled = true;
    startBtn.textContent = 'Cargando datos...';

    try {
        // Fetch detailed data for the two selected
        const [p1Response, p2Response] = await Promise.all([
            fetch(`https://pokeapi.co/api/v2/pokemon/${select1.value}`),
            fetch(`https://pokeapi.co/api/v2/pokemon/${select2.value}`)
        ]);

        const p1Data = await p1Response.json();
        const p2Data = await p2Response.json();

        // Initialize state
        battleState = {
            turn: 1,
            activeAttacker: 1, // 1 or 2
            log: [],
            p1: setupCombatant(p1Data, 1),
            p2: setupCombatant(p2Data, 2)
        };

        // UI Transitions
        selectionPhase.style.display = 'none';
        battleArena.style.display = 'flex';
        battleArena.style.flexDirection = 'column';
        updateUI();

        addLog(`¡La batalla entre ${battleState.p1.name} y ${battleState.p2.name} va a comenzar!`, 'system');
        
        // Start loop (every 2.5 seconds)
        setTimeout(() => {
            battleInterval = setInterval(executeTurn, 2500);
        }, 1500);

    } catch (e) {
        alert("Hubo un error cargando a los Pokémon.");
        startBtn.disabled = false;
        startBtn.textContent = 'Comenzar Batalla';
    }
}

function setupCombatant(data, playerNum) {
    const stats = {};
    data.stats.forEach(s => {
        stats[s.stat.name] = s.base_stat;
    });

    return {
        num: playerNum,
        name: data.name.toUpperCase(),
        image: data.sprites.other?.['official-artwork']?.front_default || data.sprites.front_default,
        hp: 100, // Normalized to 100%
        baseHp: stats.hp || 50,
        baseAtk: stats.attack || 50,
        baseDef: stats.defense || 50,
        baseSpAtk: stats['special-attack'] || 50,
        baseSpDef: stats['special-defense'] || 50,
        // Cooldowns remaining until available (starts at 3 and 2 logically, but game says "pasar por lo menos 3 turnos")
        // We'll set counters. 0 means ready.
        cooldowns: {
            spAtk: 3,
            spDef: 2,
        },
        hasSpecialDefenseActive: false // Flag to reduce incoming logic next turn
    };
}

function executeTurn() {
    const { p1, p2, activeAttacker, turn } = battleState;
    const attacker = activeAttacker === 1 ? p1 : p2;
    const defender = activeAttacker === 1 ? p2 : p1;

    addLog(`--- Turno ${turn} ---`, 'system');

    // 1. Check AI Action Decision
    let action = decideAction(attacker);

    // 2. Action Execution & Math
    let damage = 0;
    
    // Decrement cooldowns at start of their turn BEFORE deciding?
    // Let's decide action first, if they use it, it resets. If not, we decrement.
    // Actually, decrement active cooldowns
    if (attacker.cooldowns.spAtk > 0) attacker.cooldowns.spAtk--;
    if (attacker.cooldowns.spDef > 0) attacker.cooldowns.spDef--;
    // Reset spDef stance if it was active and its turn comes around again
    attacker.hasSpecialDefenseActive = false; 

    // Re-check AI Action Decision with updated cooldowns
    action = decideAction(attacker);

    // Check hit chance (random pueden fallar. Say 10% miss chance for attacks)
    const missChance = Math.random();
    let missed = false;

    if (action === 'special_attack' && missChance < 0.15) missed = true;
    if (action === 'normal_attack' && missChance < 0.10) missed = true;
    if (action === 'special_defense' && missChance < 0.10) missed = true; // Defense can fail

    if (missed) {
        if (action === 'special_defense') {
            addLog(`¡El turno es de ${attacker.name}! Intentó usar Defensa Especial pero ¡FALLÓ!`, 'miss');
            attacker.cooldowns.spDef = 2; // Resets because they tried and failed
        } else {
            addLog(`¡El turno es de ${attacker.name}! Usó un ataque pero ¡FALLÓ!`, 'miss');
            if (action === 'special_attack') attacker.cooldowns.spAtk = 3;
        }
    } else {
        if (action === 'special_defense') {
            addLog(`¡El turno es de ${attacker.name}! Decidió usar DEFENSA ESPECIAL. Se protegerá del próximo ataque.`, 'action');
            attacker.hasSpecialDefenseActive = true;
            attacker.cooldowns.spDef = 2 + 1; // 2 turns + this turn = 3 until usable again next next time. 
                                              // Wait, logic says must pass 2 turns. If I reset to 2, it drops to 1 next turn, 0 next next turn.
            attacker.cooldowns.spDef = 2; // Actually 2 is fine, next turn it drops to 1, next turn drops to 0 (ready).
        } 
        else if (action === 'special_attack') {
            damage = calculateDamage(attacker.baseSpAtk, defender.baseSpDef, 'special', defender.hasSpecialDefenseActive);
            addLog(`¡El turno es de ${attacker.name}! Utilizó ATAQUE ESPECIAL causando ${damage}% de daño.`, 'action_special');
            attacker.cooldowns.spAtk = 3; 
        } 
        else if (action === 'normal_attack') {
            damage = calculateDamage(attacker.baseAtk, defender.baseDef, 'normal', defender.hasSpecialDefenseActive);
            addLog(`¡El turno es de ${attacker.name}! Utilizó Ataque Normal causando ${damage}% de daño.`, 'action');
        }

        // Apply hit
        if (damage > 0) {
            defender.hp -= damage;
            if (defender.hp < 0) defender.hp = 0;
            addLog(`A ${defender.name} le queda ${defender.hp}% de vida.`, 'status');
            
            // Visual feedback
            const enemyBar = document.getElementById(`hp-fill-${defender.num}`);
            // add a quick blink class if we had time
        }
    }

    // Refresh UI
    updateUI();

    // Check Win Condition
    if (defender.hp <= 0) {
        clearInterval(battleInterval);
        addLog(`La salud de ${defender.name} llegó a 0%. ¡${attacker.name} ha ganado!`, 'winner');
        showWinner(attacker);
        return;
    }

    // Switch turns
    battleState.activeAttacker = battleState.activeAttacker === 1 ? 2 : 1;
    battleState.turn++;
}

function decideAction(combatant) {
    // Basic AI
    const canSpAtk = combatant.cooldowns.spAtk <= 0;
    const canSpDef = combatant.cooldowns.spDef <= 0;

    // Randomize decision: if special attack is ready, highly likely to use it
    if (canSpAtk && Math.random() < 0.7) {
        return 'special_attack';
    }
    
    // If special defense is ready, maybe use it
    if (canSpDef && Math.random() < 0.4) {
        return 'special_defense';
    }

    return 'normal_attack';
}

function calculateDamage(atk, def, type, defenderHasSpDef) {
    // Simple damage formula normalized out of 100% max health
    // Base damage ~ 10-20% for normal, 20-35% for special
    let base = type === 'special' ? (Math.random() * 15 + 20) : (Math.random() * 10 + 10);
    
    // Scale slightly by stats difference
    let multiplier = atk / def;
    // Cap multiplier to avoid instant 1-shots or 0 damage
    if (multiplier > 1.5) multiplier = 1.5;
    if (multiplier < 0.5) multiplier = 0.5;

    let total = Math.floor(base * multiplier);

    // Apply special defense mitigation
    if (defenderHasSpDef) {
        // Blocks 70% of damage
        total = Math.floor(total * 0.3);
    }

    // Ensure at least 1 damage if hit
    if (total < 1) total = 1;
    return total;
}

function updateUI() {
    const { p1, p2 } = battleState;

    // Setup initial if turn 1
    if (battleState.turn === 1) {
        document.getElementById('name-1').textContent = p1.name;
        document.getElementById('img-1').src = p1.image;
        document.getElementById('name-2').textContent = p2.name;
        document.getElementById('img-2').src = p2.image;
    }

    // HP Bars
    document.getElementById('hp-bar-1').style.width = p1.hp + '%';
    document.getElementById('hp-text-1').textContent = p1.hp + '%';
    const hpBar1 = document.getElementById('hp-bar-1');
    hpBar1.style.backgroundColor = p1.hp > 50 ? '#22c55e' : (p1.hp > 20 ? '#eab308' : '#ef4444');

    document.getElementById('hp-bar-2').style.width = p2.hp + '%';
    document.getElementById('hp-text-2').textContent = p2.hp + '%';
    const hpBar2 = document.getElementById('hp-bar-2');
    hpBar2.style.backgroundColor = p2.hp > 50 ? '#22c55e' : (p2.hp > 20 ? '#eab308' : '#ef4444');

    // Cooldown Texts
    document.getElementById('cd-sa-1').textContent = `Atk. Especial: ${p1.cooldowns.spAtk > 0 ? p1.cooldowns.spAtk + 't' : 'Listo'}`;
    document.getElementById('cd-sa-1').className = `cooldown-badge ${p1.cooldowns.spAtk > 0 ? 'inactive' : 'active'}`;
    
    document.getElementById('cd-sd-1').textContent = `Def. Especial: ${p1.cooldowns.spDef > 0 ? p1.cooldowns.spDef + 't' : 'Listo'}`;
    document.getElementById('cd-sd-1').className = `cooldown-badge ${p1.cooldowns.spDef > 0 ? 'inactive' : 'active'}`;

    document.getElementById('cd-sa-2').textContent = `Atk. Especial: ${p2.cooldowns.spAtk > 0 ? p2.cooldowns.spAtk + 't' : 'Listo'}`;
    document.getElementById('cd-sa-2').className = `cooldown-badge ${p2.cooldowns.spAtk > 0 ? 'inactive' : 'active'}`;
    
    document.getElementById('cd-sd-2').textContent = `Def. Especial: ${p2.cooldowns.spDef > 0 ? p2.cooldowns.spDef + 't' : 'Listo'}`;
    document.getElementById('cd-sd-2').className = `cooldown-badge ${p2.cooldowns.spDef > 0 ? 'inactive' : 'active'}`;
}

function addLog(message, type) {
    const p = document.createElement('p');
    p.className = `log-entry log-${type}`;
    p.textContent = message;
    logContainer.appendChild(p);

    // Auto-scroll to bottom
    logContainer.scrollTop = logContainer.scrollHeight;
}

function showWinner(winner) {
    setTimeout(() => {
        winnerModal.style.display = 'flex';
        document.getElementById('winner-img').src = winner.image;
        document.getElementById('winner-name').textContent = winner.name;
    }, 1000); // Wait 1 sec before popup
}
