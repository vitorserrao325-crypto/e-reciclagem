const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// CONFIGURAÇÃO SÊNIOR: Define qual pasta usar baseando-se em onde o index.html realmente está
let pastaRaiz = __dirname;
if (!fs.existsSync(path.join(pastaRaiz, 'index.html'))) {
    pastaRaiz = process.cwd(); 
}

// Libera os arquivos estáticos (CSS, imagens, etc.) da pasta correta
app.use(express.static(pastaRaiz));

const BANCO_DADOS_ARQUIVO = path.join(pastaRaiz, 'banco_usuarios.json');
const EMAIL_ADMIN_MASTER = "teste@gmail.com"; 

// Função para ler os dados guardados com segurança no servidor
function lerBanco() {
    if (!fs.existsSync(BANCO_DADOS_ARQUIVO)) {
        const bancoInicial = [{ email: EMAIL_ADMIN_MASTER, senha: "123", status: "aprovado", perfil: "admin", tipoPlano: "anual", dataVencimento: "2099-12-31" }];
        fs.writeFileSync(BANCO_DADOS_ARQUIVO, JSON.stringify(bancoInicial, null, 2));
        return bancoInicial;
    }
    return JSON.parse(fs.readFileSync(BANCO_DADOS_ARQUIVO, 'utf-8'));
}

// Função para salvar as alterações no banco
function salvarBanco(dados) {
    fs.writeFileSync(BANCO_DADOS_ARQUIVO, JSON.stringify(dados, null, 2));
}

// --- ROTA RAIZ VISUAL ---
app.get('/', (req, res) => {
    const caminhoHtml = path.join(pastaRaiz, 'index.html');
    if (fs.existsSync(caminhoHtml)) {
        res.sendFile(caminhoHtml);
    } else {
        res.status(404).send(`
            <h2>⚠️ Erro Crítico do Sistema</h2>
            <p>O arquivo <strong>index.html</strong> não foi encontrado na pasta do projeto.</p>
            <p><strong>Caminho tentado:</strong> ${caminhoHtml}</p>
        `);
    }
});

// --- ROTAS DA API ---

// 1. Rota de Login
app.post('/api/login', (req, res) => {
    const { email, senha } = req.body;
    const usuarios = lerBanco();
    const usuario = usuarios.find(u => u.email === email.toLowerCase().trim() && u.senha === senha);

    if (!usuario) {
        return res.status(401).json({ erro: "E-mail ou senha incorretos." });
    }

    const hoje = new Date();
    const vencimento = new Date(usuario.dataVencimento);

    if (hoje > vencimento && usuario.perfil !== 'admin') {
        usuario.status = "suspenso";
        salvarBanco(usuarios);
        return res.status(403).json({ erro: "assinatura_vencida", mensagem: "Sua assinatura expirou. Entre em contato com o Victor." });
    }

    if (usuario.status === 'pendente') {
        return res.status(403).json({ erro: "aguardando_liberacao", mensagem: "Aguardando confirmação do seu Pix pelo administrador Victor." });
    }

    if (usuario.status === 'suspenso') {
        return res.status(403).json({ erro: "suspenso", mensagem: "Acesso suspenso / bloqueado por falta de pagamento." });
    }

    res.json({ email: usuario.email, perfil: usuario.perfil, tipoPlano: usuario.tipoPlano, dataVencimento: usuario.dataVencimento });
});

// 2. Rota de Cadastro de Nova Conta
app.post('/api/cadastro', (req, res) => {
    const { email, senha } = req.body;
    const usuarios = lerBanco();
    const emailFormatado = email.toLowerCase().trim();

    if (usuarios.some(u => u.email === emailFormatado)) {
        return res.status(400).json({ erro: "Este e-mail já está cadastrado no sistema." });
    }

    usuarios.push({
        email: emailFormatado,
        senha: senha,
        status: "pendente",
        perfil: "user",
        tipoPlano: "nenhum",
        dataVencimento: new Date().toISOString().split('T')[0]
    });

    salvarBanco(usuarios);
    res.status(201).json({ mensagem: "Solicitação enviada com sucesso!" });
});

// 3. Rota do Administrador: Listar clientes
app.get('/api/admin/usuarios', (req, res) => {
    const usuarios = lerBanco();
    const clientes = usuarios.filter(u => u.perfil !== 'admin');
    res.json(clientes);
});

// 4. Rota do Administrador: Aprovar/Renovar Plano
app.post('/api/admin/atualizar-plano', (req, res) => {
    const { email, planoEscolhido } = req.body;
    const usuarios = lerBanco();
    const usuario = usuarios.find(u => u.email === email);

    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });

    const hoje = new Date();
    let dataVencimento = new Date();

    if (planoEscolhido === 'mensal') {
        dataVencimento.setMonth(hoje.getMonth() + 1);
    } else if (planoEscolhido === 'semestral') {
        dataVencimento.setMonth(hoje.getMonth() + 6);
    } else if (planoEscolhido === 'anual') {
        dataVencimento.setFullYear(hoje.getFullYear() + 1);
    }

    usuario.status = "aprovado";
    usuario.tipoPlano = planoEscolhido;
    usuario.dataVencimento = dataVencimento.toISOString().split('T')[0];

    salvarBanco(usuarios);
    res.json({ mensagem: `Plano ${planoEscolhido} ativado com sucesso! Vence em: ${usuario.dataVencimento}` });
});

// 5. Rota do Administrador: Bloquear Usuário
app.post('/api/admin/bloquear', (req, res) => {
    const { email } = req.body;
    const usuarios = lerBanco();
    const usuario = usuarios.find(u => u.email === email);

    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });

    usuario.status = "suspenso";
    usuario.dataVencimento = new Date().toISOString().split('T')[0];

    salvarBanco(usuarios);
    res.json({ mensagem: "Usuário bloqueado com sucesso!" });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 SERVIDOR BACK-END PROTEGIDO EM http://localhost:${PORT}`);
});