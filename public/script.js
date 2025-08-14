// === BLACKJACK PIXEL ART CASINO - LÓGICA PRINCIPAL ===

// Estado global de la aplicación
let gameState = {
    user: null,
    currentBet: 0,
    balance: 1000,
    deck: [],
    playerCards: [],
    dealerCards: [],
    gameActive: false,
    playerTurn: false
};

// Configuración del juego
const INITIAL_BALANCE = 1000;
const MIN_BET = 10;
const DEALER_STAY_VALUE = 17;

// === INICIALIZACIÓN ===
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    checkExistingSession();
});

// Configurar event listeners
function setupEventListeners() {
    // Formulario de login
    document.getElementById('loginFormElement').addEventListener('submit', handleLogin);
    
    // Formulario de registro
    document.getElementById('registerFormElement').addEventListener('submit', handleRegister);
    
    // Validación en tiempo real para registro
    setupRealTimeValidation();
    
    // Prevenir envío si hay errores
    document.getElementById('registerFormElement').addEventListener('submit', function(e) {
        if (!validateRegistrationForm()) {
            e.preventDefault();
            return false;
        }
    });
}

// === VALIDACIÓN EN TIEMPO REAL ===
function setupRealTimeValidation() {
    const fields = {
        regUsername: validateUsernameField,
        regEmail: validateEmailField,
        regBirthDate: validateBirthDateField,
        regPhone: validatePhoneField,
        regPassword: validatePasswordField
    };
    
    Object.keys(fields).forEach(fieldId => {
        const field = document.getElementById(fieldId);
        field.addEventListener('input', fields[fieldId]);
        field.addEventListener('blur', fields[fieldId]);
    });
}

// Validaciones individuales de campos
function validateUsernameField() {
    const username = document.getElementById('regUsername').value;
    const errorElement = document.getElementById('regUsernameError');
    
    if (!username) {
        setFieldError(errorElement, '');
        return false;
    }
    
    if (username.length < 3 || username.length > 20) {
        setFieldError(errorElement, 'Debe tener entre 3 y 20 caracteres');
        return false;
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        setFieldError(errorElement, 'Solo letras, números, guiones y guion bajo');
        return false;
    }
    
    setFieldError(errorElement, '');
    return true;
}

function validateEmailField() {
    const email = document.getElementById('regEmail').value;
    const errorElement = document.getElementById('regEmailError');
    
    if (!email) {
        setFieldError(errorElement, '');
        return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        setFieldError(errorElement, 'Formato de correo inválido');
        return false;
    }
    
    setFieldError(errorElement, '');
    return true;
}

function validateBirthDateField() {
    const birthDate = document.getElementById('regBirthDate').value;
    const errorElement = document.getElementById('regBirthDateError');
    
    if (!birthDate) {
        setFieldError(errorElement, '');
        return false;
    }
    
    const age = calculateAge(birthDate);
    if (age < 18) {
        setFieldError(errorElement, `Tienes ${age} años. Debes ser mayor de 18.`);
        return false;
    }
    
    setFieldError(errorElement, '');
    return true;
}

function validatePhoneField() {
    const phone = document.getElementById('regPhone').value;
    const errorElement = document.getElementById('regPhoneError');
    
    if (!phone) {
        setFieldError(errorElement, '');
        return false;
    }
    
    const phoneRegex = /^(809|829|849)\d{7}$/;
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (!phoneRegex.test(cleanPhone)) {
        setFieldError(errorElement, 'Formato: 809/829/849 + 7 dígitos');
        return false;
    }
    
    setFieldError(errorElement, '');
    return true;
}

