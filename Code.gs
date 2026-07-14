/**
 * BACKEND - App Financeiro (Gabriel)
 * Google Apps Script vinculado à planilha "Controle Financeiro"
 *
 * COMO INSTALAR:
 * 1. Abra a planilha "Controle Financeiro" no Drive
 * 2. Menu Extensões > Apps Script
 * 3. Apague o conteúdo padrão e cole todo este arquivo
 * 4. Rode a função "configurarToken" uma vez (ela vai pedir autorização)
 * 5. Clique em "Implantar" > "Nova implantação"
 *    - Tipo: Aplicativo da web
 *    - Executar como: Eu (sua conta)
 *    - Quem pode acessar: Qualquer pessoa
 * 6. Copie a URL gerada (termina em /exec) - é o endereço da sua API
 *
 * AUTENTICAÇÃO:
 * Toda chamada precisa do parâmetro "token" (definido em configurarToken).
 * Isso evita que outras pessoas usem sua API mesmo sabendo a URL.
 *
 * MUDANÇAS NESTA VERSÃO (grade anual categoria x mês):
 * - Aba "Categorias" passa a ter 3 colunas: Nome, Tipo (Saída/Entrada), Ano.
 *   Categorias agora são por ano; "Valor planejado mensal" saiu (não tinha
 *   mais consumidor desde que a visão de orçamento por categoria saiu do app).
 * - Nova aba "Anos" (uma coluna "Ano") registra quais anos já foram criados.
 * - Aba "Lançamentos" continua igual (Data, Categoria, Descricao, Valor, Tipo).
 *   Cada célula da grade (categoria + ano + mês) vira no máximo 1 linha aqui.
 */

const NOME_ABA_CATEGORIAS = 'Categorias';
const NOME_ABA_LANCAMENTOS = 'Lançamentos';
const NOME_ABA_CONFIG = 'Config';
const NOME_ABA_ANOS = 'Anos';

// ---------- SETUP ----------

/**
 * Rode esta função UMA VEZ manualmente pelo editor do Apps Script
 * (selecione ela no dropdown de funções e clique em Executar).
 * Ela gera um token aleatório e salva nas propriedades do script.
 */
function configurarToken() {
  const token = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('API_TOKEN', token);
  Logger.log('Token gerado: ' + token);
  Logger.log('Guarde esse token, você vai usar no frontend.');
}

// ---------- ROTEAMENTO ----------

function doGet(e) {
  try {
    validarToken(e);
    const action = e.parameter.action;

    switch (action) {
      case 'categorias':
        return responderJson(getCategoriasPorAno(e.parameter.ano));
      case 'anos':
        return responderJson(getAnos());
      case 'grade':
        return responderJson(getGrade(e.parameter.ano));
      case 'lancamentos':
        return responderJson(getLancamentos(e.parameter.mes));
      case 'config':
        return responderJson(getConfig());
      case 'resumo':
        return responderJson(getResumoMensal(e.parameter.mes));
      default:
        return responderErro('Ação inválida ou não informada.');
    }
  } catch (err) {
    return responderErro(err.message);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    validarTokenBody(body);
    const action = body.action;

    switch (action) {
      case 'salvarCelula':
        return responderJson(salvarCelula(body.ano, body.mes, body.categoria, body.valor));
      case 'limparCelula':
        return responderJson(limparCelula(body.ano, body.mes, body.categoria));
      case 'criarAno':
        return responderJson(criarAno(body.anoOrigem, body.anoNovo, body.modo));
      case 'criarLancamento':
        return responderJson(criarLancamento(body.dados));
      case 'editarLancamento':
        return responderJson(editarLancamento(body.linha, body.dados));
      case 'excluirLancamento':
        return responderJson(excluirLancamento(body.linha));
      case 'atualizarCategoria':
        return responderJson(atualizarCategoria(body.nome, body.dados));
      case 'criarCategoria':
        return responderJson(criarCategoria(body.dados));
      case 'excluirCategoria':
        return responderJson(excluirCategoria(body.nome, body.ano));
      default:
        return responderErro('Ação inválida ou não informada.');
    }
  } catch (err) {
    return responderErro(err.message);
  }
}

// ---------- AUTENTICAÇÃO ----------

function validarToken(e) {
  const tokenSalvo = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (!tokenSalvo || e.parameter.token !== tokenSalvo) {
    throw new Error('Token inválido ou não informado.');
  }
}

function validarTokenBody(body) {
  const tokenSalvo = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (!tokenSalvo || body.token !== tokenSalvo) {
    throw new Error('Token inválido ou não informado.');
  }
}

// ---------- LEITURA ----------

function getAba(nome) {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getSheetByName(nome);
  if (!aba) throw new Error('Aba não encontrada: ' + nome);
  return aba;
}

