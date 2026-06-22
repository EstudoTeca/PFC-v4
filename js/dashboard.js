/* ============================================================
   js/dashboard.js - INTELIGÊNCIA OPERACIONAL ESTUDOTECA V11
   ============================================================ */

const App = {
    currentDate: new Date(),
    notifications: JSON.parse(localStorage.getItem('et_notifications')) || [],
    atividades: JSON.parse(localStorage.getItem('et_atividades')) || [],
    savedEssays: JSON.parse(localStorage.getItem('et_essays')) || [],
    calendarTasks: JSON.parse(localStorage.getItem('et_tasks')) || {},

    // --- 1. GRADE CURRICULAR (12 MATÉRIAS) ---
    subjects: [
        { id: 'mat', name: 'Matemática', icon: 'fa-calculator', progress: 0 },
        { id: 'por', name: 'Português', icon: 'fa-language', progress: 0 },
        { id: 'lit', name: 'Literatura', icon: 'fa-book-open', progress: 0 },
        { id: 'qui', name: 'Química', icon: 'fa-vial', progress: 0 },
        { id: 'fis', name: 'Física', icon: 'fa-atom', progress: 0 },
        { id: 'bio', name: 'Biologia', icon: 'fa-dna', progress: 0 },
        { id: 'his', name: 'História', icon: 'fa-scroll', progress: 0 },
        { id: 'geo', name: 'Geografia', icon: 'fa-earth-americas', progress: 0 },
        { id: 'fil', name: 'Filosofia', icon: 'fa-brain', progress: 0 },
        { id: 'soc', name: 'Sociologia', icon: 'fa-users', progress: 0 },
        { id: 'ing', name: 'Inglês', icon: 'fa-flag-usa', progress: 0 },
        { id: 'esp', name: 'Espanhol', icon: 'fa-flag', progress: 0 }
    ],

    // --- 2. INICIALIZAÇÃO ---
    async init() {
        if (!localStorage.getItem('token')) {
            window.location.href = 'login.html';
            return;
        }

        try {
            this.loadUserData();
            this.calculateProgress();
            this.renderSubjects();
            this.renderCalendar();
            this.renderStats();
            this.renderVestibularPDFs();
            this.renderSavedEssays();
            this.updateNotifUI();
            this.setupEventListeners();
            
            // Inicia na Dashboard
            this.showTab('inicio');
            
        } catch (e) {
            console.error("Erro no boot:", e);
        } finally {
            const loader = document.getElementById('app-loader');
            if(loader) {
                loader.style.opacity = '0';
                setTimeout(() => loader.classList.remove('active'), 500);
            }
        }
    },

    // --- 3. NAVEGAÇÃO SPA ---
    showTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        
        const target = document.getElementById(`tab-${tabId}`);
        if (target) target.classList.add('active');
        
        const btn = document.querySelector(`.nav-link[data-tab="${tabId}"]`);
        if (btn) btn.classList.add('active');

        if (tabId === 'configuracoes') this.syncAccountFields();
    },

    showSubTab(subId) {
        document.querySelectorAll('.sub-content-pane').forEach(c => c.classList.add('hidden'));
        document.querySelectorAll('.sub-link-btn').forEach(l => l.classList.remove('active'));
        document.getElementById(`sub-${subId}`).classList.remove('hidden');
        event.currentTarget.classList.add('active');
    },

    // --- 4. GESTÃO DE CONTA (PAINEL PRO) ---
    switchAccountSection(secId) {
        document.querySelectorAll('.account-section').forEach(s => s.classList.add('hidden'));
        document.querySelectorAll('.account-nav-item').forEach(i => i.classList.remove('active'));
        
        document.getElementById(`acc-${secId}`).classList.remove('hidden');
        document.querySelector(`[data-sec="${secId}"]`).classList.add('active');
    },

    loadUserData() {
        const name = localStorage.getItem('user_name') || 'Estudante';
        const photo = localStorage.getItem('user_photo') || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=FFB703&color=023047&bold=true`;
        
        // Atualiza UI Global
        document.getElementById('sidebar-user-name').innerText = name;
        document.getElementById('header-user-name').innerText = `Olá, ${name.split(' ')[0]}`;
        
        // Atualiza Fotos (Sidebar, Header e Preview de Config)
        document.getElementById('sidebar-avatar-img').src = photo;
        document.getElementById('header-avatar-img').src = photo;
        document.getElementById('config-avatar-preview').src = photo;

        // Preenche campos de input
        document.getElementById('config-name').value = name;
    },

    handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64Image = e.target.result;
                document.getElementById('config-avatar-preview').src = base64Image;
                
                // Salva no Banco/Local
                try {
                    await apiService.updateProfile(localStorage.getItem('user_id'), { photo: base64Image });
                    this.loadUserData();
                    notify("Foto de perfil atualizada!");
                } catch (err) {
                    notify("Erro ao salvar foto.", "error");
                }
            };
            reader.readAsDataURL(file);
        }
    },

    async updateProfileName() {
        const newName = document.getElementById('config-name').value;
        if(newName.length < 3) return notify("Nome muito curto!", "error");
        
        try {
            await apiService.updateProfile(localStorage.getItem('user_id'), { name: newName });
            this.loadUserData();
            notify("Nome atualizado com sucesso!");
        } catch (e) {
            notify("Erro ao atualizar nome.", "error");
        }
    },

    // Lógica de Verificação para E-mail e Senha
    verifyIdentity(type) {
        this.openModal('modalAuth');
        const confirmBtn = document.getElementById('modalAuthConfirm');
        
        confirmBtn.onclick = async () => {
            const password = document.getElementById('modalAuthPass').value;
            if(!password) return notify("Senha necessária!", "error");

            const isValid = await apiService.verifyPassword(password);
            if(isValid) {
                this.closeModal('modalAuth');
                document.getElementById('modalAuthPass').value = '';
                
                if(type === 'email') this.executeEmailUpdate(password);
                if(type === 'senha') this.executePasswordUpdate(password);
            } else {
                notify("Senha atual incorreta!", "error");
            }
        };
    },

    async executeEmailUpdate(currentPassword) {
        const newEmail = document.getElementById('config-new-email').value;
        if(!newEmail.includes('@')) return notify("E-mail inválido!", "error");

        try {
            await apiService.updateEmail(newEmail, currentPassword);
            notify("E-mail alterado com sucesso!");
            document.getElementById('config-new-email').value = '';
        } catch (e) { notify(e.message, "error"); }
    },

    async executePasswordUpdate(oldPassword) {
        const newPass = document.getElementById('config-new-pass').value;
        if(newPass.length < 6) return notify("Nova senha deve ter 6+ dígitos", "error");

        try {
            await apiService.updatePassword(oldPassword, newPass);
            notify("Senha atualizada!");
            document.getElementById('config-new-pass').value = '';
        } catch (e) { notify(e.message, "error"); }
    },

    // --- 5. CRONOGRAMA (MODAL CUSTOMIZADO) ---
    renderCalendar() {
        const grid = document.getElementById('calendar-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        document.getElementById('calendar-month-year').innerText = 
            new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(this.currentDate).toUpperCase();

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) {
            grid.innerHTML += `<div class="day-cell-elite" style="opacity: 0.1;"></div>`;
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${day}-${month}-${year}`;
            const isToday = day === new Date().getDate() && month === new Date().getMonth();
            const cell = document.createElement('div');
            cell.className = `day-cell-elite ${isToday ? 'today' : ''}`;
            
            let taskHtml = this.calendarTasks[dateKey] ? `<div class="task-indicator">${this.calendarTasks[dateKey]}</div>` : '';
            
            cell.innerHTML = `<span style="font-weight: 800; font-size: 0.8rem;">${day}</span>${taskHtml}`;
            cell.onclick = () => this.openTaskModal(day, dateKey);
            grid.appendChild(cell);
        }
    },

    openTaskModal(day, dateKey) {
        document.getElementById('modalInputTitle').innerText = `Agendar Meta: Dia ${day}`;
        document.getElementById('modalInputDesc').innerText = "O que você pretende estudar nesta data?";
        document.getElementById('modalInputValue').value = this.calendarTasks[dateKey] || '';
        
        this.openModal('modalInput');

        document.getElementById('modalInputConfirm').onclick = () => {
            const val = document.getElementById('modalInputValue').value;
            if(val) {
                this.calendarTasks[dateKey] = val;
                localStorage.setItem('et_tasks', JSON.stringify(this.calendarTasks));
                this.renderCalendar();
                notify("Meta agendada com sucesso!");
            }
            this.closeModal('modalInput');
        };
    },

    // --- 6. UTILITÁRIOS DE UI ---
    openModal(id) { document.getElementById(id).classList.add('active'); },
    closeModal(id) { document.getElementById(id).classList.remove('active'); },

    calculateProgress() {
        this.subjects.forEach(s => {
            const results = this.atividades.filter(a => a.subject === s.id);
            s.progress = results.length ? Math.round(results.reduce((acc, cur) => acc + cur.score, 0) / results.length) : 0;
        });
    },

    renderSubjects() {
        const grid = document.getElementById('disciplinas-grid');
        if(!grid) return;
        grid.innerHTML = this.subjects.map(s => `
            <div class="subject-card-premium card">
                <div class="subject-header">
                    <i class="fa-solid ${s.icon}"></i>
                    <h3>${s.name}</h3>
                </div>
                <div class="progress-box">
                    <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 6px;">
                        <span>CONQUISTADO</span>
                        <span>${s.progress}%</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-fill" style="width: ${s.progress}%"></div>
                    </div>
                </div>
                <div class="subject-actions">
                    <button class="btn btn-secondary" style="font-size: 0.75rem;">Revisar</button>
                    <button class="btn btn-primary" style="font-size: 0.75rem;">Praticar</button>
                </div>
            </div>
        `).join('');
    },

    renderStats() {
        const stats = [
            { label: "Domínio Geral", val: `${Math.round(this.subjects.reduce((a,b)=>a+b.progress,0)/12)}%`, icon: "fa-chart-line" },
            { label: "Atividades", val: this.atividades.length, icon: "fa-circle-check" },
            { label: "Redações", val: this.savedEssays.length, icon: "fa-pen-nib" }
        ];
        const container = document.getElementById('stats-overview');
        if(container) container.innerHTML = stats.map(s => `
            <div class="card" style="display: flex; align-items: center; gap: 18px; padding: 20px;">
                <div style="background: var(--bg-app); width: 55px; height: 55px; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: var(--primary);">
                    <i class="fa-solid ${s.icon} fa-xl"></i>
                </div>
                <div>
                    <p style="color: var(--text-muted); font-size: 0.75rem; font-weight: 800; text-transform: uppercase;">${s.label}</p>
                    <h3 class="font-head" style="font-size: 1.6rem; margin-top: -4px;">${s.val}</h3>
                </div>
            </div>
        `).join('');
    },

    // --- LISTENERS ---
    setupEventListeners() {
        document.querySelectorAll('.nav-link[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => this.showTab(btn.getAttribute('data-tab')));
        });
        document.getElementById('sidebar-profile-click').onclick = () => this.showTab('configuracoes');
        document.getElementById('header-profile-click').onclick = () => this.showTab('configuracoes');
    },

    toggleNotifDropdown() {
        const d = document.getElementById('notifDropdown');
        d.style.display = d.style.display === 'none' ? 'block' : 'none';
        document.getElementById('notif-dot').classList.add('hidden');
    },

    changeMonth(step) {
        this.currentDate.setMonth(this.currentDate.getMonth() + step);
        this.renderCalendar();
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());