function validatePasswordField() {
    const password = document.getElementById('regPassword').value;
    const errorElement = document.getElementById('regPasswordError');
    const strengthElement = document.getElementById('passwordStrength');
    
    if (!password) {
        setFieldError(errorElement, '');
        strengthElement.className = 'password-strength';
        return false;
    }
    
    const requirements = [
        { regex: /.{8,}/, message: 'Mínimo 8 caracteres' },
        { regex: /[A-Z]/, message: 'Una letra mayúscula' },
        { regex: /[a-z]/, message: 'Una letra minúscula' },
        { regex: /\d/, message: 'Un número' },
        { regex: /[@$!%*?&]/, message: 'Un carácter especial (@$!%*?&)' }
    ];
    
    const failedRequirements = requirements.filter(req => !req.regex.test(password));
    
    if (failedRequirements.length > 0) {
        setFieldError(errorElement, `Falta: ${failedRequirements.map(r => r.message).join(', ')}`);
    } else {
        setFieldError(errorElement, '');
    }
    
    // Actualizar indicador visual de fortaleza
    const strength = 5 - failedRequirements.length;
    const strengthClasses = ['', 'weak', 'medium', 'good', 'strong'];
    strengthElement.className = `password-strength ${strengthClasses[strength] || ''}`;
    
    return failedRequirements.length === 0;
}

function setFieldError(errorElement, message) {
    errorElement.textContent = message;
    errorElement.style.display = message ? 'block' : 'none';
}

function calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    
    return age;
}

function validateRegistrationForm() {
    const validations = [
        validateUsernameField(),
        validateEmailField(),
        validateBirthDateField(),
        validatePhoneField(),
        validatePasswordField()
    ];
    
    return validations.every(isValid => isValid);
}

// === GESTIÓN DE SESIONES ===
async function checkExistingSession() {
    try {
        const response = await fetch('/api/session');
        if (response.ok) {
            const data = await response.json();
            gameState.user = data.user;
            gameState.balance = data.user.balance;
            showGameScreen();
        }
    } catch (error) {
        console.log('No hay sesión activa');
    }
}

// === AUTENTICACIÓN ===
async function handleLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    
    if (!email || !password) {
        showError('Todos los campos son obligatorios');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            gameState.user = data.user;
            gameState.balance = data.user.balance;
            showGameScreen();
            showMessage('¡Bienvenido al casino! 🎰', 'success');
        } else {
            showError(data.error || 'Error al iniciar sesión');
        }
    } catch (error) {
        showError('Error de conexión. Inténtalo de nuevo.');
    } finally {
        showLoading(false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    if (!validateRegistrationForm()) {
        showError('Por favor corrige los errores en el formulario');
        return;
    }
    
    const formData = new FormData(e.target);
    const userData = {
        username: formData.get('username'),
        email: formData.get('email'),
        password: formData.get('password'),
        birthDate: formData.get('birthDate'),
        phone: formData.get('phone').replace(/\D/g, '')
    };
    
    showLoading(true);
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('¡Cuenta creada exitosamente! 🎉', 'success');
            showLoginForm();
            // Pre-llenar email en login
            document.getElementById('loginEmail').value = userData.email;
        } else {
            showError(data.error || 'Error al crear la cuenta');
        }
    } catch (error) {
        showError('Error de conexión. Inténtalo de nuevo.');
    } finally {
        showLoading(false);
    }
}

async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        gameState.user = null;
        gameState.balance = INITIAL_BALANCE;
        resetGame();
        showAuthScreen();
        showMessage('Sesión cerrada correctamente', 'info');
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
    }
}

// === GESTIÓN DE PANTALLAS ===
function showAuthScreen() {
    document.getElementById('authScreen').classList.add('active');
    document.getElementById('gameScreen').classList.remove('active');
}

function showGameScreen() {
    document.getElementById('authScreen').classList.remove('active');
    document.getElementById('gameScreen').classList.add('active');
    initializeGame();
}

function showLoginForm() {
    document.getElementById('loginForm').classList.add('active');
    document.getElementById('registerForm').classList.remove('active');
}

function showRegisterForm() {
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('registerForm').classList.add('active');
}

