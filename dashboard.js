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
        { id: 'soc', name: 'Sociologia', icon: 'fa-users', progress: 0 },
        { id: 'ing', name: 'Inglês', icon: 'fa-flag-usa', progress: 0 },
        { id: 'esp', name: 'Espanhol', icon: 'fa-comment-dots', progress: 0 },
        { id: 'art', name: 'Arte', icon: 'fa-palette', progress: 0 },
        { id: 'edf', name: 'Ed. Física', icon: 'fa-person-running', progress: 0 }
    ],
    
    // --- 2. INICIALIZAÇÃO DO SISTEMA ---
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
            this.renderExams(); 
            this.renderSavedEssays();
            this.setupEventListeners();
            this.renderNota1000();
            
            this.showTab('inicio');
        } catch (e) {
            console.error("Erro no boot do sistema:", e);
        } finally {
            // REMOVE O LOADER COMPLETAMENTE PARA LIBERAR CLIQUES
            const loader = document.getElementById('app-loader');
            if(loader) {
                loader.style.opacity = '0';
                setTimeout(() => {
                    loader.style.display = 'none';
                    loader.classList.remove('active');
                }, 500);
            }
        }
    },

    // --- 3. NAVEGAÇÃO SPA (SINGLE PAGE APPLICATION) ---
    showTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        
        const target = document.getElementById(`tab-${tabId}`);
        if (target) target.classList.add('active');
        
        const btn = document.querySelector(`.nav-link[data-tab="${tabId}"]`);
        if (btn) btn.classList.add('active');

        if (tabId === 'configuracoes') this.syncAccountFields();
    },

    showSubTab(event, subId) {
        document.querySelectorAll('.sub-content-pane').forEach(c => c.classList.add('hidden'));
        document.querySelectorAll('.sub-link-btn').forEach(l => l.classList.remove('active'));
        
        const pane = document.getElementById(`sub-${subId}`);
        if(pane) pane.classList.remove('hidden');
        
        if(event && event.currentTarget) {
            event.currentTarget.classList.add('active');
        }
    },

    // --- 4. GESTÃO DE CONTA E SEGURANÇA ---
    switchAccountSection(secId) {
        document.querySelectorAll('.account-section').forEach(s => s.classList.add('hidden'));
        document.querySelectorAll('.account-nav-item').forEach(i => i.classList.remove('active'));
        
        document.getElementById(`acc-${secId}`).classList.remove('hidden');
        document.querySelector(`[data-sec="${secId}"]`).classList.add('active');
    },

    syncAccountFields() {
        document.getElementById('current-email-display').innerText = localStorage.getItem('user_email');
        this.loadUserData();
    },

    loadUserData() {
        const name = localStorage.getItem('user_name') || 'Estudante';
        const photo = localStorage.getItem('user_photo') || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=FFB703&color=023047&bold=true`;
        
        // Atualiza elementos de imagem
        document.getElementById('sidebar-avatar-img').src = photo;
        document.getElementById('header-avatar-img').src = photo;
        document.getElementById('config-avatar-preview').src = photo;

        // Atualiza textos
        document.getElementById('sidebar-user-name').innerText = name;
        document.getElementById('header-user-name').innerText = `Olá, ${name.split(' ')[0]}`;
        document.getElementById('config-name').value = name;
    },

    handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64 = e.target.result;
                // Preview instantâneo
                document.getElementById('config-avatar-preview').src = base64;
                
                try {
                    await apiService.updateProfile(localStorage.getItem('user_id'), { photo: base64 });
                    localStorage.setItem('user_photo', base64);
                    this.loadUserData();
                    notify("Foto de perfil atualizada!");
                } catch(err) {
                    notify("Erro ao salvar foto no servidor.", "error");
                }
            };
            reader.readAsDataURL(file);
        }
    },

    async updateProfileName() {
        const name = document.getElementById('config-name').value;
        if(name.length < 3) return notify("Nome muito curto!", "error");
        
        try {
            await apiService.updateProfile(localStorage.getItem('user_id'), { name });
            localStorage.setItem('user_name', name);
            this.loadUserData();
            notify("Perfil atualizado!");
        } catch(e) {
            notify("Erro ao atualizar nome.", "error");
        }
    },

    // Verificação de Identidade para trocas críticas
    verifyIdentity(type) {
        this.openModal('modalAuth');
        const confirmBtn = document.getElementById('modalAuthConfirm');
        
        confirmBtn.onclick = async () => {
            const pass = document.getElementById('modalAuthPass').value;
            if(!pass) return notify("Senha necessária!", "error");

            const isValid = await apiService.verifyPassword(pass);
            if(isValid) {
                this.closeModal('modalAuth');
                document.getElementById('modalAuthPass').value = '';
                
                if(type === 'email') this.executeEmailUpdate(pass);
                if(type === 'senha') this.executePasswordUpdate(pass);
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
            this.syncAccountFields();
            document.getElementById('config-new-email').value = '';
        } catch (e) { notify(e.message, "error"); }
    },

    async executePasswordUpdate(oldPassword) {
        const newPass = document.getElementById('config-new-pass').value;
        if(newPass.length < 6) return notify("Nova senha deve ter 6+ caracteres", "error");

        try {
            await apiService.updatePassword(oldPassword, newPass);
            notify("Senha atualizada com sucesso!");
            document.getElementById('config-new-pass').value = '';
        } catch (e) { notify(e.message, "error"); }
    },

    // --- 5. CRONOGRAMA INTELIGENTE (MODAL CUSTOMIZADO) ---
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

        // Dias vazios
        for (let i = 0; i < firstDay; i++) {
            grid.innerHTML += `<div class="day-cell-elite" style="opacity: 0.1;"></div>`;
        }

        // Dias do mês
        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${day}-${month}-${year}`;
            const isToday = day === new Date().getDate() && month === new Date().getMonth();
            const cell = document.createElement('div');
            cell.className = `day-cell-elite ${isToday ? 'today' : ''}`;
            
            let taskHtml = this.calendarTasks[dateKey] ? `<div class="task-indicator">${this.calendarTasks[dateKey]}</div>` : '';
            
            cell.innerHTML = `<span>${day}</span>${taskHtml}`;
            cell.onclick = () => this.openTaskModal(day, dateKey);
            grid.appendChild(cell);
        }
    },

    openTaskModal(day, dateKey) {
        document.getElementById('modalInputTitle').innerText = `Agendar Meta - Dia ${day}`;
        document.getElementById('modalInputDesc').innerText = "O que você pretende estudar hoje?";
        document.getElementById('modalInputValue').value = this.calendarTasks[dateKey] || '';
        
        this.openModal('modalInput');

        document.getElementById('modalInputConfirm').onclick = () => {
            const val = document.getElementById('modalInputValue').value;
            this.calendarTasks[dateKey] = val; // Se vazio, remove a tarefa
            localStorage.setItem('et_tasks', JSON.stringify(this.calendarTasks));
            this.renderCalendar();
            this.closeModal('modalInput');
            notify("Cronograma atualizado!");
        };
    },

    // --- 6. UTILITÁRIOS DE INTERFACE ---
    openModal(id) {
        const m = document.getElementById(id);
        m.style.display = 'flex';
        setTimeout(() => m.classList.add('active'), 10);
    },

    closeModal(id) {
        const m = document.getElementById(id);
        m.classList.remove('active');
        setTimeout(() => m.style.display = 'none', 300);
    },

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
            <!-- Adicionamos o onclick no card inteiro e mudamos o cursor para a mãozinha -->
            <div class="subject-card-premium card" onclick="App.openSubjectTrail('${s.id}')" style="cursor: pointer;">
                
                <!-- Cabeçalho com o nome e a setinha indicativa -->
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div class="subject-header">
                        <i class="fa-solid ${s.icon}"></i>
                        <h3>${s.name}</h3>
                    </div>
                    
                    <div class="card-arrow-icon" style="width: 35px; height: 35px; border-radius: 12px; background: #F1F5F9; display: flex; align-items: center; justify-content: center; color: var(--text-muted); transition: 0.3s;">
                        <i class="fa-solid fa-arrow-right" style="font-size: 0.85rem;"></i>
                    </div>
                </div>

                <!-- Barra de Progresso (Domínio) -->
                <div class="progress-box" style="margin-top: 25px;">
                    <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 6px;">
                        <span>DOMÍNIO</span>
                        <span>${s.progress}%</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-fill" style="width: ${s.progress}%"></div>
                    </div>
                </div>

            </div>
        `).join('');
    },

    renderStats() {
        const stats = [
            { label: "Média Global", val: `${Math.round(this.subjects.reduce((a,b)=>a+b.progress,0)/12)}%`, icon: "fa-chart-line" },
            { label: "Simulados", val: this.atividades.length, icon: "fa-circle-check" },
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

        // --- ATUALIZA A META DE HOJE NO DASHBOARD ---
        const today = new Date();
        const todayKey = `${today.getDate()}-${today.getMonth()}-${today.getFullYear()}`;
        const todayTask = this.calendarTasks[todayKey];
        
        const taskEl = document.getElementById('home-today-task');
        if(taskEl) {
            taskEl.innerHTML = todayTask 
                ? `<i class="fa-solid fa-thumbtack" style="color: var(--accent); margin-right: 8px;"></i> ${todayTask}` 
                : `Você não tem metas agendadas. Vá ao <a href="javascript:void(0)" onclick="App.showTab('agenda')" style="color: var(--accent); font-weight: 800;">Cronograma</a> ou use a IA.`;
        }
    },

    // --- 7. LISTENERS ---
    setupEventListeners() {
        document.querySelectorAll('.nav-link[data-tab]').forEach(btn => {
            btn.onclick = () => this.showTab(btn.getAttribute('data-tab'));
        });
        
        const editor = document.getElementById('essay-editor');
        if(editor) {
            editor.oninput = (e) => {
                document.getElementById('char-count').innerText = `${e.target.value.length} caracteres`;
            };
        }
    },

    changeMonth(step) {
        this.currentDate.setMonth(this.currentDate.getMonth() + step);
        this.renderCalendar();
    },

    toggleNotifDropdown() {
        const d = document.getElementById('notifDropdown');
        d.style.display = d.style.display === 'none' ? 'block' : 'none';
        document.getElementById('notif-dot').classList.add('hidden');
    },
// --- 8. SISTEMA DE TRILHAS (PÁGINA DEDICADA ESTILO YOUTUBE) ---
    currentActiveSubject: '',
    
 trailData: {
        por: { 
            color: '#10B981',
            anos: {
                1: [
                    { title: "Linguagem e Comunicação", desc: "Língua oral e escrita, funções da linguagem e variedades linguísticas." },
                    { title: "Morfologia e Formação", desc: "Revisão das classes de palavras, estrutura e formação das palavras." },
                    { title: "Semântica", desc: "Ambiguidade, sinonímia, antonímia, homônimos, parônimos e polissemia. Denotação e conotação." },
                    { title: "Texto e Contexto", desc: "Coesão, coerência, gêneros orais e produção textual (relato, crônica, conto, notícia)." }
                ],
                2: [
                    { title: "Sintaxe e Comunicação", desc: "Relações morfossintáticas, sentido da linguagem e elementos essenciais da comunicação." },
                    { title: "Regras e Estruturas", desc: "Pontuação, concordância nominal e verbal, e as regras de uso da crase." },
                    { title: "Prática de Escrita", desc: "Produção de resumo, relato, artigo de opinião e resenha crítica." },
                    { title: "Gêneros Orais e Análise", desc: "Debates e discussões argumentativas a partir do cinema nacional." }
                ], 
                3: [
                    { title: "Gêneros Técnico-Científicos", desc: "Resumo, resenha, manual, artigo e relatório técnico (Foco em T.I. e Projeto Integrador)." },
                    { title: "Gramática Aplicada", desc: "Regência verbal, concordância, formação de palavras, colocação pronominal e crase." },
                    { title: "Texto Dissertativo-Argumentativo", desc: "Análise, leitura e produção de textos acadêmicos e para vestibulares." }
                ]
            },
            videos: [
                { title: "Prof. Noslen - Funções da Linguagem", time: "15 min", url: "https://www.youtube.com/embed/ScMzIvxBSi4" },
                { title: "Prof. Noslen - Coesão e Coerência", time: "22 min", url: "https://www.youtube.com/embed/ScMzIvxBSi4" }
            ]
        },
        lit: { 
            color: '#8B5CF6',
            anos: {
                1: [
                    { title: "Introdução à Literatura", desc: "Os gêneros literários: lírico, narrativo e dramático. Figuras de linguagem e estilo." },
                    { title: "Trovadorismo e Humanismo", desc: "A literatura medieval, as cantigas e a transição para o Renascimento." },
                    { title: "Classicismo", desc: "A estética renascentista e os ideais de equilíbrio e razão." },
                    { title: "Quinhentismo Brasileiro", desc: "A literatura de informação e os primeiros registros das terras brasileiras." }
                ],
                2: [
                    { title: "Barroco e Arcadismo", desc: "A estética dos contrastes, o conceptismo e a busca pela simplicidade bucólica." },
                    { title: "Romantismo a Naturalismo", desc: "O sentimentalismo romântico, a objetividade realista e as teses naturalistas." },
                    { title: "Parnasianismo e Simbolismo", desc: "A arte pela arte, a estética do mistério, da musicalidade e da sugestão." }
                ], 
                3: [
                    { title: "Pré-Modernismo", desc: "O período de transição, denúncia social e a busca pela verdadeira identidade do Brasil." },
                    { title: "Modernismo Brasileiro", desc: "A ruptura estética, a Semana de 22 e a consolidação da poesia e prosa modernas." },
                    { title: "Tendências Contemporâneas", desc: "As inovações na poesia e na prosa da literatura atual e o cinema nacional." }
                ]
            },
            videos: [
                { title: "Prof. Noslen - Escolas Literárias", time: "12 min", url: "https://www.youtube.com/embed/ScMzIvxBSi4" }
            ]
        },
        mat: { 
            color: '#F59E0B',
            anos: {
                1: [
                    { title: "Conjuntos e Funções Afim/Quadrática", desc: "Teoria de Conjuntos e estudo aprofundado das funções polinomiais." },
                    { title: "Exponencial e Logaritmo", desc: "Compreensão de crescimento exponencial, logaritmos e suas funções." },
                    { title: "Matemática Financeira e Estatística", desc: "Gráficos, tabelas, medidas de tendência central e noções financeiras." },
                    { title: "Matrizes e Sistemas Lineares", desc: "Operações com matrizes, cálculo de determinantes e resolução de sistemas." }
                ],
                2: [
                    { title: "Progressões Matemáticas", desc: "Sequências numéricas, Progressão Aritmética (PA) e Progressão Geométrica (PG)." },
                    { title: "Trigonometria Plana", desc: "Teorema de Tales, Pitágoras e relações trigonométricas em triângulos quaisquer." },
                    { title: "Trigonometria Circular", desc: "O ciclo trigonométrico e o estudo gráfico das Funções Trigonométricas." },
                    { title: "Geometria e Combinatória", desc: "Área de figuras planas, poliedros, corpos redondos e introdução à Análise Combinatória." }
                ], 
                3: [
                    { title: "Geometria Analítica", desc: "Estudo do ponto, retas, circunferência e suas equações no plano cartesiano." },
                    { title: "Números Complexos", desc: "O conjunto dos números imaginários, operações e formas algébrica/trigonométrica." },
                    { title: "Polinômios e Equações Polinomiais", desc: "Operações com polinômios e métodos de resolução de equações de grau superior." }
                ]
            },
            videos: [
                { title: "Gis com Giz - Função Afim", time: "20 min", url: "https://www.youtube.com/embed/ScMzIvxBSi4" },
                { title: "Sandro Curió - Macetes de Trigonometria", time: "18 min", url: "https://www.youtube.com/embed/ScMzIvxBSi4" },
                { title: "Prof. Ferretto - Matemática Básica", time: "25 min", url: "https://www.youtube.com/embed/ScMzIvxBSi4" }
            ]
        },
        fis: { 
            color: '#6366F1',
            anos: {
                1: [
                    { title: "Axiomas de Newton", desc: "Leis fundamentais do movimento e a dinâmica do movimento (Modelagem)." },
                    { title: "Leis de Conservação", desc: "Conservação da quantidade de movimento e da energia mecânica." },
                    { title: "Conceitos Básicos de Astronomia", desc: "Compreensão dos fenômenos celestes e da mecânica celeste." }
                ],
                2: [
                    { title: "Termologia e Calorimetria", desc: "Estudo das escalas termométricas, dilatação, calor sensível e calor latente." },
                    { title: "Termodinâmica", desc: "As leis da termodinâmica, máquinas térmicas e o estudo das transformações gasosas." },
                    { title: "Óptica Geométrica", desc: "Princípios de propagação da luz, reflexão, espelhos, refração e lentes." },
                    { title: "Ondulatória e Acústica", desc: "Natureza das ondas, fenômenos ondulatórios e as qualidades fisiológicas do som." }
                ], 
                3: [
                    { title: "Eletrostática e Potencial", desc: "Carga elétrica, força de Coulomb, campo eletromagnético e potencial elétrico." },
                    { title: "Eletrodinâmica e Eletromagnetismo", desc: "Elementos de circuitos elétricos, leis de Ampère e Faraday e suas aplicações." },
                    { title: "Física Moderna", desc: "Introdução aos princípios revolucionários da física no século XX." }
                ]
            },
            videos: [
                { title: "Física - Leis de Newton na Prática", time: "16 min", url: "https://www.youtube.com/embed/ScMzIvxBSi4" }
            ]
        },
        qui: { 
            color: '#EC4899',
            anos: {
                1: [
                    { title: "Estrutura Atômica e Tabela Periódica", desc: "Modelos atômicos, organização e propriedades dos elementos." },
                    { title: "Ligações e Funções Inorgânicas", desc: "Propriedades da matéria, ácidos, bases, sais e óxidos." },
                    { title: "Reações e Estequiometria", desc: "Tipos de reações químicas e cálculo estequiométrico." }
                ],
                2: [
                    { title: "Físico-Química I: Soluções e Gases", desc: "Estudo de misturas, unidades de concentração e o comportamento dos gases." },
                    { title: "Físico-Química II: Propriedades e Calor", desc: "Efeitos coligativos das soluções e os processos da Termoquímica." },
                    { title: "Cinética e Equilíbrio Químico", desc: "Velocidade das reações químicas, fatores de influência e deslocamento de equilíbrio." },
                    { title: "Eletroquímica", desc: "Estudo das pilhas, baterias, processos de oxirredução e eletrólise." }
                ], 
                3: [
                    { title: "Introdução à Química Orgânica", desc: "O estudo do carbono e as principais Funções Orgânicas." },
                    { title: "Isomeria e Reações Orgânicas", desc: "Propriedades físicas/químicas, polímeros e mecanismos das reações orgânicas." },
                    { title: "Radioatividade", desc: "Decaimento radioativo, tempo de meia-vida, fissão e fusão nuclear." }
                ]
            },
            videos: [
                { title: "Química: Cálculo Estequiométrico", time: "28 min", url: "https://www.youtube.com/embed/ScMzIvxBSi4" }
            ]
        },
        bio: { 
            color: '#14B8A6',
            anos: {
                1: [
                    { title: "Origem da Vida e Citologia", desc: "Características dos seres vivos, membranas, citoplasma e organelas." },
                    { title: "Núcleo e Divisão Celular", desc: "Metabolismo celular, mitose e meiose." },
                    { title: "Reprodução, Embriologia e Histologia", desc: "Desenvolvimento embrionário e tecidos (Integrado à Fisiologia)." }
                ],
                2: [
                    { title: "Taxonomia e Vírus", desc: "Regras de classificação, nomenclatura dos seres vivos e estudo dos seres acelulares." },
                    { title: "Reinos Monera, Protista e Fungi", desc: "Anatomia e fisiologia de bactérias, protozoários, algas e fungos." },
                    { title: "Reino Plantae e Animalia", desc: "Botânica e Zoologia comparada: características anatômicas, fisiológicas e reprodutivas." }
                ], 
                3: [
                    { title: "Genética", desc: "Leis de Mendel, padrões de herança, interação gênica, alterações e Biotecnologia." },
                    { title: "Evolução Biológica", desc: "Teorias evolutivas, evidências, fatores evolutivos, variabilidade e especiação." },
                    { title: "Ecologia Aplicada", desc: "Dinâmica de energia/matéria, ecossistemas, impactos ambientais e sustentabilidade." }
                ]
            },
            videos: [
                { title: "Prof. Jubilut - Leis de Mendel", time: "15 min", url: "https://www.youtube.com/embed/ScMzIvxBSi4" },
                { title: "Prof. Jubilut - Ecologia no ENEM", time: "19 min", url: "https://www.youtube.com/embed/ScMzIvxBSi4" }
            ]
        },
        soc: { 
            color: '#F43F5E',
            anos: {
                1: [
                    { title: "Conhecimento e Humanização", desc: "O conhecimento como produto humano, cultura e origem da ciência sociológica." },
                    { title: "A Sociologia Clássica", desc: "Émile Durkheim e o Fato Social; Max Weber, a ação social e as origens do capitalismo." }
                ],
                2: [
                    { title: "O Pensamento de Karl Marx", desc: "Alienação, salário, lucro, mais-valia e o materialismo histórico." },
                    { title: "Sociologia, Socialismo e Antropologia", desc: "As contribuições do marxismo e do Estruturalismo para o estudo da sociedade." },
                    { title: "Globalização e Estado Moderno", desc: "A informática na sociedade atual, exclusão, formação do Estado e democracia no Brasil." }
                ], 
                3: []
            },
            videos: [
                { title: "Parabólica - Max Weber e Durkheim", time: "20 min", url: "https://www.youtube.com/embed/ScMzIvxBSi4" },
                { title: "Ifsophia - Filosofia e Ciência", time: "14 min", url: "https://www.youtube.com/embed/ScMzIvxBSi4" },
                { title: "Gabbie Fadel - Dicas de Foco", time: "10 min", url: "https://www.youtube.com/embed/ScMzIvxBSi4" }
            ]
        },
        his: { 
            color: '#EAB308',
            anos: {
                1: [
                    { title: "O Estudo da História", desc: "Análise de processos políticos, econômicos e socioambientais no tempo." },
                    { title: "Pluralidade e Fontes", desc: "Procedimentos epistemológicos, científicos e posicionamento crítico perante as fontes." }
                ],
                2: [
                    { title: "A Idade Moderna", desc: "Dimensões econômicas, culturais, políticas e religiosas da Modernidade." },
                    { title: "Brasil Colônia e Império", desc: "A estrutura de trabalho, tecnologia, cultura indígena e afro-brasileira." },
                    { title: "O Estado Moderno", desc: "A formação das nações modernas e os teóricos contratualistas." }
                ], 
                3: [
                    { title: "A Idade Contemporânea", desc: "Dimensões econômicas, culturais, políticas e religiosas da era Contemporânea." },
                    { title: "Brasil Republicano", desc: "Trabalho, tecnologia e a evolução da história da informática no Brasil." },
                    { title: "Diversidade e Migrações", desc: "História e cultura afro e indígena na república, dinâmicas migratórias e desenvolvimento." }
                ]
            },
            videos: [
                { title: "Canal Nostalgia - Era Vargas", time: "40 min", url: "https://www.youtube.com/embed/ScMzIvxBSi4" },
                { title: "Plano Piloto - Resumo Colônia", time: "15 min", url: "https://www.youtube.com/embed/ScMzIvxBSi4" },
                { title: "Brasão de Armas - Império", time: "22 min", url: "https://www.youtube.com/embed/ScMzIvxBSi4" }
            ]
        },
        geo: { 
            color: '#0EA5E9',
            anos: {
                1: [
                    { title: "Abordagem e Cartografia", desc: "A ótica geográfica moderna e o uso de geotecnologias." },
                    { title: "O Planeta Terra e o Clima", desc: "Evolução da Terra, clima, mudanças climáticas, vegetação e biomas brasileiros." }
                ],
                2: [
                    { title: "Recursos Naturais e Energéticos", desc: "Minérios, fontes alternativas, matriz energética e recursos hídricos." },
                    { title: "Geopolítica e Globalização", desc: "A Nova Ordem Mundial, blocos econômicos, terrorismo e conflitos de tensão." },
                    { title: "Demografia, Urbanização e Campo", desc: "Dinâmicas populacionais, migrações, agronegócio e impactos ambientais no Brasil e no mundo." }
                ], 
                3: []
            },
            videos: [
                { title: "DGP Mundo - Geopolítica e Conflitos", time: "18 min", url: "https://www.youtube.com/embed/ScMzIvxBSi4" },
                { title: "Tinocando TV - Cartografia e Mapas", time: "20 min", url: "https://www.youtube.com/embed/ScMzIvxBSi4" }
            ]
        },
        ing: { 
            color: '#F97316',
            anos: {
                1: [
                    { title: "Interpretação e Tradução", desc: "Leitura de gêneros textuais diversos e uso contextual de vocabulário." },
                    { title: "Tempos Verbais Básicos", desc: "Uso do Presente Simples e Presente Contínuo." },
                    { title: "Modal Verbs e Advérbios", desc: "Emprego de can, may, must e uso dos advérbios." }
                ],
                2: [], 3: []
            },
            videos: [
                { title: "Estratégias de Leitura em Inglês", time: "15 min", url: "https://www.youtube.com/embed/ScMzIvxBSi4" }
            ]
        },
        esp: { 
            color: '#F43F5E',
            anos: {
                1: [], 2: [], 
                3: [
                    { title: "Introdução à Cultura Hispânica", desc: "A língua espanhola no mundo, países hispanofalantes e o fenômeno do Portunhol." },
                    { title: "Vocabulário do Cotidiano", desc: "Saudações, o alfabeto, cores, família, partes da casa, cidade, corpo e profissões." },
                    { title: "Estruturas Morfossintáticas I", desc: "Pronomes pessoais, artigos definidos e indefinidos, artigo neutro 'lo' e contrações." },
                    { title: "Estruturas Morfossintáticas II e Textos", desc: "Verbos 'ser' e 'estar', verbos regulares, apócope, numerais e interpretação de textos." }
                ]
            },
            videos: [
                { title: "Espanhol para o ENEM: O Básico", time: "18 min", url: "https://www.youtube.com/embed/ScMzIvxBSi4" }
            ]
        },
        art: { 
            color: '#D946EF',
            anos: {
                1: [
                    { title: "Conceito e Elementos da Arte", desc: "O papel da arte na formação humana e os elementos estruturais." },
                    { title: "Manifestações Artísticas", desc: "Música, artes visuais, teatro, dança e apreciação histórica." },
                    { title: "Arte Nacional e Raízes", desc: "Arte brasileira e o estudo aprofundado da cultura afro-brasileira e indígena." }
                ],
                2: [], 3: []
            },
            videos: [
                { title: "História da Arte Resumida", time: "25 min", url: "https://www.youtube.com/embed/ScMzIvxBSi4" }
            ]
        },
        edf: { 
            color: '#059669',
            anos: {
                1: [
                    { title: "Práticas Corporais", desc: "Esporte, jogos, dança, lutas e ginásticas no contexto escolar." },
                    { title: "Fisiologia e Anatomia", desc: "Noções básicas de anatomia humana, educação postural e segurança." }
                ],
                2: [], 3: []
            },
            videos: [
                { title: "Anatomia Básica Aplicada", time: "15 min", url: "https://www.youtube.com/embed/ScMzIvxBSi4" }
            ]
        }
    },
    getSubjectTrail(subjectId) {
        const subject = this.subjects.find(s => s.id === subjectId);
        if (this.trailData[subjectId]) {
            return { ...this.trailData[subjectId], title: subject.name, icon: subject.icon };
        }
        // Se a matéria não tiver dados cadastrados, gera genérico:
        return {
            title: subject.name,
            icon: subject.icon,
            color: '#219EBC',
            anos: {
                1: [{ title: `Fundamentos de ${subject.name}`, desc: 'Conceitos base e nivelamento 1º Ano.' }],
                2: [{ title: `${subject.name} Intermediário`, desc: 'Aprofundamento focado no 2º Ano.' }],
                3: [{ title: `${subject.name} Avançado`, desc: 'Revisão intensiva focada no ENEM.' }]
            },
            videos: [
                { title: `Introdução a ${subject.name}`, time: "20 min" },
                { title: "Dicas de Estudo e Foco", time: "15 min" }
            ]
        };
    },

    // A mágica acontece aqui: ao invés de Modal, abrimos a Tab Trilha!
  openSubjectTrail(subjectId) {
        this.currentActiveSubject = subjectId;
        const data = this.getSubjectTrail(subjectId);
        
        document.getElementById('trilha-title').innerText = data.title;
        document.getElementById('trilha-header-icon').innerHTML = `<i class="fa-solid ${data.icon}"></i>`;
        document.getElementById('trilha-header-icon').style.background = data.color;

        const sidebar = document.getElementById('trilha-sidebar-links');
        sidebar.innerHTML = data.videos.map(v => `
            <!-- AGORA PASSAMOS A URL DO VÍDEO NO CLIQUE -->
            <div style="display: flex; gap: 12px; align-items: center; cursor: pointer; padding: 10px; border-radius: 12px; transition: 0.2s;" onmouseover="this.style.background='#F1F5F9'" onmouseout="this.style.background='transparent'" onclick="App.openVideoLesson('${v.title}', 'Aula recomendada de revisão.', '${v.url}')">
                <div style="width: 50px; height: 35px; background: #E2E8F0; border-radius: 6px; display: flex; align-items: center; justify-content: center; position: relative;">
                    <i class="fa-solid fa-play" style="color: var(--secondary); font-size: 0.8rem;"></i>
                    <span style="position: absolute; bottom: -5px; right: -5px; background: #000; color: white; font-size: 0.55rem; padding: 2px 4px; border-radius: 4px; font-weight: 800;">${v.time}</span>
                </div>
                <div style="flex: 1;">
                    <h5 style="margin: 0; font-size: 0.85rem; color: var(--secondary); font-family: 'Inter', sans-serif;">${v.title}</h5>
                </div>
            </div>
        `).join('');

        this.loadTrilhaYear(1);
        this.showTab('trilha');
    },

    loadTrilhaYear(year) {
        for(let i=1; i<=3; i++) {
            const btn = document.getElementById(`trilha-ano-${i}`);
            if(i === year) {
                btn.style.background = 'white';
                btn.style.color = 'var(--secondary)';
                btn.style.boxShadow = 'var(--shadow-sm)';
                btn.classList.add('active');
            } else {
                btn.style.background = 'transparent';
                btn.style.color = 'var(--text-muted)';
                btn.style.boxShadow = 'none';
                btn.classList.remove('active');
            }
        }

        const data = this.getSubjectTrail(this.currentActiveSubject);
        const topics = data.anos[year];
        const listContainer = document.getElementById('trilha-content-list');
        listContainer.innerHTML = ''; 

        if(topics && topics.length > 0) {
            topics.forEach(topic => {
                // Se o tópico não tiver vídeo específico, usa um genérico do canal principal
                const videoUrl = topic.url || (data.videos[0] ? data.videos[0].url : "https://www.youtube.com/embed/ScMzIvxBSi4");

                listContainer.innerHTML += `
                    <div class="card" style="display: flex; justify-content: space-between; align-items: center; padding: 25px; transition: 0.3s; border-left: 4px solid ${data.color};">
                        <div style="flex: 1; padding-right: 20px;">
                            <h4 style="margin: 0 0 8px 0; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 1.2rem; color: var(--secondary); font-weight: 800;">${topic.title}</h4>
                            <p style="margin: 0; font-size: 0.95rem; color: var(--text-body); line-height: 1.5;">${topic.desc}</p>
                        </div>
                        <div style="display: flex; gap: 12px;">
                            <!-- O BOTÃO DE REVISAR AGORA CHAMA O VÍDEO CERTO -->
                            <button class="btn btn-secondary" style="padding: 12px 20px;" onclick="App.openVideoLesson('${topic.title}', '${topic.desc}', '${videoUrl}')">
                                <i class="fa-solid fa-play"></i> Revisar
                            </button>
                            <button class="btn btn-primary" style="padding: 12px 20px; background: ${data.color}; box-shadow: none;" onclick="App.startPractice('${topic.title}')">
                                <i class="fa-solid fa-pen"></i> Praticar
                            </button>
                        </div>
                    </div>
                `;
            });
        } else {
            listContainer.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted); font-weight: 600;">Conteúdo em desenvolvimento para esta série.</div>`;
        }
    },

    // AGORA ESSA FUNÇÃO RECEBE A URL COMO PARÂMETRO
    openVideoLesson(title, desc, url) {
        document.getElementById('rev-title').innerText = title;
        document.getElementById('rev-desc').innerText = "Resumo: " + desc;
        
        // Se a URL não for passada, usa um vídeo de backup
        const finalUrl = url || "https://www.youtube.com/embed/ScMzIvxBSi4";
        document.getElementById('rev-video').src = finalUrl; 
        
        this.openModal('revisionModal');
    },

    // --- BANCO DE QUESTÕES DO QUIZ ---
    quizData: {
        mat: [
            { q: "Qual é o valor de x na equação 2x + 4 = 10?", options: ["x = 2", "x = 3", "x = 4", "x = 5"], answer: 1 }, // Resposta: índice 1 (x=3)
            { q: "Se a função f(x) = 3x - 1, qual o valor de f(2)?", options: ["4", "5", "6", "7"], answer: 1 },
            { q: "Em um triângulo retângulo, se os catetos medem 3 e 4, a hipotenusa mede:", options: ["5", "6", "7", "8"], answer: 0 }
        ],
        por: [
            { q: "Qual das palavras abaixo é classificada como paroxítona?", options: ["Café", "Lâmpada", "Mesa", "Computador"], answer: 2 },
            { q: "Na frase 'Ele correu muito rápido', a palavra 'rápido' exerce função de:", options: ["Adjetivo", "Advérbio", "Substantivo", "Pronome"], answer: 1 },
            { q: "Qual figura de linguagem atribui sentimentos humanos a seres irracionais?", options: ["Metáfora", "Pleonasmo", "Prosopopeia", "Hipérbole"], answer: 2 }
        ],
        // Mock genérico caso a matéria ainda não tenha questões cadastradas
        default: [
            { q: "Qual é a principal característica da abordagem deste tema no ENEM?", options: ["É irrelevante para a prova.", "Exige forte compreensão interdisciplinar.", "Foi descartado do currículo do MEC.", "Cai apenas em provas dissertativas."], answer: 1 },
            { q: "Marque a alternativa correta sobre a evolução destes conceitos:", options: ["Eles são dogmas imutáveis.", "Adaptam-se conforme o contexto histórico e científico.", "Eles não possuem base teórica válida.", "Todas as teorias anteriores foram apagadas."], answer: 1 },
            { q: "Ao treinar este tópico para vestibulares, o aluno deve focar em:", options: ["Decorar fórmulas sem aplicação.", "Entender a lógica e resolver problemas práticos.", "Ignorar a teoria e chutar.", "Ler o resumo apenas na véspera da prova."], answer: 1 }
        ]
    },
    
    currentQuiz: { subject: '', questions: [], currentIndex: 0, score: 0, selectedOption: null },

    async startPractice(title) {
        const subjectId = this.currentActiveSubject; 
        const subjectObj = this.subjects.find(s => s.id === subjectId);
        
        // Atualiza a tela
        document.getElementById('quiz-header-title').innerText = `Treinamento: ${subjectObj.name}`;
        document.getElementById('quiz-header-desc').innerText = `Foco: ${title}`;
        document.getElementById('quiz-empty-state').style.display = 'none';
        
        const container = document.getElementById('quiz-container');
        container.classList.remove('hidden');
        
        // 1. TELA DE CARREGAMENTO (A IA ESTÁ PENSANDO...)
        document.getElementById('quiz-progress-text').style.display = 'none';
        document.getElementById('quiz-score-text').style.display = 'none';
        document.getElementById('quiz-options').style.display = 'none';
        document.getElementById('quiz-submit-btn').style.display = 'none';
        
        document.getElementById('quiz-question-text').innerHTML = `
            <div style="text-align: center; color: var(--primary); padding: 40px;">
                <i class="fa-solid fa-microchip fa-spin fa-3x" style="margin-bottom: 20px;"></i>
                <h3 style="color: var(--secondary);">A Inteligência Artificial está montando seu simulado...</h3>
                <p style="color: var(--text-muted);">Buscando questões sobre ${title}</p>
            </div>
        `;

        this.showTab('atividades');

        try {
            // 2. PEDE AS QUESTÕES PRA IA
            const aiQuestions = await apiService.generateAIQuiz(title);
            
            // 3. INICIA O QUIZ COM AS QUESTÕES REAIS DA IA
            this.currentQuiz = { subject: subjectId, questions: aiQuestions, currentIndex: 0, score: 0, selectedOption: null };
            this.renderQuestion();

        } catch (error) {
            // Se a IA falhar ou a internet cair
            document.getElementById('quiz-question-text').innerHTML = `
                <div style="text-align: center; color: var(--error); padding: 40px;">
                    <i class="fa-solid fa-triangle-exclamation fa-3x" style="margin-bottom: 20px;"></i>
                    <h3 style="color: var(--secondary);">Ops, os servidores estão cheios.</h3>
                    <p>Não foi possível gerar o simulado agora. Tente novamente.</p>
                    <button class="btn btn-primary" style="margin-top:20px;" onclick="App.startPractice('${title}')">Tentar de novo</button>
                </div>
            `;
        }
    },
    renderQuestion() {
        const quiz = this.currentQuiz;
        const qObj = quiz.questions[quiz.currentIndex];
        
        // Exibe textos dos botões e barras normais do quiz
        document.getElementById('quiz-progress-text').style.display = 'block';
        document.getElementById('quiz-score-text').style.display = 'block';
        document.getElementById('quiz-options').style.display = 'flex';

        document.getElementById('quiz-progress-text').innerText = `Questão ${quiz.currentIndex + 1} de ${quiz.questions.length}`;
        document.getElementById('quiz-score-text').innerText = `Acertos: ${quiz.score}`;
        document.getElementById('quiz-question-text').innerText = qObj.q;
        
        const optionsContainer = document.getElementById('quiz-options');
        optionsContainer.innerHTML = '';
        
        qObj.options.forEach((opt, index) => {
            optionsContainer.innerHTML += `
                <button class="quiz-opt-btn" onclick="App.selectQuizOption(${index}, this)">
                    <span class="opt-letter">${String.fromCharCode(65 + index)}</span>
                    <span class="opt-text">${opt}</span>
                </button>
            `;
        });
        
        document.getElementById('quiz-submit-btn').style.display = 'none';
        this.currentQuiz.selectedOption = null;
    },

    selectQuizOption(index, btnElement) {
        this.currentQuiz.selectedOption = index;
        document.querySelectorAll('.quiz-opt-btn').forEach(b => b.classList.remove('selected'));
        btnElement.classList.add('selected');
        document.getElementById('quiz-submit-btn').style.display = 'block';
    },

    nextQuestion() {
        const quiz = this.currentQuiz;
        const qObj = quiz.questions[quiz.currentIndex];
        
        if(quiz.selectedOption === qObj.answer) {
            quiz.score++;
            notify("Resposta Correta!", "success");
        } else {
            notify(`Incorreta. A resposta certa era a letra ${String.fromCharCode(65 + qObj.answer)}.`, "error");
        }
        
        quiz.currentIndex++;
        
        if(quiz.currentIndex < quiz.questions.length) {
            setTimeout(() => this.renderQuestion(), 800);
        } else {
            this.finishQuiz();
        }
    },

    finishQuiz() {
        const quiz = this.currentQuiz;
        const percentage = Math.round((quiz.score / quiz.questions.length) * 100);
        
        // 1. SALVA O RESULTADO NO BANCO DE DADOS LOCAL
        this.atividades.push({
            subject: quiz.subject,
            score: percentage,
            date: new Date().toLocaleDateString()
        });
        localStorage.setItem('et_atividades', JSON.stringify(this.atividades));
        
        // 2. RECALCULA A BARRA DE DOMÍNIO NA TELA INICIAL
        this.calculateProgress();
        this.renderSubjects();
        this.renderStats();
        
        // 3. MOSTRA A TELA DE CONGRATULAÇÕES
        document.getElementById('quiz-progress-text').style.display = 'none';
        document.getElementById('quiz-score-text').style.display = 'none';
        document.getElementById('quiz-options').style.display = 'none';
        document.getElementById('quiz-submit-btn').style.display = 'none';
        
        document.getElementById('quiz-question-text').innerHTML = `
            <div id="quiz-end-screen" style="text-align: center; padding: 20px;">
                <i class="fa-solid fa-trophy" style="font-size: 4rem; color: var(--primary); margin-bottom: 20px;"></i>
                <h2 style="color: var(--secondary); margin-bottom: 10px; font-size:2rem;">Treinamento Concluído!</h2>
                <p style="font-size: 1.1rem; color: var(--text-body); margin-bottom: 25px;">Você acertou ${quiz.score} de ${quiz.questions.length} questões (${percentage}% de rendimento).</p>
                <p style="font-weight: 800; color: var(--success); margin-bottom: 30px;">O seu Domínio de ${this.subjects.find(s=>s.id===quiz.subject).name} foi atualizado no Painel!</p>
                <button class="btn btn-primary" onclick="App.showTab('disciplinas')">Ver Meu Progresso</button>
            </div>
        `;
    },
    // --- 9. CENTRO DE VESTIBULAR (PROVAS E REDAÇÃO) ---
    
    examPdfs: [
        { id: 'en23_1', title: 'ENEM 2023 - 1º Dia (Azul)', org: 'INEP', ano: 2023, color: '#3B82F6', url: 'assets/provas/enem_2023_d1_azul.pdf' },
        { id: 'en23_2', title: 'ENEM 2023 - 2º Dia (Amarelo)', org: 'INEP', ano: 2023, color: '#F59E0B', url: 'assets/provas/enem_2023_d2_amarelo.pdf' },
        { id: 'en24_1', title: 'ENEM 2024 - 1º Dia (Azul)', org: 'INEP', ano: 2024, color: '#3B82F6', url: 'assets/provas/enem_2024_d1_azul.pdf' },
        { id: 'en24_2', title: 'ENEM 2024 - 2º Dia (Azul)', org: 'INEP', ano: 2024, color: '#3B82F6', url: 'assets/provas/enem_2024_d2_azul.pdf' }
    ],

    redacoesTop: [
        { 
            tema: "Desafios para a valorização de comunidades e povos tradicionais no Brasil", 
            autor: "Maria Eduarda", ano: 2022,
            texto: "A Constituição Federal de 1988 — norma de maior hierarquia no sistema jurídico brasileiro — garante a todos o direito à igualdade e à preservação de suas culturas. No entanto, quando se observa os desafios para a valorização de comunidades e povos tradicionais no Brasil, verifica-se que esse preceito constitucional não é efetivado na prática. Nesse sentido, é imperioso destacar a negligência estatal e o preconceito social como os principais promotores desse cenário inaceitável. <br><br> Sob esse viés, cabe ressaltar a omissão do Estado como um dos fatores que agravam a invisibilidade desses povos..."
        },
        { 
            tema: "Invisibilidade e registro civil: garantia de acesso à cidadania no Brasil", 
            autor: "Fernanda Quaresma", ano: 2021,
            texto: "Na obra 'Vidas Secas', do modernista Graciliano Ramos, o personagem Fabiano, pai de uma família de retirantes, não possui documentos de identificação. Por esse motivo, é constantemente explorado pelos donos de terras e não consegue recorrer à justiça, vivendo à margem da sociedade. Fora da ficção, a realidade de muitos brasileiros assemelha-se a essa. A falta de registro civil afasta milhares de cidadãos de seus direitos básicos, revelando um grave problema estrutural no país. <br><br> Em primeiro lugar, é fundamental analisar como a burocracia estatal dificulta o acesso à documentação..."
        }
    ],

    renderExams() {
        const container = document.getElementById('pdf-list-container');
        if(!container) return;
        
        container.innerHTML = this.examPdfs.map(exam => {
            const action = exam.url ? `window.open('${exam.url}', '_blank')` : `notify('Upload do PDF de ${exam.org} pendente.', 'info')`;
            
            return `
            <div class="pdf-card">
                <div style="background: ${exam.color}15; color: ${exam.color}; width: 70px; height: 70px; border-radius: 18px; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; margin: 0 auto 20px;">
                    <i class="fa-solid fa-file-pdf"></i>
                </div>
                <span style="display: block; font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 5px;">${exam.org} ${exam.ano}</span>
                <span style="display: block; font-weight: 800; font-size: 1.1rem; color: var(--secondary); margin-bottom: 25px; line-height: 1.3;">${exam.title}</span>
                
                <button class="btn btn-secondary" style="width: 100%; font-size: 0.85rem;" onclick="${action}">
                    <i class="fa-solid fa-download"></i> Acessar Prova
                </button>
            </div>
            `;
        }).join('');
    },

    renderNota1000() {
        const container = document.getElementById('nota1000-container');
        if(!container) return;

        container.innerHTML = this.redacoesTop.map((redacao, index) => `
            <div class="card" style="padding: 30px; display: flex; flex-direction: column; justify-content: space-between; border-top: 4px solid var(--primary);">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <span style="background: #FFFBEB; color: #F59E0B; padding: 6px 12px; border-radius: 8px; font-weight: 800; font-size: 0.75rem;">
                            <i class="fa-solid fa-star"></i> ENEM ${redacao.ano}
                        </span>
                        <span style="color: var(--text-muted); font-size: 0.85rem; font-weight: 700;">
                            <i class="fa-solid fa-pen-nib"></i> ${redacao.autor}
                        </span>
                    </div>
                    <h3 style="font-size: 1.2rem; color: var(--secondary); margin-bottom: 15px; line-height: 1.4;">${redacao.tema}</h3>
                    <p style="color: var(--text-body); font-size: 0.9rem; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
                        "${redacao.texto}"
                    </p>
                </div>
                <button class="btn btn-primary" style="margin-top: 25px; width: 100%; background: #F8FAFC; color: var(--secondary); border: 1px solid var(--border); box-shadow: none;" onclick="App.readRedacao(${index})">
                    Ler Redação Completa
                </button>
            </div>
        `).join('');
    },

    readRedacao(index) {
        const redacao = this.redacoesTop[index];
        document.getElementById('rev-title').innerText = `ENEM ${redacao.ano} - ${redacao.autor}`;
        
        const videoElement = document.getElementById('rev-video');
        if(videoElement && videoElement.parentElement) {
            videoElement.parentElement.style.display = 'none'; 
        }
        
        document.getElementById('rev-desc').innerHTML = `
            <div style="background: #F1F5F9; padding: 15px; border-radius: 12px; margin-bottom: 25px;">
                <strong>Tema:</strong> ${redacao.tema}
            </div>
            <div style="font-family: 'Times New Roman', serif; font-size: 1.25rem; line-height: 2; color: #333; text-align: justify; padding: 0 10px;">
                ${redacao.texto}
            </div>
        `;
        
        this.openModal('revisionModal');
    },

    closeRevision() {
        this.closeModal('revisionModal');
        setTimeout(() => {
            const videoElement = document.getElementById('rev-video');
            if(videoElement && videoElement.parentElement) {
                videoElement.parentElement.style.display = 'block'; 
                videoElement.src = ''; 
            }
            document.getElementById('rev-desc').innerHTML = '';
        }, 300);
    },

    async saveEssayAsPDF() {
        const titleInput = document.getElementById('essay-title');
        const textInput = document.getElementById('essay-editor');
        
        const title = titleInput.value.trim();
        const text = textInput.value.trim();

        if(!title || !text) {
            return notify('Preencha o título e o texto da redação antes de exportar!', 'error');
        }

        notify('Processando seu PDF...', 'info');

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.text(title, 20, 20);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            const splitText = doc.splitTextToSize(text, 170);
            doc.text(splitText, 20, 35);

            const fileName = `Redacao_Estudoteca_${title.replace(/\s+/g, '_')}.pdf`;
            doc.save(fileName);

            const essayRecord = {
                id: Date.now(),
                title: title,
                date: new Date().toLocaleDateString('pt-BR'),
                chars: text.length
            };

            this.savedEssays.push(essayRecord);
            localStorage.setItem('et_essays', JSON.stringify(this.savedEssays));

            titleInput.value = '';
            textInput.value = '';
            document.getElementById('char-count').innerText = '0 caracteres';

            this.renderStats();
            this.renderSavedEssays();
            
            notify('Redação exportada e arquivada com sucesso!', 'success');
        } catch (err) {
            console.error(err);
            notify('Erro interno ao gerar o arquivo PDF.', 'error');
        }
    },

    renderSavedEssays() {
        const container = document.getElementById('saved-essays-container');
        if(!container) return;

        if(this.savedEssays.length === 0) {
            container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 50px; background: white; border-radius: 12px; border: 1px dashed var(--border); color: var(--text-muted); font-weight: 600;">Nenhuma redação arquivada ainda. Use o Laboratório de Redação!</div>`;
            return;
        }

        container.innerHTML = this.savedEssays.map(essay => `
            <div class="pdf-card" style="text-align: left; padding: 25px; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="display: flex; align-items: flex-start; gap: 15px; margin-bottom: 20px;">
                    <div style="background: #F8FAFC; width: 45px; height: 45px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--primary); font-size: 1.2rem; flex-shrink: 0;">
                        <i class="fa-solid fa-pen-nib"></i>
                    </div>
                    <div style="overflow: hidden;">
                        <h4 style="margin: 0; color: var(--secondary); font-family: var(--font-head); font-weight: 800; font-size: 1.05rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${essay.title}</h4>
                        <small style="color: var(--text-muted); font-weight: 700;">${essay.date}</small>
                    </div>
                </div>
                <div style="background: #F1F5F9; color: var(--text-body); font-size: 0.75rem; padding: 8px 12px; border-radius: 8px; font-weight: 700; display: inline-block; text-align: center;">
                    ${essay.chars} Caracteres
                </div>
            </div>
        `).join('');
    },

    // --- 10. TUTOR INTELIGÊNCIA ARTIFICIAL (GEMINI) ---
    toggleAIChat() {
        const panel = document.getElementById('ai-chat-panel');
        panel.classList.toggle('hidden');
        if(!panel.classList.contains('hidden')) {
            document.getElementById('ai-user-input').focus();
        }
    },

    async sendAIMessage() {
        const input = document.getElementById('ai-user-input');
        const text = input.value.trim();
        if(!text) return;

        const chatBox = document.getElementById('ai-chat-messages');
        
        // 1. Joga a mensagem do aluno na tela
        chatBox.innerHTML += `<div class="msg user-msg">${text}</div>`;
        input.value = '';
        chatBox.scrollTop = chatBox.scrollHeight;
        
        // 2. Coloca o indicador de "Digitando..."
        const loadingId = 'ai-loading-' + Date.now();
        chatBox.innerHTML += `<div id="${loadingId}" class="msg ai-msg"><i class="fa-solid fa-circle-notch fa-spin"></i> Analisando...</div>`;
        chatBox.scrollTop = chatBox.scrollHeight;

        try {
            // 3. Pede a resposta pra nossa API (Gemini)
            const resposta = await apiService.askAITutor(text);
            
            // 4. Tira o "Digitando" e joga a resposta real
            document.getElementById(loadingId).remove();
            
            // Troca quebra de linha (\n) por <br> e formata negrito (**) pra ficar bonito no HTML
            let formattedText = resposta.replace(/\n/g, '<br>');
            formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            
            chatBox.innerHTML += `<div class="msg ai-msg">${formattedText}</div>`;
        } catch(e) {
            document.getElementById(loadingId).remove();
            chatBox.innerHTML += `<div class="msg ai-msg" style="color: var(--error);">Desculpe, meus servidores estão sobrecarregados. Tente novamente em instantes.</div>`;
        }
        
        chatBox.scrollTop = chatBox.scrollHeight; // Rola pro final
    },

    // --- GERAÇÃO DE CRONOGRAMA COM IA ---
    async generateAICalendar() {
        notify("A IA está analisando e criando seu plano de estudos...", "info");
        
        try {
            // O prompt pedindo um plano de 5 dias em formato JSON estrito
            const prompt = `Atue como um mentor de estudos de alta performance. Crie um plano de estudos focado para os próximos 5 dias abordando matérias do ensino médio brasileiro. Retorne ESTRITAMENTE um array JSON contendo 5 strings curtas. Exemplo exato: ["Matemática: Funções e Logaritmo", "História: Era Vargas e República", "Física: Leis de Newton", "Redação: Estrutura Dissertativa", "Biologia: Citologia e Genética"]. Não escreva absolutamente nenhuma outra palavra, texto ou formatação markdown, retorne APENAS o array JSON.`;
            
            // Reutiliza a rota de Tutor que nós já consertamos!
            const resposta = await apiService.askAITutor(prompt);
            
            // Limpa qualquer sujeira que a IA mande junto (como blocos ```json)
            let cleanJson = resposta.replace(/```json/g, "").replace(/```/g, "").trim();
            const tasksArray = JSON.parse(cleanJson);
            
            // Pega a data de hoje e loop para os próximos 5 dias
            let currDate = new Date();
            for(let i = 0; i < 5; i++) {
                const dateKey = `${currDate.getDate()}-${currDate.getMonth()}-${currDate.getFullYear()}`;
                
                // Sobrescreve ou cria a tarefa naquele dia
                this.calendarTasks[dateKey] = tasksArray[i] || "Revisão Geral";
                
                // Avança 1 dia para o próximo loop
                currDate.setDate(currDate.getDate() + 1);
            }
            
            // Salva e atualiza tudo
            localStorage.setItem('et_tasks', JSON.stringify(this.calendarTasks));
            this.renderCalendar();
            this.renderStats();
            
            notify("Plano de Alta Performance gerado com sucesso!", "success");
            
        } catch(e) {
            console.error("Erro no Cronograma IA:", e);
            notify("A IA falhou em gerar o formato correto. Tente novamente.", "error");
        }
    }
}; 



document.addEventListener('DOMContentLoaded', () => App.init());