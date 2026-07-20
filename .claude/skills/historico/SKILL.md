---
name: historico
description: Mantém o HISTORICO.md deste projeto (app-financeiro) atualizado. Use SEMPRE que terminar de implementar, corrigir ou fazer deploy de uma mudança relevante neste repositório — antes ou logo depois do commit — para registrar o que mudou e por quê. Também use quando o usuário pedir explicitamente para "registrar", "documentar" ou "atualizar o histórico" do projeto, ou quando ele perguntar sobre o passado/evolução do app.
---

# Histórico do projeto

Este projeto mantém um `HISTORICO.md` na raiz do repo com o registro cronológico de tudo que já foi feito — de onde o app veio (planilha Google Sheets) até o estado atual (Supabase + login Google) — e continua sendo atualizado a cada mudança relevante.

## Ao terminar uma mudança no código

1. Leia o final do `HISTORICO.md` pra saber o tom e o nível de detalhe das entradas existentes (concisas, em português, foco no *porquê* e não só no *o quê*).
2. Adicione uma nova entrada **no final do arquivo**, nunca reescreva entradas antigas. Se a mudança de hoje pertence à mesma leva de trabalho de uma entrada já existente com a mesma data, edite essa entrada em vez de criar uma nova.
3. Formato de cada entrada: um cabeçalho `## Título curto (AAAA-MM-DD)` seguido de um parágrafo ou lista curta explicando o que mudou, por que, e qualquer decisão não óbvia (trade-off escolhido, bug encontrado e como foi resolvido, etc). Não liste arquivo por arquivo — resuma a intenção.
4. Se a mudança for um bugfix de algo registrado numa entrada recente (ex: um deploy que quebrou e foi corrigido na sequência), pode acrescentar a correção como um parágrafo dentro da mesma entrada em vez de criar uma nova — como já foi feito na entrada da migração pro Supabase.
5. Não precisa pedir permissão pro usuário pra editar o `HISTORICO.md` — é infraestrutura de documentação, não um arquivo de produto.

## Escopo

Só registre mudanças que afetem o app de fato: features, redesigns, migrações de arquitetura, bugs relevantes e como foram resolvidos, decisões de produto (ex: "não migrar dados antigos", "web-first"). Não registre passos triviais (renomear uma variável, ajuste de 1 linha) a menos que tenham sido parte de uma investigação/decisão que vale a pena lembrar depois.
