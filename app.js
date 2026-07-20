// ---------- SUPABASE ----------

const SUPABASE_URL = 'https://ijwvzydvnfpyxhqihcew.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqd3Z6eWR2bmZweXhocWloY2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NjQ5NjgsImV4cCI6MjEwMDE0MDk2OH0.S7QxwxU5wx2CFvPf6Trnzp4h3gI91wKqPpE-YgzZ8FE';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- ESTADO ----------

let usuarioAtual = null;
let telaAtiva = 'grade';

let anoAtual = new Date().getFullYear();
let anosDisponiveis = [];
let gradeAtual = null;
const gradeCache = {}; // ano -> dados da grade (evita rebuscar na rede)

let anoContasAtual = new Date().getFullYear();
let mesContasAtual = new Date().getMonth() + 1;
let anosContasDisponiveis = [];
let contasAtual = null;
let contasInicializada = false;
const contasCache = {}; // "ano-mes" -> dados

const NOMES_MES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const NOMES_MES_COMPLETO = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const ANO_CALENDARIO = new Date().getFullYear();
const MES_CALENDARIO = new Date().getMonth() + 1;

// ---------- ELEMENTOS ----------

const labelAno = document.getElementById('labelAno');
const gradeContainer = document.getElementById('gradeContainer');
const resumoAno = document.getElementById('resumoAno');
const btnAnoAnterior = document.getElementById('btnAnoAnterior');
const btnAnoProximo = document.getElementById('btnAnoProximo');

const SVG_SETA_DIREITA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const SVG_MAIS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

const modalNovoAno = document.getElementById('modalNovoAno');
const modalNovoAnoContas = document.getElementById('modalNovoAnoContas');
const toast = document.getElementById('toast');

const appRoot = document.getElementById('appRoot');
const carregandoAuth = document.getElementById('carregandoAuth');
const loginOverlay = document.getElementById('loginOverlay');
const btnLoginGoogle = document.getElementById('btnLoginGoogle');
const btnLogout = document.getElementById('btnLogout');
const infoUsuario = document.getElementById('infoUsuario');

const btnMenuMobile = document.getElementById('btnMenuMobile');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const navItems = document.querySelectorAll('.nav-item');
const telaGrade = document.getElementById('telaGrade');
const telaContas = document.getElementById('telaContas');

const btnMesAnterior = document.getElementById('btnMesAnterior');
const btnMesProximo = document.getElementById('btnMesProximo');
const labelMesContas = document.getElementById('labelMesContas');
const labelAnoContas = document.getElementById('labelAnoContas');
const resumoContas = document.getElementById('resumoContas');
const contasContainer = document.getElementById('contasContainer');

// ---------- INIT ----------

