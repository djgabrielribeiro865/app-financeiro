// ---------- ESTADO ----------

let apiUrl = localStorage.getItem('apiUrl') || '';
let apiToken = localStorage.getItem('apiToken') || '';
let mesAtual = new Date();
let categoriasCache = [];

const NOMES_MES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ---------- ELEMENTOS ----------

const labelMes = document.getElementById('labelMes');
const listaCategorias = document.getElementById('listaCategorias');
const listaLancamentos = document.getElementById('listaLancamentos');
const totalEntradasEl = document.getElementById('totalEntradas');
const totalSaidasEl = document.getElementById('totalSaidas');
const saldoMesEl = document.getElementById('saldoMes');

const modalLancamento = document.getElementById('modalLancamento');
const modalConfig = document.getElementById('modalConfig');
const toast = document.getElementById('toast');

// ---------- INIT ----------

window.addEventListener('DOMContentLoaded', () => {
  if (!apiUrl || !apiToken) {
    abrirModalConfig();
  } else {
    carregarTudo();
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});

document.getElementById('btnMesAnterior').addEventListener('click', () => {
  mesAtual.setMonth(mesAtual.getMonth() - 1);
  carregarTudo();
});

document.getElementById('btnMesProximo').addEventListener('click', () => {
  mesAtual.setMonth(mesAtual.getMonth() + 1);
  carregarTudo();
});

document.getElementById('btnConfig').addEventListener('click', abrirModalConfig);
document.getElementById('btnNovoLancamento').addEventListener('click', abrirModalLancamento);
document.getElementById('btnCancelarLancamento').addEventListener('click', () => modalLancamento.close());
document.getElementById('btnCancelarConfig').addEventListener('click', () => modalConfig.close());

document.getElementById('formConfig').addEventListener('submit', (e) => {
  apiUrl = document.getElementById('campoApiUrl').value.trim();
  apiToken = document.getElementById('campoApiToken').value.trim();
  localStorage.setItem('apiUrl', apiUrl);
  localStorage.setItem('apiToken', apiToken);
  mostrarToast('Conexão salva');
  carregarTudo();
});

document.getElementById('formLancamento').addEventListener('submit', async (e) => {
  const dados = {
    Data: document.getElementById('campoData').value,
    Tipo: document.getElementById('campoTipo').value,
    Categoria: document.getElementById('campoCategoria').value,
    Descricao: document.getElementById('campoDescricao').value,
    Valor: parseFloat(document.getElementById('campoValor').value || '0')
  };
  const ok = await chamarApiPost('criarLancamento', { dados });
  if (ok) {
    mostrarToast('Lançamento salvo');
    carregarTudo();
  } else {
    mostrarToast('Erro ao salvar. Confira a conexão.');
  }
});

// ---------- HELPERS DE MÊS ----------

function mesFormatado() {
  const ano = mesAtual.getFullYear();
  const mes = String(mesAtual.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
}

function atualizarLabelMes() {
  labelMes.textContent = `${NOMES_MES[mesAtual.getMonth()]} ${mesAtual.getFullYear()}`;
}

// ---------- API ----------

async function chamarApiGet(action, params = {}) {
  if (!apiUrl || !apiToken) return null;
  const query = new URLSearchParams({ action, token: apiToken, ...params });
  try {
    const resp = await fetch(`${apiUrl}?${query.toString()}`);
    const data = await resp.json();
    if (data.erro) {
      mostrarToast(data.erro);
      return null;
    }
    return data;
  } catch (err) {
    mostrarToast('Falha de conexão com a API');
    return null;
  }
}

async function chamarApiPost(action, extra = {}) {
  if (!apiUrl || !apiToken) return false;
  try {
    const resp = await fetch(apiUrl, {
      method: 'POST',
      body: JSON.stringify({ action, token: apiToken, ...extra })
    });
    const data = await resp.json();
    return !data.erro;
  } catch (err) {
    return false;
  }
}

// ---------- CARREGAMENTO ----------

async function carregarTudo() {
  atualizarLabelMes();
  const mes = mesFormatado();

  listaCategorias.innerHTML = '<p class="estado-vazio">Carregando...</p>';
  listaLancamentos.innerHTML = '';

  const [resumo, lancamentos] = await Promise.all([
    chamarApiGet('resumo', { mes }),
    chamarApiGet('lancamentos', { mes })
  ]);

  if (resumo) renderResumo(resumo);
  if (lancamentos) renderLancamentos(lancamentos);

  const categorias = await chamarApiGet('categorias');
  if (categorias) {
    categoriasCache = categorias;
    preencherSelectCategorias(categorias);
  }
}

function renderResumo(resumo) {
  totalEntradasEl.textContent = formatarMoeda(resumo.totalEntradas);
  totalSaidasEl.textContent = formatarMoeda(resumo.totalSaidas);
  saldoMesEl.textContent = formatarMoeda(resumo.totalEntradas - resumo.totalSaidas);

  if (!resumo.categorias || resumo.categorias.length === 0) {
    listaCategorias.innerHTML = '<p class="estado-vazio">Nenhuma categoria cadastrada ainda.</p>';
    return;
  }

  listaCategorias.innerHTML = '';
  resumo.categorias.forEach(cat => {
    listaCategorias.appendChild(criarCardCategoria(cat));
  });
}

function criarCardCategoria(cat) {
  const div = document.createElement('div');
  div.className = 'categoria-card';

  const percentual = cat.planejado > 0 ? (cat.realizado / cat.planejado) * 100 : 0;
  const estourado = percentual > 100;
  const largura = Math.min(percentual, 100);

  div.innerHTML = `
    <div class="categoria-topo">
      <span class="categoria-nome">${cat.categoria}</span>
      <span class="categoria-valores">${formatarMoeda(cat.realizado)} / ${formatarMoeda(cat.planejado)}</span>
    </div>
    <div class="ruler">
      <div class="ruler-marcas"><span></span><span></span><span></span><span></span><span></span></div>
      <div class="ruler-trilho">
        <div class="ruler-preenchimento ${estourado ? 'estourado' : ''}" style="width:${largura}%"></div>
      </div>
    </div>
  `;
  return div;
}

function renderLancamentos(lancamentos) {
  if (!lancamentos || lancamentos.length === 0) {
    listaLancamentos.innerHTML = '<p class="estado-vazio">Nenhum lançamento neste mês.</p>';
    return;
  }

  const ordenados = [...lancamentos].sort((a, b) => new Date(b.Data) - new Date(a.Data));

  listaLancamentos.innerHTML = '';
  ordenados.forEach(l => {
    const div = document.createElement('div');
    div.className = 'lancamento-item';
    const sinal = l.Tipo === 'Entrada' ? '+' : '−';
    const cor = l.Tipo === 'Entrada' ? 'valor-entrada' : 'valor-saida';
    div.innerHTML = `
      <div class="lancamento-info">
        <div class="lancamento-desc">${l.Descricao || l.Categoria}</div>
        <div class="lancamento-meta">${formatarDataCurta(l.Data)} · ${l.Categoria}</div>
      </div>
      <div class="lancamento-valor ${cor}">${sinal} ${formatarMoeda(l.Valor)}</div>
    `;
    listaLancamentos.appendChild(div);
  });
}

function preencherSelectCategorias(categorias) {
  const select = document.getElementById('campoCategoria');
  select.innerHTML = '';
  categorias.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.Nome;
    opt.textContent = cat.Nome;
    select.appendChild(opt);
  });
}

// ---------- MODAIS ----------

function abrirModalConfig() {
  document.getElementById('campoApiUrl').value = apiUrl;
  document.getElementById('campoApiToken').value = apiToken;
  modalConfig.showModal();
}

function abrirModalLancamento() {
  document.getElementById('formLancamento').reset();
  document.getElementById('campoData').value = new Date().toISOString().slice(0, 10);
  modalLancamento.showModal();
}

// ---------- UTIL ----------

function formatarMoeda(valor) {
  return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarDataCurta(dataStr) {
  const d = new Date(dataStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function mostrarToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(mostrarToast._t);
  mostrarToast._t = setTimeout(() => { toast.hidden = true; }, 2800);
}
