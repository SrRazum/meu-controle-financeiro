# Preparar o Supabase de testes

A produção não precisa ser alterada para esta etapa. Use um projeto separado, com contas e lançamentos fictícios.

**Estado atual:** o projeto de testes `lxsvcmsdxcwiwyzexyyc` já está configurado em `config.js`. A tabela e a função foram detectadas, com acesso anônimo negado. Para testar no computador, abra a prévia abaixo e use uma conta de teste com e-mail confirmado. Os passos de criação abaixo ficam como referência; não é necessário criar outro projeto ou executar novamente o SQL apenas por causa deste guia.

1. Entre no [painel do Supabase](https://supabase.com/dashboard), escolha **New project / Novo projeto** e crie um projeto chamado, por exemplo, `meu-controle-financeiro-testes`. Guarde a senha do banco no seu gerenciador de senhas; ela não precisa ser enviada nesta conversa.
2. No projeto novo, abra o **SQL Editor**, crie uma consulta e execute o conteúdo de [`supabase/migrations/202609120001_account_sync.sql`](supabase/migrations/202609120001_account_sync.sql). Isso cria a nova tabela, a função de sincronização e as regras de acesso. O SQL é para um projeto novo; não execute no projeto atual de produção.
3. No diálogo **Connect** ou nas configurações do projeto, copie a **Project URL**. Em **Settings → API Keys**, copie a chave **Publishable** (ou `anon`, se o projeto só disponibilizar chaves antigas). Basta fornecer esses dois valores para configurar o aplicativo. Nunca é necessário fornecer chave `secret`, `service_role` ou senha do banco. [Referência oficial das chaves](https://supabase.com/docs/guides/getting-started/api-keys).
4. Em **Authentication → URL Configuration**, configure `http://127.0.0.1:4173/` como URL da aplicação e redirecionamento permitido para o teste local. Para usar outra origem HTTPS de testes, substitua pela URL exata. Mantenha a confirmação de e-mail para testar o fluxo completo. [Referência oficial de redirecionamentos](https://supabase.com/docs/guides/auth/redirect-urls).

## Abrir a aplicação de desenvolvimento

Na branch `dev/v1.15-account-offline-sync`, preencha as duas primeiras configurações de `config.js` com a URL e a chave pública do projeto novo. Inicie a prévia com `npm run dev` (ou `node scripts/preview.cjs`) e abra `http://127.0.0.1:4173/` em um perfil de navegador destinado a testes. Essa prévia fica restrita ao computador local.

Se a aplicação já foi aberta antes de configurar o projeto, limpe os dados **apenas dessa origem de testes**, antes de cadastrar contas/lançamentos, ou incremente a versão de `sw.js`. O cache precisa receber a nova configuração.

O primeiro cadastro/login precisa de internet. Depois de entrar e carregar o aplicativo, registre um lançamento sem conexão, feche/reabra a aba e confirme que ele permanece. Reconecte e confira a sincronização em outro navegador com a mesma conta.

## Validação mínima antes de pensar em produção

- Criar duas contas fictícias A/B, confirmar e-mails e verificar que cada uma vê somente seus registros.
- Usar dois navegadores na conta A: conferir criação, edição, pagamento, exclusão e totais de relatórios.
- Fazer alterações offline, sair da conta, entrar em B e depois retornar a A: a fila de A deve continuar preservada.
- Alterar o mesmo lançamento em dois dispositivos: revisar o conflito e confirmar a versão escolhida.
- Sair sem conexão e reabrir: deve exigir login, sem reabrir a conta anterior automaticamente.
- Importar um cofre antigo fictício e testar senha incorreta, senha correta e reimportação. Um projeto novo não tem a tabela `finance_vault`; começar pela importação local. A importação remota exige preparar uma cópia de cofre **fictício** e RLS adequada no ambiente de testes.
- Repetir no celular/PWA instalado, inclusive após suspensão e atualização.

## Testes automatizados reproduzíveis

Com Node.js instalado, execute `npm install`, `npm test` e `npm run test:browser`. O último requer um Chromium do Playwright (`npx playwright install chromium`) ou a variável `BROWSER_PATH` apontando para Chrome/Edge instalado.

Os testes de banco usam [PGlite](https://pglite.dev/docs/about), uma compilação de PostgreSQL, com usuários/identidade simulados. Os testes do aplicativo incluem respostas atrasadas e persistência offline; um teste usa o cliente Supabase real com transporte local simulado. Isso não substitui validar autenticação, e-mails, regras e concorrência no serviço Supabase real.
