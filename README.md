# Verificador RP

## Extensão CATMAS RP para o SEI-MG — versão 0.5.9

A extensão funciona dentro do SEI-MG, consulta os itens CATMAS diretamente no Portal de Compras, gera a planilha conferida e automatiza a inclusão da planilha e a preparação do memorando público. A assinatura do memorando permanece manual.

- [Baixar a extensão 0.5.9 (ZIP)](https://github.com/compras-mg/verificador-rp/raw/refs/heads/main/dist/verificador-rp-sei-0.5.9.zip)
- [Código da extensão](extensao/verificador-rp-sei/)
- [Instalação, funcionamento e histórico de versões](extensao/verificador-rp-sei/README.md)
- [Testes locais](extensao/tests/)
- [SHA-256 do pacote](dist/SHA256SUMS)

Para instalar, descompacte o ZIP e selecione a pasta `verificador-rp-sei` em **Carregar sem compactação**, na página `chrome://extensions` ou `edge://extensions`. Para atualizar uma instalação existente, substitua os arquivos da pasta instalada, recarregue a extensão e atualize o SEI.

A versão 0.5.9 compara a especificação de **B:F** com o Portal de Compras e alerta sobre conteúdo em **G (complementação da especificação)** e **H (especificação longa)**. As pendências indicam linha, coluna e motivo, mesmo quando o código está OK para RP. A planilha conferida e o memorando ficam disponíveis quando todas as linhas estão sem pendências.

Também preserva as colunas e mesclagens do Excel, evita documentos duplicados e mantém um único botão **CATMAS / RP**, em duas linhas, alinhado à barra de ações do SEI. Os testes locais passaram com planilhas fictícias e portal simulado; a nova conferência ainda requer validação no SEI real.

## Ferramenta web anterior

A página `index.html` mantém a ferramenta web anterior, descrita abaixo. A extensão 0.5.9 está na pasta `extensao/` e consulta diretamente o portal oficial.

Aplicação estática e independente para conferir, no navegador, os códigos CATMAS de uma planilha de solicitação de Registro de Preços.

## Fluxo

1. O usuário seleciona uma planilha `.xlsx` retirada do SEI.
2. A aplicação lê os códigos da coluna A da aba `FORMULÁRIO`, a partir da linha 11.
3. Cada código é procurado primeiro exatamente como foi preenchido. Se não for encontrado e tiver menos de nove dígitos, a aplicação tenta novamente adicionando zeros à esquerda.
4. A página informa os itens não encontrados ou não marcados como `OK para RP`.
5. Quando todos estão corretos, a aplicação gera uma cópia do arquivo com `OK` na coluna N das linhas verificadas.

O arquivo é processado localmente no navegador. A aplicação preserva o pacote original do Excel e modifica somente as células de resultado na coluna N.

## Histórico compartilhado

A barra lateral consulta uma API pública separada e mostra as 20 validações mais recentes da equipe. O histórico armazena o nome do arquivo, data e hora, resultado e quantidades de itens aprovados e pendentes. O conteúdo da planilha e os códigos CATMAS não são enviados nem armazenados.

API: `https://verificador-rp-historico.fjunior-alves-olivei.chatgpt.site/api/validations`

## Publicação separada

Este diretório deve ser publicado em um repositório próprio no GitHub Pages. Ele não precisa ser incorporado ao repositório nem à interface da consulta CATMAS existente. A única dependência compartilhada é a leitura da base pública:

`https://compras-mg.github.io/catmas/data.db.gz`

Para testar localmente, sirva o diretório por HTTP, por exemplo:

```bash
python -m http.server 8000 --directory verificador-rp
```

Depois abra `http://localhost:8000`.