window.addEventListener('DOMContentLoaded', () => {
  sb.auth.onAuthStateChange((_event, session) => {
    if (session) {
      usuarioAtual = session.user;
      mostrarApp();
      carregarTudo();
    } else {
      usuarioAtual = null;
      mostrarLogin();
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});

btnAnoAnterior.addEventListener('click', () => {
  const minAno = anosDisponiveis.length ? Math.min(...anosDisponiveis) : anoAtual;
  if (anoAtual > minAno) {
    anoAtual--;
    carregarGrade();
  }
});

btnAnoProximo.addEventListener('click', () => {
  if (btnAnoProximo.dataset.modo === 'criar') {
    const { alvo, origem } = anoParaCriar();
    abrirModalNovoAno(alvo, origem);
  } else if (anosDisponiveis.includes(anoAtual + 1)) {
    anoAtual++;
    carregarGrade();
  }
});

btnMesAnterior.addEventListener('click', () => moverMesContas(-1));

btnMesProximo.addEventListener('click', () => {
  if (btnMesProximo.dataset.modo === 'criar') {
    const { anoAlvo, anoOrigem } = anoContasParaCriar();
    abrirModalNovoAnoContas(anoAlvo, anoOrigem);
  } else {
    moverMesContas(1);
  }
});

navItems.forEach(btn => {
  btn.addEventListener('click', () => {
    mostrarTela(btn.dataset.tela);
    fecharSidebarMobile();
  });
});

btnMenuMobile.addEventListener('click', () => {
  sidebar.classList.add('aberta');
  sidebarOverlay.hidden = false;
});

sidebarOverlay.addEventListener('click', fecharSidebarMobile);

btnLoginGoogle.addEventListener('click', entrarComGoogle);
btnLogout.addEventListener('click', sair);
document.getElementById('btnCancelarNovoAno').addEventListener('click', () => modalNovoAno.close());
document.getElementById('btnCancelarNovoAnoContas').addEventListener('click', () => modalNovoAnoContas.close());

document.getElementById('formNovoAno').addEventListener('submit', async (e) => {
  const form = e.target;
  const anoNovo = Number(form.dataset.anoNovo);
  const origemRaw = form.dataset.anoOrigem;
  const anoOrigem = origemRaw === '' ? null : Number(origemRaw);
  const modo = document.querySelector('input[name="modoNovoAno"]:checked').value;

  const ok = await criarAnoRemoto(anoOrigem, anoNovo, modo);
  if (ok) {
    mostrarToast(`Ano ${anoNovo} criado`);
    if (!anosDisponiveis.includes(anoNovo)) anosDisponiveis.push(anoNovo);
    anoAtual = anoNovo;
    delete gradeCache[anoNovo];
    await carregarGrade();
  } else {
    mostrarToast('Erro ao criar o novo ano');
  }
});

document.getElementById('formNovoAnoContas').addEventListener('submit', async (e) => {
  const form = e.target;
  const anoNovo = Number(form.dataset.anoNovo);
  const origemRaw = form.dataset.anoOrigem;
  const anoOrigem = origemRaw === '' ? null : Number(origemRaw);
  const modo = document.querySelector('input[name="modoNovoAnoContas"]:checked').value;

  const ok = await criarAnoContasRemoto(anoOrigem, anoNovo, modo);
  if (ok) {
    mostrarToast(`Contas de ${anoNovo} criadas`);
    if (!anosContasDisponiveis.includes(anoNovo)) anosContasDisponiveis.push(anoNovo);
    anoContasAtual = anoNovo;
    mesContasAtual = 1;
    delete contasCache[`${anoNovo}-1`];
    await carregarContas();
  } else {
    mostrarToast('Erro ao criar as contas do ano');
  }
});

// ---------- NAVEGAÇÃO (MENU LATERAL) ----------

function mostrarTela(tela) {
  telaAtiva = tela;
  telaGrade.hidden = tela !== 'grade';
  telaContas.hidden = tela !== 'contas';
  navItems.forEach(btn => {
    if (btn.dataset.tela === tela) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
  if (tela === 'contas' && !contasInicializada) {
    contasInicializada = true;
    carregarTudoContas();
  }
}

function fecharSidebarMobile() {
  sidebar.classList.remove('aberta');
  sidebarOverlay.hidden = true;
}

// ---------- AUTENTICAÇÃO ----------

async function entrarComGoogle() {
  await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname }
  });
}

async function sair() {
  await sb.auth.signOut();
}

function mostrarLogin() {
  carregandoAuth.hidden = true;
  loginOverlay.hidden = false;
  appRoot.hidden = true;
}

function mostrarApp() {
  carregandoAuth.hidden = true;
  loginOverlay.hidden = true;
  appRoot.hidden = false;
  const meta = usuarioAtual.user_metadata || {};
  infoUsuario.textContent = meta.full_name || meta.name || usuarioAtual.email || '';
}

// ---------- DADOS (SUPABASE) ----------

async function buscarAnos() {
  const { data, error } = await sb.from('years').select('year').order('year');
  if (error) {
    mostrarToast('Erro ao carregar anos');
    return [];
  }
  return data.map(r => r.year);
}

async function buscarGrade(ano) {
  const { data: categorias, error: errCat } = await sb
    .from('categories')
    .select('id, name, type')
    .eq('year', ano);
  if (errCat) {
    mostrarToast('Erro ao carregar categorias');
    return null;
  }

  const catIds = categorias.map(c => c.id);
  let entries = [];
  if (catIds.length) {
    const { data, error: errEnt } = await sb
      .from('entries')
      .select('category_id, month, value')
      .in('category_id', catIds);
    if (errEnt) {
      mostrarToast('Erro ao carregar lançamentos');
      return null;
    }
    entries = data;
  }

  const nomePorId = {};
  const idPorNome = {};
  categorias.forEach(c => {
    nomePorId[c.id] = c.name;
    idPorNome[c.name] = c.id;
  });

  const celulas = entries.map(e => ({
    Categoria: nomePorId[e.category_id],
    Mes: e.month,
    Valor: e.value === null ? null : Number(e.value)
  }));

  return {
    categorias: categorias.map(c => ({ Nome: c.name, Tipo: c.type })),
    celulas,
    _idPorNome: idPorNome
  };
}

async function salvarCelulaRemota(categoria, mes, valor) {
  const categoryId = gradeAtual._idPorNome[categoria];
  if (!categoryId) return false;
  const valorFinal = (valor === null || valor === undefined || valor === '') ? null : Number(valor);
  const { error } = await sb
    .from('entries')
    .upsert(
      { category_id: categoryId, month: mes, value: valorFinal, updated_at: new Date().toISOString() },
      { onConflict: 'category_id,month' }
    );
  return !error;
}

async function limparCelulaRemota(categoria, mes) {
  const categoryId = gradeAtual._idPorNome[categoria];
  if (!categoryId) return false;
  const { error } = await sb
    .from('entries')
    .delete()
    .eq('category_id', categoryId)
    .eq('month', mes);
  return !error;
}

async function criarCategoriaRemota(nome, tipo, ano) {
  const { data, error } = await sb
    .from('categories')
    .insert({ year: ano, name: nome, type: tipo })
    .select('id')
    .single();
  if (error) return null;
  return data.id;
}

async function apagarCategoriaRemota(categoryId) {
  const { error } = await sb.from('categories').delete().eq('id', categoryId);
  return !error;
}

async function criarAnoRemoto(anoOrigem, anoNovo, modo) {
  const { error: errYear } = await sb.from('years').insert({ year: anoNovo });
  if (errYear) return false;

  if (anoOrigem === null || anoOrigem === undefined) return true;

  const { data: categoriasOrigem, error: errCat } = await sb
    .from('categories')
    .select('id, name, type')
    .eq('year', anoOrigem);
  if (errCat) return false;
  if (!categoriasOrigem.length) return true;

  const novasCategorias = categoriasOrigem.map(c => ({ year: anoNovo, name: c.name, type: c.type }));
  const { data: categoriasCriadas, error: errIns } = await sb
    .from('categories')
    .insert(novasCategorias)
    .select('id, name');
  if (errIns) return false;

  if (modo !== 'copiar') return true;

  const idNovoPorNome = Object.fromEntries(categoriasCriadas.map(c => [c.name, c.id]));
  const nomePorIdOrigem = Object.fromEntries(categoriasOrigem.map(c => [c.id, c.name]));
  const catIdsOrigem = categoriasOrigem.map(c => c.id);

  const { data: entriesOrigem, error: errEnt } = await sb
    .from('entries')
    .select('category_id, month, value')
    .in('category_id', catIdsOrigem);
  if (errEnt) return false;

  const novasEntries = entriesOrigem
    .map(e => ({
      category_id: idNovoPorNome[nomePorIdOrigem[e.category_id]],
      month: e.month,
      value: e.value
    }))
    .filter(e => e.category_id);

  if (novasEntries.length) {
    const { error: errInsEnt } = await sb.from('entries').insert(novasEntries);
    if (errInsEnt) return false;
  }

  return true;
}

// ---------- CARREGAMENTO ----------

async function carregarTudo() {
  const anos = await buscarAnos();
  anosDisponiveis = anos;
  anoAtual = anos.includes(ANO_CALENDARIO) ? ANO_CALENDARIO : (anos.length ? Math.max(...anos) : ANO_CALENDARIO);
  await carregarGrade();
}

async function carregarGrade() {
  atualizarLabelAno();
  atualizarControlesAno();
  resumoAno.hidden = true;

  const maxAno = anosDisponiveis.length ? Math.max(...anosDisponiveis) : anoAtual - 1;
  if (anoAtual > maxAno) {
    renderGradeVazia();
    return;
  }

  const ano = anoAtual;

  if (gradeCache[ano]) {
    // Já visitado: mostra na hora a partir do cache e revalida em segundo plano.
    gradeAtual = gradeCache[ano];
    renderGrade(gradeAtual);
    revalidarGrade(ano);
  } else {
    gradeContainer.innerHTML = '<p class="estado-vazio">Carregando…</p>';
    const dados = await buscarGrade(ano);
    if (!dados) {
      gradeContainer.innerHTML = '<p class="estado-vazio">Erro ao carregar. Confira a conexão.</p>';
      return;
    }
    gradeCache[ano] = dados;
    if (anoAtual === ano) { // usuário pode ter trocado de ano enquanto carregava
      gradeAtual = dados;
      renderGrade(gradeAtual);
    }
  }

  prefetchVizinhos(ano);
}

// Busca a grade de novo em segundo plano e atualiza só se algo mudou de fato
// e o usuário não está no meio de uma edição.
async function revalidarGrade(ano) {
  const dados = await buscarGrade(ano);
  if (!dados) return;
  if (anoAtual !== ano || gradeContainer.querySelector('input')) return;
  const { _idPorNome: _antigo, ...atual } = gradeCache[ano];
  const { _idPorNome: _novo, ...novo } = dados;
  if (JSON.stringify(atual) === JSON.stringify(novo)) return;
  gradeCache[ano] = dados;
  gradeAtual = dados;
  renderGrade(gradeAtual);
}

// Carrega silenciosamente os anos vizinhos para que navegar até eles seja instantâneo.
function prefetchVizinhos(ano) {
  [ano - 1, ano + 1].forEach(a => {
    if (anosDisponiveis.includes(a) && !gradeCache[a]) {
      buscarGrade(a).then(dados => {
        if (dados) gradeCache[a] = dados;
      });
    }
  });
}

function atualizarLabelAno() {
  labelAno.textContent = String(anoAtual);
}

// Descobre qual ano o botão "+" deve criar e de onde copiar.
// - Vendo o último ano criado: cria o seguinte, copiando dele.
// - Vendo um ano ainda não criado (bootstrap sem nenhum ano): cria o próprio.
function anoParaCriar() {
  if (!anosDisponiveis.includes(anoAtual)) {
    const origem = anosDisponiveis.length ? Math.max(...anosDisponiveis) : null;
    return { alvo: anoAtual, origem };
  }
  return { alvo: anoAtual + 1, origem: anoAtual };
}

function atualizarControlesAno() {
  const minAno = anosDisponiveis.length ? Math.min(...anosDisponiveis) : anoAtual;
  btnAnoAnterior.disabled = anoAtual <= minAno;

  // Se o próximo ano já existe, o botão navega; senão, vira o "+" de criar.
  if (anosDisponiveis.includes(anoAtual + 1)) {
    btnAnoProximo.dataset.modo = 'nav';
    btnAnoProximo.innerHTML = SVG_SETA_DIREITA;
    btnAnoProximo.setAttribute('aria-label', 'Próximo ano');
    btnAnoProximo.classList.remove('criar');
  } else {
    btnAnoProximo.dataset.modo = 'criar';
    btnAnoProximo.innerHTML = SVG_MAIS;
    btnAnoProximo.setAttribute('aria-label', 'Criar ano ' + anoParaCriar().alvo);
    btnAnoProximo.classList.add('criar');
  }
}

function renderGradeVazia() {
  resumoAno.hidden = true;
  gradeContainer.innerHTML = `
    <div class="grade-vazia">
      <p>O ano ${anoAtual} ainda não foi criado.</p>
      <button type="button" class="btn-primario" id="btnCriarAnoInline">Criar ano ${anoAtual}</button>
    </div>
  `;
  document.getElementById('btnCriarAnoInline').addEventListener('click', () => {
    const { alvo, origem } = anoParaCriar();
    abrirModalNovoAno(alvo, origem);
  });
}

// ---------- TOTAIS ----------

function calcularTotais(saidas, entradas, mapaCelulas) {
  const totalEntradas = new Array(13).fill(0);
  const totalSaidas = new Array(13).fill(0);

  for (let mes = 1; mes <= 12; mes++) {
    saidas.forEach(cat => {
      const v = mapaCelulas[`${cat.Nome}|${mes}`];
      if (typeof v === 'number') totalSaidas[mes] += v;
    });
    entradas.forEach(cat => {
      const v = mapaCelulas[`${cat.Nome}|${mes}`];
      if (typeof v === 'number') totalEntradas[mes] += v;
    });
  }

  const saldo = new Array(13).fill(0);
  for (let mes = 1; mes <= 12; mes++) saldo[mes] = totalEntradas[mes] - totalSaidas[mes];

  return { totalEntradas, totalSaidas, saldo };
}

function ehMesAtual(mes) {
  return anoAtual === ANO_CALENDARIO && mes === MES_CALENDARIO;
}

// ---------- RESUMO DO ANO ----------

function renderResumo(totais) {
  const somaAno = (arr) => arr.reduce((a, b) => a + b, 0);
  const entradasAno = somaAno(totais.totalEntradas);
  const saidasAno = somaAno(totais.totalSaidas);
  const saldoAno = entradasAno - saidasAno;
  const classe = saldoAno >= 0 ? 'positivo' : 'negativo';

  resumoAno.innerHTML = `
    <div class="resumo-topo">
      <span class="resumo-rotulo">Saldo do ano</span>
      <span class="resumo-saldo ${classe}">${formatarMoeda(saldoAno)}</span>
    </div>
    <div class="resumo-linhas">
      <div class="resumo-item ent">
        <span class="rot">Entradas</span>
        <span class="val">${formatarMoeda(entradasAno)}</span>
      </div>
      <div class="resumo-item sai">
        <span class="rot">Saídas</span>
        <span class="val">${formatarMoeda(saidasAno)}</span>
      </div>
    </div>
  `;
  resumoAno.hidden = false;
}

// ---------- GRADE ----------

function renderGrade(dados) {
  const saidas = dados.categorias.filter(c => c.Tipo === 'Saída');
  const entradas = dados.categorias.filter(c => c.Tipo === 'Entrada');

  const mapaCelulas = {};
  (dados.celulas || []).forEach(c => {
    mapaCelulas[`${c.Categoria}|${c.Mes}`] = c.Valor;
  });

  const totais = calcularTotais(saidas, entradas, mapaCelulas);
  renderResumo(totais);

  let html = '<table class="tabela-grade"><thead><tr><th class="col-categoria">Categoria</th>';
  NOMES_MES_ABREV.forEach((m, i) => {
    const cls = ehMesAtual(i + 1) ? ' class="mes-atual"' : '';
    html += `<th${cls}>${m}</th>`;
  });
  html += '</tr></thead><tbody>';

  html += linhaSecao('Saídas', 'sec-saida');
  saidas.forEach(cat => { html += linhaCategoria(cat, mapaCelulas); });
  html += linhaAdicionar('Saída');

  html += linhaSecao('Entradas', 'sec-entrada');
  entradas.forEach(cat => { html += linhaCategoria(cat, mapaCelulas); });
  html += linhaAdicionar('Entrada');

  html += '</tbody>';
  html += rodapeGrade(totais);
  html += '</table>';

  gradeContainer.innerHTML = html;

  gradeContainer.querySelectorAll('.celula-valor').forEach(td => {
    td.addEventListener('click', () => ativarEdicaoCelula(td));
  });
  gradeContainer.querySelectorAll('.btn-excluir-linha').forEach(btn => {
    btn.addEventListener('click', () => excluirLinha(btn.dataset.nome));
  });
  gradeContainer.querySelectorAll('.btn-add-linha').forEach(btn => {
    btn.addEventListener('click', () => ativarAdicionarLinha(btn));
  });
}

function linhaSecao(titulo, classe) {
  return `<tr class="linha-secao ${classe}"><td colspan="13"><span class="ponto"></span>${titulo}</td></tr>`;
}

function linhaCategoria(cat, mapaCelulas) {
  let html = `<tr><td class="col-categoria">
    <span class="nome-categoria">${cat.Nome}</span>
    <button type="button" class="btn-excluir-linha" data-nome="${cat.Nome}" aria-label="Excluir">×</button>
  </td>`;
  for (let mes = 1; mes <= 12; mes++) {
    html += celulaHtml(cat.Nome, mes, mapaCelulas[`${cat.Nome}|${mes}`]);
  }
  html += '</tr>';
  return html;
}

function linhaAdicionar(tipo) {
  const label = tipo === 'Saída' ? '+ Nova saída' : '+ Nova entrada';
  return `<tr class="linha-adicionar"><td colspan="13"><button type="button" class="btn-add-linha" data-tipo="${tipo}">${label}</button></td></tr>`;
}

function celulaHtml(categoria, mes, valor) {
  let conteudo = '';
  if (valor !== undefined) {
    conteudo = (valor === null) ? '<span class="marca-sem-valor">—</span>' : formatarMoeda(valor);
  }
  const cls = 'celula-valor' + (ehMesAtual(mes) ? ' mes-atual' : '');
  return `<td class="${cls}" data-categoria="${categoria}" data-mes="${mes}">${conteudo}</td>`;
}

function rodapeGrade(totais) {
  let html = '<tfoot>';
  html += linhaTotal('Entradas', totais.totalEntradas, 'valor-entrada');
  html += linhaTotal('Saídas', totais.totalSaidas, 'valor-saida');
  html += linhaSaldo('Saldo', totais.saldo);
  html += '</tfoot>';
  return html;
}

function linhaTotal(label, valores, classeCor) {
  let html = `<tr class="linha-total"><td class="col-categoria">${label}</td>`;
  for (let mes = 1; mes <= 12; mes++) {
    const cls = classeCor + (ehMesAtual(mes) ? ' mes-atual' : '');
    html += `<td class="${cls}">${formatarMoeda(valores[mes])}</td>`;
  }
  html += '</tr>';
  return html;
}

function linhaSaldo(label, valores) {
  let html = `<tr class="linha-saldo"><td class="col-categoria">${label}</td>`;
  for (let mes = 1; mes <= 12; mes++) {
    const neg = valores[mes] < 0 ? ' negativo' : '';
    const atual = ehMesAtual(mes) ? ' mes-atual' : '';
    html += `<td class="${neg}${atual}">${formatarMoeda(valores[mes])}</td>`;
  }
  html += '</tr>';
  return html;
}

// ---------- EDIÇÃO DE CÉLULA ----------

function buscarValorCelula(categoria, mes) {
  const encontrada = gradeAtual.celulas.find(c => c.Categoria === categoria && c.Mes === mes);
  return encontrada ? encontrada.Valor : undefined;
}

function atualizarCelulaCache(categoria, mes, valor) {
  const idx = gradeAtual.celulas.findIndex(c => c.Categoria === categoria && c.Mes === mes);
  if (idx >= 0) {
    gradeAtual.celulas[idx].Valor = valor;
  } else {
    gradeAtual.celulas.push({ Categoria: categoria, Mes: mes, Valor: valor });
  }
}

function removerCelulaCache(categoria, mes) {
  gradeAtual.celulas = gradeAtual.celulas.filter(c => !(c.Categoria === categoria && c.Mes === mes));
}

function ativarEdicaoCelula(td) {
  if (td.querySelector('input')) return;

  const categoria = td.dataset.categoria;
  const mes = Number(td.dataset.mes);
  const valorAtual = buscarValorCelula(categoria, mes);
  const existeLinha = valorAtual !== undefined;
  const valorInicial = (typeof valorAtual === 'number') ? valorAtual : '';

  td.innerHTML = '';

  const input = document.createElement('input');
  input.type = 'number';
  input.step = '0.01';
  input.inputMode = 'decimal';
  input.className = 'input-celula';
  input.value = valorInicial;
  td.appendChild(input);

  if (existeLinha) {
    const btnLimpar = document.createElement('button');
    btnLimpar.type = 'button';
    btnLimpar.className = 'btn-limpar-celula';
    btnLimpar.textContent = '×';
    btnLimpar.addEventListener('mousedown', (e) => e.preventDefault());
    btnLimpar.addEventListener('click', async () => {
      const ok = await limparCelulaRemota(categoria, mes);
      if (ok) {
        removerCelulaCache(categoria, mes);
      } else {
        mostrarToast('Erro ao limpar célula');
      }
      renderGrade(gradeAtual);
    });
    td.appendChild(btnLimpar);
  }

  input.focus();
  input.select();

  let cancelado = false;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'Escape') {
      cancelado = true;
      renderGrade(gradeAtual);
    }
  });

  input.addEventListener('blur', async () => {
    if (cancelado) return;
    const bruto = input.value.trim();
    const valor = bruto === '' ? null : parseFloat(bruto);
    const ok = await salvarCelulaRemota(categoria, mes, valor);
    if (ok) {
      atualizarCelulaCache(categoria, mes, valor);
    } else {
      mostrarToast('Erro ao salvar. Confira a conexão.');
    }
    renderGrade(gradeAtual);
  });
}

