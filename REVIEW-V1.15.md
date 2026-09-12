# V1.15 — inicialização por conta, em desenvolvimento

Base verificada: `v1.13-producao` e `v1.14-cadastro-conta-revisao` apontavam para `da479659369a6c11e46b4daeafe184681a05b891`. Branch de trabalho: `dev/v1.15-account-offline-sync`. Nenhum deploy nem alteração no banco de produção foi executado.

## Achados da revisão

- `index.html` concentrava proteção local, CRUD, autenticação e sincronização de um cofre completo. A sincronização fazia leitura/mesclagem/upsert sem comparação atômica no servidor: dois dispositivos podiam sobrescrever alterações concorrentes.
- `auth.js` era carregado indiretamente por `about.js`, substituindo funções globais. `config.js` também substituía login/logout e removia o cofre ao sair, arriscando perder alterações offline. Alguns guardas verificavam `window.unlocked` embora o estado real fosse um `let` global.
- O armazenamento local não era separado por UID. O cofre exigia uma senha adicional que também era necessária em outro dispositivo.
- As exclusões eram descartadas após 180 dias, permitindo a reaparição de registros vindos de dispositivos muito antigos.
- O service worker não pré-carregava autenticação/configuração; o cliente Supabase vinha de um CDN com versão flutuante. HTML atualizado e scripts de cache podiam pertencer a versões diferentes.
- O workflow aceitava execução manual sem condicionar o job à branch de produção.

## Alterações implementadas

| Arquivo | Alteração |
| --- | --- |
| `auth.js` | Login/cadastro como entrada; restauração de sessão; abertura offline para a última conta deste dispositivo; troca de conta limpa estado e formulários visíveis; logout conserva fila; importação explícita do cofre antigo; conflitos visíveis com escolha das versões. |
| `sync-store.js` | IndexedDB por UID; registros e fila persistidos na mesma transação; alterações sucessivas coalescidas sem perder a base original; confirmação de envio por ID de operação; proteção contra gravação de aba desatualizada. |
| `supabase/migrations/202609120001_account_sync.sql` | Nova tabela `finance_records_v2`, RLS de leitura por `auth.uid()`, escrita somente pela função `finance_sync_v2`. Função valida o UID esperado, serializa requisições da conta, compara base/valor atual atomicamente e retorna conflitos sem sobrescrever. Não modifica `finance_vault`. |
| `index.html` | Retira criação de senha e bloqueio por inatividade; mantém somente funções criptográficas para ler dados antigos; carrega autenticação explicitamente; indica pendências; escapa textos inseridos no HTML; impede salvar formulário aberto antes de uma atualização concorrente. |
| `config.js` | Remove interceptadores de conta e exclusões locais. Preserva filtro de relatórios. Configurado com URL/chave pública do projeto de TESTES `lxsvcmsdxcwiwyzexyyc`, fornecidas pelo usuário. |
| `sw.js` | Cache completo da versão, inclusive cliente Supabase; HTML e scripts da mesma versão; atualização aguarda ação do usuário; nomes de cache por escopo. Não acessa tokens nem envia registros. |
| `about.js` | Remove carregamento indireto de autenticação e atualiza descrição da versão/proteção. |
| `vendor/` | Supabase JS 2.57.4 UMD fixado localmente, com licença MIT. SHA-256 do download: `7e94b62086deecef8c0ba3b38f514e2a1944ff6c81d92fb3ff967828c406c38f`. |
| Workflow | Jobs só executam em `refs/heads/v1.13-producao`, incluindo disparo manual. |
| `tests/` | Testes da fila e integração em navegador com autenticação/transporte simulados, sem acessar contas reais. |

A sincronização é tentada após salvar, ao reconectar, ao voltar à aba e a cada 15 segundos enquanto a página executa. Falhas têm espera progressiva de até 5 minutos; chamadas expiram em 20 segundos. Web Locks evita envios concorrentes entre abas quando disponível; a função no servidor também serializa a conta. Mudanças feitas durante um envio continuam pendentes até confirmação própria. IDs existentes e marcas de exclusão são preservados, sem expiração por relógio.

## Proteção e limites importantes

**Esta proposta retira a criptografia do cofre para os dados novos.** IndexedDB e os valores da nova tabela são legíveis por quem tem acesso ao perfil do navegador ou privilégios no banco. HTTPS e RLS protegem transporte e acesso remoto; não são criptografia ponta a ponta. A identidade lembrada offline é conveniência local, não prova de autenticação perante o servidor. Um perfil separado do navegador e bloqueio do dispositivo são necessários em equipamentos compartilhados. Se for exigida criptografia ponta a ponta, é preciso projetar distribuição/recuperação de chaves antes da promoção.

O navegador pode suspender a aba/PWA e não executar o temporizador. **Não há promessa de sincronização com o aplicativo fechado.** A fila é retomada quando a aplicação volta a executar. Não foi implementado envio pelo service worker; Background Sync tem suporte limitado e não permite garantir execução. Referência: [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API).

Persistência é solicitada ao navegador, mas pode ser negada. Limpeza de dados do site, desinstalação e descarte de armazenamento podem apagar alterações ainda não enviadas. Limites de armazenamento geram erro de gravação, sem confirmação de sucesso. A fila não é um backup externo.

Conflitos não usam o relógio do dispositivo para eleger um vencedor: o usuário compara as versões e escolhe. Não há mesclagem automática por campo. A nova sincronização transfere todos os registros da conta a cada consulta; paginação e redução de tráfego ficam para uma evolução, caso o volume exija.

