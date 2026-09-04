MEU CONTROLE FINANCEIRO — V1.12 CANDIDATA

Base: V1.11 recuperada do deploy de 04/09/2026 às 17:50.

ALTERAÇÃO DESTA CANDIDATA:
- index.html passa a carregar explicitamente config.js antes da biblioteca Supabase.
- Service Worker atualizado para financeiro-v1.12 para evitar cache da V1.11.
- Backup integral do index.html V1.11 incluído em backups/.

IMPORTANTE:
- config.js continua com placeholders. Não inserir credenciais reais neste pacote sem conferência.
- Não apagar localStorage nem alterar a senha de proteção do aplicativo.
- Esta versão ainda não deve ser considerada final até testarmos a sincronização real com o Supabase.
