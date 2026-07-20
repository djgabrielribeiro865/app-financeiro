// ---------- SUPABASE ----------

const SUPABASE_URL = 'https://ijwvzydvnfpyxhqihcew.sb.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqd3Z6eWR2bmZweXhocWloY2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NjQ5NjgsImV4cCI6MjEwMDE0MDk2OH0.S7QxwxU5wx2CFvPf6Trnzp4h3gI91wKqPpE-YgzZ8FE';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- ESTADO ----------

let usuarioAtual = null;
let anoAtual = new Date().getFullYear();
let anosDisponiveis = [];
let gradeAtual = null;
const gradeCache = {}; // ano -> dados da grade (evita rebuscar na rede)

const NOMES_MES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
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
const toast = document.getElementById('toast');

const appRoot = document.getElementById('appRoot');
const loginOverlay = document.getElementById('loginOverlay');
const btnLoginGoogle = document.getElementById('btnLoginGoogle');
const btnLogout = document.getElementById('btnLogout');
const infoUsuario = document.getElementById('infoUsuario');

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

btnLoginGoogle.addEventListener('click', entrarComGoogle);
btnLogout.addEventListener('click', sair);
document.getElementById('btnCancelarNovoAno').addEventListener('click', () => modalNovoAno.close());

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
  loginOverlay.hidden = false;
  appRoot.hidden = true;
}

function mostrarApp() {
  loginOverlay.hidden = true;
  appRoot.hidden = false;
  infoUsuario.textContent = usuarioAtual.email || '';
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
