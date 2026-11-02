# CLAUDE.md: Organizador de Coleção Pokémon GO

App web pessoal para organizar minha coleção de Pokémon GO. Meu objetivo é ter **1 exemplar de cada vaga possível, de tudo**, e o app me diz o que **manter**, **trocar** ou **descartar**.

Converse comigo em português. Se algo estiver ambíguo, pergunte antes de assumir.

## Como trabalhar neste projeto

- **TDD obrigatório em todo o projeto, sem exceção.** Escreva o teste que falha, implemente o mínimo para passar, refatore. Isso vale para o núcleo de regras, a calculadora de IV, o gerador de IDs, o importador de CSV, a exportação/importação de backup, o armazenamento local **e a interface** (testes de componentes para cada tela e interação). Nenhum código de produção é escrito sem um teste falhando antes. Se algo for difícil de testar, me avise em vez de pular o teste.
- **Núcleo primeiro, interface depois.** Todo o domínio (vagas, IV, cascata, status, IDs) vive num módulo puro, sem dependência de interface nem de armazenamento. A interface só entra quando o núcleo estiver coberto por testes.
- Rode a suíte de testes a cada mudança e não considere uma tarefa concluída com teste falhando.
- Mudanças pequenas e incrementais; explique o que mudou em poucas linhas.
- Sugestão de stack (confirme comigo antes de começar): TypeScript, Vitest para testes, app web sem backend. Dados salvos localmente (IndexedDB ou localStorage) com **exportar/importar backup em JSON**.

## Glossário

- **Vaga:** uma posição que um Pokémon pode ocupar na minha coleção (ex.: Pikachu brilhante, Pikachu com traje X, Raichu XXL).
- **Exemplar:** um Pokémon específico que eu tenho.
- **Origem:** capturado ou recebido em troca.
- **Reserva:** exemplar da fase anterior guardado para uma evolução que ainda não fiz (status *aguardando evolução*).

## Sistema de vagas

Cada espécie tem vagas **geradas automaticamente** a partir da tabela de espécies. Um exemplar pode preencher **várias vagas ao mesmo tempo** (ex.: fêmea brilhante, sortuda e XXL). Cada vaga é ocupada pelo exemplar de **maior IV** que se encaixa nela.

Categorias de vaga por espécie:

- **Evolução:** uma vaga por fase da cadeia (ex.: Pichu / Pikachu / Raichu).
- **Formas de potencial:** Mega, Dinamax, Gigamax. A vaga existe se a espécie **pode** ter a forma; não preciso ter evoluído ou usado.
- **Rocket:** Normal, Sombroso, Purificado.
- **Troca:** Normal, Sortudo.
- **Raridade:** Normal, Brilhante.
- **Traje:** cada traje específico é uma vaga própria, e "sem traje" também. Trajes podem ser de evento e podem ser brilhantes (a versão brilhante de cada traje é outra vaga, quando existir).
- **Fundo:** cada fundo específico é uma vaga própria (Normal, Fundo de Localidade, Fundo Especial, Efeito de Aventura). **A lista de fundos não vem pronta:** ao registrar um Pokémon com um fundo novo, o fundo passa a existir e vira vaga para as espécies que puderem tê-lo.
- **Tamanho:** Normal, XXL, XXS.
- **Sexo:** Macho, Fêmea (só para espécies que têm os dois; respeitar espécies sem gênero ou de um sexo só).

## Regras de decisão

Todo exemplar recebe um status calculado automaticamente:

- **Manter:** é o de maior IV em pelo menos uma vaga (ou o único que a preenche).
- **Trocar:** não é o melhor em nenhuma vaga **e** foi capturado por mim.
- **Descartar:** não é o melhor em nenhuma vaga **e** veio de troca (Pokémon recebido por troca não pode ser trocado de novo).

Consequência: todo sortudo vem de troca, então um sortudo sem vaga é sempre "descartar".

**Desempate de IV:** com IV igual para uma vaga, fica o **mais antigo**. Por isso cada exemplar guarda a **data de captura ou recebimento**.

## Regra da cadeia de evolução