// ---------- LINHAS (CATEGORIAS) ----------

async function excluirLinha(nome) {
  if (!confirm(`Excluir "${nome}"? Todos os valores já lançados nessa categoria neste ano também serão apagados. Essa ação não pode ser desfeita.`)) return;
  const categoryId = gradeAtual._idPorNome[nome];
  const ok = await apagarCategoriaRemota(categoryId);
  if (ok) {
    gradeAtual.categorias = gradeAtual.categorias.filter(c => c.Nome !== nome);
    gradeAtual.celulas = gradeAtual.celulas.filter(c => c.Categoria !== nome);
    delete gradeAtual._idPorNome[nome];
    renderGrade(gradeAtual);
  } else {
    mostrarToast('Erro ao excluir');
  }
}

function ativarAdicionarLinha(btn) {
  const tipo = btn.dataset.tipo;
  const tr = btn.closest('tr');
  tr.innerHTML = '<td colspan="13"><input type="text" class="input-nova-linha" placeholder="Nome da categoria"></td>';

  const input = tr.querySelector('input');
  input.focus();

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const nome = input.value.trim();
      if (nome) {
        const id = await criarCategoriaRemota(nome, tipo, anoAtual);
        if (id) {
          gradeAtual.categorias.push({ Nome: nome, Tipo: tipo });
          gradeAtual._idPorNome[nome] = id;
        } else {
          mostrarToast('Erro ao adicionar');
        }
      }
      renderGrade(gradeAtual);
    } else if (e.key === 'Escape') {
      renderGrade(gradeAtual);
    }
  });

  input.addEventListener('blur', () => renderGrade(gradeAtual));
}

