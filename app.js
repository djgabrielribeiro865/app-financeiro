// ---------- ESTADO ----------

let apiUrl = localStorage.getItem('apiUrl') || '';
let apiToken = localStorage.getItem('apiToken') || '';
let anoAtual = new Date().getFullYear();
let anosDisponiveis = [];
let gradeAtual = null;

const NOMES_MES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const ANO_CALENDARIO = new Date().getFullYear();
const MES_CALENDARIO = new Date().getMonth() + 1;

// ---------- ELEMENTOS ----------

const labelAno = document.getElementById('labelAno');
const gradeContainer = document.getElementById('gradeContainer');
const resumoAno = document.getElementById('resumoAno');

const modalConfig = document.getElementById('modalConfig');
const modalNovoAno = document.getElementById('modalNovoAno');
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

document.getElementById('btnAnoAnterior').addEventListener('click', () => {
  const minAno = anosDisponiveis.length ? Math.min(...anosDisponiveis) : anoAtual;
  if (anoAtual > minAno) {
    anoAtual--;
    carregarGrade();
  }
});

document.getElementById('btnAnoProximo').addEventListener('click', () => {
  const maxAno = anosDisponiveis.length ? Math.max(...anosDisponiveis) : anoAtual - 1;
  if (anoAtual < maxAno + 1) {
    anoAtual++;
    carregarGrade();
  }
});

document.getElementById('btnConfig').addEventListener('click', abrirModalConfig);
document.getElementById('btnCancelarNovoAno').addEventListener('click', () => modalNovoAno.close());
document.getElementById('btnCancelarConfig').addEventListener('click', () => modalConfig.close());

document.getElementById('formConfig').addEventListener('submit', () => {
  apiUrl = document.getElementById('campoApiUrl').value.trim();
  apiToken = document.getElementById('campoApiToken').value.trim();
  localStorage.setItem('apiUrl', apiUrl);
  localStorage.setItem('apiToken', apiToken);
  mostrarToast('Conexão salva');
  carregarTudo();
});

document.getElementById('formNovoAno').addEventListener('submit', async () => {
  const maxAno = anosDisponiveis.length ? Math.max(...anosDisponiveis) : anoAtual - 1;
  const anoNovo = maxAno + 1;
  const modo = document.querySelector('input[name="modoNovoAno"]:checked').value;

  const ok = await chamarApiPost('criarAno', { anoOrigem: maxAno, anoNovo, modo });
  if (ok) {
    mostrarToast(`Ano ${anoNovo} criado`);
    anosDisponiveis.push(anoNovo);
    anoAtual = anoNovo;
    await carregarGrade();
  } else {
    mostrarToast('Erro ao criar o novo ano');
  }
});

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
  const anos = await chamarApiGet('anos');
  if (anos) {
    anosDisponiveis = anos.anos || [];
    anoAtual = anos.anoAtual || new Date().getFullYear();
  }
  await carregarGrade();
}

async function carregarGrade() {
  atualizarLabelAno();
  resumoAno.hidden = true;
  gradeContainer.innerHTML = '<p class="estado-vazio">Carregando…</p>';

  const maxAno = anosDisponiveis.length ? Math.max(...anosDisponiveis) : anoAtual - 1;
  if (anoAtual > maxAno) {
    renderGradeVazia();
    return;
  }

  const dados = await chamarApiGet('grade', { ano: anoAtual });
  if (!dados) {
    gradeContainer.innerHTML = '<p class="estado-vazio">Erro ao carregar. Confira a conexão.</p>';
    return;
  }

  gradeAtual = dados;
  renderGrade(gradeAtual);
}

function atualizarLabelAno() {
  labelAno.textContent = String(anoAtual);
}

function renderGradeVazia() {
  resumoAno.hidden = true;
  gradeContainer.innerHTML = `
    <div class="grade-vazia">
      <p>O ano ${anoAtual} ainda não foi criado.</p>
      <button type="button" class="btn-primario" id="btnCriarAnoInline">Criar ano ${anoAtual}</button>
    </div>
  `;
  document.getElementById('btnCriarAnoInline').addEventListener('click', abrirModalNovoAno);
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
      const ok = await chamarApiPost('limparCelula', { ano: anoAtual, mes, categoria });
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
    const ok = await chamarApiPost('salvarCelula', { ano: anoAtual, mes, categoria, valor });
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
  const ok = await chamarApiPost('excluirCategoria', { nome, ano: anoAtual });
  if (ok) {
    gradeAtual.categorias = gradeAtual.categorias.filter(c => c.Nome !== nome);
    gradeAtual.celulas = gradeAtual.celulas.filter(c => c.Categoria !== nome);
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
        const ok = await chamarApiPost('criarCategoria', { dados: { Nome: nome, Tipo: tipo, Ano: anoAtual } });
        if (ok) {
          gradeAtual.categorias.push({ Nome: nome, Tipo: tipo });
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

function abrirModalConfig() {
  document.getElementById('campoApiUrl').value = apiUrl;
  document.getElementById('campoApiToken').value = apiToken;
  modalConfig.showModal();
}

function abrirModalNovoAno() {
  const maxAno = anosDisponiveis.length ? Math.max(...anosDisponiveis) : anoAtual - 1;
  const anoNovo = maxAno + 1;
  document.getElementById('formNovoAno').reset();
  document.getElementById('labelNovoAno').textContent = anoNovo;
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