function abaParaObjetos(aba) {
  const valores = aba.getDataRange().getValues();
  const cabecalho = valores[0];
  const linhas = valores.slice(1).filter(linha => linha.join('') !== '');
  return linhas.map((linha, i) => {
    const obj = { _linha: i + 2 }; // linha real na planilha (considerando cabeçalho)
    cabecalho.forEach((campo, idx) => {
      obj[campo] = linha[idx];
    });
    return obj;
  });
}

function getCategorias() {
  return abaParaObjetos(getAba(NOME_ABA_CATEGORIAS));
}

function getCategoriasPorAno(ano) {
  return getCategorias().filter(c => Number(c.Ano) === Number(ano));
}

function getAnos() {
  const anos = abaParaObjetos(getAba(NOME_ABA_ANOS))
    .map(o => Number(o.Ano))
    .sort((a, b) => a - b);
  const anoCalendario = new Date().getFullYear();
  const anoAtual = anos.indexOf(anoCalendario) !== -1
    ? anoCalendario
    : (anos.length ? anos[anos.length - 1] : anoCalendario);
  return { anos, anoAtual };
}

function getLancamentos(mes) {
  const todos = abaParaObjetos(getAba(NOME_ABA_LANCAMENTOS));
  if (!mes) return todos;
  return todos.filter(l => formatarMes(l.Data) === mes);
}

function getConfig() {
  const objetos = abaParaObjetos(getAba(NOME_ABA_CONFIG));
  return objetos[0] || {};
}

// Endpoint legado, não é mais chamado pelo frontend (a grade substituiu a
// visão de orçamento por mês). Deixado como está; como getCategorias() agora
// devolve categorias de todos os anos juntas, o cálculo aqui deixou de fazer
// sentido isolado por ano - só usar de novo se for reescrito para receber ano.
function getResumoMensal(mes) {
  const mesAlvo = mes || formatarMes(new Date());
  const categorias = getCategorias();
  const lancamentos = getLancamentos(mesAlvo);

  const resumo = categorias.map(cat => {
    const gastoReal = lancamentos
      .filter(l => l.Categoria === cat.Nome && l.Tipo === 'Saída')
      .reduce((soma, l) => soma + Number(l.Valor || 0), 0);
    return {
      categoria: cat.Nome,
      tipo: cat.Tipo,
      realizado: gastoReal
    };
  });

  const totalEntradas = lancamentos
    .filter(l => l.Tipo === 'Entrada')
    .reduce((soma, l) => soma + Number(l.Valor || 0), 0);
  const totalSaidas = lancamentos
    .filter(l => l.Tipo === 'Saída')
    .reduce((soma, l) => soma + Number(l.Valor || 0), 0);

  return { mes: mesAlvo, categorias: resumo, totalEntradas, totalSaidas };
}

function formatarMes(data) {
  const d = new Date(data);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return ano + '-' + mes;
}

function mesmoAnoMes(data, ano, mes) {
  if (!data) return false;
  const d = new Date(data);
  return d.getFullYear() === Number(ano) && (d.getMonth() + 1) === Number(mes);
}

function tipoDaCategoria(nome) {
  const cat = getCategorias().find(c => c.Nome === nome);
  return cat ? cat.Tipo : '';
}

// ---------- GRADE ANUAL ----------

function getGrade(ano) {
  const categorias = getCategoriasPorAno(ano);
  const lancamentos = abaParaObjetos(getAba(NOME_ABA_LANCAMENTOS));

  const porChave = {};
  lancamentos.forEach(l => {
    if (!l.Data) return;
    const d = new Date(l.Data);
    if (d.getFullYear() !== Number(ano)) return;
    const mes = d.getMonth() + 1;
    const chave = l.Categoria + '|' + mes;
    if (!porChave[chave]) porChave[chave] = { soma: 0, temValor: false };
    if (l.Valor !== '' && l.Valor !== null && l.Valor !== undefined) {
      porChave[chave].soma += Number(l.Valor);
      porChave[chave].temValor = true;
    }
  });

  const celulas = Object.keys(porChave).map(chave => {
    const partes = chave.split('|');
    const info = porChave[chave];
    return {
      Categoria: partes[0],
      Mes: Number(partes[1]),
      Valor: info.temValor ? info.soma : null
    };
  });

  return {
    categorias: categorias.map(c => ({ Nome: c.Nome, Tipo: c.Tipo })),
    celulas
  };
}

function salvarCelula(ano, mes, categoria, valor) {
  const aba = getAba(NOME_ABA_LANCAMENTOS);
  const todos = abaParaObjetos(aba);
  const existentes = todos.filter(l => l.Categoria === categoria && mesmoAnoMes(l.Data, ano, mes));

  const valorFinal = (valor === null || valor === undefined || valor === '') ? '' : Number(valor);
  const novaData = new Date(Number(ano), Number(mes) - 1, 1);
  const tipo = tipoDaCategoria(categoria);

  if (existentes.length > 0) {
    const principal = existentes[0];
    aba.getRange(principal._linha, 1, 1, 5)
      .setValues([[novaData, categoria, principal.Descricao || '', valorFinal, tipo]]);

    // Consolida duplicatas antigas (de antes da grade existir) numa linha só.
    existentes.slice(1)
      .sort((a, b) => b._linha - a._linha)
      .forEach(dup => aba.deleteRow(dup._linha));
  } else {
    aba.appendRow([novaData, categoria, '', valorFinal, tipo]);
  }

  return { sucesso: true };
}