// ---------- CONTAS A PAGAR: DADOS (SUPABASE) ----------

async function buscarAnosContas() {
  const { data, error } = await sb.from('bill_years').select('year').order('year');
  if (error) {
    mostrarToast('Erro ao carregar anos de contas');
    return [];
  }
  return data.map(r => r.year);
}

async function buscarContas(ano, mes) {
  const { data: grupos, error: errGrupos } = await sb
    .from('bill_groups')
    .select('id, name')
    .eq('year', ano)
    .order('created_at');
  if (errGrupos) {
    mostrarToast('Erro ao carregar grupos de contas');
    return null;
  }

  const grupoIds = grupos.map(g => g.id);
  let itens = [];
  if (grupoIds.length) {
    const { data, error: errItens } = await sb
      .from('bill_items')
      .select('id, name, group_id')
      .in('group_id', grupoIds)
      .order('created_at');
    if (errItens) {
      mostrarToast('Erro ao carregar itens de contas');
      return null;
    }
    itens = data;
  }

  const itemIds = itens.map(i => i.id);
  let entradas = [];
  if (itemIds.length) {
    const { data, error: errEnt } = await sb
      .from('bill_entries')
      .select('item_id, paid, value')
      .in('item_id', itemIds)
      .eq('month', mes);
    if (errEnt) {
      mostrarToast('Erro ao carregar contas do mês');
      return null;
    }
    entradas = data;
  }

  const entradaPorItem = {};
  entradas.forEach(e => {
    entradaPorItem[e.item_id] = { pago: e.paid, valor: e.value === null ? null : Number(e.value) };
  });

  const grupos_ = grupos.map(g => ({
    id: g.id,
    nome: g.name,
    itens: itens
      .filter(i => i.group_id === g.id)
      .map(i => ({
        id: i.id,
        nome: i.name,
        pago: entradaPorItem[i.id] ? entradaPorItem[i.id].pago : false,
        valor: entradaPorItem[i.id] ? entradaPorItem[i.id].valor : null
      }))
  }));

  return { grupos: grupos_ };
}

