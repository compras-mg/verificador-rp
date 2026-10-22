# Verificador RP para o SEI-MG

Extensão experimental para Google Chrome que localiza a planilha de Registro de Preços no processo aberto do SEI-MG, verifica os códigos CATMAS e prepara o memorando padrão.

## Instalação para teste

1. Descompacte o arquivo `verificador-rp-sei-0.5.8.zip` em uma pasta permanente.
2. No Chrome, digite `chrome://extensions` na barra de endereços.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação**.
5. Selecione a pasta `verificador-rp-sei` que contém o arquivo `manifest.json`.
6. Abra ou atualize o SEI-MG e entre em um processo. O botão vermelho **RP** aparecerá no final da barra de ações superior do processo.

O botão não aparece na página inicial do SEI. O ícone da extensão na barra do Chrome também abre e fecha o painel quando há um processo aberto.

## Fluxo de uso

1. Entre normalmente no SEI-MG e abra um processo.
2. Clique em **Verificador RP**.
3. Escolha a planilha identificada no processo. Se ela não aparecer, use **Selecionar do computador**.
4. Aguarde a verificação dos códigos CATMAS.
5. Se todos os itens estiverem habilitados, baixe a planilha conferida e clique em **Gerar memorando padrão**.
6. Confira os campos que não puderam ser obtidos automaticamente.
7. Copie o memorando e abra a inclusão de documento no SEI.
8. Escolha o tipo **Memorando**, cole o texto, revise e assine manualmente.

Ao gerar o memorando, a extensão tenta localizar o memorando imediatamente anterior à planilha analisada. O número SEI da nova planilha conferida permanece em branco até que o arquivo seja incluído no processo.

## Privacidade e permissões

- A extensão não lê nem armazena senhas.
- A planilha é processada localmente no navegador.
- Nenhum documento do processo é enviado a servidor externo.
- A consulta CATMAS é feita diretamente ao serviço público oficial em `https://www1.compras.mg.gov.br/servico/catalogo/itemmaterialservico/Consulta/pesquisar`. Apenas os códigos dos itens são enviados; nenhum arquivo ou número de processo é enviado.
- As consultas externas são feitas pelo service worker da extensão, sem credenciais.
- Não há consulta ao GitHub nem à base da Busca Dinâmica.
- O acesso ao SEI é limitado a `https://sei.mg.gov.br/sei/*` e `https://www.sei.mg.gov.br/sei/*`.
- A criação automática usa nível Público e aciona Salvar. A extensão nunca assina o memorando.

## Limites desta versão experimental

O SEI utiliza páginas e quadros internos que podem variar entre versões. A extensão procura planilhas e o botão de inclusão por rótulos e endereços conhecidos, mas poderá precisar de ajuste depois do primeiro teste em um processo real. O modo **Selecionar do computador** continua disponível como contingência.

## Atualizações durante o piloto

Quando receber uma nova versão, substitua a pasta antiga pela nova, abra `chrome://extensions` e clique no botão de recarregar da extensão. Para distribuição definitiva, a recomendação é publicar a extensão como não listada na Chrome Web Store.

## Versão 0.3.0 — consulta oficial

A leitura da planilha, a exportação e o memorando foram preservados. A verificação consulta materiais e serviços no portal, preserva os zeros dos códigos e elimina consultas duplicadas dentro da mesma análise. Cada nova análise consulta o portal novamente.

A regra de aprovação permanece a anterior: o campo oficial `espOkRegPrecos` deve ser booleano e verdadeiro. A situação do item é exibida, mas não altera essa regra. Não se introduziu a exigência adicional de situação ativa.

Falhas de rede, bloqueios, dados incompletos e códigos ambíguos ficam como não verificados. O memorando e a planilha aprovada só ficam disponíveis quando todos os resultados forem OK. Não há fallback automático para a base derivada.

