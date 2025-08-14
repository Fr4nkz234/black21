const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const validator = require('validator');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de seguridad
app.use(helmet({
    contentSecurityPolicy: false // Permitir CSS inline para el pixel art
}));
app.use(cors());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // límite de 100 requests por ventana
    message: 'Demasiadas solicitudes, intenta de nuevo más tarde.'
});
app.use('/api/', limiter);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configuración de sesiones
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret_key_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // cambiar a true en producción con HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// Configuración de base de datos
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'blackjack_user',
    password: process.env.DB_PASSWORD || 'secure_password_123',
    database: process.env.DB_NAME || 'blackjack_casino',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// Funciones de validación
function validateUsername(username) {
    const regex = /^[a-zA-Z0-9_-]{3,20}$/;
    return regex.test(username);
}

function validateEmail(email) {
    return validator.isEmail(email);
}

function validatePassword(password) {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
}

function validateDominicanPhone(phone) {
    const regex = /^(809|829|849)\d{7}$/;
    return regex.test(phone.replace(/\D/g, ''));
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

// Rutas de la API

// Registro de usuario
app.post('/api/register', async (req, res) => {
    const { username, email, password, birthDate, phone } = req.body;
    
    try {
        // Validaciones
        if (!validateUsername(username)) {
            return res.status(400).json({ 
                error: 'Nombre de usuario inválido. Debe tener 3-20 caracteres y solo contener letras, números, guiones y guiones bajos.' 
            });
        }
        
        if (!validateEmail(email)) {
            return res.status(400).json({ error: 'Formato de correo electrónico inválido.' });
        }
        
        if (!validatePassword(password)) {
            return res.status(400).json({ 
                error: 'Contraseña debe tener al menos 8 caracteres, 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial.' 
            });
        }
        
        if (calculateAge(birthDate) < 18) {
            return res.status(400).json({ error: 'Debes ser mayor de 18 años para registrarte.' });
        }
        
        if (!validateDominicanPhone(phone)) {
            return res.status(400).json({ error: 'Número de teléfono inválido. Debe empezar con 809, 829 o 849 seguido de 7 dígitos.' });
        }
        
        // Verificar si el usuario ya existe
        const [existingUsers] = await pool.execute(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );
        
        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'El usuario o correo electrónico ya existe.' });
        }
        
        // Hash de la contraseña
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // Insertar nuevo usuario
        const [result] = await pool.execute(
            'INSERT INTO users (username, email, password_hash, birth_date, phone, balance) VALUES (?, ?, ?, ?, ?, ?)',
            [username, email, hashedPassword, birthDate, phone, 1000] // Saldo inicial de 1000
        );
        
        res.json({ success: true, message: 'Usuario registrado exitosamente.' });
        
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
        }
        
        // Buscar usuario
        const [users] = await pool.execute(
            'SELECT id, username, email, password_hash, balance FROM users WHERE email = ?',
            [email]
        );
        
        if (users.length === 0) {
            return res.status(400).json({ error: 'Credenciales inválidas.' });
        }
        
        const user = users[0];
        
        // Verificar contraseña
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!isValidPassword) {
            return res.status(400).json({ error: 'Credenciales inválidas.' });
        }
        
        // Crear sesión
        req.session.userId = user.id;
        req.session.username = user.username;
        
        res.json({ 
            success: true, 
            user: { 
                id: user.id, 
                username: user.username, 
                email: user.email,
                balance: user.balance 
            } 
        });
        
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Error al cerrar sesión.' });
        }
        res.json({ success: true, message: 'Sesión cerrada exitosamente.' });
    });
});

// Verificar sesión
app.get('/api/session', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'No hay sesión activa.' });
    }
    
    try {
        const [users] = await pool.execute(
            'SELECT id, username, email, balance FROM users WHERE id = ?',
            [req.session.userId]
        );
        
        if (users.length === 0) {
            req.session.destroy();
            return res.status(401).json({ error: 'Usuario no encontrado.' });
        }
        
        res.json({ user: users[0] });
        
    } catch (error) {
        console.error('Error verificando sesión:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Actualizar saldo después de una partida
app.post('/api/game-result', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'No hay sesión activa.' });
    }
    
    const { result, bet, newBalance } = req.body;
    
    try {
        // Actualizar saldo del usuario
        await pool.execute(
            'UPDATE users SET balance = ? WHERE id = ?',
            [newBalance, req.session.userId]
        );
        
        // Guardar historial de partida
        await pool.execute(
            'INSERT INTO game_history (user_id, game_result, bet_amount, balance_after) VALUES (?, ?, ?, ?)',
            [req.session.userId, result, bet, newBalance]
        );
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Error guardando resultado:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Obtener historial de partidas
app.get('/api/history', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'No hay sesión activa.' });
    }
    
    try {
        const [history] = await pool.execute(
            'SELECT game_result, bet_amount, balance_after, created_at FROM game_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
            [req.session.userId]
        );
        
        res.json({ history });
        
    } catch (error) {
        console.error('Error obteniendo historial:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🎰 Blackjack Casino servidor ejecutándose en puerto ${PORT}`);
    console.log(`🌐 Accede a: http://localhost:${PORT}`);
});

// Manejo graceful de cierre
process.on('SIGTERM', async () => {
    console.log('🛑 Cerrando servidor...');
    await pool.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 Cerrando servidor...');
    await pool.end();
    process.exit(0);
});