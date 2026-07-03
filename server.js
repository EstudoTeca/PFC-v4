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
// Aumentado para 5mb para suportar o envio de fotos de perfil em Base64
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, '/')));

// --- 2. VALIDAÇÃO DE AMBIENTE ---
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!MONGO_URI || !JWT_SECRET) {
    console.error("❌ ERRO CRÍTICO: MONGO_URI ou JWT_SECRET não configurados no .env");
    process.exit(1);
}

// --- 3. CONFIGURAÇÃO IA (GEMINI) ---
const genAI = new GoogleGenerativeAI("AQ.Ab8RN6JM-u0AwMdcNStj0j5NKL7oE97GVFbOgbp-a8LQ1qBvOg");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// --- 4. CONEXÃO COM O BANCO DE DADOS ---
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ SaaS Database: Conexão Segura Estabelecida"))
    .catch(err => {
        console.error("❌ Erro MongoDB:", err.message);
        process.exit(1);
    });

// --- 5. MODELOS DE DADOS (SCHEMAS) ---
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    photo: { type: String, default: "" }, // Armazena a string Base64 da imagem
    plan: { type: String, default: 'Elite Member' },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

const eventSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    title: String,
    date: String,
    type: { type: String, default: 'study' }
});

const Event = mongoose.model('Event', eventSchema);

// --- 6. MIDDLEWARE DE PROTEÇÃO (JWT) ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Acesso negado. Faça login." });

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
        if (exists) return res.status(400).json({ error: "Este e-mail já está cadastrado." });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashedPassword });
        await user.save();
        res.status(201).json({ message: "Conta criada com sucesso!" });
    } catch (err) {
        res.status(500).json({ error: "Erro interno no registro." });
    }
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
            user: { 
                id: user._id, 
                name: user.name, 
                email: user.email, 
                photo: user.photo,
                plan: user.plan 
            }
        });
    } catch (err) {
        res.status(500).json({ error: "Erro interno no login." });
    }
});

// --- 8. ROTAS DE SEGURANÇA E CONTA ---

// Verifica a senha atual (usado antes de mudanças críticas)
app.post('/api/auth/verify-password', authenticateToken, async (req, res) => {
    try {
        const { password } = req.body;
        const user = await User.findById(req.user.id);
        const valid = await bcrypt.compare(password, user.password);
        if (valid) return res.sendStatus(200);
        res.status(401).json({ error: "Senha incorreta." });
    } catch (e) {
        res.status(500).send();
    }
});

// Atualiza o E-mail (exige confirmação de senha)
app.put('/api/auth/update-email', authenticateToken, async (req, res) => {
    try {
        const { newEmail, password } = req.body;
        const user = await User.findById(req.user.id);
        
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: "Senha inválida para esta operação." });

        const emailExists = await User.findOne({ email: newEmail });
        if (emailExists) return res.status(400).json({ error: "E-mail já está em uso." });

        user.email = newEmail;
        await user.save();
        res.json({ message: "E-mail atualizado com sucesso!" });
    } catch (e) {
        res.status(500).json({ error: "Falha ao processar troca de e-mail." });
    }
});

// Atualiza a Senha (exige a antiga)
app.put('/api/auth/update-password', authenticateToken, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id);

        const valid = await bcrypt.compare(oldPassword, user.password);
        if (!valid) return res.status(401).json({ error: "Senha antiga incorreta." });

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        res.json({ message: "Senha atualizada com sucesso!" });
    } catch (e) {
        res.status(500).json({ error: "Falha ao processar troca de senha." });
    }
});

// --- 9. ROTAS DE PERFIL (NOME E FOTO) ---

app.put('/api/user/:id', authenticateToken, async (req, res) => {
    try {
        const { name, photo } = req.body;
        const updateData = {};
        if (name) updateData.name = name;
        if (photo) updateData.photo = photo;

        const updated = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
        res.json({ name: updated.name, photo: updated.photo });
    } catch (err) {
        res.status(500).json({ error: "Erro ao atualizar dados de perfil." });
    }
});

app.delete('/api/user/:id', authenticateToken, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        await Event.deleteMany({ userId: req.params.id });
        res.json({ message: "Conta e dados excluídos." });
    } catch (err) {
        res.status(500).json({ error: "Erro ao excluir conta." });
    }
});

// --- 10. IA E EVENTOS ---

app.post('/api/ai/tutor', authenticateToken, async (req, res) => {
    try {
        // RADAR 1: Verifica se a chave tá sendo lida
        console.log("🤖 Iniciando requisição para a IA...");
        if(!GEMINI_KEY) {
            console.log("❌ ERRO: A chave do Gemini está VAZIA ou não foi lida do .env!");
        }

        const { prompt, subject } = req.body;
        console.log(`📝 O aluno perguntou: ${prompt}`);

        // RADAR 2: Envia para o Google
        const context = `Atue como um Tutor amigável do EstudoTeca. Responda de forma clara e resumida: ${prompt}`;
        const result = await model.generateContent(context);
        const response = await result.response;
        
        console.log("✅ Resposta gerada com sucesso!");
        res.json({ answer: response.text() });

    } catch (err) {
        // RADAR 3: O ERRO REAL APARECE AQUI NO TERMINAL DO VS CODE
        console.error("❌ ERRO REAL DO GEMINI NO BACKEND:", err.message || err);
        res.status(500).json({ error: "IA temporariamente indisponível." });
    }
});

app.get('/api/events', authenticateToken, async (req, res) => {
    try {
        const events = await Event.find({ userId: req.user.id });
        res.json(events);
    } catch (e) { res.status(500).send(); }
});

app.post('/api/events', authenticateToken, async (req, res) => {
    try {
        const event = new Event({ ...req.body, userId: req.user.id });
        await event.save();
        res.status(201).json(event);
    } catch (e) { res.status(500).send(); }
});

// --- GERAÇÃO DE QUIZ COM INTELIGÊNCIA ARTIFICIAL ---
app.post('/api/ai/quiz', authenticateToken, async (req, res) => {
    try {
        const { topic } = req.body;
        console.log(`🤖 IA montando simulado sobre: ${topic}`);

        // O prompt obriga a IA a devolver um código JSON perfeito para o site ler
        const context = `Atue como um professor de vestibular elaborando uma prova. 
        Crie 3 questões de múltipla escolha sobre o tema: "${topic}".
        Você DEVE retornar APENAS um array em formato JSON exato, sem formatação markdown, sem crases, sem a palavra json. 
        Use estritamente esta estrutura:
        [
            { "q": "Texto da pergunta aqui?", "options": ["Opção A", "Opção B", "Opção C", "Opção D"], "answer": 0 }
        ]
        Onde 'answer' é o número (0, 1, 2 ou 3) que corresponde à resposta certa do array 'options'. Retorne APENAS o JSON válido.`;

        const result = await model.generateContent(context);
        const response = await result.response;
        
        let aiText = response.text().trim();
        
        // Limpeza de segurança caso a IA mande aspas sujas
        if (aiText.startsWith("```json")) aiText = aiText.replace(/```json/g, "").replace(/```/g, "");
        if (aiText.startsWith("```")) aiText = aiText.replace(/```/g, "");
        
        const quizData = JSON.parse(aiText); // Transforma o texto da IA em código real

        res.json(quizData);
    } catch (err) {
        console.error("❌ ERRO AO GERAR QUIZ:", err.message || err);
        res.status(500).json({ error: "Falha ao gerar simulado." });
    }
});

// --- INICIALIZAÇÃO ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 SERVIDOR ELITE ATIVO: http://localhost:${PORT}`);
});