A separação remota depende de validar a migração e os privilégios no ambiente real. Ver [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). A revisão não acessou dados, políticas ou credenciais privadas do projeto Supabase existente.

## Migração e convivência

Os cofres antigos locais e remotos permanecem intactos. Para importá-los, entrar na conta desejada, abrir Sincronizar, informar a senha antiga e selecionar a origem. A conta de destino e a quantidade são confirmadas antes da gravação; registros divergentes com o mesmo ID abortam a importação. Dados locais sem vínculo comprovável nunca são atribuídos automaticamente à conta.

Não é possível remover a senha de um cofre antigo sem descriptografá-lo uma vez. Esquecer essa senha continua impedindo recuperar seu conteúdo. Dados novos usam apenas login, sem criar nova senha de cofre.

V1.14 e V1.15 usam modelos de armazenamento distintos e **não sincronizam entre si**. Antes de promover, planejar corte coordenado: backup, conciliação de pendências em todos os dispositivos antigos, importação, validação dos totais e atualização de todos os clientes. Voltar à V1.14 não converte lançamentos novos de V1.15 ao cofre antigo; o retorno exige um plano de dados, não apenas trocar a branch. Não testar esta branch na mesma origem/perfil de produção.

## Preparação do ambiente de teste

1. Criar um projeto Supabase isolado e aplicar o SQL incluído nele.
2. Preencher somente a URL e a chave pública desse projeto em `config.js`. Configurar URLs de autenticação/redirecionamento para a origem de teste.
3. Servir esta branch em localhost ou HTTPS de teste, em perfil separado. Não executar o workflow de produção.
4. Usar contas e registros fictícios; preparar um cofre antigo de teste para validar a importação.
5. Incrementar a versão do cache do service worker ao preparar uma nova versão distribuída.

## Validação executada e pendente

Na continuação de 12/09/2026, o usuário forneceu a URL e a chave pública do projeto separado `lxsvcmsdxcwiwyzexyyc`, agora configurado. A API de autenticação respondeu com cadastro por e-mail habilitado e confirmação obrigatória. A tabela `finance_records_v2` e a função `finance_sync_v2` retornaram HTTP 401 / `42501` (permissão negada) para chamadas sem usuário autenticado. Isso confirma a presença desses objetos e o bloqueio anônimo, mas não comprova a versão exata do SQL instalado nem as regras para usuários autenticados. Nenhuma conta foi criada, nenhum lançamento foi enviado e nenhum SQL remoto foi executado por essas verificações. O [guia de preparação](SETUP-TESTES.md) documenta o ambiente; `npm run dev` abre uma prévia restrita ao computador local.

Executado:

- Migração SQL executada em PostgreSQL local descartável ([PGlite](https://pglite.dev/docs/about)), com o esquema de autenticação simulado: isolamento A/B, acesso anônimo negado, escrita direta negada, UID de outra conta rejeitado, repetição idempotente, conflitos, exclusões, reversão atômica de lote inválido e cofre antigo intacto.
- Testes da fila e de respostas atrasadas: confirmação de envio não descarta edição posterior; recuperação após erro de gravação não exibe dados da conta anterior; saída offline mantém fila.
- Teste com o cliente Supabase 2.57.4 real e transporte simulado: logout offline remove os tokens locais e não restaura a sessão encerrada.
- Edge/Chromium headless com IndexedDB e service worker reais, mas autenticação e servidor simulados: abertura, gravação e reabertura offline, envio ao reconectar, revisão de conflito, logout e isolamento A/B. Os formulários de criação, edição e exclusão também são exercitados, incluindo texto que não deve ser interpretado como HTML.
- Verificação de sintaxe JavaScript e `git diff --check`.

As verificações adicionais levaram a correções na validação de registros/datas/valores no servidor e na fila, no isolamento de uma resposta tardia após falha de gravação e no logout offline. A implementação fixada do Supabase retornava antes de limpar os tokens quando o logout remoto falhava; agora a aplicação garante a limpeza local, mantém um marcador de sessão encerrada e avisa quando não consegue confirmar a saída no servidor. Uma saída sem conexão não garante revogar a sessão no servidor. Também foi corrigido um aviso antigo no formulário que ainda prometia criptografia e bloqueio automático.

**Ainda não validado para produção:**

- Aplicação do SQL no Supabase remoto e validação das permissões efetivas via API. Concorrência entre conexões independentes ainda exige teste: PGlite usa um único backend, portanto não comprova a concorrência real do serviço.
- Cadastro real, confirmação de e-mail, senha incorreta, expiração/renovação de sessão e retorno offline com token expirado. O teste do SDK também usa transporte simulado.
- Dois dispositivos reais, alternância entre contas durante requisições e outra aba já aberta; edição versus exclusão concorrente.
- Importação de cofres reais representativos, senha errada, conflito de IDs, reimportação e conferência dos totais.
- Falta de espaço, armazenamento indisponível/corrompido, remoção de dados do site e grandes volumes.
- Safari/iOS, Chrome/Android e PWA instalado: suspensão, reabertura, atualização de cache e funcionamento prolongado offline.
- Regressão funcional completa de entradas/saídas, edição, exclusão, pagamentos, recorrências, filtros, relatórios e datas locais.
- Revisão da versão vendorizada do Supabase e seus avisos de segurança antes de publicar.

Nenhuma dessas pendências deve ser interpretada como teste concluído. Não promover esta branch até validar o ambiente e o plano de migração.