async function alternarPagoRemoto(itemId, mes, pago) {
  const { error } = await sb
    .from('bill_entries')
    .upsert(
      { item_id: itemId, month: mes, paid: pago, updated_at: new Date().toISOString() },
      { onConflict: 'item_id,month' }
    );
  return !error;
}

async function salvarValorContaRemoto(itemId, mes, valor) {
  const valorFinal = (valor === null || valor === undefined || valor === '') ? null : Number(valor);
  const { error } = await sb
    .from('bill_entries')
    .upsert(
      { item_id: itemId, month: mes, value: valorFinal, updated_at: new Date().toISOString() },
      { onConflict: 'item_id,month' }
    );
  return !error;
}

async function criarGrupoRemoto(nome, ano) {
  const { data, error } = await sb
    .from('bill_groups')
    .insert({ year: ano, name: nome })
    .select('id')
    .single();
  if (error) return null;
  return data.id;
}

async function apagarGrupoRemoto(grupoId) {
  const { error } = await sb.from('bill_groups').delete().eq('id', grupoId);
  return !error;
}

async function criarItemContaRemoto(nome, grupoId) {
  const { data, error } = await sb
    .from('bill_items')
    .insert({ group_id: grupoId, name: nome })
    .select('id')
    .single();
  if (error) return null;
  return data.id;
}

