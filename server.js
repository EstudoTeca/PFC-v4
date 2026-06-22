/* ============================================================
   ESTUDOTECA SaaS ELITE - SERVIDOR CENTRAL (v11.1 SECURITY)
   ============================================================ */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();

// --- 1. CONFIGURAÇÕES DE MIDDLEWARE ---
// Aumentado para 5mb para suportar o envio de fotos em Base64
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, '/')));

// --- 2. VALIDAÇÃO DE AMBIENTE ---
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!MONGO_URI || !JWT_SECRET) {
    console.error("❌ ERRO: Verifique MONGO_URI e JWT_SECRET no arquivo .env");
    process.exit(1);
}

// --- 3. CONFIGURAÇÃO IA (GEMINI) ---
const genAI = new GoogleGenerativeAI(GEMINI_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- 4. CONEXÃO MONGODB ---
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ SaaS Database: Conexão Segura Ativa"))
    .catch(err => {
        console.error("❌ Erro MongoDB:", err.message);
        process.exit(1);
    });

// --- 5. MODELOS DE DADOS ---
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    photo: { type: String, default: "" }, // Armazena Base64 da imagem
    plan: { type: String, default: 'Elite Member' },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

const Event = mongoose.model('Event', new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    title: String,
    date: String,
    type: { type: String, default: 'study' }
}));

// --- 6. MIDDLEWARE DE PROTEÇÃO (JWT) ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Acesso negado." });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Sessão expirada." });
        req.user = user;
        next();
    });
};

// --- 7. ROTAS DE AUTENTICAÇÃO ---

app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ error: "E-mail já cadastrado." });

        const hashed = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashed });
        await user.save();
        res.status(201).json({ message: "Conta criada!" });
    } catch (err) { res.status(500).json({ error: "Erro no registro." }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: "Credenciais inválidas." });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(400).json({ error: "Credenciais inválidas." });

        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
            token,
            user: { id: user._id, name: user.name, email: user.email, photo: user.photo }
        });
    } catch (err) { res.status(500).json({ error: "Erro no login." }); }
});

// --- 8. ROTAS DE SEGURANÇA (O QUE VOCÊ PEDIU) ---

// Verifica se a senha enviada é a correta (para validar alterações)
app.post('/api/auth/verify-password', authenticateToken, async (req, res) => {
    try {
        const { password } = req.body;
        const user = await User.findById(req.user.id);
        const valid = await bcrypt.compare(password, user.password);
        if (valid) res.sendStatus(200);
        else res.status(401).json({ error: "Senha incorreta." });
    } catch (e) { res.status(500).send(); }
});

// Atualiza o E-mail com validação de senha
app.put('/api/auth/update-email', authenticateToken, async (req, res) => {
    try {
        const { newEmail, password } = req.body;
        const user = await User.findById(req.user.id);
        
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: "Senha inválida." });

        user.email = newEmail;
        await user.save();
        res.json({ message: "E-mail atualizado!" });
    } catch (e) { res.status(500).json({ error: "Erro ao trocar e-mail." }); }
});

// Atualiza a Senha (exigindo a antiga)
app.put('/api/auth/update-password', authenticateToken, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id);

        const valid = await bcrypt.compare(oldPassword, user.password);
        if (!valid) return res.status(401).json({ error: "Senha antiga incorreta." });

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        res.json({ message: "Senha atualizada com sucesso!" });
    } catch (e) { res.status(500).json({ error: "Erro ao trocar senha." }); }
});

// --- 9. ROTAS DE USUÁRIO (PERFIL E FOTO) ---

app.put('/api/user/:id', authenticateToken, async (req, res) => {
    try {
        const { name, photo } = req.body;
        const updateData = {};
        if (name) updateData.name = name;
        if (photo) updateData.photo = photo;

        const updated = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
        res.json({ name: updated.name, photo: updated.photo });
    } catch (err) { res.status(500).json({ error: "Erro ao atualizar perfil." }); }
});

app.delete('/api/user/:id', authenticateToken, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        await Event.deleteMany({ userId: req.params.id });
        res.json({ message: "Conta excluída." });
    } catch (err) { res.status(500).json({ error: "Erro ao excluir." }); }
});

// --- 10. IA E EVENTOS ---

app.post('/api/ai/tutor', authenticateToken, async (req, res) => {
    try {
        const { prompt, subject } = req.body;
        const context = `Tutor EstudoTeca: Explique sobre ${subject} de forma simples: ${prompt}`;
        const result = await model.generateContent(context);
        res.json({ answer: (await result.response).text() });
    } catch (err) { res.status(500).json({ error: "Erro na IA." }); }
});

app.get('/api/events', authenticateToken, async (req, res) => {
    const events = await Event.find({ userId: req.user.id });
    res.json(events);
});

app.post('/api/events', authenticateToken, async (req, res) => {
    const event = new Event({ ...req.body, userId: req.user.id });
    await event.save();
    res.status(201).json(event);
});

// --- INICIALIZAÇÃO ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 SERVIDOR ELITE ATIVO: http://localhost:${PORT}`);
});