As consultas são sequenciais, com prazo de 15 segundos por requisição e uma retentativa para timeout, falha de rede, HTTP 429 ou 5xx. Pesquisas paginadas são limitadas a 100 resultados e exigem código exato. Nenhum CAPTCHA é resolvido automaticamente. Se o portal bloquear o acesso, confira manualmente e repita a verificação depois.

### Instalar sobre a versão anterior

Descompacte o novo ZIP em uma pasta permanente. Em `chrome://extensions` ou `edge://extensions`, remova a versão anterior e use **Carregar sem compactação** na nova pasta `verificador-rp-sei`. Aceite a permissão de acesso ao Portal de Compras solicitada pelo navegador e atualize a página do SEI. Uma atualização na mesma pasta também pode ser feita substituindo seus arquivos e recarregando a extensão; confira a nova permissão.

### Validação

Os testes locais cobrem aprovação, reprovação, ausência, ambiguidade, campos incompletos, bloqueio HTTP, resposta inválida, paginação inconsistente, entrada inválida e paginação válida. A sintaxe dos scripts foi verificada.

A interface oficial foi identificada e consultada com sucesso na investigação anterior. Esta versão ainda precisa de validação instalada no Chrome/Edge com um processo real do SEI, inclusive comportamento de permissões e bloqueios do portal. O endpoint é interno ao portal e pode mudar sem aviso.

## Versão 0.4.0 — memorando Público

Depois da conferência, anexe a planilha conferida ao processo, informe seu número SEI e revise os campos do memorando. Clique em **Criar memorando Público no SEI**. A automação tenta selecionar Memorando, escolher texto inicial Nenhum, preencher Descrição, selecionar Público, salvar o cadastro, preencher as três áreas do CKEditor e acionar Salvar no editor. Cabeçalho, número, data e referência do modelo são preservados. A assinatura permanece manual.

Os dados ficam temporariamente em memória de sessão da extensão, por até 15 minutos, vinculados à aba e ao editor aberto por ela. Não são enviados a serviços externos. As novas permissões são armazenamento de sessão e execução no editor do SEI para integração com CKEditor.

Se o formato dos campos ou do modelo não for reconhecido, a extensão interrompe e informa o motivo. Pode já existir um documento vazio criado pelo primeiro Salvar: confira a árvore antes de iniciar outra criação. Uma falha não provoca repetição automática do cadastro. O comando Salvar é acionado, mas a confirmação de persistência deve ser conferida no SEI.

Implementação baseada nas capturas fornecidas. É necessário testar em um processo do SEI: as imagens não mostram os identificadores HTML, a API real do editor ou a confirmação de salvamento. Se não reconhecer a tela, envie o aviso exibido para ajuste.

## Versão 0.5.0 — anexar planilha ao SEI

O botão **Baixar planilha conferida** foi mantido. O novo botão **Anexar planilha conferida ao SEI** gera o mesmo XLSX e tenta abrir Incluir Documento → Externo. Preenche Tipo do Documento = Planilha, Nome na Árvore = Conferida, Data do Documento = dia atual no fuso de São Paulo, Formato = Nato-digital e Nível de Acesso = Público. Não preenche Número, Remetente, Interessados, Classificação por Assuntos ou Observações.

A extensão coloca o arquivo gerado no controle de seleção de arquivo do SEI e aguarda uma linha com o nome exato na Lista de Anexos antes de acionar Salvar. Não repete automaticamente o cadastro. A confirmação final de inclusão deve ser conferida na árvore. O número SEI deve ser informado manualmente no formulário do memorando nesta versão.

O envio automático suporta arquivos de até 4 MB para respeitar o armazenamento de sessão. Arquivos maiores continuam disponíveis para download e inclusão manual. Os bytes ficam temporariamente na sessão da extensão e são descartados após o comando de salvar ou cancelamento, no fechamento da aba ou quando a sessão expirada é consultada. Não são enviados ao Portal de Compras ou a outro serviço: o arquivo é anexado apenas no SEI.