- Um exemplar ocupa **uma vaga de evolução só**: a da **maior evolução disponível** para ele.
- O maior IV vai para a maior evolução da cadeia.
- Exemplo (Pichu / Pikachu / Raichu): meu único Pikachu 96% fica **reservado para Raichu** (*aguardando evolução*); a vaga Pikachu fica livre.
- **Cascata:** ao entrar, editar ou remover um exemplar, o app reordena a cadeia toda. Ex.: Pikachu 85% ocupa a vaga Pikachu; depois entra um 98%, que vira o reservado de Raichu; o de 96% desce para a vaga Pikachu; o de 85% perde a vaga (vira "trocar" ou "descartar", conforme a origem).
- Quando eu evoluir de fato, a reserva vira vaga preenchida sem recadastrar.
- O app reordena **sempre sozinho**, sem travas manuais.

## ID de cada vaga (variação)

Cada vaga tem um **ID próprio**, que eu uso para **renomear meus Pokémon no jogo**.

- O ID identifica a **vaga**, não o exemplar. Se outro exemplar assumir a vaga (cascata), o ID da vaga **não muda**; muda quem deve ser renomeado.
- Requisitos do ID: **único**, **estável** (gerado de forma determinística a partir de espécie, fase da cadeia e atributos da vaga), **curto o bastante para o limite de apelido do jogo** (a confirmar, creio que 12 caracteres) e legível por humanos.
- Formato exato: proponha opções com exemplos e me peça para escolher antes de implementar. O formato não deve quebrar quando eu adicionar atributos ou categorias novas.
- O app deve mostrar o **"renomear para: ID"** em cada exemplar, com botão de copiar.
- O app deve manter uma lista de **pendências de renomeação**: exemplares que mudaram de vaga por causa da cascata e precisam de novo apelido no jogo.

## Calculadora de IV embutida

Não tenho calculadora de IV; o app precisa calcular a partir de dados que eu informar.

- **Entradas:** espécie, CP, PS, custo de poeira estelar para subir de nível (define a faixa de nível) e se já foi fortalecido.
- **Saída:** todas as combinações possíveis de ataque/defesa/PS e a **faixa de IV%** (mínimo a máximo).
- **Refino opcional** pela avaliação do jogo (estrelas e barras de cada atributo). Enquanto o IV for faixa, usar o valor médio e marcar o exemplar como *IV estimado*.
- Permitir **informar o IV direto** quando eu já souber. Minha entrada direta é a **concatenação de porcentagem e os três valores** (ataque/defesa/PS), por exemplo `96% 15/14/15` ou `15/14/15 96%`. O campo deve aceitar a ordem em qualquer sentido e separadores variados (espaço, parênteses, hífen), sem exigir um formato rígido.
- **Validar a consistência:** a porcentagem é (ataque + defesa + PS) / 45, arredondada. Se o que digitei não bater, o app avisa e mostra o valor calculado, sem salvar em silêncio. Se eu digitar só a porcentagem ou só os três valores, aceitar também (a porcentagem é derivada dos valores; só a porcentagem fica marcada como *IV sem detalhe*).
- Precisa dos atributos base de cada espécie e da tabela de multiplicadores de CP por nível (na tabela de espécies). Uma fonte externa pode alimentar esses dados, mas **verifique se ela é estável e atual** antes de depender dela; a calculadora local é o padrão.

## Tabela de espécies

Para cada espécie: cadeia de evolução, diferença de sexo, se pode ter Mega/Dinamax/Gigamax, se existe versão brilhante, trajes conhecidos e atributos base. Comece com uma **base inicial editável** (ex.: JSON que vou completando) em vez de tentar ser completa de saída.

## Dados de cada exemplar

Espécie, CP, IV (e ataque/defesa/PS), **origem**, **data de captura ou recebimento**, sexo, tamanho, brilhante, sortudo, status Rocket (normal/sombroso/purificado), traje, fundo, evolução atual, notas livres.

## Edição (requisito obrigatório)

Posso **editar qualquer informação** de qualquer exemplar depois de cadastrado (adicionar variação, atributo novo, corrigir IV, mudar traje, fundo, origem etc.). Ao editar, **todas as vagas, status e IDs a renomear são recalculados**.

Também posso **editar a tabela de espécies**: adicionar traje, marcar Mega/Dinamax/Gigamax, cadastrar fundo, criar atributo ou categoria de vaga nova.

## Entrada de dados

