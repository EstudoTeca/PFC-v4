/* ============================================================
   js/services.js - NÚCLEO DE COMUNICAÇÃO API E SEGURANÇA
   ============================================================ */

const API_URL = "http://localhost:3000/api";

/**
 * SISTEMA GLOBAL DE NOTIFICAÇÕES (TOASTS)
 * Cria alertas visuais elegantes no canto da tela.
 */
function notify(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Ícone dinâmico baseado no tipo de mensagem
    const icon = type === 'success' ? 'fa-circle-check' : 
                 type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info';

    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Remove automaticamente após 4 segundos com animação
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

/**
 * OBJETO DE SERVIÇOS API
 * Gerencia chamadas ao backend Node.js
 */
const apiService = {
    
    // --- AUTENTICAÇÃO ---
    async login(email, password) {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Falha no login");
        
        this.saveSession(data.token, data.user);
        return data.user;
    },

    async register(name, email, password) {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Erro no cadastro");
        return data;
    },

    // --- SEGURANÇA E CONTA (RECURSOS PRO) ---
    
    // Valida se a senha atual confere antes de trocas críticas
    async verifyPassword(password) {
        try {
            const response = await fetch(`${API_URL}/auth/verify-password`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ password })
            });
            return response.ok;
        } catch (e) { return false; }
    },

    // Atualiza nome ou foto (perfil público)
    async updateProfile(userId, updateData) {
        const response = await fetch(`${API_URL}/user/${userId}`, {
            method: "PUT",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(updateData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Erro ao atualizar perfil");
        
        // Atualiza dados locais caso tenham mudado
        if (data.name) localStorage.setItem('user_name', data.name);
        if (data.photo) localStorage.setItem('user_photo', data.photo);
        
        return data;
    },

    // Atualiza e-mail exigindo a senha atual
    async updateEmail(newEmail, currentPassword) {
        const response = await fetch(`${API_URL}/auth/update-email`, {
            method: "PUT",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ newEmail, password: currentPassword })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Erro ao atualizar e-mail");
        
        localStorage.setItem('user_email', newEmail);
        return data;
    },

    // Atualiza senha exigindo a antiga
    async updatePassword(oldPassword, newPassword) {
        const response = await fetch(`${API_URL}/auth/update-password`, {
            method: "PUT",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ oldPassword, newPassword })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Erro ao atualizar senha");
        return data;
    },

    async deleteAccount(userId) {
        const response = await fetch(`${API_URL}/user/${userId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error("Não foi possível excluir a conta.");
        return true;
    },

    // --- INTELIGÊNCIA ARTIFICIAL ---
    async askAITutor(promptText) {
        const response = await fetch(`${API_URL}/ai/tutor`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem('token')}`
            },
            // Manda a pergunta pro backend que você já tem
            body: JSON.stringify({ prompt: promptText, subject: "Assuntos Escolares e Vestibular" })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Falha ao conectar com o Tutor.");
        return data.answer;

    
    },

    async generateAIQuiz(topic) {
        const response = await fetch(`${API_URL}/ai/quiz`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ topic: topic })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Falha ao gerar simulado");
        return data; // Retorna as questões criadas pela IA
    },

    // --- AUXILIARES DE SESSÃO ---
    saveSession(token, user) {
        localStorage.setItem('token', token);
        localStorage.setItem('user_id', user.id);
        localStorage.setItem('user_name', user.name);
        localStorage.setItem('user_email', user.email);
        if (user.photo) localStorage.setItem('user_photo', user.photo);
    },

    logout() {
        localStorage.clear();
        window.location.href = 'login.html';
    }
};