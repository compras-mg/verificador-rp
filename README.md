# Verificador RP

Aplicação estática e independente para conferir, no navegador, os códigos CATMAS de uma planilha de solicitação de Registro de Preços.

## Fluxo

1. O usuário seleciona uma planilha `.xlsx` retirada do SEI.
2. A aplicação lê os códigos da coluna A da aba `FORMULÁRIO`, a partir da linha 11.
3. Cada código é procurado primeiro exatamente como foi preenchido. Se não for encontrado e tiver menos de nove dígitos, a aplicação tenta novamente adicionando zeros à esquerda.
4. A página informa os itens não encontrados ou não marcados como `OK para RP`.
5. Quando todos estão corretos, a aplicação gera uma cópia do arquivo com `OK` na coluna N das linhas verificadas.

O arquivo é processado localmente no navegador. A aplicação preserva o pacote original do Excel e modifica somente as células de resultado na coluna N.

## Histórico compartilhado

A barra lateral consulta uma API pública separada e mostra as 20 validações mais recentes da equipe. O histórico armazena somente data e hora, resultado e quantidades de itens aprovados e pendentes. A planilha, o nome do arquivo e os códigos CATMAS não são enviados nem armazenados.

API: `https://verificador-rp-historico.fjunior-alves-olivei.chatgpt.site/api/validations`

## Publicação separada

Este diretório deve ser publicado em um repositório próprio no GitHub Pages. Ele não precisa ser incorporado ao repositório nem à interface da consulta CATMAS existente. A única dependência compartilhada é a leitura da base pública:

`https://compras-mg.github.io/catmas/data.db.gz`

Para testar localmente, sirva o diretório por HTTP, por exemplo:

```bash
python -m http.server 8000 --directory verificador-rp
```

Depois abra `http://localhost:8000`.