1. **Manual**, com busca por espécie e formulário rápido.
2. **Importação por CSV** (ex.: exportação do Poke Genie). Campos que o CSV não traz (sexo, tamanho, traje, fundo, origem, data) ficam pendentes para eu completar.
3. (Futuro) leitura de prints pela API do Claude.

## Telas

- **Meus Pokémon:** lista com busca, filtros e status calculado.
- **Trocas** e **Descarte:** listas só dos exemplares com esses status.
- **Coleção:** progresso por espécie, por cadeia, por categoria e geral, em **gauge (%) e x/y** ao mesmo tempo. Reservas *aguardando evolução* aparecem separadas (ex.: 12/20, mais 3 reservadas).
- **Detalhe do exemplar:** vagas que ocupa, ID para renomear, edição completa.
- **Renomeações pendentes.**
- **Tabela de espécies:** consulta e edição.

**Ordenação e filtros:** ordenar por evolução (agrupando a cadeia na ordem Pichu, Pikachu, Raichu) e por **qualquer atributo**, crescente e decrescente, com dois critérios combináveis. Os mesmos critérios servem de filtro.

## Testes obrigatórios (núcleo)

- Pichu / Pikachu / Raichu: Pikachu 96% sozinho; depois entra um 85%; depois um 98% (cascata completa).
- Exemplar que ocupa várias vagas ao mesmo tempo.
- Sortudo sem vaga sempre vira "descartar".
- Empate de IV: fica o mais antigo.
- Edição de um exemplar que muda suas vagas e IDs a renomear.
- Espécie sem gênero ou de um sexo só.
- Fundo novo cadastrado na hora.
- ID de vaga estável quando o exemplar da vaga muda.
- Calculadora de IV: faixa correta e refino pela avaliação.
- Entrada direta de IV: `96% 15/14/15` e `15/14/15 96%` dão o mesmo resultado; porcentagem inconsistente com os valores gera aviso; só a porcentagem ou só os valores também são aceitos.
- Cadastrar um evento com traje novo cria as vagas novas sem alterar nenhum ID de vaga existente.
- Evento futuro não gera vagas até ser ativado.
- Progresso (gauge % e x/y) é recalculado quando entram vagas novas.
- Backup antigo é migrado corretamente para o esquema novo.

## Expansões e eventos sazonais

O jogo muda o tempo todo (evento novo, traje novo, fundo novo, forma nova). O projeto precisa **prever expansões** sem reescrever o núcleo.

- **Categorias de vaga e atributos são dados, não código fixo.** Trajes, fundos, formas de potencial e até categorias inteiras novas devem poder ser adicionados pela tabela de espécies (e pela interface), e as vagas são geradas a partir disso.
- **Adicionar algo novo nunca altera IDs de vagas existentes.** Só cria vagas novas.
- **Vagas novas aparecem como pendência:** ao cadastrar um evento ou traje, o app mostra "novas vagas abertas" e o progresso (gauge % e x/y) é recalculado.
- **Backup versionado:** o JSON de exportação carrega um número de versão do esquema, e mudanças futuras no formato vêm com migração e teste.

### Log de eventos por data

Quero um **registro de eventos sazonais, ordenado por data**.

- Cada evento tem: nome, data de início e de fim, descrição livre e **o que trouxe**: espécies afetadas, trajes novos, fundos novos, estreias de brilhante ou de formas (Mega/Dinamax/Gigamax), categorias novas.
- Registrar um evento **gera as vagas correspondentes** (ex.: traje novo para o Pikachu cria a vaga do traje e a versão brilhante, se existir).
- Cada vaga e cada traje/fundo guarda **"disponível desde"** (data ou evento de origem).
- Cada exemplar pode ter o campo opcional **evento de origem** (em qual evento foi capturado ou recebido).
- Tela de **linha do tempo**: eventos por data, com as vagas que abriram, quantas já preenchi e quantas faltam, e filtro por período.
- Eventos futuros ou que ainda vão acontecer podem ser cadastrados antes (para eu me planejar), sem gerar vagas até serem ativados.

## Pontos ainda em aberto

- Formato exato do ID de vaga (proponha opções).
- Limite de caracteres do apelido no jogo (confirmar).
- Exemplares "trocar" e "descartar" também recebem um apelido padrão (ex.: marcador T/D)? Perguntar antes de implementar.