async function apagarItemContaRemoto(itemId) {
  const { error } = await sb.from('bill_items').delete().eq('id', itemId);
  return !error;
}

async function criarAnoContasRemoto(anoOrigem, anoNovo, modo) {
  const { error: errAno } = await sb.from('bill_years').insert({ year: anoNovo });
  if (errAno) return false;

  if (anoOrigem === null || anoOrigem === undefined) return true;

  const { data: gruposOrigem, error: errGrupos } = await sb
    .from('bill_groups')
    .select('id, name')
    .eq('year', anoOrigem);
  if (errGrupos) return false;
  if (!gruposOrigem.length) return true;

  const novosGrupos = gruposOrigem.map(g => ({ year: anoNovo, name: g.name }));
  const { data: gruposCriados, error: errInsGrupos } = await sb
    .from('bill_groups')
    .insert(novosGrupos)
    .select('id, name');
  if (errInsGrupos) return false;

  const idNovoGrupoPorNome = Object.fromEntries(gruposCriados.map(g => [g.name, g.id]));
  const nomeGrupoPorIdOrigem = Object.fromEntries(gruposOrigem.map(g => [g.id, g.name]));
  const grupoIdsOrigem = gruposOrigem.map(g => g.id);

  const { data: itensOrigem, error: errItens } = await sb
    .from('bill_items')
    .select('id, name, group_id')
    .in('group_id', grupoIdsOrigem);
  if (errItens) return false;
  if (!itensOrigem.length) return true;

  const novosItens = itensOrigem.map(i => ({
    name: i.name,
    group_id: idNovoGrupoPorNome[nomeGrupoPorIdOrigem[i.group_id]]
  }));
  const { data: itensCriados, error: errInsItens } = await sb
    .from('bill_items')
    .insert(novosItens)
    .select('id, name, group_id');
  if (errInsItens) return false;

  if (modo !== 'copiar') return true;

  const grupoNomePorIdNovo = Object.fromEntries(gruposCriados.map(g => [g.id, g.name]));
  const idNovoItemPorChave = {};
  itensCriados.forEach(i => {
    const chave = `${grupoNomePorIdNovo[i.group_id]}|${i.name}`;
    idNovoItemPorChave[chave] = i.id;
  });

  const idNovoItemPorIdOrigem = {};
  itensOrigem.forEach(i => {
    const chave = `${nomeGrupoPorIdOrigem[i.group_id]}|${i.name}`;
    idNovoItemPorIdOrigem[i.id] = idNovoItemPorChave[chave];
  });

  const itemIdsOrigem = itensOrigem.map(i => i.id);
  const { data: entradasOrigem, error: errEnt } = await sb
    .from('bill_entries')
    .select('item_id, month, paid, value')
    .in('item_id', itemIdsOrigem);
  if (errEnt) return false;

  const novasEntradas = entradasOrigem
    .map(e => ({
      item_id: idNovoItemPorIdOrigem[e.item_id],
      month: e.month,
      paid: e.paid,
      value: e.value
    }))
    .filter(e => e.item_id);

  if (novasEntradas.length) {
    const { error: errInsEnt } = await sb.from('bill_entries').insert(novasEntradas);
    if (errInsEnt) return false;
  }

  return true;
}

// ---------- CONTAS A PAGAR: CARREGAMENTO ----------

async function carregarTudoContas() {
  const anos = await buscarAnosContas();
  anosContasDisponiveis = anos;
  const hoje = new Date();
  anoContasAtual = anos.includes(hoje.getFullYear()) ? hoje.getFullYear() : (anos.length ? Math.max(...anos) : hoje.getFullYear());
  mesContasAtual = anoContasAtual === hoje.getFullYear() ? (hoje.getMonth() + 1) : 1;
  await carregarContas();
}

async function carregarContas() {
  atualizarLabelMesContas();
  atualizarControlesMesContas();
  resumoContas.hidden = true;

  const maxAno = anosContasDisponiveis.length ? Math.max(...anosContasDisponiveis) : anoContasAtual - 1;
  if (anoContasAtual > maxAno || !anosContasDisponiveis.includes(anoContasAtual)) {
    renderContasVazias();
    return;
  }

  const chave = `${anoContasAtual}-${mesContasAtual}`;

  if (contasCache[chave]) {
    contasAtual = contasCache[chave];
    renderContas(contasAtual);
  } else {
    contasContainer.innerHTML = '<p class="estado-vazio">Carregando…</p>';
    const dados = await buscarContas(anoContasAtual, mesContasAtual);
    if (!dados) {
      contasContainer.innerHTML = '<p class="estado-vazio">Erro ao carregar. Confira a conexão.</p>';
      return;
    }
    contasCache[chave] = dados;
    if (`${anoContasAtual}-${mesContasAtual}` === chave) {
      contasAtual = dados;
      renderContas(contasAtual);
    }
  }
}

function moverMesContas(delta) {
  mesContasAtual += delta;
  if (mesContasAtual < 1) { mesContasAtual = 12; anoContasAtual--; }
  if (mesContasAtual > 12) { mesContasAtual = 1; anoContasAtual++; }
  carregarContas();
}

function atualizarLabelMesContas() {
  labelMesContas.textContent = NOMES_MES_COMPLETO[mesContasAtual - 1];
  labelAnoContas.textContent = String(anoContasAtual);
}

// Mesma ideia do anoParaCriar() da grade: descobre o ano-alvo e de onde copiar.
function anoContasParaCriar() {
  if (!anosContasDisponiveis.includes(anoContasAtual)) {
    const origem = anosContasDisponiveis.length ? Math.max(...anosContasDisponiveis) : null;
    return { anoAlvo: anoContasAtual, anoOrigem: origem };
  }
  return { anoAlvo: anoContasAtual + 1, anoOrigem: anoContasAtual };
}