O cadastro precisa ser reconhecido por rótulos HTML associados aos controles e ter exatamente um campo de arquivo. A extensão verifica também o número do processo visível nos quadros do SEI. Se não reconhecer o cadastro/processo, interrompe. Esta implementação foi construída a partir de capturas de tela: o upload e o salvamento ainda precisam ser validados no SEI real. Em caso de interrupção, confira o cadastro e a árvore antes de repetir; envie o aviso exibido para ajuste.

Os testes locais de consulta, memorando e coordenação do upload passaram, assim como a verificação de sintaxe e do ZIP. Não equivalem a um teste de inclusão no SEI autenticado.

## Correção 0.5.1

Formulário externo inspecionado no SEI-MG 5.0.4. O preenchimento agora usa os identificadores reais selSerie, txtDataElaboracao, txtNomeArvore, optNato, optPublico e filArquivo. A tela é reconhecida pelo título visível, e campos ainda em carregamento têm até 30 segundos para aparecer. O processo é confirmado por seu identificador interno, quando disponível, com conferência do hdnIdProcedimento no cadastro. Se a tela Externo já tiver sido aberta, o fluxo também pode continuar a partir dela. Um aviso detalha os controles não encontrados.

A estrutura do formulário foi conferida ao vivo, sem preencher, anexar ou salvar um documento durante a investigação. O envio completo da nova versão ainda precisa ser testado após instalação.

## Correção 0.5.2

Ao escolher Planilha, o SEI envia e recarrega o formulário. A automação agora aguarda a nova página, evita repetir a seleção e só então preenche os metadados e anexa o arquivo.

## Correção 0.5.3

Reconhece os memorandos nos links da árvore do SEI e preenche separadamente o número do memorando e seu número SEI. Atualiza a árvore ao abrir o formulário e identifica a última Planilha Conferida para preencher sua referência. Os campos continuam editáveis para revisão.

## Correção 0.5.4 — preservação da planilha

A exportação altera somente as células de conferência na coluna N da aba FORMULÁRIO, utilizando o XML original. Novas células são inseridas na ordem das colunas. As outras células e os demais arquivos internos do XLSX permanecem intactos, incluindo outras abas, fórmulas, estilos, imagens e tabelas de textos. A mesma correção atende ao download e ao envio para o SEI.

Testes de regressão cobrem colunas depois de N, células N existentes e vazias, namespaces, fórmulas, estilos e preservação dos demais membros do arquivo. A planilha específica que apresentou o problema ainda precisa ser comparada.

## Correção 0.5.5 — documentos sem duplicação

Ignora os controles de copiar texto/link do SEI e reúne os links do mesmo documento pelo identificador interno ou pelo número SEI explícito no rótulo. Links de visualização, download ou de quadros distintos deixam de aparecer como planilhas adicionais. Documentos diferentes com nomes iguais continuam separados. A correção de preservação das colunas do Excel da versão 0.5.4 permanece incluída.

## Correção 0.5.6 — botão único na barra do SEI

O botão RP aparece somente na barra de ações do processo/documento (divArvoreAcoes), ao lado dos comandos originais do SEI. Durante o carregamento dos quadros, a extensão aguarda essa barra em vez de usar o cabeçalho azul como alternativa. A sincronização remove cópias antigas de RP em todos os quadros acessíveis e preserva os outros botões, incluindo CRC.

A estrutura das duas barras foi inspecionada no SEI-MG 5.0.4. Os testes locais cobrem duplicação entre quadros, repetição da sincronização, navegação e ausência temporária da barra. Depois de substituir os arquivos e recarregar a extensão, atualize a página do SEI para ativar a correção.

## Correção 0.5.7 — alinhamento do botão RP

O botão RP passa a medir 40 × 40 pixels, com margem vertical de 3 pixels e alinhamento pelo topo dos ícones da barra de ações. O texto permanece centralizado na horizontal e na vertical.

## Correção 0.5.8 — botão CATMAS RP

O botão da barra do SEI exibe CATMAS em uma linha menor no alto e RP em uma linha maior abaixo. As duas linhas ficam centralizadas no botão de 40 × 40 pixels, com alinhamento pelo topo e margem vertical de 3 pixels.