// === INICIALIZACIÓN DEL JUEGO ===
function initializeApp() {
    showAuthScreen();
    showLoginForm();
}

function initializeGame() {
    updatePlayerInfo();
    createDeck();
    resetGame();
}

function updatePlayerInfo() {
    if (gameState.user) {
        document.getElementById('playerName').textContent = `👤 ${gameState.user.username}`;
        document.getElementById('playerNameGame').textContent = `👤 ${gameState.user.username.toUpperCase()}`;
        document.getElementById('playerBalance').textContent = `💰 ${gameState.balance}`;
    }
}

// === LÓGICA DEL BLACKJACK ===

// Crear baraja
function createDeck() {
    const suits = ['♠️', '♥️', '♦️', '♣️'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
    gameState.deck = [];
    
    for (let suit of suits) {
        for (let rank of ranks) {
            gameState.deck.push({
                suit: suit,
                rank: rank,
                value: getCardValue(rank),
                isRed: suit === '♥️' || suit === '♦️'
            });
        }
    }
    
    shuffleDeck();
}

function getCardValue(rank) {
    if (rank === 'A') return 11;
    if (['J', 'Q', 'K'].includes(rank)) return 10;
    return parseInt(rank);
}

function shuffleDeck() {
    for (let i = gameState.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gameState.deck[i], gameState.deck[j]] = [gameState.deck[j], gameState.deck[i]];
    }
}

// Gestión de apuestas
function placeBet(amount) {
    if (gameState.gameActive) {
        showMessage('Termina la partida actual primero', 'warning');
        return;
    }
    
    if (amount > gameState.balance) {
        showMessage('Saldo insuficiente', 'error');
        return;
    }
    
    gameState.currentBet = amount;
    document.getElementById('currentBet').textContent = `${amount}`;
    document.getElementById('dealBtn').disabled = false;
    
    // Animación de ficha
    const chip = document.querySelector(`[data-value="${amount}"]`);
    chip.style.transform = 'scale(1.2)';
    setTimeout(() => chip.style.transform = 'scale(1)', 200);
    
    showMessage(`Apuesta: ${amount}`, 'info');
}

// Iniciar juego
function startGame() {
    if (gameState.currentBet === 0) {
        showMessage('Selecciona una apuesta primero', 'warning');
        return;
    }
    
    if (gameState.currentBet > gameState.balance) {
        showMessage('Saldo insuficiente', 'error');
        return;
    }
    
    // Restar apuesta del saldo
    gameState.balance -= gameState.currentBet;
    updatePlayerInfo();
    
    // Resetear cartas
    gameState.playerCards = [];
    gameState.dealerCards = [];
    gameState.gameActive = true;
    gameState.playerTurn = true;
    
    // Repartir cartas iniciales
    dealInitialCards();
    
    // Actualizar controles
    document.getElementById('dealBtn').disabled = true;
    document.getElementById('hitBtn').disabled = false;
    document.getElementById('standBtn').disabled = false;
    document.getElementById('newGameBtn').style.display = 'none';
    
    showMessage('¡Cartas repartidas! Tu turno', 'info');
}

function dealInitialCards() {
    // 2 cartas al jugador
    gameState.playerCards.push(drawCard());
    gameState.playerCards.push(drawCard());
    
    // 2 cartas al dealer (1 oculta)
    gameState.dealerCards.push(drawCard());
    gameState.dealerCards.push({ ...drawCard(), hidden: true });
    
    updateCardDisplay();
    
    // Verificar blackjack natural
    if (calculateHandValue(gameState.playerCards) === 21) {
        setTimeout(() => {
            stand(); // Automáticamente se planta si tiene 21
        }, 1000);
    }
}

function drawCard() {
    if (gameState.deck.length === 0) {
        createDeck(); // Crear nueva baraja si se agota
    }
    return gameState.deck.pop();
}