function atualizarControlesMesContas() {
  const minAno = anosContasDisponiveis.length ? Math.min(...anosContasDisponiveis) : anoContasAtual;
  btnMesAnterior.disabled = anoContasAtual <= minAno && mesContasAtual === 1;

  const maxAno = anosContasDisponiveis.length ? Math.max(...anosContasDisponiveis) : null;
  const precisaCriar = maxAno === null || (mesContasAtual === 12 && anoContasAtual >= maxAno);

  if (precisaCriar) {
    btnMesProximo.dataset.modo = 'criar';
    btnMesProximo.innerHTML = SVG_MAIS;
    btnMesProximo.setAttribute('aria-label', 'Criar contas de ' + anoContasParaCriar().anoAlvo);
    btnMesProximo.classList.add('criar');
  } else {
    btnMesProximo.dataset.modo = 'nav';
    btnMesProximo.innerHTML = SVG_SETA_DIREITA;
    btnMesProximo.setAttribute('aria-label', 'Próximo mês');
    btnMesProximo.classList.remove('criar');
  }
}

function renderContasVazias() {
  resumoContas.hidden = true;
  const { anoAlvo, anoOrigem } = anoContasParaCriar();
  contasContainer.innerHTML = `
    <div class="grade-vazia">
      <p>As contas de ${NOMES_MES_COMPLETO[mesContasAtual - 1]} de ${anoContasAtual} ainda não foram criadas.</p>
      <button type="button" class="btn-primario" id="btnCriarAnoContasInline">Criar contas de ${anoContasAtual}</button>
    </div>
  `;
  document.getElementById('btnCriarAnoContasInline').addEventListener('click', () => {
    abrirModalNovoAnoContas(anoAlvo, anoOrigem);
  });
}

// ---------- CONTAS A PAGAR: RENDER ----------

function renderResumoContas(totalPagos, totalItens, somaPago, somaTotal) {
  if (!totalItens) {
    resumoContas.hidden = true;
    return;
  }
  const somaPendente = somaTotal - somaPago;
  resumoContas.innerHTML = `
    <div class="resumo-topo">
      <span class="resumo-rotulo">Contas pagas</span>
      <span class="resumo-saldo positivo">${totalPagos}/${totalItens}</span>
    </div>
    <div class="resumo-linhas">
      <div class="resumo-item ent">
        <span class="rot">Pago</span>
        <span class="val">${formatarMoeda(somaPago)}</span>
      </div>
      <div class="resumo-item sai">
        <span class="rot">Pendente</span>
        <span class="val">${formatarMoeda(somaPendente)}</span>
      </div>
    </div>
  `;
  resumoContas.hidden = false;
}

function renderContas(dados) {
  let totalItens = 0;
  let totalPagos = 0;
  let somaValor = 0;
  let somaPago = 0;

  dados.grupos.forEach(g => {
    g.itens.forEach(i => {
      totalItens++;
      if (i.pago) totalPagos++;
      if (typeof i.valor === 'number') {
        somaValor += i.valor;
        if (i.pago) somaPago += i.valor;
      }
    });
  });

  renderResumoContas(totalPagos, totalItens, somaPago, somaValor);

  let html = '';
  if (!dados.grupos.length) {
    html = '<div class="grade-vazia"><p>Nenhum grupo de contas ainda.</p></div>';
  } else {
    dados.grupos.forEach(g => { html += grupoContasHtml(g); });
  }
  html += '<div class="rodape-contas"><button type="button" class="btn-add-linha" id="btnAddGrupo">+ Novo grupo</button></div>';

  contasContainer.innerHTML = html;

  contasContainer.querySelectorAll('.checkbox-pago').forEach(cb => {
    cb.addEventListener('change', () => alternarPago(cb.dataset.item, cb.checked));
  });
  contasContainer.querySelectorAll('.linha-conta-valor').forEach(el => {
    el.addEventListener('click', () => ativarEdicaoValorConta(el));
  });
  contasContainer.querySelectorAll('.btn-excluir-linha[data-item]').forEach(btn => {
    btn.addEventListener('click', () => excluirItemConta(btn.dataset.item));
  });
  contasContainer.querySelectorAll('.btn-excluir-linha[data-grupo]').forEach(btn => {
    btn.addEventListener('click', () => excluirGrupo(btn.dataset.grupo));
  });
  contasContainer.querySelectorAll('.btn-add-item').forEach(btn => {
    btn.addEventListener('click', () => ativarAdicionarItem(btn));
  });
  document.getElementById('btnAddGrupo').addEventListener('click', ativarAdicionarGrupo);
}

function grupoContasHtml(g) {
  let html = `<div class="grupo-contas">
    <div class="grupo-contas-cabecalho">
      <span class="grupo-contas-nome">${g.nome}</span>
      <button type="button" class="btn-excluir-linha" data-grupo="${g.id}" aria-label="Excluir grupo">×</button>
    </div>`;
  g.itens.forEach(i => { html += linhaContaHtml(i); });
  html += `<div class="linha-item-adicionar"><button type="button" class="btn-add-linha btn-add-item" data-grupo="${g.id}">+ Novo item</button></div>`;
  html += '</div>';
  return html;
}

function linhaContaHtml(item) {
  const pagoCls = item.pago ? ' pago' : '';
  const valorTxt = typeof item.valor === 'number' ? formatarMoeda(item.valor) : '';
  return `<div class="linha-conta${pagoCls}">
    <input type="checkbox" class="checkbox-pago" data-item="${item.id}" ${item.pago ? 'checked' : ''}>
    <span class="linha-conta-nome">${item.nome}</span>
    <span class="linha-conta-valor" data-item="${item.id}">${valorTxt}</span>
    <button type="button" class="btn-excluir-linha" data-item="${item.id}" aria-label="Excluir item">×</button>
  </div>`;
}

// ---------- CONTAS A PAGAR: EDIÇÃO ----------

function encontrarItemConta(itemId) {
  for (const g of contasAtual.grupos) {
    const item = g.itens.find(i => i.id === itemId);
    if (item) return item;
  }
  return null;
}

function atualizarItemContaCache(itemId, patch) {
  const item = encontrarItemConta(itemId);
  if (item) Object.assign(item, patch);
}

