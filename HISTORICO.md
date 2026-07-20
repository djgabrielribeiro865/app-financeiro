# Histórico do app-financeiro

Registro cronológico do projeto: de onde veio e cada mudança relevante feita desde então. Serve pra qualquer sessão futura (Claude ou humana) entender o "porquê" sem precisar reconstruir tudo pelo `git log`.

Novas entradas vão sempre no **final** do arquivo (ordem cronológica crescente), adicionadas pela skill `historico`.

---

## Origem — planilha Google Sheets (até 2026-07-12)

App nasceu como PWA estático (vanilla JS, sem build), com um Google Apps Script (`Code.gs`) publicado como Web App fazendo de backend, lendo/escrevendo numa planilha Google Sheets. Autenticação era um token compartilhado, digitado uma vez e salvo no `localStorage`. Views iniciais eram por mês, com um "orçamento" por categoria (Variável/Fixo) que depois saiu de uso.

## Grade anual categoria × mês (2026-07-12 a 2026-07-13)

- **2026-07-12** — Gerenciamento de categorias adicionado; service worker passa a usar estratégia network-first (sempre busca versão nova, cai pro cache só offline).
- **2026-07-13** — A visão mensal é substituída pela **grade anual**: linhas são categorias (agrupadas em Saídas/Entradas), colunas são os 12 meses do ano selecionado, células editáveis diretamente na tabela. Rodapé mostra totais de Entradas/Saídas/Saldo ao vivo. Navegação por ano substitui a navegação por mês. Categoria ganha coluna `Ano` (categorias passam a ser por ano) e o campo `Tipo` deixa de ser Variável/Fixo pra virar Saída/Entrada. Nasce a aba `Anos` e os endpoints `anos`, `grade`, `salvarCelula`, `limparCelula`, `criarAno` no `Code.gs`.
- **2026-07-13** — Criação/remoção de categoria (linha da grade) passa a ser inline na própria tabela (botão "+ nova saída/entrada" e "×" por linha), substituindo o modal separado de gerenciar categorias.

## Ajustes de comportamento (2026-07-16)

- Grade ganha mais espaço em telas largas (900px/1200px), tipografia/padding/hover melhores, mantendo o layout mobile.
- Excluir uma categoria passa a apagar também os lançamentos daquele ano na planilha, com confirmação mais explícita no frontend (ação irreversível).

## Redesign visual + web-first (2026-07-18)

Sequência de commits no mesmo dia, todos incrementando a versão de cache (`v3` → `v8`):

- Nova identidade visual: paleta grafite (`#0F0F11`) com laranja de destaque (`#F58220`), card de resumo do ano, grade repaginada (coluna/cabeçalho fixos, seções coloridas, mês atual destacado), topbar com ícones SVG, modais/toast redesenhados.
- App vira **web-first**: containers alargados (max-width 1400px), a partir de 1024px a grade ocupa 100% da largura sem rolagem lateral. *(Ver [[project_web_first]] na memória — decisão consciente de não focar mais em celular.)*
- Botões renomeados pra "Nova entrada"/"Nova saída"; botão de criar ano sai do topo e vira ação inline "Criar ano XXXX" só quando o próximo ano ainda não existe (a seta vira um "+" nesse caso).
- Performance de troca de ano: cache em memória das grades já visitadas (troca instantânea, revalidação silenciosa em segundo plano) + prefetch dos anos vizinhos.

## Migração planilha → Supabase + login Google (2026-07-20)

Decisão do usuário: o app ficaria público no GitHub Pages guardando dados financeiros pessoais, então o modelo de token compartilhado não bastava mais. Trocado por:

- Backend Postgres no [Supabase](https://supabase.com), schema em `supabase_schema.sql` (tabelas `years`, `categories`, `entries`, todas com Row Level Security restringindo por `user_id = auth.uid()`).
- Login real via Google (Supabase Auth), no lugar do token em `localStorage`. `Code.gs` (Apps Script) removido do repo.
- Sem migração de dados antigos — começou zerado no Supabase por decisão do usuário.
- **Depuração pós-deploy**: o botão "Entrar com Google" não reagia a clique nenhum. Causa raiz: `app.js` declarava `const supabase`, colidindo com a variável global `supabase` que o script UMD do supabase-js (carregado via CDN) já cria — isso jogava um `SyntaxError` e quebrava o arquivo inteiro. Corrigido renomeando a instância do client pra `sb`. Durante a correção, dois problemas secundários apareceram e foram resolvidos: (1) um `sed`/`perl` malfeito trocou também o texto "supabase" dentro da própria `SUPABASE_URL`, corrompendo-a; (2) o GitHub Pages manda `cache-control: max-age=600` tanto no `index.html` quanto no `sw.js`, então fixes sem subir o `?v=` dos assets ficavam presos em cache do navegador por até 10 minutos — e o próprio `sw.js` (que faz "network-first") não bypassava o cache HTTP do navegador nas buscas, então "network-first" na prática virava "cache de até 10 min primeiro". Resolvido subindo a versão dos assets a cada fix e adicionando `{ cache: 'no-store' }` no `fetch()` do service worker.
- **Flash da tela de login após o OAuth**: depois de escolher a conta Google, o usuário via a tela de login por um instante antes do app carregar, dando a impressão de que o login tinha falhado/voltado pro início. Na prática a sessão era criada normalmente (confirmado via `sb.auth.getSession()` logo após o redirect) — o que faltava era um estado "carregando" enquanto o Supabase processa o retorno do OAuth, já que o app mostrava a tela de login por padrão até o primeiro evento de `onAuthStateChange` chegar. Adicionada uma tela `carregandoAuth` neutra (só a marca), exibida por padrão, e as telas de login/app só decidem qual mostrar depois desse primeiro evento.
- **Tela de carregamento ficava presa por cima do app já logado**: a correção acima teve um bug de CSS — a classe `.login-overlay` (usada tanto pela tela de login quanto pela de carregamento) define `display: flex`, que empata em especificidade com a regra padrão do navegador `[hidden] { display: none }`; como a regra da classe vem depois no `style.css`, ela vencia mesmo com `hidden = true` setado via JS, deixando a tela de carregamento visualmente por cima do app (mesmo já autenticado e com os dados carregados por baixo). Corrigido com uma regra global `[hidden] { display: none !important; }`.

## Rebranding para "App Financial" (2026-07-20)

Nome exibido no app trocado de "Financeiro"/"Controle Financeiro" para "App Financial": título da aba, marca no topbar, tela de login e `manifest.json` (nome do PWA). Puramente de nome/exibição, sem mudança de comportamento.

No topbar, o indicador do usuário logado passou a mostrar o nome (`user_metadata.full_name`/`name` vindo do Google) em vez do e-mail, caindo pro e-mail só se o provedor não mandar nome.

## Menu lateral + tela "Contas a pagar" (2026-07-20)

O app deixa de ser uma tela única: a topbar fixa vira uma sidebar de navegação (drawer em telas estreitas, persistente em telas largas) com dois itens — "Grade anual" (a tela que já existia) e a nova "Contas a pagar".

- **Contas a pagar**: checklist vertical de contas (água, luz, cartão...) agrupadas por categoria (ex: "Apartamento" com Condomínio, Água, Luz, Internet Vivo), cada item com checkbox de pago/não pago e um valor opcional — alguns itens têm valor controlado, outros só o status de pago, conforme pedido pelo usuário.
- Navegação por **mês** (não por ano como a grade), já que contas são mensais. Ao cruzar pra um ano ainda sem grupos criados, mesmo fluxo de "criar ano" já usado na grade: copiar grupos/itens/valores do ano anterior ou começar zerado.
- Modelo de dados novo no Supabase (`supabase_migration_contas.sql`): `bill_years` (registro de quais anos foram criados — necessário porque, ao contrário da grade, um ano de contas pode legitimamente começar com zero grupos, então não dava pra derivar "ano existe" só olhando se há grupos), `bill_groups`, `bill_items`, `bill_entries` (estado por mês: pago + valor opcional), todas com RLS por `user_id`.
- Reaproveita a lógica e boa parte do CSS já existentes na grade (edição inline de valor, confirmação ao excluir, cache em memória por mês, padrão visual do card de resumo) em vez de introduzir padrões novos.

A pedido do usuário, a sidebar virou um drawer (fecha sozinha a cada seleção de item do menu, abre com o botão hambúrguer) em **qualquer** tamanho de tela, não só no mobile como na primeira versão — o botão hambúrguer agora fica sempre visível numa topbar fina no topo.