// Pedir carta
function hit() {
    if (!gameState.playerTurn || !gameState.gameActive) return;
    
    gameState.playerCards.push(drawCard());
    updateCardDisplay();
    
    const playerValue = calculateHandValue(gameState.playerCards);
    
    if (playerValue > 21) {
        // Jugador se pasa
        endGame('lose', '¡Te pasaste! 💥 Perdiste');
    } else if (playerValue === 21) {
        // Jugador llega a 21, se planta automáticamente
        setTimeout(stand, 500);
    }
}

// Plantarse
function stand() {
    if (!gameState.gameActive) return;
    
    gameState.playerTurn = false;
    document.getElementById('hitBtn').disabled = true;
    document.getElementById('standBtn').disabled = true;
    
    // Revelar carta oculta del dealer
    gameState.dealerCards = gameState.dealerCards.map(card => ({ ...card, hidden: false }));
    updateCardDisplay();
    
    // Turno del dealer
    dealerTurn();
}

function dealerTurn() {
    const dealerValue = calculateHandValue(gameState.dealerCards);
    
    showMessage('Turno del dealer...', 'info');
    
    setTimeout(() => {
        if (dealerValue < DEALER_STAY_VALUE) {
            // Dealer debe pedir carta
            gameState.dealerCards.push(drawCard());
            updateCardDisplay();
            dealerTurn(); // Recursivo hasta que el dealer se plante o se pase
        } else {
            // Dealer se planta o se pasa
            determineWinner();
        }
    }, 1500);
}

function determineWinner() {
    const playerValue = calculateHandValue(gameState.playerCards);
    const dealerValue = calculateHandValue(gameState.dealerCards);
    
    let result, message, winnings = 0;
    
    if (dealerValue > 21) {
        result = 'win';
        message = '🎉 ¡Dealer se pasó! Ganaste';
        winnings = gameState.currentBet * 2;
    } else if (playerValue > dealerValue) {
        result = 'win';
        message = '🎉 ¡Ganaste!';
        winnings = gameState.currentBet * 2;
    } else if (playerValue < dealerValue) {
        result = 'lose';
        message = '😢 Perdiste';
        winnings = 0;
    } else {
        result = 'tie';
        message = '🤝 Empate';
        winnings = gameState.currentBet; 
    }
    
    
    if (playerValue === 21 && gameState.playerCards.length === 2 && dealerValue !== 21) {
        result = 'win';
        message = '🃏 ¡BLACKJACK! 🎰';
        winnings = Math.floor(gameState.currentBet * 2.5); 
    }
    
    endGame(result, message, winnings);
}

async function endGame(result, message, winnings = 0) {
    gameState.gameActive = false;
    gameState.playerTurn = false;
    
    
    gameState.balance += winnings;
    updatePlayerInfo();
    
    
    const messageElement = document.getElementById('gameMessage');
    messageElement.textContent = message;
    messageElement.className = `game-message ${result}-animation`;
    
   
    document.getElementById('hitBtn').disabled = true;
    document.getElementById('standBtn').disabled = true;
    document.getElementById('newGameBtn').style.display = 'inline-block';
    
    
    if (gameState.user) {
        try {
            await fetch('/api/game-result', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    result: result,
                    bet: gameState.currentBet,
                    newBalance: gameState.balance
                })
            });
        } catch (error) {
            console.error('Error guardando resultado:', error);
        }
    }
}

function newGame() {
    resetGame();
    document.getElementById('currentBet').textContent = '$0';
    gameState.currentBet = 0;
    document.getElementById('dealBtn').disabled = false;
    showMessage('Selecciona tu apuesta', 'info');
}

function resetGame() {
    gameState.gameActive = false;
    gameState.playerTurn = false;
    gameState.playerCards = [];
    gameState.dealerCards = [];
    
    
    document.getElementById('playerCards').innerHTML = '';
    document.getElementById('dealerCards').innerHTML = '';
    document.getElementById('playerValue').textContent = 'Valor: 0';
    document.getElementById('dealerValue').textContent = 'Valor: ?';
    document.getElementById('gameMessage').textContent = '';
    
    
    document.getElementById('hitBtn').disabled = true;
    document.getElementById('standBtn').disabled = true;
    document.getElementById('newGameBtn').style.display = 'none';
}