async function alternarPago(itemId, pago) {
  const ok = await alternarPagoRemoto(itemId, mesContasAtual, pago);
  if (ok) {
    atualizarItemContaCache(itemId, { pago });
  } else {
    mostrarToast('Erro ao atualizar');
  }
  renderContas(contasAtual);
}

function ativarEdicaoValorConta(el) {
  if (el.querySelector('input')) return;

  const itemId = el.dataset.item;
  const item = encontrarItemConta(itemId);
  const valorInicial = typeof item.valor === 'number' ? item.valor : '';

  el.innerHTML = '';
  const input = document.createElement('input');
  input.type = 'number';
  input.step = '0.01';
  input.inputMode = 'decimal';
  input.className = 'input-celula';
  input.value = valorInicial;
  el.appendChild(input);
  input.focus();
  input.select();

  let cancelado = false;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'Escape') {
      cancelado = true;
      renderContas(contasAtual);
    }
  });

  input.addEventListener('blur', async () => {
    if (cancelado) return;
    const bruto = input.value.trim();
    const valor = bruto === '' ? null : parseFloat(bruto);
    const ok = await salvarValorContaRemoto(itemId, mesContasAtual, valor);
    if (ok) {
      atualizarItemContaCache(itemId, { valor });
    } else {
      mostrarToast('Erro ao salvar. Confira a conexão.');
    }
    renderContas(contasAtual);
  });
}

// ---------- CONTAS A PAGAR: GRUPOS E ITENS ----------

async function excluirGrupo(grupoId) {
  const grupo = contasAtual.grupos.find(g => g.id === grupoId);
  if (!grupo) return;
  if (!confirm(`Excluir "${grupo.nome}"? Todos os itens e valores lançados nesse grupo também serão apagados. Essa ação não pode ser desfeita.`)) return;
  const ok = await apagarGrupoRemoto(grupoId);
  if (ok) {
    contasAtual.grupos = contasAtual.grupos.filter(g => g.id !== grupoId);
    renderContas(contasAtual);
  } else {
    mostrarToast('Erro ao excluir grupo');
  }
}

async function excluirItemConta(itemId) {
  const item = encontrarItemConta(itemId);
  if (!item) return;
  if (!confirm(`Excluir "${item.nome}"? Essa ação não pode ser desfeita.`)) return;
  const ok = await apagarItemContaRemoto(itemId);
  if (ok) {
    contasAtual.grupos.forEach(g => { g.itens = g.itens.filter(i => i.id !== itemId); });
    renderContas(contasAtual);
  } else {
    mostrarToast('Erro ao excluir item');
  }
}

function ativarAdicionarGrupo() {
  const wrapper = document.querySelector('.rodape-contas');
  wrapper.innerHTML = '<input type="text" class="input-nova-linha" placeholder="Nome do grupo">';
  const input = wrapper.querySelector('input');
  input.focus();

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const nome = input.value.trim();
      if (nome) {
        const id = await criarGrupoRemoto(nome, anoContasAtual);
        if (id) {
          contasAtual.grupos.push({ id, nome, itens: [] });
        } else {
          mostrarToast('Erro ao adicionar grupo');
        }
      }
      renderContas(contasAtual);
    } else if (e.key === 'Escape') {
      renderContas(contasAtual);
    }
  });
  input.addEventListener('blur', () => renderContas(contasAtual));
}

function ativarAdicionarItem(btn) {
  const grupoId = btn.dataset.grupo;
  const wrapper = btn.closest('.linha-item-adicionar');
  wrapper.innerHTML = '<input type="text" class="input-nova-linha" placeholder="Nome do item">';
  const input = wrapper.querySelector('input');
  input.focus();

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const nome = input.value.trim();
      if (nome) {
        const id = await criarItemContaRemoto(nome, grupoId);
        if (id) {
          const grupo = contasAtual.grupos.find(g => g.id === grupoId);
          grupo.itens.push({ id, nome, pago: false, valor: null });
        } else {
          mostrarToast('Erro ao adicionar item');
        }
      }
      renderContas(contasAtual);
    } else if (e.key === 'Escape') {
      renderContas(contasAtual);
    }
  });
  input.addEventListener('blur', () => renderContas(contasAtual));
}

function abrirModalNovoAnoContas(anoNovo, anoOrigem) {
  const form = document.getElementById('formNovoAnoContas');
  form.reset();
  form.dataset.anoNovo = anoNovo;
  form.dataset.anoOrigem = (anoOrigem === null || anoOrigem === undefined) ? '' : anoOrigem;
  document.getElementById('labelNovoAnoContas').textContent = anoNovo;

  const radioCopiar = form.querySelector('input[value="copiar"]');
  const opcaoCopiar = radioCopiar.closest('.opcao-radio');
  if (anoOrigem === null || anoOrigem === undefined) {
    opcaoCopiar.hidden = true;
    form.querySelector('input[value="zerado"]').checked = true;
  } else {
    opcaoCopiar.hidden = false;
    radioCopiar.checked = true;
  }
  modalNovoAnoContas.showModal();
}

// ---------- MODAIS ----------

function abrirModalNovoAno(anoNovo, anoOrigem) {
  const form = document.getElementById('formNovoAno');
  form.reset();
  form.dataset.anoNovo = anoNovo;
  form.dataset.anoOrigem = (anoOrigem === null || anoOrigem === undefined) ? '' : anoOrigem;
  document.getElementById('labelNovoAno').textContent = anoNovo;

  // Sem ano de origem não há o que copiar: mostra só a opção "zerado".
  const radioCopiar = form.querySelector('input[value="copiar"]');
  const opcaoCopiar = radioCopiar.closest('.opcao-radio');
  if (anoOrigem === null || anoOrigem === undefined) {
    opcaoCopiar.hidden = true;
    form.querySelector('input[value="zerado"]').checked = true;
  } else {
    opcaoCopiar.hidden = false;
    radioCopiar.checked = true;
  }
  modalNovoAno.showModal();
}

// ---------- UTIL ----------

function formatarMoeda(valor) {
  return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function mostrarToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(mostrarToast._t);
  mostrarToast._t = setTimeout(() => { toast.hidden = true; }, 2800);
}