function limparCelula(ano, mes, categoria) {
  const aba = getAba(NOME_ABA_LANCAMENTOS);
  const todos = abaParaObjetos(aba);
  const existentes = todos.filter(l => l.Categoria === categoria && mesmoAnoMes(l.Data, ano, mes));

  existentes
    .sort((a, b) => b._linha - a._linha)
    .forEach(l => aba.deleteRow(l._linha));

  return { sucesso: true };
}

function criarAno(anoOrigem, anoNovo, modo) {
  const anosExistentes = getAnos().anos;
  if (anosExistentes.indexOf(Number(anoNovo)) !== -1) {
    throw new Error('O ano ' + anoNovo + ' já existe.');
  }

  const categoriasOrigem = getCategoriasPorAno(anoOrigem);
  const abaCategorias = getAba(NOME_ABA_CATEGORIAS);
  categoriasOrigem.forEach(cat => {
    abaCategorias.appendRow([cat.Nome, cat.Tipo, Number(anoNovo)]);
  });

  if (modo === 'copiar') {
    const abaLancamentos = getAba(NOME_ABA_LANCAMENTOS);
    const lancamentosOrigem = abaParaObjetos(abaLancamentos).filter(l => {
      if (!l.Data) return false;
      return new Date(l.Data).getFullYear() === Number(anoOrigem);
    });
    lancamentosOrigem.forEach(l => {
      const d = new Date(l.Data);
      const novaData = new Date(Number(anoNovo), d.getMonth(), d.getDate());
      abaLancamentos.appendRow([novaData, l.Categoria, l.Descricao, l.Valor, l.Tipo]);
    });
  }

  getAba(NOME_ABA_ANOS).appendRow([Number(anoNovo)]);

  return { sucesso: true };
}

// ---------- ESCRITA ----------

function criarLancamento(dados) {
  const aba = getAba(NOME_ABA_LANCAMENTOS);
  aba.appendRow([dados.Data, dados.Categoria, dados.Descricao, dados.Valor, dados.Tipo]);
  return { sucesso: true };
}

function editarLancamento(linha, dados) {
  const aba = getAba(NOME_ABA_LANCAMENTOS);
  aba.getRange(linha, 1, 1, 5).setValues([[dados.Data, dados.Categoria, dados.Descricao, dados.Valor, dados.Tipo]]);
  return { sucesso: true };
}

function excluirLancamento(linha) {
  const aba = getAba(NOME_ABA_LANCAMENTOS);
  aba.deleteRow(linha);
  return { sucesso: true };
}

// Legado, não é mais chamado pelo frontend. Casa só por Nome (primeiro
// encontrado) - se uma mesma categoria existir em vários anos, atualiza a
// primeira linha que achar. Não usar sem revisar caso volte a ser chamado.
function atualizarCategoria(nome, dados) {
  const aba = getAba(NOME_ABA_CATEGORIAS);
  const valores = aba.getDataRange().getValues();
  for (let i = 1; i < valores.length; i++) {
    if (valores[i][0] === nome) {
      aba.getRange(i + 1, 1, 1, 2).setValues([[dados.Nome, dados.Tipo]]);
      return { sucesso: true };
    }
  }
  throw new Error('Categoria não encontrada: ' + nome);
}

function criarCategoria(dados) {
  const aba = getAba(NOME_ABA_CATEGORIAS);
  const valores = aba.getDataRange().getValues();
  const jaExiste = valores.slice(1).some(linha => linha[0] === dados.Nome && Number(linha[2]) === Number(dados.Ano));
  if (jaExiste) throw new Error('Já existe uma categoria com esse nome neste ano.');
  aba.appendRow([dados.Nome, dados.Tipo, Number(dados.Ano)]);
  return { sucesso: true };
}

function excluirCategoria(nome, ano) {
  const aba = getAba(NOME_ABA_CATEGORIAS);
  const valores = aba.getDataRange().getValues();
  for (let i = 1; i < valores.length; i++) {
    if (valores[i][0] === nome && Number(valores[i][2]) === Number(ano)) {
      aba.deleteRow(i + 1);
      return { sucesso: true };
    }
  }
  throw new Error('Categoria não encontrada: ' + nome);
}

// ---------- RESPOSTA ----------

function responderJson(dados) {
  return ContentService.createTextOutput(JSON.stringify(dados))
    .setMimeType(ContentService.MimeType.JSON);
}

function responderErro(mensagem) {
  return ContentService.createTextOutput(JSON.stringify({ erro: mensagem }))
    .setMimeType(ContentService.MimeType.JSON);
}