function calculateHandValue(cards) {
    let value = 0;
    let aces = 0;
    
    for (let card of cards) {
        if (card.hidden) continue;
        
        if (card.rank === 'A') {
            aces++;
            value += 11;
        } else {
            value += card.value;
        }
    }
    
    
    while (value > 21 && aces > 0) {
        value -= 10;
        aces--;
    }
    
    return value;
}


function updateCardDisplay() {
    updatePlayerCards();
    updateDealerCards();
}

function updatePlayerCards() {
    const container = document.getElementById('playerCards');
    container.innerHTML = '';
    
    gameState.playerCards.forEach((card, index) => {
        const cardElement = createCardElement(card);
        cardElement.style.animationDelay = `${index * 0.2}s`;
        container.appendChild(cardElement);
    });
    
    const value = calculateHandValue(gameState.playerCards);
    document.getElementById('playerValue').textContent = `Valor: ${value}`;
    
    
    if (value > 21) {
        container.classList.add('lose-animation');
    }
}

function updateDealerCards() {
    const container = document.getElementById('dealerCards');
    container.innerHTML = '';
    
    gameState.dealerCards.forEach((card, index) => {
        const cardElement = createCardElement(card);
        cardElement.style.animationDelay = `${index * 0.2}s`;
        container.appendChild(cardElement);
    });
    
    const value = calculateHandValue(gameState.dealerCards);
    const hiddenCards = gameState.dealerCards.filter(card => card.hidden).length;
    
    if (hiddenCards > 0) {
        document.getElementById('dealerValue').textContent = 'Valor: ?';
    } else {
        document.getElementById('dealerValue').textContent = `Valor: ${value}`;
    }
}

function createCardElement(card) {
    const cardDiv = document.createElement('div');
    cardDiv.className = `card ${card.isRed ? 'red' : 'black'} ${card.hidden ? 'hidden' : ''}`;
    
    if (card.hidden) {
        cardDiv.innerHTML = `
            <div class="card-suit">🂠</div>
            <div class="card-value">?</div>
        `;
    } else {
        cardDiv.innerHTML = `
            <div class="card-suit">${card.suit}</div>
            <div class="card-value">${card.rank}</div>
        `;
    }
    
    return cardDiv;
}


function showMessage(text, type = 'info') {
    const messageElement = document.getElementById('gameMessage');
    if (messageElement) {
        messageElement.textContent = text;
        messageElement.className = `game-message ${type}`;
    }
    
    
    console.log(`[${type.toUpperCase()}] ${text}`);
}

function showError(message) {
    showMessage(message, 'error');
    
    
    if (message.includes('conexión') || message.includes('servidor')) {
        setTimeout(() => alert(message), 100);
    }
}

function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (show) {
        spinner.classList.add('active');
    } else {
        spinner.classList.remove('active');
    }
}


window.addEventListener('error', function(e) {
    console.error('Error global:', e.error);
    showError('Ha ocurrido un error inesperado');
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Promise rechazada:', e.reason);
    showError('Error de conexión con el servidor');
});


window.showLoginForm = showLoginForm;
window.showRegisterForm = showRegisterForm;
window.logout = logout;
window.placeBet = placeBet;
window.startGame = startGame;
window.hit = hit;
window.stand = stand;
window.newGame = newGame;


if (window.location.hostname === 'localhost') {
    window.gameState = gameState;
    window.debugAddBalance = function(amount) {
        gameState.balance += amount;
        updatePlayerInfo();
    };
    
    console.log('🎮 Blackjack Casino cargado');
    console.log('🔧 Funciones de debug disponibles: gameState, debugAddBalance()');
}